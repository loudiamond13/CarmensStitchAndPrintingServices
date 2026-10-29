---
created: 2026-10-28T09:40:00-05:00
updated: 2026-10-28T20:10:00-05:00
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
