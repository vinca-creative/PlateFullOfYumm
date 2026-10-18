Plate Full of Yum Headless Content
==================================

Installation
------------

1. Upload the `platefullofyum-headless` directory to `wp-content/plugins/`, or
   zip that directory and install the ZIP from Plugins > Add New > Upload Plugin.
2. Activate “Plate Full of Yum Headless Content” to enable guest comment
   submissions and (when configured) publication revision/dispatch handling.
   Installing this plugin is not required to retrieve public content.
3. The plugin optionally registers `pfoy_content_kind` for editor-side
   classification metadata. The current public importer ignores that field:
   cardless published posts are exported as editorial articles, and linked
   Create cards identify recipes after validation.
4. Pages use their WordPress core type and are read from `wp/v2/pages`.
   Recipe cards are read through `GET /wp-json/mv-create/v1/creations/{id}`;
   an embedded card must have `type=recipe` and link to the same post.

Compatibility and data sources
------------------------------

The importer reads published posts, pages, approved comments, embedded media,
and taxonomy from WordPress core REST, and recipe cards from the public Create
REST route. It does not require this plugin, `pfoy/v1`, `pfoy_content_kind`,
`pfoy_seo`, or authenticated requests. It treats ordinary cardless posts as
editorial articles; a post with an embedded but unavailable, invalid, or
mismatched Create card is an import error.

The optional `pfoy_seo` field is a read-only projection of Yoast SEO's public
metadata surface on posts and pages and requires Yoast SEO 14.0 or later. It
includes only title, description, canonical, robots, Open Graph title and
description, and the first valid Open Graph image URL. If Yoast is unavailable,
the field returns null; the importer can use the public page head where
available. The custom field is not required for snapshot generation.
See the official Yoast developer documentation:
https://developer.yoast.com/customization/apis/surfaces-api/


Public comments
---------------

The optional `GET /wp-json/pfoy/v1/comments?post_id={id}&page={n}&per_page={n}`
route supports fresh public comment reads for the frontend and reports comment
availability. Snapshot import instead reads approved comments from the
WordPress core `wp/v2/comments` endpoint; this helper route is not required
for content retrieval. The plugin route is limited to published,
non-password-protected posts and pages. Custom post types outside the static
content contract cannot be read or commented on through these routes. Page
size is limited to 50. The response includes public IDs, parent IDs, sanitized
author name/text/date, page totals, and whether comments are open. Comment
content is returned as plain text, matching the static snapshot contract. When
a reply's approved parent is on a different page, `context` contains the
approved public ancestor(s) needed to render the reply. Nonpublic targets
return 404; closed posts remain readable.

`POST /wp-json/pfoy/v1/comments` accepts only `post_id`, optional `parent_id`,
`name`, `email`, `content`, and Turnstile `token`. It inserts through
WordPress's native comment/moderation pipeline. The response is `202` with
`accepted` and a `status` of `pending_review`, `approved`, or `not_public`,
reflecting WordPress's native decision; no content or private values are
returned. Replies require an approved parent on the
same post. Closed posts reject submissions. Requests are limited to five per
IP-derived HMAC rate key per hour. The plugin does not persist the raw IP for
its rate limiter and does not send the IP to Turnstile. It calls
`wp_new_comment` without an explicit IP override; WordPress Core or the
hosting/proxy stack may retain request IP metadata. Configure and document
retention for those systems according to the site's privacy requirements.

Set these constants in server-side `wp-config.php` (never in frontend code):

* `PFOY_PUBLIC_ORIGIN` — exact public site origin, e.g.
  `https://platefullofyum.com` (scheme and hostname, no path or trailing slash).
* `PFOY_TURNSTILE_SECRET` — Cloudflare Turnstile server secret.
* `PFOY_TURNSTILE_HOSTNAME` — required expected challenge hostname; the verified
  challenge hostname must match it; the Turnstile response action must be
  `comment`.

The static frontend separately needs the public Cloudflare Turnstile site key
in `VITE_TURNSTILE_SITE_KEY`; it is safe to expose in browser code and must be
configured for the frontend hostname. Never put the Turnstile secret in a
frontend setting. Leave the site key unset to keep guest submissions disabled.
The browser submits the challenge token with action `comment`; this plugin
verifies both the secret and action server-side.

Turnstile verification fails closed when the secret, hostname, or service is
unavailable. CORS grants only the exact configured origin, never allows
credentials, and is not a substitute for server validation or rate limiting.
Public comment projections and snapshot contracts exclude email, IP address,
user identity, approval/moderation data, and credentials. WordPress retains
guest email with the native comment record for moderation; this plugin does
not return or log it.

Moderation and recovery
-----------------------

