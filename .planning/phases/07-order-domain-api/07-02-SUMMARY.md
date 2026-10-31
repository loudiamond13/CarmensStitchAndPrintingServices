---
phase: 07-order-domain-api
plan: 02
subsystem: domain
tags: [order-math, refunds, customer-credit, cancelled-profit, money, tdd]
created: "2026-10-28T09:42:00-05:00"
updated: "2026-10-28T09:42:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: Plan 07-01 audit catalog and order lists (no code dependency; this plan is a pure function)
provides:
  - "OrderMath.Compute(items, discounts, payments, refunds, expenses, cancelled) with refunds, customer credit and the cancelled-order profit rule"
  - "OrderMathResult.Refunded and OrderMathResult.CustomerCredit (init-only, default 0)"
  - "Server-only tests for refunds, credit and cancelled profit (OrderMathRefundTests)"
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 4600
  tasks: 2
  commits: 4
plan_head_before: ec16b759533d1eb58962b02947c775698c316158
plan_head_after: 3adaa7ca4408890998fd318ea35095106fd4a70f

tech-stack:
  added: []
  patterns:
    - "New figures are init-only properties on the existing positional record, so older positional constructions and the golden test compile unchanged"
    - "The old 4-argument Compute delegates to the new overload with no refunds and cancelled false, so every v2 vector is the same code path"

key-files:
  created:
    - tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs
  modified:
    - src/Csps.Domain/Orders/OrderMath.cs
    - src/Csps.Domain/Orders/OrderMathModels.cs
    - .planning/phases/07-order-domain-api/deferred-items.md

key-decisions:
  - "Balance = Total - Paid + Refunded; CustomerCredit = Balance below zero ? -Balance : 0.00 (D-12, D-13)."
  - "Cancelled order: Profit = (Paid - Refunded) - Expenses, otherwise Total - Expenses (D-36, D-10)."
  - "The shared golden vector file stays at version 2, unchanged; the v3 bump (refunds, refunded, customerCredit) is recorded as a Phase 8 follow-up (research Pitfall 6)."

requirements-completed: [ORD-20, ORD-18]

coverage:
  - id: D1
    description: "ORD-2026-0148 through the new overload gives the v2 figures plus Refunded 0.00 and CustomerCredit 0.00; every v2 golden vector still passes"
    requirement: ORD-20
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs#OrderZeroOneFourEightWithNoRefundsKeepsTheV2FiguresAndAddsZeroRefundedAndCredit"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs#MatchesVector"
        status: pass
    human_judgment: false
  - id: D2
    description: "Refunds raise the balance; the refunds are summed then rounded half away from zero; a null refunds list throws; an empty list equals the 4-argument result"
    requirement: ORD-20
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Customer credit is max(-Balance, 0), reads 0.00 at a zero balance, and a 200.00 refund clears a 200.00 overpayment"
    requirement: ORD-18
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs#PayingMoreThanTheTotalLeavesTheCustomerCredit"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs#RefundingTheOverpaymentClearsTheBalanceAndTheCredit"
        status: pass
    human_judgment: false
  - id: D4
    description: "A cancelled ORD-2026-0148 with 12,000.00 paid and refunded reads Profit -6,065.00; with no refunds 5,935.00; a non-cancelled order ignores refunds for profit"
    requirement: ORD-18
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathRefundTests.cs#ACancelledOrderFullyRefundedShowsALossOfItsExpenses"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 02: Refunds, customer credit and cancelled-order profit in OrderMath Summary

**The authoritative order math now takes refunds, reports customer credit as its own figure, and gives a cancelled order the D-36 profit, while all 200+ shared v2 golden vectors still match byte for byte.**

## Performance

- **Duration:** about 5 min
- **Completed:** 2026-10-28T14:42:00Z
- **Tasks:** 2 of 2
- **Files changed:** 4 (about 4,600 tokens of hand-written diff, chars/4)

## Accomplishments

