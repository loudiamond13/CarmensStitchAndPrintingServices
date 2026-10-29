---
phase: 07-order-domain-api
created: 2026-10-28T22:30:00-05:00
updated: 2026-10-28T23:30:00-05:00
reviewed: 2026-10-28T22:30:00-05:00
depth: standard
status: fixed
files_reviewed: 193
findings:
  critical: 2
  warning: 11
  info: 18
  total: 31
files_reviewed_list:
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/Identity/LegacyHolder.cs
  - src/Csps.Domain/OrderLists/OrderExpenseCategory.cs
  - src/Csps.Domain/OrderLists/OrderListEntry.cs
  - src/Csps.Domain/OrderLists/OrderListKind.cs
  - src/Csps.Domain/OrderLists/OrderListSeed.cs
  - src/Csps.Domain/OrderLists/PaymentMethod.cs
  - src/Csps.Domain/OrderLists/ProductType.cs
  - src/Csps.Domain/Orders/Order.cs
  - src/Csps.Domain/Orders/OrderChanges.cs
  - src/Csps.Domain/Orders/OrderDiscount.cs
  - src/Csps.Domain/Orders/OrderExpense.cs
  - src/Csps.Domain/Orders/OrderImportChecks.cs
  - src/Csps.Domain/Orders/OrderImportRules.cs
  - src/Csps.Domain/Orders/OrderImportSnapshot.cs
  - src/Csps.Domain/Orders/OrderInputs.cs
  - src/Csps.Domain/Orders/OrderItem.cs
  - src/Csps.Domain/Orders/OrderMath.cs
  - src/Csps.Domain/Orders/OrderMathModels.cs
  - src/Csps.Domain/Orders/OrderNumber.cs
  - src/Csps.Domain/Orders/OrderNumberCounter.cs
  - src/Csps.Domain/Orders/OrderPayment.cs
  - src/Csps.Domain/Orders/OrderRefund.cs
  - src/Csps.Domain/Orders/OrderRules.cs
  - src/Csps.Domain/Orders/OrderStatus.cs
  - src/Csps.Domain/Orders/OrderStatusChange.cs
  - src/Csps.Domain/Orders/OrderStatusRules.cs
  - src/Csps.Domain/Orders/OrderTotals.cs
  - src/Csps.Domain/Orders/Pesos.cs
  - src/Csps.Application/Orders/AddOrderDiscountHandler.cs
  - src/Csps.Application/Orders/AddOrderDiscountRequest.cs
  - src/Csps.Application/Orders/AddOrderDiscountRequestValidator.cs
  - src/Csps.Application/Orders/AddOrderExpenseHandler.cs
  - src/Csps.Application/Orders/AddOrderExpenseRequest.cs
  - src/Csps.Application/Orders/AddOrderExpenseRequestValidator.cs
  - src/Csps.Application/Orders/AddOrderItemHandler.cs
  - src/Csps.Application/Orders/AddOrderItemRequest.cs
  - src/Csps.Application/Orders/AddOrderItemRequestValidator.cs
  - src/Csps.Application/Orders/AddOrderPaymentHandler.cs
  - src/Csps.Application/Orders/AddOrderPaymentRequest.cs
  - src/Csps.Application/Orders/AddOrderPaymentRequestValidator.cs
  - src/Csps.Application/Orders/AddOrderRefundHandler.cs
  - src/Csps.Application/Orders/AddOrderRefundRequest.cs
  - src/Csps.Application/Orders/AddOrderRefundRequestValidator.cs
  - src/Csps.Application/Orders/ChangeOrderStatusHandler.cs
  - src/Csps.Application/Orders/ChangeOrderStatusRequest.cs
  - src/Csps.Application/Orders/ChangeOrderStatusRequestValidator.cs
  - src/Csps.Application/Orders/CreateOrderHandler.cs
  - src/Csps.Application/Orders/CreateOrderRequest.cs
  - src/Csps.Application/Orders/CreateOrderRequestValidator.cs
  - src/Csps.Application/Orders/DeleteOrderHandler.cs
  - src/Csps.Application/Orders/DeletedOrderListResponse.cs
  - src/Csps.Application/Orders/DiscountKindNames.cs
  - src/Csps.Application/Orders/GetOrderHandler.cs
  - src/Csps.Application/Orders/IOrderDetailsFields.cs
  - src/Csps.Application/Orders/IOrderDiscountFields.cs
  - src/Csps.Application/Orders/IOrderExpenseFields.cs
  - src/Csps.Application/Orders/IOrderItemFields.cs
  - src/Csps.Application/Orders/IOrderPaymentFields.cs
  - src/Csps.Application/Orders/IOrderRefundFields.cs
  - src/Csps.Application/Orders/ImportOrderHandler.cs
  - src/Csps.Application/Orders/ListDeletedOrdersHandler.cs
  - src/Csps.Application/Orders/ListDeletedOrdersRequest.cs
  - src/Csps.Application/Orders/ListDeletedOrdersRequestValidator.cs
  - src/Csps.Application/Orders/ListOrdersHandler.cs
  - src/Csps.Application/Orders/ListOrdersRequest.cs
  - src/Csps.Application/Orders/ListOrdersRequestValidator.cs
  - src/Csps.Application/Orders/OrderAuditDetail.cs
  - src/Csps.Application/Orders/OrderChildWrite.cs
  - src/Csps.Application/Orders/OrderDetailResponse.cs
  - src/Csps.Application/Orders/OrderDetailsFieldsValidator.cs
  - src/Csps.Application/Orders/OrderDiscountFieldsValidator.cs
  - src/Csps.Application/Orders/OrderErrors.cs
  - src/Csps.Application/Orders/OrderExpenseFieldsValidator.cs
  - src/Csps.Application/Orders/OrderItemFieldsValidator.cs
  - src/Csps.Application/Orders/OrderListResponse.cs
  - src/Csps.Application/Orders/OrderPaymentFieldsValidator.cs
  - src/Csps.Application/Orders/OrderReferenceChecks.cs
  - src/Csps.Application/Orders/OrderRefundFieldsValidator.cs
  - src/Csps.Application/Orders/OrderStatusNames.cs
  - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
  - src/Csps.Application/Orders/RemoveOrderDiscountHandler.cs
  - src/Csps.Application/Orders/RemoveOrderExpenseHandler.cs
  - src/Csps.Application/Orders/RemoveOrderItemHandler.cs
  - src/Csps.Application/Orders/RemoveOrderPaymentHandler.cs
  - src/Csps.Application/Orders/RemoveOrderRefundHandler.cs
  - src/Csps.Application/Orders/RestoreOrderHandler.cs
  - src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs
  - src/Csps.Application/Orders/UpdateOrderDetailsRequest.cs
  - src/Csps.Application/Orders/UpdateOrderDetailsRequestValidator.cs
  - src/Csps.Application/Orders/UpdateOrderDiscountHandler.cs
  - src/Csps.Application/Orders/UpdateOrderDiscountRequest.cs
  - src/Csps.Application/Orders/UpdateOrderDiscountRequestValidator.cs
  - src/Csps.Application/Orders/UpdateOrderExpenseHandler.cs
  - src/Csps.Application/Orders/UpdateOrderExpenseRequest.cs
  - src/Csps.Application/Orders/UpdateOrderExpenseRequestValidator.cs
  - src/Csps.Application/Orders/UpdateOrderItemHandler.cs
  - src/Csps.Application/Orders/UpdateOrderItemRequest.cs
  - src/Csps.Application/Orders/UpdateOrderItemRequestValidator.cs
  - src/Csps.Application/Orders/UpdateOrderPaymentHandler.cs
  - src/Csps.Application/Orders/UpdateOrderPaymentRequest.cs
  - src/Csps.Application/Orders/UpdateOrderPaymentRequestValidator.cs
  - src/Csps.Application/Orders/UpdateOrderRefundHandler.cs
  - src/Csps.Application/Orders/UpdateOrderRefundRequest.cs
  - src/Csps.Application/Orders/UpdateOrderRefundRequestValidator.cs
  - src/Csps.Application/Audit/AuditChangeLines.cs
  - src/Csps.Application/Audit/AuditLogResponse.cs
  - src/Csps.Application/Audit/ListAuditLogHandler.cs
  - src/Csps.Application/Common/ValidationResults.cs
  - src/Csps.Application/OrderLists/CreateOrderListEntryHandler.cs
  - src/Csps.Application/OrderLists/DeleteOrderListEntryHandler.cs
  - src/Csps.Application/OrderLists/GetOrderListEntryHandler.cs
  - src/Csps.Application/OrderLists/ListOrderListHandler.cs
  - src/Csps.Application/OrderLists/OrderListAuditDetail.cs
  - src/Csps.Application/OrderLists/OrderListDescriptor.cs
  - src/Csps.Application/OrderLists/OrderListEntryDetailResponse.cs
  - src/Csps.Application/OrderLists/OrderListEntryRequest.cs
  - src/Csps.Application/OrderLists/OrderListEntryRequestValidator.cs
  - src/Csps.Application/OrderLists/OrderListErrors.cs
  - src/Csps.Application/OrderLists/OrderListItem.cs
  - src/Csps.Application/OrderLists/ReactivateOrderListEntryHandler.cs
  - src/Csps.Application/OrderLists/RetireOrderListEntryHandler.cs
  - src/Csps.Application/OrderLists/UpdateOrderListEntryHandler.cs
  - src/Csps.Application/Ports/IAuditLogReader.cs
  - src/Csps.Application/Ports/IOrderLists.cs
  - src/Csps.Application/Ports/IOrderNumbers.cs
  - src/Csps.Application/Ports/IOrderReader.cs
  - src/Csps.Application/Ports/IOrders.cs
  - src/Csps.Application/Ports/OrderListEntryDeletedException.cs
  - src/Csps.Application/Ports/OrderListEntryInUseException.cs
  - src/Csps.Application/Ports/OrderListNameTakenException.cs
  - src/Csps.Application/Ports/OrderNumberBusyException.cs
  - src/Csps.Application/Ports/OrderNumberTakenException.cs
  - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Identity/ApplicationUser.cs
  - src/Csps.Infrastructure/Identity/StaffDirectory.cs
  - src/Csps.Infrastructure/Identity/UserAccounts.cs
  - src/Csps.Infrastructure/Identity/UserDirectory.cs
  - src/Csps.Infrastructure/OrderLists/OrderListStore.cs
  - src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - src/Csps.Infrastructure/Orders/OrderStore.cs
  - src/Csps.Infrastructure/Orders/OrdersRegistration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderDiscountConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseCategoryConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderItemConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderListEntryConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderNumberCounterConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderPaymentConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderRefundConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/OrderStatusChangeConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/PaymentMethodConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ProductTypeConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028141016_AddOrderLists.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028152204_AddOrders.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028165341_AddLegacyHolder.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028181319_AddOrderDiscounts.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028191015_AddOrderPayments.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028200438_AddOrderExpenses.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028211102_AddOrderRefunds.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261028225721_AddOrderListIndexes.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261029001300_DropUnusedOrderIndexes.cs
  - src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs
  - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
  - src/Csps.Infrastructure/Seeding/OrdersSeedStep.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
  - src/Csps.Server/Controllers/OrderDiscountsController.cs
  - src/Csps.Server/Controllers/OrderExpenseCategoriesController.cs
  - src/Csps.Server/Controllers/OrderExpensesController.cs
  - src/Csps.Server/Controllers/OrderItemsController.cs
  - src/Csps.Server/Controllers/OrderPaymentsController.cs
  - src/Csps.Server/Controllers/OrderRefundsController.cs
  - src/Csps.Server/Controllers/OrdersController.cs
  - src/Csps.Server/Controllers/PaymentMethodsController.cs
  - src/Csps.Server/Controllers/ProductTypesController.cs
  - src/Csps.Server/Controllers/TestingOrdersController.cs
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/AuditDetail.test.tsx
  - web/src/modules/admin/components/AuditDetail.tsx
  - web/src/modules/admin/components/showcase/Phase5Demos.tsx
  - web/src/modules/admin/pages/AuditLogPage.test.tsx
  - web/src/modules/admin/pages/AuditLogPage.tsx
  - web/src/modules/admin/services/auditLogService.test.ts
