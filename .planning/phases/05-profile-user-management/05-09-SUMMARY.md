---
phase: 05-profile-user-management
plan: 09
subsystem: api
tags: [profile, identity, edit-version, optimistic-concurrency, 409, openapi, integration-tests]
created: 2026-10-17T22:06:00-05:00
updated: 2026-10-17T22:06:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-05: ApplicationUser.EditVersion concurrency token, CreatedAtUtc, PendingEmail columns"
provides:
  - "GET and PUT /api/v1/profile for Staff: read own profile (with edit version), change own first and last name"
  - "SEC-07 server half: EditVersion checked in the UPDATE's WHERE, rotated on a staff edit, 409 edit.stale on any other version"
  - "EditErrors.Stale, IUserDirectory/ProfileView, IUserAccounts.UpdateNameAsync/EditResult/EditOutcome, ConcurrentRequests.SendTogetherAsync"
affects: [05-10, 05-13, 05-23, 05-38, every later aggregate with an edit form]

actuals:
  tokens: 12500
  tasks: 2
  commits: 4
plan_head_before: 1e70fd874b3010a117a39cec16dc0387fd02519b
plan_head_after: 99decea969b7d2272ae3c2c4a9f67ce5a70bf9c0

tech-stack:
  added: []
  patterns:
    - "Versioned edit: set EditVersion's OriginalValue to the client version, rotate it, let Identity's UpdateAsync report ConcurrencyFailure, then reload and re-check the version (stale) or retry (bookkeeping stamp)"
    - "Two-writer test: ConcurrentRequests.SendTogetherAsync releases two requests from one gate"

key-files:
  created:
    - src/Csps.Application/Common/EditErrors.cs
    - src/Csps.Application/Ports/IUserDirectory.cs
    - src/Csps.Application/Profile/GetProfileHandler.cs
    - src/Csps.Application/Profile/UpdateProfileNameHandler.cs
    - src/Csps.Application/Profile/UpdateProfileNameRequest.cs
    - src/Csps.Application/Profile/UpdateProfileNameRequestValidator.cs
    - src/Csps.Application/Profile/ProfileResponse.cs
    - src/Csps.Infrastructure/Identity/UserDirectory.cs
    - src/Csps.Server/Controllers/ProfileController.cs
    - tests/Csps.Testing/ConcurrentRequests.cs
    - tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Profile/ProfileConcurrencyTests.cs
  modified:
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The stored version is compared to the client version before the same-names shortcut, so re-sending a successful save with its old version is a 409 while a save of unchanged names with the current version is a 200 that does not rotate"
  - "UpdateNameAsync reloads and re-checks after a ConcurrencyFailure: a changed EditVersion is Stale, an unchanged one means only the bookkeeping stamp moved and the save retries (up to 16 times), so failed-password counting never causes a false 409"
  - "Name length is string.Trim().Length (UTF-16 code units), matching the browser string length the 05-13 zod mirror will use"

patterns-established:
  - "Profile routes carry no user id; handlers read IRequestContext.UserId only (CWE-639)"
  - "Request validators are registered as singletons in AuthRegistration next to the other IValidator<T> entries"

requirements-completed: [PROF-01, SEC-07]

