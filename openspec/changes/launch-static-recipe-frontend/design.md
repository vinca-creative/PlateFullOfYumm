# Design

## Context

See `proposal.md` for motivation and scope. The repository contains only OpenSpec tooling; there are no application conventions or existing main specifications to migrate. This design is required because the change spans WordPress, a new frontend, external advertising, and two deployment platforms.

Read-only exploration of the live site established:

- WordPress reports 87 published posts, 78 containing Create cards. A post with a valid linked Create `type=recipe` card is a recipe; a published post without a Create card is an editorial article. Cardless posts do not block public import and can be corrected in WordPress later. Invalid Create markers/cards still fail integrity validation.
- Post 1084 (`/banana-bread/`) references Create card 82. Both `/wp-json/mv-create/v1/creations/82` and its `/json_ld` endpoint return structured public data. WordPress media exports responsive variants; approved comments expose parent relationships.
- Ingredient quantities are currently free-text: the sampled card has `original_text` values but null numeric amount/unit fields. Nutrition serving count and display yield also need faithful, editorially reviewed mapping.
- Yoast metadata appears in public HTML, but the sampled REST response omits `yoast_head_json` and `yoast/v1/get_head` returns `rest_no_route`. The design cannot depend on that route becoming available without integration work.
- The current mobile masthead delays the recipe content. Create, theme, Site Kit, and consent scripts currently operate within WordPress; moving article HTML does not move their behavior.

The latest user decisions are GitHub source control, GitHub Actions builds and deployments, free Cloudflare hosting with a free alternative, no draft previews, removal through rebuilding, and card-based recipe detection with article fallback for posts without cards.

## Goals / Non-Goals

**Goals:**

- Keep page delivery independent of WordPress PHP; only external pictures and live comments depend on the CMS at browsing time.
- Preserve a single editorial source while generating consistent readable HTML and search metadata.
- Make publication state observable: desired content revision, last deployed revision, and failure/pending status must not imply a removal succeeded before deployment.
- Give the owner a small, auditable integration rather than a second CMS or a generic rendering framework.
- Make static output host-portable and explicitly bounded by free-tier entitlements.

**Non-Goals:**

- No request-time recipe SSR, draft preview routes, account system, new ratings database, automatic ingredient conversion, or offline/PWA page cache.
- No rewriting WordPress themes, importing their frontend bundles, or implementing a general Gutenberg page builder in Svelte.
- No automatic provider failover or assumption that already-public content can be erased from third-party caches.

## Decisions

### 1. One static frontend and one WordPress integration

Use Svelte 5, the current stable compatible SvelteKit release, TypeScript, and `@sveltejs/adapter-static`. Keep server rendering enabled during prerendering; do not set `ssr = false`. Enumerate all public route entries from the content snapshot instead of relying only on link crawling. Use trailing slashes matching the existing site and a genuine static 404 page, with no SPA catch-all.

Proposed implementation locations (new files, not existing conventions):

| Location | Responsibility |
| --- | --- |
| `src/routes/` | Home, recipe/article permalinks, category archives, recipe discovery, about/legal pages, error page |
| `src/lib/components/` | Header, recipe preview, recipe card, ingredient list, comment thread/form, consent-aware ad slot |
| `src/lib/content/` | Typed published-content contract and page-model helpers |
| `scripts/` | Snapshot retrieval, integrity checks, route generation, publishing checks |
| `wordpress/platefullofyum-headless/` | Small installable plugin: guest comment submissions, publication notifications, and deployment status/revision lifecycle |
| `.github/workflows/` | Validation and production build/deploy workflow |
| `static/` | Local fonts, brand assets, robots/ads authorization assets |
| `wrangler.jsonc` | Workers Static Assets configuration pointing to generated `build/` |

Generated snapshots and `build/` are ignored output, not a content mirror committed to Git. Pin dependencies using a lockfile. Use plain component CSS and shared design tokens rather than a large UI kit. A typed content boundary is warranted; a provider abstraction framework is not.

