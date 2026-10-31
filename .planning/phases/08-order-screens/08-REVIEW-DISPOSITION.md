---
phase: 08-order-screens
created: 2026-10-30T15:45:00-05:00
updated: 2026-10-30T20:59:00-05:00
review_path: .planning/phases/08-order-screens/08-REVIEW.md
fix_report: .planning/phases/08-order-screens/08-REVIEW-FIX.md
findings: 13
fixed: 9
deferred: 3
accepted: 1
---

# Phase 8 Code Review Disposition

*Created: 2026-10-30T15:45:00-05:00 · Updated: 2026-10-30T20:59:00-05:00*

Every finding in `08-REVIEW.md` has one outcome below. A fix has a red-test commit and a green commit. A comment-only fix has one commit and no test. The owner was away when the review ran, so every finding that changes behavior, the API or an owner rule went to the owner with options in `deferred-items.md` ("From the end-of-phase code review"). The owner ruled on 2026-10-30 (D-94 to D-97), and plans 08-25 to 08-29 closed gap G-08-5.

Counts: 13 findings (0 critical, 5 warning, 8 info), 9 fixed, 3 deferred, 1 accepted.

## Findings

| Id | Severity | Outcome | Commit or reason |
|---|---|---|---|
| WR-01 | Warning | fixed (owner D-94) | Red `6bb44d73`, green `3a50e503`, snapshot and types `f15a2c2e`, red `23b9aac7`, green `8bb31193` (plan 08-25). The server sends each discount's `Amount` and the Discounts tab shows it. `otherDiscountsTotal` and the discount window preview still add up in the browser: D-94 covered the tab column only. |
| WR-02 | Warning | fixed (owner D-95) | Plan 08-26 (payment window): red `e6e61dd8`, green `e62b9623`; red `3dcafe17`, green `710ac533`; payment delete check red `169c04e0`, green `ebcf7c49`. Plan 08-28 (refund and discount windows): red `02ecb807`, green `0d2cff4b`; red `18795d45`, green `75570115`. The instant check stays; a focus or a failed cap check reads the order again; the save keeps the opened version, so the 409 and Load Latest still guard it. The payment delete check got the same rule. Proven with two staff in `web/e2e/order-two-staff.spec.ts` (plan 08-29). |
| WR-03 | Warning | fixed | Red `4fed0e17`, green `d77afce0`. Held business days older than 5 minutes are not handed out; the probe runs instead. New Order keeps the day it opened on. The Orders list stays unbounded, left as built (owner D-97). |
| WR-04 | Warning | fixed | Red `b7745308`, green `1e922883`, lint `583360b0`. The delete dialog reads counts under its own key. |
| WR-05 | Warning | fixed (owner D-96) | Red `9078d462`, green `10de9a0b`, lock-in `8458ad52` (plan 08-27). The Change Status menu reads the order each time it opens. Proven with two staff in plan 08-29. |
| IN-01 | Info | fixed | `ca018115` (comment only). |
| IN-02 | Info | deferred | Refactor, no behavior change; follow-up quick task (deferred-items, code review item 4). Stays deferred. |
| IN-03 | Info | deferred | Refactor, no behavior change; follow-up quick task. |
| IN-04 | Info | deferred | Refactor, no behavior change; follow-up quick task. |
| IN-05 | Info | fixed | Red `082e1de6`, green `a567ccff`. Guards scan every order file and admin hook with one comment stripper; `useSessionCapWarning.ts` allow-listed as a session timer, not the business day. |
| IN-06 | Info | fixed | `92098aad` (comment only). |
| IN-07 | Info | fixed | Red `af145105`, green `d444d4d4`. |
| IN-08 | Info | accepted (owner D-97) | The suggested fix is wrong for this page and no failing case exists. Left as built, ruled by the owner on 2026-10-30. |

## Gate results after the fixes

From `08-REVIEW-FIX.md`: typecheck, lint and prettier clean; vitest 268 files, 7498 tests passed; chromium e2e for the order screens 21 passed; `npm --prefix web run verify` exit 0 with branches 90.74%.

## Gate results after plan 08-29

From `08-29-SUMMARY.md`: `dotnet build Csps.slnx` 0 warnings and 0 errors; `dotnet test --solution Csps.slnx` 6,235 tests, 0 failed, 2 skipped (the opt-in live Pwned Passwords check, and a file-link test this Windows account may not run); the coverage gate passed (Domain 100%, Application 99.1% lines); the OpenAPI types check passed; `npm --prefix web run verify` exit 0 (269 files, 7,567 tests, branches 90.81%); the order e2e set 95 passed with the three `@orders-two-staff` journeys in every project.
