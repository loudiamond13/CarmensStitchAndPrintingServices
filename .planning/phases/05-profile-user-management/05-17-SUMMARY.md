---
phase: 05-profile-user-management
plan: 17
subsystem: api
tags: [roster, users, list, detail, search, paging, attribution, former-staff, user-01, user-08, sec-08, d-09, d-11]
created: 2026-10-18T02:25:00-05:00
updated: 2026-10-18T02:25:00-05:00
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-05 ApplicationUser columns (IsActive, ManagerLockedAtUtc, DeletedAtUtc, PendingEmail, CreatedById, UpdatedById, EditVersion); 05-09 IUserDirectory and UserDirectory; 05-10/05-11 AccountToken invitations; 05-15 pending-email state"
provides:
  - "GET /api/v1/users (Manager policy): { items, total, page, pageSize }, sorted by first name, last name, id; q, role, status, page, pageSize query"
  - "GET /api/v1/users/{id}: list fields plus hasPassword, managerLocked, pendingEmail, updatedAt, version, recordedBy and lastChangedBy as { id, name, formerStaff } or null"
  - "users.not-found (404, 'This user was deleted.') for a deleted or unknown person"
  - "ListUsersHandler, ListUsersRequest(+Validator), UserListItem, UserListResponse, UserListQuery, UserListPage, GetUserHandler, UserDetailResponse, UserDetailView, ActorRef, UserStatuses, InviteStates, UserErrors.NotFound, IUserDirectory.ListUsersAsync and GetUserAsync, UsersController"
  - "Test fixtures: UserFixtures (seeded roster in every state), ListUsersEndpointTests, GetUserEndpointTests, ListUsersHandlerTests, GetUserHandlerTests, UserStatusesTests"
affects: [05-20 roster page, 05-25 Edit panel, 05-18 Details tab, 05-31 email review, 05-33 audit log]

actuals:
  tokens: 24700
  tasks: 3
  commits: 5
plan_head_before: 833e7e39927ea31e566d300df66ba20c44ae4125
plan_head_after: e470a74840dc55b6d1771090647b54539c34b4fa

tech-stack:
  added: []
  patterns:
    - "Roster reads are one AsNoTracking query: filters in SQL, display status and invite state computed by one shared function (UserStatuses.Of, InviteStates.Of) from raw flags, so the filter and the badge cannot drift apart"
    - "LIKE search escapes backslash, percent, underscore and bracket with a backslash escape character, so typed wildcards match themselves"
    - "Actor names are read from the actors' own rows in a second small query; a soft-deleted actor keeps the name and is flagged formerStaff (no snapshot)"
    - "List query parameters are explicit action arguments with lowercase names, so the OpenAPI contract says q, role, status, page, pageSize and Application stays free of MVC attributes"

key-files:
  created:
    - src/Csps.Application/Users/ListUsersHandler.cs
    - src/Csps.Application/Users/ListUsersRequest.cs
    - src/Csps.Application/Users/ListUsersRequestValidator.cs
    - src/Csps.Application/Users/UserListResponse.cs
    - src/Csps.Application/Users/UserStatuses.cs
    - src/Csps.Application/Users/GetUserHandler.cs
    - src/Csps.Application/Users/UserDetailResponse.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - tests/Csps.Server.IntegrationTests/Users/UserFixtures.cs
    - tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs
    - tests/Csps.Application.UnitTests/Users/ListUsersHandlerTests.cs
    - tests/Csps.Application.UnitTests/Users/GetUserHandlerTests.cs
    - tests/Csps.Application.UnitTests/Users/UserStatusesTests.cs
  modified:
    - src/Csps.Application/Ports/IUserDirectory.cs
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Infrastructure/Identity/UserDirectory.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "Response status is lowercase active|inactive|locked and inviteState is none|pending|expired, matching the filter values and the UI-SPEC URL params; role stays Admin|Manager as on the profile"
  - "A page above 100000 is a 400 (new cap on top of 'from 1'), so (page - 1) * pageSize can never overflow an int (CWE-190)"
  - "Search length is checked on the raw q (ListQueryRules.SearchText), the same as every other list; blank q after trimming means no search"
  - "Query parameters are action arguments, not a bound record, so the contract names are lowercase and Application has no MVC reference"
  - "Invite state is pending when any unused, unrevoked, unexpired Invitation token exists, expired otherwise, for an account with no password"

