---
created: 2026-10-28T09:40:00-05:00
updated: 2026-10-28T22:10:00-05:00
---

# Phase 7 deferred items

## From plan 07-01

- **`ExpenseListTimingTests` fails on this machine (known, Phase 6, not caused by Phase 7).** The case "five years, last page, size 100" gave a p95 of 350.3 ms against the 300 ms limit when run alone (default window p95 131.4 ms, category filter 4.8 ms, staff-name search 147.3 ms). It also failed inside the full Server integration run. Plan 07-01 does not touch the company expense list or its queries. The same slow-machine pattern was recorded in the Phase 6 plan 06-10 summary and in D-76 (the owner kept the 300 ms limit; the CI runner decides). No change made to the test.

## From plan 07-02

- **Phase 8 follow-up: golden vectors v3.** `OrderMath.Compute` now takes refunds and a cancelled flag, and `OrderMathResult` has `Refunded` and `CustomerCredit`. The shared file `tests/fixtures/order-math-golden-vectors.json` stays at version 2, byte for byte, because the web suite deep-compares its `expected` objects. When the web preview learns refunds (Phase 8), bump the file to v3 with `refunds` in each case and `refunded` and `customerCredit` in each `expected`, regenerate it with `node web/scripts/gen-golden-vectors.mjs --write`, and change `OrderMathGoldenVectorTests` (`Version.ShouldBe(3)`, new fields in `Format`) in the same change. Until then the server tests in `OrderMathRefundTests` are the only proof of the refund, credit and cancelled-profit figures (research Pitfall 6).

## Orchestrator note: edits on Completed or Cancelled orders

Plans 07-07 and 07-09 listed this as open. It is not open. D-05 locks a Completed or Cancelled order against details, item, payment, discount and expense writes (refunds on a Cancelled order excepted). Plan 07-13 adds that lock (422 `orders.locked`) to every write. No owner decision is needed.

## Orchestrator action: drop two unused indexes (D-45)

The owner approved dropping `IX_Orders_CreatedAtUtc` and `IX_OrderItems_ProductTypeId` (owner, 2026-10-28). Do it after plan 07-17, in one indexes-only migration with a test, before the phase closes.

## Orchestrator action: two small fixes (D-46)

- Renaming the order expense Others answers 400 on `name` with "The Others name can't change." (the Phase 6 answer), not 422 `order-expense-categories.protected`.
- A deadlock victim in `CreateOrderHandler` maps to the existing "orders are being saved" 409 (`orders.busy`), not a 500.

Done together with the D-45 index drop, after plan 07-17.

## Done: D-45 and D-46 (2026-10-28)

- **D-45 index drop.** RED `2b847b7e`, GREEN `7c4e4b4d`. Migration `DropUnusedOrderIndexes` drops only `IX_Orders_CreatedAtUtc` and `IX_OrderItems_ProductTypeId` (Down recreates just those two). The Fluent config no longer names them, and the model snapshot lost exactly those two lines. `OrderListIndexesMigrationTests` now proves the Orders set is the old four plus the five list indexes, and the OrderItems set is `CreatedById`, `OrderId`, `ProductTypeId_OrderId`, `UpdatedById`. The order list timing test after the drop: default list p95 10.3 ms, customer-name search 69.7 ms, product type filter 19.4 ms, has balance 7.6 ms, far page at size 100 25.2 ms, newest sort 5.2 ms, balance sort 5.0 ms, total sort 5.0 ms (limit 300 ms). `OrderListQueryCountTests`: 9 of 9 pass, still 2 SQL commands whatever the page size.
- **D-46a Others rename.** RED `bd935e9b`, GREEN `25231c0d`. Renaming the order expense Others now answers 400 on `name` with "The Others name can't change." (code `order-expense-categories.invalid-request`). Recolor is still 200; retire and delete are still 422 `order-expense-categories.protected`. `docs/api/order-lists.md` is updated.
- **D-46b deadlock on create.** RED `2265d18b`, GREEN `ca59de32`. The unit of work already turned SQL error 1205 into a conflict; `CreateOrderHandler` now maps that conflict to the `orders.busy` 409 instead of a 500, with a unit test using a faked failed save. `docs/api/orders.md` lists the cause.
- **Evidence.** `dotnet build -warnaserror`: 0 warnings, 0 errors. Domain 1142 of 1142, Application 1825 of 1825, Architecture 241 of 241, Infrastructure integration 738 passed and 1 skipped (the live HIBP test, as before), Server integration 1775 of 1775 (including the expense timing test, which passed this run). Coverage gate passed: Domain line 100% and branch 100%, Application line 98.1%. `npm --prefix tools/openapi-gen run check`: types match the snapshot; the OpenAPI document did not change, so no refresh was needed.

## Orchestrator action: audit viewer follow-ups (D-48)

- Extend the audit Done to filter so a person also matches order entries where they are the receiver, payer or refunder (the six order families), with the same rule the company-expense payer filter uses.
- Change `AUDIT_COPY.subline` to "Every sign-in, security, staff account, order and expense change, newest first. Times are Manila time. Entries are kept for 8 months."

Done after plan 07-20, before the phase closes.

## Done: D-48 audit viewer follow-ups (2026-10-28)

- **Done to filter.** RED `2720ceae`, GREEN `2fa7167b`. A person now also matches order payment, refund and order expense entries (codes starting `order-payment.`, `order-refund.`, `order-expense.`, so the `*-changed` entries count, old or new person) and `order.permanently-deleted` entries whose `receivers=`, `payers=` or `refunders=` list holds their id. It is the same LIKE on the stored detail with the shared escaping (`LikePattern`), in LINQ only. A person cut off by the D-44 `+N` marker cannot be found because the id was never stored (the test seeds a `+2` list). `docs/operations/audit-log.md` is updated. The audit list has no command-count or timing test, so there was no guarantee to keep.
- **Subline.** RED `161cf5ca`, GREEN `e7eb80e4`. `AUDIT_COPY.subline` now reads "Every sign-in, security, staff account, order and expense change, newest first. Times are Manila time. Entries are kept for 8 months." The page test and the Playwright audit spec that pin it are updated.
- **Formatting.** `3ca3cbbf` ran prettier on two audit test files from plan 07-19 (`auditCopy.test.ts`, `AuditDetail.test.tsx`) that failed `format:check`. No behavior change.
- **Evidence.** `dotnet build -warnaserror`: 0 warnings, 0 errors. Application 1875 of 1875, Architecture 241 of 241, Infrastructure integration 752 passed and 1 skipped (the live HIBP test, as before), Server integration 1804 of 1804 (the expense timing test passed this run). Coverage gate passed: Domain line 100% and branch 100%, Application line 98.4%. `npm --prefix tools/openapi-gen run check`: types match the snapshot; the API surface did not change, so no refresh. Web: lint 0 warnings, typecheck clean, prettier check clean, `vitest run --coverage` 202 files and 6033 tests passed, thresholds met (all files 95.55% lines; `auditCopy.ts` 100%, `AuditLogPage.tsx` 95.68%), axe zero violations in the audit page tests.