---
# Phase 7 Code Review

*Created: 2026-10-28T22:30:00-05:00 · Updated: 2026-10-28T23:30:00-05:00*

Four parallel reviewers at standard depth, merged into one report. Finding IDs carry their slice prefix (DOM, APO, APX, IWB).

| Slice | Files | Critical | Warning | Info |
|---|---|---|---|---|
| Domain | 29 | 1 | 4 | 4 |
| Application / Orders | 76 | 0 | 2 | 4 |
| Application / lists, audit, ports | 28 | 0 | 1 | 6 |
| Infrastructure, Server, web | 60 | 1 | 4 | 4 |
| **Total** | **193** | **2** | **11** | **18** |

## Slice: Domain (IDs DOM-*)

*Created: 2026-10-28T21:43:00-05:00 · Updated: 2026-10-28T21:43:00-05:00*

**Reviewed:** 2026-10-28T21:43:00-05:00
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

### Narrative Findings (AI reviewer)

#### Summary

I reviewed the Phase 7 order domain against D-01 to D-48. Most of it holds up when traced by hand:

- `OrderMath` uses the pinned rounding order (round half away from zero, each discount rounded, then the sum rounded). The D-36 cancelled profit and the D-12 customer credit are correct.
- The status table matches D-02, D-03, D-04 and D-38.
- The D-05 lock and the D-35 refund exception are applied the same way on every mutation.
- Refund eligibility and the caps follow D-09, D-34 and D-43.

I found these defects:

1. One reachable state breaks a "never" rule in D-09 (refunds above payments).
2. One path skips the discount cap, so the order total can go below zero.
3. Two import gaps.
4. One conflict between strict re-checks on edit and the zero-loss rule for legacy data.

None of the findings below is speculative. Each one was traced through the actual code.

### Critical Issues

#### DOM-CR-01: Removing or lowering a payment can leave refunds above payments (breaks D-09, corrupts D-36 profit and D-08 money on hand)

**File:** `src/Csps.Domain/Orders/Order.cs:801-818` (`RemovePayment`), `:782-793` (`UpdatePayment`, lowering path)

