---
phase: quick-261109-vj6
plan: 01
subsystem: money-audit, orders-list, admin-dashboard, e2e-guard
tags: [d-111, p10-bl-02, p10-bl-04, p10-bl-05, p10-bl-08, p10-bl-13, p10-bl-17, audit, webkit]
status: complete
created: 2026-11-10T01:30:00-06:00
updated: 2026-11-10T01:30:00-06:00
requirements: [DASH-03, DASH-05, DASH-06, MONEY-04, MONEY-06, AUDIT-01]
commits: 4
plan_head_before: 29e24efb55c35911273b49c3f11578ea6a15c3f
plan_head_after: 647e2aa5276e13dccc9c3c5aad1228d4b301c1aa
actuals:
  tokens: 27000
  tasks: 4
  commits: 4
key-files:
  created: []
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Money/CreateMoneyTransferHandler.cs
    - src/Csps.Application/Money/MoneyAuditDetail.cs
    - src/Csps.Application/Audit/AuditChangeLines.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - web/src/modules/admin/pages/DashboardPage.tsx
    - web/src/components/data/IncomeExpenseChart.tsx
    - web/e2e/fixtures.ts
decisions:
  - "D-111 locked and not revisited: the six parked items were fixed with option A."
  - "The WebKit rule matches the wording the guard really sees (host and path, no scheme), proven in a real run."
---

# Phase quick-261109-vj6 Plan 01: Fix the D-111 rulings Summary

*Created: 2026-11-10T01:30:00-06:00 · Updated: 2026-11-10T01:30:00-06:00*

Six Phase 10 parked items are fixed as the owner ruled in D-111 (option A on each), test-first, in four commits. Four stale pieces of text now read true.

## Commits

| Task | Commit | Items |
|------|--------|-------|
| 1 | `3bea5c9e` feat(money): audit a normal transfer and mark removed hand-overs (D-111) | P10-BL-08, P10-BL-13 |
| 2 | `4f773e95` fix(orders): sort Newest first by created time, like the dashboard (D-111) | P10-BL-02 |
| 3 | `7586b8e6` fix(dashboard): keep the last good figures on a failed refresh and read half-thousand ticks (D-111) | P10-BL-04, P10-BL-17 |
| 4 | `647e2aa5` test(e2e): ignore only WebKit's cancelled API request error, and fix stale notes (D-111) | P10-BL-05, stale text, DECISIONS.md |

No package, migration, index, trigger or inline SQL was added. Nothing was pushed.

## Task 1: P10-BL-08 and P10-BL-13

- **Red.** `AuditActionsTests`: 3 failed (`typeof(AuditActions).GetField(constantName) should not be null`) before the constant existed. The Application tests did not compile before the code (`MoneyAuditDetail.HandoverKey` and the new `IAuditTrail` constructor argument were missing), which is the red for those.
- **Green.**
  - `dotnet test --project tests/Csps.Domain.UnitTests`: 1323 passed.
  - `tests/Csps.Application.UnitTests`: 2556 passed.
  - `tests/Csps.ArchitectureTests`: 290 passed.
  - Integration classes `MoneyTransferEndpointTests`, `MoneyTransferDeletionTests`, `MoneyHandoverEndpointTests`, `MoneyTransferConcurrencyTests`, `AuditLogEndpointTests` (CSPS_TEST_SQL=localdb, after a clear preflight): 104 passed.
  - `auditCopy.test.ts` and `AuditDetail.test.tsx`: 65 passed. `dotnet build`: 0 warnings, 0 errors. `dotnet format --verify-no-changes`: clean. Typecheck and lint: exit 0.
- **What it does.**
  - A saved transfer records one `money-transfer.added` entry before the one save: the sender is the actor, the target is the transfer id, and the detail is `from;to;amount;date;note=yes|no` with no note text. Refused transfers record none (unit tests on every refused path, plus `ARefusedTransferWritesNoAuditEntry`). The same key and body twice writes one (`TheSameKeyAndBodyTwiceWritesOneAuditEntry`).
  - The removed record is `...;recordedBy=<id>;handover=yes|no;deletedBy=<id>;deletedAt=...`. The delete detail is unchanged. The longest values stay under 400 characters.
  - The Audit Log reads the new entry as "Money transfer added" (Staff money) with the sender, receiver, amount and date lines. The `handover` and `note` flags are never lines.
  - `audit-log.md`, `staff-money.md` and 10-UI-SPEC.md say the same.

