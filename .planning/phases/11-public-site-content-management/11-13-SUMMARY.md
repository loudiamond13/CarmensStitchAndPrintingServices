---
phase: 11-public-site-content-management
plan: 13
subsystem: api
tags: [aspnetcore, ef-core, closures, holidays, site-content-lock, open-status, json-ld, audit, rowversion, openapi, check-constraints]
created: 2026-11-12T04:20:00-06:00
updated: 2026-11-12T04:20:00-06:00

requires:
  - phase: 11-03
    provides: OpenStatus.Compute and ClosureSpan (the pure open or closed rule in Manila time)
  - phase: 11-07
    provides: the public site snapshot, the post-commit public cache interceptor, the JSON-LD head writer
  - phase: 11-11
    provides: the hours in the snapshot, GetOpenStatusHandler, the Manager update-handler pattern with a row version
provides:
  - "GET, POST, PUT and DELETE /api/v1/shop-closures: Manager only (Admin 403, anonymous 401), upcoming closures by first day, add, edit with a version, delete"
  - "The ShopClosures table with CK_ShopClosures_LastOnOrAfterFirst, CK_ShopClosures_Span and IX_ShopClosures_LastDay, plus the standing 'site-content' lock row (68 lock rows)"
  - "ISiteContentLock and SiteContentLock: a copy of the staff money lock (deadlock is a lost race, timeout is the shared busy 409 line)"
  - "The overlap rule, server only, decided under the lock: There's already a closure on Dec 25, 2026."
  - "Open status skips closure days: closedToday, todayClosureNote, and nextOpening skips every closure day"
  - "GET /api/v1/public/site fills upcomingClosures (closures touching the next 30 days); JSON-LD gets specialOpeningHoursSpecification closed days (next 60 days)"
  - "AuditActions shop-closure.added, shop-closure.changed, shop-closure.deleted (catalog now 106)"
affects: [11-14, 11-16, 11-37]

actuals:
  tokens: 46600
  tasks: 3
  commits: 7
plan_head_before: 37c3a2afda7ddebb5fd42bd83cc216ef5a90d1c6
plan_head_after: 90812c83f6a37a7c92252f8c5754f12fd6b5bf5b

tech-stack:
  added: []
  patterns:
    - "One rule set for the form: ShopClosure.Check is used by the request validator and by the domain, so they never disagree"
    - "A lock row taken inside the transaction (ExecuteUpdate of a standing row) for a rule that spans rows: no trigger, no inline SQL"
    - "The public snapshot carries a wider closure list (60 days); the public DTO cuts it to 30 days; the head writer lists what the snapshot gives"
    - "Audit detail that never copies free text: fields=note says a note was set or changed"

key-files:
  created:
    - src/Csps.Domain/Content/ShopClosure.cs
    - src/Csps.Application/Ports/ISiteContentLock.cs
    - src/Csps.Application/Ports/SiteContentBusyException.cs
    - src/Csps.Application/Content/ShopClosureDto.cs
    - src/Csps.Application/Content/ShopClosureRequest.cs
    - src/Csps.Application/Content/ShopClosureRequestValidator.cs
    - src/Csps.Application/Content/ShopClosureErrors.cs
    - src/Csps.Application/Content/ShopClosureAuditDetail.cs
    - src/Csps.Application/Content/ListShopClosuresHandler.cs
    - src/Csps.Application/Content/CreateShopClosureHandler.cs
    - src/Csps.Application/Content/UpdateShopClosureHandler.cs
    - src/Csps.Application/Content/DeleteShopClosureHandler.cs
    - src/Csps.Infrastructure/Content/SiteContentLock.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ShopClosureConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112093309_AddShopClosures.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112093309_AddShopClosures.Designer.cs
    - src/Csps.Server/Controllers/ShopClosuresController.cs
    - tests/Csps.Domain.UnitTests/Content/ShopClosureTests.cs
    - tests/Csps.Application.UnitTests/Content/ShopClosureRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Content/ShopClosureHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Content/SiteContentLockTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ShopClosuresMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Content/ShopClosureEndpointTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Ports/ISiteContentStore.cs
    - src/Csps.Application/Content/PublicSiteSnapshot.cs
    - src/Csps.Application/Content/GetOpenStatusHandler.cs
    - src/Csps.Infrastructure/Content/SiteContentStore.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/ContentRegistration.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/site-content.md
    - docs/api/public-site.md

