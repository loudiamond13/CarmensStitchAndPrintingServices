---
phase: 08-order-screens
created: 2026-10-30T15:10:00-05:00
updated: 2026-10-30T21:07:00-05:00
verified: 2026-10-31T02:07:00Z
status: human_needed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5 roadmap success criteria verified
  trigger: "UAT gap G-08-5 (owner rulings D-94 to D-97), closed by plans 08-25 to 08-29"
  gaps_closed:
    - "WR-01 / D-94: the server sends each discount Amount and the Discounts tab shows it with no browser money math"
    - "WR-02 / D-95: payment, refund and discount windows (and the payment delete check) refresh the order and check again before refusing a cap"
    - "WR-05 / D-96: the status menu reads the order again every time it opens"
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
covered_digest: "v3:sha256:6f6c94bf8d58ddcabbc936653fcd59ce69ca2b67c83c5b82e5d5d14db4569e31"
advisory:
  - finding: "Discount window still works out money in the browser: otherDiscountsTotal and the Computed amount preview use browser math (discountAmount), not the server's per-discount amount"
    category: other
    reason: "D-94 covered the Discounts tab only; 08-29 recorded this in 08-REVIEW-DISPOSITION under WR-01. The server still decides and refuses an over-cap discount. otherDiscountsTotal could read each other discount's server amount; the preview of an unsaved discount has to be worked out before the server sees it."
    evidence_status: "read in orderDiscountSchemas.ts:125-138 and OrderDiscountModal.tsx:149-153"
  - finding: "Unexplained one-off chromium timeout in @orders-refunds (Manager works the refunds of a cancelled order), logged in deferred-items 'From plan 08-29'"
    category: other
    reason: "Passed alone three times and in two later full order runs (95 passed each); no trace was kept, so the cause is unknown. It may be a race around the refund window's over-cap read (08-28). I did not re-run e2e, so I can neither reproduce nor clear it."
    evidence_status: "none provided beyond the summary's own account"
human_verification:
  - test: "O1, end-of-phase owner check from 08-29-SUMMARY (two real browsers, two real staff, one test order)"
    expected: "(1) A opens Add Payment, B removes a payment, A types an amount the old balance refused and saves: it goes through if the server allows it, a stale version shows the conflict banner with Load Latest and the typed values kept. (2) With Add Payment open, B changes the balance, A returns to the tab: the Balance due hint follows without pressing Save. (3) B records the last payment, A opens Change Status: Mark Completed is enabled with no reason line, and completes the order. (4) On an order with a percent discount, the Discounts tab Amount column shows the peso figures, they add up to the Total discount footer, and they move when an item changes."
    why_human: "The automated journeys use one machine and made-up staff. Only a person on two devices proves the real focus and tab behavior. The owner's rule is that no human gate is auto-approved."
---

# Phase 8: Order Screens Verification Report

*Created: 2026-10-30T15:10:00-05:00 · Updated: 2026-10-30T21:07:00-05:00*

**Phase Goal:** Staff can run every order day to day in the portal. They can find an order, create one, work its detail page (items, payments, discounts, expenses, totals and estimated profit) and delete it safely.
**Verified:** 2026-10-31T02:07:00Z
**Status:** human_needed
**Re-verification:** Yes, after gap closure G-08-5 (plans 08-25 to 08-29)

## Result in plain words

Gap G-08-5 is closed in the code. I read the new server, hook, modal and menu code and ran the tests behind it myself. The three owner-ruled fixes are all there and they work: the server sends each discount amount (D-94), the money windows read the order again before they refuse an amount (D-95), and the status menu reads the order every time it opens (D-96). I found no missing, stubbed or unwired piece and no debt marker. The five original roadmap criteria still hold; I re-ran their test files.

The status stays `human_needed` for one reason: the owner's end-of-phase check O1 (two real browsers, two real staff) has not been done, and the owner's rule is that no human gate is auto-approved. The other owner items from the first report were passed or ruled in UAT (tests 1 to 4 and 6), so only O1 remains.

I did not re-run the Playwright suite or the full .NET and web suites. The e2e and full-gate numbers below are the executor's own, from 08-29-SUMMARY, and are marked as not re-run.

## Gap G-08-5: is it closed

