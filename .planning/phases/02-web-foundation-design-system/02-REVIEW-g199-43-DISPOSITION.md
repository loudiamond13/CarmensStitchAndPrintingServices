---
phase: 02-web-foundation-design-system
review: 02-REVIEW-g199-43.md
created: 2026-10-14T05:40:00-05:00
updated: 2026-10-14T05:39:43-05:00
---

# Code review disposition: plan 02-43 (review follow-up WR-01/WR-02)

One row per finding in `02-REVIEW-g199-43.md`. Every finding starts `open`. It changes when it is fixed, deferred or accepted, and the reason goes in Note.

| ID | Severity | Summary | Disposition | Note |
|----|----------|---------|-------------|------|
| WR-01 | warning | The `focusFirst()` fallback in `returnInside` still scrolls the backdrop, so WR-01 and WR-02 survive on that path | accepted | Owner ruling 2026-10-14 (UAT test 201): keep the fallback as is. Plan 02-43 chose this fallback on purpose ("may scroll it into view so the person sees where focus went"). It only applies when nothing inside had focus, the remembered element is gone, or it cannot take focus any more. The owner rules whether to keep it or to pass preventScroll on the fallback too. |
| WR-02 | warning | `docs/web/e2e.md` says a drag on the scrollbar leaves scrollTop unchanged, but the test asserts that it scrolls | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
| IN-01 | info | The caret position `13` is a magic number repeated in five places | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
| IN-02 | info | `revealScrollbar` duplicates the new `waitForSettledScroll` helper | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
| IN-03 | info | The WR-02 Modal tests keep fake-timer machinery that no longer tests anything | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
| IN-04 | info | "Every trap records … the top one or not" has no test that would fail if the recording were gated | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
| IN-05 | info | Header comment in `deleteOrderDialog.ts` is badly reflowed | fix | Owner ruling 2026-10-14 (UAT test 201): fix in a follow-up quick task. |
