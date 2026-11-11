# Tasks
 
## Current implementation and blockers

The GitHub Pages and production build steps now pass the supplied publisher and first-slot IDs, forward `PFOY_ADS_CMP_URL`, `PFOY_ADS_PRIVACY_URL`, and `PFOY_ADS_SELLER_LINE` as public build values, and explicitly set `VITE_ADS_ENABLED=false`. No credentials are added. The owner has not supplied/verified those three values, confirmed AdSense domain approval, or authorized a staging hostname. Consequently task 1.1 and the acceptance portions of 1.2–1.3 remain unchecked; ads remain disabled on both builds.

Local advertising unit tests and type checks pass, but a complete snapshot is absent, so static build/`ads.txt` output and rendered slots have not been exercised. No authorized hostname or browser/network/account evidence is available; tasks 2.1–3.4 remain unchecked pending those prerequisites.

## 1. Owner configuration and build wiring

- [ ] 1.1 Obtain the account-generated Funding Choices URL bound to `ca-pub-3611846975019947`, the approved HTTPS privacy-policy URL, and verify the matching Google DIRECT seller entry for `platefullofyum.com`; confirm the domain is approved in AdSense and CMP policy settings cover its audiences.
- [ ] 1.2 Wire the supplied publisher ID (`ca-pub-3611846975019947`) and slot ID (`9535700852`), plus verified owner-provided CMP/privacy/seller values, into the intended GitHub build environments without adding account credentials to public variables or source.
- [ ] 1.3 Keep ads disabled by default; enable only the authorized development/staging build after every required public value validates, and preserve disabled production configuration until owner approval.

## 2. Configuration and generated authorization

- [ ] 2.1 Verify disabled builds make no CMP/AdSense request, render no slots, and omit `/ads.txt`, including when prior consent is stored.
- [ ] 2.2 Verify enabled builds reject missing, malformed, or mismatched CMP, publisher, slot, privacy, and seller values; verify generated `/ads.txt` is HTTP 200 plaintext with the verified seller line.
- [ ] 2.3 Verify the configured publisher and slot IDs produce only eligible manual slots and preserve the documented long-article threshold and placement boundaries.

## 3. Consent and browser acceptance

- [ ] 3.1 On an authorized test hostname, verify first visit, accept, decline, expired/invalid state, CMP failure, reopening privacy choices, and revocation; prove no ad request occurs before valid permission.
- [ ] 3.2 Verify applicable TCF consent requirements and GPP/US opt-out, GPC, unknown, and unavailable states fail closed; test consent updates stop new requests and remove current ad presentation.
- [ ] 3.3 On mobile and desktop, verify slot count/position, lazy and once-per-document initialization, full-document article navigation, blocked/no-fill layout stability, and exclusion of ads from print.
- [ ] 3.4 Record actual browser/network evidence and host responses; enable production ads only after owner review and successful account/browser acceptance.
