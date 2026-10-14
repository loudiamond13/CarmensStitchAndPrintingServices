---
phase: 02-web-foundation-design-system
review: 02-REVIEW-g199-42.md
created: 2026-10-13T20:57:36-05:00
updated: 2026-10-13T21:45:00-05:00
---

# Code review disposition: gap G-2-199 (plan 02-42)

One row per finding in `02-REVIEW-g199-42.md`. Every finding starts `open`. It changes when it is fixed, deferred or accepted, and the reason goes in Note.

| ID | Severity | Summary | Disposition | Note |
|----|----------|---------|-------------|------|
| WR-01 | warning | A press on the dark area that does not close the dialog still moves focus out of the confirm field and scrolls the backdrop back to the top | fix planned | Owner, 2026-10-13 (UAT 199 close-out): fix in plan 02-43 (useFocusTrap returns focus to where it was, without scrolling; one shared fix with WR-02). |
| WR-02 | warning | The "one task later" re-read relies on WebKit's timing and accepts any scroll in that window | fix planned | Owner, 2026-10-13 (UAT 199 close-out): fix in plan 02-43, together with WR-01. |
| IN-01 | info | A press on the dark area that is released inside the dialog still closes it | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-02 | info | The SPEC-DEVIATION comment states engine behaviour as fact that was proven only for Chromium | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-03 | info | The overlay project's `--enable-features` may replace Playwright's own `--enable-features` | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-04 | info | A context menu does not cancel the pending press | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-05 | info | The right-press-then-left-click E2E steps assume no native context menu | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
| IN-06 | info | No E2E test taps the scrim with touch input | deferred | Owner, 2026-10-13 (UAT 199 close-out): deferred; revisit when the overlay code is next touched. |
