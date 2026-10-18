# Spec Delta

## Purpose

Provide a complete, trustworthy public-content snapshot from WordPress while preserving Create recipe information, editorial metadata, and photography without exposing unpublished material.

## ADDED Requirements

### Requirement: Public-only content boundary
The export SHALL include only published, public, password-unprotected posts and their public dependencies. It SHALL exclude drafts, scheduled, private, trashed, deleted, and password-protected posts, including their text, metadata, cards, and exclusively associated assets, from generated public artifacts.

#### Scenario: Eligible published content
- **WHEN** a public, unprotected post is published
- **THEN** the export includes its stable WordPress identifier, public permalink, editorial content, taxonomy, publication dates, and referenced public dependencies

#### Scenario: Nonpublic content exclusion
- **WHEN** a post is nonpublic or changes from published to draft, private, trashed, deleted, or password-protected
- **THEN** the next successful snapshot excludes its content and exclusively associated assets rather than exposing a preview or hidden public payload

### Requirement: Complete revision-consistent snapshots
The export SHALL identify a content revision covering public posts, cards, media references, taxonomy, metadata, and visible comments. A snapshot SHALL contain all eligible records across pagination, with stable identifiers and resolved references, or fail explicitly; partial or mixed-revision content SHALL NOT be accepted as complete.

#### Scenario: Paginated export
- **WHEN** eligible content spans multiple source pages
- **THEN** the completed snapshot contains every eligible record exactly once and identifies the revision it represents

#### Scenario: Source changes during retrieval
- **WHEN** the source revision changes between the start and end of retrieval
- **THEN** the snapshot is rejected as inconsistent and is not published

#### Scenario: Incomplete or invalid source
- **WHEN** a required page, card, reference, or field cannot be retrieved or is invalid
- **THEN** export fails with an actionable record-specific diagnostic instead of silently omitting content

### Requirement: Card-based recipe detection and article fallback
The importer SHALL use public `wp/v2` posts, pages, media, taxonomy, authors, and approved comments, plus linked Create records. Import MUST NOT require helper-plugin routes or `pfoy_content_kind`. A linked `type=recipe` card identifies a recipe; a cardless published post is an article. SEO MAY come from `pfoy_seo`, other core REST fields, or the public page head. Guest submissions and publication lifecycle use the helper plugin.

#### Scenario: Valid linked recipe card
- **WHEN** a public post contains a Create card linked to a record declaring `type=recipe` with a matching canonical post association
- **THEN** the export classifies it as a recipe and retains source identity and supported title, ingredient groups, instruction groups, notes, times, yield, images, and other supplied recipe fields

#### Scenario: Ordinary post without a card
- **WHEN** a published public post has no Create card
- **THEN** the export classifies and exports it as an editorial article without requiring `pfoy_content_kind` or blocking the import

#### Scenario: Malformed embedded recipe
- **WHEN** a post contains a Create recipe marker/card with a missing or invalid Create record, invalid type, or mismatched post association
- **THEN** export fails with the affected post/card identified and does not treat the post as an article

#### Scenario: Public content retrieval without helper plugin
- **WHEN** the importer reads public posts, pages, taxonomies, media, authors, approved comments, and linked Create records from their public endpoints
- **THEN** that read succeeds without `pfoy/v1` routes or `pfoy_content_kind`; guest submissions and revision/dispatch/acknowledgement remain distinct helper-plugin capabilities

### Requirement: Faithful recipe values
Exported recipe values SHALL preserve the author's quantities, units, ordering, grouping, and supported formatting. Existing source-backed ratings and nutrition SHALL be retained when supplied; missing values SHALL remain absent. The system SHALL NOT infer nutrition, invent reviews, or calculate serving and unit conversions.

#### Scenario: Optional data absent
- **WHEN** a card has no nutrition or rating summary
- **THEN** the snapshot contains no fabricated nutrition, rating count, or aggregate score

#### Scenario: Authored ingredient expressions
- **WHEN** ingredients contain fractions, ranges, mixed units, or explanatory text
- **THEN** those values remain faithful to the source instead of being numerically reinterpreted

### Requirement: Safe article body and single recipe representation
Article content SHALL retain supported semantic text, links, images, and public anchors while removing executable or unsafe markup and WordPress theme/plugin scripts. Create embeds SHALL become a single native recipe presentation without losing surrounding editorial content or duplicating the card.

#### Scenario: Embedded Create presentation
- **WHEN** the article body contains a valid Create card embed and surrounding headings or photographs
- **THEN** the public result retains the surrounding content and exposes one recipe card with its existing public anchor

#### Scenario: Unsafe or plugin markup
- **WHEN** source markup contains scripts, event handlers, unsafe URL schemes, or theme/plugin runtime dependencies
- **THEN** executable content is removed without importing those runtimes into the public page

### Requirement: Public photography metadata
The export SHALL preserve public image URLs, available responsive variants, dimensions, and editorial alternative text. Images SHALL remain served from the existing WordPress media service without a paid image service. Media URL preservation SHALL NOT authorize exporting exclusively nonpublic media.

#### Scenario: Responsive image source
- **WHEN** WordPress supplies an image with multiple sizes and alternative text
- **THEN** the snapshot exposes the available sizes, dimensions, and authored alternative text for responsive accessible rendering

#### Scenario: Legacy media link
- **WHEN** an existing public article or search result references a legacy media URL
- **THEN** the migration retains a reachable public image at that URL

### Requirement: Editorial SEO export
The importer SHALL preserve available editorial SEO titles, descriptions, canonical URLs, robots directives, and social metadata using `pfoy_seo`, other supported core REST fields, or the public page head. It MUST NOT require `yoast/v1/get_head` or `pfoy_seo`. Missing optional values MAY use documented defaults only when confirmed unset; unavailable authored values SHALL fail rather than be discarded.

#### Scenario: Yoast REST head unavailable
- **WHEN** the public `yoast/v1/get_head` route is unavailable but editorial SEO values exist in core REST fields or the rendered public page head
- **THEN** those authored values remain available through the normalized content snapshot without requiring `pfoy_seo`

#### Scenario: Unset optional SEO value
- **WHEN** an eligible post has no custom SEO title or description
- **THEN** the resulting value follows the documented public-content default without using unpublished text

### Requirement: Minimal public data exposure
Public content artifacts SHALL exclude credentials, comment email and IP addresses, moderation-only fields, private WordPress user data, and operational secrets. Privileged export access SHALL remain server-side and SHALL NOT broaden the public-content boundary.

#### Scenario: Privileged source access
- **WHEN** a build authenticates to retrieve content
- **THEN** public artifacts contain only the permitted public projection and no source credentials or private administrative fields
