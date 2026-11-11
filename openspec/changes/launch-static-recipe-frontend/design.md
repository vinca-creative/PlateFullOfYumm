# Design

## Context

See `proposal.md` for motivation and scope. This design addresses the new WordPress-backed static frontend and its GitHub Actions/Cloudflare deployment lifecycle.

Read-only exploration of the live site established:

- WordPress reports 87 published posts, 78 containing Create cards. A post with a valid linked Create `type=recipe` card is a recipe; a published post without a Create card is an editorial article. Cardless posts do not block public import and can be corrected in WordPress later. Invalid Create markers/cards still fail integrity validation.
- Post 1084 (`/banana-bread/`) references Create card 82. Both `/wp-json/mv-create/v1/creations/82` and its `/json_ld` endpoint return structured public data. WordPress media exports responsive variants; approved comments expose parent relationships.
- Ingredient quantities are currently free-text: the sampled card has `original_text` values but null numeric amount/unit fields. Nutrition serving count and display yield also need faithful, editorially reviewed mapping.
- Yoast metadata appears in public HTML, but the sampled REST response omits `yoast_head_json` and `yoast/v1/get_head` returns `rest_no_route`. The design cannot depend on that route becoming available without integration work.
- The current mobile masthead delays recipe content. Create, theme, and Site Kit scripts currently operate within WordPress; moving article HTML does not move their behavior.

The user-selected scope is a GitHub Actions content build, GitHub Pages development deployment, and Cloudflare Workers Static Assets deployment. Public WordPress REST APIs remain the source; approved comments are build-time snapshots only. Live comment refresh/submission, helper-plugin publication hooks, and CMS/domain cutover are deferred.

## Goals / Non-Goals

**Goals:**

- Keep page delivery independent of WordPress PHP at request time; public WordPress APIs and media are used during build.
- Preserve one editorial source while generating consistent readable HTML, metadata, and discovery outputs.
- Reject incomplete or mixed-source snapshots before publishing any output.
- Keep the static artifact portable and deployments bounded by free-tier entitlements.

**Non-Goals:**

- No request-time recipe SSR, draft preview routes, guest comment submission, live comment refresh, account system, new ratings database, automatic ingredient conversion, or offline/PWA page cache.
- No WordPress helper-plugin requirement, WordPress-to-GitHub dispatch/acknowledgement lifecycle, CMS hostname migration, or custom-domain DNS cutover in this change.
- No rewriting WordPress themes, importing their frontend bundles, or implementing a general Gutenberg page builder in Svelte.
- No automatic provider failover or assumption that already-public content can be erased from third-party caches.

## Decisions

### 1. One static frontend and one WordPress integration

Use Svelte 5, the current stable compatible SvelteKit release, TypeScript, and `@sveltejs/adapter-static`. Keep server rendering enabled during prerendering; do not set `ssr = false`. Enumerate all public route entries from the content snapshot instead of relying only on link crawling. Use trailing slashes matching the existing site and a genuine static 404 page, with no SPA catch-all.

Proposed implementation locations (new files, not existing conventions):

| Location | Responsibility |
| --- | --- |
| `src/routes/` | Home, recipe/article permalinks, category archives, recipe discovery, about/legal pages, error page |
| `src/lib/components/` | Header, recipe preview, recipe card, ingredient list, static comment snapshot |
| `src/lib/content/` | Typed published-content contract and page-model helpers |
| `scripts/` | Snapshot retrieval, integrity checks, route generation, publishing checks |
| `.github/workflows/` | Pull-request checks, main/manual build, GitHub Pages development publish, Cloudflare deploy |
| `static/` | Local fonts, brand assets, robots and host configuration assets |
| `wrangler.jsonc` | Workers Static Assets configuration pointing to generated `build/` |

Generated snapshots and `build/` are ignored output, not a content mirror committed to Git. Pin dependencies using a lockfile. Use plain component CSS and shared design tokens rather than a large UI kit. A typed content boundary is warranted; a provider abstraction framework is not.

Alternative rejected: a browser-only WordPress client, because recipes and metadata would depend on client execution. Hybrid SSR adds runtime coupling without a requirement for immediate publication or preview.

### 2. Direct public WordPress REST and Create APIs

Use the public WordPress API root to discover standard `wp/v2` posts, pages, taxonomy, and media endpoints, approved public `wp/v2/comments`, plus Create's `mv-create/v1/creations/{id}` endpoint for card data. The build MUST NOT depend on `pfoy/v1` routes or require the helper plugin for public-content import. Public reads require no credentials. Never embed WordPress admin credentials or Application Passwords in the frontend or snapshot fetch configuration.