**Issue:** D-09 says "A refund can never exceed the amount paid minus earlier refunds". The refund add and edit paths enforce this. But `RemovePayment` has no check against refunds at all, and `UpdatePayment` only checks when the amount goes up (`if (cleaned.Amount > payment.Amount)`). Here is a sequence anyone can run with ordinary staff calls:

1. Item ₱1,000. AddPayment ₱1,000, so the balance is 0.
2. AddDiscount fixed ₱200. The total is 800 and the credit is 200 (allowed by D-12).
3. AddRefund ₱200. The order has a credit and the cap is 200, so it is accepted. The balance is 0.
4. RemovePayment. This is accepted. Now `PaidTotal = 0` and `RefundedTotal = 200`.

The order now records ₱200 handed back from ₱0 collected. If it is then cancelled, `Profit = paid - refunded - expenses = -200 - expenses`. That is a loss larger than its expenses, which contradicts D-36's "money kept minus money spent". The refunder's money on hand (D-08, Phase 10) also drops by money this order never received. Neither the domain nor the database stops it: there is no `CK_Orders_*` rule for `RefundedTotal <= PaidTotal`, and `RemoveOrderPaymentHandler` passes `version: null` and calls the domain directly.

**Fix:** In both paths, refuse a payment change that would leave `Paid < Refunded`. Work it out on the would-be figures before anything is assigned, the same way `DiscountsFit` does. This is a behavior change, so the owner must approve the rule and the message first. Draft:
```csharp
// RemovePayment, before _payments.Remove(payment):
var after = Figures(_payments.Where(p => p != payment).Select(static p => p.Amount));
if (after.Paid < after.Refunded)
{
    return Result.Failure<OrderPayment>(OrderRules.PaymentBelowRefunds); // new 422, owner-approved wording
}

// UpdatePayment, for any amount change (not only raises):
var edited = Figures(_payments.Select(p => p == payment ? cleaned.Amount : p.Amount));
if (edited.Paid < edited.Refunded) { /* same 422 */ }
```
Add domain tests for both paths, starting with a failing one.

### Warnings

#### DOM-WR-01: `AddItem` skips the discount cap, so the order total can go below zero

**File:** `src/Csps.Domain/Orders/Order.cs:491-514` (compare `UpdateItem` :558-562, `RemoveItem` :595-598, the comment at :1165-1166)

**Issue:** The comment on `DiscountsFit` says the cap means "the total never goes below zero". `Create`, `UpdateItem`, `RemoveItem`, `AddDiscount` and `UpdateDiscount` all run that check. `AddItem` does not, on the assumption that a bigger subtotal can only help. That assumption is false, because each percentage discount is rounded half away from zero on its own. Worked example, which the code accepts:

1. Item ₱100.00. Discounts of 33.33%, 33.33% and 33.34% give 33.33 + 33.33 + 33.34 = 100.00. Each AddDiscount passes.
2. AddItem qty 1 at ₱2.00 makes the subtotal 102.00. The discounts become round(33.9966) + round(33.9966) + round(34.0068) = 34.00 + 34.00 + 34.01 = 102.01.
3. The total is -0.01. The order shows a ₱0.01 customer credit and `FullyPaid = true` with no payment at all.

`UpdateItem` from ₱100 to ₱102 is refused for the same figures, so the two paths disagree. The database has no `Total >= 0` check (D-40 keeps the cap in the domain only), so the negative total is stored.

**Fix:** Run the same check in `AddItem` before adding:
```csharp
if (!DiscountsFit(ItemsForMath(_items).Append(new OrderMathItem(checkedItem.Value.Quantity, checkedItem.Value.UnitPrice)), DiscountsForMath(_discounts)))
{
    return Result.Failure<OrderItem>(OrderRules.DiscountAboveSubtotal);
}
```
Add a failing domain test with the 33.33/33.33/33.34 vector first.

#### DOM-WR-02: Import does not check that the status history agrees with the status, even under `Strict`

**File:** `src/Csps.Domain/Orders/OrderImportChecks.cs:192-219`, `src/Csps.Domain/Orders/Order.cs:347-361`

**Issue:** `CheckHistory` checks each row on its own. It never checks that:
- the last row's `ToStatus` equals `snapshot.Status`;
- each row's `FromStatus` equals the previous row's `ToStatus`;
- only the first row has a null `FromStatus`;
- the rows are in time order.

So a history of `[null->Pending, Pending->Mockup]` with `Status = Cancelled` is accepted even with `OrderImportRules.Strict`, which says it applies "no relaxation". `StatusChangedAtUtc` is then set to `history.Max(ChangedAtUtc)`. That is a time when the order entered Mockup, not Cancelled, and it feeds the `RecentEndStateDays` filter in the list. A same-status row (`Pending->Pending`) also passes, because `OrderStatusRules.Check` returns `NoChange` as a success, and the live path never writes such a row. This weakens the D-06 and ORD-16 history.

**Fix:** When `!rules.AllowAnyStatusHistory`, require a chained, time-ordered history that ends in `snapshot.Status`, and refuse `NoChange` rows. Also take `StatusChangedAtUtc` from the last row whose `ToStatus == snapshot.Status`, not from the latest row overall.

#### DOM-WR-03: Import with `IgnoreAmountCaps` has no upper bound, so overflow fails as an exception instead of a field error

**File:** `src/Csps.Domain/Orders/OrderRules.cs:699-707, 739, 791, 858, 906`; `src/Csps.Domain/Orders/Order.cs:1186`, `OrderItem.cs:75`

**Issue:** With caps ignored, quantity (up to `int.MaxValue`), unit price, discount, payment, refund and expense amounts have no upper limit. Every money column is `decimal(18,2)` (max about 9.99e15). Two things can go wrong:
- `Quantity * UnitPrice` or the sums in `OrderMath` can throw `OverflowException` in .NET (for example, 2e9 × 1e20).
- A stored figure above 1e16 fails at `SaveChanges` with an arithmetic-overflow or parameter-range error.

Either way the import fails with an unhandled exception (500), not a named field error. `OrderImportChecks` promises that structural rules (columns that fit) are "refused, never cut short", but it only does this for text and the number.

**Fix:** Add an always-on structural ceiling equal to the column limit (for example `const decimal ColumnMax = 9_999_999_999_999_999.99m`). Check each amount and each line total against it, and check the worked-out figures in `Import` after `Recalculate` (subtotal, paid, refunded, expenses). Return a field error. Catch `OverflowException` around the line-total multiply, or check `Quantity <= ColumnMax / UnitPrice` first.

#### DOM-WR-04: Any edit of a legacy child re-runs the strict caps, so a text-only fix forces a change to money or dates (conflicts with zero loss)

**File:** `src/Csps.Domain/Orders/Order.cs:441-455, 538-541, 761-765, 878-882, 1022-1026`

**Issue:** `UpdateDetails`, `UpdateItem`, `UpdatePayment`, `UpdateExpense` and `UpdateRefund` all run the strict `Check*` before they work out what changed. Data that `Order.Import` accepted on purpose cannot then be edited at all unless the money or date is changed too. Examples:
- an imported item with quantity 0 (D-47);
- a payment or expense above ₱1,000,000 (06 D-33);
- a future-dated payment (`AllowFutureDates`);
- an order with no contact number (`ContactNumberOptional`).