Review submissions in the WordPress Dashboard's Comments screen. WordPress
applies the site's native discussion and moderation rules; approve or reject
pending submissions there. Pending and trashed comments are excluded from
public reads and the static snapshot. Insertion of a comment that WordPress
approves immediately, later approvals, approved edits, and deletions advance
the publication revision. These changes appear in static HTML after the next
complete snapshot build and deployment. Confirm the publication status route
reports the desired revision deployed. If the publication integration is
disabled or a release fails, resolve the reported configuration/build failure
and use the owner-authorized manual rebuild path; do not represent an old
snapshot as current.

If submission feedback reports an uncertain network outcome, check the
WordPress Comments screen for the entry before retrying to avoid duplicates.
If the form reports pending review, wait for moderation rather than resubmitting.
When fresh reads fail, the frontend keeps and labels the last published
snapshot; verify the endpoint and status before telling readers that the
discussion is current. Never test by submitting to production without explicit
owner approval.

This plugin also registers optional `pfoy_content_kind` and `pfoy_seo` REST
fields; the public importer does not depend on either field. The classification
field has allowed values `recipe` and `article`; it is available for public
`wp/v2/posts` reads as a read-only REST field. The underlying registered post
meta is not writable through REST. Its editor save handler checks its nonce,
post edit capability, autosave, and revision state. No other private post
metadata is exposed by this plugin.

Publication lifecycle
---------------------

Publication hooks are disabled unless all required server-side constants are
configured. With a missing/invalid value, public revision updates, GitHub
dispatch and deployment acknowledgements are disabled; the status route reports
`enabled: false` and never reports deployment success.

Set these values in protected `wp-config.php`; do not commit real values or
place them in browser-visible settings:

* `PFOY_PUBLICATION_ENABLED` — must be the PHP boolean `true`.
* `PFOY_PUBLICATION_GITHUB_REPOSITORY` — exact owner/repository configured for
  the production workflow.
* `PFOY_GITHUB_DISPATCH_TOKEN` — repository-scoped GitHub token with the
  permission required to create a repository dispatch.
* `PFOY_PUBLICATION_WORKFLOW` — exact GitHub Actions workflow name.
* `PFOY_PUBLICATION_ACK_SECRET` — random high-entropy secret of at least 32
  characters; configure the same value as GitHub Actions secret
  `PFOY_PUBLICATION_ACK_SECRET`.

Do not replace the placeholders with values until the repository, workflow,
credential and production account are supplied by the owner. The GitHub secret
and WordPress constant must be rotated together.

`GET /wp-json/pfoy/v1/publication/status` returns only the enabled flag,
monotonic desired/deployed source revisions, current outcome and fixed failure
codes. The production importer checks that source revision before and after
its complete snapshot retrieval; the workflow checks again immediately before
deploying. Repository dispatches contain only the revision and a bounded event
code, never content, drafts, comment data, or credentials.

`POST /wp-json/pfoy/v1/publication/ack` accepts only a timestamped HMAC-SHA256
signature over the exact JSON body. The signed body is bound to the configured
repository and workflow, source revision, GitHub run and attempt, checked-out
commit, and deterministic deployment identity. Timestamps outside five
minutes, non-idempotent replay attempts, mismatched revisions, identity
mismatches, or an older run attempting to replace a newer acknowledgement are
rejected. A newer verified code release may acknowledge the same
already-deployed content revision; this keeps code-only production pushes
green without permitting an older run to overwrite current release identity.
A success is recorded only
for the current desired revision and only after the workflow's public smoke
checks; failed release callbacks preserve the deployed revision. An
upload-followed-by-smoke-failure is marked failed with upload state so the
admin status warns that the live site may have changed.

The plugin advances revisions only when a public post/page, linked Create
card, referenced media, relevant public taxonomy/SEO metadata, or approved
comment projection changes. Draft-only edits, autosaves, revisions and pending
comments do not advance it. Card post types `mv_create` and `mv_creation` are
recognized by default; confirm the installed Create version's actual storage
type on authorized staging. If it differs, register the verified type with the
`pfoy_create_card_post_types` filter before enabling publication. No live
Create-card hook behavior has been verified here.

WordPress schedules dispatch attempts and retries failed GitHub API delivery
with backoff; if dispatch succeeds but no release acknowledgement arrives, it
retries notification later. A signed failed release is visible and stops
automatic retry until a new content revision or operator-triggered manual
rebuild. Configure a real host cron or WP-CLI scheduler to run due WordPress
events at least once per minute; visitor-driven WP-Cron alone is insufficient
for scheduled publish or retry when traffic is absent. Example command shape:
`wp cron event run --due-now --path=/ACTUAL/WORDPRESS/PATH`. Use the actual
hosting path and confirm the scheduler runs successfully before relying on it.

Runtime verification against the production or staging WordPress install,
Create storage hooks, host cron, GitHub repository, Cloudflare account/domain,
credentials, dispatch, callback, upload and public checks is pending. No live
write or production deployment was performed.
