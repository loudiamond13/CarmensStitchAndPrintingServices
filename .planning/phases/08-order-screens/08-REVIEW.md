---
phase: 08-order-screens
created: 2026-10-30T09:00:00-05:00
updated: 2026-10-30T09:00:00-05:00
reviewed: 2026-10-30T09:00:00-05:00
depth: standard
files_reviewed: 279
files_reviewed_list:
  - src/Csps.Application/Orders/DeletedOrderDetailResponse.cs
  - src/Csps.Application/Orders/GetDeletedOrderHandler.cs
  - src/Csps.Application/Orders/ListOrdersHandler.cs
  - src/Csps.Application/Orders/OrderDetailResponse.cs
  - src/Csps.Application/Orders/OrderListResponse.cs
  - src/Csps.Application/Ports/IOrderReader.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
  - src/Csps.Server/Controllers/OrdersController.cs
  - src/Csps.Server/Controllers/TestingOrdersController.cs
  - tests/Csps.Application.UnitTests/Orders/ChangeOrderStatusHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/GetDeletedOrderHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/LegacyEditHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderDiscountHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderRefundHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDeletedListTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDetailSnapshotTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs
  - tests/Csps.Server.IntegrationTests/Testing/TestingOrdersTests.cs
  - tests/Csps.Testing/FixedBusinessCalendar.cs
  - tools/openapi-gen/openapi.v1.json
  - web/e2e/admin-keyboard.spec.ts
  - web/e2e/admin.spec.ts
  - web/e2e/expenses-sweep.spec.ts
  - web/e2e/order-create.spec.ts
  - web/e2e/order-delete.spec.ts
  - web/e2e/order-deleted-view.spec.ts
  - web/e2e/order-discounts.spec.ts
  - web/e2e/order-edit.spec.ts
  - web/e2e/order-expenses.spec.ts
  - web/e2e/order-items.spec.ts
  - web/e2e/order-page.spec.ts
  - web/e2e/order-payments.spec.ts
  - web/e2e/order-refunds.spec.ts
  - web/e2e/order-status.spec.ts
  - web/e2e/orders-deleted.spec.ts
  - web/e2e/orders-filters.spec.ts
  - web/e2e/orders-journeys.spec.ts
  - web/e2e/orders-list.spec.ts
  - web/e2e/orders-sweep.spec.ts
  - web/e2e/orders-view.spec.ts
  - web/e2e/settings.spec.ts
  - web/e2e/shell.spec.ts
  - web/e2e/showcase.spec.ts
  - web/e2e/sweep.ts
  - web/e2e/testing-api.ts
  - web/scripts/design-side-by-side.mjs
  - web/scripts/design-side-by-side.test.ts
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - web/src/components/choice/Tabs.test.tsx
  - web/src/components/choice/Tabs.tsx
  - web/src/components/data/OrderCard.tsx
  - web/src/components/data/copy.ts
  - web/src/components/data/data.recipe.ts
  - web/src/components/data/data.test.tsx
  - web/src/components/data/index.ts
  - web/src/components/lists/FilterBar.test.tsx
  - web/src/components/lists/FilterBar.tsx
  - web/src/components/money/OrderTotals.tsx
  - web/src/components/money/money.recipe.ts
  - web/src/components/money/money.test.tsx
  - web/src/components/overlays/ConfirmDialog.test.tsx
  - web/src/components/overlays/ConfirmDialog.tsx
  - web/src/components/states/Skeletons.tsx
  - web/src/components/states/index.ts
  - web/src/components/states/loading.test.tsx
  - web/src/components/status/status.test.tsx
  - web/src/components/status/tones.ts
  - web/src/dev/previews/DefinedTotalsNote.tsx
  - web/src/dev/scenarios/groups/data.ts
  - web/src/dev/scenarios/groups/money.ts
  - web/src/dev/scenarios/groups/status.ts
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/AdminLayout.tsx
  - web/src/lib/query/useListQuery.test.tsx
  - web/src/lib/query/useListQuery.ts
  - web/src/modules/admin/components/CancelOrderDialog.tsx
  - web/src/modules/admin/components/CategoryModal.test.tsx
  - web/src/modules/admin/components/CategoryModal.tsx
  - web/src/modules/admin/components/DeleteOrderDialog.test.tsx
  - web/src/modules/admin/components/DeleteOrderDialog.tsx
  - web/src/modules/admin/components/DueFlag.test.tsx
  - web/src/modules/admin/components/DueFlag.tsx
  - web/src/modules/admin/components/ExpenseCategorySelect.tsx
  - web/src/modules/admin/components/ListEntrySelect.test.tsx
  - web/src/modules/admin/components/ListEntrySelect.tsx
  - web/src/modules/admin/components/ListSettingsSection.test.tsx
  - web/src/modules/admin/components/ListSettingsSection.tsx
  - web/src/modules/admin/components/OrderBalanceStrip.test.tsx
  - web/src/modules/admin/components/OrderBalanceStrip.tsx
  - web/src/modules/admin/components/OrderCustomerCard.tsx
  - web/src/modules/admin/components/OrderDetailsCards.tsx
  - web/src/modules/admin/components/OrderDiscountModal.test.tsx
  - web/src/modules/admin/components/OrderDiscountModal.tsx
  - web/src/modules/admin/components/OrderDiscountsTab.test.tsx
  - web/src/modules/admin/components/OrderDiscountsTab.tsx
  - web/src/modules/admin/components/OrderEditAside.tsx
  - web/src/modules/admin/components/OrderExpenseModal.test.tsx
  - web/src/modules/admin/components/OrderExpenseModal.tsx
  - web/src/modules/admin/components/OrderExpensesTab.test.tsx
  - web/src/modules/admin/components/OrderExpensesTab.tsx
  - web/src/modules/admin/components/OrderFormSaveBar.tsx
  - web/src/modules/admin/components/OrderHeader.test.tsx
  - web/src/modules/admin/components/OrderHeader.tsx
  - web/src/modules/admin/components/OrderItemModal.test.tsx
  - web/src/modules/admin/components/OrderItemModal.tsx
  - web/src/modules/admin/components/OrderItemsEditor.test.tsx
  - web/src/modules/admin/components/OrderItemsEditor.tsx
  - web/src/modules/admin/components/OrderItemsTab.test.tsx
  - web/src/modules/admin/components/OrderItemsTab.tsx
  - web/src/modules/admin/components/OrderLockedBanner.test.tsx
  - web/src/modules/admin/components/OrderLockedBanner.tsx
  - web/src/modules/admin/components/OrderNoticeBanner.test.tsx
  - web/src/modules/admin/components/OrderNoticeBanner.tsx
  - web/src/modules/admin/components/OrderPaymentModal.test.tsx
  - web/src/modules/admin/components/OrderPaymentModal.tsx
  - web/src/modules/admin/components/OrderPaymentsTab.test.tsx
  - web/src/modules/admin/components/OrderPaymentsTab.tsx
  - web/src/modules/admin/components/OrderRefundModal.test.tsx
  - web/src/modules/admin/components/OrderRefundModal.tsx
  - web/src/modules/admin/components/OrderRefundsTab.test.tsx
  - web/src/modules/admin/components/OrderRefundsTab.tsx
  - web/src/modules/admin/components/OrderStatusDot.tsx
  - web/src/modules/admin/components/OrderStatusHistory.test.tsx
  - web/src/modules/admin/components/OrderStatusHistory.tsx
  - web/src/modules/admin/components/OrderStatusMenu.test.tsx
  - web/src/modules/admin/components/OrderStatusMenu.tsx
  - web/src/modules/admin/components/OrderSummaryAside.tsx
  - web/src/modules/admin/components/OrderTabParts.tsx
  - web/src/modules/admin/components/OrderTabs.test.tsx
  - web/src/modules/admin/components/OrderWindow.test.tsx
  - web/src/modules/admin/components/OrderWindow.tsx
  - web/src/modules/admin/components/OrdersTable.test.tsx
  - web/src/modules/admin/components/OrdersTable.tsx
  - web/src/modules/admin/components/OrdersToolbar.test.tsx
  - web/src/modules/admin/components/OrdersToolbar.tsx
  - web/src/modules/admin/components/PaidBySelect.test.tsx
  - web/src/modules/admin/components/PaidBySelect.tsx
  - web/src/modules/admin/components/PurgeOrderDialog.test.tsx
  - web/src/modules/admin/components/PurgeOrderDialog.tsx
  - web/src/modules/admin/components/ReopenOrderModal.test.tsx
  - web/src/modules/admin/components/ReopenOrderModal.tsx
  - web/src/modules/admin/components/orderForm.recipe.node.test.ts
  - web/src/modules/admin/components/orderForm.recipe.ts
  - web/src/modules/admin/components/orderPage.recipe.node.test.ts
  - web/src/modules/admin/components/orderPage.recipe.ts
  - web/src/modules/admin/components/orderWindow.recipe.ts
  - web/src/modules/admin/components/orders.recipe.node.test.ts
  - web/src/modules/admin/components/orders.recipe.ts
  - web/src/modules/admin/components/showcase/Phase8Demos.test.tsx
  - web/src/modules/admin/components/showcase/Phase8Demos.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcase.recipe.ts
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.test.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/deletedOrdersCopy.ts
  - web/src/modules/admin/hooks/useApplyOrder.test.tsx
  - web/src/modules/admin/hooks/useApplyOrder.ts
  - web/src/modules/admin/hooks/useBusinessToday.test.tsx
  - web/src/modules/admin/hooks/useBusinessToday.ts
  - web/src/modules/admin/hooks/useDeletedOrderQuery.ts
  - web/src/modules/admin/hooks/useDeletedOrdersListParams.test.tsx
  - web/src/modules/admin/hooks/useDeletedOrdersListParams.ts
  - web/src/modules/admin/hooks/useDeletedOrdersQuery.ts
  - web/src/modules/admin/hooks/useListEntryQuery.ts
  - web/src/modules/admin/hooks/useOrderAction.ts
  - web/src/modules/admin/hooks/useOrderChildSave.test.tsx
  - web/src/modules/admin/hooks/useOrderChildSave.ts
  - web/src/modules/admin/hooks/useOrderExpenseCategoriesQuery.ts
  - web/src/modules/admin/hooks/useOrderQuery.ts
  - web/src/modules/admin/hooks/useOrderTab.test.tsx
  - web/src/modules/admin/hooks/useOrderTab.ts
  - web/src/modules/admin/hooks/useOrdersListParams.test.tsx
  - web/src/modules/admin/hooks/useOrdersListParams.ts
  - web/src/modules/admin/hooks/useOrdersQuery.ts
  - web/src/modules/admin/hooks/useOrdersView.test.tsx
  - web/src/modules/admin/hooks/useOrdersView.ts
  - web/src/modules/admin/hooks/usePaymentMethodsQuery.ts
  - web/src/modules/admin/hooks/useProductTypesQuery.ts
  - web/src/modules/admin/hooks/useRefreshList.ts
  - web/src/modules/admin/hooks/useRefreshOrders.ts
  - web/src/modules/admin/hooks/useSettingsTab.test.tsx
  - web/src/modules/admin/hooks/useSettingsTab.ts
  - web/src/modules/admin/hooks/useUnsavedChangesGuard.test.tsx
  - web/src/modules/admin/hooks/useUnsavedChangesGuard.ts
  - web/src/modules/admin/listSettingsConfigs.ts
  - web/src/modules/admin/orderDiscountCopy.ts
  - web/src/modules/admin/orderDiscountSchemas.test.ts
  - web/src/modules/admin/orderDiscountSchemas.ts
  - web/src/modules/admin/orderExpenseCopy.ts
  - web/src/modules/admin/orderExpenseSchemas.test.ts
  - web/src/modules/admin/orderExpenseSchemas.ts
  - web/src/modules/admin/orderFormCopy.ts
  - web/src/modules/admin/orderFormPreview.ts
  - web/src/modules/admin/orderFormSchemas.test.ts
  - web/src/modules/admin/orderFormSchemas.ts
  - web/src/modules/admin/orderListSchemas.test.ts
  - web/src/modules/admin/orderListSchemas.ts
  - web/src/modules/admin/orderListsCopy.ts
  - web/src/modules/admin/orderNavigation.ts
  - web/src/modules/admin/orderPageCopy.ts
  - web/src/modules/admin/orderPaymentCopy.ts
  - web/src/modules/admin/orderPaymentSchemas.test.ts
  - web/src/modules/admin/orderPaymentSchemas.ts
  - web/src/modules/admin/orderRefundCopy.ts
  - web/src/modules/admin/orderRefundSchemas.test.ts
  - web/src/modules/admin/orderRefundSchemas.ts
  - web/src/modules/admin/orderRules.test.ts
  - web/src/modules/admin/orderRules.ts
  - web/src/modules/admin/orderStatus.ts
  - web/src/modules/admin/orderWindowsCopy.ts
  - web/src/modules/admin/ordersCopy.ts
  - web/src/modules/admin/ordersSchemas.test.ts
  - web/src/modules/admin/ordersSchemas.ts
  - web/src/modules/admin/pages/AdminNotFoundPage.tsx
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
  - web/src/modules/admin/pages/DeletedOrderPage.test.tsx
  - web/src/modules/admin/pages/DeletedOrderPage.tsx
  - web/src/modules/admin/pages/DeletedOrdersPage.test.tsx
  - web/src/modules/admin/pages/DeletedOrdersPage.tsx
  - web/src/modules/admin/pages/OrderFormPage.test.tsx
  - web/src/modules/admin/pages/OrderFormPage.tsx
  - web/src/modules/admin/pages/OrderPage.test.tsx
  - web/src/modules/admin/pages/OrderPage.tsx
  - web/src/modules/admin/pages/OrdersPage.test.tsx
  - web/src/modules/admin/pages/OrdersPage.tsx
  - web/src/modules/admin/pages/SettingsPage.test.tsx
  - web/src/modules/admin/pages/SettingsPage.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/sections.test.ts
  - web/src/modules/admin/sections.ts
  - web/src/modules/admin/services/deletedOrdersService.test.ts
  - web/src/modules/admin/services/deletedOrdersService.ts
  - web/src/modules/admin/services/orderDiscountsService.test.ts
  - web/src/modules/admin/services/orderDiscountsService.ts
  - web/src/modules/admin/services/orderExpenseCategoriesService.test.ts
  - web/src/modules/admin/services/orderExpenseCategoriesService.ts
  - web/src/modules/admin/services/orderExpensesService.test.ts
  - web/src/modules/admin/services/orderExpensesService.ts
  - web/src/modules/admin/services/orderItemsService.test.ts
  - web/src/modules/admin/services/orderItemsService.ts
  - web/src/modules/admin/services/orderPaymentsService.test.ts
  - web/src/modules/admin/services/orderPaymentsService.ts
  - web/src/modules/admin/services/orderRefundsService.test.ts
  - web/src/modules/admin/services/orderRefundsService.ts
  - web/src/modules/admin/services/ordersService.test.ts
  - web/src/modules/admin/services/ordersService.ts
  - web/src/modules/admin/services/paymentMethodsService.test.ts
  - web/src/modules/admin/services/paymentMethodsService.ts
  - web/src/modules/admin/services/productTypesService.test.ts
  - web/src/modules/admin/services/productTypesService.ts
  - web/src/modules/admin/settingsCopy.ts
  - web/src/test/deletedOrderFixtures.ts
  - web/src/test/orderFixtures.ts
  - web/src/test/orderListFixtures.ts
  - web/src/test/orders-boundaries.node.test.ts
  - web/src/test/setup.ts
  - web/src/test/strictMode.ts
  - web/src/types/api.generated.ts
  - web/src/ui/app.css
  - web/src/utils/csps.test.ts
  - web/src/utils/csps.ts
  - web/src/utils/dueFlag.test.ts
  - web/src/utils/dueFlag.ts
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 8: Code Review Report

