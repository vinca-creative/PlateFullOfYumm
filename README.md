# Plate Full of Yum

Static SvelteKit frontend for Plate Full of Yum, with WordPress as the source of recipes, articles, media, and comments. The snapshot-backed frontend is implemented; complete launch acceptance still requires a complete validated WordPress snapshot and owner-approved licensed font/brand assets.

## Stack and local development

Requirements: Node.js 22.17+ and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run check
npm run test:content
npm run check:php
```

`npm run dev`, `npm run build`, and `npm run preview` require a complete validated snapshot. Create it after configuring the WordPress source below; there is no fixture or empty-site fallback.

Copy `.env.example` to `.env` for public origins, the optional public Turnstile site key, and `PFOY_WORDPRESS_API_ROOT`. `VITE_` values are browser-visible; only the public Turnstile site key belongs there. `VITE_PUBLIC_SITE_ORIGIN` must be an HTTP(S) origin without a path; a trailing slash is normalized away. The site key must match the Cloudflare Turnstile widget configured for the frontend hostname. Without it, comment submission is disabled. WordPress verifies the challenge using server-only secrets documented in the plugin README; deployment secrets must never use a `VITE_` prefix. Local development intentionally disables comment submissions.

## WordPress content source

The public API root is `https://platefullofyum.com/wp-json/`. Its `wp/v2` routes provide published posts, pages, embedded authors, taxonomy and media; Create's `mv-create/v1/creations/{id}` route provides recipe cards. The production API root does not expose `pfoy/v1`. Public reads require no WordPress login.

The importer does not require the helper plugin: cardless published WordPress posts are treated as editorial articles, while a post containing a Create marker is a recipe only when the public Create API returns `type=recipe` and the card links back to that same post. An embedded but unavailable, invalid, or mismatched Create card blocks export rather than being downgraded. Any exceptional cardless recipes must be corrected at the source.

Set `PFOY_WORDPRESS_API_ROOT` in `.env` to the trailing-slash WordPress REST root, and create the snapshot before building:

```sh
npm run content:snapshot
```

The importer retrieves public posts/pages, approved comments, media and taxonomy through WordPress core REST, and linked recipe cards through Create's public REST API. Optional SEO metadata comes from public REST fields when available and falls back to the canonical public page head. Once REST and head retrieval confirm a field is unset, defaults are the visible title, public excerpt (which may be empty), normalized permalink, `index,follow`, Open Graph title/description falling back to those resolved title/description values, and a null Open Graph image. The importer does not invent body/author text or images; failure to retrieve the canonical page head remains an error. It requires no authenticated link, helper-plugin read route, `pfoy_content_kind`, or `pfoy_seo`. Retrieval is uncached, checks a second complete source pass, sanitizes article HTML, and atomically writes the ignored `content-snapshot/snapshot.json`. The helper plugin remains relevant for guest comment submissions and the optional publication revision/dispatch/ack lifecycle; installing it is not required just to pull public content. Frontend prerendering requires the validated snapshot.

An empty REST title may be recovered from a nonempty `<title>` in the public canonical page; if neither exists, import fails with the affected post ID.

## Build and preview

After `npm run content:snapshot` succeeds:

```sh
npm run dev
npm run build
npm run preview
```

The adapter writes static files to `build/`. `build/404.html` is the designed not-found page for hosts configured to serve it with HTTP 404; Workers Static Assets uses `not_found_handling: "404-page"`. No SPA fallback is configured.

  
## Static frontend content contract

The site reads only the generated snapshot at prerender time. Recipe/article permalinks and category archives are explicitly enumerated from those validated records; `/recipes/` and the home page are generated from that same set. A missing or corrupt snapshot is a build error, not an empty site. WordPress media URLs and responsive variants remain the source URLs.

Available editor-controlled data includes public path and post ID, recipe/article/page kind, title, excerpt, sanitized authored body HTML, publication/modification dates, author display name, category/tag terms and public paths, featured image URL/alt/dimensions/variants, authored SEO/social title/description/canonical/robots/image, and (for recipe cards) original ingredient strings and grouping, instruction order/anchors, notes, supplied time/yield values, optional source-backed nutrition, and optional aggregate rating/count. The frontend does not infer or convert quantities, servings, nutrition, ratings, or dietary labels.

Rendered recipe cards replace only the validated Create marker at its authored location. Article and recipe JSON-LD are built only from the snapshot; Recipe ratings/nutrition are omitted when absent. Sitemap entries honor each content record's `noindex` directive; the front page follows its own robots directive, while category archives remain listed when their posts are noindex. The RSS feed and browser search index contain only records present in the public snapshot.

