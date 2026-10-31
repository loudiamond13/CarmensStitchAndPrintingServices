---
phase: 07-order-domain-api
plan: 18
subsystem: api
tags: [orders, legacy-import, import-rules, order-numbers, counter, migration-path, zero-loss]
created: "2026-10-28T20:06:00-05:00"
updated: "2026-10-28T21:00:00-05:00"
status: complete

requires:
  - phase: 07-order-domain-api
    provides: "07-05/07-06 Order, OrderNumber, OrderNumberCounter.EnsureAtLeast and the allocator lock; 07-08 LegacyHolder.Id and the hidden user row; 07-09 to 07-14 the child types and OrderRules checks; 07-17 the CspsUnitOfWork translation chain and OrderListEntryDeletedException"
provides:
  - "Order.Import(snapshot, rules, now, today): builds an order from legacy-shaped data, checks the structural rules first, then the create path's own rules unless a named relaxation lifts one, and works every money figure out again with OrderMath"
  - "OrderImportRules (sealed record): fourteen named bool relaxations, Default (all on, for the migration) and Strict (all off, the create path's rules)"
  - "OrderImportSnapshot and ImportedStatusChange: the legacy order and its optional status history, reusing the create path's child records so every person id is explicit"
  - "OrderRules Check* overloads that take the rules; the public Check* methods call them with Strict, so the words and limits stay the same"
  - "ImportOrderHandler (no HTTP route): domain check, then reference checks for list entries and people in one 400, then the taken-number check, the number reservation and the save in one transaction; no audit entry"
  - "IOrderNumbers.ReserveLegacyAsync: takes the order-numbers lock and lifts the year's counter to at least NNNN for an ORD-YYYY-NNNN number; any other number leaves every counter alone"
  - "IOrders.NumberTakenAsync (deleted orders included), OrderNumberTakenException, OrderErrors.NumberTaken (422 orders.number-taken), and the IX_Orders_Number translation in CspsUnitOfWork"
  - "docs/api/orders.md: Importing legacy orders"
affects: [07-19, 07-20, 07.1, 15, 16]

actuals:
  tokens: 27400
  tasks: 3
  commits: 6
plan_head_before: 9d2ba6e6a21c24311f3151a2cf02af36c6de5480
plan_head_after: 8edcac4d5f6e3e78b291c367f843586eb55e6fa4

tech-stack:
  added: []
  patterns:
    - "One rules record of named relaxations passed down into the shared check functions; Strict reproduces the normal path exactly, so a strict import and a normal create cannot drift apart"
    - "Handler order for tooling: pure domain check, then lookups, then the lock; a refused order takes no number lock"
    - "Pattern-free branches (local variable, then .IsFailure) where an 'is { IsFailure: true }' pattern would add a branch that can never be false"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderImportRules.cs
    - src/Csps.Domain/Orders/OrderImportSnapshot.cs
    - src/Csps.Domain/Orders/OrderImportChecks.cs
    - src/Csps.Application/Orders/ImportOrderHandler.cs
    - src/Csps.Application/Ports/OrderNumberTakenException.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderImportTests.cs
    - tests/Csps.Application.UnitTests/Orders/ImportOrderHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberTakenTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Domain/Orders/OrderNumber.cs
    - src/Csps.Domain/Orders/OrderInputs.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Ports/IOrderNumbers.cs
    - src/Csps.Application/Ports/IOrders.cs
    - src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - docs/api/orders.md

key-decisions:
  - "Strict is exactly the create path (except that all seven statuses are allowed): the Check* overloads take OrderImportRules and the public methods pass Strict, so each relaxation is one named test in the existing rule, in the existing words."
  - "IgnoreAmountCaps also lifts the quantity range (1 to 10,000 becomes 0 or more), because D-30 lists that range with the other caps and the database only checks quantity >= 0. A negative quantity or price is never stored, so it keeps its own two messages once the limits are skipped."
  - "Order.Import takes an optional business today (like Create). The strict rules need it for the date checks and throw ArgumentException without it; the default rules do not need it."
  - "The number must be plain ASCII: the number column is varchar, so any other character would be changed on the way in (zero loss)."
  - "Imported refunds skip the refund eligibility and cap rules (D-34, D-09) that depend on the order's figures; legacy refunds are taken as they were. The refund check still applies the amount, date, reason and refunder field rules."
  - "Reference checks run after the domain check and before any lock; a refused order takes no number lock. The taken-number read and the lock reservation run inside the transaction, and the unique index is the backstop for a race."
  - "The contact number's characters, the email's shape and a due date before the order date have no relaxation and refuse an order under every rules instance. Phase 7.1 decides if any needs a name (owner question below)."

