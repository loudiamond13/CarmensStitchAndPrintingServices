---
phase: 06-company-expenses
plan: 20
subsystem: api
tags: [payer-rule, staff-lookup, identity, d-49, a-06-01, tdd, owner-review]
created: "2026-10-25T21:45:00-05:00"
updated: "2026-10-25T21:45:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: StaffState.CanPay, the staff lookup, the expense detail paidByActive flag, the dev seed step and the review pack (plans 06-01, 06-02, 06-08, 06-11, 06-19)
provides:
  - "D-49 built: GET /api/v1/staff lists only Admins and Managers who are active, not locked, not deleted, have a password and carry the first sign-in mark (EmailConfirmed)"
  - "StaffState.HasFinishedSetUp (renamed from HasPassword); CanPay is false for anyone who has not signed in yet"
  - "POST and PUT /api/v1/company-expenses refuse a never-signed-in payer on paidByUserId with the existing text; a saved one may stay on an edit (OQ-7)"
  - "GET /api/v1/company-expenses/{id} paidByActive is false for a saved payer who has not signed in yet and agrees with CanPay"
  - "The dev seed picks only payers and recorders who have signed in"
  - "API doc, developer guide and the owner review pack say A-06-01 option 1 is built"
affects: [06-21, 17-legacy-import, 07]

actuals:
  tokens: 16300
  tasks: 3
  commits: 6
plan_head_before: 94929006634ca03d28763f287f91cf04feeec023
plan_head_after: afcb60ec4459a4f13a4480ba9675e3f117db5d69

tech-stack:
  added: []
  patterns:
    - "One payer rule kept in four clauses (list filter and payer state in StaffDirectory, PayerActive in CompanyExpenseReader, the dev seed read), each commenting the others, with consistency tests over every kind of account"

key-files:
  created: []
  modified:
    - src/Csps.Infrastructure/Identity/StaffDirectory.cs
    - src/Csps.Application/Staff/StaffState.cs
    - src/Csps.Server/Controllers/StaffController.cs
    - src/Csps.Server/Controllers/CompanyExpensesController.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs
    - src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs
    - tests/Csps.Application.UnitTests/Staff/StaffStateTests.cs
    - tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Users/UserFixtures.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/CompanyExpensesSeedStepTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/company-expenses.md
    - docs/development.md
    - docs/web/owner-review.md
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts

key-decisions:
  - "D-49 (owner, 2026-10-25) built as option 1: set up means a password and EmailConfirmed. Nothing else changed: no column, no migration, no new wording."
  - "Supersedes the 06-01 assumption A-06-01 (option 2 built): the pin test now asserts NOT listed."
  - "Carry-forward for Phase 17 (legacy import): imported staff need the first sign-in mark set, or they cannot be chosen as Paid by."

requirements-completed: [CEXP-05]

coverage:
  - id: D1
    description: "The staff lookup and the payer state leave out anyone who has never signed in, still list them after their first sign-in code, and keep staff after a Manager password reset"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs#ATemporaryPasswordPersonWhoHasNotSignedInIsNotListed"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs#ATemporaryPasswordPersonIsListedAfterTheirFirstSignInCode"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs#ALongTimeStaffMemberWhosePasswordAManagerResetStaysListed"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs#TheListAndThePayerStateAgreeForEveryPerson"
        status: pass
    human_judgment: false
  - id: D2
    description: "Create and edit refuse a never-signed-in payer on paidByUserId with the existing text, accept a reset payer, and let a saved payer stay"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CreateCompanyExpenseEndpointTests.cs#APayerWhoCannotBeChosenIsRefusedOnThePayerFieldWithTheExactMessage(temporary-not-signed-in)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs#ChangingThePayerToSomeoneWhoCannotBeChosenIsRefusedOnThePayerField(temporary-not-signed-in)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs#KeepingASavedPayerWhoHasNotSignedInIsAccepted"
        status: pass
    human_judgment: false
  - id: D3
    description: "The expense detail paidByActive flag tells the truth for a saved payer who has not signed in yet and agrees with CanPay for every kind of payer"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs#TheDetailFlagAgreesWithThePayerStateForEveryKindOfPayer"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpensePayerTests.cs#ASavedPayerWhoHasNotSignedInShowsAsNotChoosableUntilTheirFirstCode"
        status: pass
    human_judgment: false
  - id: D4
    description: "The dev seed uses only staff who have signed in and the docs and owner review pack describe option 1 as built"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/CompanyExpensesSeedStepTests.cs#AStaffMemberWhoHasNeverSignedInIsNeverUsedAsPayer"
        status: pass
      - kind: unit
        ref: "web/scripts/owner-review.test.ts#gives A-06-01 three options, recommended first, with option 1 (first sign-in) the one built"
        status: pass
    human_judgment: false
  - id: D5
    description: "The existing refusal sentence ('account isn't active') reads slightly off for a person who has not signed in yet"
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call (05 D-48); the plan forbids rewording, so it is parked in the Owner backlog."

duration: 38min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 20: Paid by needs a first sign-in (D-49) Summary

**Paid by now accepts only staff who have a password and the first sign-in mark (EmailConfirmed), in the staff lookup, the create and edit check, the expense detail flag and the dev seed, while staff whose password a Manager reset stay choosable.**

## Performance

- **Duration:** about 38 min
- **Started:** 2026-10-25T21:07:00-05:00
- **Completed:** 2026-10-25T21:45:00-05:00
- **Tasks:** 3 (each a RED and a GREEN commit)
- **Files modified:** 20

