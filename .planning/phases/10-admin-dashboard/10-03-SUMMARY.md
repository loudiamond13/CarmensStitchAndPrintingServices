---
phase: 10-admin-dashboard
plan: 03
subsystem: domain
tags: [money, transfers, tdd, audit, csharp]
created: "2026-11-06T21:06:00-06:00"
updated: "2026-11-06T21:06:00-06:00"

requires:
  - phase: 06-company-expenses
    provides: CompanyExpense shape, ExpenseRules style, IAttributedRecord
  - phase: 07-orders
    provides: Pesos.Format, the Result and Error types
provides:
  - MoneyOnHand.Of, the money-on-hand sum rule (MONEY-01)
  - MoneyTransfer aggregate with Record, RecordHandover, SoftDelete and EnsureRemovable
  - MoneyRules with every field name, limit, code and UI-SPEC message
  - MoneyParty and MoneyPartyStatus, the people and balances the handlers pass in
  - Three audit codes in AuditActions
affects: [10-08, 10-10, 10-12, 10-18, web transfer form schema, web audit viewer copy]

actuals:
  tokens: 9200
  tasks: 3
  commits: 6
plan_head_before: b8d2494f23b4de7a6734ecea1ae8c6ef88438d1c
plan_head_after: 112cb50e56e8d839541e16e1dc494abe39baa66c

tech-stack:
  added: []
  patterns:
    - "Aggregate factories return Result<T> with one-field validation errors through MoneyRules.Reject"
    - "Domain rules take people and balances as a readonly record struct so the handler reads them under the lock and the rules stay pure"

key-files:
  created:
    - src/Csps.Domain/Money/MoneyOnHand.cs
    - src/Csps.Domain/Money/MoneyRules.cs
    - src/Csps.Domain/Money/MoneyParty.cs
    - src/Csps.Domain/Money/MoneyPartyStatus.cs
    - src/Csps.Domain/Money/MoneyTransfer.cs
    - tests/Csps.Domain.UnitTests/Money/MoneyOnHandTests.cs
    - tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs

key-decisions:
  - "MoneyParty is a readonly record struct so no null guard is needed and Domain branch coverage stays at 100%"
  - "An empty recipient id means nobody was chosen; the handler passes a NotStaff party for an unknown id"
  - "The three money audit constants sit beside the company-expense constants, but are appended at the END of AuditActions.All so the existing positional catalog tests keep their offsets"
  - "Check order in Record: recipient required, not self, amount, date, note, recipient status, sender balance, then the leaver cap"

requirements-completed: [MONEY-01, MONEY-04, MONEY-05, MONEY-07]

coverage:
  - id: D1
    description: "Money on hand is received + transfers in - transfers out - expenses - refunds, exact decimals, may be below zero"
    requirement: MONEY-01
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Money/MoneyOnHandTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A coworker transfer is recorded, and every broken rule is refused with the UI-SPEC message under the right field (including the D-49 Manager and Admin wording)"
    requirement: MONEY-04
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hand-over from former staff only, with the leaver's balance rules and the transfer's soft delete and remove check"
    requirement: MONEY-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "No edit path exists on a recorded transfer (private setters, reflection test over public members)"
    requirement: MONEY-07
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs#ARecordedTransferHasNoEditPathBeyondSoftDelete"
        status: pass
    human_judgment: false
  - id: D5
    description: "The three money audit codes are in the catalog (100 codes)"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-06
status: complete
---

# Phase 10 Plan 03: The transfer rules decide every send, hand-over and refusal in the Domain Summary

**Pure Domain rules for staff money: the money-on-hand sum, a MoneyTransfer aggregate with normal and hand-over factories that refuse every broken rule in the owner's exact words, soft delete with a remove check, no edit path, and three audit codes.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-06T20:45:00-06:00
- **Completed:** 2026-11-06T21:06:00-06:00
- **Tasks:** 3 (one tracer, two auto), all TDD
- **Files:** 7 created, 2 modified

## Accomplishments

- `MoneyOnHand.Of` is the single sum rule and can go below zero.
- `MoneyTransfer.Record` checks the recipient, amount, date and note, then the recipient's status, the sender's balance and the D-49 leaver cap. The Admin refusal names the person and gives no figure.
- `MoneyTransfer.RecordHandover` takes former staff only, refuses a recipient who is the leaver or not Active, and checks the leaver's balance by name.
- `SoftDelete` works once. `EnsureRemovable` returns `money-transfers.not-deleted` ("Delete the transfer first.") until the transfer is deleted.
- No public setter and no public instance method except `SoftDelete` and `EnsureRemovable`; a reflection test pins this (MONEY-07, D-22).
- `AuditActions` has `money-transfer.deleted`, `money-transfer.permanently-deleted` and `money-transfer.handed-over`, and the catalog count is 100.

## TDD Gate Compliance

Each task has a RED commit before its GREEN commit. RED runs were taken from the real `dotnet test` output (Microsoft Testing Platform, which has no TAP/JUnit report adapter, so the `gsd_run check tdd-red-evidence` classifier was not run; semantic assessment below is manual).

| Task | RED | Failing on | GREEN |
|------|-----|------------|-------|
| 1 | `1f024876` 7 of 7 failed | `MoneyOnHand.Of` returned 0 where the sum was expected; `Record` stub returned a failure where a success was expected | `53d781ff` 7 of 7 passed |
| 2 | `8c38a1e5` 19 of 30 failed (11 success-path tests passed) | Each refusal test expected a specific field and message and got a success | `9d73b13d` 34 of 34 passed (MoneyTransferTests + MoneyOnHandTests) |
| 3 | `5ed0e925` 19 of 131 failed | Hand-over, soft delete, remove check, three audit codes, catalog count 100 and the tail order; the reflection test already passed because the stubs had the same public shape | `112cb50e` full Domain suite 1291 of 1291 passed |