Alternative rejected: a browser-only WordPress client, because recipes and metadata would depend on client execution. Hybrid SSR adds runtime coupling without a requirement for immediate publication or preview.

### 2. Direct public WordPress REST and Create APIs

Use the public WordPress API root to discover standard `wp/v2` posts, pages, taxonomy, and media endpoints, approved public `wp/v2/comments`, plus Create's `mv-create/v1/creations/{id}` endpoint for card data. The build MUST NOT depend on `pfoy/v1` routes or require the helper plugin for public-content import. Public reads require no credentials. Never embed WordPress admin credentials or Application Passwords in the frontend or snapshot fetch configuration.

Treat a published post with a linked Create card as a recipe only when the card record declares `type=recipe` and its canonical post association matches. Invalid marker/card type, missing or conflicting card records, or mismatched post association fail the snapshot; malformed embedded recipe content MUST NOT be downgraded to an article. A published post without a Create card is exported as an editorial article, without requiring `pfoy_content_kind`; cardless exceptions may be corrected in WordPress later and do not block import. Pages retain their core page identity.

`pfoy_seo` MAY be exposed by the helper plugin as an optional REST field populated from supported Yoast metadata; it is not required for import. Read authored SEO values from it when present, other supported core REST SEO fields, or the public canonical page head. During the current WordPress-hosted phase, page-head parsing is a valid source; after CMS migration, missing REST SEO fields may be supplemented by whatever public SEO source is configured, but authored metadata MUST NOT be silently discarded.

The importer reads `wp/v2/posts` and `wp/v2/pages` with `status=publish`, `context=view`, `per_page=100`, and `_embed=1`; it follows `X-WP-TotalPages` and uses embedded author, taxonomy, and featured-media data. For each recipe post, it extracts and validates the linked Create card ID from rendered content, fetches that card from `mv-create/v1/creations/{id}`, and requires `type=recipe` plus a matching canonical post relationship. Missing, conflicting, or invalid card references fail the whole snapshot. Posts without cards are editorial articles; editorial content remains from `content.rendered`, and a valid card region is replaced with one native recipe placeholder after sanitization.

Create card IDs, original ingredient text/order/groups, instruction HTML order, source-backed nutrition/rating, timing values, and card image data are normalized to the existing public content contract. WordPress REST embedded media supplies responsive featured-image URLs, dimensions, and alt text. Approved public comments are readable through `wp/v2/comments`; guest comment submission is separate and uses the helper plugin's narrow endpoint. Read authored SEO values from `pfoy_seo` when present or another supported core REST SEO field; public canonical page-head parsing is also a valid current source.

The importer computes a SHA-256 revision over the canonical projection of all normalized posts, pages, cards, taxonomies, media references, and SEO values. It performs a second complete uncached source pass before writing output and rejects any changed fingerprint, missing page, mismatched totals, duplicate ID/path, or invalid dependency. This is more network work than a revision endpoint but gives the current public APIs a conservative stable-snapshot boundary. A failed or incomplete pass never replaces the previous snapshot.

At build time:

1. Discover and validate the public API origin; request only published public posts/pages without caching.
2. Follow all WordPress pagination, embedded public dependencies, approved public comment reads, and linked Create card requests; enforce bounded concurrency, timeouts, and response-size limits.
3. Validate recipe card markers and card/post relationships, canonical paths, image metadata, and exported SEO fields. Do not require editor classification for cardless posts.
4. Normalize canonical public URLs separately from CMS/media URLs using parsed origins and explicit mappings.
5. Sanitize rendered HTML, preserve semantic editorial order and safe anchors/links/images, and replace exactly one matching valid Create embed with a native card reference; export cardless posts as articles.
6. Repeat the complete source projection and compare its fingerprint; reject mixed or partial content.
7. Atomically write a new ignored snapshot only after all validation succeeds; leave the last complete snapshot untouched on failure.