*Created: 2026-10-30T09:00:00-05:00 · Updated: 2026-10-30T09:00:00-05:00*

**Reviewed:** 2026-10-30T09:00:00-05:00
**Depth:** standard
**Files Reviewed:** 279 in scope
**Status:** issues_found

## Summary

I read all 10 backend production files in full, plus the Phase 8 diff of each. I read the web production code in full: services, hooks, schemas, rules, pages, the order windows, tabs, dialogs, the toolbar and table, and the shared components that changed. I checked the OR-3 zod rules against the C# validators field by field. I spot-checked the unit and integration tests, the e2e specs, the dev and showcase files, and the two big scripts. I did not read every line of every test, e2e, dev or script file.

The backend is sound. The new Manager-only read (`GET /orders/deleted/{id}`) has an explicit policy and a matrix row. The child query filters are lifted together with the order filter, so a live order is never read through it. The business `today` is stamped on every answer, and every write answer goes through the reader, so `today` is never the default date. The Testing controller is compiled out of Release. I found no SQL, secret, long-dash, `fetch`, device-clock or inline-style problem in the phase's production code. Services only live in `modules/*/services`.

The zod schemas match the validators: lengths, ranges, decimals, rule order, contact number characters and the 30-day expense limit. The client money helpers do real arithmetic in places, and a few of them block a save on their own. That is where most findings sit. There are no BLOCKERs. The five WARNINGs are about the Core Value rule (server-computed money only) and about the business `today` going stale.

