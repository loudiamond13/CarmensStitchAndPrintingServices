---
phase: 08-order-screens
created: 2026-10-30T15:10:00-05:00
updated: 2026-10-31T05:08:08-05:00
verified: 2026-10-31T10:08:08Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 8/8 must-haves verified
  trigger: "Stale report: D-98 (24 px filter chip Clear button) landed after the last check, and the branch was rebased onto main after Phase 7 merged (PR #17, which also added web/scripts/audit-gate.mjs, 07.1 D-46)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
covered_files:
  - ".planning/phases/08-order-screens/08-01-PLAN.md"
  - ".planning/phases/08-order-screens/08-01-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-02-PLAN.md"
  - ".planning/phases/08-order-screens/08-02-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-03-PLAN.md"
  - ".planning/phases/08-order-screens/08-03-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-04-PLAN.md"
  - ".planning/phases/08-order-screens/08-04-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-05-PLAN.md"
  - ".planning/phases/08-order-screens/08-05-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-06-PLAN.md"
  - ".planning/phases/08-order-screens/08-06-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-07-PLAN.md"
  - ".planning/phases/08-order-screens/08-07-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-08-PLAN.md"
  - ".planning/phases/08-order-screens/08-08-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-09-PLAN.md"
  - ".planning/phases/08-order-screens/08-09-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-10-PLAN.md"
  - ".planning/phases/08-order-screens/08-10-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-11-PLAN.md"
  - ".planning/phases/08-order-screens/08-11-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-12-PLAN.md"
  - ".planning/phases/08-order-screens/08-12-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-13-PLAN.md"
  - ".planning/phases/08-order-screens/08-13-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-14-PLAN.md"
  - ".planning/phases/08-order-screens/08-14-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-15-PLAN.md"
  - ".planning/phases/08-order-screens/08-15-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-16-PLAN.md"
  - ".planning/phases/08-order-screens/08-16-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-17-PLAN.md"
  - ".planning/phases/08-order-screens/08-17-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-18-PLAN.md"
  - ".planning/phases/08-order-screens/08-18-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-19-PLAN.md"
  - ".planning/phases/08-order-screens/08-19-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-20-PLAN.md"
  - ".planning/phases/08-order-screens/08-20-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-21-PLAN.md"
  - ".planning/phases/08-order-screens/08-21-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-22-PLAN.md"
  - ".planning/phases/08-order-screens/08-22-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-23-PLAN.md"
  - ".planning/phases/08-order-screens/08-23-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-24-PLAN.md"
  - ".planning/phases/08-order-screens/08-24-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-25-PLAN.md"
  - ".planning/phases/08-order-screens/08-25-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-26-PLAN.md"
  - ".planning/phases/08-order-screens/08-26-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-27-PLAN.md"
  - ".planning/phases/08-order-screens/08-27-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-28-PLAN.md"
  - ".planning/phases/08-order-screens/08-28-SUMMARY.md"
  - ".planning/phases/08-order-screens/08-29-PLAN.md"
  - ".planning/phases/08-order-screens/08-29-SUMMARY.md"
  - "src/Csps.Application/Orders/OrderDetailResponse.cs"
  - "src/Csps.Domain/Orders/OrderMath.cs"
  - "src/Csps.Infrastructure/Orders/OrderReader.cs"
  - "src/Csps.Server/Controllers/OrdersController.cs"
  - "tools/openapi-gen/openapi.v1.json"
  - "web/e2e/order-deleted-view.spec.ts"
  - "web/e2e/order-two-staff.spec.ts"
  - "web/e2e/target-size.spec.ts"
  - "web/src/components/lists/FilterBar.tsx"
  - "web/src/components/lists/lists.recipe.node.test.ts"
  - "web/src/components/lists/lists.recipe.ts"
  - "web/src/components/money/OrderTotals.tsx"
  - "web/src/modules/admin/components/DeleteOrderDialog.tsx"
  - "web/src/modules/admin/components/OrderDiscountModal.tsx"
  - "web/src/modules/admin/components/OrderDiscountsTab.tsx"
  - "web/src/modules/admin/components/OrderPaymentModal.tsx"
  - "web/src/modules/admin/components/OrderPaymentsTab.tsx"
  - "web/src/modules/admin/components/OrderRefundModal.tsx"
  - "web/src/modules/admin/components/OrderStatusMenu.tsx"
  - "web/src/modules/admin/components/PurgeOrderDialog.tsx"
  - "web/src/modules/admin/hooks/useOrderWindowFigures.ts"
  - "web/src/modules/admin/hooks/useOrdersListParams.ts"
  - "web/src/modules/admin/hooks/useOrdersView.ts"
  - "web/src/modules/admin/hooks/useUnsavedChangesGuard.ts"
  - "web/src/modules/admin/orderDiscountSchemas.ts"
  - "web/src/modules/admin/orderPaymentSchemas.ts"
  - "web/src/modules/admin/orderRefundSchemas.ts"
  - "web/src/modules/admin/pages/DeletedOrderPage.tsx"
  - "web/src/modules/admin/pages/DeletedOrdersPage.tsx"
  - "web/src/modules/admin/pages/OrderFormPage.tsx"
  - "web/src/modules/admin/pages/OrderPage.tsx"
  - "web/src/modules/admin/pages/OrdersPage.tsx"
  - "web/src/test/orderFixtures.ts"
  - "web/src/types/api.generated.ts"
  - "web/src/utils/dueFlag.ts"
