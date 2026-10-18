# Agent Guide

## Technology stack

- Svelte 5 with SvelteKit 3 and TypeScript 6.
- Vite 8 for development and builds; `@sveltejs/adapter-static` 4 writes the prerendered site to `build/`.
- Node.js 22.17 or newer and npm. Exact dependency versions are pinned in `package.json` and `package-lock.json`.
- WordPress core REST provides public posts, pages, approved comments, embedded media, and taxonomy; Create provides recipe-card data through `mv-create/v1`. Public snapshot import does not require the helper plugin, classification fields, or authenticated requests.
- The target publishing path is GitHub Actions to Cloudflare Workers Static Assets, with Cloudflare Pages Direct Upload as an operator-selected fallback. Advertising is disabled by default.

Use server-side rendering during prerendering. Do not add a SPA fallback: unknown paths must remain real HTTP 404s. Public settings use `VITE_` variables and are browser-visible; never put credentials in them. Build-only credentials must use server-side environment variables without the `VITE_` prefix.

## Solution structure

### Implemented

- `src/routes/`: snapshot-backed home, recipe/article permalink and category pages, recipe index, search data, sitemap/RSS, global shell, and real not-found surface.
- `src/lib/components/`: responsive masthead, native Create recipe card, and accessible comment snapshot, fresh-read, and guest-submission UI.
- `src/lib/server/content.ts` and `recipe-projection.ts`: required snapshot loading/validation, explicit permalink/category route enumeration, and minimal browse/search projections.
  

- `src/lib/config.ts`: public frontend configuration.
- `src/lib/content/types.ts`: typed public-content snapshot contract.
- `src/lib/content/validate.ts`, `normalize.ts`, and `wordpress-api.ts`: strict snapshot validation, paginated direct WordPress/Create retrieval with two-pass revision checks, safe HTML normalization, and single-card placeholder replacement.
- `src/app.html`: SvelteKit document template.
- `scripts/fetch-content.ts` and `scripts/publication.ts`: complete snapshot fetch, fail-closed source-revision checks, signed acknowledgement, release identity marker and smoke-check commands; workflow classification stays in `scripts/deploy-failure-code.sh`; writes to ignored `content-snapshot/`.
- `scripts/deploy-*.sh`: build, cleanup, headers, configuration checks, Cloudflare deployment and Pages verification helpers invoked by the production workflow; deployment shell logic stays in scripts rather than workflow YAML.
- `tests/content.test.mjs`, `tests/wordpress-api.test.mjs`, `tests/fetch-content.test.mjs`, and `tests/publication.test.mjs`: normalization safety, direct REST mapping/integrity, atomic snapshot ingestion, and deterministic publication-status/signature protocol tests.
- `wordpress/platefullofyum-headless/`: optional WordPress helper plugin for guest-comment submission, fail-closed revision tracking/dispatch retry, HMAC deployment status, and optional SEO/classification REST fields; installation/compatibility notes.
- `.github/workflows/`, `.github/workflows/_headers`, and `wrangler.jsonc`: secret-free PR validation and serialized revision-checked Workers Static Assets deploy workflow. Workflow execution, credentials, free-plan limits, and production hosting remain unverified.
- `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`: build, type-check, and pinned dependency setup.
- `.env.example`: public origins and the build-only WordPress REST API root; it contains no credentials.
- `.gitignore`: excludes dependencies, build output, local environment files, and generated snapshots.
- `openspec/changes/launch-static-recipe-frontend/`: proposal, design, capability specs, and implementation checklist.

### Remaining integration blockers

