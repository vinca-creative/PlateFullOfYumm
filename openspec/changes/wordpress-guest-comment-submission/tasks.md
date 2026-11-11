# Tasks

## 1. WordPress guest-submission endpoint

- [ ] 1.1 Review the existing narrow comment endpoint against the new contract; accept only documented fields and reject privileged/unknown fields, malformed values, invalid parent IDs, and over-limit inputs.
- [ ] 1.2 Verify live post visibility, password protection, comments-open status, and approved same-post reply parents at write time; insert only through WordPress's native moderation pipeline.
- [ ] 1.3 Enforce server-side Turnstile verification, expected hostname/action, and rate limits; ensure missing secrets, invalid tokens, verifier outages, and rate limits fail closed without creating comments.
- [ ] 1.4 Enforce exact-origin CORS without credentials; verify public responses omit email, IP address, author identity, moderation data, challenge tokens, and secrets, while documenting possible WordPress/host IP retention.
- [ ] 1.5 Add deterministic endpoint tests for accepted pending comments and rejection boundaries, including privileged fields, invalid reply parents, closed/nonpublic posts, challenge failures, and rate limits.

## 2. Frontend submission experience

- [ ] 2.1 Implement the accessible guest comment/reply form using the static comment snapshot; do not require a live comment-read endpoint to render or submit.
- [ ] 2.2 Provide distinct pending-review, accepted-public, validation, challenge, rate-limit, closed/unavailable, and unknown-outcome feedback; retain drafts after rejection or uncertainty and never insert pending comments into the approved thread.
- [ ] 2.3 Verify keyboard and screen-reader operation, reply navigation, challenge unavailable/expired behavior, and continued snapshot readability with JavaScript or the endpoint unavailable.

## 3. Owner configuration and documentation

- [ ] 3.1 Document plugin installation/activation, exact `PFOY_PUBLIC_ORIGIN`, server-only Turnstile secret and expected hostname, public frontend site key, and secure storage boundaries.
- [ ] 3.2 Document moderation, uncertain-outcome recovery, IP retention considerations, and that guest submissions are optional and do not affect static content builds or deployments.

## 4. Authorized staging acceptance

- [ ] 4.1 On an owner-authorized WordPress staging site, verify exact-origin CORS and valid pending submission followed by native moderation; verify accepted, pending, and nonpublic outcomes.
- [ ] 4.2 Verify challenge rejection/service failure, rate limiting, invalid/privileged input, same-post approved replies, closed discussions, and nonpublic posts create no unauthorized comments.
- [ ] 4.3 Record staging endpoint, configuration, moderation result, and browser/network evidence. Do not submit production test comments or install the plugin on production without separate explicit authorization.

## External acceptance prerequisites

- **4.1–4.3:** An owner-authorized staging WordPress site with the helper plugin installed, exact frontend origin configured, Turnstile test site/secret/hostname provisioned securely, and an authorized moderator are required. The public helper route previously returned HTTP 404; public production behavior remains unverified.
