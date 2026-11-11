# Spec Delta

## Purpose

Generate complete host-specific static artifacts from one current public WordPress snapshot, publish a development build through GitHub Pages, and deploy the production-root artifact to Cloudflare Workers Static Assets.

## ADDED Requirements

### Requirement: GitHub-owned builds and deployments
Source and deployment configuration SHALL reside in GitHub. GitHub Actions SHALL build from current public WordPress content on pushes to `main` and manual invocation. Pull requests SHALL run checks without production deployment secrets or public previews. Builds SHALL NOT require a WordPress helper plugin, write access, or WordPress-triggered dispatch.

#### Scenario: Main push or manual build
- **WHEN** `main` changes or an operator requests a rebuild
- **THEN** GitHub Actions retrieves current eligible public content and builds the complete static site

#### Scenario: Pull request
- **WHEN** a pull request runs checks
- **THEN** it receives no production deployment credentials and creates no public content preview or release

### Requirement: Complete validated static output
Each successful build SHALL create a clean complete artifact containing all public HTML routes, required assets, search data, sitemap, RSS, and a real 404 page from one complete content snapshot. Failed or incomplete source retrieval SHALL fail the build rather than appear as an empty or partial site.

#### Scenario: Missing or inconsistent source data
- **WHEN** a required content page, linked recipe card, or paginated source response is missing or inconsistent
- **THEN** the build fails and does not publish partial output

#### Scenario: Content removal
- **WHEN** an item is absent from the current eligible snapshot
- **THEN** its generated page and derived discovery entries are absent from the next complete artifact

### Requirement: Consistent serialized release
Production deployment SHALL be serialized. The build SHALL verify that its complete source snapshot is stable before release, and deployment SHALL publish the artifact produced by that run rather than reuse an older content artifact. A failed pre-release build SHALL leave the prior deployment active.

#### Scenario: Content changes during retrieval
- **WHEN** the complete source projection changes between consistency passes
- **THEN** the build fails without deploying the mixed snapshot

#### Scenario: Overlapping or replayed workflow
- **WHEN** deployments overlap or an old workflow is rerun
- **THEN** an older artifact cannot finish after a newer release or replace current content without rebuilding from current source

### Requirement: GitHub Pages development then Cloudflare production deployment
For a successful main-branch run, GitHub Actions SHALL publish a development artifact to GitHub Pages and then deploy a production artifact to the configured Cloudflare Workers Static Assets or operator-selected Cloudflare Pages Direct Upload target. Both artifacts SHALL be generated from the same complete validated public-content snapshot; target-specific base paths and canonical origins MAY differ. Cloudflare SHALL serve static assets without requiring request-time application execution. Custom-domain DNS cutover is outside this change.

#### Scenario: Pages Direct Upload before custom-domain setup
- **WHEN** Pages Direct Upload is selected and `PFOY_PUBLIC_SITE_ORIGIN` is the exact Cloudflare-assigned `<subdomain>.pages.dev` host for the selected Pages project
- **THEN** it may be used before a custom domain is attached; custom-domain setup is independent and may happen later, while arbitrary Pages hosts are rejected
- **AND** the operator confirms the project production branch is `main` and preview/historical deployment URLs are protected from public access

#### Scenario: Successful release
- **WHEN** the complete build and GitHub Pages development deployment pass
- **THEN** the workflow deploys the production artifact generated from that run's same validated snapshot to the configured Cloudflare target and requests only its home page, requiring a successful response with nonempty content

#### Scenario: Pre-release failure
- **WHEN** build validation or the GitHub Pages development deployment fails
- **THEN** the Cloudflare production deployment is not attempted and the previous Cloudflare release remains active

### Requirement: Static routes, caching, and access
The deployed site SHALL return real 404 responses for missing routes, preserve configured public paths and legacy media mappings, revalidate HTML and non-fingerprinted discovery data, and avoid public historical previews, offline HTML caches, or long-lived stale HTML. The release SHALL remain within the configured free-plan limits without automatic paid upgrades or provider failover.

#### Scenario: Missing route and removed page
- **WHEN** a reader requests a missing route or a route removed from the current artifact
- **THEN** the host returns HTTP 404 rather than a successful application shell

#### Scenario: Stale or historical content
- **WHEN** a reader requests an old deployment preview or revisits a page after its removal deployment
- **THEN** the active deployment does not expose public historical content or serve stale HTML as current

#### Scenario: Free-plan limit exceeded
- **WHEN** the build or artifact exceeds configured free-tier limits
- **THEN** deployment fails visibly without paid execution, paid overage, or automatic provider switching

### Requirement: Secrets remain private
GitHub, WordPress, and hosting credentials SHALL remain in their authorized secret stores and SHALL NOT appear in browser bundles, generated artifacts, public logs, or pull-request jobs.

#### Scenario: Inspecting an artifact or pull-request job
- **WHEN** public output is inspected or an untrusted pull request runs
- **THEN** no deployment credential or privileged WordPress data is exposed

### Requirement: Deployment evidence is explicit
Local planning or a successful local build SHALL NOT be reported as a successful GitHub Pages or Cloudflare deployment. Deployment acceptance SHALL identify the environment and verify representative pages, assets, discovery outputs, and real 404 behavior.

#### Scenario: Local-only verification
- **WHEN** only local builds or static-server checks have run
- **THEN** GitHub Pages and Cloudflare deployment acceptance remains unverified
