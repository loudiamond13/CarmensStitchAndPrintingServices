---
created: "2026-10-08T20:20:00-05:00"
updated: "2026-10-08T20:20:00-05:00"
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
