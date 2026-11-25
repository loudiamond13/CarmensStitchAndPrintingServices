---
phase: 13-quote-inquiries
plan: 27
subsystem: maintenance
tags: [photo-removal, cloudinary, gap-closure, tdd]
gap_ids: [G-13-11]
requires: []
provides:
  - "Photo removal job accepts the three own folders (orders, content, quotes)"
  - "PublicIds.OrdersPrefix, ContentPrefix, QuotesPrefix, OwnFolders, IsInOwnFolder"
affects: [image-removal, stray-sweep, maintenance-runbook]
tech-stack:
  added: []
  patterns: ["one source for the own folder prefixes, pinned by a test"]
key-files:
  created: []
  modified:
    - src/Csps.Application/Images/PublicIds.cs
    - src/Csps.Application/Maintenance/ImageRemovalJob.cs
    - src/Csps.Application/Maintenance/StraySweepJob.cs
    - tests/Csps.Application.UnitTests/Images/PublicIdsTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs
    - docs/operations/maintenance.md
decisions:
  - "Followed D-04, D-22 and Phase 9 D-07: accept exactly the three own folders with the trailing slash, refuse everything else as outside-folder"
requirements: [INQ-05, INQ-06, INQ-07]
status: complete
commits: 3
plan_head_before: b368442f72d575d781f169652214b0bf411efa7c
plan_head_after: a248e1e15079571c177916657161a678876f8b32
actuals:
  tokens: 14000
  tasks: 2
  commits: 3
created: "2026-11-25T01:25:00-06:00"
updated: "2026-11-25T01:25:00-06:00"
---

# Phase 13 Plan 27: Queued quote and content photos are really removed from the storage Summary

*Created: 2026-11-25T01:25:00-06:00 · Updated: 2026-11-25T01:25:00-06:00*

**The photo removal job now accepts the environment's three own folders (orders, content, quotes), so Spam, delete and purge rows really leave the storage, and everything outside those folders is still refused.**

gap_ids: [G-13-11]

13-REVIEW G2A-CR-01: fixed by 13-27 (fix commit `262c0f1502ab61ea03cc28c4981f4e3de929cb1b`). `/gsd-code-review 13 --fix` should record this outcome and not fix it again.

## Note for the owner (plain words)

Content photo removals have failed since Phase 11, and quote photo removals since Phase 13. The job only accepted the orders folder, so every other row failed as `outside-folder` and stayed queued. That is why the photos were still in Cloudinary after you marked a request Spam (UAT test 11).

Rows that were stuck are still claimed on every run. The first run after this fix removes them, and each one is checked first against the photo rows, so a file that is still in use is never removed. That includes the CSPS_Dev row left by UAT test 9. After the next deploy it also covers any such rows on the live site. UAT test 11 is ready to re-run: mark a request with photos as Spam, press Run now, and the photos should leave the dev quotes folder with no failing removals.

## What changed

- `PublicIds` has the three prefixes (`OrdersPrefix`, `ContentPrefix`, `QuotesPrefix`), `OwnFolders` (orders, content, quotes in that order) and `IsInOwnFolder` (ordinal match, trailing slash). `Folder`, `QuoteFolder` and `ContentFolder` build on the same segment constants, and their output is unchanged.
- `ImageRemovalJob` checks each claimed row with `PublicIds.IsInOwnFolder(root, row.PublicId)` and keeps the same failure path. The named-by-photo drop check still runs first. Claims, leases, retries, attention rows (D-55) and report lines are unchanged.
- `StraySweepJob` lists the same three prefixes from `PublicIds`. Behavior did not change.
- `docs/operations/maintenance.md` no longer says removals are limited to the orders folder. It explains `outside-folder` in terms of the three own folders.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 RED | Failing unit and end-to-end tests | `5f57b8385a1001988e9bf2442ce388cbda5a6380` test(13-27) |
| 1 GREEN | Removal job accepts the three own folders | `262c0f1502ab61ea03cc28c4981f4e3de929cb1b` fix(13-27) |
| 2 | Sweep shares the folders, pin test, runbook | `a248e1e15079571c177916657161a678876f8b32` refactor(13-27) |

