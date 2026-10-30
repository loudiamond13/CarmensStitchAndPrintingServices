---
phase: 08-order-screens
created: 2026-10-30T15:10:00-05:00
updated: 2026-10-30T15:10:00-05:00
verified: 2026-10-30T20:10:00Z
status: human_needed
score: 5/5 roadmap success criteria verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
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
  - "src/Csps.Infrastructure/Orders/OrderReader.cs"
  - "src/Csps.Server/Controllers/OrdersController.cs"
  - "web/src/components/money/OrderTotals.tsx"
  - "web/src/modules/admin/components/DeleteOrderDialog.tsx"
  - "web/src/modules/admin/components/PurgeOrderDialog.tsx"
  - "web/src/modules/admin/hooks/useOrdersListParams.ts"
  - "web/src/modules/admin/hooks/useOrdersView.ts"
  - "web/src/modules/admin/hooks/useUnsavedChangesGuard.ts"
  - "web/src/modules/admin/pages/DeletedOrderPage.tsx"
  - "web/src/modules/admin/pages/DeletedOrdersPage.tsx"
  - "web/src/modules/admin/pages/OrderFormPage.tsx"
  - "web/src/modules/admin/pages/OrderPage.tsx"
  - "web/src/modules/admin/pages/OrdersPage.tsx"
  - "web/src/utils/dueFlag.ts"
covered_digest: "v3:sha256:8803083131e4949d59854d1205d915ed7f77227a54f5f34cc5f8d689075bb09d"
human_verification:
  - test: "Browser leave prompt on a dirty form (ORD-15, manual row in 08-VALIDATION)"
    expected: "On New Order and Edit Order, change a field, then reload or close the tab: the browser asks to confirm. A clean or saved form never asks."
    why_human: "The browser owns this dialog. A test can only prove that the page asks for the prompt (it does), not that the browser shows it."
  - test: "UIC-71 screenshot review (run `npm --prefix web run review`)"
    expected: "Orders, New Order, Order detail and Deleted Orders look right in Blush and Espresso at 390, 820 and 1440 px. Look hard at the four overflow fixes from 08-24: header subline, balance figure, order card title, card footer buttons wrapping at about 222 px."
    why_human: "08-UI-REVIEW was a static code audit with no screenshots (17/24). Visuals, colour and spacing are unseen."
  - test: "SPEC-GAP copy review (about 25 strings in ordersCopy, orderPageCopy, orderFormCopy, orderWindowsCopy, orderPaymentCopy, orderDiscountCopy, orderRefundCopy, deletedOrdersCopy, orderListsCopy)"
    expected: "Owner accepts or rewrites each sentence. Flag first: the admin not-found wording, the No-matches line, 'Product: Loading...', '7 fields need attention' on an untouched form, 'Balance now' after a refund on a Cancelled order."
    why_human: "Wording and tone are the owner's call; the UI spec has no text for these."
  - test: "Owner rulings parked in deferred-items (Delivered badge tone, Grid/Table switch keeping the page, off-spec font sizes 17/18/24/28 px, chip Clear buttons under 44 px)"
    expected: "A decision on each. The chip Clear buttons (about 22 px) fail axe target-size on the pixel project in @orders-filters, so that one is a real quality-bar failure until ruled."
    why_human: "Each changes the look or an owner rule."
  - test: "Code review findings WR-01, WR-02, WR-05 and the WR-03 follow-up (08-REVIEW-DISPOSITION, deferred-items 'From the end-of-phase code review')"
    expected: "Owner picks an option for each. WR-01: server sends each discount amount (recommended) or keep browser math. WR-02 and WR-05: refresh figures when a window or the status menu opens (recommended), or let the server decide."
    why_human: "Each changes behavior, the API or the OR-3 rule."
  - test: "DOM-WR-04 reminder carried from Phase 7: read LegacyEditFilter.cs and the six UpdateOrder*Handler.cs files"
    expected: "Unchanged legacy values do not block an edit; changed fields are fully checked."
    why_human: "Loosens validation on the money path; flagged for a human read in 07-VERIFICATION and STATE.md."
---

# Phase 8: Order Screens Verification Report

*Created: 2026-10-30T15:10:00-05:00 · Updated: 2026-10-30T15:10:00-05:00*

**Phase Goal:** Staff can run every order day to day in the portal. They can find an order, create one, work its detail page (items, payments, discounts, expenses, totals and estimated profit) and delete it safely.
**Verified:** 2026-10-30T20:10:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

## Result in plain words