Semantic assessment: every RED test named above failed on its planned assertion (wrong value or message), not on a compile, load or fixture fault. To let the RED tests compile, the RED commits carry skeleton members (a `MoneyOnHand.Of` returning 0, a `Record` and later `RecordHandover`, `SoftDelete` and `EnsureRemovable` that return the wrong answer). The tests never failed on a missing type.

No REFACTOR commit was needed.

## Task Commits

1. **Task 1 (tracer): coworker transfer and money on hand** - RED `1f024876` (test), GREEN `53d781ff` (feat)
2. **Task 2: every normal-transfer refusal** - RED `8c38a1e5` (test), GREEN `9d73b13d` (feat)
3. **Task 3: hand-over, soft delete, remove check, audit codes** - RED `5ed0e925` (test), GREEN `112cb50e` (feat)

Tracer gate: the Task 1 `<verify>` was run end to end on the GREEN commit (7 of 7 passed) and again as part of the Task 2 run before expanding.

## Verification (quoted from the runs)

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*MoneyTransferTests" --filter-class "*MoneyOnHandTests"`: total 34, failed 0, succeeded 34 (before Task 3).
- `dotnet test --project tests/Csps.Domain.UnitTests` (whole Domain suite, after Task 3): total 1291, failed 0, succeeded 1291.
- `dotnet format Csps.slnx --verify-no-changes`: exit code 0, no output.
- Domain coverage (coverlet.MTP, then ReportGenerator with thresholds line 100 and branch 100, same arguments as `tools/scripts/Invoke-CoverageGate.ps1`): ReportGenerator exited clean. Line coverage 100% (2835 of 2835), branch coverage 100% (1214 of 1214), method coverage 100% (314 of 314). The report was written to the session scratchpad, not the repo, because PowerShell is refused from the worktree.
- Acceptance greps all pass: `public static decimal Of` 1, `NoteMaxLength = 200` present, `: IAttributedRecord` 1, `You only have` 1, `Ask a Manager for the amount.` 1, `can't receive transfers now. Choose someone else.` 1, the three audit strings 1 each, `public static Result<MoneyTransfer> RecordHandover` 1, edit-method grep 0, and MoneyTransferTests has tests whose names contain OwedOnly, Admin, Future, Decimals and Self.
- `gitleaks protect --staged --no-banner` ran before each of the six commits: no leaks found. Test people are made-up names (Carmen Reyes, Liza Mercado, Jomar Santos, Rosa Dela Cruz).

## Decisions Made

- `MoneyParty` is a `readonly record struct`, so there is no null case to guard and branch coverage stays complete.
- A recipient with an empty id reads as "nobody chosen" (`toUserId`: "Choose who got the cash."). The handler passes a `NotStaff` party for an id it cannot find.
- The sender's balance is checked before the D-49 leaver cap, so a sender who cannot afford the amount reads their own message first.
- The three audit constants sit beside the company-expense constants (as the plan says) but are appended at the end of `AuditActions.All`. Inserting them in the middle would have moved the offsets that `ThePhaseSixCodesComeAfterThePhaseFiveCodes` and `ThePhaseSevenCodesComeAfterThePhaseSixCodesInThisOrder` pin. The second test's expected tail was extended with the three codes.

## Deviations from Plan

None to the rules or wording. One small note:

**1. [Rule 3 - Blocking] Existing positional catalog test needed its tail extended**
- **Found during:** Task 3
- **Issue:** `ThePhaseSevenCodesComeAfterThePhaseSixCodesInThisOrder` asserts the exact tail of `AuditActions.All`; adding codes at the end changes that tail.
- **Fix:** Appended the three new codes to the expected tail in the same RED commit.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`
- **Committed in:** `5ed0e925`

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** none; this is the "update the count assertion" step the plan already called for, applied to a second assertion that depends on the same list.

## Issues Encountered

- The first RED stubs for `SoftDelete` and `EnsureRemovable` tripped the CA1822 analyzer (member could be static), which is an error in this repo. The stubs were changed to read instance state so the RED build compiled. The final code is unaffected.
- The first RED commit ran before the plan-head ledger file was written, so the ledger was written afterwards from the known base `b8d2494f` (the commit's parent). `commits: 6` is measured from that base.

## Known Stubs

None. The RED skeletons were replaced in the GREEN commits.

## Threat Flags

None. No endpoint, auth path, file access or schema change was added. T-10-03 (tampering) is mitigated by private setters, factory-only creation and the reflection test. T-10-04 (disclosure) is mitigated: a test checks the Admin message contains no "500" figure.

## Notes for later plans

- Web: the audit viewer copy (`web/src/modules/admin/auditCopy.ts` and its `API_ACTIONS` mirror) has no label for the three new codes yet. That belongs to the plan that builds the transfer UI and audit copy.
- Plan 10-10 must map Manager-locked and not-yet-set-up staff to `MoneyPartyStatus.Active` before calling these rules.
- Plan 10-08 adds the table with a stored `IsHandover` column; the EF constructor binding matches the private constructor `(id, fromUserId, toUserId, amount, transferDate, note, isHandover)`.
- `MoneyRules.AmountRequired`, `DateRequired` and `DateInvalid` are defined for the handlers and validators; the aggregate itself cannot see a missing amount or an unparsed date.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- Files exist: all seven created files and both modified files are on disk.
- Commits exist on this branch: `1f024876`, `53d781ff`, `8c38a1e5`, `9d73b13d`, `5ed0e925`, `112cb50e`.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-06*