The old `GET /wp-json/pfoy/v1/content` export route is removed from the planned architecture. The helper plugin supports this application's guest comment submissions and WordPress publication notification/revision/dispatch/acknowledgement lifecycle; public posts, pages, taxonomy, media, authors, approved comments, and Create card data are read directly from their public REST APIs.

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

Accessibility: semantic landmarks and headings, labelled native inputs, visible keyboard focus, skip link, approximately 44px touch targets, reduced-motion support, meaningful image alternatives, accessible errors, and no hover-only controls. All recipe text, images, ingredient lists, and method are readable without JavaScript. Printing includes the complete recipe and source URL but excludes navigation, comments, ads, and nonessential editorial content. Browser-native printing remains available without JavaScript.

Do not add serving multiplication or unit conversion while quantities are free text. These controls would falsely imply reliable calculations.

### 4. Media remains in WordPress

Use WordPress-generated sizes with `srcset`, `sizes`, width/height, and stable aspect ratios. Main visible recipe image loads eagerly; below-fold pictures lazy-load. Do not request the full original for every thumbnail. Missing optional imagery gets an intentional text-led card, not a broken image; required recipe images fail recipe validation.

After CMS relocation, new frontend image URLs use the CMS media origin. Preserve old `/wp-content/uploads/...` URLs through explicit path-preserving redirects to that origin, without an open redirect or a broad redirect of frontend recipe paths. Verify indexing and Pinterest/social sharing. Avoid a paid image-transformation service and copying the entire library into each deployment.

Alternative: build-time optimized image copies provide greater origin independence but increase storage/build quotas and content synchronization work. Not needed for this launch.

### 5. Comments stay entirely in WordPress

Choose direct browser calls to the WordPress plugin's narrow comment endpoint. This keeps Cloudflare page delivery fully static and avoids a required cloud runtime quota. Set an exact public-origin CORS allowlist, omit cross-origin WordPress login cookies, and use server-side validation; CORS is not authentication or abuse protection.

The static page includes an approved-thread snapshot and comment count. A client enhancement refreshes the first page, supports explicit pagination/replies, and replaces stale results rather than appending duplicate IDs. Thread pagination includes the approved context needed to interpret replies; hidden parent content is never exposed. When the API is unavailable, retain the snapshot with a refresh-unavailable message. A successful fresh empty response clears old comments. The form provides pending, success, validation, moderation, closed, and unavailable states; it never claims an unapproved comment is public.

Guest submission accepts only post ID, optional parent ID, name, email, comment text, and challenge token. Validate lengths/types, published/public eligibility, comment-open status, and parent membership in the same visible post. Ignore/reject client fields that attempt to assign approval, author identity, or moderation roles. Validate a free Cloudflare Turnstile token server-side, including expected site/action where supported, and apply bounded server-side rate limits. Invoke WordPress's native comment insertion/moderation/spam pipeline; do not insert directly into tables or submit comments as an administrator. Email is private, excluded from public output and logs. Use no third-party avatar request by default.

Approvals, visible edits, spam/trash transitions, deletions, and count changes advance the public revision and rebuild snapshots. A new pending comment does not itself trigger a rebuild. Live reads refresh between deployments, but server HTML reflects the last successful build. A nonpublic parent post immediately rejects API reads/writes even if its old static page is awaiting removal.

WordPress itself blocks anonymous core REST comment creation by default; the purpose-specific endpoint deliberately implements guest access without globally enabling anonymous writes to unrelated REST routes. Existing Create rating summaries are exported, not turned into a new rating submission feature.

### 6. Advertising and consent are frontend responsibilities

Use manual AdSense placements, not Auto ads. Make advertising globally configurable: disabled means no AdSense loader or slot requests. Configure actual publisher and slot IDs privately during setup where appropriate; publisher IDs themselves are public, but no admin credential is ever exposed. Serve the account's verified seller line as plain `/ads.txt`; do not confuse Site Kit's platform account with the publisher account.

