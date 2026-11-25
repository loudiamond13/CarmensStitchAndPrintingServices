---
phase: 13-quote-inquiries
created: 2026-11-25T01:44:00-06:00
updated: 2026-11-25T01:44:00-06:00
reviewed: 2026-11-25T01:44:00-06:00
depth: standard
wave: 12
plans: [13-27]
diff: b368442f..0d7e9dc6
files_reviewed: 8
files_reviewed_list:
  - src/Csps.Application/Images/PublicIds.cs
  - src/Csps.Application/Maintenance/ImageRemovalJob.cs
  - src/Csps.Application/Maintenance/StraySweepJob.cs
  - tests/Csps.Application.UnitTests/Images/PublicIdsTests.cs
  - tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs
  - tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs
  - tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs
  - docs/operations/maintenance.md
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
status: issues_found
---

# Phase 13: Code Review Report (wave 12, plan 13-27)

*Created: 2026-11-25T01:44:00-06:00 · Updated: 2026-11-25T01:44:00-06:00*

**Reviewed:** 2026-11-25T01:44:00-06:00
**Depth:** standard (with call-chain checks into `ImageInventory`, `ImageDeletionQueue`, `CloudinaryImageStorage`, `CloudinarySettings`, `TestingImageStorage` and every place that queues a removal)
**Files Reviewed:** 8 (the 13-27 plan, the summary and G2A-CR-01 in `13-REVIEW.md` were read for context only)
**Status:** issues_found

## Summary

I read the whole 13-27 diff and the code it calls. I did not run tests or a build. The only commands were read-only greps and `git diff`/`git show`.

The fix for G2A-CR-01 is correct and safe. I found no blocker. What holds up:

- **Only the three own folders are accepted.** `PublicIds.IsInOwnFolder` checks the id against `{root}/orders/`, `{root}/content/` and `{root}/quotes/`, each with the trailing slash, by ordinal comparison (`PublicIds.cs:42-46`). A lookalike root (`csps-test-more/`), a lookalike folder (`quotes-old/`, `content-old/`), a folder with no slash (`csps-dev/quotes`), other letter case and another environment's root (`csps/` from `csps-test`) are all refused. Both `PublicIdsTests` and `ImageRemovalJobTests` pin this, and the removal job test also proves the refused row never reaches the storage (`Storage.Removals` holds only the orders row).
- **The root cannot widen the check.** `CloudinarySettings.Validator` only allows `^[a-z0-9-]+$` for the root, so it cannot hold a slash or be blank on a configured host. A blank root now throws instead of building `/orders/`.
- **The named-by-photo drop still runs first** (`ImageRemovalJob.cs:192-196`, then the folder check at `:199`). `ImageInventory.NamedByPhotosAsync` reads all five photo tables (order images with soft-deleted orders, product line photos, gallery entries, the share picture and quote request photos). None of the content or quote tables has a query filter that could hide a live row. So a content or quote file that a row still names is never sent to Cloudinary. This matters now, because those files really get removed for the first time.
- **Stuck rows clear as the plan says.** `ImageDeletionQueue.ClaimDueAsync` has no attempt limit or back-off (`NextAttemptAtUtc <= now`), so a row stuck as `outside-folder` with 5 or more attempts is claimed on the next run, removed and counted on "Photos removed from storage". The unit test with 7 attempts proves there is no attention line or log.
- **One source.** The sweep's three passes use `PublicIds.OrdersPrefix`, `ContentPrefix` and `QuotesPrefix`, and the job uses `IsInOwnFolder`, which builds on the same `OwnFolders` list. The stored ids (`Folder`, `QuoteFolder`, `ContentFolder`) use the same segment constants.
- **The end-to-end tests are real.** The Spam test goes through the staff API and the maintenance endpoint, and `TestingImageStorage.TryGet` really searches by the last id segment, so the "file is gone" checks are not empty.
- **Every queued id is made by the server** (the `PublicIds` makers or the storage listing). No API lets a client name an id for removal.
- **Project rules hold.** No em or en dash in any added line (byte check for U+2013 and U+2014). No inline SQL. Every new public member has an XML doc. Comments are short. The runbook's `updated` value changed and `created` did not.

The one warning is in the runbook: the "still failing" row tells the owner to press Run now and check the Cloudinary account for every code, which can never fix an `outside-folder` row. The info items are small hardening steps, stale wording and test gaps.

## Warnings

### WR-01: The runbook gives the wrong action for an `outside-folder` row

**File:** `docs/operations/maintenance.md:93`
**Issue:** This row was edited in the diff. After the fix, `outside-folder` only happens when a queue row names another environment's file, for example after production rows were copied into a dev database. The "What to do" cell says, for every code: "Press Run now later. If it keeps failing, check the Cloudinary account". For `outside-folder` that never helps. The row fails again on every run, the run stays red for 4 runs, and Cloudinary is not the cause. The right action (delete the row by hand once you have checked it belongs to another site) is only on the next row, "needing attention", which the owner reaches only after 5 failures.
**Fix:** Split the action by code in that cell, for example: "`transient` or `refused`: press Run now later; if it keeps failing, check the Cloudinary account. `outside-folder`: the row names a file of another site or environment. Running again will not help. Check the row and delete it by hand in the database." Change only the `updated` value in the line under the title.

