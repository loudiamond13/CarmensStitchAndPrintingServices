---
phase: 05-profile-user-management
plan: 41
subsystem: api
tags: [audit-log, people-list, filters, manager-only, former-staff, openapi, docs, audit-02, d-11, d-26, d-29, d-40]
created: "2026-10-18T11:51:00-05:00"
updated: "2026-10-18T11:51:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-29 IAuditLogReader, AuditLogReader, AuditLogController (Manager policy), ActorRef-shaped people with formerStaff"
provides:
  - "GET /api/v1/audit-log/people (Manager, never cached): AuditPerson[] { id, name, formerStaff } for every account ever recorded; active and inactive staff first by name, then former staff by name; Admin 403, anonymous 401"
  - "IAuditLogReader.ListPeopleAsync, AuditPerson, ListAuditPeopleHandler, ListAuditPeople endpoint (generated TS type and OpenAPI snapshot refreshed)"
  - "docs/operations/audit-log.md section 'Viewing the log'"
affects: [05-33 Audit Log page (Done by and Done to filters), 05 security review]

actuals:
  tokens: 5200
  tasks: 2
  commits: 3
plan_head_before: c713f32269fd053f7483f857124996f10a3692bc
plan_head_after: 65cbd4b94048b1c04e9e54fe45f1bb46e6979ede

tech-stack:
  added: []
  patterns:
    - "The people list reuses the audit reader port: one more read-only AsNoTracking query that returns ids and names only, ordered in SQL (current staff first, former staff last, then first name, last name, id)"

key-files:
  created:
    - src/Csps.Application/Audit/ListAuditPeopleHandler.cs
  modified:
    - src/Csps.Application/Ports/IAuditLogReader.cs
    - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
    - src/Csps.Server/Controllers/AuditLogController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs
    - tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The endpoint returns a bare array of AuditPerson (not a wrapped object), matching the shape 05-33's plan expects (AuditPerson[] { id, name, formerStaff })."
  - "Order is decided in SQL: DeletedAtUtc IS NOT NULL (false first), then FirstName, LastName, Id. Inactive staff sort with active staff, as the plan's truth says."
  - "AuditPerson sits in the port file next to the other reader records, so no extra file was needed; the handler is a thin pass-through returning Result.Success."

requirements-completed: [AUDIT-02]

coverage:
  - id: D1
    description: "A Manager gets every person ever recorded (active, inactive, former staff) as { id, name, formerStaff }: active and inactive by name first, then former staff by name; no email is sent"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#APeopleListOffersEveryoneEverRecordedActiveAndInactiveFirstThenFormerStaffEachByName"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs#ThePeopleHandlerPassesTheReadersListThroughInItsOrder"
        status: pass
    human_judgment: false
  - id: D2
    description: "The people list is Manager only: Admin 403, anonymous 401, and the authorization matrix has the row"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#APeopleListIsRefusedToAnAdminWith403AndToAnAnonymousCallerWith401"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix, GET /api/v1/audit-log/people)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The OpenAPI snapshot and the generated TypeScript types include the new operation"
    requirement: "AUDIT-02"
    verification:
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check; OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/operations/audit-log.md explains in plain words how a Manager reads the log: Manager only, default 7 days and the 8-month floor, filters, done-by rule, row contents, no export, details hold field names and role values only"
    requirement: "AUDIT-02"
    verification: []
    human_judgment: true
    rationale: "Documentation wording is a judgment call for the owner to read; a grep only proves the section exists."

duration: 10min
completed: 2026-10-18
---

# Phase 5 Plan 41: Audit Log People List and Viewer Docs Summary

**`GET /api/v1/audit-log/people` gives Managers every person ever recorded (current staff first, former staff last, each by name) for the Done by and Done to filters, with the matrix row, refreshed OpenAPI contract and a "Viewing the log" section in the audit docs.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-18T11:41:00-05:00 (approximate)
- **Completed:** 2026-10-18T11:51:00-05:00
- **Tasks:** 2
- **Files modified:** 11 (1 created)

## Accomplishments

