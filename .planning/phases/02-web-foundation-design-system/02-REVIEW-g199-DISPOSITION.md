---
phase: 02-web-foundation-design-system
review: 02-REVIEW-g199.md
created: 2026-10-13T18:05:00-05:00
updated: 2026-10-13T21:45:00-05:00
---

# Code review disposition: gap G-2-199 (plan 02-41)

One row per finding in `02-REVIEW-g199.md`. Every finding starts `open`. It changes when it is fixed, deferred or accepted, and the reason goes in Note.

| ID | Severity | Summary | Disposition | Note |
|----|----------|---------|-------------|------|
| WR-01 | warning | The backdrop scrollbar guard misses overlay scrollbars and middle- or right-button presses, so they still close the dialog | fixed | 02-42: the scrim closes on a primary-button click that began on the scrim and did not scroll it; middle and right presses ignored |
| WR-02 | warning | No real browser runs the guard: headless Chromium hides scrollbars | fixed | 02-42: chromium-classic-scrollbars and chromium-overlay-scrollbars run dialog-scrollbars.spec.ts with real scrollbars |
| WR-03 | warning | The opening animation briefly overflows the backdrop on phone pages, so a scrollbar can flash | deferred | Either fix changes the look, so it needs the owner's OK (D-08) Owner, 2026-10-13 (UAT 199 close-out): deferred; a fix changes the look and needs a D-08 ruling. |
| WR-04 | warning | The column and spacer rule clashes with the Users screen's slide-in panel in a later phase | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred to the phase that builds the Users screen slide-in panel. |
| IN-01 | info | The scrollbar check assumes left-to-right text and can be off by under 1px when zoomed | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-02 | info | When a scrollbar shows, the dialog centres on the area beside it, about 8px off the window's centre | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-03 | info | The 659x393 landscape phone window has no `@dialog-fit` test | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-04 | info | The backdrop does not stop scrolling from passing to the page behind it (iOS Safari before 16) | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
