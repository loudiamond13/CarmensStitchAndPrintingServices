---
phase: 08-order-screens
created: 2026-10-30T15:45:00-05:00
updated: 2026-10-30T15:45:00-05:00
review_path: .planning/phases/08-order-screens/08-REVIEW.md
fix_report: .planning/phases/08-order-screens/08-REVIEW-FIX.md
findings: 13
fixed: 6
deferred: 7
accepted: 0
---

# Phase 8 Code Review Disposition

*Created: 2026-10-30T15:45:00-05:00 · Updated: 2026-10-30T15:45:00-05:00*

Every finding in `08-REVIEW.md` has one outcome below. A fix has a red-test commit and a green commit. A comment-only fix has one commit and no test. The owner was away, so every finding that changes behavior, the API or an owner rule is deferred to the owner with options in `deferred-items.md` ("From the end-of-phase code review").

Counts: 13 findings (0 critical, 5 warning, 8 info), 6 fixed, 7 deferred, 0 accepted.

## Findings

| Id | Severity | Outcome | Commit or reason |
|---|---|---|---|
| WR-01 | Warning | deferred (owner) | Discount row amounts are browser math. The fix adds an `Amount` field to the API answer, a contract change. Options in deferred-items, code review item 1. |
| WR-02 | Warning | deferred (owner) | Client caps block a save from an old snapshot. Pulls against OR-3. Options in deferred-items, code review item 2. |
| WR-03 | Warning | fixed | Red `4fed0e17`, green `d77afce0`. Held business days older than 5 minutes are not handed out; the probe runs instead. New Order keeps the day it opened on. |
| WR-04 | Warning | fixed | Red `b7745308`, green `1e922883`, lint `583360b0`. The delete dialog reads counts under its own key. |
| WR-05 | Warning | deferred (owner) | Mark Completed disabled from the last answer. Options in deferred-items, code review item 3. |
| IN-01 | Info | fixed | `ca018115` (comment only). |
| IN-02 | Info | deferred | Refactor, no behavior change; follow-up quick task (deferred-items, code review item 4). |
| IN-03 | Info | deferred | Refactor, no behavior change; follow-up quick task. |
| IN-04 | Info | deferred | Refactor, no behavior change; follow-up quick task. |
| IN-05 | Info | fixed | Red `082e1de6`, green `a567ccff`. Guards scan every order file and admin hook with one comment stripper; `useSessionCapWarning.ts` allow-listed as a session timer, not the business day. |
| IN-06 | Info | fixed | `92098aad` (comment only). |
| IN-07 | Info | fixed | Red `af145105`, green `d444d4d4`. |
| IN-08 | Info | deferred (owner) | Skipped: the suggested fix is wrong for this page and no failing case exists. Deferred-items, code review item 5. |

## Gate results after the fixes

From `08-REVIEW-FIX.md`: typecheck, lint and prettier clean; vitest 268 files, 7498 tests passed; chromium e2e for the order screens 21 passed; `npm --prefix web run verify` exit 0 with branches 90.74%.