## TDD evidence

### RED (before the fix)

Unit, `ImageRemovalJobTests` (PublicIdsTests removed from the run only so the project compiles; they fail to compile on their own):

```
total: 38   failed: 3   succeeded: 35
failed AQuotesRowStuckAsOutsideFolderIsRemovedOnTheNextRunWithNoAttentionLine
failed AFileInTheQuotesFolderIsRemovedThroughTheStorageAndItsRowDeleted
failed AFileInTheContentFolderIsRemovedThroughTheStorageAndItsRowDeleted
  (each: harness.Storage.Removals should be [...] but was [])
```

Unit, `PublicIdsTests`: compile errors `CS0117: 'PublicIds' does not contain a definition for 'OwnFolders'` (also `OrdersPrefix`, `ContentPrefix`, `QuotesPrefix`, `IsInOwnFolder`).

End to end, `*ImageCleanupRunTests` with `CSPS_TEST_SQL=localdb`:

```
total: 10   failed: 2   succeeded: 8
failed AQuoteRequestMarkedSpamHasItsPhotosRemovedFromTheStorageByTheNextRun
  run.Ok should be True but was False; "Photo removals still failing": 2
failed AQueuedContentPhotoIsRemovedFromTheStorageByTheNextRun
  run.Ok should be True but was False; "Photo removals still failing": 1
```

### GREEN (after the fix)

| Command | Result |
|---------|--------|
| `*ImageRemovalJobTests` + `*PublicIdsTests` | total 52, failed 0 |
| `*ImageCleanupRunTests` (localdb) | total 10, failed 0, succeeded 10 |
| `*StraySweepJobTests` + `*ImageRemovalJobTests` + `*PublicIdsTests` | total 94, failed 0 |
| `dotnet build Csps.slnx -warnaserror` | 0 Warning(s), 0 Error(s) |
| `Csps.Application.UnitTests` (whole project) | total 3513, failed 0 |
| `Csps.ArchitectureTests` | total 290, failed 0 |
| `*ImageCleanupRunTests` + `*MaintenanceEndpointTests` + `*QuoteRequestStatusTests` + `*DeleteQuoteRequestTests` (localdb) | total 42, failed 0 |

`TheSweepListsExactlyTheFoldersTheRemovalJobAccepts` passes at once by design: it pins the shared source and fails only if one job later gains a folder the other lacks. It is not a red test.

Grep gates (after): `PublicIds.IsInOwnFolder` in the job 1; `RootFolder}/` in job and sweep (comments filtered) 0 and 0; `own orders folder` in the job and the runbook 0 and 0; `OwnFolders` in PublicIds 2; `/quotes/` and `/content/` in the removal tests 3 and 3; the Spam test name 1; `PublicIds.` in the sweep 3; the pin test 1; the runbook phrases `own folders (orders, content and quotes)` 1 and `not in one of this site's own folders` 1.

The preflight (ports 5180, 5115, 7028, 5199 free, no dev processes) ran before each integration run. No flake was seen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED integration test did not compile**
- **Found during:** Task 1 RED (resumed from the previous executor's patch)
- **Issue:** `ShouldAllBe(photo => ... [..] ... out _)` uses a range and a discard inside an expression tree (CS8207, CS8790, CS8792).
- **Fix:** replaced it with a plain `foreach` over the two photos.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs`
- **Commit:** `5f57b8385a1001988e9bf2442ce388cbda5a6380`

**2. [Process] Plan commit ledger not written**
- The worktree guard blocked writing the ledger file under the shared git directory, so `plan_head_before` is the plan base `b368442f72d575d781f169652214b0bf411efa7c` from the dispatch. `git rev-list --count` from that base to HEAD gives 3, matching the three commits above.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change. T-13-73 to T-13-76 are mitigated by the tests above.

## Self-Check: PASSED

- Files found: `PublicIds.cs`, `ImageRemovalJob.cs`, `StraySweepJob.cs`, the four test files and `docs/operations/maintenance.md` (all edited in the three commits).
- Commits found in the branch: `5f57b838`, `262c0f15`, `a248e1e1`.
