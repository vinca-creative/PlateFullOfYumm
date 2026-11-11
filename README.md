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

If Node's built-in `fetch` times out while `curl` reaches the same API, check DNS and network-family reachability. On a network where IPv6 is unavailable and DNS returns IPv4 first, retry with `NODE_OPTIONS=--no-network-family-autoselection npm run content:snapshot`. This disables address-family fallback; use it only for that network condition.

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

Before deployment, the workflow audits each host-specific `build/` against its validated `content-snapshot/snapshot.json`. The audit checks snapshot completeness/private projection fields, every expected content/category/utility route, required search/feed/sitemap/404 outputs, local references, and high-confidence credential patterns. It writes a revision-bound route/file/asset manifest outside `build/` and retains both host manifests with the production release artifact. Cloudflare Workers Static Assets and Pages Free each allow at most 20,000 files per site/Worker version and 25 MiB per file; the audit enforces both limits. Cloudflare documents [Workers Static Assets billing and limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/). GitHub Actions allowance depends on repository visibility and owner billing settings; check current account limits and configure spending controls before deployment.

  
## Static frontend content contract

The site reads only the generated snapshot at prerender time. Recipe/article permalinks and linked category/tag archives are explicitly enumerated from those validated records; `/recipes/` and the home page are generated from that same set. A missing or corrupt snapshot is a build error, not an empty site. WordPress media URLs and responsive variants remain the source URLs.

Available editor-controlled data includes public path and post ID, recipe/article/page kind, title, excerpt, sanitized authored body HTML, publication/modification dates, author display name, category/tag terms and public paths, featured image URL/alt/dimensions/variants, authored SEO/social title/description/canonical/robots/image, and (for recipe cards) original ingredient strings and grouping, instruction order/anchors, notes, supplied time/yield values, optional source-backed nutrition, and optional aggregate rating/count. The frontend does not infer or convert quantities, servings, nutrition, ratings, or dietary labels.

Rendered recipe cards replace only the validated Create marker at its authored location. Article and recipe JSON-LD are built only from the snapshot; Recipe ratings/nutrition are omitted when absent. Sitemap entries honor each content record's `noindex` directive; the front page follows its own robots directive, while category/tag archives remain listed when their posts are noindex. The RSS feed and browser search index contain only records present in the public snapshot.

### Design and manual accessibility review

The Svelte site imports the shared visual system from `template/website/assets/theme.css` and `pages.css`; its existing home, article/category, search, and recipe components render snapshot-backed content into prerendered HTML under `build/`. The global shell and masthead use the template’s sage/forest palette, responsive spacing, and typography. Inter and Fraunces are self-hosted from pinned SIL Open Font License packages, with their license notices at `static/fonts/OFL-1.1.txt`; approved brand artwork is not present. Structured recipe cards retain ingredient checkboxes and print support and add the template’s client-side cooking-view toggle. The standalone template HTML and `pages.js` are not published as a second content source.

Local browser review at 320px, 390px, 768px, and 1440px confirmed no horizontal overflow; Inter/Fraunces loaded from local assets; sampled foreground/background contrast ranged from 4.67:1 to 11.78:1; the skip link had a visible focus ring; and all 20 mobile navigation/category links closed both menus after selection. No live-host review is claimed. Before launch, still review heading/landmark order, keyboard-only search/checkbox operation, 200% zoom, reduced motion, image alternatives, no-JavaScript recipe access, and browser printing of a long recipe (complete steps/notes, no navigation or clipped content).

## Free-hosting constraints

`.github/workflows/validate.yml` runs pull-request and `main` checks with read-only repository permissions, no Cloudflare credential, and no public preview. `.github/workflows/deploy.yml` runs only on `main` pushes and manual dispatches; it retrieves a fresh complete public WordPress snapshot without WordPress credentials or publication hooks. Non-canceling concurrency serializes the full build and ordered releases. A manual rebuild must target `main`.

The release workflow builds a GitHub Pages development artifact using the repository base path and Pages origin, then builds the production-root artifact from the same validated snapshot. GitHub Pages deployment must succeed before the production artifact is sent to Cloudflare. The two host-specific outputs differ only where their URL bases and canonical origins require it; production deployment always uses the production artifact created by that run, never a stale artifact or snapshot. No `dev` branch deployment, `repository_dispatch`, WordPress acknowledgement, or WordPress write access is part of this release path.

