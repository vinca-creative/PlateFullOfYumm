# Design

## Context

See `proposal.md` for motivation. The frontend already contains disabled-by-default advertising configuration and consent-aware UI in `src/lib/advertising.ts`, `src/lib/config.ts`, `src/lib/components/Advertising.svelte`, and `src/lib/components/AdSlot.svelte`. `vite.config.ts` conditionally generates plaintext `build/ads.txt`. The deployment workflow builds GitHub Pages development output and Cloudflare production output, but neither build currently receives `VITE_ADS_*` values. Account-specific Funding Choices, approved privacy-policy, and verified seller-line values remain unavailable.

The owner supplied publisher `pub-3611846975019947`, first slot `9535700852`, and hostname `platefullofyum.com`. Runtime validation expects `ca-pub-3611846975019947`. No second slot is required. The owner has not supplied the account-generated CMP URL, approved privacy URL, or verified seller line, so the enabled release must remain blocked.

## Goals / Non-Goals

**Goals:**
- Configure advertising only through explicit build-time public variables and keep all builds disabled when the owner has not completed setup.
- Preserve the existing TCF/GPP fail-closed consent flow, manual placement bounds, full-document navigation, print exclusion, and conditional `/ads.txt` behavior.
- Separate development and production values through the current GitHub Pages and Cloudflare build steps; do not add credentials to browser-visible variables.
- Verify configuration and user-visible behavior on an authorized host before enabling production delivery.

**Non-Goals:**
- No Auto ads, new ad network, automatic placement, overlay, sticky ad, refresh timer, or consent bypass.
- No changes to recipe/frontend launch, WordPress content publication, or Cloudflare account setup beyond the environment values needed by the existing build.
- No claim of account approval, legal compliance, or live delivery based on local tests.

## Decisions

### Supply account settings as public build configuration

Use the existing `VITE_ADS_*` configuration contract. Publisher IDs, slot IDs, CMP URL, privacy-policy URL, and seller line are public browser/build configuration; never place Google account credentials or API tokens in `VITE_` variables. Wire the values to both build steps using GitHub environment variables. Leave `VITE_ADS_ENABLED` false or unset by default; only the intended approved build may set it to `true` after complete values are configured. A missing or malformed required value makes an enabled build fail closed.

The supplied publisher and first-slot IDs are used as given after converting the publisher to the config's required `ca-pub-` form. Configure a second slot only if the owner later supplies a distinct real slot ID. The hostname must be the verified public hostname, not an assumed approval.

### Retain Google Funding Choices as consent owner

Use the account-generated Funding Choices URL bound to the configured publisher. The CMP configuration for the public hostname must enable applicable TCF v2.2 and GPP/US privacy signals. The frontend continues to delegate persistent consent and revocation to Google Funding Choices. Under GDPR, requests require valid TCF consent for the configured purposes and Google vendor. Applicable GPP US status must be known and non-opted-out; unknown, unavailable, or opted-out status blocks requests.

### Keep placements bounded and document-scoped

Use existing manually configured slots only. Preserve the deterministic 1,200-word eligibility threshold for a second slot, its position after the recipe and separated by substantive prose, lazy visibility-gated initialization, no more than one initialization per document, and full-document article navigation. Do not enable automatic placements. Ads and reserved slots remain excluded from printing; blocked, denied, and no-fill states do not hide recipe content.

### Generate seller authorization only for the enabled build

Build `/ads.txt` from the verified seller line matching the configured publisher. Disabled builds omit the file. The owner-supplied publisher ID suggests the entry format `google.com, pub-3611846975019947, DIRECT, f08c47fec0942fa0`; confirm it against the AdSense account before using it. Do not treat a constructed candidate as verified authorization.

### Stage activation and prove behavior before production

First test a fully configured but owner-authorized development/staging host. Exercise first visit, accept, decline, revoked and invalid/expired consent, CMP failure, GPP opt-out/unknown, ad request gating, slot fill/no-fill, navigation, and print behavior at mobile and desktop widths. Confirm disabled builds emit no CMP or AdSense requests and no `/ads.txt`; confirm enabled builds serve correct plaintext `/ads.txt`. Enable production only after the account and browser acceptance passes.

## Risks / Trade-offs

- **Incomplete owner inputs:** The CMP URL, approved privacy URL, and verified seller entry are still required; advertising remains disabled until supplied and checked.
- **Public configuration:** All `VITE_` values are visible to visitors. This is suitable only for public IDs/URLs and never for credentials.
- **Deployment separation:** An environment variable wired to the wrong build could publish ads to the wrong host. Keep values scoped to the intended environment and verify each deployed hostname.
- **Consent integration drift:** Google may change Funding Choices APIs or regional requirements. Verify the live CMP behavior and current account settings rather than relying only on local test doubles.
- **Ad-service variance:** No-fill, blockers, and delayed consent can affect slot presentation. Keep reserved geometry conservative and verify real mobile/desktop rendering.