## Warnings

### WR-01: Discount row amounts are worked out in the browser and shown as saved figures

**File:** `web/src/modules/admin/components/OrderDiscountsTab.tsx:62-77` (comment at lines 3-4)
**Issue:** The Amount column for each discount is `discountAmount(...)` over the server subtotal, run in the browser. The server never sends a per-discount amount (`OrderDiscountResponse` has only `Kind` and `Value`). The footer shows the server's `totals.discount`. So the rows are browser figures and the footer is a server figure, side by side on a saved order. Rounding is proven equal by the golden vectors today. The Core Value rule says the client never computes totals, and this is the one place a saved order's money row is a browser result. If the server rule ever changes, such as a cap or a different rounding order, the rows will quietly stop matching the footer.
**Fix:** Add `Amount` (decimal) to `OrderDiscountResponse` and fill it in `OrderReader` from the same `OrderMath` rule that sets the stored total. Regenerate the OpenAPI types. Then render `formatPeso(negateMoney(discount.amount))` and delete `discountAmount` from this tab. The window's "Computed amount" helper can stay a labeled preview.

### WR-02: Client-side money checks block a save or a delete before the server is asked, from a frozen snapshot

**File:** `web/src/modules/admin/orderPaymentSchemas.ts:59-79,98-100`, `web/src/modules/admin/orderRules.ts:36-43`, `web/src/modules/admin/components/OrderPaymentsTab.tsx:228-233`, `web/src/modules/admin/orderDiscountSchemas.ts:33-52,99-112`, `web/src/modules/admin/components/OrderPaymentModal.tsx:139-143`
**Issue:** `paymentCap`, `refundCap`, `wouldLeavePaymentsBelowRefunds` and the discount items-total cap add and subtract server figures in the browser. They are labelled previews, but they act as hard gates:
- The zod resolver rejects the amount and the request is never sent.
- `confirmDelete` throws `PaymentBelowRefundsError` and the DELETE is never sent.
- The window holds `opened.order` for its whole life, so the cap is frozen at the moment it opened. If another staff member removes a payment or a refund while the window is open, the real cap goes up. The window still refuses a valid amount and states the old balance. The only way out is Load Latest, which needs a 409 first, and a 409 never comes because the request is never sent.

