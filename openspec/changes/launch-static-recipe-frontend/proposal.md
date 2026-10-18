# Proposal

## Why

Plate Full of Yum needs a fast, modern, minimalist recipe-reading experience without replacing the familiar WordPress editorial workflow. A prerendered Svelte 5 frontend can preserve recipe search visibility, photography, and WordPress comments while using GitHub Actions and free Cloudflare static hosting.

## What Changes

- Introduce Svelte 5 with SvelteKit and `adapter-static`; generate complete public recipe/article HTML, metadata, Recipe JSON-LD, category listings, a local search index, sitemap, and RSS feed.
- Keep WordPress and Create as the content source. A linked Create card is what identifies a recipe: its record must declare `type=recipe` and match the canonical WordPress post. Published posts without a Create card are exported as editorial articles, without requiring this repository's helper plugin or `pfoy_content_kind`; existing cardless exceptions can be corrected in WordPress later and do not block public import.
- Read public posts/pages, taxonomy, media, authors, and approved comments directly from WordPress `wp/v2` APIs, and card data from Create's `mv-create/v1/creations/{id}` API. Authored SEO metadata comes from `pfoy_seo` when present, other supported core REST SEO fields, or the public canonical page head. The helper plugin is not required for public content retrieval; it remains necessary for this application's guest comment submissions and WordPress revision/dispatch/acknowledgement lifecycle.
- Provide an editorial cookbook visual design: compact masthead, warm neutral surfaces, olive accents, serif headings, responsive photography, accessible recipe controls, ingredient checkboxes, uncluttered print output, and clear threaded comments.
- Add sparse, explicitly configured AdSense slots outside ingredients and method steps, with a Google-certified consent integration on the public frontend, stable slot geometry, and public `ads.txt`. Do not load WordPress theme scripts into the frontend.
- Store source and infrastructure configuration in GitHub. GitHub Actions builds from current published content on main-branch changes, WordPress dispatches, and manual invocation; deploy complete asset versions using Wrangler.
- Use Cloudflare Workers Static Assets on the Free plan. Keep the static artifact portable to Cloudflare Pages Free if required; never automatically enroll in paid hosting or paid overage. GitHub Actions must remain within free execution/storage entitlements.
- Remove unpublished, draft, private, trashed, deleted, and password-protected content from production output and derived indexes after a successful rebuild. Removed URLs return actual 404 responses. No draft previews or public historical deployment previews.
- Preserve the public domain, existing permalink shapes and anchors, SEO metadata, and legacy media reachability through a staged cutover. WordPress moves behind a distinct CMS origin without turning duplicate CMS HTML into an indexed second website.
- **BREAKING**: the WordPress theme ceases to be the public UI. Theme/plugin-injected frontend behavior is replaced by explicitly supported Svelte functionality; administrative editing remains in WordPress.

## Capabilities

### New Capabilities

- `wordpress-content`: Published-only content export and normalization, Create recipe data, responsive media, SEO fields, and integrity validation.
- `recipe-experience`: Responsive public pages, recipe discovery, accessible cooking/printing interactions, and preserved public URLs and search metadata.
- `wordpress-comments`: Approved threaded comment display, fresh reads, guest submissions, abuse controls, and WordPress-owned moderation.
- `consent-advertising`: Optional restrained AdSense placement, consent-aware loading, stable rendering, and seller authorization.
- `static-publishing`: GitHub-triggered complete builds, publication/removal lifecycle, safe deployment ordering, free Cloudflare delivery and fallback, and migration verification.

### Modified Capabilities

None. The project currently has no durable specifications or implemented frontend.

## Impact

- New frontend source, build tooling, static assets, GitHub Actions workflow, Wrangler configuration, and a narrowly scoped WordPress plugin maintained in this repository.
- External dependencies: existing WordPress/Create APIs and media; GitHub API and Actions; Cloudflare static hosting; AdSense and a certified CMP; a free server-validated anti-abuse challenge for comment submission.
- Credentials remain in WordPress server configuration or GitHub secrets, never browser bundles, generated content, source control, or public dispatch payloads.
- WordPress hosting and domain renewal are existing costs, not removed by this change. Static publication is eventually consistent: a failed or quota-blocked build leaves the last deployment live, including content awaiting removal.
- No new content database, request-time recipe SSR, draft preview service, automatic serving/unit conversion, new rating-submission system, paid image service, or automated provider failover. Existing real rating summaries are displayed; no unsupported rating controls are offered.
- Existing public inspection found 87 published posts, 78 with Create cards, working structured recipe/media/comment endpoints, and unavailable Yoast REST head output. Cardless posts are imported as editorial articles; invalid Create markers/cards remain blocking integrity errors. Exposing editorial SEO fields remains required. No production writes or deployment tests have been performed.