So correcting a typo in a legacy payment's notes is refused with "Enter an amount from ₱0.01 to ₱1,000,000.00.". D-22 rules on this explicitly for the due date only. For the others the code silently forces staff to change a migrated money figure, which goes against the Core Value of zero loss for migrated data.

**Fix:** The owner needs to rule on this (it ties into the Phase 7.1 findings). The option I recommend: re-check only the fields that changed (an unchanged amount, quantity or date is accepted as stored). The other option is to keep the current strict behavior and record it as an owner ruling next to D-22.

### Info

#### DOM-IN-01: Item field errors from the domain use list paths, while every other single-child form uses bare names

**File:** `src/Csps.Domain/Orders/Order.cs:498, 538`; `src/Csps.Domain/Orders/OrderRules.cs:664`

**Issue:** `AddItem` and `UpdateItem` call `CheckItem(_items.Count / IndexOf(item), ...)`, so their errors read `items[3].quantity`. The add and edit validators (`OrderItemFieldsValidator`) and the payment, discount, expense and refund domain paths (`index: null`) use bare names such as `quantity`. If the validator and the domain ever disagree, the single-item form gets a key it does not map.

**Fix:** Make `CheckItem` take `int?` like the others and pass `null` from `AddItem` and `UpdateItem`.

#### DOM-IN-02: The import number check does not trim, and `Strict` accepts sequence 0

**File:** `src/Csps.Domain/Orders/OrderImportChecks.cs:123-143`, `OrderNumber.cs:27-50`

**Issue:** `" ORD-2026-0001"` with a leading or trailing space is stored as given under `KeepLegacyNumber`, so a lookup by the clean number misses it. Under strict rules, `OrderNumber.TryParse` accepts `ORD-2026-0000` and year `0000`, which `Format` never produces.

**Fix:** Trim (or refuse surrounding whitespace) in `CheckNumber`. Refuse `sequence < 1` in `TryParse`.

#### DOM-IN-03: `Order.Import` and `OrderImportChecks.Check` have no null guards on the snapshot lists

**File:** `src/Csps.Domain/Orders/OrderImportChecks.cs:69-104`

**Issue:** `Order.Create` calls `ThrowIfNull` on `Items`, `Discounts`, `Payments` and `Expenses`. Import does not, so a snapshot built with `Items = null!` (for example from deserialization) gives a `NullReferenceException` instead of an `ArgumentNullException`.

**Fix:** Add `ArgumentNullException.ThrowIfNull` for `snapshot.Items`, `Discounts`, `Payments`, `Refunds`, `Expenses` and `StatusHistory` at the top of `Check`.

#### DOM-IN-04: Doc comment wording in the new audit actions

**File:** `src/Csps.Domain/Auditing/AuditActions.cs` (the `OrderExpenseCategory*` summaries and the `OrderReopened` summary)

**Issue:** Five summaries read "A order expense category ...". `OrderReopened` says "canceled", while the rest of the code base and the `OrderRules.Locked` message say "cancelled".

**Fix:** Change these to "An order expense category ..." and "cancelled".

---

_Reviewed: 2026-10-28T21:43:00-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice: Application / Orders (IDs APO-*)

*Created: 2026-10-28T21:47:41-05:00 · Updated: 2026-10-28T21:47:41-05:00*

**Reviewed:** 2026-10-28T21:47:41-05:00
**Depth:** standard
**Files Reviewed:** 76
**Status:** issues_found

### Summary

I reviewed the 76 files in `src/Csps.Application/Orders`: the use-case handlers, the request records, the FluentValidation validators, `OrderChildWrite`, `OrderReferenceChecks`, `OrderAuditDetail`, `OrderErrors` and the response DTOs. Where a finding depends on code in another layer, I read that code too: `CspsUnitOfWork`, `IdempotencyGate`, `IdempotencyMiddleware`, `OrderStore.LockAsync`, `AuditTrail`, `OrderRules` and parts of `Order`.

Most of the slice holds up:
- **Validators match the domain.** Lengths are counted after trimming, the money caps and the two-decimal rule match, and so do the date rules (payments and refunds never dated in the future, expenses up to 30 days ahead) and the discount ranges.
- **Child lookups are safe.** Every child write reaches the child only through its order (CWE-639).
- **Version checks are right.** The 409 `edit.stale` check runs before any change. `LockAsync` matches the loaded row version, so a lost race is caught before any child row is written. `ConflictRetry` re-reads cleanly because the unit of work clears the change tracker.
- **Audit details do not leak customer text (D-31).** They hold ids, keys, dates, amounts and field names only.
- **Error codes are right.** `orders.not-found` is a 404, `orders.busy` a 409, `orders.number-taken` a 422, and a wrong confirm is a 400 on `confirm`.
- **Authorization is right.** The Manager-only routes (deleted list, restore, permanent delete) have `Policies.Manager` on the controller.
- **No store-on-failure leak.** I checked whether the idempotency gate saving a 400/404/422 answer on the same `DbContext` could commit a half-applied change. It cannot: the domain assigns nothing when a rule fails, and the unit of work clears the tracker on every save failure.

Two real problems remain:
1. On every route behind the idempotency gate, a deadlock victim becomes a 500 instead of the 409 that D-46 asks for, and `ConflictRetry` never retries it.
2. A full-aggregate create (D-24) records payments and expenses with no audit of their amounts, receivers or payers, which D-31 and D-48 rely on.

### Warnings

#### APO-WR-01: A deadlock on an idempotent order route becomes a 500, not the D-46 409, and is never retried

**File:** `src/Csps.Application/Orders/CreateOrderHandler.cs:89-93` (also `ChangeOrderStatusHandler.cs:53-67`, `DeleteOrderHandler.cs:36-40`, `RestoreOrderHandler.cs:33-37`, `PermanentlyDeleteOrderHandler.cs:39-43`, the five `Remove*Handler.cs:39-54`, `OrderChildWrite.cs:117-120`). Cross-slice cause: `src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:60-63, 84-88`.

**Issue:** `IdempotencyGate` opens a transaction on the request's `CspsDbContext` (`IdempotencyGate.cs:263`) before the handler runs, and every order POST is gated. So `InTransactionAsync` always takes the savepoint path (`CspsUnitOfWork.cs:60-63`). When SQL Server picks the request as a deadlock victim (error 1205), it rolls back the whole transaction, not just the statement. Here is what happens next:
1. `SaveChangesAsync` correctly turns the error into `ConcurrencyConflictException`.
2. `RunInSavepointAsync` then calls `outer.RollbackToSavepointAsync(...)` on a transaction that no longer exists. That call throws (SqlClient refuses to use a completed transaction), and the comment on line 86 confirms the new error replaces the original.
3. The `catch (ConcurrencyConflictException)` in `CreateOrderHandler` (D-46: "a deadlock victim on order create maps to the existing orders are being saved 409") never runs, and the request ends as a 500.
4. The same applies to `ConflictRetry.RunAsync`: its "read again and decide again" retry never runs for a deadlock on an idempotent route.

