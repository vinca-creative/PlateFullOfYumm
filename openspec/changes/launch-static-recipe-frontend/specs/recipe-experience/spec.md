# Spec Delta

## Purpose

Give readers an accessible, calm, photography-led recipe experience with complete static content, usable cooking controls, and preserved discovery and search-engine entry points.

## ADDED Requirements

### Requirement: Complete static public pages
Public home, category, recipe, and editorial pages SHALL deliver complete meaningful HTML without client-side data retrieval. Recipe text, ingredients, instructions, images, metadata, and the approved comment snapshot SHALL remain readable with JavaScript disabled or enhancement requests unavailable.

#### Scenario: No JavaScript
- **WHEN** a reader opens a recipe with JavaScript disabled
- **THEN** the article, complete recipe, navigation links, and approved comment snapshot are present and usable without a loading shell

#### Scenario: Enhancement failure
- **WHEN** search or live-comment enhancement fails
- **THEN** static article and recipe content remain available and the affected enhancement displays its own clear state

### Requirement: Preserved public routes and anchors
The frontend SHALL preserve existing public permalink paths, trailing-slash conventions, and supported public in-page anchors. Public links and canonical URLs SHALL use the public origin. Missing or removed routes SHALL return HTTP 404, not a successful application shell.

#### Scenario: Existing recipe deep link
- **WHEN** a reader requests an existing permalink with its recipe or article anchor
- **THEN** the matching content is available at the preserved path and the anchor reaches the corresponding section

#### Scenario: Unknown or removed path
- **WHEN** a reader requests a nonexistent path or a post removed by a successful rebuild
- **THEN** the server returns HTTP 404 with a useful not-found page and public navigation

### Requirement: Minimalist responsive editorial layout
The frontend SHALL present a compact masthead, warm neutral surfaces, olive accents, serif headings, readable body typography, and responsive photography. Navigation, article content, and recipe controls SHALL remain legible and operable on narrow mobile and wide desktop viewports without horizontal page scrolling.

#### Scenario: Narrow mobile recipe
- **WHEN** a reader opens a recipe at a 320 CSS-pixel viewport
- **THEN** its text, images, ingredients, instructions, and controls fit the viewport without clipped content or horizontal page scrolling

#### Scenario: Wide desktop recipe
- **WHEN** a reader opens the same recipe on a wide desktop viewport
- **THEN** the layout preserves readable text width and photography prominence without crowding the cooking content

### Requirement: Accessible cooking interactions
Recipe pages SHALL provide a jump-to-recipe link, ingredient checkboxes, and a print action with accessible names, visible keyboard focus, and keyboard operation. Ingredient state SHALL not alter authored quantities or instructions. Pages SHALL not offer unsupported serving conversion, unit conversion, or rating-submission controls.

#### Scenario: Keyboard cooking workflow
- **WHEN** a keyboard user follows jump-to-recipe and toggles an ingredient checkbox
- **THEN** the recipe is reached, focus is visible, the checkbox state is conveyed accessibly, and recipe quantities remain unchanged

#### Scenario: Existing rating summary
- **WHEN** the source supplies a real aggregate rating
- **THEN** the page displays that summary without presenting a new rating-submission interaction

#### Scenario: Browser-native use without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the recipe anchor and ingredient checkboxes remain usable and browser printing remains available

### Requirement: Uncluttered recipe printing
Printed recipe output SHALL include the recipe title, authored ingredients and instructions, and relevant recipe notes while excluding navigation, advertisements, interactive controls, and live comment forms. Printing SHALL preserve readable ordering and avoid clipping recipe content.

#### Scenario: Printing a long recipe
- **WHEN** a reader prints a multi-page recipe
- **THEN** all ingredients, steps, and relevant notes appear in reading order without advertisements or clipped text

### Requirement: Static discovery and local search
Home and category pages SHALL link to published public content. JavaScript-enhanced search SHALL query a public-only local index without a paid search service and expose loading, results, no-results, and failure states. Discovery SHALL exclude content removed by a successful rebuild.

#### Scenario: Matching search
- **WHEN** a reader searches for an indexed recipe title
- **THEN** the results link to the matching public recipe without a request-time content service

#### Scenario: Empty or unmatched search
- **WHEN** the search query is empty or has no matches
- **THEN** the interface distinguishes the initial search state from a completed no-results state

#### Scenario: Search unavailable
- **WHEN** JavaScript is disabled or the local index fails to load
- **THEN** the interface explains search availability and retains working home and category navigation

### Requirement: Search and social metadata fidelity
Public pages SHALL include their exported SEO title, description, canonical, robots, and social metadata in initial HTML. Recipe pages SHALL include source-backed Recipe structured data consistent with the visible card. Editorial articles SHALL not emit invented Recipe structured data.

#### Scenario: Recipe crawler request
- **WHEN** a crawler retrieves a recipe without executing JavaScript
- **THEN** it receives the configured metadata and Recipe structured data matching the visible recipe, including ratings or nutrition only when supplied

#### Scenario: Editorial article crawler request
- **WHEN** a crawler retrieves an editorial article
- **THEN** it receives the article's metadata without fabricated recipe properties

### Requirement: Published discovery feeds
The sitemap and RSS feed SHALL contain only eligible published public URLs on the public origin and reflect the current successful snapshot. Sitemap entries SHALL honor indexability directives. No draft, CMS-origin duplicate, or historical deployment URL SHALL appear in public discovery outputs.

#### Scenario: Successful removal rebuild
- **WHEN** a public post becomes ineligible and the removal release succeeds
- **THEN** its URL disappears from home and category listings, local search, sitemap, and RSS

#### Scenario: Public noindex article
- **WHEN** a public article has an editorial noindex directive
- **THEN** its HTML retains that directive and its URL is excluded from the sitemap
