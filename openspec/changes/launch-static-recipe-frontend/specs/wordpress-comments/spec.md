# Spec Delta

## MODIFIED Requirements

### Requirement: Readable static comment snapshot
Each eligible page SHALL contain its approved comment snapshot in initial HTML, labeled as a build-time snapshot rather than a guaranteed current view. Snapshot comments SHALL remain readable without JavaScript and remain the only comment experience in this static frontend change. The page SHALL show a deliberate empty-discussion state when the snapshot contains no approved comments.

#### Scenario: JavaScript unavailable
- **WHEN** a reader opens an article without JavaScript
- **THEN** its approved snapshot thread remains readable

#### Scenario: No approved comments
- **WHEN** the successful snapshot contains no approved comments
- **THEN** the page shows an explicit empty-discussion state

## REMOVED Requirements

### Requirement: Fresh paginated public reads

### Requirement: Guest submission contract

### Requirement: Eligible posts and valid reply parents

### Requirement: Server-enforced abuse protection

### Requirement: Narrow cross-origin access and privacy

### Requirement: Honest submission feedback

### Requirement: Moderation-driven snapshot updates