covered_digest: "v3:sha256:fa849523ed3af7e27303bdf5f40fef0045ffd5d5f812923ba5b21b38f8564cc6"
advisory:
  - finding: "Discount window still works out money in the browser: otherDiscountsTotal and the Computed amount preview use browser math (discountAmount), not the server's per-discount amount"
    category: other
    reason: "D-94 covered the Discounts tab only; 08-29 recorded this in 08-REVIEW-DISPOSITION under WR-01. The server still decides and refuses an over-cap discount. otherDiscountsTotal could read each other discount's server amount; the preview of an unsaved discount has to be worked out before the server sees it."
    evidence_status: "read in orderDiscountSchemas.ts and OrderDiscountModal.tsx; not changed since the last report"
---

# Phase 8: Order Screens Verification Report

*Created: 2026-10-30T15:10:00-05:00 · Updated: 2026-10-31T05:08:08-05:00*

**Phase Goal:** Staff can run every order day to day in the portal. They can find an order, create one, work its detail page (items, payments, discounts, expenses, totals and estimated profit) and delete it safely.
**Verified:** 2026-10-31T10:08:08Z
**Status:** passed
**Re-verification:** Yes. The first report was stale after D-98 and the rebase onto main (Phase 7, PR #17).

## Result in plain words

The goal is met. I checked the code, not the summaries, and I ran the tests myself.

Three things were asked this time:

1. **D-98 matches the owner's ruling.** The ruling in `08-CONTEXT.md` (line 119) says the filter chip Clear button is 24 px, not 22 px, the 44 px tap area stays, the 14 px icon and 28 px chip are unchanged, only this one O-8 button changes, and it supersedes D-93. The code does exactly that. `lists.recipe.ts` now has `size-6` (24 px) on `filterChipClearClasses`, `FilterBar.tsx` still adds `targetAreaClasses` (the 44 px area), and the e2e spec in `target-size.spec.ts` expects 24 px. The unit test "draws the clear button 24px square ... (D-98)" is in `lists.recipe.node.test.ts` and passes. No `22px` remains for the Clear button in the code. `docs/CSPS-UI-SPEC.md` line 5110 carries the D-98 note.
2. **Nothing regressed after the rebase.** The Phase 7 PR (`ac0cff79`, #17) is an ancestor of HEAD, and `web/scripts/audit-gate.mjs` is present and tracked. Its test file `audit-policy.test.ts` passes (14 tests). The D-98 code commits are not in HEAD under their old hashes because PR #17 was squashed; the change itself is in the files (the last commit that touched `lists.recipe.ts` is `ac0cff79`).
3. **The UAT fixes are in the code.** D-94, D-95 and D-96 (plans 08-25 to 08-29) are all present, wired and tested (table below). UAT test 7 (O1, two real browsers) is now recorded as `pass` in `08-UAT.md`, so the last human item from the earlier report is closed.

I found no missing, stubbed or unwired piece, no debt marker, no inline SQL and no new trigger in the branch diff.

## D-98 check

| Ruling text (08-CONTEXT.md D-98) | Evidence | Status |
|---|---|---|
| Clear button is 24 px | `lists.recipe.ts:274-276`: `'inline-grid size-6 flex-none ...'`; unit test asserts width and height 24 | VERIFIED |
| 44 px tap area stays | `FilterBar.tsx:101`: `clsx(filterChipClearClasses, targetAreaClasses)` | VERIFIED |
| 14 px icon and 28 px chip unchanged | The D-98 diff touches only the size class and two comments in `lists.recipe.ts` and `FilterBar.tsx` | VERIFIED |
| Other O-8 small controls keep their sizes | `target-size.spec.ts` still expects 36 px for row actions, the sidebar toggle, the nav button, Edit links and the audit toggle, and all passed | VERIFIED |
| The D-71 e2e check is not changed | The tap-area check still calls `expectTapAreas(page, CHIP_CLEAR, 24, 2)` for the 44 px square; only the drawn size changed | VERIFIED |
| Supersedes D-93 | `08-CONTEXT.md:114` says "Superseded by D-98" | VERIFIED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Find orders: grid or table with a persisted choice; search; filters (status default "Active + recent", dates, product type, has balance); sort and page; overdue and days-left from Manila "today"; "Fully Paid" | VERIFIED | `OrdersPage.test.tsx`, `useOrdersView`, `useOrdersListParams`, `dueFlag.test.ts` (25) and `orderListSchemas.test.ts` pass in the 155-file web run. E2e `@orders-filters` passes on chromium and pixel. Server list tests pass (385 order integration tests). |
| 2 | Create through the UI-spec flow; "Discard changes?" on a dirty form | VERIFIED | `OrderFormPage.test.tsx`, `orderFormSchemas.test.ts` (54) pass. Owner passed the browser leave prompt (UAT 1). |
| 3 | Detail page: customer card, live totals, tabs with add/edit/delete modals, figures from the server, 409 handling, pickers, Recorded by | VERIFIED | `OrderPage.test.tsx` and the modal and tab tests pass. E2e `@orders-refunds` (2 tests) pass. 409 with Load Latest is tested in `OrderRefundModal.test.tsx` and `OrderPaymentModal.test.tsx`. |
| 4 | Staff see Order Expenses and Estimated Profit; neither appears outside the staff portal | VERIFIED | `src/test/orders-boundaries.node.test.ts` passes. |
| 5 | Safe delete: soft delete with a Yes/Cancel confirm naming child counts; Manager-only permanent delete with typed number, one transaction | VERIFIED | `DeleteOrderDialog`, `PurgeOrderDialog`, `DeletedOrdersPage`, `DeletedOrderPage` tests pass. Server delete and purge tests are in the 385-test order integration run. |
| 6 | G-08-5 D-94: each discount's amount comes from the server and the rows add up to the total | VERIFIED | `OrderMath.DiscountAmount` is public (`OrderMath.cs:108`) and `Compute` uses it (`:70`). `OrderDiscountResponse.Amount` (`OrderDetailResponse.cs:51`). `OrderReader.cs:520` fills it from `order.Subtotal`. `api.generated.ts` and `openapi.v1.json` carry `amount`. `OrderDiscountsTab.tsx:69` renders `formatPeso(negateMoney(discount.amount))` and the footer uses `order.totals.discount`. `OrderMathTests` 31 of 31 and `OrderDiscountsEndpointTests` 18 of 18 passed. |
| 7 | G-08-5 D-95: a window refuses a cap only after reading current figures; the opened version still goes to the server | VERIFIED | `useOrderWindowFigures.ts` has `refetchOnWindowFocus: 'always'`, `useReadOrderNow` and `freshCapResolver`; the three modals (Payment, Refund, Discount) import and use it. `useOrderWindowFigures.test.tsx`, the three modal tests, `OrderPaymentsTab.test.tsx` and the three schema tests pass. |
| 8 | G-08-5 D-96: opening the status menu reads the order, so Mark Completed follows current figures | VERIFIED | `OrderStatusMenu.tsx:122-124`: `openMenu` calls `void refetchOrder(order.id)`; click and arrow keys both use it (`:149`, `:182`). `OrderStatusMenu.test.tsx` passes. |

**Score:** 8/8 must-haves verified (5 roadmap criteria plus the three G-08-5 rulings). 0 present but behavior-unverified. Each state-change truth has a named passing test that I ran, and the owner passed the two-staff check O1 in the UAT.

### Deferred Items

None. No gap was moved to a later phase.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | The discount window still works out money in the browser (`otherDiscountsTotal`, the Computed amount preview). D-94 scoped only the Discounts tab column; 08-29 recorded this under WR-01 in `08-REVIEW-DISPOSITION.md`. | other | Disclosed and ruled in scope; the server still refuses an over-cap discount. Suggested follow-up: have `otherDiscountsTotal` add the server `amount` of the other discounts. |

The earlier advisory about a one-off chromium timeout in `@orders-refunds` is now cleared: both `@orders-refunds` tests passed in this run (7.9 s and 5.5 s), as did the earlier full order runs the executor reported. I saw no repeat.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Csps.Domain/Orders/OrderMath.cs` | Public null-checked `DiscountAmount` used by `Compute` | VERIFIED | Lines 70 and 108. |
| `src/Csps.Application/Orders/OrderDetailResponse.cs`, `src/Csps.Infrastructure/Orders/OrderReader.cs` | `Amount` on every discount in every order answer | VERIFIED | Built in one place (`OrderReader.cs:516-520`). |
| `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` | Snapshot and types carry `amount` | VERIFIED | 39 OpenAPI tests pass; typecheck is clean. |
| `web/src/modules/admin/hooks/useOrderWindowFigures.ts` | Shared read-and-recheck hook and resolver | VERIFIED | Used by three modals and the payments tab. |
| `OrderPaymentModal`, `OrderRefundModal`, `OrderDiscountModal`, `OrderPaymentsTab`, `OrderStatusMenu` | Windows and menu on current figures | VERIFIED | Imported, used, tested. |
| `web/e2e/order-two-staff.spec.ts` | Three two-staff journeys | VERIFIED | Ran in this verification under `@orders-two-staff` with the other greps: 22 passed. |
| `FilterBar.tsx`, `lists.recipe.ts` | 24 px Clear button (D-98) | VERIFIED | See the D-98 table. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OrderReader` | `OrderMath.DiscountAmount` | direct call over `order.Subtotal` | WIRED | Same rule that writes the stored total. |
| `OrderDiscountsTab` | server `amount` | `discount.amount` | WIRED | No browser rule left in the tab. |
| Three money windows | `useOrderWindowFigures` / `freshCapResolver` | imports and `useForm` resolver | WIRED | Each also keeps the opened order for the save version. |
| `OrderPaymentsTab.confirmDelete` | `useReadOrderNow` | read before the below-refunds sentence | WIRED | |
| `OrderStatusMenu.openMenu` | `useRefetchOrder` | `void refetchOrder(order.id)` | WIRED | Every open path. |
| `FilterBar.FilterChip` | `filterChipClearClasses` + `targetAreaClasses` | `clsx(...)` at line 101 | WIRED | 24 px drawn, 44 px tap area. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Discounts tab Amount column | `discount.amount` | `OrderReader` over the stored subtotal (`OrderMath`) | Yes | FLOWING |
| Money window cap and hint | `figures.current` | page cache, refreshed by focus and by a failed cap check | Yes | FLOWING |
| Status menu Mark Completed state | `order.totals.balance` | page cache, refreshed on open | Yes | FLOWING |
| Discount window "others" total and preview | browser `discountAmount` | the held order's kind, value and subtotal | Browser math by design (advisory 1) | OK, advisory |

### Behavioral Spot-Checks (run by this verifier on 2026-10-31, after a clear preflight; env set per process only)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole admin module, lists, money, data and utils web tests plus boundary, no-long-dash and layout guards | `npx vitest run src/modules/admin src/components/lists src/components/money src/components/data src/utils src/test/orders-boundaries.node.test.ts src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts scripts/audit-policy.test.ts` | Test Files 155 passed, Tests 4008 passed | PASS |
| D-98 unit test and audit-gate policy | `npx vitest run src/components/lists/lists.recipe.node.test.ts scripts/audit-policy.test.ts` | 2 files, 24 tests passed | PASS |
| Types | `npm run typecheck` | no output, exit 0 | PASS |
| Lint, zero warnings | `npm run lint` (`eslint . --max-warnings 0`) | exit 0, no output | PASS |
| Server discount rule | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathTests"` (`CSPS_TEST_SQL=localdb`) | total 31, failed 0 | PASS |
| Server discount answers | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderDiscountsEndpointTests"` | total 18, failed 0 | PASS |
| All order integration tests | same project, `--filter-class "*Order*"` | total 385, failed 0, succeeded 385 | PASS |
| OpenAPI snapshot and types | same project, `--filter-class "*OpenApi*"` | total 39, failed 0 | PASS |
| D-98 and refunds in a browser | `npm run e2e -- --grep "@target-size\|@orders-refunds\|@orders-filters" --project chromium` | 16 passed | PASS |
| Filters, long text and two-staff journeys | `npm run e2e -- --grep "@orders-filters\|@long-text\|@orders-two-staff" --project pixel --project chromium` | 22 passed | PASS |
| Debt markers, trigger, inline SQL in the branch diff vs `origin/main` (src, tests, tools, web/src, web/e2e) | grep of added lines for `TBD`, `FIXME`, `XXX`, `CREATE TRIGGER`, `FromSql`, `ExecuteSql`, `SqlQuery(` | nothing found; 0 added `TODO` or `HACK` | PASS |

Not re-run by me and taken from the executor's 08-29-SUMMARY: the full `dotnet test --solution Csps.slnx`, the coverage gate, `npm run verify` (all 7567 web tests, coverage, bundle budgets), and the other browsers (firefox, webkit, iphone) for the e2e suite. My runs cover the order tests, the D-98 change and the browsers named above, and nothing in them failed.

### Probe Execution

Step 7c: SKIPPED. No Phase 8 plan declares a probe script.

### Requirements Coverage

All nine phase IDs appear in at least one PLAN `requirements:` field (counts of plans: ORD-01 5, ORD-02 3, ORD-06 5, ORD-07 21, ORD-10 2, ORD-11 5, ORD-12 5, ORD-15 4, ORD-19 5). All are `[x]` in `REQUIREMENTS.md` and read "Phase 8 | Complete" in the traceability table (lines 407 to 425). No other ID maps to Phase 8, so there are no orphans. ROADMAP marks Phase 8 complete.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ORD-01 | SATISFIED | List, cards and table, server-projected list; `OrdersPage.test.tsx` and server list tests green. |
| ORD-02 | SATISFIED | Search, filters, sort, page in the URL; `orderListSchemas.test.ts`, e2e `@orders-filters` green. |
| ORD-06 | SATISFIED | Delete and purge dialogs, deleted list; tests and server delete tests green. |
| ORD-07 | SATISFIED | Detail page, tabs and modals; G-08-5 fixes verified; O1 passed in UAT. |
| ORD-10 | SATISFIED | `useOrdersView` and its URL by localStorage tests green. |
| ORD-11 | SATISFIED | `dueFlag.test.ts` (25) green. |
| ORD-12 | SATISFIED | Server `FullyPaid` and the list tests green. |
| ORD-15 | SATISFIED | `OrderFormPage.test.tsx` green; owner passed the browser prompt (UAT 1). |
| ORD-19 | SATISFIED | `orders-boundaries.node.test.ts` green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Branch diff | n/a | debt markers, inline SQL, triggers | none found | Clean |
| `orderDiscountSchemas.ts` | 125-138 | browser discount math for the other discounts | Info (advisory 1) | Disclosed under WR-01; server remains the final check |
| `OrderFormPage.tsx` | 711 lines | oversize file (IN-04) | Info | Deferred refactor, no behavior change |

### Code review findings: final outcome

`08-REVIEW-DISPOSITION.md` reads fixed 9, deferred 3 (IN-02, IN-03, IN-04), accepted 1 (IN-08, D-97). WR-01, WR-02 and WR-05 are fixed. Nothing is dropped silently.

### Owner items

All owner checks are resolved in `08-UAT.md`: tests 1, 2, 3, 4, 6 and 7 (O1) are `pass`. Test 5 is the issue that became G-08-5 (D-94 to D-97); its gap is marked `resolved_by: 08-29-PLAN.md` and I confirmed the three fixes above in the code.

One small tidy-up for the owner or orchestrator, not a gap: the UAT summary block reads `passed: 6, issues: 1`, which is the count at the time; the issue's gap is resolved.

### Human Verification Required

None. The two-staff check (O1) was the last human item and the owner passed it.

### Gaps Summary

No gap. The phase goal is achieved in the code and in the tests I ran. D-98 matches the owner's ruling, the rebase onto main (Phase 7, PR #17) did not break anything, and the UAT fixes D-94 to D-96 are in the code and working. The only open item is advisory 1 (an optional follow-up to make the discount window's "others" total use server amounts).

---

_Verified: 2026-10-31T10:08:08Z_
_Verifier: Claude (gsd-verifier)_
