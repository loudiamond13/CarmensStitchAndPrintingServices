---
phase: 08-order-screens
plan: 29
subsystem: orders
tags: [orders, e2e, playwright, two-staff, gap-closure, G-08-5, D-94, D-95, D-96, D-97]
created: "2026-10-30T21:05:00-05:00"
updated: "2026-10-30T21:05:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-25 (D-94 server discount amount), 08-26 and 08-28 (D-95 windows on current figures), 08-27 (D-96 status menu read on open)"
provides:
  - "web/e2e/order-two-staff.spec.ts: three @orders-two-staff journeys with two signed-in staff on one order, in all five projects"
  - "Every gate run once over the whole tree, with the results quoted below"
  - "Final owner-ruled outcomes for WR-01, WR-02, WR-05 and IN-08 in 08-REVIEW-DISPOSITION.md (fixed 9, deferred 3, accepted 1) and deferred-items.md"
affects: [phase-8-verification]

actuals:
  tokens: 4200
  tasks: 2
  commits: 3
plan_head_before: 8946c9815e2c8f13bc93f303f533ac7b0e37498c
plan_head_after: ed502976c272a99f061957f6ef698f41f1fae974

tech-stack:
  added: []
  patterns:
    - "A second signed-in person is a page in a second browser context, closed in a finally, with its own console-error and page-error listeners because the shared guard watches only the test's page"
    - "A tab that regains focus is simulated with a bubbling visibilitychange event on the document, which TanStack's focus manager hears"

key-files:
  created:
    - web/e2e/order-two-staff.spec.ts
  modified:
    - web/e2e/order-deleted-view.spec.ts
    - .planning/phases/08-order-screens/08-REVIEW-DISPOSITION.md
    - .planning/phases/08-order-screens/deferred-items.md

key-decisions:
  - "The two-staff journeys prove the 08-25 to 08-28 fixes against the real server; they passed on the first run apart from two assertions in the new spec itself (see Deviations)"
  - "D-94 scoped only the Discounts tab amount column, so otherDiscountsTotal and the discount window preview still add up in the browser; recorded in the disposition for WR-01"

requirements-completed: [ORD-07]

coverage:
  - id: T1
    description: "Two staff on one order: a payment the first person's old figures refused goes through after the window reads the order; the server's 409 and Load Latest still guard the version; the typed values stay; the second save shows the new balance"
    requirement: "ORD-07"
    verification:
      - kind: e2e
        ref: "web/e2e/order-two-staff.spec.ts#a payment the old figures refused goes through after the window reads the order, and the server still guards the version"
        status: pass
    human_judgment: false
  - id: T2
    description: "An open Add Payment window shows the balance the second person left when the first person's tab regains focus, without pressing Save"
    requirement: "ORD-07"
    verification:
      - kind: e2e
        ref: "web/e2e/order-two-staff.spec.ts#an open Add Payment window shows the balance the other person left when the tab regains focus"
        status: pass
    human_judgment: false
  - id: T3
    description: "After the second person records the last payment, the first person opens Change Status, Mark Completed is enabled with no reason line, and it completes the order"
    requirement: "ORD-07"
    verification:
      - kind: e2e
        ref: "web/e2e/order-two-staff.spec.ts#Mark Completed turns on after the other person records the last payment, and completes the order"
        status: pass
    human_judgment: false
  - id: T4
    description: "D-94 end to end: the existing @orders-discounts journeys pass against the real server with the server's per-discount amounts"
    requirement: "ORD-07"
    verification:
      - kind: e2e
        ref: "web/e2e/order-discounts.spec.ts (3 tests, 5 projects, in the 95-test order e2e set)"
        status: pass
    human_judgment: false
  - id: G1
    description: "Every gate green on the whole tree: .NET build, all .NET tests, the coverage gate, the OpenAPI types check, npm verify and the order e2e set"
    requirement: "ORD-07"
    verification:
      - kind: command
        ref: "dotnet build Csps.slnx; dotnet test --solution Csps.slnx; tools/scripts/Invoke-CoverageGate.ps1; npm --prefix tools/openapi-gen run check; npm --prefix web run verify; npm --prefix web run e2e -- --grep (order set)"
        status: pass
    human_judgment: false
  - id: O1
    description: "Real people on two real devices: the three journeys, and the Discounts tab amounts on an order with a percent discount"
    requirement: "ORD-07"
    human_judgment: true
    rationale: "The plan's human check is for the owner at the end-of-phase check: two browsers signed in as two staff on one test order. The automated journeys use one machine and made-up staff."