### Design and manual accessibility review

The Svelte site imports the shared visual system from `template/website/assets/theme.css` and `pages.css`; its existing home, article/category, search, and recipe components render snapshot-backed content into prerendered HTML under `build/`. The global shell and masthead use the template’s sage/forest palette, responsive spacing, and typography. Structured recipe cards retain ingredient checkboxes and print support and add the template’s client-side cooking-view toggle. The standalone template HTML and `pages.js` are not published as a second content source. Licensed Fraunces/Inter font files and approved brand artwork are not present; add only owner-provided/licensed assets before claiming final brand review.

Before launch, manually review at 320px, 390px, 768px, and 1440px; verify no horizontal overflow, readable contrast, heading/landmark order, skip navigation, visible focus, keyboard-only menu/category/search/checkbox operation, 200% zoom, reduced-motion preference, image alternatives, no-JavaScript recipe access, and browser printing of a long recipe (complete steps/notes, no navigation or clipped content). These are manual browser checks, not claimed as already performed.

## Free-hosting constraints

GitHub Actions has separate development and production deployment workflows. `deploy-dev.yml` builds and deploys the `dev` branch to this repository's GitHub Pages site; the production `deploy.yml` publishes `main` and WordPress-triggered releases to Cloudflare Workers Static Assets. The development build uses the repository Pages base path; production keeps the site at the root path.

- Enable GitHub Pages with **GitHub Actions** as the build and deployment source. Pushes to `dev` or a manual run of `Publish development site to GitHub Pages` build the current WordPress snapshot, upload the generated `build/` artifact, then deploy it in a separate job. GitHub Pages uses its built-in deployment actions; project-specific build and header-copy actions run through `scripts/`.
- Set Actions variables `PFOY_WORDPRESS_API_ROOT` and `PFOY_CMS_ORIGIN` for the development build. Its canonical origin and repository base path are derived from the GitHub repository. The development workflow has no Cloudflare credentials and does not send WordPress publication acknowledgements.
- Pushes to `main` and WordPress `repository_dispatch` events publish to Cloudflare Workers; production still requires the documented Cloudflare credentials and WordPress publication configuration. Pull-request checks do not deploy or receive deployment credentials.
- The development site is for testing only. GitHub Pages routing, real 404 behavior, and base-path behavior must be confirmed after the repository's Pages settings are enabled; no live deployment is claimed.
- Do not add request-time Worker code, public draft previews, public historical content previews, or an SPA fallback.
- Pull-request checks must not receive deployment credentials or create public previews.
- Check repository visibility against included GitHub Actions minutes/storage, configure spending controls to block paid overage, and bound cache/artifact retention before deployment; use no paid runners or automatic plan upgrades.
- A failed deployment keeps the last complete site live; a pending unpublish is not complete until a successful removal release is verified.

## WordPress-to-GitHub publication lifecycle

The release integration is fail-closed and **disabled by default**. The plugin does not advance publication revisions, dispatch GitHub, or accept deployment acknowledgements unless all server-side constants below are present and `PFOY_PUBLICATION_ENABLED` is exactly `true`. The status endpoint remains non-secret metadata; it reports `enabled: false` while configuration is missing and never reports a successful deployment in that state.

### WordPress server configuration

Install the helper plugin on the WordPress source site. Define these values in server-only `wp-config.php` or equivalent protected configuration; never commit the values, put them in browser-visible `VITE_` variables, or put them in dispatch payloads:

```php
define( 'PFOY_PUBLICATION_ENABLED', true );
define( 'PFOY_PUBLICATION_GITHUB_REPOSITORY', 'OWNER/REPOSITORY' );
define( 'PFOY_GITHUB_DISPATCH_TOKEN', 'OPERATOR-PROVIDED-REPOSITORY-TOKEN' );
define( 'PFOY_PUBLICATION_WORKFLOW', 'Publish production static site' );
define( 'PFOY_PUBLICATION_ACK_SECRET', 'OPERATOR-PROVIDED-RANDOM-SECRET-AT-LEAST-32-CHARACTERS' );
```

Replace every uppercase placeholder with owner-provided values; these examples are not usable credentials or repository settings. For a fine-grained GitHub token, grant only the intended repository's **Contents: Read and write** permission required for repository dispatch; classic tokens require the repository-scoped `repo` scope. Generate one high-entropy acknowledgement secret and configure the exact same value as GitHub Actions secret `PFOY_PUBLICATION_ACK_SECRET`. The plugin compares the configured workflow name and repository against the signed callback. Keep a protected backup and rotate both copies together.