The existing deadlock tests (`CspsUnitOfWorkTests.ADeadlockVictimIsALostRaceAndTheOtherSaveGoesThrough`, `CreateOrderHandlerTests`) open a plain transaction or mock the unit of work, so none of them covers deadlock plus savepoint. The 07-17 summary notes that 60 races produced no deadlock, so how often this happens is unmeasured, but the D-46 guarantee does not hold as built.

**Fix:** In `RunInSavepointAsync`, do not try to roll back to the savepoint when the error is a deadlock victim. Let the `ConcurrencyConflictException` pass through and mark the outer transaction as doomed, so the lease rolls back and the middleware answers with a 409 that is not stored:
```csharp
catch (ConcurrencyConflictException conflict) when (SqlErrors.Has(conflict.InnerException, SqlErrors.DeadlockVictim))
{
    // The server already rolled back the whole transaction; no savepoint is left to roll back to.
    throw;
}
catch
{
    await outer.RollbackToSavepointAsync(savepoint, CancellationToken.None).ConfigureAwait(false);
    throw;
}
```
Then make `ConflictRetry` skip its second pass when the outer transaction is doomed, because a retry on a dead transaction cannot succeed. Answering the busy 409 straight away is correct. First add a failing integration test: an idempotent `POST /api/v1/orders` whose save is forced to be a deadlock victim (the `NonQueryHook` pattern from `IdempotencyGateTests`) must answer 409 `orders.busy`, not 500. The cause sits in the Infrastructure slice, so the fix belongs there.

#### APO-WR-02: A full-aggregate create does not audit its payments, expenses or discounts (D-31, D-48)

**File:** `src/Csps.Application/Orders/CreateOrderHandler.cs:74`, `src/Csps.Application/Orders/OrderAuditDetail.cs:18-29`

**Issue:** `CreateOrderRequest` accepts up to 100 payments, 100 expenses and 20 discounts, saved in the same transaction (D-24, for import and a future phone app). The handler records only `order.created`, and `OrderAuditDetail.Created` writes only `number;status;orderDate;dueDate;items;total`. That leaves three gaps:
- **D-31 is not met.** It requires every add of a payment, discount or expense to be audited, with amounts, Received by and Paid by kept. A payment of up to ₱1,000,000.00 received by a named staff member, or an expense paid by one, enters the system with no audit entry naming the amount or the person.
- **D-48 misses these entries.** The Done to filter "finds order entries by receiver, payer and refunder" by reading `receiver=` and `payer=` in the detail, so it can never find these payments and expenses.
- **The paths are unequal.** A payment added later through `AddOrderPaymentHandler` writes `order-payment.added` with `receiver=<id>`, so the two ways in leave different trails for the same money.

The plans fixed the `order.created` keys (07-05, and 07-10 "order.created keeps its documented keys"), so this is a gap between the plan and the owner decision, not a typo. It needs the owner's call before it changes.

**Fix (recommended):** In the same save, record one `order-payment.added`, `order-expense.added` and `order-discount.added` entry per child, using the existing `PaymentAdded`, `ExpenseAdded` and `DiscountAdded` builders. This keeps `order.created` as documented and makes the create path match the add routes:
```csharp
audit.Record(AuditActions.OrderCreated, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.Created(order));
foreach (var discount in order.Discounts) audit.Record(AuditActions.OrderDiscountAdded, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.DiscountAdded(discount));
foreach (var payment in order.Payments) audit.Record(AuditActions.OrderPaymentAdded, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.PaymentAdded(payment));
foreach (var expense in order.Expenses) audit.Record(AuditActions.OrderExpenseAdded, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.ExpenseAdded(expense));
```
Other option: add `paid=` and `expenses=` totals to `order.created`. That is cheaper, but it still names no receiver or payer, so D-48 stays unmet. Update `docs/operations/audit-log.md` with whichever the owner picks.

### Info

#### APO-IN-01: The import does not catch a list entry deleted during the save

**File:** `src/Csps.Application/Orders/ImportOrderHandler.cs:73-86`

**Issue:** `CreateOrderHandler` and `OrderChildWrite.SaveFormAsync` catch `OrderListEntryDeletedException`, which the unit of work throws when a foreign key to a just-deleted product type, method or category fails. `ImportOrderHandler` catches only number-taken, busy and conflict. Under D-19 a never-used entry may be deleted, so an entry checked by `CheckReferencesAsync` and deleted before the save makes the import throw instead of returning a `Result`. That would stop a Phase 16 import loop on one order. It is unlikely during a migration.

**Fix:** Add `catch (OrderListEntryDeletedException deleted)` and return a 400 on the matching list path, for example `OrderReferenceChecks.DeletedError(deleted.Kind)` or a rerun of `CheckReferencesAsync`.

#### APO-IN-02: Add routes check list entries and staff outside the order's transaction

**File:** `src/Csps.Application/Orders/AddOrderPaymentHandler.cs:52-53`, `AddOrderExpenseHandler.cs:52-53`, `AddOrderItemHandler.cs:47`, `AddOrderRefundHandler.cs:51`, `CreateOrderHandler.cs:52-54`

**Issue:** The "retired" and "can be chosen" checks run before `InTransactionAsync`, and nothing locks the list or user row. A method or category retired, or a receiver, payer or refunder deactivated, between the check and the save is still saved. No foreign key fails, because a used entry is retired, not deleted. The window is small and the effect is minor (a just-retired value on one row), but it is a check-then-act gap.

**Fix:** Accept and document it, or rerun the reference checks inside the transaction lambda, as the Update handlers already do.

#### APO-IN-03: The documented return codes leave out some real outcomes, and one summary cites the wrong decision

**File:** `src/Csps.Application/Orders/AddOrderDiscountHandler.cs:31-34`, `AddOrderItemHandler.cs:33-36`, `AddOrderPaymentHandler.cs:35-38`, `AddOrderExpenseHandler.cs:35-38`, `RemoveOrderDiscountHandler.cs:27-30`, `RemoveOrderPaymentHandler.cs:27-30`, `RemoveOrderExpenseHandler.cs:27-30`, `UpdateOrderDetailsHandler.cs:34-37`, `UpdateOrderPaymentHandler.cs:39-42`, `CreateOrderRequestValidator.cs:8`

**Issue:**
- The `<returns>` docs leave out the 422 for a locked Completed or Cancelled order (D-05). Every domain mutator starts with `EnsureEditable()`, for example `Order.RemovePayment` at `Order.cs:803`.
- `AddOrderDiscountHandler` also leaves out the 422 for the 20-discount cap.
- The `CreateOrderRequestValidator` summary cites "the status rule (D-22)", but D-22 is the due-date rule. The status rule is D-01/D-02 (active statuses only).

These docs feed the OpenAPI text and Phase 8's error handling.

**Fix:** Add "or a 422 when the order is completed or cancelled" (and the cap where it applies) to each `<returns>`, and correct the decision number.

#### APO-IN-04: The `OrderTarget = "Order"` constant is repeated in six files

**File:** `src/Csps.Application/Orders/OrderChildWrite.cs:27`, `CreateOrderHandler.cs:33`, `DeleteOrderHandler.cs:23`, `RestoreOrderHandler.cs:20`, `PermanentlyDeleteOrderHandler.cs:25`, `UpdateOrderDetailsHandler.cs:28`

**Issue:** The audit target type is a shared contract that the audit viewer and the D-48 filter read. Six private copies can drift apart.

