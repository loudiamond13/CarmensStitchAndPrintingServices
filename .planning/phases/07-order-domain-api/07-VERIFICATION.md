---
phase: 07-order-domain-api
created: 2026-10-28T23:05:00-05:00
updated: 2026-10-28T23:05:00-05:00
verified: 2026-10-29T04:05:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/phases/07-order-domain-api/07-01-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-01-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-02-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-02-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-03-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-03-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-04-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-04-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-05-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-05-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-06-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-06-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-07-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-07-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-08-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-08-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-09-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-09-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-10-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-10-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-11-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-11-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-12-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-12-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-13-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-13-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-14-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-14-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-15-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-15-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-16-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-16-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-17-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-17-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-18-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-18-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-19-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-19-SUMMARY.md"
  - ".planning/phases/07-order-domain-api/07-20-PLAN.md"
  - ".planning/phases/07-order-domain-api/07-20-SUMMARY.md"
  - "src/Csps.Application/Audit/AuditChangeLines.cs"
  - "src/Csps.Application/Audit/AuditLogResponse.cs"
  - "src/Csps.Application/Audit/ListAuditLogHandler.cs"
  - "src/Csps.Application/Common/ConcurrencyConflictException.cs"
  - "src/Csps.Application/Common/ConflictRetry.cs"
  - "src/Csps.Application/Common/ValidationResults.cs"
  - "src/Csps.Application/OrderLists/CreateOrderListEntryHandler.cs"
  - "src/Csps.Application/OrderLists/DeleteOrderListEntryHandler.cs"
  - "src/Csps.Application/OrderLists/GetOrderListEntryHandler.cs"
  - "src/Csps.Application/OrderLists/ListOrderListHandler.cs"
  - "src/Csps.Application/OrderLists/OrderListAuditDetail.cs"
  - "src/Csps.Application/OrderLists/OrderListDescriptor.cs"
  - "src/Csps.Application/OrderLists/OrderListEntryDetailResponse.cs"
  - "src/Csps.Application/OrderLists/OrderListEntryRequest.cs"
  - "src/Csps.Application/OrderLists/OrderListEntryRequestValidator.cs"
  - "src/Csps.Application/OrderLists/OrderListErrors.cs"
  - "src/Csps.Application/OrderLists/OrderListItem.cs"
  - "src/Csps.Application/OrderLists/ReactivateOrderListEntryHandler.cs"
  - "src/Csps.Application/OrderLists/RetireOrderListEntryHandler.cs"
  - "src/Csps.Application/OrderLists/UpdateOrderListEntryHandler.cs"
  - "src/Csps.Application/Orders/AddOrderDiscountHandler.cs"
  - "src/Csps.Application/Orders/AddOrderDiscountRequest.cs"
  - "src/Csps.Application/Orders/AddOrderDiscountRequestValidator.cs"
  - "src/Csps.Application/Orders/AddOrderExpenseHandler.cs"
  - "src/Csps.Application/Orders/AddOrderExpenseRequest.cs"
  - "src/Csps.Application/Orders/AddOrderExpenseRequestValidator.cs"
  - "src/Csps.Application/Orders/AddOrderItemHandler.cs"
  - "src/Csps.Application/Orders/AddOrderItemRequest.cs"
  - "src/Csps.Application/Orders/AddOrderItemRequestValidator.cs"
  - "src/Csps.Application/Orders/AddOrderPaymentHandler.cs"
  - "src/Csps.Application/Orders/AddOrderPaymentRequest.cs"
  - "src/Csps.Application/Orders/AddOrderPaymentRequestValidator.cs"
  - "src/Csps.Application/Orders/AddOrderRefundHandler.cs"
  - "src/Csps.Application/Orders/AddOrderRefundRequest.cs"
  - "src/Csps.Application/Orders/AddOrderRefundRequestValidator.cs"
  - "src/Csps.Application/Orders/ChangeOrderStatusHandler.cs"
  - "src/Csps.Application/Orders/ChangeOrderStatusRequest.cs"
  - "src/Csps.Application/Orders/ChangeOrderStatusRequestValidator.cs"
  - "src/Csps.Application/Orders/CreateOrderHandler.cs"
  - "src/Csps.Application/Orders/CreateOrderRequest.cs"
  - "src/Csps.Application/Orders/CreateOrderRequestValidator.cs"
  - "src/Csps.Application/Orders/DeleteOrderHandler.cs"
  - "src/Csps.Application/Orders/DeletedOrderListResponse.cs"
  - "src/Csps.Application/Orders/DiscountKindNames.cs"
  - "src/Csps.Application/Orders/GetOrderHandler.cs"
  - "src/Csps.Application/Orders/IOrderDetailsFields.cs"
  - "src/Csps.Application/Orders/IOrderDiscountFields.cs"
  - "src/Csps.Application/Orders/IOrderExpenseFields.cs"
  - "src/Csps.Application/Orders/IOrderItemFields.cs"
  - "src/Csps.Application/Orders/IOrderPaymentFields.cs"
  - "src/Csps.Application/Orders/IOrderRefundFields.cs"
  - "src/Csps.Application/Orders/ImportOrderHandler.cs"
  - "src/Csps.Application/Orders/LegacyEditFilter.cs"
  - "src/Csps.Application/Orders/ListDeletedOrdersHandler.cs"
  - "src/Csps.Application/Orders/ListDeletedOrdersRequest.cs"
  - "src/Csps.Application/Orders/ListDeletedOrdersRequestValidator.cs"
  - "src/Csps.Application/Orders/ListOrdersHandler.cs"
  - "src/Csps.Application/Orders/ListOrdersRequest.cs"
  - "src/Csps.Application/Orders/ListOrdersRequestValidator.cs"
  - "src/Csps.Application/Orders/OrderAuditDetail.cs"
  - "src/Csps.Application/Orders/OrderChildWrite.cs"
  - "src/Csps.Application/Orders/OrderDetailResponse.cs"
  - "src/Csps.Application/Orders/OrderDetailsFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderDiscountFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderErrors.cs"
  - "src/Csps.Application/Orders/OrderExpenseFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderItemFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderListResponse.cs"
  - "src/Csps.Application/Orders/OrderPaymentFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderReferenceChecks.cs"
  - "src/Csps.Application/Orders/OrderRefundFieldsValidator.cs"
  - "src/Csps.Application/Orders/OrderStatusNames.cs"
  - "src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs"
  - "src/Csps.Application/Orders/RemoveOrderDiscountHandler.cs"
  - "src/Csps.Application/Orders/RemoveOrderExpenseHandler.cs"
  - "src/Csps.Application/Orders/RemoveOrderItemHandler.cs"
  - "src/Csps.Application/Orders/RemoveOrderPaymentHandler.cs"
  - "src/Csps.Application/Orders/RemoveOrderRefundHandler.cs"
  - "src/Csps.Application/Orders/RestoreOrderHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderDetailsRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderDetailsRequestValidator.cs"
  - "src/Csps.Application/Orders/UpdateOrderDiscountHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderDiscountRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderDiscountRequestValidator.cs"
  - "src/Csps.Application/Orders/UpdateOrderExpenseHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderExpenseRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderExpenseRequestValidator.cs"
  - "src/Csps.Application/Orders/UpdateOrderItemHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderItemRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderItemRequestValidator.cs"
  - "src/Csps.Application/Orders/UpdateOrderPaymentHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderPaymentRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderPaymentRequestValidator.cs"
  - "src/Csps.Application/Orders/UpdateOrderRefundHandler.cs"
  - "src/Csps.Application/Orders/UpdateOrderRefundRequest.cs"
  - "src/Csps.Application/Orders/UpdateOrderRefundRequestValidator.cs"
  - "src/Csps.Application/Ports/IAuditLogReader.cs"
  - "src/Csps.Application/Ports/IOrderLists.cs"
  - "src/Csps.Application/Ports/IOrderNumbers.cs"
  - "src/Csps.Application/Ports/IOrderReader.cs"
  - "src/Csps.Application/Ports/IOrders.cs"
  - "src/Csps.Application/Ports/OrderListEntryDeletedException.cs"
  - "src/Csps.Application/Ports/OrderListEntryInUseException.cs"
  - "src/Csps.Application/Ports/OrderListNameTakenException.cs"
  - "src/Csps.Application/Ports/OrderNumberBusyException.cs"
  - "src/Csps.Application/Ports/OrderNumberTakenException.cs"
  - "src/Csps.Domain/Auditing/AuditActions.cs"
  - "src/Csps.Domain/Identity/LegacyHolder.cs"
  - "src/Csps.Domain/OrderLists/OrderExpenseCategory.cs"
  - "src/Csps.Domain/OrderLists/OrderListEntry.cs"
  - "src/Csps.Domain/OrderLists/OrderListKind.cs"
  - "src/Csps.Domain/OrderLists/OrderListSeed.cs"
  - "src/Csps.Domain/OrderLists/PaymentMethod.cs"
  - "src/Csps.Domain/OrderLists/ProductType.cs"
  - "src/Csps.Domain/Orders/Order.cs"
  - "src/Csps.Domain/Orders/OrderChanges.cs"
  - "src/Csps.Domain/Orders/OrderDiscount.cs"
  - "src/Csps.Domain/Orders/OrderExpense.cs"
  - "src/Csps.Domain/Orders/OrderImportChecks.cs"
  - "src/Csps.Domain/Orders/OrderImportRules.cs"
  - "src/Csps.Domain/Orders/OrderImportSnapshot.cs"
  - "src/Csps.Domain/Orders/OrderInputs.cs"
  - "src/Csps.Domain/Orders/OrderItem.cs"
  - "src/Csps.Domain/Orders/OrderMath.cs"
  - "src/Csps.Domain/Orders/OrderMathModels.cs"
  - "src/Csps.Domain/Orders/OrderNumber.cs"
  - "src/Csps.Domain/Orders/OrderNumberCounter.cs"
  - "src/Csps.Domain/Orders/OrderPayment.cs"
  - "src/Csps.Domain/Orders/OrderRefund.cs"
  - "src/Csps.Domain/Orders/OrderRules.cs"
  - "src/Csps.Domain/Orders/OrderStatus.cs"
  - "src/Csps.Domain/Orders/OrderStatusChange.cs"
  - "src/Csps.Domain/Orders/OrderStatusRules.cs"
  - "src/Csps.Domain/Orders/OrderTotals.cs"
  - "src/Csps.Domain/Orders/Pesos.cs"
  - "src/Csps.Infrastructure/Auditing/AuditLogReader.cs"
  - "src/Csps.Infrastructure/DependencyInjection.cs"
  - "src/Csps.Infrastructure/Identity/ApplicationUser.cs"
  - "src/Csps.Infrastructure/Identity/StaffDirectory.cs"
  - "src/Csps.Infrastructure/Identity/UserAccounts.cs"
  - "src/Csps.Infrastructure/Identity/UserDirectory.cs"
  - "src/Csps.Infrastructure/OrderLists/OrderListStore.cs"
  - "src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs"
  - "src/Csps.Infrastructure/Orders/OrderReader.cs"
  - "src/Csps.Infrastructure/Orders/OrderStore.cs"
  - "src/Csps.Infrastructure/Orders/OrdersRegistration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderDiscountConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseCategoryConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderItemConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderListEntryConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderNumberCounterConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderPaymentConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderRefundConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/OrderStatusChangeConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/PaymentMethodConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/ProductTypeConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/CspsDbContext.cs"
  - "src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs"
  - "src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028141016_AddOrderLists.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028152204_AddOrders.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028165341_AddLegacyHolder.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028181319_AddOrderDiscounts.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028191015_AddOrderPayments.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028200438_AddOrderExpenses.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028211102_AddOrderRefunds.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261028225721_AddOrderListIndexes.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261029001300_DropUnusedOrderIndexes.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs"
  - "src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeedSteps.cs"
  - "src/Csps.Infrastructure/Seeding/OrdersSeedStep.cs"
  - "src/Csps.Server/Composition/ApplicationRegistration.cs"
  - "src/Csps.Server/Composition/OrdersApplicationRegistration.cs"
  - "src/Csps.Server/Controllers/OrderDiscountsController.cs"
  - "src/Csps.Server/Controllers/OrderExpenseCategoriesController.cs"
  - "src/Csps.Server/Controllers/OrderExpensesController.cs"
  - "src/Csps.Server/Controllers/OrderItemsController.cs"
  - "src/Csps.Server/Controllers/OrderPaymentsController.cs"
  - "src/Csps.Server/Controllers/OrderRefundsController.cs"
  - "src/Csps.Server/Controllers/OrdersController.cs"
  - "src/Csps.Server/Controllers/PaymentMethodsController.cs"
  - "src/Csps.Server/Controllers/ProductTypesController.cs"
  - "src/Csps.Server/Controllers/TestingOrdersController.cs"