The plugin tracks public post/page publication transitions, public Create-card post/meta changes, attached media, relevant taxonomy and Yoast metadata, and approved comment visibility/text changes. Drafts, autosaves, revisions, pending comments and nonpublic posts do not advance the public revision. The current Create integration recognizes `mv_create` and `mv_creation` card post types. Confirm the actual installed Create storage/type on a nonpublic staging copy; if it differs, register the verified type using the `pfoy_create_card_post_types` filter in site-owned server code before enabling publication. This source-specific adapter has not been verified on the production WordPress installation.

The narrow status read is `GET /wp-json/pfoy/v1/publication/status`; it returns only the enabled flag, desired/deployed revision, outcome and fixed failure/deployment codes. GitHub reads the current desired revision before retrieval; the fetch command checks it before and after the complete content snapshot; the workflow checks it again immediately before deployment. A signed callback is accepted only for the exact current revision and configured repository/workflow/run identity. Timestamped HMAC callbacks expire after five minutes; non-idempotent replays are rejected, while an exact successful retry for the same run is idempotent. A newer verified code release may acknowledge an already-deployed content revision without moving the revision backward. Dispatches contain only a monotonic revision and event code, never article, draft, comment or credential data.

WordPress scheduled work retries failed GitHub dispatches with bounded backoff and retries dispatch delivery if an accepted event receives no acknowledgement. Configure an actual host-level cron or WP-CLI scheduler to run WordPress due work continuously (recommended: every minute), and disable traffic-driven cron with `DISABLE_WP_CRON` only after the host job is confirmed. Without host cron, scheduled publication and dispatch retries can stall during low-traffic periods. A signed build/deploy failure is surfaced as failed and does not count as deployed; review the Actions run, correct the cause, then use `workflow_dispatch` for recovery. A source change during a build/deploy remains pending and must be picked up by a later serialized run.

### GitHub and Cloudflare configuration

Configure repository Actions variables:

- `PFOY_WORDPRESS_API_ROOT`: the owner-configured WordPress REST API root, ending in `/wp-json/`.
- `PFOY_PUBLIC_SITE_ORIGIN`: the configured canonical public HTTP(S) origin, with no path.
- `PFOY_CMS_ORIGIN`: the configured WordPress/media HTTP(S) origin, with no path.
- `CLOUDFLARE_ACCOUNT_ID`: the owner-provided Cloudflare account identifier.

Configure repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: an owner-created API token scoped to the exact account. The Workers target requires Cloudflare's **Edit Cloudflare Workers** permission; selecting Pages additionally requires **Pages Read** and **Pages Write** for project/domain checks and Direct Upload.
- `PFOY_PUBLICATION_ACK_SECRET`: the same random value configured as `PFOY_PUBLICATION_ACK_SECRET` in WordPress.

Do not put any of these deployment credentials in `.env`, source control, a `VITE_` variable, static output or logs. `deploy.yml` uses only current `main` code and WordPress content, is serialized with cancellation disabled, and requires these settings before release. It deploys with pinned Wrangler, then verifies a public release marker against the expected WordPress content revision and code SHA, checks all sitemap routes, generated indexes, a generated application asset, removed routes from the previous release inventory (or its sitemap for older releases), and an unknown path returning a real 404 before it sends the success acknowledgement. A post-upload smoke failure is reported with the upload state because the live version may already have changed. The `validate.yml` pull-request path has no production secrets and creates no public preview.

The Cloudflare account, Workers Static Assets project/route, optional Pages project/domain, and public-domain attachment are not configured here. The configured public origin must already reach the selected production deployment for post-deploy checks to pass. Configure the production route/custom domain with the owner-selected zone/account outside this workflow; it deliberately does not guess or create one. Keep `workers_dev` and public preview URLs disabled; do not use an old artifact for rollback. A rollback must check out known-good code and run the same current-content and revision-checked release.

### Operator runbook

Before enabling a release, check the repository's visibility against the GitHub Actions minutes/storage included with its plan: private repositories may have different included allowances than public repositories, and limits/prices can change. Confirm current allowance in GitHub billing, set Actions spending limits to block paid overage (including runner and storage charges), and bound artifact/cache retention. Do not enable paid runners, automatic upgrades, or overage as recovery.