Placement policy: at most two slots on eligible article/recipe pages. First after substantive introductory prose, never immediately beside Jump/Print controls. A second is allowed only after the recipe where at least two substantial editorial paragraphs separate it from the first; short pages use fewer or no slots. No slots inside ingredient/instruction sequences, search controls, comment controls, legal pages, or the print view. Label external ad containers 'Advertisements'. No sticky anchors, vignettes, overlays, or timer/scroll-based refresh.

Reserve responsive slot geometry using supported AdSense sizing; never crop a creative with CSS. Define placement eligibility before rendering to avoid a post-load layout insertion. Consent-delayed, blocked, filled, and unfilled slots must not push already visible recipe text unexpectedly; do not collapse an in-view reserved area abruptly.

Use Google's certified Privacy & messaging CMP as the proposed initial provider, following its prescribed tag setup and the then-current TCF requirements. Keep the integration boundary limited to obtaining valid consent state, not a hand-written replacement CMP. Establish required permissions before ad requests; where permission is absent, request no ads. Non-personalized advertising is not a consent bypass. Provide persistent Privacy choices and handle revocation so future requests stop according to the provider's supported integration. Review applicable regional and US opt-out requirements during account setup. CMS consent settings alone do not govern the new public frontend.

Use full-document article navigation via SvelteKit link options so each page has a clean ad lifecycle. Keep Svelte enhancements within a page; initialize a slot at most once per document after permission and visible sizing. Never request ads during prerendering, prefetching, or unrelated reactive updates. Do not claim advertisements are visually themeable editorial cards: only their surrounding space/label is controlled.

### 7. GitHub Actions owns the complete publishing lifecycle

No Cloudflare Builds or Cloudflare Git build integration. GitHub stores the application, plugin, lockfile, and deployment configuration. Use standard Linux GitHub-hosted runners. Pull requests validate/build without production credentials or production deployment; they do not create public preview sites. Production workflow exists on the default branch and runs on push to main, a narrow `repository_dispatch` event type, and `workflow_dispatch`.

WordPress keeps a monotonic public content revision in its database plus desired/deployed revision and last workflow outcome. Advance the revision on changes affecting public output: public publish/update/removal, actual scheduled publication, password/visibility changes, associated card changes, relevant taxonomy/media/SEO changes, and approved-comment state changes. Ignore draft-only edits, autosaves, revisions, and pending comments. Use atomic revision updates, not a racy read/modify/write counter. Notifications happen after the content transaction is visible.

Dispatch sends only revision/event metadata, never content or draft details. Store a least-privilege repository-scoped GitHub credential in server configuration; it can create the chosen dispatch event but is not shipped to readers. Coalesce notifications, retain a dirty revision until acknowledged, and retry failed notifications using WordPress scheduled work. Configure a real hosting cron to drive WordPress scheduled events reliably; low visitor traffic must not stall scheduled publication or pending notification delivery.

Production sequence:

1. Serialize the entire fetch/build/release workflow in one production concurrency group; do not cancel an in-progress deployment mid-upload. Pending coalesced runs always fetch current content, not a content payload or historical snapshot from the triggering event.
2. Check out the current approved main branch, install locked dependencies, fetch a consistent snapshot, and validate content and routes. Do not restore a previous build directory or content snapshot from a cache; cache dependency downloads only.
3. Generate the complete static site, static search index, sitemap/feed, public metadata, 404 and host routing files. Check no secrets/drafts leaked and expected route/asset counts match the snapshot.
4. Recheck the public revision before release. A superseded snapshot is not released as current; ensure another run for the latest revision.
5. Deploy the complete asset version with pinned Wrangler tooling to Workers Static Assets. Use a single full rollout, not gradual traffic between content versions.
6. Smoke-check public HTML, selected assets, generated indexes, and removed routes. Acknowledge deployed revision and workflow result through the authenticated WordPress endpoint only after a successful release/check. Keep publication status honest if checks fail after an upload.
7. If content changes during deployment, leave desired revision ahead of deployed revision and ensure another run remains queued. Older acknowledgements must never reduce the recorded deployed revision. An old workflow rerun must rebuild current approved code/current content instead of replaying an old artifact.