covered_digest: "v3:sha256:e69d6675b30a0cb331abc24d11b0e91b11be02350317fb416f226dc5a17b61c4"
human_verification:
  - test: "Read the DOM-WR-04 change (edits re-check only the fields they change) in src/Csps.Application/Orders/LegacyEditFilter.cs and the six edit handlers, and try one edit of an imported legacy order through the API."
    expected: "A legacy value left as saved (an amount over the cap, a future date, a quantity of 0, no contact number) does not block an edit of another field. A changed field is still checked in full. The D-05 lock, the discount cap, the payment balance cap and the refund caps still apply."
    why_human: "This is a logic change that loosens validation on the money path. Tests pass, but the owner should confirm the loosening matches D-49b and opens no hole."
  - test: "Read the APO-WR-01 change (commit 529510b1: ConcurrencyConflictException, ConflictRetry, CspsUnitOfWork) and its two-connection deadlock test."
    expected: "A deadlock inside the idempotency transaction's savepoint answers 409, not 500, and ConflictRetry does not retry inside a dead transaction."
    why_human: "Concurrency and transaction logic. A passing test proves one deadlock shape only; a reviewer should judge the rest."
  - test: "Decide the open owner question APX-IN-04: should list writes get their own busy code instead of the shared auth.session-busy?"
    expected: "An owner ruling recorded as a D-number. Today the shared code is used."
    why_human: "A contract change across Phases 6 and 7. The owner decides."
  - test: "Decide APX-IN-01: should audit lines show the current payer, receiver, refunder and the created total?"
    expected: "An owner ruling at the Phase 8 UI review. Today they are left out."
    why_human: "Wording and scope of audit copy are the owner's call."
  - test: "Decide whether refunds on a soft-deleted order count toward money on hand (parked at D-39)."
    expected: "A ruling before the Phase 10 money-on-hand reports are planned."
    why_human: "Owner decision. No code in Phase 7 depends on it."