patterns-established:
  - "Pattern: tooling use cases return the same Result and 400 shape as the HTTP ones, with camelCase indexed paths, but have no controller"

requirements-completed: [ORD-21, ORD-14]

coverage:
  - id: S1
    description: "ORD-21, ORD-14: the legacy ORD-2026-0148 imports verbatim (number, 5 items, 5% discount, 2 payments and 3 expenses held by the Legacy holder, one history row), reads the seven exact figures (22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50 / 6,065.00 / 15,262.50) with receivedBy 'Legacy / unassigned', and the next new 2026 order is ORD-2026-0149"
    requirement: ORD-21
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#TheLegacyOrd0148ImportsVerbatimWithTheExactFiguresAndTheNextNewOrderIsOrd0149"
        status: pass
    human_judgment: false
  - id: S2
    description: "ORD-21: each of the fourteen relaxations is a named value; for every one the default rules accept the data and the strict rules refuse the same data on the same field, and the figures of every accepted order equal OrderMath over its children"
    requirement: ORD-21
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImportTests.cs#EveryRelaxationIsAcceptedByTheDefaultRulesAndRefusedByTheStrictRulesOnTheSameField"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImportTests.cs#EachRelaxationIsASingleNamedValueSoOneOffRulesOnlyLiftThatOneRule"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ImportOrderHandlerTests.cs (retired entries, Legacy holder, inactive people)"
        status: pass
    human_judgment: false
  - id: S3
    description: "Structural rules hold under every rules instance: empty, blank, 33-character and non-plain numbers, status 0 and 8, discount kind 0 and value 0, quantity -1, unit price -0.01 and 650.123, payment, refund and expense amount 0.00, over-length text, bad history statuses"
    requirement: ORD-21
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImportTests.cs#TheStructuralRulesRefuseUnderEveryRulesInstance"
        status: pass
    human_judgment: false
  - id: S4
    description: "D-14, zero money change: an already-overpaid legacy order keeps every payment and reads customerCredit equal to the excess (22,000.00 paid on 21,327.50 gives 672.50); a Completed legacy order with a balance stays Completed and answers 422 orders.locked on an item add until it is reopened"
    requirement: ORD-21
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#AnOverpaidLegacyOrderKeepsEveryPaymentAndReadsTheMatchingCustomerCredit"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#ACompletedLegacyOrderWithABalanceStaysCompletedAndLockedUntilItIsReopened"
        status: pass
    human_judgment: false
  - id: S5
    description: "D-32, D-37: every list entry and person is checked; unknown ids are refused on their own field (items[i].productTypeId, payments[i].receivedByUserId, refunds[i].refundedByUserId, expenses[i].paidByUserId, statusHistory[i].changedById), the Legacy holder and inactive staff only when the rules allow, and each list or person is asked once per distinct id"
    requirement: ORD-21
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ImportOrderHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: S6
    description: "ORD-14, T-07-54: a taken number (live or deleted, any letter case) is 422 orders.number-taken with one row kept; the unique index backstop becomes the same error; an ORD-YYYY-NNNN number lifts only its year's counter, LEG-0042 leaves every counter alone; a busy lock or deadlock victim is 409 orders.busy"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#ImportingTheSameNumberTwiceIsA422AndLeavesOneRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#ALegacyNumberThatIsNotOrdYearNumberChangesNoCounter"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberTakenTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ImportOrderHandlerTests.cs#ATakenNumberIsA422OrdersNumberTakenAndNothingIsLockedOrSaved"
        status: pass
    human_judgment: false
  - id: S7
    description: "T-07-53: no controller or route calls the import handler, and an import writes no audit entry"
    requirement: ORD-21
    verification:
      - kind: command
        ref: "grep -rl ImportOrderHandler src/Csps.Server/Controllers prints nothing; the authorization matrix test discovers no import route"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ImportOrderEndToEndTests.cs#AnImportWritesNoAuditEntry"
        status: pass
    human_judgment: false
  - id: S8
    description: "docs/api/orders.md explains the import path to the owner: who calls it, every relaxation with its default, the counter rule, no audit entry, and that MIG-09 (Phase 15) owns the final legacy receiver and payer rule"
    requirement: ORD-21
    verification:
      - kind: command
        ref: "grep -c MIG-09 docs/api/orders.md prints 1"
        status: pass
    human_judgment: true
    rationale: "Whether the wording reads clearly to the owner is a judgment no test asserts"
---

