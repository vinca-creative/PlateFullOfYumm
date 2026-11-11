# Proposal

## Why

The static content pipeline should not depend on a WordPress helper plugin, but readers may later need a safe way to submit comments. Isolate guest submission as an optional WordPress integration with explicit abuse prevention, moderation, and privacy acceptance.

## What Changes

- Add a guest comment/reply submission capability that records comments through WordPress's native moderation pipeline.
- Provide a narrow WordPress endpoint and accessible frontend submission form with honest pending, accepted, rejected, and unknown-outcome feedback.
- Require server-verified Turnstile proof, bounded rate limiting, exact-origin CORS, public-post/comment-open validation, and approved same-post reply parents.
- Keep secrets, guest email, IP addresses, and moderation-only fields out of public responses and browser configuration.
- Keep approved comment snapshots available if submission enhancements or the WordPress endpoint are unavailable.
- Move guest submission requirements out of the static content-generation and deployment change; plugin installation and authorized staging acceptance are optional prerequisites only for this feature.

## Capabilities

### New Capabilities

- `wordpress-comment-submission`: Secure guest comment/reply submissions through WordPress moderation, including abuse protection, privacy, and accessible response states.

### Modified Capabilities

None. The existing `wordpress-comments` capability remains responsible for approved snapshots; this change adds guest submission as a separate capability.

## Impact

- WordPress helper plugin endpoint and server-side configuration, plus the static frontend comment form and its submission feedback.
- Cloudflare Turnstile verification and site/secret configuration; Turnstile secrets remain only in WordPress server configuration.
- WordPress remains the only comment database and moderation authority. No separate comment store is introduced.
- Public comment snapshots remain readable without JavaScript and do not depend on this feature.
- Requires an owner-authorized WordPress staging site for CORS, anti-abuse, moderation, and end-to-end acceptance. No production comments or live installation are authorized by this proposal.
