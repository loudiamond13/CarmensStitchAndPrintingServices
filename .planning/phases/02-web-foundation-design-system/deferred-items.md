---
created: "2026-10-08T20:20:00-05:00"
updated: "2026-10-08T20:50:20-05:00"
---

# Phase 02 deferred items

Out-of-scope findings logged by plan executors (not fixed by the plan that found them).

## Deferred Items

- Intermittent pixel difference in the forms parity group, Chromium, light theme, 1440px, focus-visible
  status: open
  **Found by:** plan 02-23, during the Chromium regression of every group (`--grep "@parity|@reference" --project chromium`).
  **What:** `field-multiline` (first run) and then `field-hint` (a rerun of `@forms`) failed their pixel step with 5 differing pixels. Every differing pixel sits at x 1437–1439 (the right edge of the 1440px viewport), on the anti-aliased rounded right corners of the field box with its focus ring. Computed styles and boxes were equal.
  **Why deferred:** plan 02-23 changed nothing in the forms group. Repeated runs of the same rows passed (`--repeat-each 3`: 6 of 6), and a third full `@forms` run passed 16 of 16. It looks like an anti-aliasing race on the corner pixels at the viewport edge under parallel load. No tolerance was added.
  **Next step:** whoever next owns the forms group or the harness should trace a failing run (`-- --trace on`) and check whether the focus ring's transition or the edge rasterization differs between the two pages.
  **Update (plan 02-24):** the data group hit the same race at 390 px (x 388–389, rounded corners of the table frame and the order cards), on either side and from run to run, with equal computed styles, boxes and compositing layers. Plan 02-24 turned off Chromium partial raster in `web/visual/playwright.visual.config.ts` (`--disable-partial-raster`) and scrolls each rest case into view before the repaint. Reproductions under parallel load went from 3 of 20 differing to 25 of 25 equal, and the Chromium regression of every group then passed 109 of 109. Leave this open until later plans' regressions confirm the forms focus-visible rows stay equal.
