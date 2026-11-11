# Tasks

## 1. Repository and static application foundation

- [x] 1.1 Initialize the Svelte 5/TypeScript SvelteKit application, pin compatible versions and lockfile, configure `adapter-static`, server-side prerendering, trailing slashes, and a real not-found page; verify a local production build serves complete HTML and an unknown URL returns HTTP 404 without a SPA fallback.
- [x] 1.2 Add scoped configuration for public and CMS origins, build-only secrets, and `build/` output; ignore generated snapshots/assets and verify no secrets or generated content are committed or emitted to the browser bundle.
- [x] 1.3 Document local prerequisites, free-plan boundaries, optional helper-plugin roles as deferred functionality, build commands, and host-independent output; verify public snapshot and build commands with a valid public-source snapshot.

## 2. WordPress publishing contract and content integrity

- [x] 2.1 Build a direct public-content importer using WordPress `wp/v2` posts/pages/media/taxonomy APIs and Create `mv-create/v1` cards; preserve explicit public-only eligibility, stable IDs/paths, completeness metadata, and a content-derived revision including paginated public categories and tags with `hide_empty=false`; verify every eligible record and public taxonomy term is included once and drafts/private/scheduled/trashed/password-protected posts and private fields are excluded.
- [x] 2.2 Normalize linked Create card data through its supported REST route, preserving grouped original ingredients, instructions, times, notes, nutrition, source-backed ratings, and images; treat a post with a valid `type=recipe` card and matching post association as a recipe, and export a cardless post as an editorial article without requiring editor classification; invalid card markers/types/associations fail with named blocking errors.
- [x] 2.3 Expose responsive image variants/alt text and authored SEO fields from optional `pfoy_seo`, other supported core REST fields, or public canonical page head; do not require `pfoy/v1` or helper-plugin installation for public content import. Verify variant selection, authored SEO values, optional defaults, and actionable errors when authored metadata cannot be recovered.
- [x] 2.4 Implement build-time retrieval, content-shape validation, complete pagination and revision checks, safe semantic body normalization, single native card replacement, and correct public/CMS URL mapping; verify mixed revisions, broken references, script/unsafe links, and missing source pages fail without publishing partial output.
- [x] 2.5 Document the card-based recipe detection and cardless-article fallback, including that ordinary cardless posts do not block public import and may be corrected in WordPress later; verify malformed Create card type/post associations still block and public SEO fidelity is preserved.

## 3. Cookbook frontend and discovery

- [x] 3.1 Implement the warm editorial design system, self-hosted fonts, compact responsive masthead/mobile menu, home feature, recipe and article layouts, category archives, about/footer and legal/privacy navigation; visually verify 320px, 390px, 768px and 1440px viewports, contrast, keyboard navigation and no horizontal page overflow.
- [x] 3.2 Render sanitized editorial body in its authored order with responsive WordPress photography, faithful Create recipe cards, actual rating summaries, native ingredient checkboxes, jump/step anchors, and print styles; verify a long recipe with JavaScript disabled, keyboard cooking, authored values unchanged, and a multipage print with no clipped steps.
- [x] 3.3 Generate explicit entries for all public pages, categories, and linked tag archives, including zero-count terms from complete public taxonomy retrieval; match SEO/social metadata and source-backed JSON-LD, sitemap, RSS, and a local public-only recipe search index; verify archive membership, empty archive routes and sitemap URLs, initial HTML and crawler-visible schema against source data, no fabricated recipe/rating data, working taxonomy browsing without JS, and search result/empty/failure states.
- [x] 3.4 Preserve valid public slugs, trailing slashes, author/editorial identity and legacy fragments; add explicit redirects for obsolete utility URLs and confirmed renamed permalinks; verify direct recipe/category/tag/feed links, recipe and comment anchors, renamed-route redirect, genuinely absent paths returning HTTP 404, and no indiscriminate homepage redirects.
- [x] 3.5 Document design tokens, available editor-controlled fields, recipe and article rendering expectations, accessibility checks, and SEO data provenance; verify the guidance against one card recipe and one editorial article.

## 4. Build-time comment snapshots

- [x] 4.1 Export approved threaded comments and build-time counts for eligible public posts only, with bounded pagination, sanitized public author/text/date data, and no emails/IPs; verify an approved parent/reply pair appears in static HTML, pending/removed records do not, and an empty discussion renders deliberately.
- [x] 4.2 Render only the approved build-time comment snapshot; remove live reads, guest submission, and challenge-service requests while retaining the threaded snapshot and explicit empty state. Verified from static HTML with JavaScript unavailable and a real HTTP 404 for an unknown route.

