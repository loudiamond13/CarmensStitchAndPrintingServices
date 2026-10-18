---
phase: 05-profile-user-management
plan: 11
subsystem: infra
tags: [ef-core, savechanges-interceptor, attribution, sec-08, audit, mass-assignment]
created: 2026-10-17T22:32:00-05:00
updated: 2026-10-17T22:32:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-05: ApplicationUser CreatedById/CreatedAtUtc/UpdatedById/UpdatedAtUtc/EditVersion columns; 05-09: PUT /api/v1/profile rotating EditVersion"
provides:
  - "RecordStampInterceptor: the one SEC-08 stamping point (Created* on add, Updated* on a staff edit) from the token's sub and TimeProvider"
  - "IAttributedRecord and IEditVersioned (Domain/Common): the contract every later aggregate implements to be stamped"
  - "ICurrentActor port, HttpCurrentActor (Server, singleton over IHttpContextAccessor) and the internal NoCurrentActor default for tests and tools"
affects: [05-12, 05-14, 05-23, every later aggregate that records who created or changed it]

actuals:
  tokens: 6500
  tasks: 2
  commits: 3
plan_head_before: 4d7026601747583c4dfe10aee3330bbe862b267c
plan_head_after: e6fc0c2b04c3c2cd4e36dc0b42fd26b754d30be5

tech-stack:
  added: []
  patterns:
    - "Stamp in a SaveChangesInterceptor, never in handlers: compare EditVersion OriginalValue with CurrentValue (never IsModified) so Identity bookkeeping does not count as an edit"
    - "Singleton actor accessor read per call from IHttpContextAccessor (the context factory is built from the root provider); a no-actor default is TryAdd-registered for plain service collections"

key-files:
  created:
    - src/Csps.Domain/Common/IAttributedRecord.cs
    - src/Csps.Domain/Common/IEditVersioned.cs
    - src/Csps.Application/Ports/ICurrentActor.cs
    - src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs
    - src/Csps.Infrastructure/Persistence/NoCurrentActor.cs
    - src/Csps.Server/Http/HttpCurrentActor.cs
    - tests/Csps.Server.IntegrationTests/Profile/ProfileAttributionTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/RecordStampInterceptorTests.cs
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Identity/ApplicationUser.cs
    - src/Csps.Server/Program.cs

key-decisions:
  - "Created* is always overwritten on an added record (a null actor writes null, read as System), so preset values can never survive; Updated* keeps a server-set UpdatedById only when there is no signed-in user"
  - "AddCspsPersistence also TryAdds TimeProvider.System, ICurrentActor (NoCurrentActor) and the interceptor, so tools and tests that call it alone still resolve the context factory"
  - "The stamped instant is converted to offset zero (ToUniversalTime) even though TimeProvider.GetUtcNow is UTC by contract, because a custom provider could report another offset"
  - "NoCurrentActor lives in its own file (one type per file) instead of inside RecordStampInterceptor.cs"

patterns-established:
  - "A new aggregate is stamped by implementing IAttributedRecord (and IEditVersioned if it has an edit version); no handler code"

requirements-completed: [SEC-08]

coverage:
  - id: D1
    description: "Saving a profile name records the signed-in caller and the server clock as the last changer, ignoring forged createdById, createdAtUtc, updatedById and updatedAtUtc members in the body"
    requirement: SEC-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileAttributionTests.cs#ASavedNameRecordsTheCallerAndTheServerClockWhateverTheBodyClaims"
        status: pass
    human_judgment: false
  - id: D2
    description: "Identity bookkeeping (a wrong password) never stamps Updated*; UpdatedBy/At stay null until the first staff edit and move on every later one"
    requirement: SEC-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileAttributionTests.cs#AWrongPasswordOnTheSameAccountChangesNeitherUpdatedColumn"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ProfileAttributionTests.cs#AFirstEditSetsUpdatedAndASecondEditMovesItForward"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stamping rules in isolation: create, preset overwrite, staff edit, bookkeeping write, no-actor create and edit, offset-zero instants"
    requirement: SEC-08
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/RecordStampInterceptorTests.cs (8 tests)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 11: Server-side attribution (SEC-08) Summary

**One EF SaveChanges interceptor stamps CreatedBy/At and UpdatedBy/At from the access token's sub and TimeProvider for every IAttributedRecord, skipping Identity bookkeeping, and a forged-fields integration test proves a client cannot set them.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-17T22:17:00-05:00 (approximate)
- **Completed:** 2026-10-17T22:32:00-05:00
- **Tasks:** 2 (a tracer and a characterization task)
- **Files modified:** 11 (8 created, 3 changed)

## Accomplishments