Two staff members work one order often enough for this to happen.
**Fix:** Keep the cap as the helper line, but do not let it fail validation. Let the server's 400 field error (already wired through `onFieldErrors`) be the gate. If the pre-check stays for the instant message, run it as a warning only. Send the request when the user presses Save anyway, or refresh `opened.order` from the page's cache when the window regains focus. For `wouldLeavePaymentsBelowRefunds`, drop the throw and let the 422 `orders.payment-below-refunds` reach `describeDeleteFailure`, which already handles it.

### WR-03: The "business today" can be a stale day taken from the query cache

**File:** `web/src/modules/admin/hooks/useBusinessToday.ts:20-32,71-78`, `web/src/modules/admin/pages/OrderFormPage.tsx:179-194,676-683`
**Issue:** `newestHeldToday` returns the `today` of the newest cached order answer, however old. A list page fetched at 11 pm and a New Order opened at 12:10 am read yesterday. The New Order form puts that day in `defaultValues.orderDate` once, and it never updates. The payment and refund schemas use the same value as the "not in the future" bound. A payment dated the new day is then rejected as "can't be in the future" until some refetch happens. Nothing in the hook looks at age. The probe only runs when nothing is held.
**Fix:** Treat a held value as valid only if its `dataUpdatedAt` is recent, or always run the small probe when a form opens (a new endpoint or the list call with `staleTime: 0`) and use the held value only while it loads. At minimum, read `today` from the order answer that the window or form opened with, which is fresh by construction, and not from the global cache.