# Phase 7 Plan 18: Legacy Order Import Summary

**Order.Import with fourteen named relaxations, a tooling-only handler that checks every reference and protects legacy numbers, and a counter that never collides with them.**

## Performance

- **Duration:** about 35 min (the start time was not recorded; the first commit is 19:38, the last task commit 19:55, verification ended about 20:05)
- **Tasks:** 3 of 3
- **Files:** 22 changed in code, tests and docs (13 source and doc files modified, 9 created)
- **Commits:** 6 task commits

## Accomplishments

- A legacy order comes in as it was. ORD-2026-0148 imports with its own number and reads the seven exact UI-spec figures, because the figures are worked out again by OrderMath from the children and no figure is taken from the data.
- Every leniency is one named value in `OrderImportRules`. `Default` has them all on; `Strict` is the create path. A test per relaxation shows the strict rules refuse what the default rules accept, on the same field.
- The structural rules never bend: a plain number up to 32 characters, a known status and discount kind, no negative quantity or price, two-decimal money, amounts above zero, and text that fits its column (refused, never cut short).
- The handler checks every product type, payment method, expense category and person (the Legacy holder and inactive staff only when the rules allow), refuses a taken number with the 422 `orders.number-taken`, and takes the order number lock only after all of that passed.
- Importing `ORD-YYYY-NNNN` lifts that year's counter to at least NNNN under the lock, so the next new order never collides. A number in any other form leaves every counter alone.
- No HTTP route exists for the import, and it writes no audit entry.

## Task Commits

1. **Task 1 (tracer): the legacy ORD-2026-0148 imports verbatim**
   - RED `8811c707` test(07-18): import a legacy order verbatim
   - GREEN `06c29304` feat(07-18): import legacy orders with preserved numbers (ORD-21, ORD-14)
2. **Task 2: named relaxations and structural rules**
   - RED `be88a851` test(07-18): import relaxations and structural rules
   - GREEN `b830a334` feat(07-18): named import relaxations (ORD-21, D-14, D-22)
3. **Task 3: reference checks and taken numbers**
   - RED `1ded8e37` test(07-18): import reference checks and taken numbers
   - GREEN `8edcac4d` feat(07-18): checked legacy import with number protection (D-32, ORD-14)

**Tracer gate:** after Task 1 the tracer verify was re-run end to end before the expansion tasks (`ImportOrderEndToEndTests`, 1 of 1 passed); expansion continued.

**TDD RED evidence.** The xunit v3 Microsoft Testing Platform report is not one of the formats `gsd check tdd-red-evidence` reads, so the machine classifier could not be used. The semantic assessment, by hand, for each RED:

- Task 1: the target test ran and failed on `imported.IsSuccess` ("The import is not built yet"). The new API shapes were placeholders that refuse, so the test compiled and failed on the planned assertion.
- Task 2: 7 of 16 tests failed on the planned assertions (a strict rules instance accepted data it must refuse, an untrimmed name, a blank number reaching `AssignNumber`); none failed on setup.
- Task 3: 11 of 14 handler tests, 2 of 4 infrastructure tests and 1 of 6 end-to-end tests failed. Eight handler tests failed on the planned assertions (reference checks and the taken-number answer missing). The other six failed because a typed error was not mapped yet, which is the missing behaviour: a busy lock, a deadlock victim and a number taken at save in the handler, and the raw duplicate-key `DbUpdateException` in two infrastructure tests and one end-to-end test.

## Verification Evidence

- `dotnet build -warnaserror`: 0 warnings, 0 errors.
- Coverage gate: Csps.Domain line 100% (2497/2497) and branch 100% (1062/1062); Csps.Application line 98.1% (6525/6648), branch 95.1%, passed.
- Domain unit tests 1159 of 1159; Application unit tests 1839 of 1839; Architecture tests 241 of 241 (including `NoInlineSqlTests`, 24 of 24); Infrastructure integration tests 742 passed and 1 skipped (the live HIBP test, as before); Server integration tests 1781 of 1781 (the authorization matrix finds no import route; the order list timing test passed this run).
- `npm --prefix tools/openapi-gen run check`: types match the snapshot (no route changed).
- Acceptance greps: `EnsureAtLeast` in the allocator 1; `ImportOrderHandler` in Controllers prints nothing; relaxation names in `OrderImportRules` 8 (at least 4); `Strict` in `OrderImportTests` 29; `orders.number-taken` in `OrderErrors` 1; `MIG-09` in `docs/api/orders.md` 1.
- gitleaks ran on every commit through the pre-commit hook: no leaks. Test data is fictional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The number must be plain ASCII**
- **Found during:** Task 2
- **Issue:** the number column is varchar, so a character outside plain text would be changed on the way in, which breaks zero loss.
- **Fix:** an import number with such a character is refused on `number` ("Use plain letters, digits and punctuation in the order number."). Tested.
- **Files modified:** `src/Csps.Domain/Orders/OrderImportChecks.cs`
- **Commit:** b830a334