- `RecordStampInterceptor` is the single SEC-08 stamping point. Added records get Created*; modified ones get Updated*. For an `IEditVersioned` record (ApplicationUser), Updated* is written only when `EditVersion`'s original and current values differ, so failed-password counting, rehash and token bookkeeping never stamp (research Pitfall 2, T-05-28).
- `ICurrentActor` (Application port) is implemented by the singleton `HttpCurrentActor`, which reads the `sub` claim from `IHttpContextAccessor` on every call and never caches it (T-05-29). Plain service collections get `NoCurrentActor`, so those writes read as System.
- With no signed-in user (anonymous link flows such as 05-14), a server-set `UpdatedById` in the same save is kept and `UpdatedAtUtc` still comes from the clock.
- The forged-fields test sends `createdById`, `createdAtUtc`, `updatedById` and `updatedAtUtc` on `PUT /api/v1/profile` and shows the row names the caller and the server clock, with `CreatedById` still null (T-05-27).

## Task Commits

1. **Task 1: Tracer, forged attribution ignored** - `8f9f55d` (test, RED), `9ae0d78` (feat, GREEN)
2. **Task 2: Stamping rules in isolation** - `e6fc0c2` (test, characterization of Task 1 GREEN)

**Plan metadata:** the `docs(05-11)` commit that holds this file.

## Files Created/Modified

- `src/Csps.Domain/Common/IAttributedRecord.cs` - the four attribution getters every stamped record exposes
- `src/Csps.Domain/Common/IEditVersioned.cs` - the edit-version getter the stamp uses to tell a staff edit from bookkeeping
- `src/Csps.Application/Ports/ICurrentActor.cs` - the singleton-safe signed-in user port
- `src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs` - the stamping interceptor
- `src/Csps.Infrastructure/Persistence/NoCurrentActor.cs` - the null actor default
- `src/Csps.Server/Http/HttpCurrentActor.cs` - actor from the `sub` claim
- `src/Csps.Infrastructure/DependencyInjection.cs` - registers the interceptor next to `OutboxSignalInterceptor`
- `src/Csps.Infrastructure/Identity/ApplicationUser.cs` - implements both interfaces
- `src/Csps.Server/Program.cs` - registers `HttpCurrentActor` before `AddInfrastructure`
- `tests/Csps.Server.IntegrationTests/Profile/ProfileAttributionTests.cs`, `tests/Csps.Infrastructure.IntegrationTests/Persistence/RecordStampInterceptorTests.cs`

## Decisions Made

See `key-decisions` above. The two worth repeating: `Created*` is always overwritten on add (preset values never survive), and `AddCspsPersistence` registers the no-actor defaults itself so tools and tests need no extra wiring.

## Deviations from Plan

None - plan executed exactly as written. (`NoCurrentActor` sits in its own file rather than inside the interceptor file; the plan names it as an internal type of Infrastructure, so this is placement only.)

## TDD Gate Compliance

- **RED (`8f9f55d`):** `ProfileAttributionTests` ran 3 tests: 2 failed on the planned assertions (`after.UpdatedById` should be the caller but was null; `afterFirst.UpdatedAtUtc` should be the clock but was null), 1 passed. The passing one (wrong password changes neither Updated column) is the negative control that guards the over-stamping side. Semantic assessment: the target tests executed, failed on the planned assertion for the intended reason (no stamping exists), with no setup, load or fixture fault. `gsd check tdd-red-evidence` was not run because the xunit v3 / Microsoft Testing Platform console output is not one of its supported report formats; the semantic assessment above stands in and is not a classifier verdict.
- **GREEN (`9ae0d78`):** all 3 tests pass; `LayerTests` pass (8/8).
- **Task 2:** all 8 `RecordStampInterceptorTests` passed on their first run against Task 1's GREEN, so they are characterization tests with no separate RED or fix commit, as the plan allows. No REFACTOR commit was needed.

## Issues Encountered

None. Verification run: `Csps.slnx` builds with 0 warnings and 0 errors; Infrastructure integration tests 462 passed / 1 skipped (live HIBP, needs `CSPS_LIVE_HIBP=1`); Server integration tests 712 passed; architecture tests 217 passed. All ran with `CSPS_TEST_SQL=localdb` set for the process only, after the shared-machine preflight showed every port free.

## Known Stubs

None.

## Threat Flags

None. The only new surface is `HttpCurrentActor` reading the validated token's `sub`, which is the planned T-05-29 mitigation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later aggregates become stamped by implementing `IAttributedRecord` (and `IEditVersioned` when they carry an edit version).
- Plans that read "Recorded by" / "Last changed by" (D-08) can join the user row by `CreatedById` / `UpdatedById`; a null id displays as System.
- Tools that build the context through `CspsDbContextOptions.Configure` alone (design-time factory, `DevSeed`) have no interceptor, so their rows keep whatever the code sets and `CreatedById` stays null.

## Self-Check: PASSED

- Files: all 8 created files exist on disk.
- Commits: `8f9f55d`, `9ae0d78`, `e6fc0c2` are ancestors of HEAD.
- Acceptance criteria: `OriginalValue` in the interceptor 2 (at least 1); `RecordStampInterceptor` in `DependencyInjection.cs` 2 (at least 2); `ICurrentActor` in `Program.cs` 1; `IAttributedRecord` in `ApplicationUser.cs` 1; filtered Task 2 run reports 8 passing (at least 5); build 0 warnings.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*