Enable GitHub Pages with **GitHub Actions** as its source. Set repository Actions variables:

- `PFOY_WORDPRESS_API_ROOT`: the public WordPress REST API root ending in `/wp-json/`.
- `PFOY_CMS_ORIGIN`: the WordPress/media HTTP(S) origin without a path.
- `PFOY_PUBLIC_SITE_ORIGIN`: the owner-configured public HTTP(S) origin without a path.
- `CLOUDFLARE_ACCOUNT_ID`: the owner-provided Cloudflare account identifier.
- `PFOY_DEPLOYMENT_TARGET`: optional operator selection, `workers` (default) or `pages` (Cloudflare Pages Direct Upload fallback).
- `PFOY_PAGES_PROJECT_NAME`: required only when `pages` is selected.

Store `CLOUDFLARE_API_TOKEN` only as a GitHub Actions secret in the protected `prod` environment, scoped to the selected Cloudflare account and deployment target. Workers requires the account's Workers deployment permission. Pages additionally requires Pages project read/write permissions for Direct Upload and preflight checks. The token is exposed only to deploy-prod after the read-only build and successful GitHub Pages deployment. Never put credentials in `.env`, source, `VITE_` variables, logs, artifacts, or workflow payloads.

Create GitHub Actions environments named `dev` and `prod`; `deploy-dev` uses Pages-only permissions, while Cloudflare secrets are scoped to the protected `prod` environment. Enable GitHub Pages with **GitHub Actions** as its source. Restrict repository and environment administration to release operators.

The Cloudflare Workers Static Assets configuration serves the generated `build/` files directly, returns the generated 404 page with a real not-found status, and disables Workers.dev and preview URLs. Generated `_headers` revalidates HTML and other non-fingerprinted files; fingerprinted SvelteKit assets receive long immutable caching. No service worker or offline HTML cache is used. The generated `_redirects` file maps only legacy `/wp-content/uploads/*` requests to the matching path at `PFOY_CMS_ORIGIN` when its origin differs from the public origin; it does not redirect frontend routes. Both Workers Static Assets and Pages Direct Upload use the same production-root artifact and generated host files.

The Pages Direct Upload path is a manual fallback selected with `PFOY_DEPLOYMENT_TARGET=pages`, not automatic failover. Before selecting it, an operator must confirm the Pages project has `main` as its production branch, the approved public origin active, and all preview/historical deployment URLs protected from public access (for example with Cloudflare Access). The workflow checks the configured branch and active domain but cannot verify Access policy or historical preview protection. Do not upload public content unless those controls are verified in the account. Pages remains unaccepted until a disposable Pages environment demonstrates route publishing/removal, real 404s, legacy media redirects, cache behavior, and preview protection.

A quota, build, Pages, configuration, or Cloudflare failure must be visible in Actions and must not silently substitute another provider. A pre-release failure leaves the current production release active. The post-upload smoke check requests only the configured home page and requires a successful response with a nonempty body; it does not inspect page content or verify routes, assets, or removals. A failure may have changed production; inspect the run and verify the configured public origin rather than assuming rollback.

The Cloudflare account, Workers environment/route, optional Pages project, domains, credentials and GitHub settings are owner-controlled and are not configured here. The configured public origin must reach the selected production host for the home-page smoke check to pass. Keep Workers.dev and public preview URLs disabled. For rollback, revert the faulty code on `main` and run the normal manual workflow; it rebuilds from current public WordPress content, preserving current editorial state rather than replaying an older artifact. Then verify the live routes and removed-page 404s.

Record each authorized release or recovery's UTC time, workflow/run ID and attempt, checked-out commit, target, content revision, build/release outcome, failed step, whether upload was attempted/completed, recovery action, and observed public URL/404 checks. Do not record credentials. A successful complete deployment removes absent pages from the new artifact; it cannot retract copies already held by browsers, proxies, search engines, archives, or third parties, and WordPress media URLs are separate.

