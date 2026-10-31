---
phase: 08-order-screens
plan: 25
subsystem: orders
tags: [orders, discounts, order-math, openapi, gap-closure, G-08-5, D-94, WR-01]
created: "2026-10-30T19:05:00-05:00"
updated: "2026-10-30T19:05:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-12 and 08-17: the Discounts tab and its windows; OrderMath and OrderReader from the earlier order plans"
provides:
  - "OrderMath.DiscountAmount: the public, null-checked per-discount rule that Compute also uses"
  - "OrderDiscountResponse.Amount, filled by OrderReader over the stored subtotal, in every order answer (create, read, each write, the deleted read)"
  - "A refreshed OpenAPI snapshot and regenerated web types with the discount amount"
  - "A Discounts tab Amount column that shows the server's figure and works out no money"
affects: [08-29-e2e, phase-8-verification]

actuals:
  tokens: 7500
  tasks: 3
  commits: 5
plan_head_before: 5f8ae2f7e93762982b5fb2cfc5cf08ce9e74d430
plan_head_after: 8bb31193fce4b02c930245064d9d68b92a769489

tech-stack:
  added: []
  patterns:
    - "A per-row money figure comes from the same OrderMath rule that writes the stored total, so the rows add up to the total"
    - "The orderDiscount fixture takes the written-out server amount; no fixture works out money"

key-files:
  created: []
  modified:
    - src/Csps.Domain/Orders/OrderMath.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs
    - tests/Csps.Application.UnitTests/Orders/LegacyEditHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/test/orderFixtures.ts
    - web/src/modules/admin/components/OrderDiscountsTab.tsx
    - web/src/modules/admin/components/OrderDiscountsTab.test.tsx
    - web/src/modules/admin/components/OrderDiscountModal.test.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx
    - web/src/modules/admin/orderDiscountSchemas.test.ts
    - docs/api/orders.md

key-decisions:
  - "D-94 applied as ruled: the server sends each discount's peso Amount and the Discounts tab renders it; no database change"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "Every order answer (create, read, each write, the Manager's deleted read) carries each discount's server-worked amount, and the amounts add up to totals.discount"
    requirement: "ORD-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AFivePercentDiscountAnswerAndReadCarryTheServerAmount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AFixedDiscountAfterItCarriesItsOwnAmountAndTheAmountsAddUpToTheDiscountTotal"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AnItemChangeMovesAPercentageDiscountAmountToTheNewSubtotal"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AManagersDeletedOrderReadCarriesTheSameDiscountAmounts"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs#ADiscountAmountRoundsSevenAndAHalfPercentOfSeventeenPesosHalfAwayFromZeroTo1Point28"
        status: pass
    human_judgment: false
  - id: D2
    description: "The OpenAPI snapshot and the generated web types carry amount on the discount"
    requirement: "ORD-07"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class *OpenApiSnapshotTests"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Discounts tab shows the server's amount in every row, in the read-only view and on a locked order, and works out no money"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountsTab.test.tsx#the Amount column (D-94)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-10-30
---

# Phase 8 Plan 25: The server sends each discount's amount (D-94, WR-01) Summary

**Each discount in an order answer now carries the pesos it comes to, worked out by OrderMath over the stored subtotal, and the Discounts tab renders that figure with no browser money math.**

## Performance

- **Duration:** 26 min
- **Tasks:** 3 (1 tracer, 1 contract refresh, 1 web), TDD red then green for tasks 1 and 3
- **Files changed:** 15
- **Commits:** 5 (measured from `plan_head_before`)

## Accomplishments

- `OrderMath.DiscountAmount` is public with an XML doc and a null check; its arithmetic is unchanged and `Compute` still calls it. Direct tests cover 7.5% of 17.00 = 1.28, a fixed value, 5% of 22,450.00 = 1,122.50, an undefined kind and a null discount. Domain coverage stays at 100% line and branch.
- `OrderDiscountResponse.Amount` sits right after `Value`; `OrderReader` fills it from `OrderMath.DiscountAmount` over the stored `order.Subtotal`. No query, column or projection change, so the detail read stays at 8 SQL commands (OrderReaderDetailSnapshotTests passes).
- Four endpoint tests prove the amount in the add answer and the read (1122.50), a second fixed discount (500.00, the two add up to `totals.discount` 1622.50), an item quantity change (subtotal 25,700.00 gives 1,285.00), and a Manager's deleted read.
- OpenAPI snapshot refreshed through the snapshot test (only `amount` and its `required` entry changed) and web types regenerated with the pinned generator; `check` passes.
- The `orderDiscount` fixture takes the written-out amount as a required argument after `reason`; every caller writes the figure the server would store.
- `OrderDiscountsTab` renders `formatPeso(negateMoney(discount.amount))`; the `discountAmount` import and the `subtotal` argument of `dataColumns` are gone, and the head comment now says the row amount is the server's figure.
- `docs/api/orders.md` lists `amount` in the answer shape and has a bullet under "How a discount is worked out"; only `updated:` changed.