Treat a published post with a linked Create card as a recipe only when the card record declares `type=recipe` and its canonical post association matches. Invalid marker/card type, missing or conflicting card records, or mismatched post association fail the snapshot; malformed embedded recipe content MUST NOT be downgraded to an article. A published post without a Create card is exported as an editorial article, without requiring `pfoy_content_kind`; cardless exceptions may be corrected in WordPress later and do not block import. Pages retain their core page identity.

`pfoy_seo` MAY be exposed by an optional helper plugin as a REST field populated from supported Yoast metadata; it is not required for import. Read authored SEO values from it when present, other supported core REST SEO fields, or the public canonical page head. Authored metadata MUST NOT be silently discarded.

The importer reads `wp/v2/posts` and `wp/v2/pages` with `status=publish`, `context=view`, `per_page=100`, and `_embed=1`; it follows `X-WP-TotalPages` and uses embedded author, taxonomy, and featured-media data. For each recipe post, it extracts and validates the linked Create card ID from rendered content, fetches that card from `mv-create/v1/creations/{id}`, and requires `type=recipe` plus a matching canonical post relationship. Missing, conflicting, or invalid card references fail the whole snapshot. Posts without cards are editorial articles; editorial content remains from `content.rendered`, and a valid card region is replaced with one native recipe placeholder after sanitization.

Create card IDs, original ingredient text/order/groups, instruction HTML order, source-backed nutrition/rating, timing values, and card image data are normalized to the existing public content contract. WordPress REST embedded media supplies responsive featured-image URLs, dimensions, and alt text. Approved comments are read directly from the public `wp/v2/comments` endpoint and included in the static snapshot; no live comment endpoint or submission plugin is required. Read authored SEO values from supported REST fields or public canonical page-head parsing.

The importer computes a SHA-256 revision over the canonical projection of all normalized posts, pages, cards, taxonomies, media references, and SEO values. It performs a second complete uncached source pass before writing output and rejects any changed fingerprint, missing page, mismatched totals, duplicate ID/path, or invalid dependency. This is more network work than a revision endpoint but gives the current public APIs a conservative stable-snapshot boundary. A failed or incomplete pass never replaces the previous snapshot.

At build time:

1. Discover and validate the public API origin; request only published public posts/pages without caching.
2. Follow all WordPress pagination, embedded public dependencies, approved public comment reads, and linked Create card requests; enforce bounded concurrency, timeouts, and response-size limits.
3. Validate recipe card markers and card/post relationships, canonical paths, image metadata, and exported SEO fields. Do not require editor classification for cardless posts.
4. Normalize canonical public URLs separately from CMS/media URLs using parsed origins and explicit mappings.
5. Sanitize rendered HTML, preserve semantic editorial order and safe anchors/links/images, and replace exactly one matching valid Create embed with a native card reference; export cardless posts as articles.
6. Repeat the complete source projection and compare its fingerprint; reject mixed or partial content.
7. Atomically write a new ignored snapshot only after all validation succeeds; leave the last complete snapshot untouched on failure.

The importer does not depend on `pfoy/v1` routes or a helper plugin. Public posts, pages, taxonomy, media, authors, approved comments, and Create card data are read from their public REST APIs. Guest comment submission and WordPress publication notification/revision/acknowledgement are deferred.

Render one consistent Recipe entity per actual card plus useful Article, BreadcrumbList, and author entities. Structured data matches visible values; never synthesize reviews, nutrition, or serving arithmetic. Correct existing yield/serving inconsistencies editorially before enabling their structured nutrition output.

### 3. Visual direction: warm editorial cookbook

The design prioritizes real food photography and useful cooking information, not a dashboard-like application shell. Retain the Plate Full of Yum identity and Asha's authorship.

Proposed design tokens:

| Token | Value / use |
| --- | --- |
| Canvas | Warm ivory `#FAF8F3` |
| Surface | White `#FFFFFF`; alternate pale oat `#F1EEE6` |
| Text | Charcoal `#252A25` |
| Secondary text | Muted dark grey `#5D655B` |
| Primary action | Deep olive `#46543C` with white text |
| Secondary accent | Terracotta `#995A42`, sparingly |
| Borders | Warm grey `#DADDD2` |
| Headings | Self-hosted Fraunces, limited weights, Georgia fallback |
| Body | Self-hosted Inter, limited weights, system sans-serif fallback |
| Reading size | 18px body, approximately 1.65 line-height; 60-70 character prose measure |
| Shape | 8-12px corners; thin borders; minimal shadows; no pill-shaped container everywhere |

Check actual combinations for WCAG AA contrast; pale borders are not the sole control affordance. Ship licensed font subsets with `font-display: swap`; no external font request required.

Layout decisions:

- Container maximum approximately 1200px. Desktop header approximately 76px; mobile approximately 64px. Logo/wordmark, Recipes, Balanced Bites, About Asha, and search; mobile uses an accessible menu rather than a huge stacked masthead.
- Home: one featured editorial recipe with photograph, brief invitation to cook, category shortcuts, latest recipes grid, wellness feature, and compact author introduction. No autoplay carousel or repeated full article excerpts. Do not label a list 'popular' without a defensible data source; curated selections are 'From Asha's kitchen'.
- Discovery: `/recipes/` offers title/ingredient search and category filters over a generated public index. Category archives remain real linked HTML, so browsing works without search JavaScript. Search enhancements announce result counts and distinguish empty query, no matches, and load failure. Do not invent dietary/health labels from ingredient guesses.
- Recipe above the fold: breadcrumbs, category, title, concise description, author/date, actual rating summary if present, time/yield, Jump to recipe, Print, and a prominent image. No fabricated five-star defaults or dead rating buttons. Use a compact metadata group; mobile stacks without horizontal scrolling.
- Article body remains in editorial order; do not move all prose below the card automatically. Jump links give immediate access to the card. Image crops are presentation-only and do not rewrite source assets.
- Recipe card: soft surface, clear title/times, ingredient checkboxes, grouped ingredients where supplied, numbered instructions, notes, and nutrition when available. Desktop can place ingredients beside instructions; mobile is one column. Checkboxes are per-page local interaction and reset on document navigation; no account or persistence service.
- End of article: brief author panel, related recipes based on actual taxonomy, and reader comments. Legal/privacy choices and feed links live in the footer.
- At approximately 768px switch to single-column recipe layout; home cards use one, two, or three columns as available width permits. Test 320px, 390px, 768px, and 1440px viewports rather than relying only on breakpoints.

Accessibility: semantic landmarks and headings, labelled native inputs, visible keyboard focus, skip link, approximately 44px touch targets, reduced-motion support, meaningful image alternatives, accessible errors, and no hover-only controls. All recipe text, images, ingredient lists, and method are readable without JavaScript. Printing includes the complete recipe and source URL but excludes navigation, comments, and nonessential editorial content. Browser-native printing remains available without JavaScript.

Do not add serving multiplication or unit conversion while quantities are free text. These controls would falsely imply reliable calculations.

### 4. Media remains in WordPress

Use WordPress-generated sizes with `srcset`, `sizes`, width/height, and stable aspect ratios. Main visible recipe image loads eagerly; below-fold pictures lazy-load. Do not request the full original for every thumbnail. Missing optional imagery gets an intentional text-led card, not a broken image; required recipe images fail recipe validation.

After CMS relocation, new frontend image URLs use the CMS media origin. Preserve old `/wp-content/uploads/...` URLs through explicit path-preserving redirects to that origin, without an open redirect or a broad redirect of frontend recipe paths. Verify indexing and Pinterest/social sharing. Avoid a paid image-transformation service and copying the entire library into each deployment.

Alternative: build-time optimized image copies provide greater origin independence but increase storage/build quotas and content synchronization work. Not needed for this launch.

### 5. Approved comments are build-time snapshots

Read approved public comments through WordPress's core `wp/v2/comments` API during snapshot retrieval. Include only sanitized public author name, date, text, parent relationship, and stable identity; never export email, IP address, or private moderation data. The generated page renders the approved thread as a labeled static snapshot and provides a deliberate empty state.

Do not add live browser refresh or guest-submission controls in this change. WordPress remains the source of truth and moderator; comment changes appear in the static site after an operator-triggered build. A separate future change may add live reads or guest submissions through an authorized endpoint with its own security and moderation acceptance.

### 6. GitHub Actions builds and publishes target-specific artifacts

GitHub Actions owns source validation and deployment. Pull requests run checks without deployment secrets or public previews. Main-branch pushes and manual invocations build from the current public WordPress content; the workflow does not rely on WordPress dispatches or writes.

For each deployment run:

1. Serialize the release lane and check out the selected main revision.
2. Install locked dependencies and retrieve a complete uncached public snapshot. Do not restore prior generated content from cache.
3. Validate source pagination, relationships, content-derived revision, public eligibility, paths, route/asset manifest, and generated indexes. A changed content fingerprint between full source passes fails the build.
4. Generate target-specific static artifacts from the same complete validated snapshot: a GitHub Pages development artifact with the repository base path and a Cloudflare production artifact with root-based public URLs.
5. Publish the development artifact to GitHub Pages and verify base-path assets and routes.
6. Deploy the production artifact to Cloudflare Workers Static Assets using pinned Wrangler tooling; request the deployed home page and require a successful response with nonempty content.
7. Do not deploy to Cloudflare if build validation or GitHub Pages development publishing fails. A pre-release failure leaves the prior complete Cloudflare release active. No WordPress acknowledgement endpoint is involved.