Use HMAC-authenticated timestamped deployment callbacks with a narrow payload and replay protection. Bind success acknowledgements to the expected revision and deployment/run identity. GitHub Actions secrets hold the Cloudflare deployment token and callback secret; the account ID is configuration. WordPress holds the matching callback secret and dispatch credential. PR/fork runs receive no deployment secrets.

Failures retain the last complete deployment and show the reason in GitHub and the WordPress publication status. A removal waiting on a failed/blocked build remains marked pending; do not report it as removed. A manually runnable rebuild is the recovery mechanism. There is no promise of immediate removal or a fixed publication latency before measuring CI queue/build time.

### 8. Free hosting and fallback

Default: Cloudflare Workers Free with Static Assets pointing at `build/`. No Worker script is required for the selected direct-to-WordPress comments design. Serve assets directly; never configure `run_worker_first` for all page requests. Use static redirects/headers for media mapping, HTML revalidation, security headers, and 404 handling where supported.

Set HTML and non-fingerprinted discovery/index data to revalidate; fingerprinted application assets can have long immutable caching. Do not add a service worker or stale HTML cache rule. Disable public historical version-preview URLs; if the provider cannot meet that condition, use protected preview access or disable preview creation. The canonical public domain uses only the active production deployment. Already downloaded pages and third-party caches remain outside removal guarantees.

Fallback: Cloudflare Pages Free using a Direct Upload project from the same GitHub build output, with `wrangler pages deploy`. Only deployment/routing configuration changes; no content model or Svelte rewrite. Verify equivalent 404, redirects, cache behavior, public preview suppression, and removal semantics before a domain switch. This is an operator-chosen free alternative, not automated failover. Pages does not bypass Worker function quotas.

At review time static Worker asset requests and storage are free; free asset count/file-size limits still apply. GitHub standard runner execution is free for public repositories; private GitHub Free repositories have a shared included minutes/storage allowance. Set blocking spending controls, bounded artifact/cache retention, and no paid runner or automatic upgrade. Quota exhaustion blocks new builds and therefore can delay unpublishing; it does not justify surprise charges. WordPress/media/domain costs remain separate. Do not promise the provider's future pricing will stay unchanged.

### 9. Search identity and migration

Keep `https://platefullofyum.com` as the public identity and configure a separate CMS hostname. WordPress address/permalink configuration, export canonical rewriting, and callbacks must be verified together to avoid redirect loops. Do not globally change every CMS URL back to the frontend: media/API/admin URLs serve different purposes.

Inventory all published post/page/category URLs, legacy search/category landing pages, existing redirects, feeds, recipe/step/comment fragments, and image paths. Keep legitimate paths; map obsolete theme/plugin utility pages deliberately rather than rendering broken shortcode dashboards. No broad homepage redirects. Preserve public metadata, verification tags needed for Search Console/AdSense, crawler access, and RSS consumers. CMS HTML is noindexed while public media stays crawlable; protect administrative access and drafts with actual authentication, not robots directives.

## Risks / Trade-offs