## Task 2: P10-BL-02

- **Red.** `NewestSortIsLatestCreatedFirstWhateverTheOrderDate` failed: expected `["Recorded Third", "Recorded Second", "Recorded First"]`, got `["Recorded First", "Recorded Third", "Recorded Second"]` (the order-date sort).
- **Green.** `OrderListSort.Newest` is now created time descending, then id descending (the keys of the dashboard's Recent orders). `ListOrdersEndpointTests` and `OrderListQueryCountTests`: 59 passed, query counts unchanged. `orders-filters` in chromium: 1 passed (order 2 is now recorded first so the order does not depend on the engine).
- **Timing** (`OrderListTimingTests` alone, 2026-11-09, no other project running, `total: 1, failed: 0`), p50 / p95 in ms: default list 16.8 / 20.3, customer-name search 86.6 / 156.5, product type filter 31.4 / 46.2, has balance 12.9 / 16.7, far page at size 100 32.2 / 47.7, **newest sort 26.3 / 35.2**, balance sort 17.1 / 21.1, total sort 19.1 / 27.9. All are well under the 300 ms limit, so no index was added and nothing was parked. `IX_Orders_OrderDate` stays for the order-date range. The numbers are in `docs/operations/list-performance.md`.

## Task 3: P10-BL-04 and P10-BL-17

- **Red.** 5 tests failed before the code: the three cards still hid the figures on a later failure, and the chart gave "₱2k" and "₱5k" for 1,500 and 4,500. The 4 new page tests failed on `Found multiple elements with the role "alert"` (each card showed its own alert) and a missing stale line.
- **Green.** The 7 touched test files: 230 passed, no warnings. The kept-figures state has zero axe violations. The first-load failure tests are unchanged and pass. Typecheck, lint and `format:check` exit 0.
- **Page behavior.** After one good load, a failed refresh keeps the greeting, the date, the KPI figures, the status rows and the recent orders, and shows one alert: "Showing figures from 9:41 AM. Couldn't refresh." with Try Again. It names the last good load (9:50 when a refresh worked at 9:50 and one failed at 9:55). Try Again reads the summary again: the line leaves on success and returns with the same time on another failure. A first-load failure is unchanged (h1 "Dashboard", no date line, each card's own alert).
- **Chart.** Ticks read "₱1.5k", "₱4.5k", while "₱1k", "₱2k", "₱15k", "₱100k" read as before. Below ₱1,000 stays in full and below zero keeps U+2212.
- The frozen-Date approach worked, so the test reads the time from the faked clock, not from the query state.

## Task 4: P10-BL-05, stale text, DECISIONS.md

- **WebKit message as observed.** In a real WebKit/iPhone run without the sign-in wait, the guard received: `/localhost:5199/api/v1/dashboard/chart?months=6 due to access control checks.` (also for `/api/v1/dashboard/summary` and `/api/v1/staff-money/me`). Playwright hands the guard the message without the "Fetch API cannot load https:" start. As the plan said, the rule and the tests use the observed wording, not the quoted one.
- **Rule.** Anchored regex on the whole message. It counts only in WebKit, only for the app's own host, and only when the path (normalised) starts with `/api/`. Everything else is still a finding.
- **Red.** First self-test run: the "ignored in WebKit" test failed in WebKit (it got the page error). Then the real run: with the sign-in wait removed and the first (quoted-wording) rule, `money.spec.ts` "a Manager hands over a leaver's money" failed on the iPhone profile with the 3 page errors above. That proved the quoted wording does not match what WebKit really sends.
- **Green.**
  - `--grep @fixture`: 36 passed (chromium, firefox, webkit; each engine runs the two new self-tests). One firefox case ("an unlabelled image fails the axe check") timed out tearing down its context in the one run where TheBETSLLC's tests were running; it passed alone (1 passed, 21.1 s). Recorded as a flake, unrelated.
  - `--grep "@money |@orders-filters|@dashboard " --project webkit --project iphone`: 22 passed (5.3 m).
- **The sign-in wait was removed** (the summary-response wait and the greeting wait in `web/e2e/auth.ts`). `dashboardHeading` stays, other specs use it.
- **Dropped self-test.** A planned "real cancelled request leaves no finding" test: a plain `fetch` cancelled by navigation gave `TypeError: Load failed` (no URL) in WebKit, not the ruled wording, so it could not prove the rule. The real hand-over journey in WebKit and iPhone is the proof instead. That `TypeError: Load failed` wording is not ignored.
- **Stale text.** The dashboard-sweep comment, the moneyService Admin 403 comment and the DeleteTransferDialog preview comment (cites D-111, P10-BL-18 A) now read true. `docs/web/e2e.md` has "WebKit and cancelled API requests".
- **DECISIONS.md.** Six items read "fixed in quick 261109-vj6" (02, 04, 05, 08, 13, 17). P10-BL-04 has a "Built as" list, P10-BL-05 a "Built as" note, P10-BL-13 a follow-up, and P10-BL-20 lists only the remaining steps (pixel snapshots on CI, one clean full CI run, your sign-off).

## For owner review

New wording is only: "Showing figures from {time}. Couldn't refresh.", the existing "Try Again", and the label "Money transfer added".

P10-BL-04 choices made inside the ruling:
1. **Placement:** header title column, under the date line.
2. **Coverage:** what the summary feeds (header, KPI row, Orders by status, Recent orders). The chart card and the money strip keep their own failure lines.
3. **Look:** like the money strip's failure line: Small 14px in the danger colour, ghost small Try Again with the 44px tap area.
4. **Timing:** shown when the latest read failed and no retry is running. It leaves while a retry runs and is announced again if the retry fails.
5. **{time}:** the moment this browser got the last good answer (`dataUpdatedAt`), shown in Asia/Manila ("9:41 AM"). It is a device-clock instant shown in the business zone, the same source Sessions uses.

Other choices:
- The chart tick writes one decimal for any non-whole thousand, not only exact halves. By construction the half line is always a whole thousand or a half thousand, so only halves occur.
- `Try Again` was added to `dashboardCopy.ts` as `retry` (the file had none).

## Parked for the owner

- **P10-BL-13 follow-up (inside that item):** the stored record now holds `handover=yes|no`. Option A (recommended): leave it in the stored record only. Option B: also show a "Hand-over: Yes/No" line on the Audit Log screen (new wording to approve). No new P10-BL item was needed: no p95 went over 300 ms, no migration or index was needed.

## Deviations from Plan

**1. [Plan anticipated] WebKit wording differs from the quoted D-111 text.** Used the observed wording in the rule, tests and docs (see Task 4).

**2. [Rule 3] Real-cancellation self-test dropped.** Not reproducible with a synthetic `fetch` (see Task 4).

**3. TDD note.** Task 1's three new endpoint tests and the web label test were written together with the code and not run red on their own. The unit tests for the same behavior were seen red (domain test failures, Application tests not compiling).

**4. Timestamps.** Some "Updated" values in docs touched mid-run were set from my estimate of the time, then corrected to real times in commit 4 (`10-UI-SPEC.md`, `list-performance.md`).

## Checks that did not pass cleanly (not caused by this work)

- **Full Vitest** (`npm run test -- --run`, 881 s, with TheBETSLLC's tests running on the machine): 9064 passed, 5 failed. Re-run alone: `OrderItemModal`, `OrderRefundModal` and `OrderFormPage` passed; `ExpenseModal.test.tsx` passed alone (54 passed). They were load timing flakes.
- **`web/scripts/third-party-notices.test.ts`** ("--check exits 1 ... and --write fixes it") timed out at 120 s both in the full run and alone (173 s). It spawns a script that scans `node_modules`. This work changed no package, `web/scripts` or lock file. I did not get a quiet machine to re-run it. Please re-run it on a quiet machine or CI before treating it as a regression. Deferred, not fixed.
- Typecheck, lint and `format:check` exit 0 on the final tree.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the audit action `money-transfer.added`, which joins `AuditActions.All` (the existing filter validator already uses it); no route, policy or role changed.

## Self-Check: PASSED

- Commits `3bea5c9e`, `4f773e95`, `7586b8e6`, `647e2aa5` exist on `gsd/phase-10-admin-dashboard` (`git rev-list --count 29e24efb..HEAD` is 4).
- `grep -c "fixed in quick 261109-vj6"` on DECISIONS.md gives 6, `grep -c D-111` on DeleteTransferDialog.tsx gives 1, `grep -c D-107` on dashboard-sweep.spec.ts gives 1.
