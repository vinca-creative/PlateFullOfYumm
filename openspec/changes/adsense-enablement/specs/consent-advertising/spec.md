# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit global advertising enablement
Advertising SHALL remain disabled unless complete valid public configuration is explicitly enabled. When disabled, the site SHALL make no CMP, advertising script, auction, tracking, slot, or seller-authorization requests or output. Static content and cooking controls SHALL remain usable in either state.

#### Scenario: Advertising disabled
- **WHEN** advertising is globally disabled and a visitor previously granted advertising consent
- **THEN** no CMP or advertising request is made, no ad slot is rendered, and `/ads.txt` is not emitted

#### Scenario: Incomplete configuration
- **WHEN** advertising is enabled without the publisher-bound CMP URL, publisher/slot IDs, approved privacy URL, or matching seller authorization
- **THEN** the enabled build fails rather than publishing partially configured ads

#### Scenario: Advertising enabled without permission
- **WHEN** advertising is enabled but valid applicable permission has not been established
- **THEN** no advertising request is made

### Requirement: Restrained manual article placements
Eligible recipe/article pages SHALL contain at most two configured manual ad slots. The second slot SHALL require a documented deterministic long-article threshold. Slots SHALL remain outside ingredients, instructions, and cooking controls. Auto ads, popups, sticky placements, and timer-based refresh SHALL be disabled.

#### Scenario: Short article
- **WHEN** an article does not meet the configured long-article threshold
- **THEN** it contains at most one manual ad slot, away from recipe ingredients, steps, and controls

#### Scenario: Long article boundary
- **WHEN** an eligible article meets the long-article threshold
- **THEN** it may contain a second slot after the recipe and separated from the first slot by substantive editorial prose, but never a third

#### Scenario: Ineligible page or content
- **WHEN** a page is not eligible editorial/recipe content or is a legal page
- **THEN** it contains no ad slot

#### Scenario: Reader using recipe controls
- **WHEN** advertisements are shown while a reader uses ingredients or method steps
- **THEN** no slot interrupts, overlays, sticks to, or replaces cooking content or controls

### Requirement: Certified frontend consent flow
Enabled advertising SHALL use Google's certified Funding Choices CMP configured for the public hostname and applicable TCF/GPP requirements. First visit, decline, absent, denied, expired, unreadable, unavailable, or insufficient permission SHALL prevent advertising requests, including non-personalized requests. Visitors SHALL be able to reopen persistent privacy controls and revoke permission.

#### Scenario: First visit before choice
- **WHEN** a visitor has not made an applicable consent choice
- **THEN** consent choices are presented and no advertising request is made

#### Scenario: Decline choice
- **WHEN** a visitor declines applicable advertising permission
- **THEN** article access remains unchanged and no advertising request is made

#### Scenario: Permission granted
- **WHEN** the CMP establishes the required valid TCF permission and a known, non-opted-out applicable GPP status
- **THEN** only configured eligible slots may request advertisements

#### Scenario: Consent integration unavailable
- **WHEN** the CMP or applicable consent signal is unavailable, invalid, or unknown
- **THEN** advertising remains unloaded while static content remains usable

#### Scenario: Regional opt-out
- **WHEN** an applicable GPP signal indicates an opt-out or Global Privacy Control, or its applicable status cannot be determined
- **THEN** no advertising request is made

### Requirement: Revocable advertising permission
Privacy controls SHALL remain accessible after a choice. Revocation SHALL prevent further advertising requests in the current document and later navigation, and remove active ad presentation without blocking content. Completed prior requests SHALL not be represented as undone.

#### Scenario: Revoking prior permission
- **WHEN** a visitor revokes previously granted permission
- **THEN** no further ad requests are initiated, current ad presentation is removed, and later article navigation remains ad-free unless valid permission is granted again

### Requirement: Stable content with unavailable ads
Configured slots SHALL reserve appropriate geometry before advertising loads so successful ad loading does not move recipe text or controls. Ad blocking, no-fill responses, consent denial, and ad-service failure SHALL not hide content, trap focus, or prevent reading, navigation, printing, or cooking interactions.

#### Scenario: Successful ad fill
- **WHEN** an eligible reserved slot receives an advertisement
- **THEN** surrounding recipe text and controls retain their positions

#### Scenario: Blocked or failed advertisement
- **WHEN** an ad blocker, no-fill response, or service error prevents an advertisement from appearing
- **THEN** the article remains readable and cooking controls remain operable without an access demand

#### Scenario: Printed recipe
- **WHEN** a reader prints a recipe
- **THEN** advertisements and reserved ad presentations are excluded from print output

### Requirement: Once-per-document slot lifecycle
Each eligible slot SHALL be initialized at most once per document, and article-to-article navigation SHALL load a full new document. The frontend SHALL not refresh ads on a timer, ingredient changes, comment refresh, or other local interaction.

#### Scenario: Repeated interaction
- **WHEN** a reader changes ingredient checkboxes or refreshes comments after ads initialize
- **THEN** initialized slots are not requested or initialized again

#### Scenario: Article navigation
- **WHEN** a reader follows a link to another article
- **THEN** navigation creates a new document whose advertising remains subject to its own eligibility and consent checks

### Requirement: Authentic seller authorization
When advertising is enabled, the public origin SHALL serve a plaintext `/ads.txt` containing the actual configured AdSense account authorization. Placeholder publisher identifiers or unrelated seller entries SHALL not be accepted for an advertising-enabled release.

#### Scenario: Authorized advertising release
- **WHEN** advertising is enabled for release
- **THEN** requesting `/ads.txt` returns HTTP 200 and `text/plain` content with the actual account's required seller entry

#### Scenario: Missing account configuration
- **WHEN** advertising is requested but the actual seller authorization is unavailable
- **THEN** advertising cannot be enabled using placeholder authorization
