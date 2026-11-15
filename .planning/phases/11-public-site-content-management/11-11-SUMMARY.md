---
phase: 11-public-site-content-management
plan: 11
subsystem: api
tags: [aspnetcore, ef-core, opening-hours, open-status, json-ld, audit, rowversion, openapi, check-constraints]
created: 2026-11-12T03:00:00-06:00
updated: 2026-11-12T03:00:00-06:00

requires:
  - phase: 11-03
    provides: OpenStatus.Compute, DayHours, ClosureSpan, NextOpening (the pure open or closed rule in Manila time)
  - phase: 11-07
    provides: the public site snapshot, the post-commit public cache interceptor, the JSON-LD head writer
  - phase: 11-09
    provides: the Manager update-handler pattern (version check, 409, audit, stamps)
provides:
  - "GET and PUT /api/v1/opening-hours: Manager only, all seven days saved at once with their own week version"
  - "GET /api/v1/public/open-status: anonymous, worked out in Asia/Manila from the cached hours, Cache-Control public, max-age=60, no ETag"
  - "The OpeningHours table: seven closed rows from the migration, two CHECK constraints (plus a day range check), no trigger"
  - "GET /api/v1/public/site gains hours (seven days, Monday first) and upcomingClosures (empty until plan 11-13)"
  - "JSON-LD openingHoursSpecification for each open weekday"
  - "AuditActions.OpeningHoursChanged (catalog now 103)"
affects: [11-12, 11-13, 11-14, 11-16, 11-37]

actuals:
  tokens: 33000
  tasks: 3
  commits: 6
plan_head_before: 55de352361614eb9640c074a0c5290e934c83ff8
plan_head_after: b628a605070b1008dcac3ad1cdbdf63854cf7de2

tech-stack:
  added: []
  patterns:
    - "Week version: the seven row versions joined and written as base64, so any day change makes every older copy stale"
    - "One domain Check() that both the request validator and SetHours use, so the two never disagree"
    - "Hours ride in the existing public site snapshot, so one cache and one invalidation serve the site read, the open status and the page head"
    - "A migration that inserts fixed rows by hand (InsertData) while the model has no HasData"

key-files:
  created:
    - src/Csps.Domain/Content/OpeningHours.cs
    - src/Csps.Application/Content/OpeningHoursDto.cs
    - src/Csps.Application/Content/OpeningHoursVersion.cs
    - src/Csps.Application/Content/OpeningHoursAuditDetail.cs
    - src/Csps.Application/Content/GetOpeningHoursHandler.cs
    - src/Csps.Application/Content/UpdateOpeningHoursRequest.cs
    - src/Csps.Application/Content/UpdateOpeningHoursRequestValidator.cs
    - src/Csps.Application/Content/UpdateOpeningHoursHandler.cs
    - src/Csps.Application/Content/OpenStatusDto.cs
    - src/Csps.Application/Content/GetOpenStatusHandler.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OpeningHoursConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112073000_AddOpeningHours.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112073000_AddOpeningHours.Designer.cs
    - src/Csps.Server/Controllers/OpeningHoursController.cs
    - tests/Csps.Domain.UnitTests/Content/OpeningHoursTests.cs
    - tests/Csps.Application.UnitTests/Content/UpdateOpeningHoursRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Content/UpdateOpeningHoursHandlerTests.cs
    - tests/Csps.Application.UnitTests/Content/OpeningHoursReadModelTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OpeningHoursMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Content/OpeningHoursEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/OpenStatusEndpointTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Ports/ISiteContentStore.cs
    - src/Csps.Application/Content/PublicSiteDto.cs
    - src/Csps.Infrastructure/Content/SiteContentStore.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/site-content.md
    - docs/api/public-site.md

key-decisions:
  - "The hours live inside the public site snapshot (PublicSiteDto.Hours), so IPublicContentReader did not change: the open-status handler reads the same cached snapshot and the same post-commit clear covers it."
  - "The week version is the seven eight-byte row versions joined (56 bytes, base64). RowVersions (8 bytes) is not reused."
  - "The audit entry is one opening-hours.changed row with target OpeningHours / week and a detail such as monday=closed>09:00-18:00;saturday=09:00-17:00>closed. No names are copied."
  - "A third CHECK, CK_OpeningHours_Day (day 1 to 7), was added next to the two the plan names, so an eighth row can never exist."
  - "The migration Down throws NotSupportedException (forward only), like AddSiteContactDetails."