- A Manager-only endpoint lists every `AspNetUsers` row as `{ id, name, formerStaff }`, ordered in SQL so current (active and inactive) staff come first by name and deleted people follow by name. Only ids and names leave the database (T-05-104: no emails).
- The authorization matrix row `GET /api/v1/audit-log/people` (401, 403, 200) is in place; the full Authorization namespace (186 tests) and the architecture tests (217) pass.
- The OpenAPI snapshot and `web/src/types/api.generated.ts` were refreshed (operation `ListAuditPeople`), and `npm --prefix tools/openapi-gen run check` passes.
- `docs/operations/audit-log.md` has a "Viewing the log" section covering access, the default 7-day range and 8-month floor, filters, the done-by rule, what each row shows, no export (D-29) and details limited to field names and role values (D-40).
- The coverage gate passes (Domain 100% line and branch, Application 99.7% line).

## Task Commits

1. **Task 1: Tracer, people list for the audit filters** - `14b4292` (test, RED), `361f64c` (feat, GREEN)
2. **Task 2: How Managers read the audit log** - `65cbd4b` (docs)

**Plan metadata:** added by the closing docs commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## TDD Gate Compliance

- **RED (`14b4292`):** two endpoint tests in `AuditLogEndpointTests` failed on the planned assertions: the route did not exist, so the Manager call returned 404 where 200 was expected, and the Admin and anonymous calls did not return 403 and 401. The other 17 tests in the class passed. `semanticAssessment`: the target tests executed and failed for the intended reason; there was no compile, discovery or fixture fault. The xUnit MTP report is not a format `gsd check tdd-red-evidence` supports, so this inspection is the evidence (same as 05-26, 05-27 and 05-29).
- **GREEN (`361f64c`):** `AuditLogEndpointTests` 19 of 19 pass, `ListAuditLogHandlerTests` 61 of 61 pass.
- **Unit test placement:** the handler unit test names a new type, so it cannot compile in a RED commit without making the run INVALID_RED. It was written in the GREEN commit (same practice as 05-29); the endpoint tests were RED first.
- No REFACTOR commit was needed.

## Files Created/Modified

- `src/Csps.Application/Ports/IAuditLogReader.cs` - `ListPeopleAsync` and the `AuditPerson` record
- `src/Csps.Infrastructure/Auditing/AuditLogReader.cs` - the ordered, untracked people query
- `src/Csps.Application/Audit/ListAuditPeopleHandler.cs` - pass-through use case
- `src/Csps.Server/Controllers/AuditLogController.cs` - `[HttpGet("people")]` action (`ListAuditPeople`)
- `src/Csps.Server/Composition/ApplicationRegistration.cs` - handler registration
- `tests/.../AuthorizationMatrix.cs`, `AuditLogEndpointTests.cs`, `ListAuditLogHandlerTests.cs` - matrix row and new tests
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract
- `docs/operations/audit-log.md` - "Viewing the log"

## Decisions Made

- Bare array response, matching what the Audit Log page plan (05-33) expects.
- Ordering done in SQL (former last, then first name, last name, id) so it is stable and needs no handler logic.
- `AuditPerson` lives beside the other reader records in the port file.

## Deviations from Plan

None - plan executed exactly as written. (A CA1861 analyzer error in the first draft of the new test was fixed before the RED run, so it never reached a commit.)

## Issues Encountered

None. `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows as modified (line endings only, from an earlier plan) and was left alone as instructed.

## Known Stubs

None.

## Threat Flags

None. The new endpoint is the one T-05-104 covers: Manager policy on the controller, matrix row for anonymous, Admin and Manager, names only and no emails.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-33 (Audit Log page) can call the generated `ListAuditPeople` operation to fill Done by and Done to. The list already puts former staff last; the page adds the "(former staff)" label (D-47).
- Owner wording review (D-48): the "Viewing the log" section is plain-words documentation for the owner to read in 05-37.

## Self-Check: PASSED

- `src/Csps.Application/Audit/ListAuditPeopleHandler.cs` exists; `docs/operations/audit-log.md` has one "Viewing the log" heading.
- Commits `14b4292`, `361f64c` and `65cbd4b` are on the branch; the RED commit precedes the GREEN commit.
- Acceptance criteria: matrix row count 1, `ListPeopleAsync` in the port 1, "Viewing the log" count 1.
- Verification: `*Audit*` integration tests 19 of 19, Authorization 186 of 186, architecture 217 of 217, OpenAPI snapshot test, `npm --prefix tools/openapi-gen run check`, coverage gate, and `dotnet build -warnaserror` (0 warnings) all pass.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
