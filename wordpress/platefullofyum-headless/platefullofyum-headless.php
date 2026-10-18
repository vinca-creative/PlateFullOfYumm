<?php
/**
 * Plugin Name: Plate Full of Yum Headless Content
 * Description: Registers editor-controlled public content classification for direct WordPress REST imports.
 * Version: 1.0.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Text Domain: platefullofyum-headless
 */

defined( 'ABSPATH' ) || exit;

final class PFOY_Headless_Content {
	const KIND_META = 'pfoy_content_kind';
	const SEO_FIELD = 'pfoy_seo';
	const REVISION_OPTION = 'pfoy_publication_revision';
	const DEPLOYED_OPTION = 'pfoy_publication_deployed_revision';
	const STATE_OPTION = 'pfoy_publication_state';
	const DISPATCH_HOOK = 'pfoy_retry_publication';
	private static $revision_bumped_this_request = false;

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_kind_meta' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_seo_field' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_kind_field' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_comment_routes' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_publication_routes' ) );
		add_action( 'init', array( __CLASS__, 'initialize_publication' ), 1 );
		add_action( 'wp_after_insert_post', array( __CLASS__, 'post_changed' ), 10, 4 );
		add_action( 'added_post_meta', array( __CLASS__, 'post_meta_changed' ), 10, 4 );
		add_action( 'updated_post_meta', array( __CLASS__, 'post_meta_changed' ), 10, 4 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'post_meta_changed' ), 10, 4 );
		add_action( 'set_object_terms', array( __CLASS__, 'object_terms_changed' ), 10, 6 );
		add_action( 'created_term', array( __CLASS__, 'term_changed' ), 10, 3 );
		add_action( 'edited_term', array( __CLASS__, 'term_changed' ), 10, 3 );
		add_action( 'delete_term', array( __CLASS__, 'term_deleted' ), 10, 4 );
		add_action( 'pre_delete_term', array( __CLASS__, 'term_pre_deleted' ), 10, 2 );
		add_action( 'before_delete_post', array( __CLASS__, 'post_deleted' ), 10, 2 );
		add_action( 'comment_post', array( __CLASS__, 'comment_posted' ), 10, 3 );
		add_action( 'transition_comment_status', array( __CLASS__, 'comment_status_changed' ), 10, 3 );
		add_filter( 'wp_update_comment_data', array( __CLASS__, 'comment_data_changed' ), 10, 3 );
		add_action( 'delete_comment', array( __CLASS__, 'comment_deleted' ), 10, 2 );
		add_action( self::DISPATCH_HOOK, array( __CLASS__, 'dispatch_pending' ) );
		add_action( 'admin_notices', array( __CLASS__, 'show_publication_notice' ) );
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'comment_cors' ), 999, 4 );
		add_action( 'save_post_post', array( __CLASS__, 'save_kind' ), 10, 2 );
		add_action( 'admin_notices', array( __CLASS__, 'show_kind_notice' ) );
	}
	private static function publication_configured() {
		if ( ! defined( 'PFOY_PUBLICATION_ENABLED' ) || true !== PFOY_PUBLICATION_ENABLED ) {
			return false;
		}
		if ( ! defined( 'PFOY_PUBLICATION_GITHUB_REPOSITORY' ) || ! preg_match( '/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/', PFOY_PUBLICATION_GITHUB_REPOSITORY ) ) {
			return false;
		}
		if ( ! defined( 'PFOY_GITHUB_DISPATCH_TOKEN' ) || ! is_string( PFOY_GITHUB_DISPATCH_TOKEN ) || '' === PFOY_GITHUB_DISPATCH_TOKEN ) {
			return false;
		}
		if ( ! defined( 'PFOY_PUBLICATION_WORKFLOW' ) || ! is_string( PFOY_PUBLICATION_WORKFLOW ) || ! preg_match( '/^[A-Za-z0-9 _.\\-]{1,100}$/', PFOY_PUBLICATION_WORKFLOW ) ) {
			return false;
		}
		return defined( 'PFOY_PUBLICATION_ACK_SECRET' ) && is_string( PFOY_PUBLICATION_ACK_SECRET ) && strlen( PFOY_PUBLICATION_ACK_SECRET ) >= 32;
	}

	public static function initialize_publication() {
		if ( ! self::publication_configured() ) {
			return;
		}
		add_option( self::REVISION_OPTION, '1', '', false );
		add_option( self::DEPLOYED_OPTION, '0', '', false );
		$revision = self::read_revision( self::REVISION_OPTION );
		if ( ! self::valid_source_revision( $revision ) ) {
			return;
		}
		$state = get_option( self::STATE_OPTION, false );
		if ( false === $state || ! is_array( $state ) ) {
			self::write_publication_state( array(
				'revision' => $revision,
				'outcome' => 'pending',
				'event' => 'initial',
				'attempts' => 0,
				'failed_revision' => '',
				'failure_code' => '',
				'success_revision' => '',
				'deployment_state' => 'not_started',
			) );
			self::schedule_dispatch( 5, true );
		}
		$state = get_option( self::STATE_OPTION, array() );
		$deployed = self::read_revision( self::DEPLOYED_OPTION );
		if ( ! self::valid_source_revision( $deployed ) ) {
			return;
		}
		$failed_release = is_array( $state ) && isset( $state['revision'], $state['outcome'], $state['failure_code'] ) && $revision === $state['revision'] && 'failed' === $state['outcome'] && 'dispatch_failed' !== $state['failure_code'];
		if ( ! $failed_release && self::compare_revisions( $revision, $deployed ) > 0 && ! wp_next_scheduled( self::DISPATCH_HOOK ) ) {
			self::schedule_dispatch( 5 );
		}
	}

	private static function read_revision( $option_name ) {
		global $wpdb;
		$value = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1", $option_name ) );
		return is_string( $value ) && preg_match( '/^(0|[1-9][0-9]{0,19})$/', $value ) ? $value : '';
	}

	private static function compare_revisions( $left, $right ) {
		$left = ltrim( (string) $left, '0' );
		$right = ltrim( (string) $right, '0' );
		$left = '' === $left ? '0' : $left;
		$right = '' === $right ? '0' : $right;
		if ( strlen( $left ) !== strlen( $right ) ) {
			return strlen( $left ) < strlen( $right ) ? -1 : 1;
		}
		return strcmp( $left, $right );
	}
	private static function compare_release_identity( $candidate, $previous ) {
		if ( ! is_array( $previous ) || ! isset( $previous['run_id'], $previous['run_attempt'], $previous['repository'], $previous['workflow'], $previous['sha'], $previous['deployment_id'] ) || ! preg_match( '/^[1-9][0-9]{0,19}$/', (string) $previous['run_id'] ) || ! preg_match( '/^[1-9][0-9]{0,4}$/', (string) $previous['run_attempt'] ) ) {
			return -1;
		}
		foreach ( array( 'repository', 'workflow' ) as $key ) {
			if ( ! is_string( $previous[ $key ] ) || ! hash_equals( $previous[ $key ], $candidate[ $key ] ) ) {
				return -1;
			}
		}
		$run_order = self::compare_revisions( $candidate['run_id'], $previous['run_id'] );
		if ( 0 !== $run_order ) {
			return $run_order;
		}
		$attempt_order = self::compare_revisions( $candidate['run_attempt'], $previous['run_attempt'] );
		if ( 0 !== $attempt_order ) {
			return $attempt_order;
		}
		foreach ( array( 'sha', 'deployment_id' ) as $key ) {
			if ( ! is_string( $previous[ $key ] ) || ! hash_equals( $previous[ $key ], $candidate[ $key ] ) ) {
				return -1;
			}
		}
		return 0;
	}

	private static function complete_dispatch_for_revision( $revision ) {
		$desired = self::read_revision( self::REVISION_OPTION );
		if ( $revision === $desired ) {
			wp_clear_scheduled_hook( self::DISPATCH_HOOK );
		} elseif ( self::valid_source_revision( $desired ) && self::compare_revisions( $desired, $revision ) > 0 ) {
			self::schedule_dispatch( 5, true );
		}
	}

	private static function write_publication_state( $changes ) {
		$state = get_option( self::STATE_OPTION, array() );
		if ( ! is_array( $state ) ) {
			$state = array();
		}
		update_option( self::STATE_OPTION, array_merge( $state, $changes ), false );
	}

	private static function schedule_dispatch( $delay, $replace = false ) {
		if ( ! self::publication_configured() ) {
			return;
		}
		if ( $replace ) {
			wp_clear_scheduled_hook( self::DISPATCH_HOOK );
		}
		if ( ! wp_next_scheduled( self::DISPATCH_HOOK ) ) {
			wp_schedule_single_event( time() + max( 1, (int) $delay ), self::DISPATCH_HOOK );
		}
	}

	private static function advance_public_revision( $event ) {
		if ( ! self::publication_configured() || self::$revision_bumped_this_request ) {
			return;
		}
		self::initialize_publication();
		global $wpdb;
		$inserted = $wpdb->query( $wpdb->prepare(
			"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
			self::REVISION_OPTION,
			'1'
		) );
		if ( false === $inserted ) {
			return;
		}
		$updated = $wpdb->query( $wpdb->prepare(
			"UPDATE {$wpdb->options} SET option_value = CAST(option_value AS UNSIGNED) + 1 WHERE option_name = %s",
			self::REVISION_OPTION
		) );
		if ( 1 !== $updated ) {
			return;
		}
		wp_cache_delete( self::REVISION_OPTION, 'options' );
		self::$revision_bumped_this_request = true;
		$revision = self::read_revision( self::REVISION_OPTION );
		if ( ! self::valid_source_revision( $revision ) ) {
			return;
		}
		self::write_publication_state( array(
			'revision' => $revision,
			'outcome' => 'pending',
			'event' => sanitize_key( $event ),
			'attempts' => 0,
			'failed_revision' => '',
			'failure_code' => '',
			'success_revision' => '',
			'deployment_state' => 'not_started',
		) );
		self::schedule_dispatch( 5, true );
	}

	private static function update_deployed_revision( $revision ) {
		global $wpdb;
		$inserted = $wpdb->query( $wpdb->prepare(
			"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
			self::DEPLOYED_OPTION,
			'0'
		) );
		if ( false === $inserted ) {
			return false;
		}
		$updated = $wpdb->query( $wpdb->prepare(
			"UPDATE {$wpdb->options} AS deployed INNER JOIN {$wpdb->options} AS desired ON desired.option_name = %s SET deployed.option_value = %s WHERE deployed.option_name = %s AND CAST(desired.option_value AS UNSIGNED) = CAST(%s AS UNSIGNED) AND CAST(deployed.option_value AS UNSIGNED) < CAST(%s AS UNSIGNED)",
			self::REVISION_OPTION,
			$revision,
			self::DEPLOYED_OPTION,
			$revision,
			$revision
		) );
		wp_cache_delete( self::DEPLOYED_OPTION, 'options' );
		return false === $updated ? false : (int) $updated;
	}

	public static function register_publication_routes() {
		register_rest_route( 'pfoy/v1', '/publication/status', array(
			'methods' => WP_REST_Server::READABLE,
			'callback' => array( __CLASS__, 'publication_status' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( 'pfoy/v1', '/publication/ack', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( __CLASS__, 'acknowledge_publication' ),
			'permission_callback' => '__return_true',
		) );
	}

	public static function publication_status() {
		$desired = self::read_revision( self::REVISION_OPTION );
		$deployed = self::read_revision( self::DEPLOYED_OPTION );
		$revisions_valid = self::valid_source_revision( $desired ) && self::valid_source_revision( $deployed );
		$enabled = self::publication_configured() && $revisions_valid;
		$desired = self::valid_source_revision( $desired ) ? $desired : '0';
		$deployed = self::valid_source_revision( $deployed ) ? $deployed : '0';
		$state = get_option( self::STATE_OPTION, array() );
		if ( ! is_array( $state ) ) {
			$state = array();
		}
		$outcome = 'disabled';
		if ( $enabled ) {
			$outcome = 'pending';
			if ( self::compare_revisions( $desired, $deployed ) <= 0 && isset( $state['success_revision'] ) && $desired === $state['success_revision'] ) {
				$outcome = 'deployed';
			} elseif ( self::compare_revisions( $desired, $deployed ) > 0 && isset( $state['revision'] ) && $desired === $state['revision'] && isset( $state['outcome'] ) && 'failed' === $state['outcome'] ) {
				$outcome = 'failed';
			} elseif ( self::compare_revisions( $desired, $deployed ) > 0 && isset( $state['revision'] ) && $desired === $state['revision'] && isset( $state['outcome'] ) && 'dispatched' === $state['outcome'] ) {
				$outcome = 'dispatched';
			}
		}
		$result = array(
			'contract_version' => 1,
			'enabled' => $enabled,
			'desired_revision' => $desired,
			'deployed_revision' => $deployed,
			'outcome' => $outcome,
		);
		if ( $enabled && isset( $state['revision'] ) && $desired === $state['revision'] && 'failed' === $outcome ) {
			$result['failure_code'] = isset( $state['failure_code'] ) ? (string) $state['failure_code'] : '';
			$result['deployment_state'] = isset( $state['deployment_state'] ) ? (string) $state['deployment_state'] : 'not_started';
		} elseif ( 'deployed' === $outcome ) {
			$result['failure_code'] = '';
			$result['deployment_state'] = 'complete';
		}
		return rest_ensure_response( $result );
	}
	private static function public_content_post( $post ) {
		return $post && 'publish' === $post->post_status && empty( $post->post_password ) && in_array( $post->post_type, array( 'post', 'page' ), true );
	}

	private static function public_media_post( $post ) {
		return $post && 'attachment' === $post->post_type && in_array( $post->post_status, array( 'inherit', 'publish' ), true );
	}

	private static function create_card_post_types() {
		$types = apply_filters( 'pfoy_create_card_post_types', array( 'mv_create', 'mv_creation' ) );
		if ( ! is_array( $types ) ) {
			return array();
		}
		$types = array_filter( $types, 'is_string' );
		$types = array_map( 'sanitize_key', $types );
		return array_values( array_unique( array_filter( $types ) ) );
	}

	private static function public_create_card_post_type( $post_type ) {
		return in_array( $post_type, self::create_card_post_types(), true );
	}

	private static function post_projection_changed( $before, $after, $fields ) {
		foreach ( $fields as $field ) {
			if ( (string) $before->$field !== (string) $after->$field ) {
				return true;
			}
		}
		return false;
	}

	public static function post_changed( $post_id, $post, $update, $before ) {
		if ( ! self::publication_configured() || ! $post || wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) || ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ) {
			return;
		}
		if ( in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
			$was_public = self::public_content_post( $before );
			$is_public = self::public_content_post( $post );
			if ( $was_public !== $is_public || ( $is_public && $was_public && self::post_projection_changed( $before, $post, array( 'post_status', 'post_title', 'post_content', 'post_excerpt', 'post_name', 'post_password', 'post_author', 'post_date', 'post_date_gmt', 'post_parent', 'comment_status', 'menu_order' ) ) ) || ( $is_public && ! $before ) ) {
				self::advance_public_revision( 'post' );
			}
			return;
		}
		if ( self::public_media_post( $post ) || self::public_media_post( $before ) ) {
			if ( self::media_is_referenced( $post_id ) && ( ! $before || ! $post || self::post_projection_changed( $before, $post, array( 'post_status', 'post_title', 'post_excerpt', 'post_content', 'post_mime_type', 'guid' ) ) ) ) {
				self::advance_public_revision( 'media' );
			}
			return;
		}
		if ( ! self::public_create_card_post_type( $post->post_type ) ) {
			return;
		}
		$was_public = $before && 'publish' === $before->post_status && empty( $before->post_password );
		$is_public = 'publish' === $post->post_status && empty( $post->post_password );
		if ( ! self::has_public_card_reference( $post_id ) ) {
			return;
		}
		if ( $was_public !== $is_public || ( $is_public && $was_public && self::post_projection_changed( $before, $post, array( 'post_status', 'post_title', 'post_content', 'post_excerpt', 'post_name', 'post_password', 'post_modified', 'post_modified_gmt' ) ) ) || ( $is_public && ! $before ) ) {
			self::advance_public_revision( 'card' );
		}
	}
	public static function post_deleted( $post_id, $post = null ) {
		if ( ! self::publication_configured() ) {
			return;
		}
		$post = is_object( $post ) ? $post : get_post( (int) $post_id );
		if ( self::public_content_post( $post ) ) {
			self::advance_public_revision( 'post_visibility' );
			return;
		}
		if ( self::public_media_post( $post ) && self::media_is_referenced( $post_id ) ) {
			self::advance_public_revision( 'media' );
			return;
		}
		if ( $post && self::public_create_card_post_type( $post->post_type ) && 'publish' === $post->post_status && empty( $post->post_password ) && self::has_public_card_reference( $post_id ) ) {
			self::advance_public_revision( 'card' );
		}
	}


	private static function has_public_card_reference( $card_id ) {
		global $wpdb;
		$id = (int) $card_id;
		if ( $id < 1 ) {
			return false;
		}
		$needles = array(
			'mv-creation-' . $id,
			'"id":' . $id,
			'"id": ' . $id,
			'"cardId":' . $id,
			'"cardId": ' . $id,
			'"card_id":' . $id,
			'"card_id": ' . $id,
			'"creationId":' . $id,
			'"creationId": ' . $id,
			'"creation_id":' . $id,
			'"creation_id": ' . $id,
		);
		$clauses = array();
		$values = array( 'publish', 'post', 'page', '' );
		foreach ( $needles as $needle ) {
			$clauses[] = 'p.post_content LIKE %s';
			$values[] = '%' . $wpdb->esc_like( $needle ) . '%';
		}
		$sql = "SELECT COUNT(*) FROM {$wpdb->posts} p WHERE p.post_status = %s AND p.post_type IN (%s, %s) AND p.post_password = %s AND (" . implode( ' OR ', $clauses ) . ')';
		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $values ) ) > 0;
	}

	private static function media_is_referenced( $media_id ) {
		global $wpdb;
		$id = (int) $media_id;
		if ( $id < 1 ) {
			return false;
		}
		$types = array_values( array_unique( array_merge( array( 'post', 'page' ), self::create_card_post_types() ) ) );
		$type_placeholders = implode( ', ', array_fill( 0, count( $types ), '%s' ) );
		$content_needles = array( 'wp-image-' . $id, 'attachment_id="' . $id . '"', "attachment_id='" . $id . "'" );
		$meta_needles = array( '"image_id":' . $id, '"image_id": ' . $id, '"imageId":' . $id, '"imageId": ' . $id, '"attachment_id":' . $id, '"attachment_id": ' . $id, 'i:' . $id . ';' );
		$attached_file = get_post_meta( $id, '_wp_attached_file', true );
		if ( is_string( $attached_file ) && '' !== $attached_file ) {
			$content_needles[] = basename( $attached_file );
			$meta_needles[] = basename( $attached_file );
		}
		$content_clauses = array();
		$meta_clauses = array();
		$values = array_merge( array( 'publish' ), $types, array( '', (string) $id ) );
		foreach ( $content_needles as $needle ) {
			$content_clauses[] = 'p.post_content LIKE %s';
			$values[] = '%' . $wpdb->esc_like( $needle ) . '%';
		}
		foreach ( $meta_needles as $needle ) {
			$meta_clauses[] = 'image_meta.meta_value LIKE %s';
			$values[] = '%' . $wpdb->esc_like( $needle ) . '%';
		}
		$sql = "SELECT DISTINCT p.ID, p.post_type FROM {$wpdb->posts} p LEFT JOIN {$wpdb->postmeta} thumbnail ON thumbnail.post_id = p.ID AND thumbnail.meta_key = '_thumbnail_id' LEFT JOIN {$wpdb->postmeta} image_meta ON image_meta.post_id = p.ID WHERE p.post_status = %s AND p.post_type IN ({$type_placeholders}) AND p.post_password = %s AND (thumbnail.meta_value = %s OR (" . implode( ' OR ', $content_clauses ) . ') OR (' . implode( ' OR ', $meta_clauses ) . '))';
		$matches = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );
		if ( ! is_array( $matches ) ) {
			return false;
		}
		foreach ( $matches as $match ) {
			if ( in_array( $match->post_type, array( 'post', 'page' ), true ) || ( self::public_create_card_post_type( $match->post_type ) && self::has_public_card_reference( $match->ID ) ) ) {
				return true;
			}
		}
		return false;
	}

	public static function post_meta_changed( $meta_id, $post_id, $meta_key, $meta_value ) {
		if ( ! self::publication_configured() ) {
			return;
		}
		$post = get_post( (int) $post_id );
		if ( self::public_content_post( $post ) && ( self::KIND_META === $meta_key || '_thumbnail_id' === $meta_key || 0 === strpos( (string) $meta_key, '_yoast_wpseo_' ) ) ) {
			self::advance_public_revision( 'post_metadata' );
			return;
		}
		if ( $post && self::public_create_card_post_type( $post->post_type ) && 'publish' === $post->post_status && empty( $post->post_password ) && self::has_public_card_reference( $post_id ) ) {
			self::advance_public_revision( 'card' );
			return;
		}
		if ( self::public_media_post( $post ) && in_array( $meta_key, array( '_wp_attachment_image_alt', '_wp_attachment_metadata', '_wp_attached_file' ), true ) && self::media_is_referenced( $post_id ) ) {
			self::advance_public_revision( 'media' );
		}
	}

	public static function object_terms_changed( $object_id, $terms, $tt_ids, $taxonomy, $append, $old_tt_ids ) {
		$post = get_post( (int) $object_id );
		if ( self::publication_configured() && self::public_content_post( $post ) && is_object_in_taxonomy( $post->post_type, $taxonomy ) ) {
			self::advance_public_revision( 'taxonomy' );
		}
	}

	public static function term_changed( $term_id, $tt_id, $taxonomy ) {
		if ( ! self::publication_configured() || ! is_taxonomy_viewable( $taxonomy ) ) {
			return;
		}
		$objects = get_objects_in_term( (int) $term_id, $taxonomy );
		if ( is_wp_error( $objects ) ) {
			return;
		}
		foreach ( $objects as $object_id ) {
			if ( self::public_content_post( get_post( (int) $object_id ) ) ) {
				self::advance_public_revision( 'taxonomy' );
				return;
			}
		}
	}

	public static function term_deleted( $term_id, $tt_id, $taxonomy, $deleted_term = null ) {
		self::term_changed( $term_id, $tt_id, $taxonomy );
	}
	public static function term_pre_deleted( $term_id, $taxonomy ) {
		self::term_changed( $term_id, 0, $taxonomy );
	}

	private static function comment_is_public( $status ) {
		return in_array( (string) $status, array( 'approved', '1' ), true );
	}

	public static function comment_posted( $comment_id, $comment_approved, $commentdata = array() ) {
		if ( ! self::publication_configured() || ! self::comment_is_public( $comment_approved ) ) {
			return;
		}
		$comment = get_comment( (int) $comment_id );
		if ( $comment && self::public_content_post( get_post( (int) $comment->comment_post_ID ) ) ) {
			self::advance_public_revision( 'comment_visibility' );
		}
	}

	public static function comment_status_changed( $new_status, $old_status, $comment ) {
		if ( ! self::publication_configured() || self::comment_is_public( $new_status ) === self::comment_is_public( $old_status ) ) {
			return;
		}
		$comment = is_object( $comment ) ? $comment : get_comment( (int) $comment );
		if ( $comment && self::public_content_post( get_post( (int) $comment->comment_post_ID ) ) ) {
			self::advance_public_revision( 'comment_visibility' );
		}
	}

	public static function comment_data_changed( $data, $comment, $commentarr ) {
		if ( ! self::publication_configured() || ! is_array( $data ) ) {
			return $data;
		}
		if ( is_array( $comment ) ) {
			$comment = (object) $comment;
		} elseif ( ! is_object( $comment ) && is_array( $commentarr ) && isset( $commentarr['comment_ID'] ) ) {
			$comment = get_comment( (int) $commentarr['comment_ID'] );
		}
		if ( ! is_object( $comment ) || ! isset( $comment->comment_approved ) || ! self::comment_is_public( $comment->comment_approved ) ) {
			return $data;
		}
		$new_status = isset( $data['comment_approved'] ) ? $data['comment_approved'] : $comment->comment_approved;
		if ( ! self::comment_is_public( $new_status ) ) {
			return $data;
		}
		$changed = false;
		foreach ( array( 'comment_content', 'comment_author', 'comment_parent', 'comment_post_ID', 'comment_date', 'comment_date_gmt', 'comment_type' ) as $field ) {
			if ( isset( $data[ $field ] ) && (string) $data[ $field ] !== (string) $comment->$field ) {
				$changed = true;
				break;
			}
		}
		if ( $changed ) {
			$old_post = get_post( (int) $comment->comment_post_ID );
			$new_post_id = isset( $data['comment_post_ID'] ) ? (int) $data['comment_post_ID'] : (int) $comment->comment_post_ID;
			if ( self::public_content_post( $old_post ) || self::public_content_post( get_post( $new_post_id ) ) ) {
				self::advance_public_revision( 'comment_text' );
			}
		}
		return $data;
	}

	public static function comment_deleted( $comment_id, $comment = null ) {
		if ( ! self::publication_configured() ) {
			return;
		}
		$comment = is_object( $comment ) ? $comment : get_comment( (int) $comment_id );
		if ( $comment && self::comment_is_public( $comment->comment_approved ) && self::public_content_post( get_post( (int) $comment->comment_post_ID ) ) ) {
			self::advance_public_revision( 'comment_visibility' );
		}
	}

	public static function dispatch_pending() {
		if ( ! self::publication_configured() ) {
			return;
		}
		$revision = self::read_revision( self::REVISION_OPTION );
		$deployed = self::read_revision( self::DEPLOYED_OPTION );
		if ( ! self::valid_source_revision( $revision ) || ! self::valid_source_revision( $deployed ) ) {
			return;
		}
		if ( self::compare_revisions( $revision, $deployed ) <= 0 ) {
			wp_clear_scheduled_hook( self::DISPATCH_HOOK );
			return;
		}
		$state = get_option( self::STATE_OPTION, array() );
		if ( ! is_array( $state ) ) {
			$state = array();
		}
		$attempts = isset( $state['revision'] ) && $revision === $state['revision'] && isset( $state['attempts'] ) ? (int) $state['attempts'] : 0;
		$event = isset( $state['revision'] ) && $revision === $state['revision'] && isset( $state['event'] ) ? sanitize_key( $state['event'] ) : 'publication';
		$payload = array(
			'event_type' => 'wordpress-content-updated',
			'client_payload' => array(
				'revision' => $revision,
				'event' => $event,
			),
		);
		$response = wp_remote_post( 'https://api.github.com/repos/' . PFOY_PUBLICATION_GITHUB_REPOSITORY . '/dispatches', array(
			'timeout' => 10,
			'headers' => array(
				'Accept' => 'application/vnd.github+json',
				'Authorization' => 'Bearer ' . PFOY_GITHUB_DISPATCH_TOKEN,
				'Content-Type' => 'application/json',
				'User-Agent' => 'PlateFullOfYum-Publication',
				'X-GitHub-Api-Version' => '2022-11-28',
			),
			'body' => wp_json_encode( $payload ),
		) );
		$attempts++;
		if ( ! is_wp_error( $response ) && (int) wp_remote_retrieve_response_code( $response ) >= 200 && (int) wp_remote_retrieve_response_code( $response ) < 300 ) {
			self::write_publication_state( array(
				'revision' => $revision,
				'event' => $event,
				'attempts' => $attempts,
				'outcome' => 'dispatched',
				'failure_code' => '',
				'last_dispatch_at' => gmdate( 'c' ),
			) );
			self::schedule_dispatch( 900, true );
			return;
		}
		self::write_publication_state( array(
			'revision' => $revision,
			'event' => $event,
			'attempts' => $attempts,
			'outcome' => 'failed',
			'failed_revision' => $revision,
			'failure_code' => 'dispatch_failed',
			'deployment_state' => 'not_started',
		) );
		$delay = min( 3600, 60 * ( 2 ** min( 6, max( 0, $attempts - 1 ) ) ) );
		self::schedule_dispatch( $delay, true );
	}

	public static function show_publication_notice() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		$status = self::publication_status()->get_data();
		$desired = esc_html( $status['desired_revision'] );
		$deployed = esc_html( $status['deployed_revision'] );
		if ( 'disabled' === $status['outcome'] ) {
			echo '<div class="notice notice-warning"><p>' . esc_html__( 'Static publication automation is disabled: required server-side publication configuration is absent. No build or deployment can be reported as successful.', 'platefullofyum-headless' ) . '</p></div>';
			return;
		}
		$class = 'deployed' === $status['outcome'] ? 'notice notice-success' : ( 'failed' === $status['outcome'] ? 'notice notice-error' : 'notice notice-warning' );
		$message = sprintf(
			/* translators: 1: desired source revision, 2: last deployed revision, 3: publication outcome. */
			__( 'Static publication: desired source revision %1$s; deployed revision %2$s; outcome: %3$s.', 'platefullofyum-headless' ),
			$desired,
			$deployed,
			esc_html( $status['outcome'] )
		);
		if ( isset( $status['failure_code'] ) && '' !== $status['failure_code'] ) {
			$message .= ' ' . sprintf( esc_html__( 'Failure code: %s.', 'platefullofyum-headless' ), esc_html( $status['failure_code'] ) );
		}
		if ( isset( $status['deployment_state'] ) && in_array( $status['deployment_state'], array( 'upload_attempted', 'upload_completed' ), true ) && 'failed' === $status['outcome'] ) {
			$message .= ' ' . esc_html__( 'An upload was attempted; the public version may have changed and requires operator verification.', 'platefullofyum-headless' );
		}
		echo '<div class="' . esc_attr( $class ) . '"><p>' . esc_html( $message ) . '</p></div>';
	}

	private static function valid_source_revision( $value ) {
		return is_string( $value ) && preg_match( '/^(0|[1-9][0-9]{0,19})$/', $value );
	}

	private static function consume_ack_nonce( $timestamp, $body ) {
		global $wpdb;
		$prefix = 'pfoy_ack_nonce_';
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND CAST(option_value AS UNSIGNED) < %d",
			$wpdb->esc_like( $prefix ) . '%',
			time() - 600
		) );
		$nonce = $prefix . hash( 'sha256', $timestamp . '.' . $body );
		return add_option( $nonce, (string) time(), '', false );
	}

	public static function acknowledge_publication( $request ) {
		if ( ! self::publication_configured() ) {
			return self::fail( 'pfoy_publication_disabled', 'Publication acknowledgement is unavailable.', 503 );
		}
		$timestamp = (string) $request->get_header( 'x-pfoy-timestamp' );
		$signature = strtolower( (string) $request->get_header( 'x-pfoy-signature' ) );
		$body = $request->get_body();
		if ( ! preg_match( '/^[0-9]{10}$/', $timestamp ) || abs( time() - (int) $timestamp ) > 300 || ! preg_match( '/^[a-f0-9]{64}$/', $signature ) || ! is_string( $body ) || strlen( $body ) > 8192 ) {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement authentication failed.', 401 );
		}
		$expected_signature = hash_hmac( 'sha256', $timestamp . '.' . $body, PFOY_PUBLICATION_ACK_SECRET );
		if ( ! hash_equals( $expected_signature, $signature ) ) {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement authentication failed.', 401 );
		}
		$payload = json_decode( $body, true );
		if ( ! is_array( $payload ) ) {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement payload is invalid.', 400 );
		}
		$expected_keys = array( 'contract_version', 'revision', 'outcome', 'failure_code', 'deployment_state', 'repository', 'run_id', 'run_attempt', 'workflow', 'sha', 'deployment_id' );
		$actual_keys = array_keys( $payload );
		sort( $expected_keys );
		sort( $actual_keys );
		if ( $expected_keys !== $actual_keys || 1 !== $payload['contract_version'] || ! self::valid_source_revision( $payload['revision'] ) ) {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement payload is invalid.', 400 );
		}
		if ( ! is_string( $payload['repository'] ) || ! hash_equals( PFOY_PUBLICATION_GITHUB_REPOSITORY, $payload['repository'] ) || ! is_string( $payload['run_id'] ) || ! preg_match( '/^[1-9][0-9]{0,19}$/', $payload['run_id'] ) || ! is_string( $payload['run_attempt'] ) || ! preg_match( '/^[1-9][0-9]{0,4}$/', $payload['run_attempt'] ) || ! is_string( $payload['workflow'] ) || ! preg_match( '/^[A-Za-z0-9 _.\\-]{1,100}$/', $payload['workflow'] ) || ! hash_equals( PFOY_PUBLICATION_WORKFLOW, $payload['workflow'] ) || ! is_string( $payload['sha'] ) || ! preg_match( '/^[a-f0-9]{40,64}$/i', $payload['sha'] ) || ! is_string( $payload['deployment_id'] ) || ! hash_equals( $payload['run_id'] . '-' . $payload['run_attempt'], $payload['deployment_id'] ) ) {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement release identity is invalid.', 400 );
		}
		$identity = array(
			'repository' => $payload['repository'],
			'run_id' => $payload['run_id'],
			'run_attempt' => $payload['run_attempt'],
			'workflow' => $payload['workflow'],
			'sha' => strtolower( $payload['sha'] ),
			'deployment_id' => $payload['deployment_id'],
		);
		$outcome = $payload['outcome'];
		$deployment_state = $payload['deployment_state'];
		if ( 'deployed' === $outcome ) {
			if ( null !== $payload['failure_code'] || 'complete' !== $deployment_state ) {
				return self::fail( 'pfoy_invalid_acknowledgement', 'A successful acknowledgement requires completed release checks.', 400 );
			}
		} elseif ( 'failed' === $outcome ) {
			if ( ! in_array( $payload['failure_code'], array( 'build_failed', 'source_changed', 'deploy_failed', 'smoke_failed', 'configuration_missing' ), true ) || ! in_array( $deployment_state, array( 'not_started', 'upload_attempted', 'upload_completed' ), true ) ) {
				return self::fail( 'pfoy_invalid_acknowledgement', 'Failure acknowledgement metadata is invalid.', 400 );
			}
		} else {
			return self::fail( 'pfoy_invalid_acknowledgement', 'Publication acknowledgement outcome is invalid.', 400 );
		}
		$revision = $payload['revision'];
		$desired = self::read_revision( self::REVISION_OPTION );
		$deployed = self::read_revision( self::DEPLOYED_OPTION );
		if ( ! self::valid_source_revision( $desired ) || ! self::valid_source_revision( $deployed ) ) {
			return self::fail( 'pfoy_publication_unavailable', 'Publication revision storage is unavailable.', 503 );
		}
		if ( $revision !== $desired ) {
			return self::fail( 'pfoy_stale_acknowledgement', 'Acknowledgement does not match the current desired revision.', 409 );
		}
		$state = get_option( self::STATE_OPTION, array() );
		if ( ! is_array( $state ) ) {
			$state = array();
		}
		if ( 'failed' === $outcome && self::compare_revisions( $deployed, $revision ) >= 0 ) {
			return self::fail( 'pfoy_stale_acknowledgement', 'The requested revision is already deployed.', 409 );
		}
		if ( 'deployed' === $outcome && self::compare_revisions( $deployed, $revision ) >= 0 ) {
			$deployed_order = self::compare_revisions( $deployed, $revision );
			if ( 0 < $deployed_order ) {
				return self::fail( 'pfoy_stale_acknowledgement', 'A newer revision is already deployed.', 409 );
			}
			if ( isset( $state['success_revision'] ) && $revision === $state['success_revision'] && isset( $state['last_run'] ) && $identity === $state['last_run'] ) {
				return rest_ensure_response( array( 'accepted' => true, 'outcome' => 'deployed', 'revision' => $revision ) );
			}
			if ( isset( $state['last_run'] ) && self::compare_release_identity( $identity, $state['last_run'] ) <= 0 ) {
				return self::fail( 'pfoy_stale_acknowledgement', 'A newer release already acknowledged this revision.', 409 );
			}
		}
		if ( ! self::consume_ack_nonce( $timestamp, $body ) ) {
			return self::fail( 'pfoy_replayed_acknowledgement', 'Publication acknowledgement has already been used.', 409 );
		}
		if ( 'failed' === $outcome ) {
			self::write_publication_state( array(
				'revision' => $revision,
				'outcome' => 'failed',
				'failed_revision' => $revision,
				'failure_code' => $payload['failure_code'],
				'deployment_state' => $deployment_state,
				'last_run' => $identity,
			) );
			self::complete_dispatch_for_revision( $revision );
			return rest_ensure_response( array( 'accepted' => true, 'outcome' => 'failed', 'revision' => $revision ) );
		}
		if ( self::compare_revisions( $deployed, $revision ) < 0 ) {
			$revision_update = self::update_deployed_revision( $revision );
			if ( false === $revision_update ) {
				return self::fail( 'pfoy_revision_update_failed', 'Deployed revision could not be recorded.', 500 );
			}
			if ( 1 !== $revision_update ) {
				return self::fail( 'pfoy_stale_acknowledgement', 'Desired revision changed before deployment acknowledgement.', 409 );
			}
		}
		self::write_publication_state( array(
			'revision' => $revision,
			'outcome' => 'deployed',
			'success_revision' => $revision,
			'failed_revision' => '',
			'failure_code' => '',
			'deployment_state' => 'complete',
			'last_run' => $identity,
		) );
		self::complete_dispatch_for_revision( $revision );
		return rest_ensure_response( array( 'accepted' => true, 'outcome' => 'deployed', 'revision' => $revision ) );
	}

	/**
	 * Register only purpose-specific public comment routes; never enable core anonymous comments.
	 */
	public static function register_comment_routes() {
		register_rest_route( 'pfoy/v1', '/comments', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'read_comments' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'post_id' => array( 'required' => true, 'validate_callback' => array( __CLASS__, 'valid_positive_id' ) ),
					'page'    => array( 'default' => 1, 'validate_callback' => array( __CLASS__, 'valid_positive_id' ) ),
					'per_page'=> array( 'default' => 20, 'validate_callback' => array( __CLASS__, 'valid_page_size' ) ),
				),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'submit_comment' ),
				'permission_callback' => '__return_true',
			),
		) );
	}

	public static function valid_positive_id( $value ) {
		return is_numeric( $value ) && (int) $value > 0;
	}

	public static function valid_page_size( $value ) {
		return is_numeric( $value ) && (int) $value >= 1 && (int) $value <= 50;
	}

	private static function public_post( $post_id ) {
		$post = get_post( (int) $post_id );
		return $post && in_array( $post->post_type, array( 'post', 'page' ), true ) && 'publish' === $post->post_status && 'publish' === get_post_status( $post ) && ! post_password_required( $post ) ? $post : false;
	}

	private static function comment_cors_allowed() {
		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) : '';
		$allowed = defined( 'PFOY_PUBLIC_ORIGIN' ) ? PFOY_PUBLIC_ORIGIN : '';
		return $origin && $allowed && hash_equals( $allowed, $origin );
	}

	public static function comment_cors( $served, $result, $request, $server ) {
		if ( 0 !== strpos( $request->get_route(), '/pfoy/v1/comments' ) ) {
			return $served;
		}
		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Credentials' );
		header_remove( 'Access-Control-Allow-Methods' );
		header_remove( 'Access-Control-Allow-Headers' );
		if ( self::comment_cors_allowed() ) {
			header( 'Access-Control-Allow-Origin: ' . untrailingslashit( PFOY_PUBLIC_ORIGIN ) );
			header( 'Vary: Origin', false );
			header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Content-Type' );
		}
		return $served;
	}

	public static function public_comment( $comment ) {
		return array(
			'id'       => (int) $comment->comment_ID,
			'post_id'  => (int) $comment->comment_post_ID,
			'parent'   => (int) $comment->comment_parent,
			'author'   => wp_strip_all_tags( get_comment_author( $comment ), true ),
			'date'     => mysql_to_rfc3339( $comment->comment_date ),
			'content'  => trim( preg_replace( '/\s+/u', ' ', html_entity_decode( wp_strip_all_tags( $comment->comment_content, true ), ENT_QUOTES | ENT_HTML5, get_bloginfo( 'charset' ) ) ) ),
		);
	}

	public static function read_comments( $request ) {
		$post = self::public_post( $request['post_id'] );
		if ( ! $post ) {
			return new WP_Error( 'pfoy_nonpublic_post', 'Comments are unavailable for this post.', array( 'status' => 404 ) );
		}
		$page = max( 1, (int) $request['page'] );
		$per_page = min( 50, max( 1, (int) $request['per_page'] ) );
		$total = (int) get_comments( array( 'post_id' => $post->ID, 'status' => 'approve', 'type' => 'comment', 'count' => true ) );
		$total_pages = (int) ceil( $total / $per_page );
		if ( $page > max( 1, $total_pages ) ) {
			return new WP_Error( 'pfoy_page_out_of_range', 'Comment page is out of range.', array( 'status' => 400 ) );
		}
		$query = new WP_Comment_Query();
		$comments = $query->query( array(
			'post_id' => $post->ID, 'status' => 'approve', 'type' => 'comment',
			'number' => $per_page, 'offset' => ( $page - 1 ) * $per_page,
			'orderby' => array( 'comment_ID' => 'ASC' ),
		) );
		$items = array_map( array( __CLASS__, 'public_comment' ), $comments );
		$page_ids = array();
		foreach ( $comments as $comment ) {
			$page_ids[ (int) $comment->comment_ID ] = true;
		}
		$context = array();
		foreach ( $comments as $comment ) {
			$parent_id = (int) $comment->comment_parent;
			$depth = 0;
			while ( $parent_id && ! isset( $page_ids[ $parent_id ] ) && ! isset( $context[ $parent_id ] ) ) {
				if ( ++$depth > 50 ) {
					return new WP_Error( 'pfoy_comment_thread_too_deep', 'Comment thread context exceeds the safety limit.', array( 'status' => 500 ) );
				}
				$parent = get_comment( $parent_id );
				if ( ! $parent || '1' !== $parent->comment_approved || (int) $parent->comment_post_ID !== (int) $post->ID || ! in_array( $parent->comment_type, array( '', 'comment' ), true ) ) {
					return new WP_Error( 'pfoy_comment_context_unavailable', 'Comment thread context is unavailable.', array( 'status' => 500 ) );
				}
				$context[ $parent_id ] = self::public_comment( $parent );
				$parent_id = (int) $parent->comment_parent;
			}
		}
		ksort( $context, SORT_NUMERIC );
		return rest_ensure_response( array(
			'post_id' => (int) $post->ID, 'comments_open' => comments_open( $post->ID ),
			'page' => $page, 'per_page' => $per_page, 'total_records' => $total,
			'total_pages' => $total_pages, 'complete' => $page >= $total_pages,
			'items' => $items, 'context' => array_values( $context ),
		) );
	}

	private static function fail( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	public static function submit_comment( $request ) {
		$input = $request->get_json_params();
		if ( ! is_array( $input ) ) {
			return self::fail( 'pfoy_invalid_input', 'Invalid comment submission.', 400 );
		}
		$allowed = array( 'post_id', 'parent_id', 'name', 'email', 'content', 'token' );
		if ( array_diff( array_keys( $input ), $allowed ) ) {
			return self::fail( 'pfoy_forbidden_field', 'Unsupported submission field.', 400 );
		}
		foreach ( array( 'post_id', 'name', 'email', 'content', 'token' ) as $key ) {
			if ( ! isset( $input[ $key ] ) || ! is_scalar( $input[ $key ] ) ) {
				return self::fail( 'pfoy_invalid_input', 'Required comment fields are missing.', 400 );
			}
		}
		$post = self::public_post( $input['post_id'] );
		if ( ! $post ) {
			return self::fail( 'pfoy_nonpublic_post', 'Comments are unavailable for this post.', 404 );
		}
		if ( ! comments_open( $post->ID ) ) {
			return self::fail( 'pfoy_comments_closed', 'Comments are closed for this post.', 409 );
		}
		$name = sanitize_text_field( $input['name'] );
		$email = sanitize_email( $input['email'] );
		$content = sanitize_textarea_field( $input['content'] );
		if ( '' === $name || strlen( $name ) > 100 || ! is_email( $email ) || strlen( $email ) > 254 || '' === trim( $content ) || strlen( $content ) > 10000 ) {
			return self::fail( 'pfoy_invalid_input', 'Check the name, email, and comment length.', 400 );
		}
		if ( isset( $input['parent_id'] ) && ! is_scalar( $input['parent_id'] ) ) {
			return self::fail( 'pfoy_invalid_parent', 'Reply target is invalid.', 400 );
		}
		$parent_id = isset( $input['parent_id'] ) ? absint( $input['parent_id'] ) : 0;
		if ( $parent_id ) {
			$parent = get_comment( $parent_id );
			if ( ! $parent || '1' !== $parent->comment_approved || ! in_array( $parent->comment_type, array( '', 'comment' ), true ) || (int) $parent->comment_post_ID !== (int) $post->ID ) {
				return self::fail( 'pfoy_invalid_parent', 'Reply target is not an approved comment on this post.', 400 );
			}
		}
		if ( ! is_string( $input['token'] ) || '' === $input['token'] || strlen( $input['token'] ) > 2048 ) {
			return self::fail( 'pfoy_challenge_failed', 'Comment verification failed.', 400 );
		}
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '';
		$key = 'pfoy_comment_rate_' . hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) );
		$count = (int) get_transient( $key );
		if ( $count >= 5 ) {
			return self::fail( 'pfoy_rate_limited', 'Please wait before submitting another comment.', 429 );
		}
		if ( ! defined( 'PFOY_TURNSTILE_SECRET' ) || '' === PFOY_TURNSTILE_SECRET || ! defined( 'PFOY_TURNSTILE_HOSTNAME' ) || '' === PFOY_TURNSTILE_HOSTNAME ) {
			return self::fail( 'pfoy_challenge_unavailable', 'Comment verification is unavailable.', 503 );
		}
		set_transient( $key, $count + 1, HOUR_IN_SECONDS );
		$verify = wp_remote_post( 'https://challenges.cloudflare.com/turnstile/v0/siteverify', array(
			'timeout' => 5, 'body' => array( 'secret' => PFOY_TURNSTILE_SECRET, 'response' => sanitize_text_field( $input['token'] ) ),
		) );
		if ( is_wp_error( $verify ) || 200 !== wp_remote_retrieve_response_code( $verify ) ) {
			return self::fail( 'pfoy_challenge_unavailable', 'Comment verification could not be completed.', 503 );
		}
		$challenge = json_decode( wp_remote_retrieve_body( $verify ), true );
		if ( ! is_array( $challenge ) || empty( $challenge['success'] ) || empty( $challenge['hostname'] ) || PFOY_TURNSTILE_HOSTNAME !== $challenge['hostname'] || ! isset( $challenge['action'] ) || 'comment' !== $challenge['action'] ) {
			return self::fail( 'pfoy_challenge_failed', 'Comment verification failed.', 400 );
		}
		$comment_id = wp_new_comment( array(
			'comment_post_ID' => (int) $post->ID, 'comment_parent' => $parent_id,
			'comment_author' => $name, 'comment_author_email' => $email,
			'comment_content' => $content, 'user_id' => 0,
		), true );
		if ( is_wp_error( $comment_id ) ) {
			return self::fail( 'pfoy_comment_rejected', 'WordPress could not accept this comment.', 400 );
		}
		$comment = get_comment( $comment_id );
		$status = 'pending_review';
		if ( $comment && '1' === $comment->comment_approved ) {
			$status = 'approved';
		} elseif ( ! $comment || '0' !== $comment->comment_approved ) {
			$status = 'not_public';
		}
		return new WP_REST_Response( array( 'accepted' => true, 'status' => $status ), 202 );
	}

	public static function register_kind_field() {
		register_rest_field( 'post', self::KIND_META, array(
			'get_callback' => array( __CLASS__, 'get_kind_field' ),
			'schema'       => array(
				'description' => __( 'Public content classification.', 'platefullofyum-headless' ),
				'type'        => array( 'string', 'null' ),
				'enum'        => array( 'recipe', 'article', null ),
				'readonly'    => true,
				'context'     => array( 'view', 'edit', 'embed' ),
			),
		) );
	}

	public static function get_kind_field( $object ) {
		$kind = get_post_meta( isset( $object['id'] ) ? (int) $object['id'] : 0, self::KIND_META, true );
		return in_array( $kind, array( 'recipe', 'article' ), true ) ? $kind : null;
	}
	public static function register_seo_field() {
		register_rest_field( array( 'post', 'page' ), self::SEO_FIELD, array(
			'get_callback' => array( __CLASS__, 'get_seo_field' ),
			'schema'       => array(
				'description' => __( 'Public SEO metadata provided by Yoast SEO.', 'platefullofyum-headless' ),
				'type'        => array( 'object', 'null' ),
				'readonly'    => true,
				'context'     => array( 'view', 'edit', 'embed' ),
				'properties'  => array(
					'title'          => array( 'type' => 'string' ),
					'description'    => array( 'type' => 'string' ),
					'canonical'      => array( 'type' => 'string' ),
					'robots'         => array( 'type' => 'string' ),
					'og_title'       => array( 'type' => 'string' ),
					'og_description' => array( 'type' => 'string' ),
					'og_image'       => array( 'type' => array( 'string', 'null' ) ),
				),
			),
		) );
	}

	public static function get_seo_field( $object ) {
		if ( ! function_exists( 'YoastSEO' ) ) {
			return null;
		}

		try {
			$yoast = YoastSEO();
			if ( ! is_object( $yoast ) || ! isset( $yoast->meta ) || ! is_object( $yoast->meta ) || ! method_exists( $yoast->meta, 'for_post' ) ) {
				return null;
			}
			$meta = $yoast->meta->for_post( isset( $object['id'] ) ? (int) $object['id'] : 0 );
		} catch ( Throwable $error ) {
			return null;
		}

		if ( ! is_object( $meta ) ) {
			return null;
		}

		$robots = isset( $meta->robots ) && is_array( $meta->robots )
			? implode( ', ', array_filter( array_map( 'strval', $meta->robots ), 'strlen' ) )
			: ( isset( $meta->robots ) && is_scalar( $meta->robots ) ? (string) $meta->robots : '' );
		$image = null;
		if ( isset( $meta->open_graph_images ) && is_array( $meta->open_graph_images ) ) {
			foreach ( $meta->open_graph_images as $candidate ) {
				$url = is_object( $candidate ) ? ( $candidate->url ?? '' ) : ( is_array( $candidate ) ? ( $candidate['url'] ?? '' ) : '' );
				if ( is_string( $url ) && '' !== $url && wp_http_validate_url( $url ) ) {
					$image = $url;
					break;
				}
			}
		}

		return array(
			'title'          => self::public_string( $meta, 'title' ),
			'description'    => self::public_string( $meta, 'description' ),
			'canonical'      => self::public_string( $meta, 'canonical' ),
			'robots'         => $robots,
			'og_title'       => self::public_string( $meta, 'open_graph_title' ),
			'og_description' => self::public_string( $meta, 'open_graph_description' ),
			'og_image'       => $image,
		);
	}

	private static function public_string( $meta, $property ) {
		return isset( $meta->$property ) && is_scalar( $meta->$property ) ? (string) $meta->$property : '';
	}

	public static function register_kind_meta() {
		register_post_meta( 'post', self::KIND_META, array(
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => false,
			'auth_callback'     => array( __CLASS__, 'authorize_kind_meta' ),
			'sanitize_callback' => array( __CLASS__, 'sanitize_kind' ),
		) );
	}

	public static function authorize_kind_meta( $allowed, $meta_key, $post_id ) {
		return current_user_can( 'edit_post', $post_id );
	}

	public static function sanitize_kind( $kind ) {
		return in_array( $kind, array( 'recipe', 'article' ), true ) ? $kind : '';
	}

	public static function add_kind_meta_box() {
		add_meta_box( 'pfoy-content-kind', __( 'Public content kind', 'platefullofyum-headless' ), array( __CLASS__, 'render_kind_meta_box' ), 'post', 'side', 'default' );
	}

	public static function render_kind_meta_box( $post ) {
		wp_nonce_field( 'pfoy_save_kind', 'pfoy_kind_nonce' );
		$kind = get_post_meta( $post->ID, self::KIND_META, true );
		if ( ! in_array( $kind, array( 'recipe', 'article' ), true ) ) {
			$kind = 'recipe';
		}
		echo '<label for="pfoy-content-kind-select">' . esc_html__( 'Choose how this post is classified for the direct importer.', 'platefullofyum-headless' ) . '</label>';
		echo '<select id="pfoy-content-kind-select" name="pfoy_content_kind" style="width:100%;margin-top:6px">';
		foreach ( array( 'recipe' => __( 'Recipe (requires a Create card)', 'platefullofyum-headless' ), 'article' => __( 'Editorial article', 'platefullofyum-headless' ) ) as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '" ' . selected( $kind, $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select>';
	}

	public static function save_kind( $post_id, $post ) {
		if ( ! isset( $_POST['pfoy_kind_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['pfoy_kind_nonce'] ) ), 'pfoy_save_kind' ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || wp_is_post_revision( $post_id ) || ! current_user_can( 'edit_post', $post_id ) || ! isset( $_POST['pfoy_content_kind'] ) ) {
			return;
		}
		$kind = sanitize_key( wp_unslash( $_POST['pfoy_content_kind'] ) );
		if ( in_array( $kind, array( 'recipe', 'article' ), true ) ) {
			update_post_meta( $post_id, self::KIND_META, $kind );
		}
	}

	public static function show_kind_notice() {
		if ( ! current_user_can( 'edit_posts' ) || empty( $_GET['post'] ) ) {
			return;
		}
		$post_id = absint( $_GET['post'] );
		if ( 'post' !== get_post_type( $post_id ) || 'publish' !== get_post_status( $post_id ) ) {
			return;
		}
		if ( ! in_array( get_post_meta( $post_id, self::KIND_META, true ), array( 'recipe', 'article' ), true ) ) {
			echo '<div class="notice notice-warning"><p>' . esc_html__( 'This published post has no explicit content kind. Select Recipe or Editorial article in the Public content kind panel for direct REST import.', 'platefullofyum-headless' ) . '</p></div>';
		}
	}
}

PFOY_Headless_Content::init();