patterns-established:
  - "OpeningHours.Check(opens, closes) is the single source of the hours rules for the domain and the request validator"
  - "Tests that need a known week start with a closed-week PUT from a separate Manager, because the Respawn reset keeps the OpeningHours rows like the SiteSettings row"

requirements-completed: [PUB-05, CONT-01, PUB-04]

duration: about 1h 50m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "GET /api/v1/public/open-status answers isOpen, closesAt, closedToday, todayClosureNote and nextOpening in Manila time from the stored hours, with Cache-Control public, max-age=60 and no ETag"
    requirement: "PUB-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/OpenStatusEndpointTests.cs (4 tests: open at 10:00 Monday, closed at 18:00 with next Monday as weekday, fresh database closed with no next opening, Manager read shape)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Content/OpeningHoursReadModelTests.cs#OpenNowGivesTheClosingTimeAndNoNextOpening, ClosedAfterClosingGivesTomorrowAsTheNextOpening, ClosedBeforeOpeningGivesTodayAndAfterSaturdayClosingTheNextWeekdayIsMonday, AnEmptyWeekIsClosedWithNothingNext"
        status: pass
    human_judgment: false
  - id: D2
    description: "The AddOpeningHours migration creates seven closed rows keyed 1 to 7, two CHECK constraints (both times or neither, closing after opening) plus a day range check, no trigger, no foreign key, and Down is refused"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OpeningHoursMigrationTests.cs (10 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET and PUT /api/v1/opening-hours are Manager only (anonymous 401, Admin 403); the PUT saves all seven days with the week version"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests (rows GET 401/403/200 and PUT 401/403/400) and OpeningHoursEndpointTests#AnAdminGets403OnGetAndPutAndNothingIsStored"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bad hours are refused with the approved messages (opening time, closing time, closing after opening); times are half-hour steps from 5:00 AM to 11:30 PM; all seven days once each"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/OpeningHoursTests.cs and tests/Csps.Application.UnitTests/Content/UpdateOpeningHoursRequestValidatorTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/OpeningHoursEndpointTests.cs#ABadWeekIs400OnTheDayAndFieldWithTheApprovedMessagesAndChangesNothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The hours have their own version: a Business Info save never makes it stale, a stale hours version answers 409 edit.stale and changes nothing"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/OpeningHoursEndpointTests.cs#ASavedBusinessInfoNeverMakesTheHoursVersionStale, TwoManagersReadTheSameVersionTheFirstSaveWinsAndTheSecondGets409AndChangesNothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "A changing save writes one opening-hours.changed entry naming each changed day with old and new times; a no-change save writes nothing; stamps come from the server"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/OpeningHoursEndpointTests.cs#ASaveChangingMondayAndSaturdayWritesOneAuditEntryNamingBothDaysWithOldAndNewTimes, ChangingAnOpenDayAndClosingAnotherNamesTheOldTimesAndClosed, ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion, StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock"
        status: pass
    human_judgment: false
  - id: D7
    description: "The public site read carries hours (seven days, Monday first) and upcomingClosures (empty); the page head JSON-LD lists each open weekday and none when no day is open; an hours save shows on the next read with a new ETag and the open status follows"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs, Http/ShellHeadTests.cs (3 new tests), Content/PublicCacheInvalidationTests.cs#AnHoursSaveShowsOnTheNextSiteReadWithANewETagAndTheOpenStatusFollows"
        status: pass
    human_judgment: false
  - id: D8
    description: "MUST NOT seed or show business hours the owner did not enter: until a Manager saves hours every day reads closed"
    requirement: "PUB-05"
    verification:
      - kind: integration
        ref: "OpeningHoursMigrationTests#AFreshDatabaseHasSevenClosedRowsKeyedOneToSeven; OpenStatusEndpointTests#OnAFreshDatabaseEveryDayIsClosedSoTheShopIsClosedWithNoNextOpening; PublicSiteEndpointTests#UntilAManagerSavesHoursEveryDayReadsClosed"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item. The tests prove the migration and the reads show every day closed; whether the owner is content with the closed default and the Testing-only demo week is the owner's call."
  - id: D9
    description: "Domain coverage gate for the new files, and Application above its floor"
    verification:
      - kind: other
        ref: "powershell tools/scripts/Invoke-CoverageGate.ps1"
        status: pass
    human_judgment: false
---

# Phase 11 Plan 11: Weekly hours and the server's open status Summary

**A Manager saves the seven weekday hours with their own version and one audit entry, and the server answers "open now" in Asia/Manila time from `GET /api/v1/public/open-status` (cached for 60 seconds, no ETag), while the public site read, the page head JSON-LD and the shell show the same hours after every save.**

## Performance

- **Duration:** about 1h 50m
- **Started:** 2026-11-12T01:10:00-06:00 (approximate)
- **Completed:** 2026-11-12T03:00:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 50 (about 21 created; the rest source, test, contract, web fixture and doc files modified)

## Accomplishments

- `OpeningHours` table, entity and `OpeningHoursConfiguration`: seven rows keyed 1 (Monday) to 7 (Sunday), `time(0)` columns, `CK_OpeningHours_BothOrNone`, `CK_OpeningHours_ClosesAfterOpens` and `CK_OpeningHours_Day`, no trigger and no foreign key. The migration inserts the seven rows closed. Nothing seeds at startup.
- `GET /api/v1/opening-hours` and `PUT /api/v1/opening-hours` (class policy `Policies.Manager`): the PUT saves all seven days, checks the week version (the seven row versions joined, 56 bytes in base64), answers 409 `edit.stale` for a stale one, sets each day through `OpeningHours.SetHours`, and returns the refreshed hours with the new version and the last changer.
- `GET /api/v1/public/open-status` (anonymous, public-read limiter): `OpenStatus.Compute` over the cached hours and `IBusinessCalendar`. `Cache-Control: public, max-age=60`, no `ETag`. Every other public read keeps `no-cache` with an ETag.
- The public site snapshot now carries `hours` and `upcomingClosures` (an empty list for plan 11-13). One post-commit clear refreshes the site read, the open status and every shaped head.
- JSON-LD `LocalBusiness` gets `openingHoursSpecification`: one entry per open weekday with `dayOfWeek`, `opens` and `closes`; the key is left out when no day is open.
- One `opening-hours.changed` audit entry per changing save (catalog now 103), naming each changed day with its old and new times.
- The Testing seeder puts the demo week (Monday to Saturday 09:00 to 18:00, Sunday closed) in place for E2E specs.
- `docs/api/site-content.md` and `docs/api/public-site.md` describe the hours routes, the open-status read and the new snapshot fields.

## Task Commits

1. **Task 1 (tracer): a Manager saves Monday 9 to 6 and an anonymous read at 10:00 Manila says open, closes 6:00 PM**
   - RED `a7c9a717`, GREEN `72fcdcb8`
2. **Task 2: bad hours are refused with the approved messages, and the hours have their own version**
   - RED `ded44542`, GREEN `85e48a57`
3. **Task 3: the public site read, the shell and JSON-LD carry the hours, refreshed on every save**
   - RED `efb3967a`, GREEN `b628a605`

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and xunit v3 on Microsoft.Testing.Platform prints none of the formats it reads. The RED evidence below is the real console output, read by hand.

- **Task 1 RED** (`a7c9a717`): `OpenStatusEndpointTests` 4 of 4 failed (the routes did not exist: 404 where 200 was expected). The matrix run failed 15 of 454: the three new rows and the discovery check (`matrix row matches no endpoint`, `allow-list entry matches no anonymous endpoint`). Semantic assessment: the target tests ran, the build was clean, and they failed on the planned assertion, not on a load or fixture fault.
- **Task 1 GREEN** (`72fcdcb8`): 465 of 465 passed on the committed tree (open status, matrix, coverage, OpenAPI snapshot), plus `npm --prefix tools/openapi-gen run check`. The tracer's `<verify>` carries only `<automated>` commands, so it was re-run on the committed tree before expansion and passed.
- **Task 2 RED** (`ded44542`): domain `OpeningHoursTests` and `AuditActionsTests` 15 of 111 failed on assertions (off-step, out-of-range and ordering cases, count 102 against 103, the missing code); validator tests 17 of 25 failed; endpoint tests 3 of 9 failed (the two audit entry tests and the bad-week messages: no audit row, no `days[0].closesAt` error).
- **Task 2 GREEN** (`85e48a57`): domain 1597 of 1597; validator and handler tests pass; endpoint 9 of 9; infrastructure `OpeningHoursMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests` 18 of 18.
- **Task 3 RED** (`efb3967a`): 5 of 46 failed (two JSON-LD tests, the Testing seeder demo week, and the two public-site tests that pin `upcomingClosures` and the full property list).
- **Task 3 GREEN** (`b628a605`): 57 of 57 in the Task 3 verify set.
- **Weak spots, stated plainly:** `OpeningHoursMigrationTests` (10 tests) passed at Task 2 RED, because the migration was already written for Task 1's tracer; they stay as regression guards. Six of the nine `OpeningHoursEndpointTests` (version isolation, 409, stamps, no-change, Admin 403, version moves) also passed at RED, for the same reason: Task 1's handler already did that work. Two Task 3 tests passed at RED (`AnHoursSaveShowsOnTheNextSiteReadWithANewETagAndTheOpenStatusFollows`, `UntilAManagerSavesHoursEveryDayReadsClosed`) because Task 1 put the hours in the cached snapshot. No REFACTOR commit was needed.

## Verification evidence (real output)

- **Task 3 verify:** `PublicCacheInvalidationTests`, `ShellHeadTests`, `PublicSiteEndpointTests`, `OpenApiSnapshotTests`, `TestingSiteContentTests`: `total: 57, failed: 0, succeeded: 57`. `dotnet format Csps.slnx --verify-no-changes`: no output (clean).
- **Full suites on the final tree:** Server integration `total: 2443, failed: 0, succeeded: 2443`. Infrastructure integration `total: 1110, failed: 0, succeeded: 1109, skipped: 1` (the skip is the live HIBP test, pre-existing). Architecture `total: 290, failed: 0`. Domain unit `total: 1597, failed: 0`. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`): `Csps.Domain line 100% (3261/3261) branch 100% (1485/1485) PASS`, `Csps.Application line 98.1% (9558/9743) PASS`.
- **Web:** `npm --prefix web run typecheck` exit 0, `npm --prefix web run lint` exit 0 (zero warnings), `npm --prefix web run format:check`: "All matched files use Prettier code style!". The public data, module and dev preview test files: `Test Files 30 passed, Tests 625 passed`.
- **Contract:** `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- **Acceptance greps:** `InsertData` in the migration: 1 (the call; one call inserts all seven rows). Non-comment `HasData` in `OpeningHoursConfiguration.cs`: 0. `GetOpenStatus` in `openapi.v1.json`: 1. `max-age=60` in `PublicSiteController.cs`: 2. `Closing time must be after opening time.` in `OpeningHours.cs`: 1. `ShouldBe(103)` in `AuditActionsTests.cs`: 1. `openingHoursSpecification` in `PublicHeadWriter.cs`: 1. `UpcomingClosures` in `PublicSiteDto.cs`: 2.
- gitleaks `protect --staged` ran before every commit (and the repo hook ran it again): no leaks. The staged diffs hold only fake values (the existing "Paolo Reyes" test name, `example.test` addresses) and no local path, real email, host or customer data.

### The open-status answer

From `OpenStatusEndpointTests` (host clock pinned, Mon 09:00 to 18:00 saved, others closed). Headers: `Cache-Control: public, max-age=60`, no `ETag`.

- Monday 16 Nov 2026, 10:00 Manila: `isOpen: true`, `closesAt: "18:00"`, `closedToday: false`, `todayClosureNote: null`, `nextOpening: null`.
- Monday 18:00 Manila: `isOpen: false`, `closesAt: null`, `nextOpening: { date: "2026-11-23", day: 1, opensAt: "09:00", when: "weekday" }`.
- Fresh database (seven closed rows): `isOpen: false`, `nextOpening: null`.

### The migration `20261112073000_AddOpeningHours`

The file name differs from the plan's placeholder `20261113000001` because EF named it from the clock; the Designer and snapshot carry the same id.

**Up:** `CreateTable OpeningHours` with `DayOfWeek int` (primary key, no identity), `OpensAt time(0) null`, `ClosesAt time(0) null`, `CreatedById`, `CreatedAtUtc`, `UpdatedById`, `UpdatedAtUtc`, `RowVersion rowversion`; `CK_OpeningHours_BothOrNone` (`([OpensAt] IS NULL AND [ClosesAt] IS NULL) OR ([OpensAt] IS NOT NULL AND [ClosesAt] IS NOT NULL)`), `CK_OpeningHours_ClosesAfterOpens` (`[OpensAt] IS NULL OR [ClosesAt] > [OpensAt]`), `CK_OpeningHours_Day` (`[DayOfWeek] BETWEEN 1 AND 7`); then a hand-written `InsertData` of seven rows (`DayOfWeek` 1 to 7, `CreatedAtUtc` 2026-11-12 00:00 UTC), every day closed. The model has no `HasData`, so a later `migrations add` sees no diff for these rows.

**Down:** throws `NotSupportedException("AddOpeningHours is forward-only. Undoing it would delete the opening hours that were entered.")`, the same pattern as `AddSiteContactDetails` (parked for the owner as P11-BL-01). `OpeningHoursMigrationTests#UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheHours` proves it.

The generated migration touched only the new table: the snapshot diff adds the `OpeningHours` entity and nothing else. No existing table changed, no trigger, no JSON column.

## Decisions Made

- **Hours inside the site snapshot.** The plan lists `IPublicContentReader.cs` among the modified files, but the plan text also says the hours are cached "as part of the site snapshot path". Putting `Hours` on `PublicSiteDto` meant the open-status handler reads `GetSiteAsync` and the port did not need a new member. One cache entry, one clear, no second source of truth.
- **Week version.** Seven row versions joined (56 bytes). A change to any day makes every older copy stale, which is the right rule for a form that saves the whole week.
- **Audit detail.** `monday=closed>09:00-18:00` style, built with the existing `AuditDetailFormat`, so the audit viewer reads it like the other events. Target id is the word `week`.
- **A third CHECK.** `CK_OpeningHours_Day` keeps the table to days 1 to 7 even if someone inserts by hand. It is a constraint, not a trigger (OR-7).
- **Row-level concurrency.** The handler loads the seven rows tracked and compares the joined version, then lets EF check each row's version on save. A lost race surfaces as `ConcurrencyConflictException` and becomes the same 409.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests and stubs that pinned the old shapes**
- **Found during:** Tasks 1 to 3
- **Issue:** Adding `Hours` and `UpcomingClosures` to `PublicSiteDto` and two members to `ISiteContentStore` broke the stub stores in `tests/Csps.Testing/SiteContentStores.cs`, `ShellTestFactory.Site`, `GetPublicSiteHandlerTests`, the exact property list in `PublicSiteEndpointTests`, and the web fixtures and dev preview that type the public site (`web/src/test/publicFixtures.ts`, `web/src/dev/previews/PublicShell.tsx`).
- **Fix:** Added the members to each stub and fixture (closed week, no closures; the demo fixture gets Monday to Saturday 09:00 to 18:00).
- **Files modified:** the files above.
- **Verification:** build 0 warnings; `typecheck`, `lint` and the web public tests pass.
- **Committed in:** `72fcdcb8`, `b628a605`

**2. [Rule 1 - Bug] Two existing tests that pin lists the new code extends**
- **Found during:** Task 2 (full run)
- **Issue:** `AuditActionsTests` pins the catalog order, and `RateLimitTests.EveryRateLimitedEndpointIsInTheList` pins every rate-limited route. The first full Server run failed on the second with `["GET /api/v1/public/open-status"]` missing.
- **Fix:** Appended `opening-hours.changed` to the order test and added `GET /api/v1/public/open-status` (600 a minute) to the rate-limit list; the policy theory then proves the 601st read gets 429.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs`
- **Verification:** `RateLimitTests` 36 of 36; full Server run 2443 of 2443.
- **Committed in:** `85e48a57`

**3. [Rule 2 - Missing critical] The test database reset must keep the OpeningHours rows**
- **Found during:** Task 1
- **Issue:** `CspsDatabase.ResetAsync` (Respawn) deletes every table not on its ignore list, which would delete the seven migration rows and make the read throw. The `SiteSettings` row has the same need.
- **Fix:** Added `OpeningHours` to the ignore list. Tests that need a known week put one with a closed-week PUT first.
- **Files modified:** `tests/Csps.Testing/CspsDatabase.cs`
- **Committed in:** `a7c9a717`

**4. [Rule 2 - Missing coverage] Handler and read-model unit tests**
- **Found during:** Task 2
- **Issue:** The coverage gate measures Domain and Application from unit tests alone, and the new Application classes had only integration tests.
- **Fix:** Added `UpdateOpeningHoursHandlerTests` and `OpeningHoursReadModelTests`; replaced a lifted nullable comparison in `SetHours` with `Equals` (one branch could not be reached once the both-or-none rule holds).
- **Verification:** Domain 100% line and 100% branch, Application 98.1%.
- **Committed in:** `85e48a57`

### Plan wording that I did not follow

- The plan expected `IPublicContentReader` to change; it did not need to (see Decisions Made).
- The migration file name and timestamp are the real `20261112073000_AddOpeningHours`, as the executor rules allow.

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical, 1 blocking). **Impact on plan:** All four were needed for correctness or for the gates; no scope creep.

## Owner items (open, nothing blocks the plan)

**OI-1. Two messages are not in UI-SPEC § Validation.** The plan says messages are the UI-SPEC wording exactly, and the three hours messages are. The step rule and the list rule had no approved wording, so I wrote plain provisional text. Both are API-only: the form offers only half-hour choices and always sends seven days, so a person using the screen never sees them.

| Where | Provisional text |
|---|---|
| A time not on the hour or half hour, or outside 5:00 AM to 11:30 PM | "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM." |
| A request that is not the seven days once each | "Send the hours for all seven days, once each." |

Options (recommendation first): **A** keep the text as is, since no screen can show it; **B** approve different wording and I swap the two constants (`OpeningHours.TimeStepMessage`, `UpdateOpeningHoursRequestValidator.DaysMessage`) and the matching tests. Plan 11-12 must reuse the same two strings in zod only if the owner wants the browser to show them; the form cannot reach them. The owner's answer should be recorded as a dated ruling; none is recorded yet because the owner is away.

**OI-2. Migration Down is forward-only,** like `AddSiteContactDetails` (P11-BL-01). No action unless the owner wants a reviewed reversible migration.

## Issues Encountered

- A full web `vitest` run through `npm --prefix web exec` finds no config from the repo root and fails with module-not-found errors; running through `npm --prefix web run test` works. Not a code problem.
- The first full Server run printed `The email sweep failed: SqlException` in its log while all but one test passed; it is existing noise from tests that drop their database, not from this plan.

## Known Stubs

None. `upcomingClosures` is an intentional empty list that plan 11-13 fills; `GetOpenStatusHandler` passes no closures for the same reason (`closedToday` is always false until then). Both are documented in `docs/api/public-site.md`.

## Threat Flags

None. The two new surfaces (anonymous `open-status`, Manager `opening-hours`) are the ones in the plan's threat model: T-11-25 (class-level Manager policy and the matrix rows), T-11-26 (public-read limiter, cached hours, 60-second caching; the new route is in the rate-limit list), T-11-27 (CHECK constraints, validator, week version 409), T-11-SC (no package added or bumped).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-13 (closures):** feed real `ClosureSpan`s into `GetOpenStatusHandler` (it passes `[]` now) and fill `PublicSiteDto.UpcomingClosures`; add the closure rows to the snapshot read in `PublicContentReader` so the same clear covers them. `specialOpeningHoursSpecification` belongs in `PublicHeadWriter` next to the hours.
- **11-14 (public Contact page):** `hours` is in the public site read and the web type (`PublicSite['hours']`); the open-status route is ready for the pill and the status line. Tests that prime the public store need the new `hours` and `upcomingClosures` members (the shared fixtures have them).
- **11-16 (Hours tab):** `GET` and `PUT /api/v1/opening-hours` and the `OpeningHoursDto` types are in `api.generated.ts`. Send `version` and all seven days. The two provisional messages (OI-1) cannot be reached from the form.
- **11-37 (audit labels):** add the label for `opening-hours.changed` ("Opening hours changed" in the UI-SPEC group "Site content"). `AuditActions.All` holds 103 after this plan; the count in `AuditActionsTests` and the order test will conflict with parallel plans that add codes, so re-check after merge.
- **Respawn:** the `OpeningHours` rows survive `CspsDatabase.ResetAsync`; a test that needs a known week must set it first.

## Self-Check: PASSED

- Files: `OpeningHours.cs`, `OpeningHoursController.cs`, the migration and its Designer, `OpeningHoursConfiguration.cs`, `GetOpenStatusHandler.cs` and all the test files listed under key-files exist on disk.
- Commits `a7c9a717`, `72fcdcb8`, `ded44542`, `85e48a57`, `efb3967a` and `b628a605` are ancestors of HEAD; the RED commit precedes each GREEN commit.
- The measured commit count is 6 (`git rev-list --count 55de3523..HEAD` before this SUMMARY commit).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