patterns-established:
  - "Detail reads return null for a soft-deleted row, and the handler turns null into the one users.not-found answer"

requirements-completed: [USER-01, USER-08, SEC-08]

coverage:
  - id: D1
    description: "USER-01: a Manager lists staff sorted by first name, last name, id with role and status filters, escaped search, paging, the remainder on the last page, an empty list with the true total past it, and 400 for a bad filter, page, size or an over-long search"
    requirement: "USER-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#AManagerListsTheStaffByFirstNameAndDeletedPeopleNeverShow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#APercentUnderscoreBracketOrBackslashInTheSearchMatchesOnlyItself"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#PagesSplitTheRowsAndThePageAfterTheLastIsEmptyWithTheTrueTotal"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#EqualNamesAreOrderedByIdSoPagingNeverRepeatsOrDropsARow"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/ListUsersHandlerTests.cs#ABadRoleStatusPageOrSizeIsA400NamingTheFieldAndTheDirectoryIsNeverAsked"
        status: pass
    human_judgment: false
  - id: D2
    description: "Status precedence (Inactive, then Locked, then Active), failed-password lockout not Locked, and invite state pending or expired for an account with no password"
    requirement: "USER-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#TheStatusFilterMatchesTheStatusShownWithInactiveBeforeLockedBeforeActive"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#EachRowCarriesItsFieldsRoleStatusAndInviteState"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/UserStatusesTests.cs#InactiveBeatsLockedAndLockedBeatsActive"
        status: pass
    human_judgment: false
  - id: D3
    description: "USER-08 / T-05-47: an Admin gets 403 and an anonymous caller 401 on both Users actions (matrix rows)"
    requirement: "USER-08"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ListUsersEndpointTests.cs#AnAdminIsRefusedWith403"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#AnAdminIsRefusedWith403AndAnAnonymousCallerWith401"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-09: soft-deleted users are never listed, and the detail of a deleted or unknown person is 404 users.not-found 'This user was deleted.'"
    requirement: "USER-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#ADeletedOrUnknownUserIsA404WithTheSameWords"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/GetUserHandlerTests.cs#ADeletedOrUnknownPersonIsTheOneNotFoundAnswer"
        status: pass
    human_judgment: false
  - id: D5
    description: "SEC-08 / D-08 / D-11: the detail adds hasPassword, managerLocked, pendingEmail, updatedAt, version, and recordedBy and lastChangedBy read from the actors' own rows; a deleted actor keeps the name and is formerStaff; a rename shows at once; a pre-Phase-5 account has null actors"
    requirement: "SEC-08"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#AManagerReadsEveryDetailFieldAndTheVersion"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#ADeletedRecorderKeepsTheirNameAndIsMarkedFormerStaff"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#ARecorderWhoRenamesThemselfShowsUnderTheNewName"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs#AnAccountFromBeforePhase5HasNoRecorderAndNoLastChanger"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 17: Roster read API Summary

Managers can now page, search and filter the staff roster and open one person with Recorded by and Last changed by, using two Manager-only endpoints built on the existing `IUserDirectory`.

## Accomplishments

- `GET /api/v1/users`: one AsNoTracking query, soft-deleted people excluded, sorted first name, last name, id; role and status filters; escaped LIKE search over first name, last name, "first last" and email; page and pageSize (1 to 100, default 20); the page past the last returns an empty list with the true total.
- `GET /api/v1/users/{id}`: all list fields plus `hasPassword`, `managerLocked`, `pendingEmail`, `updatedAt`, `version`, and `recordedBy` / `lastChangedBy` as `{ id, name, formerStaff }` read from the actor's own row (null for System). A deleted or unknown id is 404 `users.not-found`.
- Authorization: `[Authorize(Policy = Policies.Manager)]` on the controller; matrix rows for both routes (anonymous 401, Admin 403, Manager 200 / 404).
- Contract: OpenAPI snapshot and `web/src/types/api.generated.ts` refreshed; `npm --prefix tools/openapi-gen run check` passes.

## TDD record