---

# Phase 7: Order Domain & API Verification Report

*Created: 2026-10-28T23:05:00-05:00 · Updated: 2026-10-28T23:05:00-05:00*

**Phase Goal:** The order aggregate and its full API enforce every owner-ruled business rule and always return correct, server-computed totals. The API covers create, read, list/search, update, child mutations, status and delete. Fixtures, invariant tests and race tests prove the Core Value before Phase 8 builds on it.
**Verified:** 2026-10-29T04:05:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

## Result in plain words

The goal is met in the code. Every roadmap success criterion has working code and a passing test that I ran myself, not only the summaries' claims. No gap was found. The status is `human_needed` only because the review disposition flagged two logic changes for a human check, and three owner questions are still open. None of them blocks Phase 8.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, with D-39 notes applied)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Atomic create (full aggregate), numbered `ORD-{YYYY}-{NNNN}`, no duplicates under 20 parallel creates, right year across New Year in Manila, items carry a product type plus size/variant (product type list is Manager-editable per D-18) | VERIFIED | `Order.Create` checks details, status, items, discounts, payments and expenses in one object; `CreateOrderEndpointTests` and `OrderNumberingTests` (`TwentyCreatesAtTheSameMomentGetTwentyDistinctContiguousNumbersEveryRound`, `OneSecondBeforeManilaMidnight...`, `AtManilaMidnight...`, `TheCountersOfTwoYears...`, lock timeout 409) ran green in the 261-test Server Orders namespace run. Counter table `OrderNumberCounter` plus `OrderNumberAllocatorTests` (Infrastructure, 51 green). |
| 2 | Exact math: ORD-2026-0148 gives Subtotal 22,450.00, Discount 1,122.50, Paid 12,000.00, Balance 9,327.50, Expenses 6,065.00, Profit 15,262.50; every child mutation revalidates and returns recomputed totals; only a payment above the balance is refused (D-12 supersedes "all mutation types") | VERIFIED | `CreateOrderEndpointTests` lines 539-584 assert balance 9327.50, expenses 6065.00, profit 15262.50 through the API; `ImportOrderEndToEndTests` repeats it. `OrderMath.Compute` reads as pinned (round subtotal, round each discount, round sum, subtract; half away from zero). Golden vector test and `OrderMathRefundTests` green (Domain 1182/1182). `Order.AddPayment` refuses amount > balance; item, discount, payment, expense and refund endpoint test classes green. |
| 3 | Concurrency: two concurrent edits never both succeed; stale one gets 409; child-only edits included (two payments against one balance) | VERIFIED | `OrderConcurrencyTests` (run, green): same-version double save has exactly one winner, two item adds, two payments of 5,000 on a 9,327.50 balance, two refunds of 7,000 on a cancelled order paid 12,000, soft delete racing an item add, Complete racing a fixed discount. Every child write goes through the order row version (`EditVersion`, `RowVersion`). `OrderStoreLockTests` green. |
| 4 | Status rules: seven statuses, only ruled transitions, each recorded (from, to, who, when); cancelled-order payments and refunds follow the ruled policy | VERIFIED | `OrderStatusRules.Check` read: free moves among the five active statuses, Completed needs balance exactly 0 (separate codes for owed and credit), end states left only by reopen, no direct Completed/Cancelled move. History row is added by `ChangeStatus` and by `Create`. `OrderStatusEndpointTests`, `OrderStatusRulesTests`, `OrderRefundsEndpointTests`, `OrderRefundTests` green. Refund caps and cancelled-order profit `(paid - refunded) - expenses` are in `Order.AddRefund` and `OrderMath`. |
| 5 | `Order.Import` accepts legacy-shaped data through named, configurable rule constants | VERIFIED | `OrderImportRules` has 14 named switches (`KeepLegacyNumber`, `DueDateOptional`, `AllowOverpaid`, `AllowCompletedWithBalance`, `IgnoreAmountCaps`, ... `AllowNoItems`) with `Default` and `Strict` instances. Money figures are always recomputed, never brought in. `OrderImportTests`, `ImportOrderHandlerTests`, `ImportOrderEndToEndTests` green. |
| 6 | Payment receiver: required, server-validated active Admin or Manager on payment create, edit and full-aggregate create; receiver change audited; staff lookup for both roles | VERIFIED | `OrderPeopleTests`, `OrderPaymentsEndpointTests`, `OrderPaymentHandlerTests`, `OrderReferenceChecks` in Application. `payment-changed` audit entries covered by `OrderAuditViewerTests` (before and after receiver). Staff lookup is the Phase 6 `StaffController` reuse. The hidden "Legacy / unassigned" holder is covered by `LegacyHolderHiddenTests`. |
| 7 | Expense payer: required, server-validated active Admin or Manager on order-expense create, edit and full-aggregate create; payer change audited | VERIFIED | `OrderExpensesEndpointTests`, `OrderExpenseHandlerTests`, `OrderPeopleTests` green; `order-expense.payer-changed` entry shape ruled at D-42. |