The goal is met in the code. I read the pages, hooks and server pieces behind each roadmap success criterion, and I ran the key tests myself. All five criteria hold. I found no missing, stubbed or unwired piece, and no debt marker.

The status is `human_needed`, not `passed`, for three reasons:

1. Owner-only checks are still pending: the browser leave prompt, the screenshot review (UIC-71) and the SPEC-GAP copy review. I did not mark any of them passed.
2. Seven code review findings and several UI rulings wait on the owner (listed below). Three of the review findings (WR-01, WR-02, WR-05) touch the Core Value rule "the client never computes totals" or the OR-3 rule, so they are real decisions.
3. The full end-to-end run was not green (46 of 1428 failed). One failure is on a Phase 8 screen and is a real quality-bar miss: the filter chip Clear buttons are about 22 px and fail axe `target-size` in `@orders-filters` on the pixel project. The other failures fail the same way before Phase 8 started, or passed on re-run.

If the owner wants the 44 px touch target and zero axe violations enforced strictly on Orders, the chip Clear item becomes a gap and the status becomes `gaps_found`. I kept it as an open owner call because 08-24 logged it as one, the same class of failure exists before Phase 8 (`@long-text four-chip toolbars`), and it breaks none of the five roadmap criteria.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, with the 2026-10-29 notes applied)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Find orders: grid or table with a persisted choice; search by number, customer, team, phone; filter by status (default Active + recent), date range, product type, has balance; sort and page; overdue and days-left flags from Manila "today"; "Fully Paid" when Total > 0 and Balance <= 0 | VERIFIED | `OrdersPage.tsx` renders `OrderCard` grid or `OrdersTable` from `useOrdersQuery`. `useOrdersListParams.ts` keeps page, size, `q`, status, dates, from/to, productType, hasBalance, sort and view in the URL (status default `active`, sort default `due`). `ordersService.list` sends all of them. `OrderReader.cs:90-93` searches Number, CustomerName, TeamName and ContactNumber with an escaped LIKE. `dueFlag.ts` takes `today` as input (no device clock; `orders-boundaries.node.test.ts` forbids it in order screens). Fully Paid comes from the server field (`Order.FullyPaid`, `OrderDetailResponse.cs:151`) and is shown by `OrderTotals`, `OrderBalanceStrip` and `OrdersTable`. I ran `OrdersPage.test.tsx`, `useOrdersView.test.tsx`, `DueFlag.test.tsx` (green) and server `ListOrdersEndpointTests` (green). |
| 2 | Create through the UI-spec flow; leaving a create or edit form with unsaved changes asks "Discard changes?" | VERIFIED | Routes `orders/new` and `orders/:id/edit` both load `OrderFormPage`, which calls `ordersService.create` (with an Idempotency-Key) and `updateDetails` (with the opened version). `useUnsavedChangesGuard` holds in-app moves with `useBlocker` and asks the browser for its prompt with `useBeforeUnload`; `orderFormCopy.ts:87` holds the title "Discard changes?"; the dialog is wired at `OrderFormPage.tsx:364` and `:612`. I ran `OrderFormPage.test.tsx` (including the dirty-only `beforeunload` test, the pending-save case and the save/409 cases) and `useUnsavedChangesGuard.test.tsx`: green. The browser's own dialog is a manual check (human item 1). |
| 3 | Detail page: customer card, live OrderTotals, tabbed Items/Payments/Discounts/Expenses with counts and add/edit/delete modals; figures from the server after each save; a 409 explains itself, keeps input and offers a reload; Received by and Paid by pickers; Recorded by / Last changed by | VERIFIED | `OrderPage.tsx` mounts `OrderHeader`, `OrderCustomerCard`, `OrderTotals`, the tab card (tab kept in the URL) and the four tab components, each with its own add/edit modal (`OrderItemModal`, `OrderPaymentModal`, `OrderDiscountModal`, `OrderExpenseModal`, plus `OrderRefundModal`). `useApplyOrder` sets the server answer and computes nothing (T-08-20). `useOrderChildSave.ts:118` turns a 409 `EDIT_STALE` into a conflict banner that keeps typed values and offers Load Latest. `PaidBySelect` takes the "Received by" and "Paid by" labels. `RecordMeta` is in the header, all five modals and the edit aside (grep). I ran `OrderPage.test.tsx` and `OrderFormPage.test.tsx` (conflict banner keeps values, Load Latest replaces values and version): green. Exception, see WARNING W1: the per-row discount amount is browser math (WR-01); the totals are the server's. |
| 4 | Internal figures: staff see Order Expenses and Estimated Profit on the detail page; neither appears outside the staff portal | VERIFIED | The only users of the words and fields are `OrderTotals.tsx` (panel variant only, `showInternal = variant === 'panel' && expenses/profit defined`), `OrderExpenseModal`, `OrderExpensesTab`, `OrderPage` and `orderExpensesService`. The card variant used by the list shows Total only. `orders-boundaries.node.test.ts` (ran, 10 tests green) fails the build if `modules/public` or `PublicLayout` names the internal figures. No quote or public server response carries them (grep of `src`). |
| 5 | Safe delete (as superseded by 07 D-26 to D-28 and 08 D-21 to D-24): a soft delete with a Yes/Cancel confirm that names the child counts; only a Manager's permanent delete requires typing the order number and removes the order and children in one transaction | VERIFIED | `DeleteOrderDialog.tsx` builds "Its 3 items, 2 payments ... are hidden ... A Manager can restore it." from the page's arrays, then calls `ordersService.remove`. `PurgeOrderDialog.tsx` is a `ConfirmDialog` with `confirmText={number}`, a counts box and the typed-number rule. The server refuses a wrong number (`PermanentlyDeleteOrderHandler.cs:49`, `ConfirmMismatch`) and removes the order in one `SaveChangesAsync`. Routes `orders/deleted` and `orders/deleted/:id` use `requireManagerLoader` (Admin goes back to Orders); the API refuses Admin with 403 (`OrdersController.cs:223-224`, authorization matrix). I ran `DeleteOrderDialog.test.tsx`, `PurgeOrderDialog.test.tsx`, `DeletedOrdersPage.test.tsx` (green) and server `OrderDeletionTests` (green, 60 of 60 with the list tests). |