## Info

### IN-01: The pin test ties the sweep to `OwnFolders`, not to what the job accepts

**File:** `tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs:467-474`, `src/Csps.Application/Images/PublicIds.cs:42-46`
**Issue:** `TheSweepListsExactlyTheFoldersTheRemovalJobAccepts` compares the sweep's listings with `PublicIds.OwnFolders("csps-test")`. It does not look at the removal job. Today `IsInOwnFolder` uses `OwnFolders`, so the claim holds. But if someone later widens `IsInOwnFolder` with an extra prefix, this test still passes. Only the single `csps-dev/other/x` case in `PublicIdsTests` would stand in the way, and only for that one name.
**Fix:** Add one assertion that ties the job to the same list, for example a removal job theory that queues one id under each `PublicIds.OwnFolders("csps-test")` entry and one under `csps-test/legacy/` and checks that exactly the first three reach `Storage.Removals`.

### IN-02: `IsInOwnFolder` accepts the bare folder and empty or `..` segments

**File:** `src/Csps.Application/Images/PublicIds.cs:42-46`
**Issue:** `csps/quotes/` itself (nothing after the slash), `csps/quotes//x` and `csps/quotes/../orders/x` all pass. Cloudinary treats a public id as a plain string, and every queued id is made by the server or comes from the storage listing, so I found no live path to harm. But a bare folder id would be sent to Cloudinary, come back "not found" and be counted as "removed", which hides a bad row.
**Fix:** Also require a non-empty rest with no empty or `.`/`..` segment, for example `publicId.Length > folder.Length && !publicId[folder.Length..].Split('/').Any(part => part is "" or "." or "..")`, with test cases for the three shapes.

### IN-03: A second, unused orders prefix is left in Infrastructure

**File:** `src/Csps.Infrastructure/Images/CloudinarySettings.cs:33-37`
**Issue:** `CloudinarySettings.OrdersPrefix` still builds `$"{RootFolder}/orders/"` by hand. No production code uses it. Only `CloudinarySettingsTests.cs:126-127` does. It is a second source for a folder that `PublicIds` now owns, and its doc only names orders.
**Fix:** Remove the property and move its two test lines to `PublicIdsTests` (they already have the same cases), or make it call `PublicIds.OrdersPrefix(RootFolder)`.

### IN-04: Stale wording about the folders

**File:** `src/Csps.Application/Maintenance/StraySweepJob.cs:183`, `src/Csps.Application/Images/PublicIds.cs:7`, `docs/operations/cloudinary-setup.md:190-191`
**Issue:** The `SweepRun` comment says "across both folders" (there are three). The `PublicIds` class summary says it "makes the ids order photos are stored under", but it now also makes quote and content ids and owns the folder check. `cloudinary-setup.md` says "The daily cleanup looks at both folders", orders and content, and does not name quotes.
**Fix:** "across the three folders"; widen the class summary to "Makes the ids photos are stored under and tells whether an id is in this environment's own folders"; in `cloudinary-setup.md` name the three folders (orders, content and quotes). Update the `updated` value of the doc.

### IN-05: No test pins the order of the two checks for an outside row that a photo names

**File:** `src/Csps.Application/Maintenance/ImageRemovalJob.cs:192-203`, `tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs:322-334`
**Issue:** The named-by-photo drop runs before the folder check, as the plan says. But the only new named-by-photo test uses an id inside the own folders, where the order makes no difference. If the two checks were swapped, no test would fail. Both orders are safe (neither calls the storage), so this only changes whether such a row is dropped or kept as `outside-folder`.
**Fix:** Add a test that queues `csps/quotes/...` (another environment's root), names it in `Inventory.Photos`, and checks that the row is dropped, the storage gets no call and there is no failed line.

### IN-06: The first live run after the deploy removes the whole stuck backlog at once

**File:** `src/Csps.Application/Maintenance/ImageRemovalJob.cs:103-153`, `docs/operations/maintenance.md:74-76`
**Issue:** Every content and quote row queued since Phase 11 and stuck as `outside-folder` is now claimed and removed in the first run, 25 at a time, with no cap like the sweep's 50 (D-52) and no preview. Each row is still checked against the photo rows first, so a file in use is safe. This is what the plan wants (one-way, settled by D-04, D-22 and Phase 9 D-07). But the owner gets no step to look at the backlog before it goes, and Cloudinary removals cannot be undone.
**Fix:** Owner's call. One option: add a one-time step to the deploy checklist to count the live queue rows with `LastFailureCode = 'outside-folder'` by folder (a read-only look in SSMS) before the first run. Another: accept it as is and record that in the phase notes.

---

_Reviewed: 2026-11-25T01:44:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