coverage:
  - id: D1
    description: "A signed-in Admin or Manager reads GET /api/v1/profile with id, names, email, role, pendingEmail, memberSince and version, never cached"
    requirement: PROF-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#AnAdminReadsTheirOwnProfile"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ReadAndSaveAreNeverCached"
        status: pass
    human_judgment: false
  - id: D2
    description: "PUT /api/v1/profile saves trimmed names with the loaded version, rotates it, and the next GET shows them"
    requirement: PROF-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#SavingTheNameWithTheLoadedVersionShowsOnTheNextReadAndRotatesTheVersion"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#StoredNamesAreTrimmed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blank, over-100 (UTF-16 units), missing and malformed-version inputs answer 400 with the exact field messages; the same names answer 200 without rotating"
    requirement: PROF-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ABlankNameIsAFieldError"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#NameLengthCountsUtf16UnitsAfterTrimming"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#AMalformedVersionIsTheSameFieldError"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ASaveWithTheSameNamesAnswersOkWithoutRotatingTheVersion"
        status: pass
    human_judgment: false
  - id: D4
    description: "A stale, random or repeated version answers 409 edit.stale with the exact detail and changes nothing; failed-password bookkeeping does not cause a 409"
    requirement: SEC-07
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#ASaveFromAnOutOfDateFormIsRefusedAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#RepeatingASuccessfulSaveWithItsOldVersionIsRefused"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#AFailedPasswordCountBetweenReadAndSaveDoesNotCauseAConflict"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two PUTs sent together with the same version give exactly one 200 and one 409 in 20 rounds, and the stored name is the winner's"
    requirement: SEC-07
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileConcurrencyTests.cs#TwoSavesWithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
    human_judgment: false
  - id: D6
    description: "The profile acts only on the token's user; anonymous is 401; the authorization matrix has GET and PUT rows"
    requirement: PROF-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileEndpointTests.cs#SavingMyNameNeverTouchesAnotherAccount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 09: Profile Read and Name Save with the Edit Version Summary

**GET and PUT /api/v1/profile with a dedicated EditVersion concurrency token (409 edit.stale on any other version), plus the shared two-writer test helper proven by 20 concurrent rounds.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-17T21:43:00-05:00
- **Completed:** 2026-10-17T22:06:00-05:00
- **Tasks:** 2 (Task 1 tracer, Task 2)
- **Files modified:** 20 (12 created, 8 modified)

## Accomplishments

- Staff read their own profile (names, email, role, pendingEmail, memberSince, version) and change their name with the version the form was opened with; the save rotates the version.
- A stale, random or repeated version is refused with 409 `edit.stale` and the exact D-20 text, changes nothing, and Identity bookkeeping (failed-password count, breach mark) never causes a false 409.
- `ConcurrentRequests.SendTogetherAsync` is the reusable two-writer helper; two simultaneous saves give exactly one 200 and one 409 in 20 rounds, repeated 4 times without a flake.
- Authorization matrix rows, the OpenAPI snapshot and `api.generated.ts` (`ProfileResponse`) are refreshed.

## RED / GREEN / REFACTOR

- **RED (Task 1):** `ProfileEndpointTests` (23 cases) ran against a host with no `/api/v1/profile`. All 23 failed on the planned assertions (status 200/400/401/409 expected, 404 observed; `code`/`errors` properties absent). The test runner here is Microsoft Testing Platform, not one of the report formats `gsd_run check tdd-red-evidence` reads (TAP, JUnit, swift-testing, unittest), so no machine verdict was possible; the semantic assessment is that the target tests executed and failed on the intended assertions, not on setup or load faults.
- **RED (Task 2):** `ProfileConcurrencyTests` was written against `ConcurrentRequests.SendTogetherAsync` before it existed, as the plan specifies, so RED is a compile failure (`CS0103`). This is a compile-level RED by design: the two-writer behavior itself already held after Task 1, so no assertion-level RED existed for it.
- **GREEN:** `dd76580` (23/23 pass, then the full integration suite 689/689) and `99decea` (concurrency test passes, 4 consecutive runs).
- **REFACTOR:** none needed.

## Task Commits

1. **Task 1: tracer, profile read and name save with the edit version**
   - `caa34e5` test (RED)
   - `dd76580` feat (GREEN)
2. **Task 2: two writers, one winner, reusable helper**
   - `0157fba` test (RED, compile)
   - `99decea` feat (GREEN)

Tracer feedback gate: the Task 1 `<verify>` commands (ProfileEndpointTests, the Authorization suite, `npm --prefix tools/openapi-gen run check`) were re-run end to end and passed before Task 2 expanded.

## Files Created/Modified

