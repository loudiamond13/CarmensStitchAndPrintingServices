---
phase: 05-profile-user-management
plan: 38
subsystem: api
tags: [audit, profile, d-40, field-names-only, unit-of-work, coverage]
created: 2026-10-18T00:10:00-05:00
updated: 2026-10-18T00:10:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-09: UpdateProfileNameHandler, GetProfileHandler, UpdateProfileNameRequestValidator, ProfileEndpointTests"
provides:
  - "AuditKey.Of(Guid): the shared audit target-id helper (lower-case D, invariant) for every new Phase 5 handler"
  - "AuditActions.ProfileNameChanged (profile.name-changed), in All"
  - "UpdateProfileNameHandler writes one profile.name-changed entry per real name change, detail fields=... only"
  - "Unit coverage for the 05-09 profile handlers and validator in tests/Csps.Application.UnitTests"
  - "docs/operations/audit-log.md section: Phase 5 profile and staff events"
affects: [05-43 (IN-02 replaces the older Key helper copies with AuditKey.Of), later Phase 5 audited handlers, 05-39 and onward]

actuals:
  tokens: 7716
  tasks: 2
  commits: 3
plan_head_before: 2a336c757b0aee482cae897d3bc3765c759edd79
plan_head_after: 940598307531ed6c454c38ec8f53f087c0024879

tech-stack:
  added: []
  patterns:
    - "Audit detail holds field names and role values only, never names or emails (D-40)"
    - "A save that must be audited runs UpdateNameAsync and audit.Record + SaveChangesAsync inside unitOfWork.InTransactionAsync"

key-files:
  created:
    - src/Csps.Application/Common/AuditKey.cs
    - tests/Csps.Application.UnitTests/Profile/UpdateProfileNameHandlerTests.cs
    - tests/Csps.Application.UnitTests/Profile/GetProfileHandlerTests.cs
    - tests/Csps.Application.UnitTests/Profile/UpdateProfileNameRequestValidatorTests.cs
  modified:
    - src/Csps.Application/Profile/UpdateProfileNameHandler.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs
    - docs/operations/audit-log.md

key-decisions:
  - "The handler reads the current profile before the save and compares trimmed names ordinally to build the field list, so the IUserAccounts port and its EditResult did not change"
  - "The name save and its audit entry share one InTransactionAsync, so an entry never outlives a rolled-back change and a change is never saved without its entry"
  - "Only EditOutcome.Saved records an entry: Unchanged, Stale and NotFound write nothing and do not call SaveChangesAsync"

patterns-established:
  - "AuditKey.Of(id) is the one target-id formatter for new handlers"

requirements-completed: [PROF-01, USER-06]

coverage:
  - id: D1
    description: "A real name change through PUT /api/v1/profile writes exactly one profile.name-changed entry (target User id) with detail fields=first-name, fields=last-name or fields=first-name,last-name, never a name"
    requirement: "USER-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/UpdateProfileNameHandlerTests.cs#AFirstNameChangeRecordsOneEntryWithTheFieldNameOnly"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ARealNameChangeWritesOneAuditEntryWithFieldNamesOnly"
        status: pass
    human_judgment: false
  - id: D2
    description: "A save that changes nothing, a stale save, a vanished account and an invalid save write no audit entry"
    requirement: "USER-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/UpdateProfileNameHandlerTests.cs#ASaveThatChangesNothingWritesNoEntryAndKeepsTheVersion"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ASaveThatChangesNothingWritesNoAuditEntry"
        status: pass
    human_judgment: false
  - id: D3
    description: "AuditKey.Of and AuditActions.ProfileNameChanged exist and the catalog holds 22 valid, unique codes"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs#TheProfileNameChangeCodeIsInTheCatalog"
        status: pass
    human_judgment: false
  - id: D4
    description: "GetProfileHandler and UpdateProfileNameRequestValidator are covered by unit tests; the coverage gate passes (Application 99.5% line, Domain 100%)"
    requirement: "PROF-01"
    verification:
      - kind: other
        ref: "powershell -File tools/scripts/Invoke-CoverageGate.ps1"
        status: pass
    human_judgment: false
  - id: D5
    description: "audit-log.md documents the Phase 5 profile and staff events with the field-names-only rule"
    verification: []
    human_judgment: true
    rationale: "Documentation wording is not asserted by any test; the owner reviews it"

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 38: Profile name change audit Summary

