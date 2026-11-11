# Spec Delta

## Purpose

Let readers submit guest comments and replies safely through WordPress moderation without adding a separate comment database or exposing privileged controls and credentials.

## ADDED Requirements

### Requirement: Narrow guest submission contract
The public submission endpoint SHALL accept only the public post identifier, optional reply parent, guest name, guest email, comment text, and anti-abuse proof. It SHALL reject unsupported or privileged fields and SHALL insert comments through WordPress's native moderation pipeline. The response SHALL distinguish acceptance from public approval without returning private comment data.

#### Scenario: Valid guest comment
- **WHEN** a guest submits valid fields for an eligible open discussion and passes abuse checks
- **THEN** WordPress records the comment under its native moderation policy and reports whether it is pending, approved, or otherwise not public

#### Scenario: Privileged field or identity override
- **WHEN** a request includes an approval state, user identity, capability, moderation field, or any unsupported field
- **THEN** the endpoint rejects the request without creating an impersonated or pre-approved comment

#### Scenario: Unsafe or invalid text
- **WHEN** submitted name, email, or comment content is malformed, over limit, or contains unsafe markup
- **THEN** the endpoint rejects or safely sanitizes it before WordPress stores it

### Requirement: Current public post and valid reply eligibility
Submission SHALL require a currently public, non-password-protected post or page with comments open. A reply SHALL reference an approved comment on the same post. Closed or nonpublic discussions SHALL reject writes without exposing private post or comment data.

#### Scenario: Closed or nonpublic post
- **WHEN** a post is closed to comments or is no longer publicly eligible
- **THEN** the submission is rejected and no comment is created

#### Scenario: Invalid reply parent
- **WHEN** a reply references an absent, unapproved, or different-post comment
- **THEN** the submission is rejected rather than attached to another discussion

### Requirement: Server-enforced abuse protection
Every guest submission SHALL include a free anti-abuse challenge verified server-side and SHALL be subject to a server-enforced rate limit. Invalid, expired, missing, or unverifiable proof SHALL create no comment; challenge-service failure SHALL fail closed.

#### Scenario: Challenge failure or service outage
- **WHEN** the challenge is missing, invalid, expired, mismatched, or cannot be verified
- **THEN** the endpoint rejects the submission without creating a comment

#### Scenario: Rate limit exceeded
- **WHEN** a client exceeds the configured submission limit
- **THEN** the endpoint rejects further submissions without creating comments

### Requirement: Narrow cross-origin access and private data
Browser submissions SHALL be permitted only from the configured exact public frontend origin and SHALL NOT require cross-origin WordPress login cookies. Public responses SHALL omit guest email, IP address, user identity, moderation-only fields, and secrets. Challenge verification credentials SHALL remain server-side.

#### Scenario: Allowed and unrelated origins
- **WHEN** the configured frontend or an unrelated browser origin submits a comment
- **THEN** only the configured frontend receives a cross-origin access grant, and server-side validation remains mandatory for every origin

#### Scenario: Private fields
- **WHEN** a submission succeeds or fails
- **THEN** its response and public comment representation do not expose guest email, IP address, privileged identity, or challenge credentials

### Requirement: Honest accessible submission feedback
The frontend SHALL distinguish pending review, approved/public, validation rejection, challenge failure, rate limiting, closed or unavailable discussions, and an uncertain network outcome. It SHALL retain the guest's draft after a rejected or failed request and SHALL NOT insert an unapproved comment into the public thread.

#### Scenario: Moderation pending
- **WHEN** WordPress accepts a comment for moderation
- **THEN** the frontend says it is pending review and does not present it as public

#### Scenario: Rejection or uncertain outcome
- **WHEN** validation fails or the browser cannot confirm the submission response
- **THEN** the frontend preserves the draft and reports rejection or uncertainty without falsely claiming publication

### Requirement: Static discussion remains available
The approved build-time comment snapshot SHALL remain readable when JavaScript, the submission endpoint, or the anti-abuse service is unavailable. Submission failure SHALL NOT remove, corrupt, or replace approved comments in the rendered thread.

#### Scenario: Enhancement unavailable
- **WHEN** the submission form cannot initialize or its request fails
- **THEN** approved static comments remain readable and the form reports that submission is unavailable