## Task Commits

1. Task 1 RED: `6bb44d73` test(08-25): add failing tests for the server discount amount
2. Task 1 GREEN: `3a50e503` feat(08-25): the order answer carries each discount's server amount
3. Task 2: `f15a2c2e` chore(08-25): carry the discount amount in the API snapshot, web types and fixtures
4. Task 3 RED: `23b9aac7` test(08-25): add failing tests for the Discounts tab server amount
5. Task 3 GREEN: `8bb31193` feat(08-25): the Discounts tab shows the server's discount amount

## TDD Gate Compliance

- **RED (task 1):** four endpoint tests ran and failed with `KeyNotFoundException` from `JsonElement.GetProperty("amount")` (18 run, 4 failed, 14 passed). Semantic assessment: the target tests executed and failed on the missing `amount` member, the planned reason; no build or fixture fault.
- **GREEN (task 1):** `OrderDiscountsEndpointTests` 18/18, `OrderMathTests` 31/31, `LegacyEditHandlerTests` 8/8, `OrderReaderDetailSnapshotTests` 3/3.
- **RED (task 3):** three row tests failed with `Unable to find an element with the text: −₱1,000.00` (the tab worked out −₱1,122.50 itself). The fourth test, the footer guard, passed on purpose as it protects behavior that must not change. Semantic assessment: valid, the failure is the planned assertion.
- **GREEN (task 3):** `OrderDiscountsTab.test.tsx`, `DeletedOrderPage.test.tsx`, `OrderPage.test.tsx` and `orders-boundaries.node.test.ts`: 4 files, 127 tests passed.
- No REFACTOR commit was needed. The RED evidence was judged by reading the runner output; `gsd_run check tdd-red-evidence` was not run because the runners here (xunit MTP and a Vitest summary) were not captured as TAP, JUnit or the other supported report formats.

## Verification Evidence

- `dotnet build Csps.slnx`: Build succeeded, 0 Warning(s), 0 Error(s).
- `Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2622/2622), branch 100% (1126/1126); Csps.Application line 99.1%; "Coverage gate passed."
- `OpenApiSnapshotTests`: wrote the snapshot with the switch set for that one command, then passed 10/10 without it. `npm --prefix tools/openapi-gen run check`: "Generated API types match".
- `dotnet test` on the Orders namespace of Csps.Server.IntegrationTests: 278 passed, 0 failed.
- Web: `typecheck` clean, `lint` (`--max-warnings 0`) clean, `format:check` clean, full `vitest --run`: 268 files, 7502 tests passed.
- Acceptance greps: `DiscountAmount` public x1, `OrderMath.DiscountAmount` in OrderReader x1, `decimal Amount` in the response x1, no migration since planning, `discountAmount` in non-comment tab lines 0, `discount.amount` in the tab 1, snapshot `"amount"` 1, generated `amount: number | string` 1, fixture `amount` 2.
- gitleaks on each staged change: no leaks found. No e2e was run (08-29 runs `@orders-discounts`).

## Deviations from Plan

None - plan executed exactly as written. Two small notes:

- The plan listed the four endpoint tests; the first two behaviors became two tests (the 5% add and read, then the fixed second discount with the sum check), so four tests in total as planned.
- `prettier --write` reformatted one line of the new tab test before the Task 3 GREEN commit, so that file's final form is in the GREEN commit, not the RED one. No other file was touched outside `files_modified`.

## Notes for Later

- `otherDiscountsTotal` in `web/src/modules/admin/orderDiscountSchemas.ts` and the discount window preview still work out amounts in the browser for the live cap and preview. That is outside this plan (D-94 scopes the Amount column of the tab) and was left as built.

## Known Stubs

None.

## Threat Flags

None. The field is derived from data staff already see; no new route (T-08-47 accepted). T-08-48 is mitigated: the reader and the stored total use the same `OrderMath` rule, and a server test proves the amounts add up to `totals.discount`. T-08-SC: no package added or bumped.

## Self-Check: PASSED

- Files exist: OrderMath.cs, OrderDetailResponse.cs, OrderReader.cs, OrderDiscountsTab.tsx, OrderDiscountsTab.test.tsx, docs/api/orders.md, openapi.v1.json, api.generated.ts (all modified, all present).
- Commits on this branch: 6bb44d73, 3a50e503, f15a2c2e, 23b9aac7, 8bb31193.