key-decisions:
  - "An edit keeps a first day that is already past, so the note of a closure that is running can still be fixed. A new closure and an edit that moves the first day must start today or later. Parked for the owner as OI-1 (built as option A)."
  - "The audit detail never holds the note: first= and last= hold the days (old>new when moved) and fields=note says a note was set or changed. The audit screen (11-37) reads it as 'Note changed'."
  - "A deadlock on the site-content lock is a lost race (409, one more pass on add and delete, stale on edit); a timeout is the shared busy line 'Something changed at the same time. Try again.' (AuthErrors.SessionBusy). No new wording."
  - "The reader cuts the closures at 60 days for the snapshot and 30 days for upcomingClosures, so the head writer needs no clock and one cache clear covers the site read, the open status and every shaped head."
  - "Delete takes no lock: removing a closure can never create an overlap."
  - "The migration Down throws NotSupportedException (forward only), like AddSiteContactDetails and AddOpeningHours (P11-BL-01)."

patterns-established:
  - "ShopClosure.Check(first, last, note, today, requireFirstDayFromToday) is the single source of the closure rules"
  - "Closure tests pin the host clock earlier than the real clock (Monday 2 Nov 2026), because a session started on the real clock is expired for a later pinned clock"

requirements-completed: [CONT-04, PUB-05, PUB-04]

duration: about 1h 05m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "A Manager lists, adds, edits and deletes closures through /api/v1/shop-closures; an Admin gets 403 and anonymous 401; the shared client sends an Idempotency-Key on the POST"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs rows GET/POST/PUT/DELETE shop-closures; ShopClosureEndpointTests#AnAdminGets403OnEveryRouteAndNothingIsStored; OpenStatusEndpointTests#AManagerListsTheClosureWithItsVersionAndAnAdminGets403"
        status: pass
    human_judgment: false
  - id: D2
    description: "Closure rules with the UI-SPEC wording: first day required, real and today or later; last day on or after the first and at most 31 days; note at most 80; the browser and the server share one rule set"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Content/ShopClosureRequestValidatorTests.cs (20 tests); tests/Csps.Domain.UnitTests/Content/ShopClosureTests.cs (22 tests)"
        status: pass
      - kind: integration
        ref: "ShopClosureEndpointTests#ABadFormIs400OnEachFieldWithTheApprovedMessage"
        status: pass
    human_judgment: false
  - id: D3
    description: "An overlap is refused with There's already a closure on {Dec 25, 2026}. under firstDay, checked under the site-content lock; two Managers adding overlapping closures at once end with one closure and one 400; an edit ignores the closure itself"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "ShopClosureEndpointTests#AddingDecemberTwentyFiveWhenDecemberTwentyFourToTwentySixExistsIs400NamingTheDayUnderFirstDay, TwoManagersAddingOverlappingClosuresAtTheSameMomentEndWithOneStoredClosureAndOneRefusal, EditingAClosureKeepingItsOwnDaysIsNotAnOverlapWithItself, EditingAClosureIntoAnotherOnesDaysIs400AndChangesNothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "The site-content lock copies the staff money lock: a deadlock inside an outer transaction is a lost race with the transaction ended, a timeout is the shared busy line, a missing row fails loudly"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/SiteContentLockTests.cs (5 tests); tests/Csps.Application.UnitTests/Content/ShopClosureHandlerTests.cs (busy and retry cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The AddShopClosures migration creates ShopClosures with two CHECK constraints and an index, adds the site-content lock row (68 rows), holds no trigger or foreign key, and refuses to be undone"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/ShopClosuresMigrationTests.cs (7 tests); DatabaseLocksMigrationTests (68 rows); TriggerInventoryTests; MigrationScriptTests"
        status: pass
    human_judgment: false
  - id: D6
    description: "A closure covering today makes the open status closed with closedToday true and its note, and the next opening skips every closure day"
    requirement: "PUB-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/OpenStatusEndpointTests.cs#AClosureForTodayMakesTheStatusClosedWithItsNoteAndTheNextOpeningSkipsIt"
        status: pass
    human_judgment: false
  - id: D7
    description: "GET /api/v1/public/site lists the closures that touch the next 30 days by first day, and each add, edit or delete moves the ETag on the next read"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "PublicSiteEndpointTests#UpcomingClosuresHoldTheNextThirtyDaysByFirstDayAndLeaveOutOneStartingInFortyDays, AClosureWithNoNoteHasANullNote; PublicCacheInvalidationTests#AddingEditingAndDeletingAClosureEachChangeTheSiteETagOnTheNextRead"
        status: pass
    human_judgment: false
  - id: D8
    description: "JSON-LD lists the closures that touch the next 60 days as specialOpeningHoursSpecification closed days (opens and closes 00:00, validFrom, validThrough); one in 70 days is left out; the key is absent with no closures; the note is never written"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "ShellHeadTests#AClosureInFortyFiveDaysIsAClosedDayInTheSpecialHoursAndOneInSeventyDaysIsLeftOut, ClosuresAreListedByFirstDayAndASingleDayHasTheSameValidFromAndValidThrough, WithNoClosuresTheJsonLdHasNoSpecialOpeningHoursSpecification"
        status: pass
    human_judgment: false
  - id: D9
    description: "A stale edit is 409 edit.stale, stamps come from the server, add, change and delete write shop-closure.* audit entries with the dates and fields=note instead of the note text, and a second delete is 404"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "ShopClosureEndpointTests#EditingWithAStaleVersionIs409EditStaleAndChangesNothing, StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManager, AddingChangingAndDeletingWriteTheirAuditCodesAndNeverTheNoteText, DeletingAClosureTwiceGives204Then404, ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion"
        status: pass
    human_judgment: false
  - id: D10
    description: "MUST NOT add a database trigger or raw SQL for the overlap rule: it runs in the handlers under the site-content lock"
    requirement: "CONT-04"
    verification:
      - kind: integration
        ref: "TriggerInventoryTests, NoInlineSqlTests (Architecture), ShopClosuresMigrationTests#TheStandingSiteContentLockRowExistsAndTheTableHasNoTriggerOrForeignKey"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item. The tests prove no trigger exists and no inline SQL is in the app code; whether the lock-based approach is what the owner meant is a reviewer call."
  - id: D11
    description: "Domain coverage gate 100 percent line and branch, Application above its floor"
    verification:
      - kind: other
        ref: "powershell tools/scripts/Invoke-CoverageGate.ps1"
        status: pass
    human_judgment: false