- [Static removal delay] -> Trigger all public-state transitions, keep pending/deployed revision visible, and prove removal after deployment. A failed build intentionally keeps the last site live; urgent secrecy would require a separate immediate takedown capability not promised here.
- [Plugin compatibility] -> Pin/test the WordPress integration against the deployed Create/Yoast versions; validate its comment-submission and revision/dispatch behavior. Keep plugin-specific handling out of Svelte components.
- [Card integrity] -> Fail invalid recipe card markers, types, and post associations; ordinary cardless posts remain importable as articles and can be corrected later in WordPress.
- [Public recipe plugin APIs may expose orphaned records independently] -> Export recipes only when linked to a matching public parent. Review CMS route exposure before describing unpublishing as privacy protection; removing the frontend does not automatically revoke every plugin endpoint or media URL.
- [Comments/photographs depend on WordPress availability] -> Serve static recipe HTML regardless, preserve labelled comment snapshots on refresh failure, and document media-origin dependence rather than claiming full offline independence.
- [Free-tier exhaustion] -> No paid auto-upgrade, no paid image service, standard runners, dependency-only caches, and visible blocked publication state. Do not treat Pages as unlimited free dynamic compute.
- [Consent/ad code affects performance] -> Manual sparse placements, full-document article navigation, certified CMP setup, and real-browser filled/unfilled/declined/revoked testing; no ad revenue or rich-result guarantee.
- [Old deployments/rollbacks can resurrect unpublished content] -> Disable public historical previews and rebuild previous code against current published content; never blindly reactivate an old content artifact.
- [Concurrent content changes] -> Revision-bound exports and pre/post-release comparison; one release lane; retain dirty revision until a successful matching deployment.

## Migration Plan

1. Establish the GitHub repository and free Cloudflare project, owner-managed secrets, CMS hostname, and a nonpublic staging WordPress clone. Keep the existing public WordPress UI live.
2. Confirm public WordPress/Create endpoints and SEO sources; install the integration on staging for guest comment submissions and publication/revision hooks. Verify card associations and required pictures, and review SEO/nutrition mapping. Exercise real comment moderation and publication hooks on staging, not production.
3. Implement and browser-review the frontend against representative recipes/articles and existing media. Verify all key pages without JavaScript and at the target mobile/desktop widths.
4. Exercise the GitHub pipeline on protected staging: publish, update card-only, schedule, move to draft/private/trash, delete, republish, moderate comments, fail a content fetch, overlap changes with a build, and block a deployment. Check direct removed URLs, page data, indexes, feeds, real status codes, and publication status.
5. Configure the actual CMP/AdSense account and seller authorization; verify consent/no-consent/revocation, no ads in printing, no duplicate requests, and no significant slot-driven layout shifts. Review Search Console and recipe structured-data output before cutover.
6. Complete the URL/media redirect inventory, set public/CMS origin configuration, secure CMS HTML/admin and historical deployment access, then point the public domain to the verified static deployment.
7. Smoke-test the production domain's representative routes/media, 404, metadata, ads.txt, search, and comment API. Do not submit production test comments without explicit owner authorization. Watch the first real publish/unpublish transition end to end.
8. For code rollback, rebuild a previous known-good code revision against the current public-content revision and deploy through the same release checks. If frontend cutover fails fundamentally, restore the original WordPress public routing with current publication state; do not reintroduce old exported content.

## Open Questions

These are deployment inputs, not unresolved architectural choices:

- GitHub repository/account and visibility, Cloudflare account/zone, and CMS hostname are to be supplied/configured during implementation; free-limit enforcement covers either repository visibility.
- Final logo asset and exact font weights/crops can be approved during visual review without changing the interaction design.
- Actual AdSense publisher/slot identifiers, privacy policy wording, traffic-region obligations, and account readiness require owner access. No public inspection proves monetization approval or legal compliance.

## Reference Sources

- SvelteKit static generation: https://svelte.dev/docs/kit/adapter-static
- WordPress comment access: https://developer.wordpress.org/reference/hooks/rest_allow_anonymous_comments/
- GitHub external triggers: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch
- GitHub free usage: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare platform direction: https://developers.cloudflare.com/pages/
- Static asset billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Versioned asset deployment: https://developers.cloudflare.com/workers/static-assets/direct-upload/
- Pages fallback deployment: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Google recipe structured data: https://developers.google.com/search/docs/appearance/structured-data/recipe
- Google consent requirements: https://support.google.com/adsense/answer/13554116?hl=en
- Google ad placement: https://support.google.com/adsense/answer/1346295?hl=en
