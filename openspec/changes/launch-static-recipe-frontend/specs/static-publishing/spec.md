# Spec Delta

## Purpose

Publish complete current WordPress content through GitHub Actions to free static hosting, with honest removal status, safe release ordering, and preserved public site identity.

## ADDED Requirements

### Requirement: GitHub-controlled publication triggers
Source and deployment configuration SHALL reside in GitHub. Production builds SHALL run through GitHub Actions on pushes to main, authenticated WordPress repository dispatches, and manual invocation. Each run SHALL retrieve current public content rather than replay a triggering event's content. Pull requests SHALL not deploy production or create public content previews.

#### Scenario: Supported production triggers
- **WHEN** main changes, WordPress dispatches an eligible publication event, or an operator invokes a rebuild
- **THEN** GitHub Actions requests a complete production build using current eligible content

#### Scenario: Pull request build
- **WHEN** a pull request runs build checks
- **THEN** it receives no production deployment secrets and creates neither a production release nor a public preview

### Requirement: Public-output change notifications
WordPress SHALL advance the public revision and request publication for transitions into or out of public visibility and changes to public posts/pages, associated Create cards, media, taxonomy, SEO, or visible comments. Draft-only edits, autosaves, and pending comments SHALL not publish private content or independently trigger a public-content rebuild.

#### Scenario: Public removal transition
- **WHEN** a published post becomes draft, private, trashed, deleted, or password-protected
- **THEN** WordPress records a newer desired revision and requests a rebuild that excludes the post

#### Scenario: Card-only or moderation change
- **WHEN** an associated public Create card changes or a comment's public text or approval visibility changes
- **THEN** the public revision advances and a rebuild is requested without requiring an unrelated post edit

#### Scenario: Scheduled publication
- **WHEN** a scheduled post actually becomes public
- **THEN** the public revision advances and publication is requested even when visitor traffic is absent

#### Scenario: Failed notification
- **WHEN** GitHub cannot accept a dispatch
- **THEN** the desired revision remains pending and notification is retried until publication is requested or an operator-visible failure requires action

### Requirement: Clean complete static output
Every build SHALL create a clean complete snapshot and static release manifest enumerating all public routes and derived outputs. The release SHALL include HTML, required assets, search data, sitemap, RSS, and a real 404 page from that snapshot. Failed source retrieval SHALL not be treated as an empty site or permit partial deployment.

#### Scenario: Rebuild after removal
- **WHEN** a post is absent from the current eligible snapshot
- **THEN** its old HTML, page data, exclusively associated generated assets, and derived discovery entries are absent from the new release manifest and output

#### Scenario: Failed source page
- **WHEN** any required content page fails to load
- **THEN** the build fails without publishing partial content or deleting unrelated live routes

### Requirement: Revision checks and serialized releases
Publication SHALL check the source revision before and after retrieval and again before deployment. Releases SHALL be serialized so an older release cannot finish after a newer release. A superseded snapshot SHALL not be deployed as current; changes during deployment SHALL retain a pending latest revision and ensure a subsequent build.

#### Scenario: Change during build
- **WHEN** public content changes after snapshot retrieval but before deployment
- **THEN** the superseded release is withheld and a build for current content remains requested

#### Scenario: Change during deployment
- **WHEN** a newer public revision appears while a release is being deployed
- **THEN** the in-progress release cannot acknowledge the newer revision, the newer revision stays pending, and a subsequent serialized build retrieves current content

#### Scenario: Overlapping or replayed workflow
- **WHEN** production workflows overlap or an old workflow is rerun
- **THEN** they cannot complete out of release order or replay an obsolete artifact as the latest publication

### Requirement: Atomic release and honest publication status
Successful release SHALL activate one complete static version. WordPress and GitHub SHALL expose desired revision, deployed revision, and pending, blocked, or failed outcome without claiming success before release checks pass. Pre-release failures SHALL preserve the last complete site. A failure after upload SHALL disclose uncertain or failed checks rather than falsely claim no change occurred.

#### Scenario: Successful unpublish
- **WHEN** a removal release activates and its public checks succeed
- **THEN** the removed URL returns HTTP 404, its derived entries are absent, and the matching revision is acknowledged as deployed

#### Scenario: Failed removal build
- **WHEN** an unpublish rebuild fails before release
- **THEN** the last complete deployment remains live and the removal remains visibly pending or failed rather than reported as complete

#### Scenario: Post-upload check failure
- **WHEN** upload completes but the public release checks fail
- **THEN** status records the failed checks without a false successful acknowledgement or a false assertion that the old version necessarily remains active