**Fix:** Define it once, for example as `internal const string OrderAuditTarget = "Order";` in `OrderAuditDetail`, and refer to it everywhere.

---

_Reviewed: 2026-10-28T21:47:41-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice: Application / lists, audit, ports (IDs APX-*)

**Reviewed:** 2026-10-29T02:45:06Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

### Summary

I read all 28 files in full. I also read the code they call: `OrderListEntry` and `OrderExpenseCategory` (domain), `CspsUnitOfWork`,
`ConflictRetry`, `AuditDetailFormat`, `CategoryAuditDetail`, `OrderAuditDetail`, `AuditLogFilters`, `ListAuditLogRequestValidator`,
the `AuditLogReader` mapping and target filter, the three list controllers, and the web `AuditDetail.tsx` branch that uses the
typed lines. Where it helped, I compared with the Phase 6 expense category handlers.

What holds up, checked against the source:

- **Others (D-46).** Renaming Others returns a 400 on `name` with "The Others name can't change." The error comes from the
  domain `Rename` (`OrderListEntry.cs:107-112`) with code `order-expense-categories.invalid-request`, the same code that
  `OrderListErrors.Invalid` uses. Others can still be recolored. Retire and delete return the 422 `protected` error.
  `UpdateOrderListEntryHandler.cs:85` correctly skips the name lookup for Others. The order of checks (form 400, 404, version
  409, Others 400, name taken 400) matches `docs/api/order-lists.md`.
- **Manager-only.** The handlers do not check roles themselves. The controllers put `Policies.Manager` on every write and on
  `GET /{id}`, and `Policies.Staff` on the list read. This matches the documented route table and the Phase 6 pattern.
- **Race translation.** A clash on the unique name becomes `OrderListNameTakenException` and is mapped in Create and Update. A
  foreign key refusing a delete becomes `OrderListEntryInUseException`, caught outside the retry in Delete. Optimistic conflicts
  on retire, reactivate and delete are retried once by `ConflictRetry`. The change tracker is cleared each time, so the audit row
  from the first attempt cannot leak into the second save.
- **Audit lines.** The text-field names in `fields=` are checked against an allowlist (`ExpenseTextFields`, `OrderTextFields`).
  Every order value is normalized to its known shape (status and kind keys, exact `yyyy-MM-dd` dates, invariant amounts,
  unsigned quantities, `D` GUIDs re-formatted). Keys the reader does not know are dropped. No customer details, descriptions,
  notes, reasons or references can reach `Changes`. The raw `Detail` is also returned, but the order writers
  (`OrderAuditDetail.cs`) only write ids, numbers, dates, counts and amounts.
- **Port contracts.** All five new exceptions derive from `InvalidOperationException` and none of them puts a name or number in
  its message. `IOrderLists` documents which save throws which exception.

One warning: a list-entry create that loses a deadlock answers 500. The info items are a gap between the viewer and the owner's
wording (D-42 and D-31), one unchecked value shape in the audit reader, stale port docs, an error code from the auth area, and
dead constants.

### Warnings

#### APX-WR-01: List-entry create does not map a lost deadlock, so it answers 500

**File:** `src/Csps.Application/OrderLists/CreateOrderListEntryHandler.cs:55-70`
**Issue:** `CspsUnitOfWork.SaveChangesAsync` (`CspsUnitOfWork.cs:37-50`) turns a SQL Server deadlock victim (1205) into a
`ConcurrencyConflictException`. The create handler catches only `OrderListNameTakenException`. Nothing on the server maps
`ConcurrencyConflictException` globally: the only `IExceptionHandlerFeature` use is the generic problem-details 500 in
`CspsProblemDetails.cs:78`. So a create that loses a deadlock reaches the user as "Something went wrong. Reference: ...". The
other four write handlers in this folder do map conflicts: Update maps them to `edit.stale`, and Retire, Reactivate and Delete
go through `ConflictRetry`. Create is the only gap. D-46 ruled that a deadlock victim on order create is a 409, not a 500, and
the same reasoning applies here. The chance is low, because the transaction holds only one list insert and one audit insert,
but the path is real and has no test. (Phase 6 `CreateExpenseCategoryHandler.cs:69` has the same gap.)
**Fix:** Catch the conflict and answer with a 409. No retry is needed, because create has no row version to re-read:
```csharp
catch (OrderListNameTakenException)
{
    return Failed(descriptor, new ValidationResult([OrderListErrors.NameTakenFailure()]));
}
catch (ConcurrencyConflictException)
{
    // A deadlock victim: the server rolled the insert back, so nothing was saved.
    return Result.Failure<OrderListEntryDetailResponse>(AuthErrors.SessionBusy); // or a list-scoped busy error, see APX-IN-04
}
```
Add a unit test whose faked save throws `ConcurrencyConflictException`, as D-46b did for `CreateOrderHandler`.

### Info

#### APX-IN-01: The typed audit lines leave out facts the writers store and the owner rulings mention

**File:** `src/Csps.Application/Audit/AuditChangeLines.cs:427-430` and `:450`
**Issue:** `ReadOrder` skips every single value inside an edit entry, and `OrderFieldOf` has no `total` key. Three effects follow,
all intended and pinned by `AuditChangeLinesTests.cs:178-187` and `:323-331`:
- `order-expense.changed` stores `payer=<current id>`, and D-42 says it "shows the current payer". The viewer never shows that
  payer. The same goes for the current receiver on `order-payment.changed` and the current refunder on `order-refund.changed`.
- `order.created` stores `total=...`, but the viewer shows only status and dates. D-31 says money values are kept, and they
  are kept in the stored detail, but they are not shown.
- `ReadOrder` always passes `payerId: null`, so order entries have no Done to person. D-48 makes the Done to filter match order
  entries by receiver, payer or refunder (`AuditLogReader.cs:219-227`). A person who filters by Done to therefore gets rows whose
  Done to column shows the order number instead (`AuditLogPage.tsx:109`). Their name appears only inside the change lines.
  (Company expense entries do fill Done to from the payer.)

The web renders `changes` in preference to the raw detail (`AuditDetail.tsx:68-77`), so none of these values reach the screen.
**Fix:** This is not a code defect. It needs an owner ruling: either confirm that the viewer intentionally hides these values,
or emit the current person (or the created total) as a line in the edit or created entry. Record the outcome next to D-42/D-48.

#### APX-IN-02: The audit reader takes list `tone` (and `name`) values without checking their shape

**File:** `src/Csps.Application/Audit/AuditChangeLines.cs:389-398`
**Issue:** The class contract (`:142-146`) says "each value must have the shape the writer gives it". `ReadCategory` keeps any
`name`/`tone` pair, with or without an old value, and copies the text through as it is. A malformed `tone=` value (anything
other than the six tones) would reach `Changes` verbatim. The risk is low: the log is append-only and only application code
writes it. The free name text is accepted on purpose (D-12).
**Fix:** Filter tone values with `CategoryTones.IsValid` for both the old and the new value. Drop a `tone` part that fails.

#### APX-IN-03: The audit port docs are stale for order entries

