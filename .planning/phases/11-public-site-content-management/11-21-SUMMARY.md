---
phase: 11-public-site-content-management
plan: 21
subsystem: api
tags: [aspnetcore, ef-core, testimonials, public-home, site-content-lock, audit, rowversion, openapi, public-cache, boot-data]
created: 2026-11-12T12:05:00-06:00
updated: 2026-11-12T12:05:00-06:00

requires:
  - phase: 11-17
    provides: the move, hide, show and delete handler shapes, ISiteContentLock, the audit detail pattern, the Manager controller shape
  - phase: 11-19
    provides: IImageDelivery.ForLinePhoto (the 4:5 card candidates), the line photo rows the Home cards read
  - phase: 11-07
    provides: the cached public reader, PublicJsonSnapshot, the PublicSiteController ETag action, the shell boot block
provides:
  - "GET, POST, PUT {id}, POST {id}/move, POST {id}/hide, POST {id}/show and DELETE {id} on /api/v1/testimonials: Manager only (Admin 403, anonymous 401)"
  - "Testimonial entity (quote 300, name 60, team 80, 1 to 5 stars, position, shown flag, rowversion, stamps), the Testimonials table with CK_Testimonials_Stars (AddTestimonials, forward only) and the ITestimonials store"
  - "GET /api/v1/public/home: the shown lines as cards (key, number, title, cardText, placeholderArt, cardPhoto), lineCount, the first 3 shown testimonials, recentWork [] and heroTag null; cached under csps:public:home:v1 with its own strong ETag"
  - "The / shell carries the same JSON in the csps-boot block under home"
  - "Six audit codes (testimonial.added, .changed, .moved, .hidden, .shown, .deleted); AuditActions.All is 120"
  - "TestingSiteContentSeeder: three shown and one hidden demo testimonial (made-up names), E2E- testimonials removed"
affects: [11-24, 11-25, 11-26, 11-37]

actuals:
  tokens: 43300
  tasks: 3
  commits: 7
plan_head_before: 67b3e06ea0bed8a4efaa50013f29556b09e5faa0
plan_head_after: 1a1f413ab18b59ea58aa58f58c6e953d48c7f055

tech-stack:
  added: []
  patterns:
    - "One rule set for the form: Testimonial.Check is called by the request validator and by the domain Create and Update, so they never disagree (same idea as ProductLine.Check)"
    - "The audit detail names the person and the changed fields and never copies the quote or the team line"
    - "Home data is one cached snapshot read by the API and by the shell, so a page and the API never disagree"
    - "Audit queries in endpoint tests are scoped to the test's own Manager id, because the audit table is append-only and the class fixture keeps its rows between tests"

key-files:
  created:
    - src/Csps.Domain/Content/Testimonial.cs
    - src/Csps.Application/Ports/ITestimonials.cs
    - src/Csps.Application/Content/TestimonialDtos.cs
    - src/Csps.Application/Content/TestimonialRequest.cs
    - src/Csps.Application/Content/TestimonialRequestValidator.cs
    - src/Csps.Application/Content/TestimonialAuditDetail.cs
    - src/Csps.Application/Content/ListTestimonialsHandler.cs
    - src/Csps.Application/Content/CreateTestimonialHandler.cs
    - src/Csps.Application/Content/UpdateTestimonialHandler.cs
    - src/Csps.Application/Content/MoveTestimonialHandler.cs
    - src/Csps.Application/Content/SetTestimonialShownHandler.cs
    - src/Csps.Application/Content/DeleteTestimonialHandler.cs
    - src/Csps.Application/Content/PublicHomeDto.cs
    - src/Csps.Application/Content/GetPublicHomeHandler.cs
    - src/Csps.Infrastructure/Content/Testimonials.cs
    - src/Csps.Infrastructure/Persistence/Configurations/TestimonialConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112171936_AddTestimonials.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112171936_AddTestimonials.Designer.cs
    - src/Csps.Server/Controllers/TestimonialsController.cs
    - tests/Csps.Domain.UnitTests/Content/TestimonialTests.cs
    - tests/Csps.Application.UnitTests/Content/TestimonialRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Content/TestimonialHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/TestimonialsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Content/TestimonialEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicHomeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/TestimonialRig.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Ports/IPublicContentReader.cs
    - src/Csps.Application/Content/SiteContentErrors.cs
    - src/Csps.Application/Content/ProductLinePhotoMapper.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/ContentRegistration.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/site-content.md
    - docs/api/public-site.md