| Ruling | What it demanded | Evidence in the code | Status |
|--------|------------------|----------------------|--------|
| D-94 (WR-01) | Server sends each discount `Amount`; Discounts tab shows it and does no money math | `OrderMath.DiscountAmount` is public and null-checked (`OrderMath.cs:108`); `Compute` uses the same rule (`:70`). `OrderDiscountResponse` has `Amount` (`OrderDetailResponse.cs:51`). `OrderReader.cs:516-520` fills it from `order.Subtotal`. `api.generated.ts:2520-2525` carries `amount`. `OrderDiscountsTab.tsx` cell is `formatPeso(negateMoney(discount.amount))`; the footer is `order.totals.discount`. | VERIFIED |
| D-95 (WR-02) | Windows keep the instant cap check, refresh on focus and on a failed cap check, then check again | `useOrderWindowFigures.ts`: `refetchOnWindowFocus: 'always'` on the window's own observer; `useReadOrderNow` reads once through `queryClient.query` with a 1 s stale time and returns null on failure; `freshCapResolver` checks held figures, and only when a cap error shows does it read and check again. Used by `OrderPaymentModal.tsx:146,165`, `OrderRefundModal.tsx:147,168`, `OrderDiscountModal.tsx:143,163`. Each window keeps `opened.order` for the version a save sends, so the server's 409 and Load Latest still guard. `OrderPaymentsTab.tsx` `confirmDelete` reads the order once more before it shows the below-refunds sentence. | VERIFIED |
| D-96 (WR-05) | Refetch the order when the status menu opens | `OrderStatusMenu.tsx:122-125`: `openMenu` sets the state and calls `void refetchOrder(order.id)`; click, Enter, Space and the arrow keys all go through it (`:149`, `:182`). | VERIFIED |

Also checked: D-97 (leave IN-08 and the Orders list business day as built) needed no code and none changed. Nothing was added or bumped in packages, the schema or triggers.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Find orders: grid or table with a persisted choice; search; filters; sort and page; overdue and days-left from Manila "today"; "Fully Paid" | VERIFIED (regression check) | `OrdersPage.test.tsx` green in this run (part of 6 files, 266 tests). Code unchanged by 08-25 to 08-29 (diff of `OrdersPage`, `useOrdersView`, `useOrdersListParams`, `dueFlag` empty over `5f8ae2f7..HEAD`). |
| 2 | Create through the UI-spec flow; "Discard changes?" on a dirty form | VERIFIED (regression check) | `OrderFormPage.test.tsx` green in this run. Owner passed the browser prompt in UAT test 1. |
| 3 | Detail page: customer card, live totals, tabs with add/edit/delete modals, figures from the server, 409 handling, pickers, Recorded by | VERIFIED | `OrderPage.test.tsx` green. The Discounts tab now shows server amounts (G-08-5 D-94 above), which removes the earlier W1 warning for the tab column. The 409 path is kept and tested: "answers 409 with the banner and Load Latest when someone else changed the order meanwhile" passes in `OrderRefundModal.test.tsx`; the payment equivalent is in `OrderPaymentModal.test.tsx`. |
| 4 | Staff see Order Expenses and Estimated Profit on the detail page; neither appears outside the staff portal | VERIFIED (regression check) | `src/test/orders-boundaries.node.test.ts`: 10 tests green in this run. |
| 5 | Safe delete: soft delete with a Yes/Cancel confirm naming child counts; Manager-only permanent delete with typed number | VERIFIED (regression check) | `DeleteOrderDialog.test.tsx`, `PurgeOrderDialog.test.tsx`, `DeletedOrdersPage.test.tsx` green in this run. |
| 6 | G-08-5 D-94: each discount's amount comes from the server and the rows add up to the total | VERIFIED | Server: `OrderMathTests` 31 of 31 and `OrderDiscountsEndpointTests` 18 of 18 passed in this run; the class holds `AFivePercentDiscountAnswerAndReadCarryTheServerAmount`, `AFixedDiscountAfterItCarriesItsOwnAmountAndTheAmountsAddUpToTheDiscountTotal`, `AnItemChangeMovesAPercentageDiscountAmountToTheNewSubtotal` and `AManagersDeletedOrderReadCarriesTheSameDiscountAmounts`. Web: `OrderDiscountsTab.test.tsx` green. |
| 7 | G-08-5 D-95: a window refuses a cap only after reading current figures; the opened version still goes to the server | VERIFIED | `useOrderWindowFigures.test.tsx`, `OrderPaymentModal.test.tsx`, `OrderRefundModal.test.tsx`, `OrderDiscountModal.test.tsx`, `OrderPaymentsTab.test.tsx` and the three schema tests: 10 files, 308 tests passed in this run. These include "reads once, then sends an amount the old credit refused, still with the opened version", "sends no read for an amount the held figures already allow", "keeps the held figures in the words when the read fails" and "still sends the opened version after a focus read". |
| 8 | G-08-5 D-96: opening the status menu reads the order, and Mark Completed follows the current figures | VERIFIED | `OrderStatusMenu.test.tsx` passed in the same run, including "reads the order once more when the menu opens with %s, and enables Mark Completed", "disables Mark Completed, with its reason, when the answer brings a new balance, and focus stays on the item" and "sends the move to completed once a payment from another session settled the balance". |