**File:** `src/Csps.Application/Ports/IAuditLogReader.cs:42`, `:53-54`
**Issue:** The `TargetType` doc still lists only `User`, `UserSession`, `CompanyExpense` and `ExpenseCategory`. It is missing
`Order` and the three list target types (`ProductType`, `PaymentMethod`, `OrderExpenseCategory`). The `AuditLogQuery.Target`
doc ("entries about this person, including events of their sessions") does not mention the company-expense payer match or the
D-48 receiver/payer/refunder match that the reader now applies. The `Target` doc on `AuditLogEntryView` does not mention the
payer fallback either (`AuditLogReader.cs:146`).
**Fix:** Update the three doc comments so they list the new target types and the D-48 matching rule.

#### APX-IN-04: Retire, reactivate and delete answer a twice-lost race with `auth.session-busy`

**File:** `src/Csps.Application/OrderLists/RetireOrderListEntryHandler.cs:34`, `ReactivateOrderListEntryHandler.cs:32`,
`DeleteOrderListEntryHandler.cs:36`
**Issue:** The fallback answer is `AuthErrors.SessionBusy` (code `auth.session-busy`). An order-list endpoint therefore returns an
error code from the auth area. The `docs/api/order-lists.md` error table lists no 409 code for these routes, only "two lost races
in a row answer 409". This copies the Phase 6 category handlers, so it is consistent, but a client cannot tell from the code
which resource was busy.
**Fix:** Either add the `409 auth.session-busy` row to the order-lists error table, or add a shared `edit.busy` / `{list}.busy`
error and use it in these handlers (and in APX-WR-01).

#### APX-IN-05: `OrderListErrors.NameField` and `VersionField` are unused, and their casing differs

**File:** `src/Csps.Application/OrderLists/OrderListErrors.cs:12`, `:15`
**Issue:** Nothing in `src` or `tests` refers to either constant. `NameField` is `"name"` (camelCase, the wire form) and
`VersionField` is `"Version"` (PascalCase, the property name), so a future caller would get mismatched field keys.
`NameTakenFailure` uses `nameof(OrderListEntryRequest.Name)` instead.
**Fix:** Remove both constants, or make them both the wire names (`"name"`, `"version"`) and use them in `NameTakenFailure` and
the tests.

#### APX-IN-06: The descriptor's `_ =>` arms quietly fall back to the order expense list

**File:** `src/Csps.Application/OrderLists/OrderListDescriptor.cs:43`, `:51`, `:59`, `:67`, `:75`, `:83`, `:106`
**Issue:** `For()` throws on an unknown kind (`:94`). The action properties and `CreateEntry` instead map every other kind to the
order expense category actions and factory. The record has a public positional constructor, so
`new OrderListDescriptor((OrderListKind)9, ...)` would write `order-expense-category.*` audit entries and build an
`OrderExpenseCategory` without any error. No caller does this today, because every handler goes through `For()`.
**Fix:** Name `OrderListKind.OrderExpenseCategory` explicitly in each switch and make `_ =>` throw
`ArgumentOutOfRangeException`, as `For()` does. Or make the constructor private.

---

_Reviewed: 2026-10-29T02:45:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice: Infrastructure, Server, web (IDs IWB-*)

*Created: 2026-10-28T22:30:00-05:00 · Updated: 2026-10-28T22:30:00-05:00*

**Reviewed:** 2026-10-29T03:30:00Z
**Depth:** standard
**Files Reviewed:** 60
**Status:** issues_found

### Summary

I reviewed the EF configurations, the nine new migrations, the order and order-list stores, the order reader, the number allocator, the audit reader changes, the Legacy holder guards, the seed step, the ten new controllers and composition, and the web audit viewer changes. I checked each finding against the source and against the Application and Domain code it calls.

Checks that passed:

- **Default deny:** every action declares a policy. Each class has `[Authorize(Policy = Policies.Staff)]`. Every Manager-only route has `[Authorize(Policy = Policies.Manager)]`: deleted list, restore, permanent delete, and get/create/update/retire/reactivate/delete on all three lists.
- **Testing route:** `TestingOrdersController` is inside `#if CSPS_TESTING` (defined only for Debug in `Csps.Server.csproj`). It also has `[TestingOnly]`, so `TestingControllersFeatureProvider` removes it outside the Testing environment.
- **No inline SQL** in application code. Locks use `ExecuteUpdate`. Search uses `EF.Functions.Like` with `LikePattern.Contains` and an escape character, and `LikePattern` escapes `\`, `%`, `_` and `[`.
- **Migrations:** no trigger, no JSON column, no `Sql(...)`. The only `Up` drops are `IX_Orders_CreatedAtUtc` and `IX_OrderItems_ProductTypeId`, which D-45 approves. The FK column stays covered by `IX_OrderItems_ProductTypeId_OrderId`.
- **Legacy holder (D-37):** the holder is left out of the staff list, the user list, user detail, the audit people list and every `UserAccounts` lookup.
- **Web:** no em or en dash in the changed web files. The server and web audit action codes match one to one. The new subline matches D-48 word for word.

One blocker: the product type filter on the order list brings soft-deleted orders back.

### Narrative Findings (AI reviewer)

### Critical Issues

#### IWB-CR-01: The product type filter on the order list shows and counts soft-deleted orders

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:91-96`
**Issue:** The product type filter builds its subquery from `context.Set<OrderItem>().IgnoreQueryFilters([SoftDeleteFilter])` and puts it inside the outer `context.Orders` query. In EF Core, `IgnoreQueryFilters` is not scoped to the subquery it is written on. The query compiler stores the ignored filter names on the whole compilation (`QueryCompilationContext`), and the same applies to the named-filter overload. So the `SoftDelete` filter on the **outer** `Orders` root is lifted as well. The code comment says "The outer query already hides deleted orders", but that is not what happens.

Result: `GET /api/v1/orders?productType=<id>` returns soft-deleted orders and counts them in `total`. That breaks D-26 ("hidden from every list, total and balance") and ORD-01/02. Nothing tests this case. `ListOrdersEndpointTests.ADeletedOrderIsNotListedCountedOrFound` covers only `status=all` and `q=`, and `ProductTypeKeepsOrdersWithAtLeastOneItemOfThatTypeOnceEach` deletes nothing.

The same pattern is harmless in `OrderListStore.ListAsync` (lines 32-34), because the list tables at its root have no filter.

**Fix:** Keep the filter in force, or state the deleted check on the outer query yourself. Then add a red test first: delete an order that has a Polo item and assert `productType=<polo>` neither lists nor counts it.

```csharp
if (query.ProductTypeId is { } productTypeId)
{
    // No IgnoreQueryFilters here: it is query-wide in EF and would lift the outer SoftDelete filter too.
    orders = orders.Where(order => order.Items.Any(item => item.ProductTypeId == productTypeId));
}
```

If the extra join to `Orders` that the item filter adds must be avoided, keep the lifted subquery but add `order.DeletedAtUtc == null` to the outer query explicitly, for example at the top of `Filter`.

### Warnings

#### IWB-WR-01: The audit viewer drops the line for a due date added to an imported order

**File:** `web/src/modules/admin/auditCopy.ts:316-327` (`valuePair`), used at line 375 (`dueDate`)
**Issue:** On `order.changed`, the server writes `dueDate=>2026-11-18` for an imported order that had no due date (`OrderAuditDetail.DetailsChanged`). It parses this on purpose into `ParsedAuditChange("dueDate", null, "2026-11-18")` (`AuditChangeLines.ReadOrder`, line 435, and the test `AnImportedOrderThatGainsADueDateGivesANewDueDateWithNoOldOne`). `order.changed` is not a stated-value action, so the web calls `valuePair(..., stated = false)`. With `line.from === null` that function returns `null`, so the line is dropped. When the due date was the only change, "What changed" shows nothing. D-31 requires old and new values for dates.

The web test `auditCopy.test.ts:343` covers only the `stated = true` path (`describeAuditChange(change('dueDate', null, ...), true)`), so it misses the real case.

**Fix:** Treat a missing old due date as "Not set" in a change, and add a test with `stated = false`:

```ts
case 'dueDate':
  if (!stated && line.from === null && line.to !== null) {
    const to = dateText(line.to);
    return to === null ? null : pair('Due date', 'Not set', to);
  }
  return valuePair('Due date', line, stated, dateText);
```

Use whatever wording the owner approves for the empty side. Ask the owner (D-48 approved the viewer copy as written), and do not use a dash (OR-4).

#### IWB-WR-02: The OpenAPI contract leaves out the 422 `orders.locked` answer on most order writes

**File:** `src/Csps.Server/Controllers/OrdersController.cs:123-137`, `OrderItemsController.cs:37-107`, `OrderDiscountsController.cs:65-101`, `OrderPaymentsController.cs:70-106`, `OrderExpensesController.cs` (Update and Remove)
**Issue:** Every domain mutator except refunds starts with `EnsureEditable()` (`Order.cs:443, 493, 527, 579, 615, 655, 706, 750, 803, 831, 867, 910, 933`). On a Completed or Cancelled order it returns `Error.BusinessRule(OrderRules.LockedCode, ...)`, which maps to 422 `orders.locked` (D-05). But:
- `UpdateOrderDetails`, `UpdateOrderDiscount`, `RemoveOrderDiscount`, `UpdateOrderPayment`, `RemoveOrderPayment`, `UpdateOrderExpense` and `RemoveOrderExpense` have no `[ProducesResponseType(Status422UnprocessableEntity)]`.
- No item, discount, payment, expense or details doc mentions `orders.locked`. Only `OrderRefundsController` documents it.

Phase 8 builds on `api.generated.ts` and these docs. A client written to the contract will not handle the most common refusal on a locked order.

**Fix:** Add `[ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]` to each of those actions. Add "A completed or cancelled order answers 422 `orders.locked`." to each summary and `<returns>`, as the refund controller does. Then regenerate the API types.

#### IWB-WR-03: The Others rename doc says 422, but the server answers 400

**File:** `src/Csps.Server/Controllers/OrderExpenseCategoriesController.cs:90, 96, 106`
**Issue:** The Update summary says renaming Others "answers 422 `order-expense-categories.protected`", and the action declares a 422 response. D-46 rules that it is 400 on `name` with "The Others name can't change.". The domain does that: `OrderListEntry.Rename` returns `Reject(ErrorPrefix, NameField, OthersNameMessage)` (`OrderListEntry.cs:111`), and `UpdateOrderListEntryHandler.cs:84` says the same. The 422 `.protected` code comes only from retire and delete. Phase 8 will mirror this in zod and error handling, so the published contract is wrong.

**Fix:** Change the sentence to "Others keeps its name but may change colour: any other name answers 400 on `name` with 'The Others name can't change.'". Drop the 422 from `UpdateOrderExpenseCategory`'s `<returns>` and its `ProducesResponseType`, unless another 422 path exists for Update. None does in the handler.

#### IWB-WR-04: Order detail is read in seven separate statements, so totals and child lists can come from different saves

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:163-358`
**Issue:** `GetDetailAsync` reads the header (stored totals and `RowVersion`), then items, discounts, payments, refunds, expenses and history, each in its own statement. None of it runs in a transaction or snapshot. A child write that commits between the header read and the child reads returns totals that do not match the listed rows. For example, `paidTotal` excludes a payment that `payments` includes, and the returned version is from before that payment.

`OrderStore.FindAsync` guards against exactly this for writes (lines 70-82). The read path, which staff see after every save, does not. The Core Value says staff "always see correct, server-computed totals".

**Fix:** After the last child read, re-read the row version, as `FindAsync` does. On a mismatch, read again once (or return the conflict for the handler to retry):

```csharp
var current = await context.Orders.AsNoTracking().Where(row => row.Id == id).Select(row => row.RowVersion).SingleOrDefaultAsync(cancellationToken);
if (current is null || !current.AsSpan().SequenceEqual(header.Order.RowVersion)) { /* read again once */ }
```

Another option is to run the reads in one snapshot-isolation transaction, if the database allows it.

### Info

#### IWB-IN-01: The `OrderReader` class summary gives the wrong number of statements

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:13`
**Issue:** It says "one statement for the order, one for the items and one for the history". `GetDetailAsync` runs seven statements: header, items, discounts, payments, refunds, expenses and history. This misleads anyone checking the query-count tests.
**Fix:** "Untracked reads: one statement for the order and one for each child list and the history."

#### IWB-IN-02: `LockAsync` does not turn a lock timeout or deadlock into a typed conflict

**File:** `src/Csps.Infrastructure/Orders/OrderStore.cs:94-97`
**Issue:** Unlike `DatabaseLocks.TakeAsync`, the order row lock runs with the default command timeout. It does not translate `SqlErrors.Timeout` or `DeadlockVictim`. `OrderChildWrite.SaveFormAsync` catches only `ConcurrencyConflictException` and `OrderListEntryDeletedException`, so a lock wait that times out becomes a 500 instead of the 409 stale answer. This is unlikely under normal load.
**Fix:** Wrap the `ExecuteUpdateAsync` in `catch (Exception error) when (SqlErrors.Has(error, SqlErrors.Timeout, SqlErrors.DeadlockVictim))` and throw `ConcurrencyConflictException`.

#### IWB-IN-03: The testing order route returns 500 on a null array element

**File:** `src/Csps.Server/Controllers/TestingOrdersController.cs:119-134, 150-154`
**Issue:** A body such as `{"payments":[null]}` passes deserialization, and then `payments[index].PaymentDate` throws `NullReferenceException`. The same happens for `items`, `discounts` and `expenses`. It is Testing-only (compiled out of Release), but the doc promises "the same plain 400 for every caller".
**Fix:** Reject null elements up front, for example by adding `broken["payments"] = [OrderRules.InvalidMessage]` when `payments.Any(p => p is null)`, and do the same for the other lists.

#### IWB-IN-04: One seed contact number is a valid mobile number format

**File:** `src/Csps.Infrastructure/Seeding/OrdersSeedStep.cs:114`
**Issue:** `"0917 123 4567"` comes from the UI spec and is a valid Globe mobile number format that could belong to a real subscriber. The other rows use the `0917 555 xxxx` pattern, and the comment says only those are made up. The repo is public, and the owner's rule is clearly fake test values.
**Fix:** Use a made-up number in the same pattern, such as `"0917 555 0148"`, or confirm with the owner that the UI-spec value is safe to keep.

---

_Reviewed: 2026-10-29T03:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
