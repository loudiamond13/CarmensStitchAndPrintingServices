---
phase: 13-quote-inquiries
plan: 08
subsystem: maintenance
tags: [retention, quote-requests, image-storage, stray-sweep, ef-core, tdd]
created: "2026-11-22T19:20:00-06:00"
updated: "2026-11-22T19:20:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "QuoteRequests and QuoteRequestPhotos tables, the quote photo upload and the {root}/quotes/ folder (plans 13-01, 13-03, 13-05)"
provides:
  - "QuoteRequestRetention: Months = 6 and PurgeBefore(today, zone), the start of the Manila business day 6 calendar months back"
  - "QuoteRequestRetentionJob (order 12, quote-request-retention): purges unconverted requests older than the cut, queueing every stored photo as QuotePurged first"
  - "ImageDeletionReason.QuoteSpam = 6, QuoteDeleted = 7, QuotePurged = 8"
  - "StraySweepJob third pass over {root}/quotes/ with cursor stray-sweep-quotes"
  - "ImageInventory knows stored QuoteRequestPhotos public ids"
affects: [13-16, 13-18, 13-25]

actuals:
  tokens: 12000
  tasks: 2
  commits: 4
plan_head_before: 0d16c25af42d132e4663b8bb9b744be411513fc6
plan_head_after: 023617c92ed4308504d559252ca9a26b8bf45db9

tech-stack:
  added: []
  patterns:
    - "A retention job that queues files and deletes rows in one transaction, so a failure leaves both untouched"
    - "A batch that changed under the job (delete count differs from the read count) is rolled back and the run reports More"

key-files:
  created:
    - src/Csps.Domain/QuoteRequests/QuoteRequestRetention.cs
    - src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs
    - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestRetentionTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
  modified:
    - src/Csps.Application/Ports/IImageDeletionQueue.cs
    - src/Csps.Application/Maintenance/StraySweepJob.cs
    - src/Csps.Infrastructure/Images/ImageInventory.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
    - tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs
    - docs/operations/maintenance.md

key-decisions:
  - "The purge deletes by status != Converted and CreatedAtUtc < cut, whatever the other status (Spam and Closed are purged like any other), as the plan says"
  - "Photos are queued with the same context the job deletes on, inside one transaction, so queue rows and request deletes commit or roll back together"
  - "A batch whose delete count differs from its read count (a request was converted or taken by another run in between) is rolled back and the job reports More, so no photo is queued for a request that stayed"

patterns-established:
  - "Retention constants live in Domain as a static class with a pure cut helper, reusing BusinessClock.UtcRange for the local-midnight to UTC step"

requirements-completed: [INQ-07]