duration: 55min
completed: 2026-10-30
---

# Phase 8 Plan 29: Two staff on one order, every gate, and the final review outcomes Summary

**Three `@orders-two-staff` journeys prove D-95 and D-96 end to end with two signed-in staff on one order (cap check on current figures with the 409 and Load Latest still guarding the version, the open window following the other person's change on focus, and Mark Completed enabled after the other person's last payment); every gate is green and all four review findings have their owner-ruled outcome.**

## Performance

- **Duration:** about 55 min, most of it the 8.5 minute .NET suite and five e2e runs
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files changed:** 4 (one new e2e spec, one e2e spec fix, two planning documents)
- **Commits:** 3 (measured from `plan_head_before`), plus this summary commit

## Accomplishments

- `web/e2e/order-two-staff.spec.ts` seeds its own order per test (`E2E Two Staff ...`, 12 x 780.00 = 9,360.00) and two made-up Managers. Person A uses the test's page; person B uses a page in `browser.newContext`, closed in a `finally`, with its own listeners for console errors and page errors (the shared guard watches only A's page).
  1. Payment cap (D-95): A opens Add Payment with "Balance due: ₱6,360.00"; B deletes the 3,000.00 payment; A types 8000 and saves. The window reads the order, the check passes, the save sends the opened version, the server answers 409 (declared with `guard.expectStatus`), and the banner shows Load Latest with 8000.00 and Cash kept. After Load Latest the second save shows "Payment added" and "Balance now ₱1,360.00." Axe is clean with the window open.
  2. Focus refresh (D-95): after B's delete the window still shows "Balance due: ₱6,360.00"; a bubbling `visibilitychange` on A's document brings "Balance due: ₱9,360.00" with no Save.
  3. Mark Completed (D-96): 9,000.00 of 9,360.00 paid; B records the last 360.00; A opens Change Status and Mark Completed is enabled with no reason line; A completes the order and sees "Order completed".
- Disposition: WR-01 fixed (D-94, 08-25 commits), WR-02 fixed (D-95, 08-26 and 08-28 commits, with the payment delete check noted), WR-05 fixed (D-96, 08-27 commits), IN-08 accepted (D-97). IN-02, IN-03 and IN-04 stay deferred. Counts are fixed 9, deferred 3, accepted 1. WR-03 notes the list stays unbounded (D-97). WR-01 records that `otherDiscountsTotal` and the discount window preview still add up in the browser, because D-94 covered only the tab column.
- deferred-items.md: items 1, 2, 3 carry "Ruled D-94 / D-95 / D-96 by the owner, 2026-10-30; fixed in ...", items 5 and 6 carry "Ruled D-97 ... left as built", and a new section logs the two test-run observations below.

## Task Commits

1. Task 1 (tracer): `5e14c472` test(08-29): two staff on one order: payment cap, focus refresh and Mark Completed
2. Task 2 fix: `32ccf5c9` test(08-29): the deleted order permanent delete check waits for the toast to go
3. Task 2 docs: `ed502976` docs(08-29): final outcomes for WR-01, WR-02, WR-05 and IN-08, and the gate results

## Gate Results (quoted)

Preflight showed ports 5180, 5115, 7028 and 5199 free and no TheBETSLLC test process before the e2e runs and before the full .NET run.

| Gate | Result |
|---|---|
| `dotnet build Csps.slnx` | Build succeeded, 0 Warning(s), 0 Error(s) |
| `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` for the process) | Test run summary: Passed! total 6235, failed 0, succeeded 6233, skipped 2 (the opt-in live Pwned Passwords check, and a file-link test this Windows account may not run) |
| `tools/scripts/Invoke-CoverageGate.ps1` | Csps.Domain line 100% (2622/2622), branch 100% (1126/1126) PASS; Csps.Application line 99.1% (6877/6935) PASS; "Coverage gate passed." |
| `npm --prefix tools/openapi-gen run check` | "Generated API types match tools/openapi-gen/openapi.v1.json." |
| `npm --prefix web run verify` | exit 0: eslint `--max-warnings 0` clean; Test Files 269 passed, Tests 7567 passed; Statements 95.75%, Branches 90.81%, Lines 98.1%; bundle budgets public JS 125.18 KB of 150, admin JS 214.67 KB of 250, CSS 16.38 KB of 35; license gate passed; notices up to date |
| `npm --prefix web run e2e -- --grep "@orders-two-staff\|@orders-discounts\|@orders-payments\|@orders-refunds\|@orders-status\|@orders-deleted-view\|@orders-page"` | third full run: 95 passed (5.6m), exit 0. `@orders-two-staff` alone passed 15 of 15 in two further runs, with no retry |