---

# Phase 11 Plan 13: Holidays and closures Summary

**A Manager adds, edits and deletes closures with a server-only overlap rule decided under a new site-content lock, and the open status, the public site's upcomingClosures and the JSON-LD closed days all follow them after every change.**

## Performance

- **Duration:** about 1h 05m
- **Started:** 2026-11-12T03:23:36-06:00
- **Completed:** 2026-11-12T04:25:00-06:00 (approximate)
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 52 (23 created, the rest modified; the contract file and the generated types are included)

## Accomplishments

- `ShopClosures` table, `ShopClosure` entity and configuration: `date` columns, `Note nvarchar(80)`, a row version, the Manager stamps, `CK_ShopClosures_LastOnOrAfterFirst`, `CK_ShopClosures_Span` and `IX_ShopClosures_LastDay`. No trigger, no foreign key, no JSON column.
- The `site-content` standing lock (`DatabaseLocks.SiteContent`, after `StaffMoney`) and `SiteContentLock`, copied from `StaffMoneyLock`: same catch order, same busy line, a deadlock victim becomes a `ConcurrencyConflictException` after `ChangeTracker.Clear()`.
- `GET`, `POST`, `PUT` and `DELETE /api/v1/shop-closures` (class policy `Policies.Manager`; POST returns 201 with the closure). The list shows closures whose last day is today or later, by first day, each with its version.
- One rule set for the form: `ShopClosure.Check` is called by both the request validator and the domain, with the exact UI-SPEC messages.
- The overlap rule runs in the add and edit handlers after the lock is taken. The 400 sits under `firstDay` and names the first shared day in the en-PH short form. The edit leaves the closure itself out of the comparison.
- Open status: `GetOpenStatusHandler` hands the snapshot's closures to `OpenStatus.Compute`, so `closedToday` is true, `todayClosureNote` carries the note and the next opening skips closure days.
- Public site: `upcomingClosures` holds the closures that touch the next 30 days; the snapshot also carries the 60-day list that the head writer turns into `specialOpeningHoursSpecification` closed days. One post-commit cache clear refreshes the site read, the open status and every shaped head.
- Audit: `shop-closure.added`, `shop-closure.changed`, `shop-closure.deleted` (catalog 106). The detail holds the days and `fields=note`, never the note text.
- The Testing seeder keeps exactly one demo closure, 20 days after the business today, note "Demo holiday".
- `docs/api/site-content.md` and `docs/api/public-site.md` describe the routes, rules, the overlap answer, the busy answer, the audit details and what visitors see.