coverage:
  - id: D1
    description: "QuoteRequestRetention.PurgeBefore gives the start of the Manila business day 6 calendar months back, with month ends clamped"
    requirement: INQ-07
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestRetentionTests.cs (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The daily run removes unconverted requests received before the cut, queueing each stored photo as QuotePurged; converted requests and requests at the cut stay"
    requirement: INQ-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs (12 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The stray sweep covers {root}/quotes/ with its own cursor and the inventory knows stored quote photos"
    requirement: INQ-07
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs (41 tests)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs (12 tests)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 08: Quote requests that never became orders, and their photos, are removed after 6 months Summary

*Created: 2026-11-22T19:20:00-06:00 · Updated: 2026-11-22T19:20:00-06:00*

**A daily job removes quote requests older than 6 months that never became orders, queues their photos for removal first, and the stray sweep and image inventory now cover the quotes folder.**

## What was built

- `QuoteRequestRetention` (Domain): `Months = 6` and `PurgeBefore(DateOnly today, TimeZoneInfo zone)`. It takes the day 6 calendar months back (a missing day number is clamped, so 2026-08-31 gives 2026-02-28) and returns that day's local midnight as a UTC instant, using the existing `BusinessClock.UtcRange`.
- `QuoteRequestRetentionJob` (Infrastructure, order 12, name `quote-request-retention`, batch 200): per batch, in one transaction, it reads up to 200 ids of requests that are not Converted and were received before the cut, queues every non-null photo id with `QuotePurged`, saves, then deletes the requests with `ExecuteDeleteAsync` (photo rows go by the existing cascade). The line is "Old quote requests removed" with a count only. A database failure gives the failed line "The old quote requests could not be removed." and never throws; the transaction rolls back, so nothing is queued or removed. It is registered in `MaintenanceRegistration` and runs before the photo removals job (30).
- `ImageDeletionReason` gains `QuoteSpam = 6`, `QuoteDeleted = 7`, `QuotePurged = 8`. The reason column has no check constraint, so there is no migration.
- `StraySweepJob`: a third pass over `{root}/quotes/` with `QuotesCursorName = "stray-sweep-quotes"`, after orders and content, under the same shared cap of 50 and the same budget and unreadable-storage stops.
- `ImageInventory`: the one union command now also names `QuoteRequestPhotos.PublicId` (non-null), so `KnownAsync` and `NamedByPhotosAsync` see live quote photos. The 500-id page is still checked in two commands.
- `docs/operations/maintenance.md`: the new job row, a section on the quote purge, the quotes folder in the photo jobs section and the third cursor.

## Answer to the WR-02 question (wave 2 review)

Yes. The sweep's quotes pass covers quote photo files under `{root}/quotes/`. A photo file with no `QuoteRequestPhotos` row naming it and no queued removal row, older than 2 days, is queued as `Stray` and removed in the same run. That covers the case where the upload reached storage and the final save failed. A live photo is never queued because the inventory names it. Files younger than 2 days are left alone, so an upload still saving is safe. One limit remains: the sweep removes such a file after 2 days, not at once, and the cap of 50 strays per run applies.

## TDD record

Task 1 (tracer, domain and job):
- RED commit `76356504`. A compile-only scaffold (stub constants and a stub job returning a zero line) so every test fails on its assertion. Domain: 6 of 6 failed (for example `QuoteRequestRetention.Months should be 6 but was 0`, and the cut `should be 5/20/2026 4:00:00 PM +00:00 but was 1/1/0001`). Integration: 9 of 11 failed (for example `Line(report, RemovedLabel).Value should be 1L but was 0L`, `job.Order should be 12 but was 0`). The 2 that passed were the keep-it guards (a request at the cut, a converted request), which hold trivially while a stub removes nothing. They are real regression guards after GREEN.
- Semantic assessment: the target tests ran and failed on the planned values, not on setup, fixtures or compile errors.
- GREEN commit `a44a8262`. Domain 6 of 6 pass. Integration 12 of 12 pass (a numbers test for the three reasons was added with GREEN).

Task 2 (sweep and inventory):
- RED commit `52ab39cd`. Stray sweep 6 of 41 failed (for example `harness.QuotesListings should be [(csps-test/quotes/, quotes-7)] but was []`, and the prefix list `["orders/", "content/"]` instead of three folders). One of the six (`TheCapIsShared...`) fails on `Single(line => line.Failed)` finding no limit line, which is the planned missing red line. Image inventory 1 of 12 failed (`known should be [quote photo, live photo] but was [live photo]`). The `QuotesCursorName` constant was added as compile scaffolding.
- GREEN commit `023617c9`. Stray sweep 41 of 41 pass, inventory and retention 24 of 24 pass.

The RED outputs are xUnit Microsoft Testing Platform console text, which is not one of the report formats `gsd_run check tdd-red-evidence` reads, so the classifier was not used. The RED evidence above is the real console output, assessed by hand. No refactor commit was needed.

## Verification run (quoted results)

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*QuoteRequestRetentionTests"`: total 6, failed 0.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*ImageInventoryTests" --filter-class "*QuoteRequestRetentionJobTests"`: total 24, failed 0.
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests"`: total 41, failed 0.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests" --filter-class "*ImageCleanupRunTests"`: total 22, failed 0.
- `dotnet build Csps.slnx -warnaserror`: Build succeeded, 0 Warning(s), 0 Error(s).
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- Preflight ran before the first integration run: ports 5180, 5115, 7028, 5199 free, no dev or test processes. `gitleaks protect --staged` found no leaks on all four code commits.

## Deviations from Plan

None that change behavior. Notes:

1. **[Info] Co-author line.** The plan text names Claude Opus 5.5. The commits use the line the harness gave this run (Claude Sonnet 5.5).
2. **[Info] Branch rule.** The plan's executor rule says to stay on `gsd/phase-13-quote-inquiries`. This run was a parallel worktree executor on its own `worktree-agent-*` branch, as the orchestrator instructed. No branch was created or switched.
3. **[Rule 2 - Missing critical] Race guard in the purge.** If the delete count differs from the read count (a request was converted, or another run removed it, between the read and the delete), the batch is rolled back and the job reports More. This keeps D-22 true under a race and avoids queueing photos for a request that stayed. It is covered by the transaction design; no separate test forces the race.
4. **[Info] Extra test.** `TheQuoteRemovalReasonsKeepTheirStoredNumbers` pins 6, 7 and 8, since the numbers are stored.
5. **[Info] Existing test updated.** `TheOrdersPassRunsFirstAndAnOrdersFileIsNeverJudgedByTheContentPass` now expects the third listing prefix (quotes), in the RED commit.

## Auth gates

None.

## Known Stubs

None. The RED scaffold stubs were replaced in the GREEN commits.

## Threat Flags

None. No new endpoint, auth path or schema. The job deletes data only by the tested cut and excludes Converted (T-13-25); photos are queued before rows go (T-13-23); the quotes pass and inventory union close the orphan gap (T-13-24). No package was added or bumped (T-13-SC).

## Flakes

None seen. No test was re-run to clear a failure.

## Self-Check: PASSED

- Files found: `QuoteRequestRetention.cs`, `QuoteRequestRetentionJob.cs`, `QuoteRequestRetentionTests.cs`, `QuoteRequestRetentionJobTests.cs`, and the modified files listed above.
- Commits reachable from HEAD: `76356504`, `a44a8262`, `52ab39cd`, `023617c9`.
- Acceptance greps: `QuoteRequestRetentionJob` is registered in `MaintenanceRegistration.cs`; `QuotePurged` is in `IImageDeletionQueue.cs`; `quotes/` is in `StraySweepJob.cs`; `QuoteRequestPhotos` is in `ImageInventory.cs`.
- STATE.md and ROADMAP.md were not modified.