## Accomplishments

- The staff list filter and the payer state in `StaffDirectory` both add `EmailConfirmed`; `StaffState` flag renamed `HasFinishedSetUp`, so `CanPay` and the list cannot disagree (tested over deactivated, locked, deleted, invited, unmarked, never-signed-in, reset and the caller).
- Create and edit already refuse through `CanPay` with the existing text; the detail query's `PayerActive` got the same extra clause, in SQL, still one statement (query-count test green).
- The dev seed, API doc, developer guide and the owner review pack (A-06-01 option 1 built) follow the rule. No schema change, no new wording, no web source change besides the regenerated contract comment.

## Task Commits

1. **Task 1 (tracer): staff lookup and payer state** - `280c496` (test, RED), `7000816` (feat)
2. **Task 2: create, edit and detail** - `687250d` (test, RED), `48104e6` (feat)
3. **Task 3: dev seed, docs, review pack** - `ff46771` (test, RED), `afcb60e` (feat)

**Plan metadata:** the docs commit that holds this summary and the state update.

## TDD Gate Compliance

All three tasks have a `test(06-20)` commit before the `feat(06-20)` commit.

- Task 1 RED: the unit case names `HasFinishedSetUp`, so the committed RED does not compile until the rename, as the plan intends. Behavioral RED evidence was taken first with a temporary rename (not committed): `ATemporaryPasswordPersonWhoHasNotSignedInIsNotListed`, `TheListAndThePayerStateAgreeForEveryPerson` and `APayerStateCarriesTheRoleAndTheFlags` failed on the planned assertions (`should not contain <id>` and `HasFinishedSetUp should be False but was True`). The first-code and reset cases passed on the old code, as guards against over-correcting.
- Task 2 RED: three failures, all on `paidByActive` (should be False but was True). The create and edit "temporary-not-signed-in" cases already passed, because Task 1 changed the shared `CanPay` rule that both handlers read.
- Task 3 RED: two seed failures (unmarked staff were used as payers or kept the seed from skipping) and one review-pack assertion (`built it`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gitleaks flagged a literal test password**
- **Found during:** Task 2 RED commit
- **Issue:** the new fixed `TemporaryPassword` string constant in `CompanyExpensePayerTests.cs` tripped the generic-api-key rule and blocked the hook.
- **Fix:** the value is now generated per run (`$"Tmp-{Guid.NewGuid():N}!x"`), no allowlist change.
- **Committed in:** `687250d`

**2. [Rule 3 - Blocking] Banned API in a test**
- **Found during:** Task 2 RED
- **Issue:** `DateTimeOffset.UtcNow` is banned (RS0030).
- **Fix:** `TimeProvider.System.GetUtcNow()`.
- **Committed in:** `687250d`

### Plan inconsistencies (no code impact)

- The Task 2 RED description says the server "still accepts a never-signed-in payer"; after Task 1 it already refuses, so only the detail flag cases fail in that RED. The tests are kept as regression pins.
- The plan-level check `git diff --name-only FIRST^..LAST -- web/src` expects nothing, but Tasks 1 and 2 list `web/src/types/api.generated.ts` in their own files. That file changed only in the XML-summary comment text of the generated contract. The Task 3 check (`web/src` untouched across its two commits) prints nothing.

---

**Total deviations:** 2 auto-fixed (2 blocking), 2 plan inconsistencies noted.
**Impact on plan:** none on scope.

## Issues Encountered

- A hung `python -` (empty heredoc waiting on stdin) was my own and was killed by PID after confirming its command line; nothing is left running.
- The first run of the OpenAPI snapshot test with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` reports one failure by design (it writes then fails); the second plain run passes.

## Verification Evidence

- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffLookupEndpointTests"`: total 10, failed 0.
- Create, Payer, Update and ListQueryCount classes together: total 56, failed 0.
- `*StaffStateTests`: total 12, failed 0. `*CreateCompanyExpenseHandlerTests`: total 20, failed 0.
- `*CompanyExpensesSeedStepTests`: total 8, failed 0.
- `*OpenApiSnapshotTests`: total 10, failed 0; `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `*Authorization*`: total 240, failed 0.
- `Invoke-CoverageGate.ps1`: Domain 100% line and branch, Application line 98.2% (3797/3864), "Coverage gate passed."
- `dotnet build`: 0 Warning(s), 0 Error(s).
- `npm --prefix web run verify`: passed, ending with "License gate passed." and "THIRD-PARTY-NOTICES.txt is up to date (28 packages)."
- Vitest `owner-review.test.ts`, `PaidBySelect.test.tsx`, `ExpenseModal.test.tsx`: 3 files, 163 tests passed.
- `npm --prefix web run e2e -- --grep @expenses-add`: 5 passed. `--grep @expenses-edit`: 20 passed.
- No migration files changed in the plan range.

## Known Stubs

None.

## Threat Flags

None. The lookup answer stays `{ id, name }` (T-06-64); the refusal text is the existing generic one.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 06-21 (D-50, EF-only locks). Phase 6 verification can proceed after 06-21.
- Phase 17 (legacy import) must set the first sign-in mark on imported staff, or they cannot be chosen as Paid by.
- Parked for the owner: whether the sentence "This person can't be chosen because their account isn't active." should be reworded for a person who has not signed in yet (STATE.md Owner backlog).

## Self-Check: PASSED

All 20 modified files exist; commits 280c496, 7000816, 687250d, 48104e6, ff46771 and afcb60e are ancestors of HEAD.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