### WR-04: The permanent-delete dialog and the deleted order page share one query key with `gcTime: 0`

**File:** `web/src/modules/admin/hooks/useDeletedOrderQuery.ts:10-19`, `web/src/modules/admin/components/PurgeOrderDialog.tsx:601`, `web/src/modules/admin/pages/DeletedOrderPage.tsx:451`
**Issue:** `DeletedOrderPage` observes `['order-deleted', id]` as the page's own data. `PurgeOrderDialog` observes the same key to read counts, with `enabled: open`. Both use `staleTime: 0` and `gcTime: 0`. When the dialog opens, enabling its observer triggers a refetch, and the page's `deleted` data is replaced mid-view. When that refetch answers 404 (someone restored the order), the page shows its own not-found state while the dialog's effect runs `showGone()`, which calls `onDone` (navigate to the list) and `onClose`. Two handlers answer the same event, with two different results (not-found screen versus list). On the list page the dialog is the only observer, so it is fine there.
**Fix:** Give the dialog its own root key (for example `['order-deleted-counts', id]`), as `useListEntryQuery` does for its modal. Or, on the page, build the dialog counts from the data the page already holds and skip the second read.

### WR-05: A client rule hides the Mark Completed action based on the page's last answer

**File:** `web/src/modules/admin/components/OrderStatusMenu.tsx:238,324-331`, `web/src/modules/admin/orderRules.ts:67-70`
**Issue:** Mark Completed is `aria-disabled` and does nothing when `canComplete(order)` is false, so the request is never sent. The rule is a pure client check on stored figures, so it is not arithmetic, but it has the same stale-snapshot problem as WR-02. If a payment lands from another session, a staff member cannot complete until a focus refetch brings the new figures. The menu offers no way to ask the server.
**Fix:** Keep the disabled look and reason line, but let the click through (a normal button press sends the move and the 422 `orders.complete-balance-owed` toast explains), or refetch the order when the menu opens.

