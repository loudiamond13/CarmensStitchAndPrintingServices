---
created: 2026-10-28T09:40:00-05:00
updated: 2026-10-28T09:45:00-05:00
---

# Phase 7 deferred items

## From plan 07-01

- **`ExpenseListTimingTests` fails on this machine (known, Phase 6, not caused by Phase 7).** The case "five years, last page, size 100" gave a p95 of 350.3 ms against the 300 ms limit when run alone (default window p95 131.4 ms, category filter 4.8 ms, staff-name search 147.3 ms). It also failed inside the full Server integration run. Plan 07-01 does not touch the company expense list or its queries. The same slow-machine pattern was recorded in the Phase 6 plan 06-10 summary and in D-76 (the owner kept the 300 ms limit; the CI runner decides). No change made to the test.

## From plan 07-02

- **Phase 8 follow-up: golden vectors v3.** `OrderMath.Compute` now takes refunds and a cancelled flag, and `OrderMathResult` has `Refunded` and `CustomerCredit`. The shared file `tests/fixtures/order-math-golden-vectors.json` stays at version 2, byte for byte, because the web suite deep-compares its `expected` objects. When the web preview learns refunds (Phase 8), bump the file to v3 with `refunds` in each case and `refunded` and `customerCredit` in each `expected`, regenerate it with `node web/scripts/gen-golden-vectors.mjs --write`, and change `OrderMathGoldenVectorTests` (`Version.ShouldBe(3)`, new fields in `Format`) in the same change. Until then the server tests in `OrderMathRefundTests` are the only proof of the refund, credit and cancelled-profit figures (research Pitfall 6).
