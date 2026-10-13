---
phase: 02-web-foundation-design-system
review: 02-REVIEW-g199.md
created: 2026-10-13T18:05:00-05:00
updated: 2026-10-13T18:05:00-05:00
---

# Code review disposition: gap G-2-199 (plan 02-41)

One row per finding in `02-REVIEW-g199.md`. Every finding starts `open`. It changes when it is fixed, deferred or accepted, and the reason goes in Note.

| ID | Severity | Summary | Disposition | Note |
|----|----------|---------|-------------|------|
| WR-01 | warning | The backdrop scrollbar guard misses overlay scrollbars and middle- or right-button presses, so they still close the dialog | open | |
| WR-02 | warning | No real browser runs the guard: headless Chromium hides scrollbars | open | |
| WR-03 | warning | The opening animation briefly overflows the backdrop on phone pages, so a scrollbar can flash | open | Either fix changes the look, so it needs the owner's OK (D-08) |
| WR-04 | warning | The column and spacer rule clashes with the Users screen's slide-in panel in a later phase | open | |
| IN-01 | info | The scrollbar check assumes left-to-right text and can be off by under 1px when zoomed | open | |
| IN-02 | info | When a scrollbar shows, the dialog centres on the area beside it, about 8px off the window's centre | open | |
| IN-03 | info | The 659x393 landscape phone window has no `@dialog-fit` test | open | |
| IN-04 | info | The backdrop does not stop scrolling from passing to the page behind it (iOS Safari before 16) | open | |