## Info

### IN-01: Misplaced and stacked doc comment in `OrdersPage`

**File:** `web/src/modules/admin/pages/OrdersPage.tsx:64-68`
**Issue:** The block "A list row as the card takes it..." sits above `statusLabel`, not above `toCardOrder`, which it describes. Two JSDoc blocks are stacked, so editors attach the wrong text to `statusLabel`.
**Fix:** Move the first block down to `toCardOrder`.

### IN-02: The balance-state rule is written three times

**File:** `web/src/components/money/OrderTotals.tsx:101-106`, `web/src/modules/admin/components/OrderBalanceStrip.tsx:28-33`, `web/src/modules/admin/components/OrdersTable.tsx:285-291`
**Issue:** The "credit, Fully Paid, Not collected, else due" ordering is copied in three files. A change to one (D-45 style) will drift from the others.
**Fix:** Export one `balanceKind(figures, status)` from `orderRules.ts` and import it in all three.

### IN-03: `OrderPage` and `DeletedOrderPage` copy about 100 lines

**File:** `web/src/modules/admin/pages/OrderPage.tsx:67-146,154-166` and `web/src/modules/admin/pages/DeletedOrderPage.tsx:245-324,375-388`
**Issue:** `BASE_TABS`, `SKELETON_COLUMNS`, `tabItems`, `TabBody` (differing only by `readOnly`), `ImagesCard`, the loading skeleton and the hidden-refunds-tab effect are duplicated. `OrderFormPage.tsx` has a third copy of the Images card. A fix to one (for example the tab focus rule) has to be made twice.
**Fix:** Extract `OrderTabsCard`, `ImagesCard` and `OrderSkeleton` into `modules/admin/components` and pass `readOnly`.