### Requirement: Authenticated minimal automation messages
WordPress-to-GitHub dispatches and deployment acknowledgements SHALL be authenticated, scoped to the intended repository/site, and contain only necessary revision, event, run, and outcome metadata. Acknowledgements SHALL resist replay and bind success to the expected release identity. Credentials SHALL remain outside browser bundles, public artifacts, dispatch payloads, and logs.

#### Scenario: Forged or stale acknowledgement
- **WHEN** an unauthenticated, replayed, mismatched, or older callback attempts to acknowledge a deployment
- **THEN** it cannot mark a pending newer revision as deployed or reduce the recorded deployed revision

#### Scenario: Inspecting public artifacts
- **WHEN** a reader retrieves generated files or observes a dispatch payload
- **THEN** neither contains deployment credentials, callback secrets, privileged WordPress data, or draft content

### Requirement: Free static delivery and portable fallback
Production SHALL default to Cloudflare Workers Static Assets on the Free plan without required request-time cloud execution. The same complete static artifact SHALL be deployable to Cloudflare Pages Free as an operator-selected fallback, with equivalent routes, real 404s, redirects, caching, removal, and preview restrictions. Fallback SHALL not be automatic failover.

#### Scenario: Default host
- **WHEN** a reader requests a public recipe on the default host
- **THEN** complete static HTML is served without invoking a required cloud application runtime or WordPress page rendering

#### Scenario: Operator-selected fallback
- **WHEN** an operator chooses Pages Free and completes its compatibility checks
- **THEN** the same content artifact can serve the public site without a content-model rewrite or weaker removal and preview guarantees

### Requirement: No automatic paid usage
Hosting and builds SHALL remain within configured free-tier limits without automatic paid enrollment, paid runners, or paid overage. GitHub execution and storage entitlements SHALL account for repository visibility. Quota exhaustion SHALL block publication visibly instead of silently incurring charges; existing WordPress/media hosting and domain costs remain separate.

#### Scenario: Private repository quota exhausted
- **WHEN** included GitHub Actions minutes or storage are exhausted
- **THEN** publication is blocked without paid execution and pending changes, including removals, remain visibly undeployed

#### Scenario: Static hosting limit exceeded
- **WHEN** an artifact exceeds the selected free plan's supported limits
- **THEN** deployment fails visibly without an automatic paid upgrade or automatic provider switch

### Requirement: No stale-content access paths
The public deployment SHALL expose no draft previews, public historical version previews, offline HTML cache, or long-lived stale HTML/discovery caching. HTML and non-fingerprinted discovery data SHALL revalidate. Code rollback SHALL rebuild against current public content rather than reactivate an old content artifact. Already downloaded copies and third-party caches are outside the removal guarantee.

#### Scenario: Historical preview request
- **WHEN** a reader attempts to access an old deployment through a provider version or preview URL
- **THEN** that historical content is unavailable publicly rather than bypassing a completed removal

#### Scenario: Code rollback after unpublish
- **WHEN** an operator rolls back application code after content was unpublished
- **THEN** the resulting release uses current eligible content and does not restore the unpublished page

#### Scenario: Returning reader after removal
- **WHEN** a reader revisits a removed route after a successful release
- **THEN** the active site does not serve a stale service-worker or long-lived HTML-cache copy as the current page

### Requirement: Public identity and CMS migration
Cutover SHALL preserve the public domain, legitimate legacy routes, public anchors, media paths, and feed access while moving WordPress behind a distinct CMS origin. CMS HTML SHALL be nonindexable without blocking public media indexing. Drafts and administration SHALL require actual access controls, not robots directives. Legacy media mapping SHALL not redirect recipe routes or permit open redirects.

#### Scenario: Legacy public media
- **WHEN** a crawler or reader follows an existing public upload URL after cutover
- **THEN** the image remains reachable through a path-preserving mapping and is not blocked merely because CMS HTML is nonindexable

#### Scenario: CMS and public identity
- **WHEN** a crawler requests CMS HTML and the corresponding public frontend page
- **THEN** the CMS HTML is nonindexable and the frontend metadata identifies the intended public URL without a redirect loop

### Requirement: Evidence-based launch acceptance
Production cutover SHALL require recorded checks of representative recipes, editorial pages, no-JavaScript use, media, metadata, consent, comments, real 404s, and publication/removal transitions on an authorized environment. Planning or static analysis alone SHALL not be reported as successful deployment, production comment submission, account approval, or live removal verification.

#### Scenario: Planning artifacts only
- **WHEN** only planning artifacts have been produced
- **THEN** deployment and live acceptance remain explicitly unexercised rather than reported as successful

#### Scenario: Authorized transition checks
- **WHEN** publication and removal are exercised in an authorized test environment
- **THEN** evidence identifies the environment, triggering revision, resulting release/status, direct URL responses, and relevant derived-output changes before those checks are claimed complete