**Every real profile name change now writes one `profile.name-changed` audit entry holding only field names (`fields=first-name,last-name`), in the same transaction as the save, with the shared `AuditKey.Of` helper and unit coverage for the 05-09 profile handlers.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-18T05:00:00Z
- **Completed:** 2026-10-18T05:10:00Z
- **Tasks:** 2
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `profile.name-changed` is recorded with target `User` and `AuditKey.Of(userId)`; the detail is `fields=first-name`, `fields=last-name` or `fields=first-name,last-name`. No old or new name reaches the log (D-40, T-05-23), asserted on the exact detail string in a unit and an integration test.
- A save of the same names, a stale save, a vanished account and an invalid form write no entry and do not call `SaveChangesAsync`.
- The name save and the audit entry commit together in `IUnitOfWork.InTransactionAsync`.
- `GetProfileHandler`, `UpdateProfileNameHandler` and `UpdateProfileNameRequestValidator` have unit tests; the coverage gate passes (Csps.Application 99.5% line, Csps.Domain 100% line and branch).
- `docs/operations/audit-log.md` has the new "Phase 5 profile and staff events" section.

## RED / GREEN / REFACTOR

- **RED (Task 1), `3db85a4`:** the handler unit tests and the `AuditActionsTests` additions fail at compile level (the handler has no six-argument constructor, `AuditActions.ProfileNameChanged` does not exist), the same compile-level RED the 05-09 summary records. The endpoint tests use the literal `profile.name-changed`, so they ran: `ARealNameChangeWritesOneAuditEntryWithFieldNamesOnly` and `ChangingBothNamesListsBothFieldsAndTwoSavesWriteTwoEntries` failed on the planned assertion (the entry list was `[]`, expected one or two entries); the two negative-case tests already held. The runner is Microsoft Testing Platform, which `gsd_run check tdd-red-evidence` does not read, so there is no machine verdict. Semantic assessment: the target tests executed and failed on the intended assertion, not on setup or load faults.
- **GREEN (Task 1), `4ab5ae4`:** `AuditKey`, the catalog code, the handler change and the doc section. All 15 handler tests, 6 catalog tests and 27 endpoint tests pass.
- **Task 2, `9405983`:** characterization tests. All 39 `*Profile*` unit tests passed on the first run against the 05-09 code, so there was no RED and no `fix(05-38)` commit was needed.
- **REFACTOR:** none.

## Task Commits

1. **Task 1 RED:** `3db85a4` (test) - audit the name change by field
2. **Task 1 GREEN:** `4ab5ae4` (feat) - profile.name-changed with field names only (D-40)
3. **Task 2:** `9405983` (test) - profile read and validator units (characterization)

**Plan metadata:** the docs commit that follows this file.

## Files Created/Modified

- `src/Csps.Application/Common/AuditKey.cs` - `AuditKey.Of(Guid)`
- `src/Csps.Application/Profile/UpdateProfileNameHandler.cs` - reads the current profile, saves and records the entry in one transaction
- `src/Csps.Domain/Auditing/AuditActions.cs` - `ProfileNameChanged` and its place in `All`
- `docs/operations/audit-log.md` - Phase 5 profile and staff events section
- `tests/Csps.Application.UnitTests/Profile/*` - three new test classes
- `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs` - 22 codes and the new code
- `tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs` - four audit cases

## Decisions Made

See `key-decisions`. In short: the field list comes from comparing the pre-save profile with the trimmed request, so the `IUserAccounts` port is untouched; only `Saved` writes an entry.

## Deviations from Plan

None - plan executed exactly as written. The existing catalog test `CatalogHoldsTheTwentyOneAuthCodes` asserted a count of 21; it was renamed and updated to 22 as part of the RED commit, which is the planned catalog change.

## Issues Encountered

None. One verification note: the handler now reads the profile once before the save (to name the changed fields) as well as once after it, so a name save does one extra read.

## Known Stubs

None.

## Threat Flags

None. The plan's T-05-23 (names in the append-only log) is mitigated and tested; no new endpoint, auth path or schema was added.

## User Setup Required

None - no external service configuration required.

## Verification Results

- `dotnet test --project tests/Csps.Application.UnitTests` (whole project, via the coverage gate): 420 passed.
- `*AuditActionsTests` 6 passed; `*ProfileEndpointTests` 27 passed; all `*Profile*` integration classes 31 passed; Domain unit tests 591 passed; architecture tests 217 passed; Infrastructure `*Audit*` 19 passed.
- `tools/scripts/Invoke-CoverageGate.ps1`: passed (Csps.Application 99.5% line, Csps.Domain 100%).
- Solution build: 0 warnings, 0 errors. Gitleaks on every staged diff: no leaks.
- Acceptance greps: `profile.name-changed` appears in `AuditActions.cs` and `audit-log.md`; `public static string Of(Guid` appears once in `AuditKey.cs`.

## Next Phase Readiness

Later Phase 5 handlers can call `AuditKey.Of` and follow the field-names-only rule documented in `audit-log.md`. Plan 05-43 (IN-02) replaces the older private `Key` copies.

## Self-Check: PASSED

- Files exist: AuditKey.cs, the three new unit test files, this SUMMARY.
- Commits `3db85a4`, `4ab5ae4`, `9405983` are ancestors of HEAD.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