## TDD Gate Compliance

This plan adds no product behavior. The journeys prove fixes that 08-25 to 08-28 made with their own red and green commits, so there is no RED commit here. No journey failed on a product fault, so no component test was needed first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two assertions in the new spec were wrong or racy**
- **Found during:** Task 1
- **Issue:** the Amount field shows `8000.00` after blur, not `8000`; and the second Save was clicked before Load Latest had finished, which failed once in chromium in a parallel run (the dialog stayed open).
- **Fix:** expect `8000.00`, and wait for the status line "Latest version loaded. What you typed is kept." before the second Save.
- **Files modified:** `web/e2e/order-two-staff.spec.ts`
- **Commit:** `5e14c472` (fixed before the first commit of the spec)

**2. [Rule 1 - Bug] A racy check in an earlier plan's e2e test**
- **Found during:** Task 2 (second full e2e run)
- **Issue:** `order-deleted-view.spec.ts` "deletes a deleted order for good" (plan 08-23) asserted the order number was absent 5 s after the toast appeared, but the toast message is the number and stays 4.5 s. It failed once in firefox under load.
- **Fix:** wait for the toast to go (15 s limit) before looking for the number.
- **Files modified:** `web/e2e/order-deleted-view.spec.ts` (outside `files_modified`; a failing gate forced it)
- **Commit:** `32ccf5c9`

**Total deviations:** 2 auto-fixed (both test-only). **Impact:** none on product code.

## Issues Encountered

- **Unexplained one-off timeout, recorded and not hidden.** In the first full order e2e run, `order-refunds.spec.ts` "a Manager works the refunds of a cancelled order without reopening it" (chromium) timed out at 120 s waiting on Save Refund in the Add Refund window (button not enabled, then the window detached). It passed alone three times in a row and in the next two full runs. The trace was not kept, so the cause is unknown; it may point to a rare race around the refund window's over-cap read (08-28). Logged in deferred-items.md ("From plan 08-29") with what to check if it returns.

## Notes for the Owner

- Human check for the end-of-phase review (coverage item O1): with two browsers signed in as two staff on one test order, try the three journeys, and look at the Discounts tab amounts on an order with a percent discount.
- D-90, D-91 and D-93 need no code (as built). D-92 is already in 08-UI-SPEC.md. The known accepted axe `target-size` failures of the chip Clear buttons (D-93) are not in this plan's e2e set and were not touched.
- REQUIREMENTS.md: ORD-07 is checked by the state update below if `requirements.ready-ids` reports it ready now that this is the last plan declaring it.

## Known Stubs

None.

## Threat Flags

None. The spec uses made-up names (`E2E ...`, `Mira`/`Nico` plus a random token), the `CSPS_E2E` database only, and a second context closed in a `finally`. gitleaks on every staged change: no leaks found. T-08-53 mitigated. T-08-SC: no package added or bumped.

## Self-Check: PASSED

- Files exist: `web/e2e/order-two-staff.spec.ts` (FOUND), plus the four edited files.
- Commits on this branch: 5e14c472, 32ccf5c9, ed502976 (all FOUND by `git merge-base --is-ancestor`).
- Acceptance: `grep -c "@orders-two-staff"` = 3 (needs 3); `grep -c "newContext"` = 1 (needs 1); disposition counts `D-94` 2, `D-95` 1, `D-96` 1, `D-97` 3; `^fixed: 9`, `^deferred: 3`, `^accepted: 1` each 1; `grep -c "Ruled D-9" deferred-items.md` = 5; `created:` unchanged and `updated:` new in both markdown files.
- No server, browser or shell left running (preflight after the runs: ports free, no dev or test processes).