### IN-04: `OrderFormPage.tsx` is 706 lines holding two forms, a router page and a double cast

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:198`
**Issue:** `control as unknown as OrderDetailsControl` hides a type gap between the create and edit form types. The file mixes `CreateOrderForm`, `EditOrderForm`, two route wrappers and the server-key mapping tables.
**Fix:** Move the server-field mapping (`DETAIL_FIELDS`, `TOP_FIELDS`, `serverFieldPath`) to `orderFormSchemas.ts` and split Create and Edit into their own files. Make `OrderDetailsCards` generic over the details shape so no cast is needed.

### IN-05: The boundary guards only cover files whose names start with a capital `Order`, `Orders` or `Deleted`

**File:** `web/src/test/orders-boundaries.node.test.ts:42-49`
**Issue:** `orderFiles` and `clockFiles` select by file name prefix. The hooks and schemas (`useBusinessToday.ts`, `useOrderChildSave.ts`, `orderFormPreview.ts`, `order*Schemas.ts`, `orderRules.ts`) are lowercase-named and are not scanned. A `new Date()` or `dangerouslySetInnerHTML` added there passes. `code()` also removes everything after `//` on a line, so a string containing `//` hides the rest of that line. The public-site guard reads raw text, while the other two read stripped text, so the three guards do not treat comments the same way.
**Fix:** Scan every non-test `.ts` and `.tsx` file under `modules/admin` (case-insensitive on `order|deleted`) and under `hooks`, or scan the whole admin module and allow-list the known clock users. Use one comment-stripper for all three guards.

### IN-06: The email regex differs from the server check

**File:** `web/src/modules/admin/orderFormSchemas.ts:36-37`
**Issue:** The server uses `MailAddress.TryCreate` with `address.Address == text` and a dot in the host. The client regex is simpler. A quoted local part such as `"a b"@example.com` is accepted by the server and refused by the browser. A string the server refuses but the regex accepts is possible too (for example a trailing dot in a label is handled, but some forms of comments are not). The server remains the gate, so this is a mirror-quality gap only.
**Fix:** Keep the regex but record in the comment that it is deliberately stricter on quoted forms, or add a row in the shared fixture so both sides are tested against the same list of addresses.

### IN-07: A sync throw in `onSuccess` leaves the single-action generation stuck

**File:** `web/src/modules/admin/hooks/useOrderAction.ts:19-24`
**Issue:** `Promise.resolve(onSuccess(result, target)).then(...)` is called inside `useSubmission`'s success path. If `onSuccess` throws before it returns (for example `leave()` in `DeleteOrderDialog` navigates and the router throws), `generation.current` never moves. The next click on that row has the same identity as the finished action and sends nothing.
**Fix:** Wrap in `new Promise((resolve) => resolve(onSuccess(...)))` or use `try/finally` so the generation always advances.

### IN-08: `OrdersPage` computes the page count from the unsettled size

**File:** `web/src/modules/admin/pages/OrdersPage.tsx:114-124`
**Issue:** The query is sent with `settled.size`, but `pageCount = ceil(total / values.size)` uses the live `values.size`. While the settle delay runs, the count is worked out with a size that the data on screen was not fetched with, and `clampPage` can run against it once `fresh` is true. The window is short, but a quick change of page size on a short list can clamp to the wrong page.
**Fix:** Use `settled.size` for `pageCount`, or gate the clamp on `settled.size === values.size`.

---

_Reviewed: 2026-10-30T09:00:00-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
