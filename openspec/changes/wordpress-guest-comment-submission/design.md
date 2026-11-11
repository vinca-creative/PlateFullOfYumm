# Design

## Context

See `proposal.md` for scope. Public content generation and build-time approved comment snapshots work without the helper plugin. The repository contains an optional plugin endpoint at `POST /wp-json/pfoy/v1/comments` and a Svelte form in `CommentSnapshot.svelte`; the public site has not been verified to expose the route. Existing local behavior is not staging acceptance.

## Goals / Non-Goals

**Goals:**

- Keep WordPress as the only comment store and moderator.
- Keep the static approved-comment snapshot usable when all browser enhancements fail.
- Make server-side eligibility, abuse checks, and native moderation authoritative.
- Keep public client feedback accurate when comments are pending or a request outcome is unknown.

**Non-Goals:**

- Do not add a separate comment database, anonymous approval, or privileged account/comment actions.
- Do not make public content import or Cloudflare static delivery depend on the plugin.
- Do not enable or test anonymous comment writes on production as part of implementation acceptance.

## Decisions

### 1. Use a narrow WordPress write endpoint

Reuse the plugin's dedicated comment endpoint rather than enabling anonymous writes on the general WordPress REST API. Accept only post ID, optional parent ID, name, email, comment text, and challenge token. Validate types and bounds, check the target post is currently public and comments are open, and require any reply parent to be approved and belong to the same post. Reject unsupported fields rather than silently accepting approval or identity overrides.

Use WordPress's native `wp_new_comment` pipeline so existing moderation, spam filtering, and site policy remain authoritative. Return only an accepted flag and a coarse visibility status (`pending_review`, `approved`, or `not_public`); never echo comment content, email, user identity, or internal moderation fields.

### 2. Fail closed on abuse checks

Verify a free Cloudflare Turnstile proof server-side, matching the configured hostname and `comment` action. Keep the Turnstile secret in protected WordPress configuration and expose only the public site key to the browser. Apply a bounded server-side rate limit before creating a comment. Missing configuration, invalid proof, verifier errors, and rate limits all reject without insertion.

CORS grants only the exact configured frontend origin and does not allow credentials. CORS is not an authorization or abuse-control mechanism; endpoint validation applies regardless of request origin. WordPress or its hosting/proxy stack may retain request IP metadata even if the plugin does not log the raw IP; document and assess that retention for the site.

### 3. Decouple submission UI from fresh reads

The form uses the static snapshot's post ID, comment-open state, and approved parent IDs. The endpoint rechecks current visibility, comment-open state, and parent validity at submission time, so stale HTML cannot authorize a write. Do not require a live comment-read endpoint to render or submit the form. A pending submission is never inserted optimistically into the approved thread; approved comment updates appear after normal moderation and a later static rebuild.

Keep draft values after rejected or uncertain outcomes. Use explicit pending-review, accepted-public, rejected, and unknown-outcome messages. A network timeout is not proof that WordPress rejected the write; direct the reader to check before retrying rather than claiming success or silently resubmitting.

### 4. Staging-only end-to-end acceptance

Install the plugin on an owner-authorized staging WordPress site. Configure the exact frontend origin, Turnstile site key, server secret, and expected hostname in their proper locations. Verify valid pending submissions and moderation, challenge and rate-limit rejection, closed/nonpublic posts, invalid reply parents, CORS, private-field omission, and frontend feedback. Do not create production test comments without explicit owner authorization.

## Risks / Trade-offs

- WordPress/core or hosting layers may retain request IP metadata; disclose retention and avoid claiming otherwise.
- A comment can close or its parent can be removed after the static page is built; server validation rejects the stale form submission.
- The plugin endpoint is not available on the public site according to the recorded probe. Staging installation and end-to-end acceptance remain external prerequisites.
- Static snapshots do not immediately reflect new approvals; moderation changes appear after a complete content build and deployment.
