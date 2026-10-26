---
phase: 06-company-expenses
plan: 02
subsystem: api
tags: [ef-core, migration, soft-delete, rowversion, fluentvalidation, audit, idempotency, controllers]
created: "2026-10-25T07:35:00-05:00"
updated: "2026-10-25T07:35:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: ExpenseCategories table and IExpenseCategories, IStaffDirectory.GetStaffStateAsync and StaffState.CanPay, the audit codes and AuditDetailFormat (plan 06-01)
  - phase: 05-profile-users-audit
    provides: Staff policy, the idempotency gate, RecordStampInterceptor, ActorRef, the authorization matrix
provides:
  - CompanyExpenses table with soft delete (DeletedAtUtc, DeletedById), a named SoftDelete query filter, a positive-amount check and the seven-index set (migration 20261025121237_AddCompanyExpenses)
  - POST /api/v1/company-expenses (Staff, Idempotency-Key) and GET /api/v1/company-expenses/{id} (both roles), with every field rule on the domain and the validator
  - CompanyExpense aggregate, ExpenseRules (limits and the owner's messages), ExpenseAccess.CanEdit (D-26), RowVersions (base64 of eight bytes), ExpenseAuditDetail.Snapshot
  - Ports ICompanyExpenses, ICompanyExpenseReader, IExpenseCategories.GetStateAsync for plans 06-03 and later
  - docs/api/company-expenses.md POST and GET contract, including the D-22 money-on-hand note for Phase 10
affects: [06-03, 06-04, 06-08, 06-10, phase-07-orders, phase-10-money-on-hand]

actuals:
  tokens: 43700
  tasks: 3
  commits: 6
plan_head_before: d6684d4a7aa4bf7f9c5e7f5d11c5efb52a018461
plan_head_after: 45d6c1944d758f8cc24e8dc960e1848de2101a35

tech-stack:
  added: []
  patterns:
    - "Named EF query filter (HasQueryFilter(\"SoftDelete\", ...)) with IgnoreQueryFilters([\"SoftDelete\"]) for the Deleted view, restore and purge"
    - "Handler adds database-backed checks (category, payer) to the validator's failures so one 400 lists every field"
    - "Business today passed to a FluentValidation validator through ValidationContext.RootContextData"
    - "Reader joins the user rows for payer, recorder and last changer in one statement (left joins), FormerStaff from DeletedAtUtc"

key-files:
  created:
    - src/Csps.Domain/Expenses/CompanyExpense.cs
    - src/Csps.Domain/Expenses/ExpenseRules.cs
    - src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261025121237_AddCompanyExpenses.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261025121237_AddCompanyExpenses.Designer.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs
    - src/Csps.Application/Ports/ICompanyExpenses.cs
    - src/Csps.Application/Ports/ICompanyExpenseReader.cs
    - src/Csps.Application/Common/RowVersions.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseRequest.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseRequestValidator.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/GetCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/CompanyExpenseDetailResponse.cs
    - src/Csps.Application/Expenses/ExpenseCategoryRef.cs
    - src/Csps.Application/Expenses/ExpenseErrors.cs
    - src/Csps.Application/Expenses/ExpenseAccess.cs
    - src/Csps.Application/Expenses/ExpenseAuditDetail.cs
    - src/Csps.Server/Controllers/CompanyExpensesController.cs
    - tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs
    - tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs
    - tests/Csps.Application.UnitTests/Expenses/ExpenseAccessTests.cs
    - tests/Csps.Application.UnitTests/Common/RowVersionsTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/CompanyExpensesMigrationTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Expenses/ExpenseCategoryStore.cs
    - src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs
    - src/Csps.Application/Ports/IExpenseCategories.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/company-expenses.md

key-decisions:
  - "The seven CompanyExpenses indexes and the soft-delete filter are in the first migration (D-01), so later plans add no schema for the list, the Deleted view or the money-on-hand sums"
  - "ExpenseRules.AmountMax is a static readonly decimal, not a const, so the Domain 100 percent line gate counts the static initializer that a decimal const would leave unexecuted"
  - "The read port returns the Application type ExpenseCategoryRef directly instead of a second category view type"
  - "The audit entry is recorded inside the same InTransactionAsync block as the Add, before SaveChangesAsync, so it joins the idempotency gate's transaction"

patterns-established:
  - "Slice order for a write: validator (static rules) then handler (database-backed rules merged into the same failures) then domain Create (the same rules again) then one transaction (Add, audit, save) then a read of the detail"
  - "Audit detail built only through ExpenseAuditDetail on AuditDetailFormat, never with description or notes text"

requirements-completed: [CEXP-02, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "A staff member records an expense through POST and reads it back through GET by id; the answer carries the detail, the version and the caller's edit right (CEXP-02, D-25)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows POST /api/v1/company-expenses and GET /api/v1/company-expenses/{id})"
        status: pass
    human_judgment: false
  - id: D2
    description: "The CompanyExpenses table has soft delete, the named SoftDelete filter, a positive-amount check only (D-33), no cascading foreign key and the seven-index set"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/CompanyExpensesMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every field rule holds exactly at its limit on the domain, the validator and the endpoint, with the owner's messages and one 400 listing every failed field (D-11, D-17, D-19, D-20, D-21, D-32, OQ-10)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseRequestValidatorTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Who recorded an expense and when come from the token and the clock; forged members are ignored; recorder and payer are separate; the D-26 edit rule is one function (SEC-08, CEXP-04)"
    requirement: CEXP-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/ExpenseAccessTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each create writes one company-expense.added entry with date, category id, amount and payer id in the same save, never description or notes text; a retried key creates one row and one entry (D-27, SEC-06)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency"
        status: pass
    human_judgment: false
  - id: D6
    description: "The row version travels as base64 of exactly eight bytes (SEC-07 groundwork)"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Common/RowVersionsTests.cs"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 02: Record and read a company expense Summary

**POST and GET for company expenses on a new soft-delete table: every field rule enforced on the domain and the validator at its exact limit, payer and category checked in the database, one audit entry per create, token-only attribution and a single D-26 edit rule.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-25T12:05:44Z
- **Completed:** 2026-10-25T12:33:00Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files modified:** 39 (including the EF migration files and the generated contract)

## Accomplishments

- The `CompanyExpenses` table exists with `DeletedAtUtc` and `DeletedById` from day one, the named `SoftDelete` query filter, `CK_CompanyExpenses_Amount_Positive` as the only amount check (D-33), five NO ACTION foreign keys and the seven-index set (two filtered). The migration holds one table and nothing else.
- `POST /api/v1/company-expenses` answers 201 with the detail and a `Location`; `GET /api/v1/company-expenses/{id}` answers both roles. A soft-deleted or unknown id is a 404 `company-expenses.not-found` ("This expense was deleted.").
- Every rule from the plan holds at its edge on the domain, the validator and the endpoint: amount 0.00 refused and 0.01 accepted, 1,000,000.00 accepted and 1,000,000.01 refused, 1250.10 and 1250.1 accepted and 1250.123 refused, today+30 accepted and today+31 refused, 200 and 1,000 characters accepted and one more refused, and lengths counted in UTF-16 code units.
- A retired, unknown or missing category and a payer who fails `StaffState.CanPay` (deactivated, Manager-locked, deleted, invited without a password, non-staff id) are refused with the owner's messages, in the same 400 as the static field errors.
- Attribution comes only from the token and the clock. Forged `createdById`, `createdAt`, `updatedById`, `updatedAt`, `deletedAtUtc`, `deletedById` and `rowVersion` in the body are ignored. An expense recorded by Admin A and paid by Manager B reads `paidBy` B and `recordedBy` A.
- One `company-expense.added` entry is written in the same save, with `date=…;category=<id>;amount=…;payer=<id>` and no description or notes text. A retried `Idempotency-Key` gives the stored 201 and one row and one entry.
- `docs/api/company-expenses.md` now holds the POST and GET contract, every message, the attribution rules and the D-22 money-on-hand note for Phase 10.

## Task Commits

1. **Task 1: Tracer, record an expense and read it back (CEXP-02)**
   - RED `1fa8643` (test)
   - GREEN `7ef647a` (feat)
2. **Task 2: Field rules at their boundaries (D-11, D-17, D-19, D-20, D-21, D-32, D-33)**
   - RED `83f890c` (test)
   - GREEN `d4b74f1` (feat)
3. **Task 3: Audited, idempotent, token-attributed create (D-27, SEC-06, SEC-08, CEXP-04)**
   - RED `955bb67` (test)
   - GREEN `45d6c19` (feat)

**Plan metadata:** the `docs(06-02)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks (`test(06-02)` before `feat(06-02)`). No REFACTOR commits were needed.

RED evidence and semantic assessment, per task. The formal `gsd_run check tdd-red-evidence` classifier does not read these runner outputs (MTP console report and compile errors), so the evidence below is the quoted run, with the semantic assessment stated.

- **Task 1:** `*CreateCompanyExpenseEndpointTests` ran 6 tests, 6 failed on the planned assertions (for example `response.StatusCode should be Created but was NotFound` and `AnAnonymousGetGets401` got 404 because the route did not exist). `*CompanyExpensesMigrationTests` ran 7 tests, 7 failed with `Invalid object name 'CompanyExpenses'.` Semantic assessment: the targets executed and failed because the route and the table do not exist yet, which is the planned missing behavior.
- **Task 2:** this RED is mostly a **characterization** RED. The Task 1 tracer already had to hold the validator and the payer and category checks (the plan puts "every static rule" in Task 1), so the domain, validator, handler and endpoint boundary tests passed at once once they compiled (domain 28 of 28, endpoint 16 of 16). The one genuinely missing piece was `RowVersions`: the Application test project failed to build with `CS0103: The name 'RowVersions' does not exist in the current context` (RowVersionsTests and CreateCompanyExpenseHandlerTests). Semantic assessment: a compile error naming exactly the type this task adds, so GREEN was not authorized by an unrelated failure. After GREEN the boundary tests are kept as characterization tests.
- **Task 3:** `*CreateCompanyExpenseEndpointTests` ran 20 tests, 2 failed on the planned behavior (`TheSameKeyAndBodyTwiceGivesTwoIdenticalAnswersOneRowAndOneAuditEntry` and `TheAuditEntryHoldsTheSnapshotAndNeitherTheDescriptionNorTheNotesText`, no audit row yet). The handler tests failed to build (`CS0103: The name 'ExpenseAuditDetail' does not exist`, `CS1729: 'CreateCompanyExpenseHandler' does not contain a constructor that takes 9 arguments`). The 5 attribution tests passed at once (characterization): attribution was already correct from the interceptor and the request record, which has no attribution members. Semantic assessment: the failing targets name exactly the missing audit entry and detail builder.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- Task 1 verify: `*CreateCompanyExpenseEndpointTests` 6/6, `*CompanyExpensesMigrationTests` 7/7, `*MigrationScriptTests` 6/6, `*TriggerInventoryTests` 2/2 (only `TR_AuditLog_AppendOnly` exists).
- Task 2 verify: `*CompanyExpenseTests` 28/28, `*Expense*` in Application.UnitTests 63/63 then 66/66, `*CreateCompanyExpenseEndpointTests` 16/16.
- Task 3 verify: `*CompanyExpenseAttributionTests` 5/5, `*CreateCompanyExpenseEndpointTests` 20/20, `*Idempotency*` 52/52.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (956/956) branch 100% (398/398) PASS; Csps.Application line 99.2% (2925/2947) PASS. Coverage gate passed."
- Full suites after the last commit: Domain 662/662, Application 1006/1006, Architecture 217/217, Infrastructure integration 526 passed and 1 skipped (a skip that existed before this plan), Server integration 1099/1099 (includes `*Authorization*` and `*OpenApiSnapshotTests`).
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: three programs, no errors.
- Acceptance greps: `HasQueryFilter("SoftDelete"` 1, `CK_CompanyExpenses_Amount_Positive` 1, `IX_CompanyExpenses_` 7, `/api/v1/company-expenses` in the matrix 2, `CompanyExpenseDetailResponse` in `api.generated.ts` 3, `PrecisionScale` 1, the payer message in `ExpenseRules.cs` 1, `RootContextData` in the handler 1, `CompanyExpenseAdded` in the handler 1, `Snapshot` in `ExpenseAuditDetail.cs` 1, "money on hand" in the doc 2.
- Tracer gate: Task 1 `<verify>` ran end to end in `end-of-phase` mode with automated checks only (four commands, all passed), so the slice was verified and expansion went ahead.

## Decisions Made

- The index set and the soft-delete filter ship in the first migration (D-01), so the list (06-03), the Deleted view (06-10) and the Phase 10 sums need no schema change.
- `AmountMax` is a `static readonly decimal`. A `const decimal` leaves a static constructor that is never run (callers inline the value), which cost the Domain gate its last line.
- The read port returns `ExpenseCategoryRef` directly instead of a second category type.
- The category and payer database checks are added to the validator's own failures, so one 400 lists every field and `ValidationResults.ToError` builds it (no second error path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ExpenseRules.AmountMax` was a `const decimal` and cost the Domain gate its 100 percent line**
- **Found during:** Task 2 (coverage gate)
- **Issue:** the compiler emits a static constructor for a decimal const, and nothing runs it because callers inline the value. Csps.Domain showed 99.8 percent (955 of 956 lines).
- **Fix:** declared it `public static readonly decimal AmountMax = 1_000_000.00m;`.
- **Files modified:** `src/Csps.Domain/Expenses/ExpenseRules.cs`
- **Verification:** coverage gate now Domain 100 percent line and 100 percent branch.
- **Committed in:** `d4b74f1`

**2. [Rule 1 - Bug] Handler test compared a dictionary of arrays by reference**
- **Found during:** Task 2 (GREEN run)
- **Issue:** `Fields(result).ShouldBe(new Dictionary<string, string[]> { ... })` failed with identical-looking output because the `string[]` values compare by reference.
- **Fix:** an `OnlyField(result, field, message)` helper that checks the key and the message list.
- **Files modified:** `tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs`
- **Verification:** 66 of 66 Expense unit tests pass.
- **Committed in:** `d4b74f1`

### Plan wording notes

- The migration is `20261025121237_AddCompanyExpenses` (the tool's real timestamp), not the plan's placeholder `20261025000001`, the same note as 06-01. The generated `descending: new bool[0]` on the two descending indexes means "all columns descending" in EF; `TheListIndexLeadsWithTheDateAndCoversTheListColumns` proves it in the real database.
- The plan lists no `ExpenseAuditDetail` test file; its tests live in `CreateCompanyExpenseHandlerTests.cs` (the snapshot format and the under-400-characters bound).

---

**Total deviations:** 2 auto-fixed (2 Rule 1), 2 plan wording notes
**Impact on plan:** No scope change. Both fixes keep the Domain 100 percent gate and the test suite honest.

## Issues Encountered

- A first draft of the amount tests used `double` InlineData that collided (`1250.10` and `1250.1` are the same double, xUnit1025). The amounts are now strings parsed as decimals.
- One large multi-heredoc shell command failed to parse and ran nothing; the files were then written with the Write and Edit tools. No state was affected.
- Python is not installed on this machine (the PATH entry is a Store alias), so sed and the Edit tool made every scripted edit.

## Known Stubs

None. Update, soft delete, restore and the list arrive in plans 06-03, 06-08 and 06-10 by design; nothing in the API or the UI shows placeholder data.

## Threat Flags

None. The two endpoints are the ones in the plan's threat model. T-06-06 (forged attribution) is covered by `CompanyExpenseAttributionTests`, T-06-07 (invalid values) by the boundary tests and the database check, T-06-08 (duplicate expense) by the idempotency test, T-06-09 (blocked payer) by the four blocked-state endpoint cases, and T-06-10 (audit disclosure) by the audit-text tests.

## User Setup Required

None - no external service configuration required.

## Owner items

None from this plan. A-06-01 (can a temporary-password person who never signed in be chosen as Paid by) from 06-01 is still parked in the STATE.md "Owner backlog"; this plan applies the literal D-32 rule through `StaffState.CanPay`, so a swap point stays in `StaffDirectory.cs`.

## Next Phase Readiness

- Plan 06-03 (list) can read from `CompanyExpenses` with the index set, the SoftDelete filter and `ICompanyExpenseReader`.
- Plan 06-08 (edit) has `RowVersions.TryParse`, `ExpenseAccess.CanEdit`, `ICompanyExpenses.FindAsync(id, includeDeleted, ...)` and the audit helper to extend with the change detail.
- Plan 06-10 (soft delete, restore, purge) has the filter name and the `DeletedAtUtc` and `DeletedById` columns.
- The web still lists the old fixed category union; plans 06-04 and later replace it.

## Self-Check: PASSED

All created files exist on disk; all six task commits (`1fa8643`, `7ef647a`, `83f890c`, `d4b74f1`, `955bb67`, `45d6c19`) are ancestors of HEAD; the full test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