- Comment snapshots import from public WordPress core REST; fresh-comment UI and guest submission use the optional helper plugin. Exact-origin CORS, Turnstile site/server keys, and an authorized staging moderation cycle still require operator configuration and verification. Never use production for comment testing.
- `static/` is reserved for owner-provided licensed local fonts and approved brand artwork; no such assets are currently supplied.
- A build with `VITE_ADS_ENABLED=true` intentionally fails. No CMP, ad slots, publisher authorization, privacy policy, or `ads.txt` is configured.
- The WordPress plugin and production workflow implement fail-closed monotonic revisions, scoped dispatch/retry, source checks, signed run-bound acknowledgement and post-deploy smoke checks. Publishing remains disabled until owner-provided WordPress constants, GitHub variables/secrets, a real host cron, Cloudflare account/domain routing, and the exact installed Create-card storage hook are configured and verified; no live dispatch or deployment was exercised.
- Public reads currently need no authentication or private helper routes. No production-candidate snapshot or complete permalink inventory is available; real-content recipe/article, print, and migration acceptance remain blocked.

Keep WordPress-specific retrieval outside Svelte components. Generate all routes and derived discovery files from one complete, revision-consistent public snapshot. The importer paginates core post/page endpoints, resolves Create cards, validates a second uncached pass, and fails without writing partial output. Never include unpublished content or secrets in generated browser assets.

## Local development

Prerequisites: Node.js 22.17+ and npm. From the repository root:

```sh
npm ci
npm run check
npm run test:content
npm run check:php
```

These validation commands do not need a content snapshot.

`VITE_` values are public, including the CMS origin. Set `PFOY_WORDPRESS_API_ROOT` to the WordPress `/wp-json/` root; configure `VITE_PUBLIC_SITE_ORIGIN` and `VITE_CMS_ORIGIN` to the public-site and REST-source origins. Public content reads do not use an authenticated link. The importer treats a post with a valid linked Create recipe card as a recipe and an ordinary cardless post as an article; a malformed Create marker/card remains an error. Never put secrets in `.env.example` or any `VITE_` variable.

Build and preview the static application:

```sh
npm run content:snapshot
npm run dev
npm run build
npm run preview
```

Snapshot generation needs public WordPress core and Create REST data, not the helper plugin or content-classification metadata; without a valid snapshot, route prerendering fails rather than producing an empty site. `build/` is the portable static output and requires no request-time application server. Verify routes and true 404 behavior against the selected static host; a local preview does not prove host routing or removal behavior.


## OpenSpec implementation workflow

This repository uses the `spec-driven` OpenSpec workflow. Before implementation:

1. Find the active change with `openspec list --json`; inspect `openspec status --change "<name>" --json`.
2. Read the apply skill at `.agents/skills/openspec-apply-change/SKILL.md` and run `openspec instructions apply --change "<name>" --json`.
3. Read every file listed in `contextFiles` (proposal, design, specs, and tasks). Treat the CLI's task state and source line as authoritative.
4. Implement one pending task at a time. Confirm its checkbox still matches, keep the change within the specification, and do not mark it complete until its behavior is implemented and verified.
5. Mark that exact task complete, rerun the apply instructions, and confirm the progress changed before moving on. Pause on missing external authorization, unavailable source data, or a requirement that cannot be verified; leave such tasks unchecked and record the blocker.

Useful commands:

```sh
openspec list --json
openspec status --change "launch-static-recipe-frontend" --json
openspec instructions apply --change "launch-static-recipe-frontend" --json
```

Do not archive an in-progress change. Archive only after the implementation and its verification are complete, following `.agents/skills/openspec-archive-change/SKILL.md`.

## Hosting and integration guardrails

- Target free static hosting only. No automatic paid upgrades, public draft previews, public historical content previews, or SPA fallback.
- Pull-request checks must not receive production deployment secrets or publish public previews.
- WordPress remains authoritative for content and comments. Do not submit production comments or perform production cutover without explicit owner authorization.
- A successful removal means a complete build and release that excludes the removed content; a failed build leaves the prior deployment live and removal pending.
- Advertising remains off until the real publisher account, slot configuration, consent setup, privacy requirements, and seller authorization are supplied and verified.