The deployment environment and required credentials are configured in GitHub. Pull-request and fork jobs receive no deploy credentials. A workflow rerun fetches current content and rebuilds instead of replaying a stale artifact.

### 7. Free hosting and static routes

Default: Cloudflare Workers Static Assets on the Free plan, serving generated files directly without required request-time application execution. Use static redirects/headers for legacy media mapping, HTML revalidation, and security headers where supported. Return real 404 responses; do not use an SPA fallback for unknown URLs.

Set HTML and non-fingerprinted discovery/index data to revalidate; fingerprinted application assets can have long immutable caching. Do not add a service worker, stale HTML cache rule, or public historical preview. Custom-domain DNS cutover is outside this change; Cloudflare acceptance can use its assigned deployment URL.

Fallback: Cloudflare Pages Free Direct Upload from the same production-root artifact generated for Workers. It is operator-selected and not automatic failover. For Pages, `PFOY_PUBLIC_SITE_ORIGIN` may use the exact Cloudflare-assigned `<subdomain>.pages.dev` host for the selected Pages project before a custom domain is attached; custom-domain setup is independent and may happen later. Reject unrelated `pages.dev` hosts. Before public upload, confirm the project production branch is `main`, the configured origin matches its assigned project host or an active custom domain, and preview/historical deployment URLs are protected (for example with Cloudflare Access); these protections require account-level verification. Verify equivalent 404, redirects, cache behavior, and removal semantics before selecting it.

GitHub Actions and hosting must remain within configured free entitlements. Set blocking spending controls; do not use paid runners, automatic upgrades, or provider switching. Quota exhaustion blocks publication visibly. WordPress/media and domain costs remain separate.

### 8. Public identity and future migration boundary

Preserve configured public permalink paths, anchors, canonical metadata, RSS, sitemap, and legacy media behavior in generated output. Do not change WordPress hosting, CMS hostname, or public DNS in this change. A later authorized migration must inventory redirects/media paths, make CMS HTML nonindexable while leaving public media reachable, and verify the custom-domain cutover separately.


## Risks / Trade-offs

- [Static removal delay] -> A removed item disappears only after a successful complete rebuild and deployment; no immediate takedown guarantee is made.
- [Public API inconsistency] -> Repeat full source projection before output and fail closed on changed fingerprints or incomplete dependencies.
- [Card integrity] -> Fail invalid recipe card markers, types, and post associations; ordinary cardless posts remain importable as articles.
- [Public recipe plugin APIs may expose orphaned records independently] -> Export recipes only when linked to a matching public parent. Removing a frontend page does not revoke media or unrelated public API routes.
- [Comment snapshot staleness] -> Label comments as a build-time snapshot; live refresh and submissions are out of scope.
- [Free-tier exhaustion] -> Use standard runners, blocking spend controls, and visible failed/pending deployment status; do not promise future provider pricing.
- [Old deployments/rollbacks can resurrect unpublished content] -> A rerun always rebuilds from current WordPress public content and does not replay an old content artifact.
- [Concurrent deployments] -> Serialize the full release lane and deploy only the artifact built by the current run.

## Migration Plan

1. Configure GitHub repository environments, spending limits, and securely stored Cloudflare deployment credentials.
2. Confirm public WordPress/Create endpoints and authored SEO sources; use public reads only.
3. Build and verify the static artifact locally against representative public recipes, editorial articles, and approved comment snapshots.
4. Publish a development build to GitHub Pages and verify project-base routing and generated outputs.
5. Deploy the production-root artifact generated from the same validated snapshot to Cloudflare Workers Static Assets and request only its home page, requiring a successful response with nonempty content.
6. Keep the existing public WordPress domain and CMS configuration unchanged. Defer custom-domain cutover, publication hooks, live comment reads/submission, and staging lifecycle acceptance.

## Open Questions

These are owner configuration inputs, not unresolved architecture decisions:

- GitHub repository/account and visibility, Cloudflare account/project and deployment token, and the authorized GitHub Pages/Cloudflare test URLs are required for hosted acceptance.
- Public-domain DNS cutover, CMS hostname migration, WordPress publication dispatch/acknowledgement, and live comment features require separate scope and authorization.
- Final logo asset and exact font weights/crops can be approved during visual review without changing the interaction design.

## Reference Sources

- SvelteKit static generation: https://svelte.dev/docs/kit/adapter-static
- GitHub free usage: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare platform direction: https://developers.cloudflare.com/pages/
- Static asset billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Versioned asset deployment: https://developers.cloudflare.com/workers/static-assets/direct-upload/
- Pages fallback deployment: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Google recipe structured data: https://developers.google.com/search/docs/appearance/structured-data/recipe
