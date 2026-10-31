---
phase: 06-company-expenses
plan: 08
subsystem: api
tags: [rowversion, optimistic-concurrency, audit, authorization, fluentvalidation, ef-core, openapi]
created: "2026-10-25T10:55:00-05:00"
updated: "2026-10-25T10:55:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: CompanyExpense.Create, ExpenseRules, CreateCompanyExpenseHandler, ICompanyExpenses.FindAsync, ICompanyExpenseReader.GetDetailAsync, ExpenseAccess.CanEdit, RowVersions, ExpenseAuditDetail.Snapshot, ExpenseFixtures, AuditDetailFormat (plans 06-01, 06-02)
provides:
  - PUT /api/v1/company-expenses/{id} (Staff policy), the first rowversion form save Phase 7 copies
  - CompanyExpense.Update returning ExpenseChanges with old and new values
  - One shared ExpenseFieldsValidator (IExpenseFieldsRequest) used by the add and edit forms
  - ExpenseErrors.NotYours (403 company-expenses.not-yours)
  - company-expense.changed and company-expense.payer-changed audit entries, never merged
affects: [06-09, 06-10, 06-12, 06-13]

actuals:
  tokens: 36000
  tasks: 3
  commits: 6
plan_head_before: 5c5c029c84ab3b98e4fc1dcbd7870e99a6099b8c
plan_head_after: b3d12fbc6eb4640c613196760f0031f4b3727871

tech-stack:
  added: []
  patterns:
    - "Form save with a rowversion: validate (400), find (404), CanEdit (403), byte compare of the version (409), then check only the changed category and payer (400); no retry on a conflict"
    - "FluentValidation Include(new ExpenseFieldsValidator()) over an interface (IExpenseFieldsRequest), so two request types share one rule set and one set of messages"
    - "Domain Update assigns only changed values and returns what changed (ValueChange<T> old and new) so the handler can audit without re-reading"

key-files:
  created:
    - src/Csps.Domain/Expenses/ExpenseChanges.cs
    - src/Csps.Application/Expenses/IExpenseFieldsRequest.cs
    - src/Csps.Application/Expenses/ExpenseFieldsValidator.cs
    - src/Csps.Application/Expenses/UpdateCompanyExpenseRequest.cs
    - src/Csps.Application/Expenses/UpdateCompanyExpenseRequestValidator.cs
    - src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs
    - tests/Csps.Application.UnitTests/Expenses/UpdateCompanyExpenseHandlerTests.cs
    - tests/Csps.Application.UnitTests/Expenses/UpdateCompanyExpenseRequestValidatorTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/UpdateCompanyExpenseEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs
  modified:
    - src/Csps.Domain/Expenses/CompanyExpense.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseRequest.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseRequestValidator.cs
    - src/Csps.Application/Expenses/ExpenseErrors.cs
    - src/Csps.Application/Expenses/ExpenseAuditDetail.cs
    - src/Csps.Server/Controllers/CompanyExpensesController.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/company-expenses.md
    - .planning/phases/06-company-expenses/deferred-items.md

key-decisions:
  - "A form edit never retries on a conflict: ConcurrencyConflictException maps straight to edit.stale, unlike the user edit that uses ConflictRetry"
  - "Only a category or payer the form changes is checked against the database, so a saved retired category and a saved payer who was later deactivated may stay (D-11, OQ-7)"
  - "The company-expense.changed entry ends with the payer the expense has after the edit, and a payer change is always its own entry (D-27)"
  - "A form with no change returns the current detail, saves nothing, writes no audit entry and keeps the version"