**Score:** 5/5 roadmap success criteria verified. 0 present but behavior-unverified: every state-change truth (409 keeps input, dirty-only prompt, view matrix, role gates, typed-number confirm) has a named passing behavioral test that I ran.

### Deferred Items

None. No gap was moved to a later phase. Phase 9 (images) is not claimed by any Phase 8 truth: the detail page shows "Image uploads are coming soon." by owner ruling D-27.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/modules/admin/pages/OrdersPage.tsx` (376 lines) | List with grid/table, toolbar, chips, paging | VERIFIED | Real queries, skeleton, error and empty states. |
| `web/src/modules/admin/pages/OrderPage.tsx` (328), `OrderFormPage.tsx` (711) | Detail and create/edit form | VERIFIED | Wired to services and modals. |
| `web/src/modules/admin/pages/DeletedOrdersPage.tsx`, `DeletedOrderPage.tsx` | Manager-only deleted list and read-only view with Restore and permanent delete | VERIFIED | Behind `requireManagerLoader`. |
| `web/src/modules/admin/components/` (38 Phase 8 order files, each with a test) | Header, tabs, modals, status menu, dialogs, aside | VERIFIED | Imported and used by the pages (grep of imports). |
| `web/src/modules/admin/hooks/useOrdersView.ts`, `useOrdersListParams.ts`, `useUnsavedChangesGuard.ts` | View choice, URL state, leave guard | VERIFIED | Read in full. |
| `web/src/modules/admin/services/orders*Service.ts` (orders, items, payments, discounts, expenses, refunds, deleted, lists) | Per-module API calls (OR-5) | VERIFIED | Built over `apiClient`; none touches `fetch`. |
| `src/Csps.Infrastructure/Orders/OrderReader.cs`, `src/Csps.Application/Orders/ListOrdersHandler.cs`, `GetDeletedOrderHandler.cs`, `src/Csps.Server/Controllers/OrdersController.cs` | List rows with piece count and list-wide counts, deleted read, Manager gate | VERIFIED | `OrderReaderQueryCountTests`, `OrderListTimingTests`, `OrderDeletionTests`, `ListOrdersEndpointTests` green per the orchestrator; the last two I re-ran. |
| `TestingOrdersController.cs` | E2E seed, Debug only | VERIFIED | Inside `#if CSPS_TESTING`; `ReleaseHasNoEmailSinkTests` covers the Release scan. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routes.tsx` | the five order pages | lazy routes, static `new` and `deleted` before `:id` | WIRED | Lines 90-111, 174-184. |
| `OrdersPage` | API list | `useOrdersQuery` then `ordersService.list` | WIRED | All filters in the query. |
| `OrdersPage` | view choice | `useOrdersView` (URL, then localStorage, then grid) | WIRED | Only the toggle writes. |
| `OrderPage` | child modals | tab components then modal components then child services | WIRED | Each modal sends the opened version (T-08-26). |
| `OrderHeader` | status menu and Delete dialog | `OrderStatusMenu`, `DeleteOrderDialog` | WIRED | |
| `OrderFormPage` | leave guard | `useUnsavedChangesGuard` at two call sites | WIRED | `allowLeave()` before the post-save move. |
| `DeletedOrderPage` | Restore and permanent delete | `deletedOrdersService.restore` / `purge`, `PurgeOrderDialog` | WIRED | |
| Write success | page figures | `useApplyOrder` sets the server answer | WIRED | The client computes no total. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Orders cards and table | rows, list-wide counts, business today | `GET /orders` then `OrderReader` projection (3 commands, `OrderListQueryCountTests`) | Yes | FLOWING |
| Detail totals panel | subtotal, discount, total, paid, refunded, balance, credit, expenses, profit, fullyPaid | `OrderDetailResponse` from `Order.Recalculate` | Yes | FLOWING |
| Discounts tab row amount | per-row peso amount | browser `discountAmount` over server subtotal | Computed in the browser | WARNING W1 (WR-01), the footer total is the server's |
| Deleted orders list and view | rows, child counts | `OrderReader` with soft-delete filter lifted, Manager only | Yes | FLOWING |