## Task Commits

1. **Task 1 (tracer): a Manager adds a closure for today and the public status says closed with its note**
   - RED `5ca1414d`, GREEN `81e9c2e4`
2. **Task 2: closure rules, overlaps under the lock, edits, deletes and audit**
   - RED `6ed52112`, GREEN `9e95f29f`
3. **Task 3: the public site lists the coming closures and search results mark them closed**
   - RED `f7b08ed8`, GREEN `a9644dbe`
4. **Coverage follow-up (tests only):** `90812c83` (handler unit tests and the one missing domain branch)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and xunit v3 on Microsoft.Testing.Platform prints none of the formats it reads. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`5ca1414d`): `OpenStatusEndpointTests` 2 of 6 failed (404 where 201 was expected); the matrix run failed 15 of 468 (the four new rows for three callers each, plus the discovery check). Semantic assessment: the target tests ran, the build was clean, and they failed on the planned assertion.
- **Task 1 GREEN** (`81e9c2e4`): 479 of 479 (open status, matrix, coverage, OpenAPI snapshot), infrastructure lock, trigger and script tests 11 of 11, `npm --prefix tools/openapi-gen run check` clean. The tracer's `<verify>` carries only `<automated>` commands, so it was re-run on the committed tree before expansion and passed (tracer verified end to end, expanding).
- **Task 2 RED** (`6ed52112`): domain 4 of 113 failed (catalog count 103 against 106 and the three new codes); validator tests 5 of 20 failed (today or later, 31 days, 80 characters, last before first, all fields at once); endpoint tests 5 of 15 failed (the four overlap cases and the audit entries).
- **Task 2 GREEN** (`9e95f29f`): domain 113 of 113, validator 20 of 20, endpoint 15 of 15, infrastructure 23 of 23 (lock, migration, locks, trigger inventory, migration script).
- **Task 3 RED** (`f7b08ed8`): 6 of 53 failed (upcomingClosures empty, ETag unchanged, no special hours key, the seeder kept an old closure).
- **Task 3 GREEN** (`a9644dbe`): 64 of 64 in the Task 3 verify set plus the OpenAPI snapshot; architecture 290 of 290; `dotnet format` clean.
- **Weak spots, stated plainly:** `ShopClosureTests` (21 tests then, 22 now) and the lock and migration tests (12) passed at Task 2 RED, because the Task 1 tracer already built the entity, the lock and the migration; they stay as regression guards. Seven of the fifteen endpoint tests (stale 409, delete twice, stamps, no change, Admin 403, edit keeping its own days, a running closure's note) also passed at RED for the same reason. Task 3 tests for the empty-key case (`WithNoClosuresTheJsonLdHasNoSpecialOpeningHoursSpecification`) passed at RED because the key did not exist yet. The coverage follow-up commit `90812c83` is tests only and was not red first (it closes a coverage gap on code that already worked).

## Verification evidence (real output)

- **Task 3 verify:** `PublicCacheInvalidationTests`, `ShellHeadTests`, `PublicSiteEndpointTests`, `TestingSiteContentTests`, `OpenApiSnapshotTests`: `total: 64, failed: 0, succeeded: 64`. `Csps.ArchitectureTests` (includes `NoInlineSqlTests` and `LayerTests`): `total: 290, failed: 0`. `dotnet format Csps.slnx --verify-no-changes`: no output (clean).
- **Full suites on the final tree:** Server integration `total: 2479, failed: 1, succeeded: 2478`; the one failure was `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos`, a concurrency test that passed when re-run alone (`OrderImagesEndpointTests` 20 of 20); recorded as a flake under load, not related to this plan. Infrastructure integration `total: 1122, failed: 0, succeeded: 1121, skipped: 1` (the skip is the live HIBP test, pre-existing). Domain unit `total: 1624, failed: 0`. Application unit `total: 2709, failed: 0` before the handler tests, 20 more after. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`): `Csps.Domain line 100% (3346/3346) branch 100% (1521/1521) PASS`, `Csps.Application line 98% (9764/9957) PASS`. The first run found one domain branch short (reverse non-overlap case); `90812c83` closes it.
- **Contract:** `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed through `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only.
- **Acceptance greps:** `public const string SiteContent = "site-content";` in `DatabaseLocks.cs`: 1. `SqlErrors.DeadlockVictim` in `SiteContentLock.cs`: 1. `CreateShopClosure` in `openapi.v1.json`: 1. `ShouldBe(68)` in `DatabaseLocksMigrationTests.cs`: 2. `ShouldBe(106)` in `AuditActionsTests.cs`: 1. `A closure can be up to 31 days. Add another one for longer.` in `ShopClosure.cs`: 1. `specialOpeningHoursSpecification` in `PublicHeadWriter.cs`: 3.
- **Web:** no web source file changed; only the generated types file grew (additive, checked by the command above). The web typecheck, lint and tests were not run in this worktree (no `node_modules` in `web/`, no web change to check).
- gitleaks `protect --staged` ran before every commit: no leaks. The staged diffs hold only fake values (the existing test name "Paolo Reyes", `example.test` addresses, closure notes such as "Christmas") and no local path, real email, host or customer data.

### The overlap answer

From `ShopClosureEndpointTests` (a Manager adds Dec 24 to Dec 26, then adds Dec 25 alone):

`400`, code `site-content.invalid-request`, `errors.firstDay[0]` = `There's already a closure on Dec 25, 2026.` Nothing is stored for the second request. Adding Dec 20 to Dec 25 against Dec 24 to 26 names `Dec 24, 2026` (the first shared day). Dec 24 to 25 and Dec 26 to 27 only touch and are both stored.

### The migration `20261112093309_AddShopClosures`

EF named it from the clock; the file name differs from the plan's placeholder `20261114000001`. The Designer and the snapshot carry the same id.

**Up:**

```csharp
migrationBuilder.CreateTable(
    name: "ShopClosures",
    columns: table => new
    {
        Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
        FirstDay = table.Column<DateOnly>(type: "date", nullable: false),
        LastDay = table.Column<DateOnly>(type: "date", nullable: false),
        Note = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
        CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
        CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
        UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
        UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
        RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
    },
    constraints: table =>
    {
        table.PrimaryKey("PK_ShopClosures", x => x.Id);
        table.CheckConstraint("CK_ShopClosures_LastOnOrAfterFirst", "[LastDay] >= [FirstDay]");
        table.CheckConstraint("CK_ShopClosures_Span", "DATEDIFF(day, [FirstDay], [LastDay]) < 31");
    });

migrationBuilder.InsertData(
    table: "DatabaseLocks",
    columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
    values: new object[] { "site-content", null, null, null });

migrationBuilder.CreateIndex(name: "IX_ShopClosures_LastDay", table: "ShopClosures", column: "LastDay");
```

**Down:** the generated Down dropped the table. It was replaced with the forward-only pattern (the orchestrator's carry-forward note, parked for the owner as P11-BL-01):

```csharp
throw new NotSupportedException(
    "AddShopClosures is forward-only. Undoing it would delete the closures that were entered.");
```

`ShopClosuresMigrationTests#UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheClosures` proves it. The generated migration touched only the new table, the lock row and the index: the snapshot diff adds the `ShopClosures` entity and nothing else. No existing table changed, no trigger, no JSON column, nothing runs at startup.

## Decisions Made

- **An edit keeps a past first day (OI-1 below).** `UI-SPEC` lists closures whose last day is today or later, so a closure that is running appears in the list with an Edit button. A strict "today or later" on every save would make its note impossible to fix. The domain therefore checks the first day against today only for a new closure or when an edit moves the first day. The request validator gets this from the edit marker (`EditKey`), and the domain `Change` enforces it for a moved first day.
- **Audit detail format.** `first=2026-12-24;last=2026-12-26>2026-12-27;fields=note`. It follows the existing `fields=` convention for text that is never copied (D-06), and the audit screen (11-37) reads `fields=note` as "Note changed".
- **The reader owns the windows.** `PublicContentReader` loads the closures that touch 60 days and cuts the public list at 30 days, so `PublicHeadWriter` needs no clock. The snapshot record got a third member `Closures` (a two-argument constructor is kept for fixtures).
- **Plan order.** The tracer's controller has all four actions, so the update and delete handlers (listed under Task 2) and a first-day-only validator went in with Task 1; Task 2 then added the real rules, the overlap check, the audit entries and their tests red first. The overlap check and the audit entries are therefore Task 2 behavior, not Task 1.
- **No lock on delete.** Removing a closure can never create an overlap, and a lost race is read again (404 when it is gone).
- **Edit order.** After the lock: find (404), version (409), overlap (400), then the domain change (400 for a first day moved into the past). The overlap check runs before the change so a refused edit leaves the tracked row untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests and stubs that pinned the old shapes**
- **Found during:** Tasks 1 and 2
- **Issue:** Adding five members to `ISiteContentStore` broke the two stub stores in `tests/Csps.Testing/SiteContentStores.cs`. `DatabaseLocksMigrationTests` pinned 67 lock rows (it moved to 68 in Task 1, not Task 2, because the migration landed in Task 1). `AuditActionsTests` pins the catalog count and, in a second test, the exact order of the last codes. The existing `PublicSiteEndpointTests` empty-closures test depends on no closure being left by an earlier test.
- **Fix:** Added the members to both stubs; changed 67 to 68 and added the `site-content` assertion; moved the count to 106 and appended the three codes to the order test; the empty-closures test now clears the closures first.
- **Files modified:** `tests/Csps.Testing/SiteContentStores.cs`, `tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs`, `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs`
- **Committed in:** `81e9c2e4`, `9e95f29f`, `f7b08ed8`

**2. [Rule 1 - Bug] The pinned-clock test hosts returned 401 for a clock later than the real one**
- **Found during:** Task 1 (RED to GREEN)
- **Issue:** A host pinned to Monday 16 Nov 2026 rejected sessions started on the real clock (2026-11-12), and sessions started on the pinned host were rejected too. This is how the session checks use the clock, not a code bug.
- **Fix:** The closure tests pin Monday 2 Nov 2026, earlier than the real clock, and start the session on the real-clock host.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Content/OpenStatusEndpointTests.cs`, `ShopClosureEndpointTests.cs`
- **Committed in:** `81e9c2e4`, `6ed52112`

**3. [Rule 2 - Missing critical] The edit must not block the note of a running closure**
- **Found during:** Task 2 (design)
- **Issue:** A first day that is "today or later" on every save would refuse an edit of a closure that already started. See Decisions Made and OI-1.
- **Fix:** `ShopClosure.Change` and the validator's edit marker.
- **Committed in:** `81e9c2e4`, `9e95f29f`

**4. [Rule 2 - Missing coverage] Handler unit tests**
- **Found during:** the coverage gate
- **Issue:** The domain gate was one branch short (reverse non-overlap), and the new handlers had only integration tests.
- **Fix:** Added `ShopClosureHandlerTests` (20 tests) and the reverse adjacency domain test.
- **Committed in:** `90812c83`

### Plan wording that I did not follow

- The plan says `ShellHeadTests` checks "a closure in 70 days does not appear". The shell tests that use a stub reader cannot window, because the windows live in the reader. The 45-day and 70-day cases therefore use the database-backed host.
- The migration file name and timestamp are the real `20261112093309_AddShopClosures`, as the executor rules allow.

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical or coverage, 1 blocking). **Impact on plan:** all four were needed for correctness or for the gates; no scope creep.

## Owner items (open, nothing blocks the plan)

**OI-1. Editing a closure that has already started.** A new closure must start today or later. For an edit, I built option A.

| Option | What a Manager sees |
|---|---|
| **A (built, recommended):** an edit keeps its first day even when it is in the past. Moving the first day is checked against today. | The note, the last day or a typo can be fixed while the closure is running. |
| **B:** every save needs a first day of today or later. | A running closure cannot be edited at all. The Manager deletes it and adds a new one. |

I recommend A because the Upcoming list shows running closures with an Edit button. The browser form in plan 11-16 must follow the same rule: on an edit, an unchanged first day skips the "Pick today or a later date." check. The owner's answer should be recorded as a dated ruling; none is recorded yet because the owner is away.

**OI-2. Migration Down is forward-only,** like `AddSiteContactDetails` and `AddOpeningHours` (P11-BL-01). No action unless the owner wants a reviewed reversible migration.

## Issues Encountered

- One full Server run had a single failure in `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos`; it passed 20 of 20 when the class was re-run alone. Recorded as a flake (a two-request concurrency test under a loaded machine); not touched.
- The Bash tool in this worktree refuses commands that combine `git` with command substitution, so the plan-head ledger file was written with a plain `echo` of the base SHA and read back.

## Known Stubs

None.

## Threat Flags

None. The new surface is the one in the plan's threat model: T-11-30 (class-level `Policies.Manager` and four matrix rows), T-11-31 (the overlap check under the lock and the two-Manager race test), T-11-32 (the lock copies `StaffMoneyLock`; five lock tests), T-11-SC (no package added or bumped). The JSON-LD never writes a closure note.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-14 (Contact page):** `PublicSite['upcomingClosures']` is filled (`{ firstDay, lastDay, note }`, "yyyy-MM-dd"); `GET /api/v1/public/open-status` now returns `closedToday` and `todayClosureNote`. The Call button's open-day second line can use the hours and the closure. Tests that prime the public store keep working (the shared fixtures have both lists).
- **11-16 (Hours and Closures tab):** the routes and types (`ShopClosureDto`, `ShopClosureRequest`, `CreateShopClosure`, `UpdateShopClosure`, `DeleteShopClosure`, `ListShopClosures`) are in `api.generated.ts`. The zod schema must mirror `ShopClosure.Check`: first day required, real date, today or later (not on an edit when the first day is unchanged, OI-1), last day on or after the first and at most 31 days in all, note at most 80 after trimming. The overlap line is server only and arrives under `firstDay`. The 404 on edit or delete is `shop-closures.not-found` ("This closure wasn't found."); the UI-SPEC "Already deleted" toast belongs to a delete 404.
- **11-37 (audit labels):** add labels for `shop-closure.added` ("Closure added"), `shop-closure.changed` ("Closure changed") and `shop-closure.deleted` ("Closure deleted"), and read `fields=note` as "Note changed". `AuditActions.All` holds 106 after this plan (it was 103); the web catalog test count in `auditCopy.test.ts` is still 101 and is 11-37's to update. Parallel plans that add codes will conflict on this count after merge.
- **Respawn:** `ShopClosures` rows are removed by `CspsDatabase.ResetAsync` (the table is not on the ignore list); the `site-content` lock row survives like the other standing rows.
- **Contract hot spots:** `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` will conflict with other wave plans; regenerate after merge with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, then `npm --prefix tools/openapi-gen run generate`.
- **Public bundle:** untouched (no web source change).

## Self-Check: PASSED

- Files: `ShopClosure.cs`, `ISiteContentLock.cs`, the four closure handlers, the validator, `SiteContentLock.cs`, `ShopClosureConfiguration.cs`, the migration, `ShopClosuresController.cs` and the seven new test files exist on disk (17 of 17 checked).
- Commits `5ca1414d`, `81e9c2e4`, `6ed52112`, `9e95f29f`, `f7b08ed8`, `a9644dbe` and `90812c83` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 7 (`git rev-list --count 37c3a2af..HEAD` before this SUMMARY commit).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