**2. [Rule 3 - Blocking] A shared constant for the number length**
- **Found during:** Task 2
- **Issue:** the 32-character limit existed only as a literal in the EF configuration.
- **Fix:** `OrderNumber.MaxLength = 32`, used by the import check and by `OrderConfiguration`. Same value, so no model change (the model snapshot tests pass).
- **Files modified:** `OrderNumber.cs`, `OrderConfiguration.cs`
- **Commit:** b830a334

**3. [Rule 3 - Blocking] Ambiguous XML doc reference**
- **Found during:** Task 2
- **Issue:** adding overloads of `OrderRules.CheckDetails` made one `cref` in `OrderInputs.cs` ambiguous, which the build rejects.
- **Fix:** the `cref` names the one-argument overload.
- **Files modified:** `src/Csps.Domain/Orders/OrderInputs.cs`
- **Commit:** b830a334

### Plan-shape choices (no behaviour outside the plan)

- **A new file, `OrderImportChecks.cs`,** holds the import checks so `Order.cs` stays small. The plan listed `Order.cs`, `OrderImportRules.cs` and `OrderImportSnapshot.cs` only.
- **`Order.Import` has a fourth, optional parameter `today`,** like `Order.Create`. The plan wrote three parameters; the strict date checks need the business today.
- **The snapshot reuses the create path's child records** (`NewOrderItem`, `NewOrderPayment` and so on) instead of new ones, plus `ImportedStatusChange` for the history.
- **An extra infrastructure test file,** `OrderNumberTakenTests.cs`, proves the unique-index translation, the letter-case agreement between the read and the index, and that the read sees deleted orders. The plan named only the handler and end-to-end test files for Task 3.
- **The relaxations are passed down into the existing `OrderRules` checks** (internal overloads) instead of copying them, so the words are the create path's own.

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking) plus the shape choices above. **Impact:** none on the plan's goal; no schema change, no package, no migration.

## Owner Questions and New Wording for Review

**Owner ruling D-47 (2026-10-28):** imported refunds and the zero quantity stay as built, and the import messages are approved. The three field rules without a relaxation wait for the Phase 7.1 findings.

**Open for Phase 7.1 (not decided here).** Three field rules have no relaxation and refuse an order under every rules instance: the characters of a contact number (digits, spaces and + - ( ) only), the shape of an email address, and a due date before the order date. If the read-only fit check finds legacy rows that break one of them, the owner decides whether it gets a named relaxation or the data is cleaned in Phase 15. The Default rules will otherwise refuse those rows.

**New messages (tooling only; please review the wording).**

- "Enter the order number." / "Keep the order number to 32 characters or fewer." / "Use plain letters, digits and punctuation in the order number." / "Use the form ORD-2026-0001 for the order number." (field `number`)
- "The quantity can't be negative." / "The unit price can't be negative." (shown only once `IgnoreAmountCaps` skips the limits)
- "This order number is already used." (422 `orders.number-taken`, the text the plan gave)
- "Choose who changed the status." (an unknown status history person)

An unknown receiver, refunder or payer reuses the create path's "Choose who received the money." / "Choose who handed the money back." / the payer text, and a person who can't be chosen reuses "This person can't be chosen because their account isn't active. Choose someone else."

## Known Stubs

None. The RED placeholders were replaced in the GREEN commits (`grep` for TODO, FIXME and the placeholder text in the new files finds nothing).

## Threat Flags

None. No new network surface: the handler has no route, and the only new storage rule is the unique number index translation (T-07-54).

## Issues Encountered

None. Known pre-existing flake `ExpenseListTimingTests` did not fail in this run.

## Next Phase Readiness

Ready for 07-19 (audit viewer, parallel plan) and 07-20. Phase 7.1 can call `Order.Import` with `OrderImportRules.Default` against rows read from the restore, and Phase 16 can call `ImportOrderHandler`. Nothing in this plan touched `CSPS_Legacy_Restore` or `_local/`.

## Self-Check: PASSED

All nine created files and the edited doc exist on disk, all six task commits are ancestors of HEAD, the `commits` count (6) was measured with `git rev-list --count` from the plan ledger, and every task's acceptance criteria were re-run and passed.