key-decisions:
  - "isShown left out on an add means hidden, and left out on an edit means unchanged, the same as product lines (never publish by accident). The UI default of a ticked box belongs to plan 11-24."
  - "A move swaps with the next testimonial in the Manager's list, hidden ones included (the product line precedent, 11-17 OI-1), so the position the screen announces matches the swap"
  - "The audit detail of a change is fields=quote,name,stars plus name=old>new and stars=old>new. The words 'Quote changed' are the Audit Log screen's label for fields=quote (plan 11-37), the same way fields=note reads as 'Note changed'. The names are shown publicly anyway; the quote and the team line are never copied."
  - "The request carries stars as a number (not an integer) so that 2.5 and a missing value are refused with the same 'Choose 1 to 5 stars.' as 0 and 6 (the product line minimum precedent)"
  - "cardPhoto uses the 4:5 category card candidates (csps_cat_*) of the line's main photo; width and height are the photo's own"
  - "PublicRecentWorkDto and PublicHeroTagDto have a first shape (tile and tag as the UI-SPEC draws them); plan 11-26 fills them and may adjust the fields"

requirements-completed: [CONT-03, PUB-02, PUB-03]

coverage:
  - id: D1
    description: "A Manager lists (display order, hidden included), adds, edits, moves, hides, shows and deletes testimonials through /api/v1/testimonials; an Admin gets 403 and anonymous 401 on all seven routes"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/TestimonialEndpointTests.cs (AManagerListsShownAndHiddenTestimonialsInDisplayOrderWithTheirVersions, AnAdminGets403OnEveryRouteAndNothingChanges); AuthorizationMatrixTests rows for the seven routes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every UI-SPEC message is the server's wording: 'Enter the quote.', 'Keep the quote to 300 characters or fewer.', 'Enter the name.', 'Keep the name to 60 characters or fewer.', 'Keep this to 80 characters or fewer.', 'Choose 1 to 5 stars.'; the limits hold at 300 and 301, 60 and 61, 80 and 81, and 0, 6 and 2.5 stars are refused"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/TestimonialTests.cs; tests/Csps.Application.UnitTests/Content/TestimonialRequestValidatorTests.cs"
        status: pass
      - kind: integration
        ref: "TestimonialEndpointTests#ABadFormIs400OnEachFieldWithTheApprovedMessage, ThreeHundredCharactersAndOneAndFiveStarsAreStoredExactly"
        status: pass
    human_judgment: false
  - id: D3
    description: "The AddTestimonials migration creates only the Testimonials table with CK_Testimonials_Stars (stars 1 to 5), rowversion, stamps and one index; no trigger, no JSON column, no seeded row, no change to an existing table, and Down is refused"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TestimonialsMigrationTests.cs (5 tests); TriggerInventoryTests and MigrationScriptTests"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/v1/public/home answers anonymously with the shown line cards, the line count, the first three shown testimonials in order, recentWork [] and heroTag null, with a strong ETag, no-cache and 304; a hidden testimonial or line is left out"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicHomeEndpointTests.cs (6 tests); AuthorizationMatrixTests row; RateLimitTests row"
        status: pass
    human_judgment: false
  - id: D5
    description: "The / shell carries the home JSON in the csps-boot block, equal to the API body; no other page has the key; a failing Home read keeps the site data and is not cached"
    requirement: "PUB-02"
    verification:
      - kind: integration
        ref: "ShellHeadTests#TheHomeShellCarriesTheSameHomeJsonAsTheApi, OtherPagesCarryNoHomeKey, WhenOnlyTheHomeReadThrowsTheHomePageStillCarriesTheSiteAndTheFailureIsNotCached, AfterATestimonialIsAddedTheNextHomeShellShowsItBecauseTheShellCacheWasCleared"
        status: pass
    human_judgment: false
  - id: D6
    description: "Moves swap under the site-content lock; a move at the end is a no-op; the same move posted twice with one Idempotency-Key moves once; two Managers moving at the same moment end with every place used once"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "TestimonialEndpointTests#MovingTheSecondTestimonialUpSwaps..., MovingTheFirstUpOrTheLastDownIs204..., TheSameMovePostedTwiceWithOneIdempotencyKeyMovesOnce, TwoManagersMovingAtTheSameMomentEndWithEveryPositionUsedOnce"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every testimonial add, edit, move, hide and delete, and a hidden line, each give a new Home ETag on the next read"
    requirement: "PUB-03"
    verification:
      - kind: integration
        ref: "PublicCacheInvalidationTests#EveryTestimonialChangeAndAHiddenLineEachGiveANewHomeETagOnTheNextRead"
        status: pass
    human_judgment: false
  - id: D8
    description: "Stale edits answer 409 edit.stale; stamps come from the server; the six audit entries name the person and never copy the quote or the team line"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "TestimonialEndpointTests#EditingWithAStaleVersionIs409EditStaleAndChangesNothing, StampFieldsSentByTheClientAreIgnored..., EachChangingSaveWritesItsAuditEntryAndTheQuoteIsNamedNeverCopied, AQuoteOnlyChangeSaysQuoteChangedAndNeverCopiesTheText"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Content/TestimonialHandlerTests.cs; AuditActionsTests (count 120)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The Testing seed leaves three shown demo testimonials in order and one hidden, deletes E2E- testimonials and leaves the same four on a second run"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "TestingSiteContentTests#APostLeavesThreeShownDemoTestimonialsInOrderAndOneHidden..., APostRemovesTheTestimonialsNamedWithTheE2EPrefixAndRunningItTwiceLeavesTheSameFour"
        status: pass
    human_judgment: false
  - id: D10
    description: "MUST NOT invent or seed testimonials into any database the public site reads in production"
    requirement: "CONT-03"
    verification:
      - kind: integration
        ref: "TestimonialsMigrationTests#TheTableHasNoTriggerAndNoSeededRow, TheIdempotentScriptOnlyCreatesTheTableAndItsIndexAndRunsTwice; PublicHomeEndpointTests#AFreshlyMigratedDatabaseAnswersTheSixLineCards..."
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (product, unverified). The tests prove the migration and the script insert no row and a fresh database answers an empty testimonial list; the demo rows exist only in the Testing seeder, which is compiled out of Release. Whether the owner reads this as enough is a reviewer call."
  - id: D11
    description: "Domain coverage 100 percent line and branch, Application above its floor, full Server and Infrastructure runs green"
    verification:
      - kind: other
        ref: "powershell tools/scripts/Invoke-CoverageGate.ps1; full Server run 2634 of 2635; full Infrastructure run 1147 of 1148 (1 skipped)"
        status: pass
    human_judgment: false

