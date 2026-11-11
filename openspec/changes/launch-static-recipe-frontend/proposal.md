# Proposal

## Why

Plate Full of Yum needs a reliable static frontend that generates complete public pages from WordPress content and publishes them through GitHub to Cloudflare. This scope delivers the content pipeline and static hosting without making comment submission, WordPress helper-plugin installation, or CMS/domain migration prerequisites.

## What Changes

- Generate complete public recipe/article HTML, metadata, Recipe JSON-LD, categories, local search, sitemap, RSS, and a real 404 page from a validated WordPress/Create snapshot.
- Preserve published-only eligibility, recipe/article classification, authored SEO, content integrity checks, and public route identity.
- Keep approved comment threads as build-time snapshots only. Defer live comment reads and guest submissions to a separate change.
- Build from GitHub Actions on main pushes and manual runs; deploy the development site to GitHub Pages, then deploy the complete static artifact to Cloudflare Workers Static Assets.
- Keep deployments serialized, fail closed on incomplete or mixed snapshots, and prevent stale content artifacts or public previews from becoming current.
- Defer WordPress dispatch/acknowledgement hooks, helper-plugin requirements, CMS hostname migration, custom-domain DNS cutover, and live production acceptance.
- **BREAKING**: the WordPress theme ceases to be the public UI after a separately authorized cutover. Administrative editing remains in WordPress.

## Capabilities

### New Capabilities

None. The repository already has durable specifications for these capabilities.

### Modified Capabilities

- `wordpress-content`: Direct public content retrieval and normalized snapshots without the helper plugin.
- `recipe-experience`: Generated static recipe/article experience and discovery.
- `wordpress-comments`: Approved build-time comment snapshots only in this change.
- `static-publishing`: GitHub Actions builds, GitHub Pages development publishing, and Cloudflare Workers Static Assets delivery.

## Impact

- Frontend source, build tooling, static assets, GitHub Actions workflow, and Wrangler configuration.
- Public WordPress/Create APIs and media remain content sources. Public content import and build-time comment snapshots do not require the helper plugin.
- GitHub Actions uses main-branch and manual triggers; no WordPress dispatch credential, comment challenge secret, or runtime WordPress write access is needed for this scope.
- Cloudflare account configuration and deployment credentials remain in GitHub secrets. No secrets enter browser bundles or generated public files.
- Guest comment submission and live refresh, WordPress publication notifications, custom-domain cutover, and CMS migration are deferred to separate authorized work.
- No request-time recipe SSR, draft preview service, automatic serving/unit conversion, rating submission, paid image service, or automated provider failover. Existing source-backed rating summaries remain.