requirements-completed: [CEXP-02, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "A staff member edits an expense with the version they opened it with; the next read shows the change, a new version and Last changed by (CEXP-02, CEXP-04)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/UpdateCompanyExpenseEndpointTests.cs (AManagerEditsAnExpenseAndTheNextReadShowsTheChangeANewVersionAndWhoChangedIt, AnUnknownIdAnswers404WithTheDeletedMessage, APutWithNoBodyListsEveryRequiredFieldIncludingTheVersion, SavingTheFormUnchangedReturnsTheSameVersionAndChangesNothing)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs (Update cases), tests/Csps.Application.UnitTests/Expenses/UpdateCompanyExpenseRequestValidatorTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stale version gets 409 edit.stale and stores nothing; two writers with one version give exactly one 200 and one 409, and the stored values and the list's periodTotal are the winner's (SEC-07)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseConcurrencyTests.cs (TwoManagersSavingTheSameExpenseWithTheSameVersionGiveExactlyOneWinnerEveryTime x10 rounds, ALaterSaveWithTheOriginalVersionIsRefusedAndStoresNothing, TwoPayerChangesSentTogetherWithOneVersionGiveOneWinnerAndOneConflict)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An Admin edits only the expenses they recorded or paid (403 company-expenses.not-yours with the exact message); a Manager edits any; moving the payer away removes the Admin's right on both the list and the PUT (D-26)"
    requirement: CEXP-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/UpdateCompanyExpenseEndpointTests.cs (AnAdminWhoNeitherRecordedNorPaidGets403WithTheExactMessageAndNothingChanges, AnAdminWhoMovesThePayerAwayFromThemselvesLosesTheRightToEditIt, AManagerMayEditAnyonesExpense)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/UpdateCompanyExpenseHandlerTests.cs (step order 400, 404, 403, 409, then payer and category)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A changed payer must pass StaffState.CanPay and a changed category must be active; a saved retired category and a saved payer who was later deactivated may stay (CEXP-05, D-11, OQ-7, D-32)"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs (deactivated, manager-locked, deleted, invited theory; KeepingASavedPayerWhoHasSinceBeenDeactivatedIsAccepted; ChangingToARetiredCategory...; KeepingTheSavedCategoryAfterItWasRetiredIsAccepted)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every edit writes company-expense.changed with old>new for amount, date and category, field names only for text, ending with the payer; a payer change is its own company-expense.payer-changed entry; no change writes nothing (D-27, T-06-28, T-06-29)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/UpdateCompanyExpenseHandlerTests.cs (AnAmountAndDescriptionEditWritesOneChangedEntry..., APayerOnlyChangeWritesOnlyAPayerChangedEntry, APayerAndDateChangeWritesTwoSeparateEntries..., ADescriptionAndNotesChangeNamesBothFieldsAndNeverTheirText)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs (ARealEditWritesAChangedRowAndASeparatePayerChangedRow..., SavingTheSamePayerAgainAddsNoPayerChangedRow..., APayerOnlyEditWritesOnlyAPayerChangedRow)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recorded by stays the creator; Last changed by and at are the editor and the server time; forged attribution members are ignored; both names survive deleted users and follow a rename (CEXP-04, SEC-08)"
    requirement: CEXP-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs (AnEditByAnotherUserKeeps..., ForgedAttributionMembersInAnEditBodyAreIgnored, BothNamesStayWithFormerStaffTrueAfterBothUsersAreDeleted, ACreatorEditingTheirOwnExpense..., ARenamedEditorShowsTheNewName...)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A payer deactivated between the CanPay check and the save is accepted (accepted race, RESEARCH Pattern 4); the money still lands on a staff member who stays visible"
    requirement: CEXP-05
    verification: []
    human_judgment: true
    rationale: "Backstop marker from the plan: accepted by research, not testable without injecting a race between two statements; Phase 10 may revisit"

duration: 28min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 08: Edit an Expense Summary

**PUT /api/v1/company-expenses/{id} saves an expense edit with a rowversion 409 (never retried), the Admin own-expense rule, edit-time payer and category checks, and separate changed and payer-changed audit entries, all through one validator shared with the add form.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-25T15:20:09Z
- **Completed:** 2026-10-25T15:49:00Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files modified:** 26 (including the generated contract)

## Accomplishments

- **Edit save in the order the plan fixes:** form check (400), find (404), `ExpenseAccess.CanEdit` (403), byte compare of the row version (409), then the changed category and payer (400). The same `CanEdit` drives the list's `canEdit`, so they cannot disagree. After an Admin moves the payer away from themselves the response, the list and the next PUT all say no.
- **Concurrency:** ten rounds of two Managers sending the same version together gave exactly one 200 and one 409 `edit.stale` ("This was changed by someone else. Reload and try again.") every time. The stored amount, `lastChangedBy` and the list `periodTotal` were the winner's. Two payer changes with one version also gave one winner. A late save with the original version is a 409 and stores nothing. EF's concurrency token backs the byte compare, so a lost race at save also maps to `edit.stale`.
- **Domain `Update`:** one shared field check with `Create`; it assigns only changed values and returns `ExpenseChanges` (old and new for amount, date, category and payer; flags for description and notes). Identical values leave the entity untouched and return an empty set.
- **One validator:** `ExpenseFieldsValidator` over `IExpenseFieldsRequest` holds every field rule and message. `CreateCompanyExpenseRequestValidator` and the new `UpdateCompanyExpenseRequestValidator` `Include` it; the edit one adds the version rule (base64 of 8 bytes, else "Reload the form and try again.").
- **Audit (D-27):** `company-expense.changed` lists `amount`, `date`, `category` as `old>new`, names changed text as `fields=description,notes` (never the text) and ends with `payer=<id>`. A payer change writes its own `company-expense.payer-changed` `payer=<old>><new>`. Both are recorded before the one `SaveChangesAsync` in the same transaction. A save with no change writes no entry and keeps the version.
- **Contract:** matrix row for the PUT (anonymous 401, Admin 400, Manager 400), OpenAPI snapshot and generated types refreshed (LF kept), `docs/api/company-expenses.md` documents the body, step order, 403, 409, payer and category rules and both audit entries.

## Task Commits

1. **Task 1: Tracer, edit an expense with a row version (CEXP-02, CEXP-04)**
   - RED `d597329` (test)
   - GREEN `d6acf5e` (feat)
2. **Task 2: Conflicts, own-expense rule, edit-time payer and category rules (SEC-07, D-26, D-11, OQ-7, D-32)**
   - RED/characterization `62c5b65` (test)
   - GREEN `1f96a30` (feat: contract text; no production code was missing)
3. **Task 3: Edit audit and attribution (D-27, CEXP-04, CEXP-05, SEC-08)**
   - RED `b97976b` (test)
   - GREEN `b3d12fb` (feat)

**Plan metadata:** the `docs(06-08)` commit that follows this file.

### TDD gate compliance

`test(06-08)` precedes `feat(06-08)` for all three tasks. No REFACTOR commits. The formal `gsd_run check tdd-red-evidence` classifier does not read the MTP console report, so the evidence is the quoted run plus a semantic assessment.

- **Task 1 RED:** `*UpdateCompanyExpenseEndpointTests` ran 4 and all 4 failed on the planned missing route (anonymous: `Unauthorized but was NotFound`; edit and 404 tests: no `code` member because the answer was the generic not-found). The Domain test project did not build: `CS0246: The type or namespace name 'ExpenseChanges' could not be found`, the type this task adds. Semantic assessment: the targets ran (or failed to compile) on exactly the missing feature.
- **Task 2:** a characterization RED. The plan puts the whole handler (404, 403, 409, payer and category checks) in Task 1, so all new tests passed at once: Application unit 25/25 (before Task 3 additions), endpoint 15/15, payer 9/9, concurrency 3/3. They are kept as regression tests. The only thing the `feat` commit adds is the contract text for the 409/403/payer rules in `docs/api/company-expenses.md`.
- **Task 3 RED:** the Application test project failed to build (`CS0117: 'ExpenseAuditDetail' does not contain a definition for 'Changes'`, `'PayerChange'`, and `CS1729: 'UpdateCompanyExpenseHandler' does not contain a constructor that takes 9 arguments`), and three integration tests failed on the planned missing audit rows (`["company-expense.changed", "company-expense.payer-changed"] but was []`). The seven attribution tests added in this task passed at once (attribution was already correct); they stay as regression tests.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)` (after the last code change).
- Task 1 verify: `*UpdateCompanyExpenseEndpointTests` 4/4, `*CompanyExpenseTests` (Domain) 38/38, `*CreateCompanyExpenseEndpointTests` 20/20, `*Authorization*` 210/210, `*OpenApiSnapshotTests` 10/10 after refresh; `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Task 2 verify: `*CompanyExpenseConcurrencyTests` 3/3, `*CompanyExpensePayerTests` 9/9 (12/12 after Task 3), `*UpdateCompanyExpense*` Application 25/25.
- Task 3 verify: `*CompanyExpenseAttributionTests` 10/10, `*CompanyExpensePayerTests` 12/12, `*UpdateCompanyExpenseHandlerTests` 24/24.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`) after the last code commit: "Csps.Domain line 100% (993/993) branch 100% (420/420) PASS; Csps.Application line 99.2% (3220/3244) PASS. Coverage gate passed."
- Full suites after the last code commit: Architecture 239/239; Server integration 1198/1198 on the second full run (one earlier failure, see Issues).
- Acceptance greps: `Include(` in both request validators 1 each; `ConflictRetry` in the handler 0; `HttpPut` in the controller 1; `company-expenses.not-yours` in ExpenseErrors 1; `CompanyExpensePayerChanged` in the handler 1; `CompanyExpenseChanged` in the handler 1; `PayerChange` in ExpenseAuditDetail 1; `PUT` in the API doc 2; `SendTogetherAsync` in the concurrency tests 3.
- Tracer gate: the Task 1 `<verify>` (three automated commands) ran end to end and passed before expansion.

## Decisions Made

- A form edit never retries (`ConflictRetry` is deliberately absent); both the byte compare and a `ConcurrencyConflictException` at save answer `edit.stale`.
- The audit `payer=<id>` at the end of the changed entry is the payer after the edit, read from the entity after `Update`, so the entry is correct whether or not the payer also changed.
- `IExpenseFieldsRequest.Date` needs a narrow `CA1716` suppression (the member is named `Date`, a Visual Basic keyword), with the same justification the repo already uses for `Error`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CA1716 on the interface member `Date`**
- **Found during:** Task 1 (first build after adding `IExpenseFieldsRequest`)
- **Issue:** The analyzer (warnings as errors) refuses an interface member named like a reserved keyword.
- **Fix:** `[SuppressMessage("Naming", "CA1716", ...)]` on the interface, copying the repo's existing justification for `Error`. The member keeps the wire name `Date`.
- **Files modified:** `src/Csps.Application/Expenses/IExpenseFieldsRequest.cs`
- **Verification:** build 0 warnings, 0 errors.
- **Committed in:** `d6acf5e`

**2. [Rule 1 - Bug] Concurrency test compared `periodTotal` across the whole class database**
- **Found during:** Task 2 (first run of `CompanyExpenseConcurrencyTests`)
- **Issue:** The class shares one database, so the unfiltered list also held the other tests' expenses (2341.00 instead of 1001).
- **Fix:** the test gives its expense a unique description and reads the list with `q=<that description>`.
- **Files modified:** `tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseConcurrencyTests.cs`
- **Verification:** 3/3 pass.
- **Committed in:** `62c5b65`

---

**Total deviations:** 2 auto-fixed (1 blocking analyzer rule, 1 test bug)
**Impact on plan:** None on scope. The Task 2 `feat` commit carries only the contract text (nothing was missing), recorded under TDD gate compliance.

## Issues Encountered

- **Flake, recorded not hidden:** `CompanyExpenseListQueryCountTests.TheKpisRunTheSameNumberOfSqlCommandsEachTime` failed once inside the first full Server integration run. Re-run alone it passed (3/3), and a second full run passed 1198/1198. The KPI path is not touched by this plan. Noted in `.planning/phases/06-company-expenses/deferred-items.md`.
- `dotnet format Csps.slnx --verify-no-changes` still reports only the known item `src/Csps.Infrastructure/Identity/UserDirectory.cs(1,1): IMPORTS` already in deferred-items from 06-06; none of this plan's files are flagged.
- A few multi-line shell heredocs failed to parse in the tool wrapper and ran nothing; the files were then written with the Write and Edit tools. No state was affected.

## Known Stubs

None. This plan adds server behaviour only; the Edit form on the page arrives in a later plan.

## Threat Flags

None. The one new route is the one in the plan's threat model: T-06-25 (IDOR on edit) by `ExpenseAccess.CanEdit` before any change and the foreign-id 403 tests; T-06-26 (lost update) by the byte compare, EF's token and the two-writer tests; T-06-27 (forged attribution) by a request type with no attribution members plus the forgery test; T-06-28 (silent payer change) by the separate payer-changed entry in the same save; T-06-29 (text in the audit) by `fields=` names only and the absence assertions; T-06-SC by installing nothing.

## User Setup Required

None - no external service configuration required.

## Owner items

None new. The payer-deactivated-between-check-and-save race (D7) is the plan's accepted backstop; Phase 10 may revisit.

## Next Phase Readiness

- Plan 06-09 and the edit screens can call `PUT /company-expenses/{id}` with `{ date, categoryId, description, amount, paidByUserId, notes, version }` and handle 400 field errors, 403 `company-expenses.not-yours`, 404 and 409 `edit.stale`; the generated type is `UpdateCompanyExpenseRequest`.
- Phase 7 can copy the rowversion form save (`UpdateCompanyExpenseHandler`) and the shared-validator `Include` pattern.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`d597329`, `d6acf5e`, `62c5b65`, `1f96a30`, `b97976b`, `b3d12fb`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
