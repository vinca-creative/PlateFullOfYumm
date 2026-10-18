# Spec Delta

## Purpose

Preserve WordPress-owned discussion and moderation while giving public readers approved threaded comments, fresh comment reads, and safe guest submission from the static frontend.

## ADDED Requirements

### Requirement: WordPress-owned comment records
WordPress SHALL remain the authoritative comment database and moderation system. Public comment views SHALL expose approved comments only and preserve their post association, parent-child relationships, public author name, date, and sanitized text. No separate comment database or browser-controlled approval state SHALL be introduced.

#### Scenario: Existing approved thread
- **WHEN** a public post has approved top-level comments and replies
- **THEN** its public thread preserves those records and reply relationships using their WordPress identities

#### Scenario: Nonpublic comment
- **WHEN** a comment is pending, spam, trashed, deleted, or otherwise unapproved
- **THEN** it is excluded from public snapshots and fresh public reads

### Requirement: Readable static comment snapshot
Each eligible page SHALL contain its approved comment snapshot in initial HTML, labeled as a build-time snapshot rather than a guaranteed current view. Snapshot comments SHALL remain readable without JavaScript. Live reading and submission enhancements SHALL clearly disclose when JavaScript is required.

#### Scenario: JavaScript unavailable
- **WHEN** a reader opens a recipe without JavaScript
- **THEN** approved snapshot threads remain readable and live-update or submission controls do not imply they are functional

#### Scenario: No approved comments
- **WHEN** the successful snapshot contains no approved comments
- **THEN** the page shows an explicit empty-discussion state rather than an indefinite loading state

### Requirement: Fresh paginated public reads
With JavaScript enabled, comments SHALL request fresh approved records from WordPress, support all available pages, and reconcile by stable identities without duplicate comments or broken reply associations. Loading, partial-page, empty, and failure states SHALL be distinguishable; unread pages SHALL not be represented as a complete current thread.

#### Scenario: Multiple comment pages
- **WHEN** approved comments span multiple pages
- **THEN** the reader can access every page and the interface preserves the thread relationships without duplicate records

#### Scenario: Snapshot comment removed
- **WHEN** a previously snapshotted comment is absent from a successfully retrieved complete current thread
- **THEN** the live view no longer displays it as an approved current comment

#### Scenario: Fresh read unavailable
- **WHEN** a current comment request fails or returns an incomplete result
- **THEN** the last readable snapshot is retained as needed and clearly labeled as not current, with the refresh failure disclosed

### Requirement: Guest submission contract
The public submission endpoint SHALL accept only the post identifier, optional reply parent, guest name, guest email, comment text, and anti-abuse proof. It SHALL validate required fields, sanitize public text, and submit through WordPress's native moderation pipeline. It SHALL reject client-supplied approval, author identity, capability, or moderation fields.

#### Scenario: Valid guest comment
- **WHEN** a guest submits valid fields and passes abuse checks for an eligible open post
- **THEN** WordPress records the comment under its native moderation policy and the response distinguishes acceptance from public approval

#### Scenario: Author impersonation or approval override
- **WHEN** a submission includes an administrative user identity, approved status, or another privileged field
- **THEN** the request is rejected and cannot create an approved or impersonated comment

#### Scenario: Unsafe submitted text
- **WHEN** a guest supplies executable markup in comment text
- **THEN** the submission is rejected or safely sanitized and no executable markup reaches public rendering

### Requirement: Eligible posts and valid reply parents
Comment reads and writes SHALL enforce the post's current public visibility. New submissions SHALL require comments to be open. Replies SHALL reference an approved parent on the same post. Closing comments SHALL prevent new submissions without hiding existing approved comments on an otherwise public post.

#### Scenario: Closed discussion
- **WHEN** a post remains public but its comments are closed
- **THEN** existing approved comments remain readable and new submissions receive an explicit closed-discussion rejection

#### Scenario: Nonpublic target
- **WHEN** a request targets a draft, private, deleted, trashed, scheduled, or password-protected post
- **THEN** fresh reads reveal no thread and submission is rejected without exposing nonpublic post content

#### Scenario: Invalid reply parent
- **WHEN** a reply names an absent, unapproved, or different-post parent
- **THEN** submission is rejected rather than attaching the reply to the wrong discussion

### Requirement: Server-enforced abuse protection
Submissions SHALL require server-side verification of a free anti-abuse challenge and server-enforced rate limits. Invalid, expired, or unverifiable proofs and rate-limited requests SHALL create no comment. Client-side challenge completion alone SHALL not authorize a submission.

#### Scenario: Missing or invalid challenge
- **WHEN** a submission has no valid server-verified challenge proof
- **THEN** the endpoint rejects it without creating a comment

#### Scenario: Challenge service unavailable
- **WHEN** the server cannot verify the challenge
- **THEN** submission fails explicitly without bypassing abuse protection

#### Scenario: Rate limit exceeded
- **WHEN** a client exceeds the configured submission limit
- **THEN** the endpoint rejects further submissions with a clear rate-limit response and no new comment

### Requirement: Narrow cross-origin access and privacy
Browser comment access SHALL use the WordPress endpoint with cross-origin permission limited to the configured public frontend origin and without browser secrets. Public responses SHALL omit guest email, IP address, private user fields, and moderation data. Secret challenge verification credentials SHALL stay server-side.

#### Scenario: Intended frontend origin
- **WHEN** the configured frontend performs a comment request
- **THEN** the browser can access the permitted public response without receiving WordPress or challenge-service secrets

#### Scenario: Unrelated browser origin
- **WHEN** a different origin performs a cross-origin comment request
- **THEN** it receives no cross-origin access grant and cannot bypass submission validation or abuse controls

#### Scenario: Guest email privacy
- **WHEN** an accepted comment is displayed or fetched publicly
- **THEN** its guest email and IP address are absent from public HTML, data, and responses

### Requirement: Honest submission feedback
The form SHALL distinguish validation, challenge, rate-limit, network, moderation-pending, and accepted-public outcomes. Failure or an uncertain network outcome SHALL not be represented as successful publication. Submitted text SHALL remain available for correction after a rejected request.

#### Scenario: Moderation pending
- **WHEN** WordPress accepts a comment for moderation
- **THEN** the interface confirms pending review without inserting it into the approved public thread

#### Scenario: Failed or uncertain submission
- **WHEN** validation fails or a network failure prevents confirmation
- **THEN** the interface describes the failure or uncertainty, preserves the user's text, and does not claim the comment was published

### Requirement: Moderation-driven snapshot updates
Approval, public comment edits, removal, spam assignment, and changes out of approved visibility SHALL request a rebuild so static snapshots eventually match WordPress. A failed rebuild SHALL not be reported as a successful snapshot update.

#### Scenario: Moderator removes approved comment
- **WHEN** an approved comment is removed from public visibility
- **THEN** fresh reads omit it and a rebuild is requested to remove it from subsequent static snapshots