**Score:** 8/8 must-haves verified (5 roadmap criteria plus the three G-08-5 rulings). 0 present but behavior-unverified: each state-change truth has a named passing test that I ran. The two-staff end-to-end behavior against a real server has an e2e spec (below) that I read but did not run; it is covered by the human item O1.

### Deferred Items

None. No gap was moved to a later phase.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | The discount window still works out money in the browser (`otherDiscountsTotal`, the Computed amount preview). D-94 scoped only the Discounts tab column; 08-29 recorded this under WR-01 in `08-REVIEW-DISPOSITION.md`. | other | Disclosed and ruled in scope; the server still refuses an over-cap discount. Suggested follow-up: have `otherDiscountsTotal` add the server `amount` of the other discounts. |
| 2 | Unexplained one-off chromium timeout in `@orders-refunds` ("a Manager works the refunds of a cancelled order without reopening it"), 120 s waiting on Save Refund. | other | Passed alone three times and in two later full order runs (95 passed each). No trace kept. I did not run e2e, so it is neither reproduced nor cleared. It sits in the refund window's over-cap read added by 08-28, so it deserves one traced re-run before ship. |

### Required Artifacts (gap closure)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Csps.Domain/Orders/OrderMath.cs` | Public null-checked `DiscountAmount` used by `Compute` | VERIFIED | Lines 70 and 108; fails loudly on an unknown kind. |
| `src/Csps.Application/Orders/OrderDetailResponse.cs`, `src/Csps.Infrastructure/Orders/OrderReader.cs` | `Amount` on every discount in every order answer | VERIFIED | Built in one place (`OrderReader.cs:516`), which every order answer goes through. |
| `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` | Snapshot and types carry `amount` | VERIFIED | `api.generated.ts:2525`. 08-29 reports the types check green (not re-run). |
| `web/src/modules/admin/hooks/useOrderWindowFigures.ts` | Shared read-and-recheck hook and resolver | VERIFIED | 76 lines, used by three modals and the payments tab. |
| `OrderPaymentModal`, `OrderRefundModal`, `OrderDiscountModal`, `OrderPaymentsTab`, `OrderStatusMenu` | Windows and menu on current figures | VERIFIED | Imported and used; tests pass. |
| `web/e2e/order-two-staff.spec.ts` | Three two-staff journeys | VERIFIED (read, not run) | Three `@orders-two-staff` tests; a second `browser.newContext` closed in a `finally` (line 34). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OrderReader` | `OrderMath.DiscountAmount` | direct call over `order.Subtotal` | WIRED | Same rule that writes the stored total. |
| `OrderDiscountsTab` | server `amount` | `discount.amount` | WIRED | No browser rule left in the tab. |
| Three money windows | `useOrderWindowFigures` / `freshCapResolver` | imports and `useForm` resolver | WIRED | Each also keeps `opened.order` for the save version. |
| `OrderPaymentsTab.confirmDelete` | `useReadOrderNow` | read before the below-refunds sentence | WIRED | |
| `OrderStatusMenu.openMenu` | `useRefetchOrder` | `void refetchOrder(order.id)` | WIRED | Every open path. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Discounts tab Amount column | `discount.amount` | `OrderReader` over the stored subtotal (`OrderMath`) | Yes | FLOWING |
| Money window cap and hint | `figures.current` | page cache, refreshed by focus and by a failed cap check | Yes | FLOWING |
| Status menu Mark Completed state | `order.totals.balance` | page cache, refreshed on open | Yes | FLOWING |
| Discount window "others" total and preview | browser `discountAmount` | the held order's kind, value and subtotal | Browser math by design (advisory 1) | OK, advisory |

### Behavioral Spot-Checks (run by this verifier on 2026-10-30, after a clear preflight)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Gap-closure web tests (tab, three windows, payments tab, status menu, window hook, three schemas) | `npm --prefix web run test -- --run` on the 10 files | Test Files 10 passed, Tests 308 passed | PASS |
| Original truths regression (list, detail, form, delete and purge dialogs, deleted list) | same runner on 6 page and dialog test files | Test Files 6 passed, Tests 266 passed | PASS |
| Boundary and no-long-dash guards | same runner on `src/test/orders-boundaries.node.test.ts`, `src/test/no-long-dash.node.test.ts` | 2 files, 11 tests passed | PASS |
| Server discount rule | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathTests"` (`CSPS_TEST_SQL=localdb` for the process) | total 31, failed 0 | PASS |
| Server discount answers | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderDiscountsEndpointTests"` | total 18, failed 0 | PASS |
| Debt markers, inline SQL, triggers in the gap-closure diff (`5f8ae2f7..HEAD`, src, tests, tools, web/src, web/e2e) | grep of added lines for `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`, `CREATE TRIGGER`, `FromSql`, `ExecuteSql`, `SqlQuery` | nothing found | PASS |
| No package change | `git diff --stat 5f8ae2f7..HEAD` on `web/package.json`, lockfile, `Directory.Packages.props` | empty | PASS |
| All seven plan commits exist | `git cat-file -t` on the seven hashes named in the summaries | seven `commit` | PASS |