After the owner configures and verifies the public domain in Google Search Console, submit the generated `/sitemap.xml` and monitor indexing and crawl errors. For removals, verify the live route returns 404 and the URL is absent from the new sitemap; request temporary search-result removal through the owner-controlled Search Console account when needed. A static release cannot erase browser, proxy, search, archive, or third-party copies.

As of 2026-11-02, GitHub CLI access and the main-branch GitHub Pages deployment were verified; the Pages build serves project-base assets and links, `/search.json`, and real 404s. The protected `prod` `CLOUDFLARE_API_TOKEN` secret and Cloudflare account ID repository variable are present. However, the configured public origin is a Cloudflare Pages deployment (`4b5f982f.platefullofyum.pages.dev`) that serves a Smoke Article and canonicalizes to `platefullofyum.com`; it is not verified as the Workers production host. The production target/route, Pages fallback project protections, and billing controls remain unverified. The current remote `main` workflow is older than the local uncommitted workflow and includes WordPress acknowledgement callbacks; the current local release code has not been deployed. Node-based full snapshot retrieval also fails in this workspace. Do not approve the existing stale production run.


### Advertising and consent (disabled by default)

Advertising is off unless `VITE_ADS_ENABLED=true`; omitted/false config builds ship no CMP or AdSense requests, ad slots, or `/ads.txt`. Enabled builds fail unless supplied values validate. Both GitHub Actions build steps currently force `VITE_ADS_ENABLED=false` and use the owner-supplied publisher `ca-pub-3611846975019947` and first slot `9535700852`. Optional account values are read from the public Actions variables `PFOY_ADS_CMP_URL`, `PFOY_ADS_PRIVACY_URL`, and `PFOY_ADS_SELLER_LINE`; these are forwarded only as public build configuration and are not yet verified. The workflow does not enable ads; do not change that setting until owner approval and account/browser acceptance. All `VITE_` advertising values are public, not secrets:

- `VITE_ADS_CMP_URL`: the owner/account-generated Google Privacy & Messaging (Funding Choices) script URL on `fundingchoicesmessages.google.com`; CMP must be configured for the public hostname, TCF v2.2, and applicable GPP/US opt-out requirements.
- `VITE_ADS_PUBLISHER_ID`: actual `ca-pub-` publisher ID; `VITE_ADS_FIRST_SLOT`: real manual slot ID; optional `VITE_ADS_SECOND_SLOT`: a distinct real manual slot ID.
- `VITE_ADS_PRIVACY_URL`: owner-approved public HTTPS privacy-policy URL.
- `VITE_ADS_SELLER_LINE`: exact `google.com, pub-<16 digits>, DIRECT, f08c47fec0942fa0` entry matching the publisher ID.

Only configured manual slots are eligible, on recipe/article content with substantive prose; a second slot requires at least 1,200 rendered editorial words and two substantial paragraphs after the recipe. Under GDPR, the TCF API must report the required purposes and Google's vendor consent. For all users, Google Funding Choices must report a known US opt-out status (no applicable regulation or not opted out) through its GPP integration; opted-out, unknown, or unavailable GPP status fails closed. Consent changes revoke current-document requests and remove active presentation. The persistent Privacy choices control invokes Google Funding Choices revocation/US controls; the CMP owns consent and persistence, with no frontend shadow decision. Ad placement is lazy and once per document; all article links reload the document. No Auto ads, overlays, sticky ads, refresh timers, or print ads are used. The owner must disable Auto ads and other automatic placements in AdSense before enabling the publisher tag.

The static `/ads.txt` asset is generated only for an enabled build from the validated seller line and is plaintext; disabled builds omit it. Google's Site Kit platform linkage is not proof of an actual AdSense publisher account, site approval, CMP setup, slot ownership, legal approval, or seller authorization. Do not enable ads until the owner supplies and verifies each real value and completes account/browser acceptance. No owner account, approved privacy URL, staging or live host, or real-browser consent/ad acceptance was available; advertising remains unverified and disabled.

See [`Agents.md`](Agents.md) for implementation conventions and the OpenSpec workflow. The active change is `launch-static-recipe-frontend` under `openspec/changes/`.