- **Task 1 RED** (`a530360`, 17 tests): every roster test failed with `404` where `200`, `401` or `403` or `400` was planned (the route did not exist, so the fallback answered). The fixtures ran and seeded all eleven people before the first request, so no failure was a setup fault. Semantic assessment: the target tests executed and failed on the planned status assertions. The `check tdd-red-evidence` classifier takes TAP, JUnit, swift-testing or unittest reports; this repo's dotnet MTP console output is none of those, so RED was judged by hand from the real console output.
- **Task 1 GREEN** (`b74e5e9`): 17 of 17 pass; Authorization suite (144 tests) and the OpenAPI snapshot test pass.
- **Task 2 RED** (`85267e2`, 8 tests): all failed on 404 where 200 or 403 was planned, and on the missing `users.not-found` code. Semantic assessment as above.
- **Task 2 GREEN** (`3799201`): 8 of 8 pass.
- **Task 3** (`e470a74`): the handler, validator and status tests all passed the first time they ran, because Tasks 1 and 2 had already implemented every rule. Committed as characterization tests (no RED), as the plan allows.
- No REFACTOR commit was needed.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 843 passed.
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*Users*"`: 56 passed.
- Coverage gate: Csps.Domain 100% line and 100% branch; Csps.Application 99.6% line (rule 95%). Passed.
- Architecture tests 217 passed; Infrastructure integration tests 475 passed, 1 skipped (pre-existing); web `typecheck` clean; `npm --prefix tools/openapi-gen run check` clean. Build has 0 warnings.
- Acceptance greps: `Policies.Manager` in UsersController, `EF.Functions.Like` in UserDirectory, `"/api/v1/users"` in the matrix, `users.not-found` once in UserErrors, `FormerStaff` in UserDetailResponse, `ActorRef` in `api.generated.ts`: all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Page upper bound**
- **Found during:** Task 1 (validator design)
- **Issue:** The plan says only "page from 1". With no upper bound, `(page - 1) * pageSize` overflows an int for a huge page (CWE-190), which would surface as a 500.
- **Fix:** The validator rejects a page above 100000 with "Use a page from 1 to 100000." and the cap is covered by unit tests.
- **Files modified:** `src/Csps.Application/Users/ListUsersRequestValidator.cs`
- **Commit:** b74e5e9

**2. [Rule 3 - Blocking] Validator registration lives in AuthRegistration**
- **Found during:** Task 1
- **Issue:** The plan lists only `ApplicationRegistration.cs`, but every request validator in this codebase is registered as a singleton in `AuthRegistration.cs`; the handler would not resolve without it.
- **Fix:** Registered `IValidator<ListUsersRequest>` there and the handlers in `ApplicationRegistration.cs`.
- **Files modified:** `src/Csps.Server/Composition/AuthRegistration.cs`
- **Commit:** b74e5e9

**3. [Rule 1 - Bug] Query parameter names in the contract**
- **Found during:** Task 1 (OpenAPI refresh)
- **Issue:** Binding the record with `[FromQuery]` published the parameters as `Q`, `Role`, `Status`, `Page`, `PageSize`, not the lowercase names the web will send.
- **Fix:** The action takes explicit `q`, `role`, `status`, `page`, `pageSize` arguments and builds the request; the contract now matches the plan and the UI-SPEC.
- **Files modified:** `src/Csps.Server/Controllers/UsersController.cs`
- **Commit:** b74e5e9

**4. [Plan addition] Small extra files**
- `UserStatuses.cs` (status and invite text plus their precedence functions, shared by list and detail) and `UserStatusesTests.cs` were added; the plan did not name them. They keep one definition of the precedence for both reads.

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug), 1 small addition. **Impact:** none on scope; the contract and behaviour match the plan's truths.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. Both routes and their trust boundaries are already in the plan's threat model (T-05-47 to T-05-50).

## Issues Encountered

- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows as modified (line endings only, from an earlier plan). It was left alone as instructed.
- The detail endpoint returns the account's `version` as the profile does; the Edit panel (05-25) will send it back on save.

## Next Phase Readiness

Ready for 05-18, 05-20 (roster page) and 05-25 (Edit panel): the list and detail contracts are final and typed in `web/src/types/api.generated.ts`.

## Self-Check: PASSED

All created files exist on disk, and commits a530360, b74e5e9, 85267e2, 3799201 and e470a74 are on the branch.