Keep `PFOY_GITHUB_DISPATCH_TOKEN` in protected WordPress server configuration only. Use a fine-grained token restricted to this repository and only the Contents read/write permission needed for repository dispatch; classic tokens require the repository-scoped `repo` scope. Store `CLOUDFLARE_API_TOKEN` only as a GitHub Actions repository secret, scoped to the selected account and required deployment target: Workers Edit for Workers, plus Pages Read/Write only when Pages is selected. Never put either token in source, `.env`, workflow payloads, browser-visible settings, build artifacts, or logs. Use the WordPress status endpoint and GitHub Actions run details for diagnosis, not token values.

For each publication or recovery, record the WordPress status endpoint's desired and deployed revisions, outcome/failure code, and the GitHub Actions workflow name, run ID, attempt, checked-out commit, and deployment target. Compare the desired revision to the run's source revision and the deployed revision; a newer desired revision remains pending until a successful release acknowledges it. Repository dispatch events carry only revision/event code. In Actions, inspect the failed step and run identity. A pre-upload failure leaves the last complete deployment live; a post-upload smoke failure may have changed live content, so use the reported upload state and verify public routes before declaring the old version live. Correct configuration/source/build/deployment cause, then start `Publish production static site` with `workflow_dispatch` on `main` (choose `workers` by default, or `pages` only when intentionally using that configured fallback). The run fetches and builds current WordPress content and checks the source revision before upload; a source change during a run stays pending for another run. Confirm the status endpoint and public checks after recovery; do not call a pending removal complete.

For rollback, revert the faulty application/code change on `main`, then dispatch the ordinary production workflow. It deliberately checks out current `main` and retrieves a complete snapshot from current WordPress; it does not deploy a previous build artifact or content snapshot. This restores prior behavior while preserving current editorial state. Check the deployed revision and public removal/404 behavior afterward.

If the WordPress dispatch is absent or fails, inspect the Actions run and WordPress publication status, confirm the server configuration and repository token, then use the authorized manual rebuild. Failed dispatch delivery is retried by scheduled WordPress work; ensure the host cron/WP-CLI scheduler is running. A signed build/deploy failure is surfaced as failed and stops automatic retry until a new content revision or manual rebuild. If an unpublish/removal is blocked, the previous static deployment may still expose the content: fix the cause and successfully rebuild from WordPress, then verify the removed URL and sitemap. Keep an incident record of revisions, workflow/run identity, failure code, recovery action, and verification outcome without copying secrets.

After the owner configures the real public domain, verify that exact domain in Google Search Console using an owner-controlled method (for example DNS TXT or an HTML verification file) and confirm the sitemap URL is accepted; do not invent or commit verification tokens. AdSense verification is conditional: keep ads disabled unless the owner has a real publisher account and has completed its domain/site review, consent/privacy requirements, actual slot setup, and seller authorization (`ads.txt`); Site Kit linkage alone is not publisher approval. Account IDs, verification values, publisher approval and slot identifiers remain owner-supplied and unverified.

Static removal is not an erasure guarantee. A successful build/deployment excludes the removed route from the new output and checks public route removal, but old copies may remain in browser, proxy, search-engine, or third-party caches, archives, screenshots, and downloads; WordPress media URLs are separate source URLs. Static hosting cannot recall copies already obtained or promise immediate search-index removal. Escalate cache/index cleanup to the relevant provider when needed, and verify the live origin after the release. No staging/production recovery drill, external domain verification, or account-specific setup has been performed; these remain pending owner authorization and values.


No WordPress server configuration, GitHub secret/variable, Cloudflare account/token/domain, real host cron, live REST status route, GitHub dispatch, acknowledgement, deployment or production smoke check was exercised in this change. Do not enable the integration or claim publication success until the owner supplies those settings and an authorized staging run demonstrates publish/edit/card/media/taxonomy/SEO/schedule/unpublish and approved-comment changes, failed dispatch retry, forged/stale callback rejection, source-race withholding, deployment failure status, removal 404s and cron-driven schedule execution.

Advertising remains independently disabled. `VITE_ADS_ENABLED=true` intentionally aborts the application build; there is no configured CMP, slot identifier, verified publisher setup, approved privacy policy or seller-verified `ads.txt`. Keep that mode unavailable until the owner supplies and verifies those real account/legal inputs.

See [`Agents.md`](Agents.md) for implementation conventions and the OpenSpec workflow. The active change is `launch-static-recipe-frontend` under `openspec/changes/`.