Taken from 08-29-SUMMARY and not re-run by me: `dotnet build Csps.slnx` 0 warnings; `dotnet test --solution Csps.slnx` total 6235, failed 0, skipped 2; coverage gate passed (Domain 100 percent line and branch, Application 99.1 percent line); OpenAPI types check match; `npm --prefix web run verify` exit 0 (7567 tests, branches 90.81 percent, bundles inside budget); order e2e set third full run 95 passed; `@orders-two-staff` alone 15 of 15 twice.

### Probe Execution

Step 7c: SKIPPED. No Phase 8 plan declares a probe script.

### Requirements Coverage

All nine phase IDs appear in at least one PLAN frontmatter, are `[x]` in REQUIREMENTS.md and read "Phase 8 | Complete" in the traceability table (lines 407 to 425). Plans 08-25 to 08-29 declare `requirements: [ORD-07]`. No other ID in REQUIREMENTS.md maps to Phase 8, so there are no orphans.

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| ORD-01 | 08-01, 08-06, 08-12, 08-24 and others | SATISFIED | Unchanged since the first report; `OrdersPage.test.tsx` green again. |
| ORD-02 | 08-09 and others | SATISFIED | Same. |
| ORD-06 | 08-03, 08-20, 08-22, 08-23 and others | SATISFIED | Delete and purge dialog tests green again; 08-29 fixed a racy wait in the deleted-view e2e (test-only). |
| ORD-07 | most plans, including 08-25 to 08-29 | SATISFIED | Detail page, tabs and modals; G-08-5 fixes verified above. Owner check O1 pending. |
| ORD-10 | 08-11 | SATISFIED | `useOrdersView` unchanged. |
| ORD-11 | 08-04 and others | SATISFIED | `dueFlag.ts` unchanged. |
| ORD-12 | 08-12 and others | SATISFIED | Server `FullyPaid` unchanged. |
| ORD-15 | 08-13 and others | SATISFIED | `OrderFormPage.test.tsx` green; owner passed the browser prompt in UAT test 1. |
| ORD-19 | 08-12, 08-24 and others | SATISFIED | `orders-boundaries.node.test.ts` green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Gap-closure diff | n/a | debt markers, inline SQL, triggers | none found | Clean |
| `orderDiscountSchemas.ts` | 125-138 | browser discount math for the other discounts | Info (advisory 1) | Disclosed under WR-01; server remains final check |
| `OrderFormPage.tsx` | 711 lines | oversize file (IN-04) | Info | Deferred refactor, no behavior change |

### Code review findings: final outcome

`08-REVIEW-DISPOSITION.md` now reads fixed 9, deferred 3 (IN-02, IN-03, IN-04), accepted 1 (IN-08, D-97). WR-01, WR-02 and WR-05 are fixed; WR-03's follow-up is left as built (D-97). Nothing is dropped silently.

### Other owner items from the first report

All resolved in `08-UAT.md`: browser leave prompt passed (1), screenshot review passed (2), SPEC-GAP copy accepted (3), UI rulings D-90 to D-93 recorded (4, including the chip Clear buttons staying 22 px and the owner accepting the axe `target-size` failures), DOM-WR-04 read passed (6). Note: `08-UAT.md` still lists gap G-08-5 with `status: failed`. It should be marked closed once the owner passes O1.

### Human Verification Required

**1. O1: two browsers, two staff, one test order**

**Test:** Sign in as two staff in two browsers on one test order. (a) Open Add Payment in the first; in the second, delete a payment; in the first, type an amount the old balance refused and save. (b) With Add Payment open, change the balance in the other browser and return to the first tab. (c) Have the second browser record the last payment, then in the first open Change Status. (d) On an order with a percent discount, read the Discounts tab.
**Expected:** (a) The save goes through if the server allows it; a stale version shows the conflict banner with Load Latest and keeps what was typed. (b) The Balance due hint follows without pressing Save. (c) Mark Completed is enabled with no reason line, and completes the order. (d) Peso amounts show, add up to the Total discount footer, and move when an item changes.
**Why human:** The automated journeys use one machine and made-up staff. The owner's rule: no human gate is auto-approved.

### Gaps Summary

No gap. G-08-5 is closed in the code and in the tests I ran. The remaining items are the owner's O1 check, one traced re-run of the intermittent `@orders-refunds` chromium test before ship (advisory), and an optional follow-up to make `otherDiscountsTotal` use the server amounts (advisory).

---

_Verified: 2026-10-31T02:07:00Z_
_Verifier: Claude (gsd-verifier)_
