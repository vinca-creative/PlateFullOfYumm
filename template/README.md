# Plate Full of Yum — Sage website

Complete editable static website: 111 HTML pages, CSS, JavaScript, recipe data and four local food photographs. No build tools or dependencies are required.

## Preview locally

1. Extract this ZIP.
2. Open a terminal inside the `website` folder.
3. Run `python3 -m http.server 8000` (Windows: `py -m http.server 8000`).
4. Visit http://localhost:8000 in your browser.

Use a local server rather than double-clicking HTML files: navigation uses root-relative URLs, and recipe search loads JSON with fetch.

## Files

- `website/index.html`: home page, including its original inline CSS and JavaScript.
- `website/assets/theme.css`: shared sage theme styles used by the other pages.
- `website/assets/pages.css`: recipe, About, category, index, print and mobile styles.
- `website/assets/pages.js`: recipe saving, ingredient checkboxes, printing and cooking view.
- `website/assets/recipes.json`: collection data for search and saved recipes.
- `website/<article-slug>/index.html`: 87 individual recipe and food article pages.
- `website/about-me/index.html`: About page.
- `website/recipe-search/index.html`: searchable recipe collection.
- `website/recipe-category/index.html`: category directory.
- `website/category/<category>/index.html`: category archives.
- `website/recipe-box/index.html`: saved recipes (browser local storage).
- `website/recipe-search-results/index.html`: search results.
- `website/assets/recipe*`: the four local home-page food images.

## Hosting or building on this design

Upload the contents of `website` to the root of a static web host. The host must serve directory index.html files. If hosting in a subdirectory instead, update root-relative links and asset URLs first.

HTML and CSS are plain files and can be adapted to your preferred framework or WordPress templates. This package is not an installable WordPress theme. Home-page styling is inline; update it alongside the shared CSS when changing site-wide tokens. Search uses the bundled JSON snapshot; update this file when adding recipes. Article content is static and must also be updated separately.

## Images and integrations

The package contains the four local home-page photographs. Many article images still load from https://platefullofyum.com/ and therefore need internet access; it is not a fully offline image archive. Download those images and update their URLs if moving away from the existing WordPress media host.

Ads are non-clickable design placeholders. Follow ADSENSE-NOTES.md when connecting approved Google AdSense units. No live advertising, analytics, comments, accounts or backend is configured. Recipe saving stays on the visitor's device.

Read CONTENT-NOTES.md for the import scope and validation limits. Browser visual and print checks are still needed before production use.