- Task 1 (tracer): added the 6-argument `Compute(items, discounts, payments, refunds, expenses, cancelled)` overload. The 4-argument method delegates with no refunds and `cancelled: false`. `OrderMathResult` gained init-only `Refunded` and `CustomerCredit`, so the existing positional constructions and the golden test compile unchanged. Proven on ORD-2026-0148 (Subtotal 22,450.00, Discount 1,122.50, Total 21,327.50, Paid 12,000.00, Balance 9,327.50, Expenses 6,065.00, Profit 15,262.50, Refunded 0.00, CustomerCredit 0.00).
- Task 2: `CustomerCredit = Balance < 0 ? -Balance : 0.00`, and `Profit = cancelled ? Paid - Refunded - Expenses : Total - Expenses`. XML docs updated (D-12, D-13, D-36, D-10). Ten refund tests cover cancelled with and without refunds, overpayment, refund clearing credit, an exactly paid order, an owed balance, refund rounding (0.005 + 0.005 = 0.01), null refunds, and four-versus-six-argument equality.
- Phase 8 follow-up recorded in `deferred-items.md`: bump the golden vectors to v3 when the web preview learns refunds.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 7968cee0 `test(07-02): order math takes refunds (RED)` | 9963cef7 `feat(07-02): order math takes refunds and reports customer credit (ORD-20)` |
| 2 | b712ad24 `test(07-02): refund, credit and cancelled profit edges (RED)` | 3adaa7ca `feat(07-02): refund, credit and cancelled profit (D-12, D-13, D-36)` |

- **Task 1 RED:** the test project failed to build: CS1501 (no `Compute` overload takes 6 arguments) and CS0117 (`Refunded`, `CustomerCredit` not defined). A compile-time RED, the usual shape in C# for new members.
- **Task 2 RED:** the Task 1 GREEN was kept minimal (refunds in the balance only), so the new cases ran and failed on assertions: 3 failed of 11 (`result.Profit` twice for the cancelled cases, `result.CustomerCredit` for the overpayment), 8 passed. Valid assertion failures on the planned behaviour. `gsd_run check tdd-red-evidence` was not run (the classifier reads TAP/JUnit/Surefire; this runner's output is none of those); the output was inspected by hand.
- REFACTOR: none needed.
- Tracer gate: the tracer `<verify>` was re-run after the GREEN commit and passed (257 tests) before expansion.

## Verification Evidence

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMath*"`: 267 total, 267 succeeded, 0 failed.
- `dotnet build tests/Csps.Domain.UnitTests -warnaserror`: 0 warnings, 0 errors.
- `Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1264/1264), branch 100% (488/488); Csps.Application line 98.3% (3834/3899). "Coverage gate passed." Domain unit tests in that run: 808 passed, 0 failed.
- `git diff --exit-code -- tests/fixtures/order-math-golden-vectors.json`: exit 0 (no diff).
- `grep -c CustomerCredit src/Csps.Domain/Orders/OrderMathModels.cs`: 1. `grep -c v3 deferred-items.md`: 1.
- gitleaks on each staged change: no leaks. No en or em dash in the changed code (Python scan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ambiguous XML doc references**
- **Found during:** Task 1 GREEN
- **Issue:** with two `Compute` overloads, `<see cref="OrderMath.Compute"/>` in `OrderMathModels.cs` failed the build (CS0419, three places).
- **Fix:** the three crefs now point at `OrderMath`.
- **Files modified:** `src/Csps.Domain/Orders/OrderMathModels.cs`
- **Commit:** 9963cef7

**2. [Plan note] `deferred-items.md` already existed**
- Plan 07-01 created it, so Task 2 appended a "From plan 07-02" section and changed only `updated`.

**Total deviations:** 1 auto-fixed (1 build bug), 1 note. **Impact:** none on scope.

## Issues Encountered

None.

## Deferred Issues

- Golden vectors v3 for Phase 8 (see `deferred-items.md`). The `ExpenseListTimingTests` item from 07-01 is unchanged.

## Known Stubs

None.

## Threat Flags

None. The function is pure and has no new surface. T-07-04 (wrong money) is mitigated by exact-figure tests, the unchanged v2 vectors and 100% branch coverage. T-07-05 (server and web previews drifting) is mitigated by the untouched vector file and the recorded v3 follow-up.

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-03. Later slices can store `Refunded`, `CustomerCredit` and the cancelled-order `Profit` straight from `OrderMath.Compute`.

## Self-Check: PASSED

`OrderMathRefundTests.cs` exists, the four task commits (7968cee0, 9963cef7, b712ad24, 3adaa7ca) are ancestors of HEAD, and the acceptance criteria above were re-run after the last commit.