- `src/Csps.Server/Controllers/ProfileController.cs` - GET and PUT `/api/v1/profile`, Staff policy, no-store, no id in the route
- `src/Csps.Application/Profile/*` - `GetProfileHandler`, `UpdateProfileNameHandler`, request, validator and `ProfileResponse`
- `src/Csps.Application/Common/EditErrors.cs` - shared SEC-07 stale-save error
- `src/Csps.Application/Ports/IUserDirectory.cs` - profile read port and `ProfileView`
- `src/Csps.Application/Ports/IUserAccounts.cs` - `UpdateNameAsync`, `EditResult`, `EditOutcome`
- `src/Csps.Infrastructure/Identity/UserAccounts.cs` - versioned name update (OriginalValue, rotate, reload and re-check)
- `src/Csps.Infrastructure/Identity/UserDirectory.cs` - untracked profile read with the single role
- `tests/Csps.Testing/ConcurrentRequests.cs` - two-writer barrier helper
- `tests/Csps.Server.IntegrationTests/Profile/*` - endpoint and concurrency tests
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`, `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - contract and matrix

## Decisions Made

- The stored version is compared to the client version before the same-names shortcut. This satisfies both "re-sending a successful save with its old version is 409" and "a save with equal names and the current version is 200 without rotating".
- After a `ConcurrencyFailure`, `UpdateNameAsync` reloads the row: a changed `EditVersion` is Stale; an unchanged one means only Identity's `ConcurrencyStamp` moved (bookkeeping), so the save retries (at most 16 times).
- Name length is `Trim().Length` (UTF-16 code units), the browser measure, so the 05-13 zod mirror will agree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Port registration and validator registration live in existing composition files**
- **Found during:** Task 1
- **Issue:** The plan lists `src/Csps.Infrastructure/DependencyInjection.cs` for the port registration, but `IUserAccounts` is registered in `IdentityRegistration.cs`, and request validators are registered in `AuthRegistration.cs`.
- **Fix:** Registered `IUserDirectory` in `IdentityRegistration.cs` next to `IUserAccounts`, and `IValidator<UpdateProfileNameRequest>` in `AuthRegistration.cs` next to the other validators. `DependencyInjection.cs` is unchanged.
- **Files modified:** `src/Csps.Infrastructure/Identity/IdentityRegistration.cs`, `src/Csps.Server/Composition/AuthRegistration.cs`
- **Committed in:** `dd76580`

**2. [Rule 2 - Missing critical] Retry on bookkeeping concurrency failure**
- **Found during:** Task 1
- **Issue:** Identity's `ConcurrencyStamp` is also a concurrency token, so a failed-password write landing between load and update would fail the save and look like a stale edit.
- **Fix:** Reload and re-check `EditVersion` after a `ConcurrencyFailure`; retry only when the version is still the client's. Covered by `AFailedPasswordCountBetweenReadAndSaveDoesNotCauseAConflict` and the 20-round race test.
- **Files modified:** `src/Csps.Infrastructure/Identity/UserAccounts.cs`
- **Committed in:** `dd76580`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both are internal to the planned design. No scope change.

## Issues Encountered

- A shell heredoc containing an apostrophe failed once while writing files; the files were written with the Write tool instead. No effect on the repository.

## Known Stubs

None.

## Threat Flags

None. The new endpoint is covered by the plan's threat model (T-05-21 no id in the route and a test that another account is untouched, T-05-22 version in the UPDATE and the 20-round test, T-05-24 names stored as text).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-38 adds the D-40 audit entry, `AuditKey.Of` and the handler unit tests (the Csps.Application coverage gate runs there; the new handlers and validator have no Application unit tests yet by design).
- 05-13 (web name form) can send `version` from `GET /api/v1/profile` and show the stale banner on `edit.stale`.
- 05-23 and later aggregates reuse `EditErrors.Stale`, the OriginalValue pattern and `ConcurrentRequests.SendTogetherAsync`.

## Self-Check: PASSED

- Created files exist (checked on disk); commits `caa34e5`, `dd76580`, `0157fba`, `99decea` are on the branch.
- Plan verification: `dotnet test` on Server integration (689 passed), Application unit (376), Domain unit (590), `LayerTests` (8), `npm --prefix tools/openapi-gen run check` pass; `dotnet build` has 0 warnings and 0 errors.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*