duration: about 65 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 21: Testimonials and the public Home read Summary

**A Manager adds, edits, orders, hides, shows and deletes real customer testimonials through `/api/v1/testimonials` (stale edits 409, every change audited without the customer's words), and one cached `GET /api/v1/public/home` serves the product cards and the first three shown testimonials, also in the `/` boot block.**

## Performance

- **Duration:** about 65 min
- **Started:** 2026-11-12T11:00:00-06:00 (approximate)
- **Completed:** 2026-11-12T12:05:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 50 (26 created, 24 modified; the contract files included, no file deleted). The token figure (chars/4 of the added lines in `src`, `tests` and `docs`, migrations left out) is about 43,300, far under the plan's estimate of 140,000.

## Accomplishments

- **Seven Manager routes** (class policy `Policies.Manager`): list (shown and hidden, display order, each with its version), add (201 with a location), edit with a version, move, hide, show and delete. Matrix rows hold for all three callers.
- **One rule set**, `Testimonial.Check`, with the UI-SPEC wording exactly. The validator and the domain both call it, so the browser (plan 11-24), the validator and the domain never disagree.
- **Moves** swap with the neighbour in the Manager's list in one transaction under the site-content lock. A move at the end is a `204` that changes and records nothing. The same move posted twice with one `Idempotency-Key` moves once. Two Managers moving at once end with every place used once.
- **Audit (AUDIT-01, T-11-54).** Six codes, `AuditActions.All` is 120. The detail names the person (`name=Juan Dela Cruz`) and the changed fields (`fields=quote,name,stars;name=old>new;stars=5>4`). The quote and the team line are never copied.
- **Public Home read.** `GET /api/v1/public/home`: the shown lines as cards (with the 4:5 card photo when the line has a main photo), the count, the first three shown testimonials, `recentWork` `[]` and `heroTag` `null`. One cached snapshot (`csps:public:home:v1`) with a strong ETag, `no-cache`, `304`, 600 reads a minute per address.
- **Boot block.** `/` carries `{ "site": ..., "home": ... }`; the `home` value is byte-identical to the API body. If only the Home read fails, `/` keeps the site data and is not cached.
- **Cache (PUB-03).** `Testimonial` is a public content record, so every committed save clears the cache. A test proves an add, an edit, a move, a hide, a delete and a hidden line each move the Home ETag.
- **E2E seed.** `POST /api/testing/site-content` leaves three shown demo testimonials and one hidden (made-up names), deletes testimonials named `E2E-...` and leaves the same four on every run.
- **Docs.** `docs/api/site-content.md` has the Testimonials section (routes, rules, messages, audit details); `docs/api/public-site.md` has `GET /api/v1/public/home` and the `home` boot key. The OpenAPI snapshot and generated types are refreshed; the snapshot change is purely additive (checked by comparing every path and schema of the old and new snapshot: no existing one changed).

## The migration (real output)

`dotnet ef migrations add AddTestimonials --project src/Csps.Infrastructure --startup-project src/Csps.Server` made `20261112171936_AddTestimonials` (the plan's `20261116000001` was a placeholder). Only the new table, its check and one index appeared; no other table, column or constraint changed.

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(
        name: "Testimonials",
        columns: table => new
        {
            Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
            Quote = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
            Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
            TeamOrRole = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
            Stars = table.Column<int>(type: "int", nullable: false),
            Position = table.Column<int>(type: "int", nullable: false),
            IsShown = table.Column<bool>(type: "bit", nullable: false),
            CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
            CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
            UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
            UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
            RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_Testimonials", x => x.Id);
            table.CheckConstraint("CK_Testimonials_Stars", "[Stars] BETWEEN 1 AND 5");
        });

    migrationBuilder.CreateIndex(
        name: "IX_Testimonials_Position",
        table: "Testimonials",
        columns: new[] { "Position", "Id" });
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    // Forward only. Undoing this migration would drop the testimonials a Manager has typed in.
    // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
    throw new NotSupportedException(
        "AddTestimonials is forward-only. Undoing it would delete the testimonials that were entered.");
}
```

`ef` first generated `Down` as `DropTable("Testimonials")`; I changed it to the forward-only refusal, the pattern of the other Phase 11 migrations (orchestrator note on 11-07, parked as P11-BL-01).

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `ab92728a` | test(11-21): add failing tests for the public Home read, the testimonial routes and their matrix rows |
| 1 (tracer) | GREEN | `79003729` | feat(11-21): a Manager adds a testimonial and the public Home read shows it first |
| 2 | RED | `7706b0c7` | test(11-21): add failing tests for the testimonial rules, audit, moves under the lock, hide, show and delete |
| 2 | GREEN | `ff0a0797` | feat(11-21): testimonial rules, moves under the lock, hide, show and delete with an audit trail that never copies the words |
| 3 | RED | `2d75a1a3` | test(11-21): add failing tests for the Home boot data, cache clearing on every testimonial change and the demo testimonials |
| 3 | GREEN | `dc6fac94` | feat(11-21): the / shell ships the Home data in its boot block and the demo testimonials come with the E2E seed |
| 3 | refactor | `1a1f413a` | refactor(11-21): drop an unreachable branch in Testimonial so Domain branch coverage is 100 percent |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and xunit v3 on Microsoft.Testing.Platform prints none of the formats it reads. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`ab92728a`): the run of `PublicHomeEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests` and the rate limit classes failed 31 of 564: the six Home tests (404 where 200 was expected), the matrix rows for the seven testimonial routes and the Home route for each caller, the discovery check ("9 items" uncovered) and the rate limit list. Semantic assessment: the target tests ran and failed because the routes did not exist. No compile stub was needed (HTTP and database level tests only).
- **Task 1 GREEN** (`79003729`): the same classes plus `OpenApiSnapshotTests` 575 of 575; `npm --prefix tools/openapi-gen run check` clean. The tracer's `<verify>` holds only `<automated>` commands, so they were re-run on the finished tree before expansion and passed: tracer verified end to end, expanding.
- **Task 2 RED** (`7706b0c7`): Domain 18 of 132 failed (the length and star rules, the catalog count 114 against 120 and the six codes); Application validator 7 of 10; Server `TestimonialEndpointTests` 8 of 20 (no audit entry, no lock, the field messages); Infrastructure 1 of 13 (a bug in my own test, see deviation 3).
- **Task 2 GREEN** (`ff0a0797`): Domain 132 of 132; Application validator and handlers 36 of 36; Infrastructure 13 of 13; Server `TestimonialEndpointTests`, `PublicHomeEndpointTests`, matrix and snapshot 543 of 543.
- **Task 3 RED** (`2d75a1a3`): 6 of 70 failed (the `home` key, the Home shell, the failing-read case, the two seed tests). The cache-clearing test passed at RED because the tracer already made `Testimonial` a public content record.
- **Task 3 GREEN** (`dc6fac94`): the same four classes 70 of 70. `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- **Weak spots, stated plainly:** the Task 1 tracer built first versions of update, move, hide, show and delete (no audit, no lock) so that the seven routes and the matrix rows could land together as the plan asks; Task 2 RED failed on exactly the missing parts. The handler unit tests (`TestimonialHandlerTests`, 26 tests) were written after the GREEN code to keep Application coverage above its floor; they were not red first. The Domain branch fix (`1a1f413a`) came from the coverage gate.

## Verification evidence (real output)

All runs on LocalDB (`CSPS_TEST_SQL=localdb`) in this worktree.

- **Task 1 verify:** `PublicHomeEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`, `RateLimitTests`, `PublicReadRateLimitTests`: `total: 575, failed: 0, succeeded: 575`. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- **Task 2 verify:** Server `TestimonialEndpointTests` (with the Home, matrix and snapshot classes) `total: 543, failed: 0`. Infrastructure `TestimonialsMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests`: `total: 13, failed: 0`. Application `TestimonialRequestValidatorTests` and `TestimonialHandlerTests`: `total: 36, failed: 0`. Domain `TestimonialTests` and `AuditActionsTests`: `total: 132, failed: 0`.
- **Task 3 verify:** Server `ShellHeadTests`, `PublicCacheInvalidationTests`, `TestingSiteContentTests`, `PublicHomeEndpointTests`: `total: 70, failed: 0`. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`, after the last source change): "Csps.Domain line 100% (3926/3926) branch 100% (1679/1679) PASS", "Csps.Application line 98% (10646/10856) PASS", "Coverage gate passed." (Domain 1767 tests, Application 2869 tests, none failed.) The first gate run failed Domain at branch 99.9% (1680/1681) on an unreachable `: 0` branch in `Testimonial.Apply`; fixed in `1a1f413a`.
- **Full Server integration run on the final tree:** `total: 2635, failed: 1, succeeded: 2634`. The one failure is `OpeningHoursEndpointTests.StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock`, the known order-dependent flake from plan 11-11. Run alone it passes (`total: 1, failed: 0`); the whole class fails the same test in this order (`total: 9, failed: 1`). Not caused by this plan and not touched.
- **Full Infrastructure integration run:** `total: 1148, failed: 0, succeeded: 1147, skipped: 1` (the live HIBP test that was already skipped).
- **Architecture tests** (`tests/Csps.ArchitectureTests`): `total: 290, failed: 0`.
- **Acceptance greps:** `CK_Testimonials_Stars` in the migration: 1. `GetPublicHome` in the snapshot: 1. `ShouldBe(120)` in `AuditActionsTests.cs`: 1. `Choose 1 to 5 stars.` in `Testimonial.cs`: 1. `"home"` in `PublicHeadWriter.cs`: 1.
- gitleaks `protect --staged` ran before every commit: no leaks. The staged diffs hold only made-up names ("Juan Dela Cruz", "Ana Reyes", "Ben Santos", "Carlo Mendoza", "Brgy. Sample Ballers") and no local path, real email, host or customer data.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The test stub reader and four lists outside the plan's file list**
- **Found during:** Task 1
- **Issue:** `IPublicContentReader` gained `GetHomeAsync`, so `StubPublicContentReader` (`ShellTestFactory.cs`) no longer compiled. The new public route also needed a row in the rate limit list (`RateLimitTests.cs`) and in the anonymous allow list of `AuthorizationMatrix.cs`, which the coverage tests demand.
- **Fix:** `StubPublicContentReader` got `Home`, `HomeFailure` and `GetHomeAsync`; the two lists got their row.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs`, `RateLimiting/RateLimitTests.cs`, `Authorization/AuthorizationMatrix.cs` (the last is in the plan's list)
- **Committed in:** `ab92728a`, `79003729`

**2. [Rule 1 - Existing test that pinned the old behavior]**
- **Found during:** Task 3
- **Issue:** `ShellHeadTests.EveryPublicPageAndTheNotFoundShellCarryTheSameSiteJsonAsTheApi` said every page except `/products` carries only `site`. `AuditActionsTests` pinned the count 114 and the order of the catalog.
- **Fix:** `/` now expects `site` and `home`; the catalog test lists 120 with the six codes last.
- **Committed in:** `7706b0c7`, `2d75a1a3`

**3. [Rule 1 - Bug in my own tests]**
- **Found during:** Task 2
- **Issue:** (a) The migration script test refused any `INSERT INTO`, but the idempotent script legitimately inserts the history row. (b) The endpoint tests counted audit rows by action only, and the class fixture keeps the append-only audit rows between tests, so counts depended on test order. (c) `InlineData(0)` for a `double?` parameter did not convert.
- **Fix:** (a) refuse `INSERT INTO [Testimonials]`; (b) scope every audit query to the test's own Manager id (the two-Manager race test to the two target ids); (c) `0d`, `6d`, `-1d`.
- **Committed in:** `7706b0c7`, `ff0a0797`

**4. [Rule 1 - Bug] An unreachable branch in `Testimonial.Apply`**
- **Found during:** coverage gate
- **Fix:** read the stars with `GetValueOrDefault()` after `Check` has refused a missing count. Behaviour unchanged.
- **Committed in:** `1a1f413a`

### Plan wording I did not follow

- **"testimonial.changed ('Quote changed', never the quote text)".** The detail is `fields=quote` (plus `name=old>new` and `stars=old>new`), which the Audit Log screen (plan 11-37) reads as "Quote changed". The literal sentence is not stored. This follows the convention of 11-13 and 11-17 (`fields=note` reads as "Note changed"). If the owner wants the literal words stored, it is one line in `TestimonialAuditDetail.Changed`.
- **Migration name.** `20261112171936_AddTestimonials`, not `20261116000001` (the plan said the real timestamp replaces it).
- **The tracer's controller has all seven actions** with first versions of update, move, hide, show and delete (no audit, no lock), as the plan asks ("all seven routes now, completed in Task 2").

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bugs or pinned old behavior; none in shipped behaviour beyond the stub and list rows). **Impact:** none on the product behaviour; three test support files outside the plan's list.

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. A new testimonial is hidden when the form leaves `isShown` out.**

| Option | What a Manager sees |
|---|---|
| **A (built, recommended):** missing means hidden on add, unchanged on edit. | Nothing goes public by accident. Plan 11-24 sends `isShown: true` from its ticked "Show on the website" box. |
| **B:** missing means shown. | A client that forgets the field publishes a testimonial at once. |

**OI-2. A move swaps with the next testimonial in the list, even a hidden one** (the same ruling shape as 11-17 OI-1). Recommendation: keep, so the announced position is true. Alternative: swap with the next shown one only, so the public order changes on every move.

**OI-3. The audit detail holds the person's name.** The name is the public name shown on the Home page, so it is not secret, and it makes the Audit Log readable. The quote and the team line are never copied. If the owner wants the audit log to hold no customer name at all, `Named` in `TestimonialAuditDetail` can write the id only.

**OI-4. Wording of the move direction error.** A bad direction answers the shared "Check the highlighted fields." line (as lines do). It can only come from a broken client.

## Issues Encountered

- The Bash tool in this worktree refuses commands that combine `git` with command substitution, a heredoc or a chain, so multi-line edits ran through short Python scripts written with the Write tool into the session scratchpad, and git commands ran one at a time.
- Full runs take several minutes (`dotnet format` about two minutes, the full Server run about ten); they ran in the background and the result was read from the output file.
- **Pre-existing, not touched (deferred):** `npm --prefix tools/openapi-gen run test` fails one test, "writes nothing to the committed types file". It replaces the text `"Formatting locale."` in the snapshot, but the snapshot at the base commit already says `"Formatting locale; read-only."`, so the replace changes nothing and the check exits 0 instead of 1. It fails the same way at `67b3e06e`. Recommendation: change the test to edit a string that exists, in a quick fix. `.planning/WINDOWS.md` was not touched: parallel executors share it, and the orchestrator merges the ledger after the wave.

## Known Stubs

| File | What | Why it is intentional | Resolved by |
|---|---|---|---|
| `src/Csps.Infrastructure/Content/PublicContentReader.cs` (`LoadHomeAsync`) | `recentWork` is always `[]` and `heroTag` always `null` | The plan says plan 11-26 fills both from the shown orders | 11-26 |
| `src/Csps.Application/Content/PublicHomeDto.cs` | `PublicRecentWorkDto` has a first shape that nothing fills yet | Same | 11-26 (may adjust the fields) |

## Authentication Gates

None.

## Threat Flags

None beyond the plan's threat model. T-11-52 (class-level `Policies.Manager` and seven matrix rows, an Admin test on every route), T-11-53 (the quote is plain text: React escapes it on the page, and the boot block JSON uses the default encoder that escapes `<`, `>` and `&`; an unchanged mechanism that the existing script-breakout test covers for the site JSON) and T-11-54 (the audit names the person and the changed fields, never the quote; asserted by two endpoint tests and a handler test) and T-11-SC (no package added or bumped) are covered. `GET /api/v1/public/home` is a new anonymous route: it sends only the shown lines' card data and the shown testimonials, nothing private, and it is rate limited (600 a minute) like the other public reads.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-24 (Testimonials tab):** the contract is in `api.generated.ts` (`TestimonialDto`, `TestimonialRequest`, `MoveTestimonialRequest`). The request is `{ quote, name, teamOrRole, stars, isShown, version }`; send `isShown: true` for the ticked default. Field errors come under `quote`, `name`, `teamOrRole`, `stars` and `version`. zod must mirror `Testimonial.Check` (trim first; 300, 60, 80; whole stars 1 to 5). A stale edit is `409 edit.stale`.
- **11-25 (Home page):** `home` is in the `/` boot block and at `GET /api/v1/public/home`. Lines carry `cardPhoto { src, srcSet, width, height }` or `null` (use `placeholderArt`); testimonials carry `quote`, `name`, `teamOrRole`, `stars`. With no lines or no testimonials, leave the section out.
- **11-26 (Recent work):** fill `recentWork` and `heroTag` in `PublicContentReader.LoadHomeAsync` (same snapshot, so one cache clear covers all); `PublicRecentWorkDto` is a first shape. Also take the site-content lock on gallery writes.
- **11-37 (audit labels):** `testimonial.added`, `.hidden`, `.shown`, `.deleted`: detail `name=...`. `testimonial.moved`: `name=...;position=2>1`. `testimonial.changed`: `fields=quote,name,teamOrRole,stars` plus `name=old>new;stars=old>new`; read `fields=quote` as "Quote changed". `AuditActions.All` is 120 after this plan; the count in `AuditActionsTests` (and the web test's hand-listed catalog) will conflict with parallel plans after merge, so re-check it.
- **Contract hot spots:** `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` will conflict with other wave plans; regenerate after merge with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, then `npm --prefix tools/openapi-gen run generate`. `AuditActions.All` and its two tests in `AuditActionsTests` will conflict too.
- **Respawn:** `Testimonials` is not on the ignore list, so `CspsDatabase.ResetAsync` clears it. The audit table is append-only and survives a reset: scope audit assertions to the test's own actor.
- **Public bundle:** untouched (no web source change; only the generated types file grew, additive).

## Self-Check: PASSED

- Files: the 26 created files in `key-files.created` exist on disk (26 of 26 checked).
- Commits `ab92728a`, `79003729`, `7706b0c7`, `ff0a0797`, `2d75a1a3`, `dc6fac94` and `1a1f413a` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 7 (`git rev-list --count 67b3e06e..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file, not written from memory.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