**Score:** 7/7 truths verified, 0 present but behavior-unverified. Every behavior-dependent truth (status transitions, locks, race outcomes) has a named passing behavioral test, so none rests on symbol presence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Csps.Domain/Orders/Order.cs` (1352 lines) | Aggregate: Create, Import, details, items, discounts, payments, expenses, refunds, status, delete, restore | VERIFIED | All methods present with real rule checks; no stubs. |
| `src/Csps.Domain/Orders/OrderMath.cs` | Authoritative math with refunds, credit, cancelled profit | VERIFIED | Read in full; matches D-09, D-12, D-13, D-36. |
| `src/Csps.Domain/Orders/OrderStatusRules.cs` | Seven-status table | VERIFIED | Read in full. |
| `src/Csps.Domain/Orders/OrderImportRules.cs`, `OrderImportChecks.cs` | Named relaxations | VERIFIED | 14 named switches. |
| `src/Csps.Application/Orders/*` (about 75 files) | One handler per use case, validators | VERIFIED | Handlers for create, read, list, deleted list, details, 5 child kinds x add/update/remove, status, delete, restore, permanent delete, import. |
| `src/Csps.Server/Controllers/Orders*, OrderItems*, OrderPayments*, OrderRefunds*, OrderDiscounts*, OrderExpenses*` | Attribute-routed controllers, explicit policies | VERIFIED | Every action has `[Authorize]` (class-level `Staff`, Manager on deleted list, restore, permanent delete). Authorization matrix 378/378 green. |
| Product types, payment methods, order expense categories controllers | Manager-editable lists | VERIFIED | Staff read, Manager write (create, rename, retire, reactivate, delete). |
| Migrations `AddOrderLists`, `AddOrders`, `AddLegacyHolder`, `AddOrderDiscounts`, `AddOrderPayments`, `AddOrderExpenses`, `AddOrderRefunds`, `AddOrderListIndexes`, `DropUnusedOrderIndexes` | Schema from EF only | VERIFIED | Present. Grep of the phase diff for `CREATE TRIGGER`, `FromSql`, `ExecuteSql`, `SqlQuery` found nothing (OR-7, no inline SQL). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Controllers | Handlers | one handler call per action | WIRED | Proven end to end by 261 green Server integration tests in the Orders namespace. |
| Handlers | Domain `Order` | `Order.Create`, `AddPayment`, etc. | WIRED | Handler unit tests plus endpoint tests. |
| Handler | Number allocator | per-year counter row lock | WIRED | `OrderNumberAllocatorTests` and the 20-parallel API test. |
| Child writes | Parent row version | `EditVersion` / `RowVersion` | WIRED | Concurrency tests above. |
| Order events | Audit log and viewer | `OrderAuditDetail`, `AuditChangeLines` | WIRED | `OrderAuditViewerTests` and 154 web audit tests green. |
| Receiver / payer | Staff rule | `OrderReferenceChecks` | WIRED | `OrderPeopleTests`. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Order detail and list totals | subtotal, discount, total, paid, refunded, balance, credit, expenses, profit | `Order.Recalculate` over stored children, `OrderReader` queries | Yes: figures are read back after create and after each write in the endpoint tests | FLOWING |
| Deleted list, audit viewer | rows | `OrderReader`, `ListAuditLogHandler` | Yes | FLOWING |

### Behavioral Spot-Checks (run by this verifier on 2026-10-28)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole solution builds with no warnings | `dotnet build Csps.slnx -warnaserror` | 0 warnings, 0 errors | PASS |
| Domain tests | `dotnet test --project tests/Csps.Domain.UnitTests` | 1182 / 1182 | PASS |
| Application tests | `dotnet test --project tests/Csps.Application.UnitTests` | 1896 / 1896 | PASS |
| Architecture tests (onion, layout) | `dotnet test --project tests/Csps.ArchitectureTests` | 241 / 241 | PASS |
| Server integration, Orders namespace (numbering, concurrency, lock, status, refunds, import, list timing, query count) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-namespace "*.Orders"` | 261 / 261 | PASS |
| Server integration, Authorization matrix | `--filter-namespace "*.Authorization"` | 378 / 378 | PASS |
| Infrastructure integration, Orders namespace | `--filter-namespace "*.Orders"` | 51 / 51 | PASS |
| Web audit viewer tests with axe | `npx vitest run audit` | 6 files, 154 tests passed | PASS |
| Generated API types match the OpenAPI snapshot | `npm --prefix tools/openapi-gen run check` | matches | PASS |

I did not re-run the whole solution (5915 tests) or the coverage gate; those figures (Domain 100%/100%, Application 99.1%) are from the disposition and are not independently confirmed here. `ExpenseListTimingTests` (Phase 6, D-76) is a known machine-speed flake and was not in my runs.

### Probe Execution

Step 7c: SKIPPED. No probes are declared by the Phase 7 plans.

### Requirements Coverage

All 12 requirement IDs in the ROADMAP are claimed by at least one PLAN frontmatter and are marked `[x]` and Complete in REQUIREMENTS.md.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ORD-03 | 07-05, 07-06, 07-10, 07-11, 07-12 | Create in one transaction, full aggregate | SATISFIED | `CreateOrderEndpointTests`, full 0148 body |
| ORD-05 | 07-04, 07-07, 07-09 to 07-12, 07-14 | Update with revalidation and recomputed totals | SATISFIED | Child endpoint tests; credit allowed (D-12) |
| ORD-08 | 07-07, 07-09, 07-11, 07-14 | 409 on concurrent edits incl. child-only | SATISFIED | `OrderConcurrencyTests` |
| ORD-13 | 07-01, 07-04, 07-05, 07-09, 07-17 | Product type from Manager-editable list plus size/variant | SATISFIED | Lists API, item tests |
| ORD-14 | 07-05, 07-06, 07-18 | `ORD-{YYYY}-{NNNN}`, concurrency-safe, legacy preserved | SATISFIED | `OrderNumberingTests`, import `KeepLegacyNumber` |
| ORD-16 | 07-05, 07-13, 07-19 | Status history | SATISFIED | `OrderStatusEndpointTests`, audit viewer |
| ORD-17 | 07-03, 07-04, 07-13 | Seven statuses and transitions | SATISFIED | `OrderStatusRulesTests` |
| ORD-18 | 07-02, 07-04, 07-13, 07-14 | Refunds, cancelled-order policy | SATISFIED | `OrderRefund*Tests`, `OrderMathRefundTests` |
| ORD-20 | 07-02, 07-05, 07-10, 07-12, 07-16, 07-20 | Fixture reproduces exactly | SATISFIED | Assertions at `CreateOrderEndpointTests` 539-584 |
| ORD-21 | 07-08, 07-18, 07-20 | `Order.Import` with rule constants | SATISFIED | `OrderImportRules`, import tests |
| ORD-22 | 07-08, 07-11, 07-19 | Received by | SATISFIED | `OrderPeopleTests`, audit viewer |
| ORD-23 | 07-08, 07-12, 07-19 | Paid by | SATISFIED | `OrderPeopleTests`, audit viewer |

Orphan check: REQUIREMENTS.md maps no further ORD ID to Phase 7. ORD-01, ORD-02 and ORD-06 appear in plans 07-15 and 07-16 as server-side work but are mapped to Phase 8; this is by design (CONTEXT: "server side of ORD-01, ORD-02, ORD-06, which stay mapped to Phase 8"). Informational: the traceability row for ORD-06 reads "Phase 8 | Complete" while ORD-01 and ORD-02 read "Pending"; the owner may want to correct that row's status.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase diff, src, tests, tools, web/src) | n/a | `TBD`, `FIXME`, `XXX` markers added | none found | No debt markers. |
| (phase diff, src) | n/a | `TODO`, `HACK`, `PLACEHOLDER` added | none found | Clean. |
| (phase diff, src) | n/a | inline SQL, `CREATE TRIGGER` | none found | OR-7 and the no-inline-SQL rule hold. |

### Code review findings

`07-REVIEW.md` has 31 findings. `07-REVIEW-DISPOSITION.md` gives each one an outcome: 25 fixed, 4 deferred, 2 accepted. All sampled commit hashes in the disposition and in `deferred-items.md` exist in git (checked 16, including the red and green pairs for DOM-CR-01, IWB-CR-01, DOM-WR-04 and APO-WR-01). Both critical findings are fixed. The four deferred items are Info level and have named owners (Phase 8 or the owner); none changes a Phase 7 truth.

### Human Verification Required

1. **DOM-WR-04 loosening of edit validation (logic change).** Test: read `LegacyEditFilter.cs` and the six edit handlers; try one edit of an imported legacy order. Expected: unchanged legacy values do not block the edit; changed fields are fully checked; D-05 lock and caps still apply. Why human: loosens validation on the money path.
2. **APO-WR-01 deadlock handling (concurrency logic).** Test: read commit `529510b1` and its two-connection deadlock test. Expected: 409 instead of 500; no retry in a dead transaction. Why human: transaction logic; one deadlock shape is tested.
3. **APX-IN-04 owner question.** Should list writes get their own busy code?
4. **APX-IN-01 owner question.** Should audit lines show the current payer, receiver, refunder and created total? (Phase 8 UI review.)
5. **Parked D-39 question.** Do refunds on a soft-deleted order count toward money on hand? (Before Phase 10 reports.)

### Carried to later phases (not gaps)

| Item | Where | Evidence |
|------|-------|----------|
| Golden vectors v3 with refunds, credit and cancelled-profit; web preview learns refunds | Phase 8 | `deferred-items.md` (plan 07-02); the web suite still deep-compares the v2 file. Until then only the server `OrderMathRefundTests` prove the refund figures. |
| Error path style (`items[3].quantity` vs `quantity`) for form mapping | Phase 8 | DOM-IN-01 |
| Relaxations of contact-number characters, email shape, due date before order date for import | Phase 7.1 | D-47 |
| Final legacy receiver and payer rule | Phase 15 | MIG-09, MIG-10 |

### Gaps Summary

No gaps. Every roadmap criterion is backed by code I read and tests I ran. The status is `human_needed` because of the five items above, not because of a failed or missing truth.

---

_Verified: 2026-10-29T04:05:00Z_
_Verifier: Claude (gsd-verifier)_
