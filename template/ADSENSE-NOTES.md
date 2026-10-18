# Ad placement handoff

This theme provisions two manual display-ad areas; it does not load Google scripts, request ads, or track visitors. The preview text is a non-clickable design placeholder.

- `ad-after-recipes`: after the complete recipe grid, before the baking feature.
- `ad-before-about`: after the baking feature, before the author section.
- Each footprint is 728 × 90 px above 850 px viewport width, and 300 × 100 px at 850 px and below. The surrounding label and whitespace stay outside the ad creative.
- Both are labelled “Advertisements”. Navigation, search, save controls, and the opening hero remain clear of ads. No sticky, overlay, popup, interstitial, or autoplay placements are included.

## When connecting the production WordPress theme

Use the approved AdSense publisher ID and real display-unit slot IDs. Replace the preview inside each `.ad-slot` with the Google-generated ad code and follow Google's documented CSS sizing approach for responsive ad units to match these reserved dimensions. Do not simply insert unrestricted auto-sized ads into these fixed footprints; do not crop, cover, or modify the ad creative or Google labels. Verify the rendered unit sizes on both sides of the breakpoint and on narrow phones before launch.

Load the AdSense library once, after applicable consent requirements have been handled. Keep Auto ads disabled initially so these manual placements remain intentional. Retain the public domain's required AdSense verification and ads.txt configuration. Google controls the actual creative appearance; a matching theme cannot guarantee matching ads.

Reserve each footprint before loading to reduce content shifts. Decide whether unfilled units retain space or collapse using Google's supported unfilled-ad handling; do not replace a served ad with other content. Test live ad behavior only after configuring real units on the approved production domain. This private design preview is not connected to AdSense.

References:
https://support.google.com/adsense/answer/1346295
https://support.google.com/adsense/answer/9183362
https://developers.google.com/publisher-tag/guides/minimize-layout-shift