## 5. GitHub-to-Cloudflare static publishing

- [x] 5.1 Configure pull-request checks without deployment secrets or public previews, plus serialized main-branch and manual workflows that retrieve current public WordPress content.
- [x] 5.2 Generate a clean complete static artifact from one validated source revision; verify route/asset manifests, no secrets or private content, and rejection of incomplete or changing snapshots before deployment.
- [x] 5.3 Publish the main-branch development build to GitHub Pages; verify project-base asset URLs, internal links, authored WordPress links, canonical URLs, `/search.json`, and real 404 responses.
- [ ] 5.4 Deploy the production-root artifact generated from the same validated source snapshot to Cloudflare Workers Static Assets using pinned Wrangler; verify a failed build or GitHub Pages deployment prevents Cloudflare deployment, and a failed deployment leaves the prior complete Cloudflare release active.
- [ ] 5.5 Configure free static delivery with real 404 handling, HTML/index revalidation, secure headers, legacy media mapping, no public historical previews, and no stale offline page cache; verify direct static responses and artifact/free-plan limits.
- [ ] 5.6 Implement a documented operator-selected Cloudflare Pages Free Direct Upload fallback using the same production-root artifact; verify a disposable fallback environment reproduces routes, removal, 404, redirects, caching, and protected historical preview behavior without automatic failover or paid services.
- [ ] 5.7 Document GitHub repository/environment settings, Cloudflare token handling, spending controls/private-repository allowance, failed-release visibility, rollback by rebuilding current content, and manual rebuild recovery; verify no secrets appear in logs.

## 6. Deployment acceptance (without public cutover)

- [ ] 6.1 Perform visual and accessibility review on actual GitHub Pages and Cloudflare deployment URLs; verify real photography, readable typography, keyboard operation, no-JavaScript recipe access, structured data, public-domain-style internal links, and actual 404 responses.
- [ ] 6.2 Exercise content changes by running a fresh build after public WordPress content changes; verify generated HTML, search, sitemap, and RSS update together, and a removed page disappears from the next complete deployment.
- [x] 6.3 Document deployment/run identity, content revision, build and release outcomes, safe recovery, Search Console follow-up, and the boundary that static removal cannot retract previously downloaded or third-party-cached copies.

## Remaining external acceptance prerequisites

- **5.2 verified locally:** `npm run content:snapshot` fetched 105 public records at revision `26f2cb56074544eaf386e921014c6d78cec3af0cbbfd94e695751c27a0728b0e` using `--no-network-family-autoselection` on this IPv6-unreachable network. `npm run test:content` passed (56/56); `npm run check` passed with one pre-existing unused CSS warning. Production-root and GitHub Pages artifacts each audited 333 routes and 357 assets from the same retrieved snapshot; private-field/secret and stale-snapshot rejection checks passed.
- **5.4–5.7 remain externally unverified:** repository variables include `CLOUDFLARE_ACCOUNT_ID` and `PFOY_PUBLIC_SITE_ORIGIN` only; `PFOY_WORDPRESS_API_ROOT`, `PFOY_CMS_ORIGIN`, and `PFOY_PAGES_PROJECT_NAME` are absent. The protected `prod` `CLOUDFLARE_API_TOKEN` secret exists, but no deploy was authorized. The configured origin `https://4b5f982f.platefullofyum.pages.dev/` serves a Smoke Article and canonicalizes to `https://platefullofyum.com/`; it is not a verified Workers production origin. Worker routing, Pages preview protections, billing controls, and account limits remain unverified. Remote `main` still has an older deployment workflow with WordPress acknowledgement callbacks; local changes have not been pushed. The production job awaiting environment approval was not approved or rerun. Operator guidance is documented in `README.md`; hosted settings, failure/rollback behavior, fallback environment, and secret-free deployment logs remain to be verified.
- **5.3 verified 2026-11-02 on the existing main-branch Pages deployment:** deployment job succeeded; project-base paths/assets, canonical URLs, WordPress-hosted media, `/search.json` (HTTP 200), and a missing-route HTTP 404 were observed.
- **6.1–6.2:** Authorized GitHub Pages and Cloudflare deployment URLs plus representative current public content are required. Public-domain DNS cutover, CMS hostname migration, WordPress publication hooks, live comment reads/submission, and production transition acceptance are explicitly outside this change.
