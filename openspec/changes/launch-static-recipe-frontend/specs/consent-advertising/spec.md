# Spec Delta

## Purpose

Allow optional, restrained advertising that respects consent and protects the readability, stability, and usability of the public recipe experience.

## ADDED Requirements

### Requirement: Explicit global advertising enablement
Advertising SHALL be optional and controlled by explicit site configuration. When globally disabled, the frontend SHALL issue no advertising script, auction, tracking, or slot requests, regardless of stored consent. Static content and cooking controls SHALL remain available in either mode.

#### Scenario: Advertising disabled
- **WHEN** advertising is globally disabled and a visitor previously granted advertising consent
- **THEN** no advertising requests are made and the article and recipe remain fully usable

#### Scenario: Advertising enabled without permission
- **WHEN** advertising is enabled but permission has not been established
- **THEN** no advertising requests are made

### Requirement: Restrained manual article placements
Article pages SHALL contain at most two manually configured ad slots, with the second allowed only when the article meets a documented, deterministic long-article threshold. Ads SHALL remain outside ingredients, method steps, and cooking controls. Auto ads, popups, sticky advertisements, and timer-based refresh SHALL be disabled.

#### Scenario: Short article
- **WHEN** an article does not meet the configured long-article threshold
- **THEN** it contains at most one advertising slot outside the recipe's ingredients, steps, and controls

#### Scenario: Long article boundary
- **WHEN** an article reaches the configured long-article threshold
- **THEN** it is eligible for a second manually placed slot but never a third slot

#### Scenario: Reader using recipe controls
- **WHEN** advertisements are shown while a reader checks ingredients or reads a method step
- **THEN** no slot interrupts, overlays, sticks to, or replaces the cooking content or its controls

### Requirement: Certified frontend consent flow
Advertising SHALL use a Google-certified consent management platform on the public frontend and the current applicable TCF requirements. Visitors SHALL be able to decline advertising permission and reopen privacy controls to revoke it. Absent, denied, expired, unreadable, or insufficient permission SHALL prevent advertising requests, including non-personalized advertising requests.

#### Scenario: First visit before choice
- **WHEN** a visitor has not made an applicable consent choice
- **THEN** the frontend presents the consent choices without making advertising requests

#### Scenario: Decline choice
- **WHEN** a visitor declines advertising permission
- **THEN** article access remains unchanged and no advertising requests are made

#### Scenario: Permission granted
- **WHEN** advertising is enabled and the certified consent flow establishes the required valid permission
- **THEN** only the configured eligible slots can request advertisements

#### Scenario: Consent integration unavailable
- **WHEN** the consent platform fails or cannot establish valid permission
- **THEN** advertising stays unloaded while static content remains usable

### Requirement: Revocable advertising permission
Privacy controls SHALL remain accessible after a consent choice. Revocation SHALL prevent subsequent advertising requests in the current document and future navigation, and remove active ad presentation without blocking content. Requests already completed before revocation SHALL not be represented as undone.

#### Scenario: Revoking prior permission
- **WHEN** a visitor revokes previously granted advertising permission
- **THEN** no further ad requests are initiated, current ad presentation is removed, and later article navigation remains ad-free unless valid permission is granted again

### Requirement: Stable content with unavailable ads
Configured placements SHALL reserve appropriate geometry before advertising loads so successful ad loading does not move recipe text or controls. Ad blocking, no-fill responses, consent denial, and ad-service failure SHALL not hide content, trap focus, or prevent reading, navigation, printing, or cooking interactions.

#### Scenario: Successful ad fill
- **WHEN** an eligible reserved slot receives an advertisement
- **THEN** surrounding recipe text and controls retain their positions

#### Scenario: Blocked or failed advertisement
- **WHEN** an ad blocker, no-fill response, or service error prevents an advertisement from appearing
- **THEN** the article remains readable and cooking controls remain operable without an access demand

### Requirement: Once-per-document slot lifecycle
Each eligible slot SHALL be initialized at most once per document, and article-to-article navigation SHALL load a full new document. The frontend SHALL not refresh ads on a timer, ingredient changes, comment refresh, or other local interaction.

#### Scenario: Repeated interaction
- **WHEN** a reader changes ingredient checkboxes or refreshes comments after ads initialize
- **THEN** initialized slots are not requested or initialized again

#### Scenario: Article navigation
- **WHEN** a reader follows a link to another article
- **THEN** navigation creates a new document whose advertising remains subject to its own eligibility and consent checks

### Requirement: Authentic seller authorization
When advertising is enabled, the public origin SHALL serve a plaintext ads.txt containing the actual configured AdSense account authorization. Placeholder publisher identifiers or unrelated seller entries SHALL not be accepted for an advertising-enabled release.

#### Scenario: Authorized advertising release
- **WHEN** advertising is enabled for release
- **THEN** requesting /ads.txt returns HTTP 200 and text/plain content with the actual account's required seller entry

#### Scenario: Missing account configuration
- **WHEN** advertising is requested but the actual seller authorization is unavailable
- **THEN** advertising cannot be enabled using placeholder authorization