### Behavioral Spot-Checks (run by this verifier on 2026-10-30)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| View choice matrix, due flags, leave guard, internal-figure boundary, no long dash | `npm --prefix web run test -- --run` on `useOrdersView`, `DueFlag`, `useUnsavedChangesGuard`, `orders-boundaries.node`, `no-long-dash.node` | 5 files, 65 tests passed | PASS |
| List, detail, form, delete and purge dialogs, deleted list | same runner on `OrdersPage`, `OrderPage`, `OrderFormPage`, `DeleteOrderDialog`, `PurgeOrderDialog`, `DeletedOrdersPage` | 6 files, 266 tests passed | PASS |
| Server list and delete rules | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListOrdersEndpointTests" --filter-class "*OrderDeletionTests"` (after the preflight: ports free, no other project's tests running) | total 60, failed 0 | PASS |
| Debt markers in the Phase 8 diff (`61c6beb4..HEAD`, src, tests, tools, web/src, web/e2e) | grep added lines for `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER` | none | PASS |
| No trigger or inline SQL, no package or migration change | grep of the diff for `CREATE TRIGGER`, `FromSql`, `ExecuteSql`, `SqlQuery`; `git diff --stat` on `package.json`, lockfile, `Directory.Packages.props`; migration file names | nothing found | PASS |

Taken from the orchestrator's run on the current HEAD (not re-run by me): `dotnet build Csps.slnx` 0 warnings; `dotnet test --solution Csps.slnx` 6226 total, 0 failed, 2 skipped; web typecheck, lint, prettier clean; vitest 268 files, 7498 tests; `npm --prefix web run verify` exit 0, branches 90.74 percent; chromium order e2e 21 passed after the review fixes; 08-24 `@orders-journeys` 25 of 25 across 5 projects and `@orders-sweep` green.

### Probe Execution

Step 7c: SKIPPED. No Phase 8 plan declares a probe script.

### Requirements Coverage

