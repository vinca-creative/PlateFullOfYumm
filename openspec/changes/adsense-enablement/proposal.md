# Proposal

## Why

The static frontend contains disabled-by-default consent-aware AdSense code, but actual publisher configuration and account/browser acceptance are not complete. Separate this opt-in monetization work from the frontend launch so it can be planned and released only after the owner supplies and verifies the required AdSense, Funding Choices, privacy, and seller-authorization details.

## What Changes

- Own the complete consent-aware AdSense lifecycle for `platefullofyum.com`: explicit configuration, publisher-bound Google Funding Choices, TCF/GPP permission checks, manual placements, and public seller authorization.
- Keep ads disabled unless complete, validated owner configuration is present; configure build-time ad values in the deployment workflow without exposing credentials.
- Validate disabled and enabled builds and exercise consent, revocation, slot behavior, print exclusion, and `/ads.txt` on an authorized host before enabling production ads.
- Keep the existing recipe frontend launch change independent of advertising scope. No Auto ads, automatic placements, overlays, refreshes, or new ad network.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `consent-advertising`: Extend the existing consent and placement contract with the validated AdSense account configuration and real-host enablement acceptance for `platefullofyum.com`.

## Impact

- Affects the existing consent/ad components, public build configuration and deployment environment, generated `/ads.txt`, setup documentation, and browser acceptance.
- Owner has supplied publisher ID `pub-3611846975019947`, first manual slot ID `9535700852`, and target hostname `platefullofyum.com`. The frontend config expects publisher ID `ca-pub-3611846975019947`; this is the same publisher identifier with the required `ca-` prefix.
- Still required before an enabled build: the account-generated Funding Choices URL for that publisher, approved public privacy-policy URL, and verified matching Google DIRECT seller line. Do not enable ads or weaken fail-closed checks until those are supplied and accepted.
- Ad identifiers and URLs are public build configuration, not secrets. Google account credentials and deployment tokens remain outside the browser bundle.
- No account setting changes, live deployments, or legal/account approval are implied by this proposal.