All nine IDs in the ROADMAP appear in at least one PLAN frontmatter, are `[x]` in REQUIREMENTS.md and read "Phase 8 | Complete" in the traceability table. No other ID in REQUIREMENTS.md maps to Phase 8, so there are no orphans. (ORD-03, ORD-08, ORD-22 and ORD-23 stay mapped to Phase 7; Phase 8 delivers their UI per the ROADMAP note.)

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ORD-01 | 08-01, 08-06, 08-12, 08-24 and others | Paginated list, grid or table, figures, lazy thumbnail, no N+1 | SATISFIED | `OrdersPage`, `OrdersTable`, `OrderCard`; `OrderReaderQueryCountTests`; `OrderListTimingTests` |
| ORD-02 | 08-09 and others | Search, filters, sort, server paging, state in the URL | SATISFIED | `useOrdersListParams`, `OrdersToolbar`, `OrderReader.cs:90-93` |
| ORD-06 | 08-03, 08-20, 08-22, 08-23 and others | Soft delete for both roles; Manager-only restore and permanent delete with typed number | SATISFIED | `DeleteOrderDialog`, `PurgeOrderDialog`, `OrderDeletionTests`, authorization matrix row |
| ORD-07 | most plans | Detail page: tabs with counts, modals, totals, customer card, tab in URL | SATISFIED | `OrderPage` and tab/modal components. Gallery shows "coming soon" by D-27 (Phase 9 owns uploads). |
| ORD-10 | 08-11 | View choice persists, URL then localStorage then grid | SATISFIED | `useOrdersView.ts`; 23-test matrix green |
| ORD-11 | 08-04 and others | Overdue and days-left from Manila "today" | SATISFIED | `dueFlag.ts`, `DueFlag.test.tsx` (20 green) |
| ORD-12 | 08-12 and others | Fully Paid when Total > 0 and Balance <= 0 | SATISFIED | Server `FullyPaid`; `OrderTotals`, `OrdersTable`, `OrderBalanceStrip`. Fixture 0151 is proved by unit tests; the e2e seeds an equivalent paid-in-full order instead (deferred-items 08-24 item 5). |
| ORD-15 | 08-13 and others | "Discard changes?" on a dirty create or edit form | SATISFIED | `useUnsavedChangesGuard`; browser prompt is manual (human item 1) |
| ORD-19 | 08-12, 08-24 and others | Order Expenses and Estimated Profit, staff only | SATISFIED | `OrderTotals` panel variant; `orders-boundaries.node.test.ts` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Phase 8 diff | n/a | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER` added | none found | Clean |
| Phase 8 diff | n/a | inline SQL, `CREATE TRIGGER` | none found | OR-7 and the no-inline-SQL rule hold |
| `OrderFormPage.tsx` | 711 lines | oversize file, double cast (IN-04) | Info | Deferred refactor, no behavior change |
| `orderForm.recipe.ts`, `orderPage.recipe.ts`, `orders.recipe.ts` | n/a | font sizes 17, 18, 24, 28 px outside the UI spec | Warning | Owner call (08-UI-REVIEW fix 1) |

### Code review findings

`08-REVIEW.md` has 13 findings (0 critical, 5 warning, 8 info). `08-REVIEW-DISPOSITION.md` gives each one an outcome: 6 fixed (WR-03, WR-04, IN-01, IN-05, IN-06, IN-07), 7 deferred (WR-01, WR-02, WR-05, IN-02, IN-03, IN-04, IN-08 skipped), 0 accepted. Nothing was dropped silently. The fixes have a red and a green commit; I did not re-check each hash. HEAD builds and the post-fix suites are green per the orchestrator.

Warnings that matter for sign-off:

- **W1 (WR-01).** Each discount's peso amount on the Discounts tab is worked out in the browser; the server sends only kind and value. The footer total and every order total are the server's, so no total is wrong. It still pulls against "the client never computes totals". Recommended fix: the server sends each amount.
- **W2 (WR-02, WR-05).** Payment, refund and discount caps, and the Mark Completed button, check the page's last answer. After another staff member's change, a valid action can be refused in the browser, and Load Latest does not appear for the refused case. Recommended fix: refresh the figures when the window or menu opens.

Neither breaks a roadmap criterion: the server stays the final check and a 409 is handled. Both need an owner choice.

### Human Verification Required

See the `human_verification` list in the frontmatter. In short:

1. **Browser leave prompt** on a dirty New Order or Edit Order form. The page asks for it (tested); only a person can see the browser show it.
2. **Screenshot review (UIC-71)**: `npm --prefix web run review`, Blush and Espresso, 390, 820 and 1440 px. No screenshot of these screens has been looked at by anyone.
3. **SPEC-GAP copy review** of about 25 strings.
4. **Owner rulings**: Delivered badge tone, Grid/Table keeping the page, off-spec font sizes, chip Clear buttons (22 px, fails axe `target-size` in `@orders-filters` on pixel).
5. **Code review decisions**: WR-01, WR-02, WR-05, WR-03 follow-up, IN-08.
6. **DOM-WR-04 read** of `LegacyEditFilter.cs` and the six update handlers (carried from Phase 7).

### Gaps Summary

No gap against the five roadmap success criteria or the nine requirement IDs. The open items are owner decisions and manual checks, plus one real quality-bar miss (chip Clear buttons under 44 px) that the owner has not ruled on.

Full e2e state, for the record: first run 1428 passed, 46 failed, 50 skipped. Fourteen of the failures fail the same way at `5118c182`, before plan 08-24 (`@dialog-fit`, `@long-text four-chip toolbars`, `@shell` pinning on firefox and iphone). The dialog-fit cause (a 559 px dialog against a 553 px allowance) is not investigated. The rest passed on re-run, except `@orders-filters` on pixel. Until those are triaged, "the whole e2e suite is green" cannot be claimed for this phase.

---

_Verified: 2026-10-30T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
