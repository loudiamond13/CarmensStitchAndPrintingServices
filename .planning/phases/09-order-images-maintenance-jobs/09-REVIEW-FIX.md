---
phase: 09-order-images-maintenance-jobs
created: 2026-11-05T21:23:29-05:00
updated: 2026-11-06T01:23:00-06:00
iteration: 1
fix_scope: critical_warning
findings_in_scope: 33
fixed: 33
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

*Created: 2026-11-05T21:23:29-05:00 · Updated: 2026-11-05T22:56:00-06:00*

Five fixers ran one after another, one per review lane, on branch `gsd/phase-10-admin-dashboard`. Each fix is its own commit. Info findings were out of scope.

In scope: 1 critical and 28 warnings from `09-REVIEW.md`, plus IN-G2-06 (promoted to a warning) and C-1 (a follow-up check on WR-G1B-04's empty photo addresses).

| Lane | In scope | Fixed | Skipped |
|------|---------:|------:|--------:|
| G1A backend core | 7 | 4 | 3 |
| G1B backend infra and server | 4 | 4 | 0 |
| G2 backend tests | 10 | 10 | 0 |
| G3 web source | 4 | 3 | 1 |
| G4 CI, docs, tools, e2e | 6 | 6 | 0 |
| **Total** | **31** | **27** | **4** |

## Owner rulings (2026-11-05) and their fixes

The four skipped findings were ruled on by the owner and then fixed:

- **WR-G1A-03 (D-52):** the stray sweep queues at most 50 files per run; more turns the run red.
- **WR-G1A-02 (D-54):** the sweep saves its listing place in the new MaintenanceCursors table (additive migration 20261106033839_AddMaintenanceCursors).
- **WR-G1A-07 (D-55):** a removal that has failed 5 times stays queued and shows as "needing attention" without turning the run red.
- **WR-G3-03 (D-53):** the browser checks the 25 megapixel and side limits on the shrunk photo; originals over 100 megapixels are still refused.

## Second review fixes

- **WR-R2-01:** the docs now say the maintenance branch guard only stops accidental runs. Limiting MAINTENANCE_KEY to main needs a GitHub environment: parked for the owner (backlog).
- **WR-R2-02:** the photo host lock checks a moved lock's own age before deleting it, and never deletes a live lock it could not put back (test first).
- Info IN-R2-01 to IN-R2-03 are out of scope and recorded only.

## Behavior choices made by fixers (owner may want to confirm)

- **WR-G1B-02:** the maintenance lease is now 10 minutes (was 3). The worst case is about 340 s. After an app restart cuts a run off, the next run can wait up to 10 minutes.
- **WR-G4-02:** the maintenance workflow now runs only on `main`. A manual run from another branch shows a skipped job.
- **C-1:** an empty photo address now shows the existing missing-photo placeholder right away.

## Final verification (orchestrator, after all fixes)

- Preflight: ports 5180, 5115, 7028 and 5199 free; no other project's test processes.
- `dotnet build Csps.slnx -warnaserror`: Build succeeded, 0 warnings, 0 errors.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: total 7049, failed 0, succeeded 7047, skipped 2 (symbolic link permission; live HIBP opt-in).
- `npm run typecheck`: passed. `npm run lint` (`--max-warnings 0`): passed.
- `npm run test`: 284 test files, 8038 tests passed.
- **Not run:** Playwright e2e. The e2e changes (WR-G4-03 lock, WR-G4-05 shared helpers) and the owner-review fix (CR-G4-01, WR-G4-01) have not been executed in a browser.
- Commit attribution: lanes G1A, G1B and G4 use the Opus 5.5 trailer; lanes G2 and G3 use Sonnet 5.5 (the model that ran them).

### Phase 9 branch, after the second review (2026-11-06, worktree `.claude/worktrees/p09`)

- Preflight: ports 5180, 5115, 7028 and 5199 free; no other project's test processes.
- Web: `npm run typecheck` passed; `npm run lint` passed; `npm run test`: 283 files passed, 1 failed (8047 of 8048 tests). The one failure is `scripts/license-policy.test.ts` ("exits 1 on a stricter policy given through --exceptions"): "No packages found in this path". It fails only in the worktree folder; the same files pass in the main folder (8045 of 8045 there). Recorded as environment-only; CI on the PR is the check.
- `dotnet build`: 0 errors. `CSPS_TEST_SQL=localdb dotnet test`: total 7084, failed 0, succeeded 7082, skipped 2.
- Full e2e (`npm run e2e`): 1630 passed, 57 skipped, 32 failed in 1.8 h. All 32 were outside the photo specs (1 Firefox, 12 WebKit, 19 iPhone).
- Re-run of those 32 alone (`--last-failed --workers=2`): 15 passed, 17 failed, all in WebKit or iPhone. Each waits 5 s for the `/dev/components` heading ("Component Showcase") and does not find it, or times out on that page. This is open item 3 of `09-30-SUMMARY.md` (the showcase is borderline in WebKit since the Order photos cases were added). Parked for the owner as P9-BL-10 in Phase 999.5; CI runs Chromium and the phone viewport only, where these pass.
- Every photo spec (`@order-photos*`, `G-09-10`) passed in all five projects.

---


## Phase 9 lane G1A: code review fix report

Branch: gsd/phase-10-admin-dashboard (no branch switch, no worktree). Iteration 1.
WR-G1A-03 was not touched: skipped, owner ruling needed.
Checks ran in the main checkout, not a worktree.

Test command used throughout (bash, variable set for that one command only):
`CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Application.UnitTests --filter-class "<class>"`

### Fixed

#### WR-G1A-01: WebP size limit bypass
- Commit: 07ceddbb
- Files: src/Csps.Application/Images/ImageSniffer.cs, tests/Csps.Application.UnitTests/Images/ImageSnifferTests.cs
- Fix: an extended WebP whose real frame is wider or taller than its VP8X canvas now gives no answer (refused). Test added first; it failed ("should be null but was ImageFacts { Width = 1, Height = 1 }"), then passed.
- Result: ImageSnifferTests + ImageMetadataStripperTests: 157 total, 0 failed.

#### WR-G1A-05: HEIC strip top-level walk
- Commit: 8a16d03d
- Files: src/Csps.Application/Images/ImageMetadataStripper.Heic.cs, tests/Csps.Application.UnitTests/Images/ImageMetadataStripperTests.cs
- Fix: `StripHeic` now refuses the file when the top-level box walk does not reach the end (`!boxes.AtEnd`). Two cases added to `ADamagedHeicBoxStructureIsRefused` (2 stray bytes after the last box, and a box with a size that does not fit); the run was red first, then green.
- Result: ImageMetadataStripperTests + ImageSnifferTests: 157 total, 0 failed.

#### WR-G1A-06: failed upload not queued for removal
- Commit: 53f10fe8
- Files: src/Csps.Application/Orders/UploadOrderImageHandler.cs, src/Csps.Application/Ports/ImageFailureCodes.cs (new `Transient` constant), src/Csps.Infrastructure/Images/CloudinaryResults.cs (uses the shared constant, same value "transient"), tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs
- Fix: when the upload ends with the `transient` code (timeout, lost reply, busy or rate limited), the handler queues the id as `UploadUndone` before it answers 503. Clear refusals (`images.type`, `refused`, `unauthorized`) still queue nothing, since nothing was stored. No answer or user text changed.
- Tests: new test for the lost reply failed first (red seen), then passed. The old "refused queues nothing" test is now a theory over the three clear codes.
- Result: `--filter-class "*UploadOrderImage*"`: 10 total, 0 failed.
- Note: a 5xx answer is also "transient", so it is queued too. That is safe: removing a file that was never stored is a harmless NotFound, and the removal job guards live photos.

#### WR-G1A-04: storage read failures not logged
- Commit: 8fd5ae5f
- Files: src/Csps.Application/Ports/IMaintenanceJobLog.cs (new `StorageReadFailed(jobName, failureCode)`), src/Csps.Infrastructure/Maintenance/MaintenanceJobLog.cs, src/Csps.Application/Maintenance/StraySweepJob.cs, src/Csps.Application/Maintenance/CloudinaryUsageJob.cs, tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs, tests/Csps.Application.UnitTests/Maintenance/CloudinaryUsageJobTests.cs
- Fix: both jobs take `IMaintenanceJobLog` and write the job name and short code (for example `transient`, `unauthorized`) as a warning to the server log. The run answer text is unchanged. The code only, never an address or key.
- Tests: new assertions that the log got the code (the tests did not compile before the change).
- Result: StraySweepJobTests, CloudinaryUsageJobTests, ImageRemovalJobTests, RunMaintenanceHandlerTests: 61 total, 0 failed.

### Skipped

#### WR-G1A-02: stray sweep never remembers its cursor
- Outcome: skipped, needs owner decision: a new place to store the sweep cursor.
- Why: the job has no place to keep progress between passes. Storing it needs a new table or column. The other option in the review (drop the "more work left" answer for this job) changes what the run reports and needs new wording.
- Question for the owner: should the monthly sweep (a) keep its place in a small new database row so a big folder finishes over several runs, or (b) stop asking for a rerun and instead say plainly when it ran out of time? Recommendation: (a) is the honest fix, but it adds a schema change, so it needs your yes. Today's folder is small, so nothing is lost while you decide.

#### WR-G1A-03: no limit on how many strays the sweep queues
- Outcome: skipped: owner ruling needed (excluded from this lane by the instructions).

#### WR-G1A-07: a queued file that can never be removed turns every run red forever
- Outcome: skipped, needs owner decision.
- Why: owner ruling D-22 says a removal still failing at the end of a run turns the run red on purpose. Any change (park the row after N tries, drop it, or show it as a non-failing "needs attention" count) changes that ruling and the run semantics. The review itself says to pick the behavior with the owner. Nothing in the code or docs says which is wanted, and silently dropping rows is not acceptable.
- Question for the owner: when a queued photo can never be removed here (for example live data restored into the dev folder), should it (a) stay red every run as now, (b) turn green after 5 tries but show a "needs attention" count and stay in the queue, or (c) be removed from the queue after 5 tries with a plain log line? Recommendation: (b), because the run stays honest and no row is lost.

### Final checks (main checkout)

- `dotnet build Csps.slnx -warnaserror`: Build succeeded, 0 warnings, 0 errors.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Application.UnitTests`: Passed, total 2227, failed 0.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.ArchitectureTests`: Passed, total 269, failed 0.
- Each commit was checked with `gitleaks protect --staged --no-banner --redact`: no leaks found. Files were staged by path.
- Not run (per rules): Infrastructure and Server integration tests, Playwright, web checks. The Infrastructure change is two small edits (a log method and a constant alias), compiled clean.
- No flaky tests seen. Git printed "LF will be replaced by CRLF" notices on the test files; no content impact.

---


## Phase 9, lane G1B: fix report

Iteration 1. Branch gsd/phase-10-admin-dashboard. All checks ran in the main checkout (no worktree), after preflight (ports free, no TheBETSLLC test processes).
Database tests were run with `CSPS_TEST_SQL=localdb` set inside the one command only.
`dotnet build` of the whole solution (Csps.slnx): 0 warnings, 0 errors.

### WR-G1B-01: fixed (commit 444d4725)

Files: `src/Csps.Server/Security/UploadSlotsMiddleware.cs` (new), `src/Csps.Server/Security/RateLimitingRegistration.cs`, `src/Csps.Server/Program.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/ImageUploadRateLimitTests.cs`.

- The global limiter is gone. A new middleware runs right after `UseAuthorization()` and before the idempotency middleware. It holds one slot (2 at once, 4 waiting, oldest first) for the `UploadOrderImage` endpoint only, and answers the same 429 (code `rate-limited`, same text, Retry-After 60) when full.
- The limiter is a DI singleton, so each app (and each test factory) has its own slots, as before.
- Anonymous requests stop at authorization with 401 and never reach the middleware. The per-address policy still runs before authentication, unchanged.
- Test first: new `AnAnonymousUploadIsRefusedWith401EvenWhenAllSlotsAndQueuePlacesAreTaken` (2 held + 4 queued staff uploads, then an anonymous upload must be 401). Red before the fix: got 429. Green after.
- Command: `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-namespace "Csps.Server.IntegrationTests.RateLimiting"` : passed, 43 of 43 (includes the existing seven-uploads test and the 30-per-address test).
- Authorization matrix: `--filter-namespace "Csps.Server.IntegrationTests.Authorization"` : passed, 405 of 405. `...Images` namespace: passed, 1 of 1.
- Out of scope and untouched: IN-G1B-02 (the copied endpoint-name string). The middleware now holds the constant `UploadEndpointName`; the controller attribute still has its own literal.

### WR-G1B-02: fixed (commit c328765b)

Files: `src/Csps.Infrastructure/Maintenance/MaintenanceRunLock.cs`, `tests/Csps.Infrastructure.IntegrationTests/Maintenance/MaintenanceRunLockTests.cs`.

- Chose a longer lease (no schema change, no interface change): 3 minutes to 10 minutes. I did not add renewal, because that needs a new method on `IMaintenanceRunLock` and calls in every job.
- Arithmetic (worst case of a run that is still working): pass budget 90 s (checked only between rows, so a row can start at its edge) + one removal row of 3 tries x 60 s HTTP timeout + 2 s + 8 s waits = 190 s + the Cloudinary usage call (order 40, runs whatever the budget) up to 60 s = 340 s. 10 minutes (600 s) is 1.76 times that. The old 180 s was below even the removal row alone (190 s).
- Trade-off to know: a run cut off by an app pool recycle now blocks the next run for up to 10 minutes instead of 3.
- Not done: the reviewer's second suggestion (pass a budget-linked cancellation token into the storage call). The SDK destroy call takes no token, so it would not stop the call.
- Test first: lease test changed to 10 minutes (renamed `TheLeaseLastsTenMinutes`) and new `TheLeaseOutlastsTheWorstCaseRun` that holds the arithmetic above. Red before (3 failures), green after.
- Command: `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MaintenanceRunLockTests"` : passed, 7 of 7.
- Also: `--project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests"` : passed, 12 of 12. `--project tests/Csps.Infrastructure.IntegrationTests --filter-namespace "Csps.Infrastructure.IntegrationTests.Maintenance"` : passed, 26 of 26.

### WR-G1B-03: fixed (commit 4082fe89)

Files: `src/Csps.Infrastructure/Images/CloudinaryResults.cs`, `tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageStorageTests.cs`.

- A 400 now falls through to the general `refused` code, so the log line says `refused (HTTP 400)` instead of `type`.
- No user-facing copy changed and none was needed: `UploadOrderImageHandler` already maps every non-success storage outcome to the existing `ImageErrors.StorageFailed` message ("The photo couldn't be saved. Try again."). So the person never saw the wrong-type text from this path; the wrong cause showed only in the log code. I did not add the "keep type when the Cloudinary error text names the format" branch, since nothing reads that code and it would mean parsing provider text.
- Test first: `AnUploadAnswered400IsRefusedWithTheTypeCode` became `AnUploadAnswered400IsRefusedWithTheGeneralCodeNotTheTypeCode`. Red before, green after.
- Command: `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageStorageTests"` : passed, 32 of 32.

### WR-G1B-04: fixed (commit 0418e25e)

Files: `src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs`, `tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs`, `tests/Csps.Infrastructure.IntegrationTests/Images/ImagesRegistrationTests.cs`.

- With an empty cloud name, `ForPhoto` and `ForCover` return empty `ImageSource` values (and an empty full-size address) instead of throwing. One warning is logged for the life of the singleton (fixed sentence, no values). The public-id and size checks still run first. The startup validator is unchanged.
- The constructor now takes `ILogger<CloudinaryImageDelivery>`. The registration test adds `AddLogging()`.
- Note: the warning is logged the first time the delivery is built (first order read with photos or first list), not at host start, because the singleton is created lazily.
- Test first: the old "missing cloud name throws" test was replaced by a test for empty sources plus exactly one warning across three calls, and one that a bad public id is still refused. Red before (compile failure: constructor, seen), green after.
- Not added: an order-read test with real database photo rows. The delivery is the only place that threw, and it is covered directly.
- Possible follow-up for the owner: the web client will get empty `src` values and show no picture for those photos; I did not check how the UI draws that.
- Command: `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageDeliveryTests" --filter-class "*ImagesRegistrationTests"` : passed, 51 of 51. `--filter-namespace "Csps.Infrastructure.IntegrationTests.Images"` : passed, 167 of 167.

### Notes

- Commit trailer is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` as the fixer rules say (the session reminder named a different model line; the rules file was followed).
- gitleaks reported no leaks before each commit.
- No flaky tests seen. This report is not committed.

---


## Phase 9 lane G2 (backend tests): fix report

Iteration 1. Branch `gsd/phase-10-admin-dashboard`. All edits are in test files. No production code was changed; every temporary production edit used to prove a test (see below) was reverted with `git checkout --` before the commit. No real bug turned up.

Where checks ran: in the main checkout (no worktree). Database tests used `CSPS_TEST_SQL=localdb`, set only inside the command, after a preflight that showed free ports and no other project's processes.

Commit trailer: the sandbox attribution reminder named "Claude Sonnet 5.5", so the commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` rather than the Opus line in fixer-rules.md. Say if you want them rewritten.

Zero warnings: `dotnet build tests/<project> --no-incremental` for ArchitectureTests, Application.UnitTests, Infrastructure.IntegrationTests and Server.IntegrationTests each reported `0 Warning(s)`, `0 Error(s)`. gitleaks reported "no leaks found" before every commit.

### Fixed

#### WR-G2-01: order search test hard-coded 2026
- Commit: 0048fa25
- File: `tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs`
- Fix: `q=ORD-2026` became `q=ORD-{rig.Today.Year:D4}`. `rig.Today` comes from the business calendar (`OrderFixtures.TodayAsync`), the same source the order number uses.
- Proof: a calendar bomb cannot be made red today (the clock is 2026), so this is reasoned: the year now follows the same clock as the order numbers.
- Command: `CSPS_TEST_SQL=localdb dotnet test tests/Csps.Server.IntegrationTests --filter-method "*SearchFindsAnOrderByItsNumberOrByTheYearPartOfEveryNumber"` : passed (1 of 1).

#### WR-G2-02: "successful upload" test never checked success
- Commit: 870f258e
- File: `tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs`
- Fix: the Harness reader now returns a real `OrderDetailResponse` for the order id (new private `Detail(id)`), and the test asserts `result.IsSuccess.ShouldBeTrue()` instead of `result.ShouldNotBeNull()`. Added `using Csps.Application.Users;` for `ActorRef`.
- Proof (red first): changed only the assertion first and ran it; it failed, which shows the old harness returned a failure (404 from the null read). Then fixed the harness; green.
- Command: `dotnet test tests/Csps.Application.UnitTests --filter-class "*UploadOrderImageCompensationTests"` : passed (10 of 10).

#### WR-G2-03: shared budget test could not tell shared from per-job budgets
- Commit: 0762e8b4
- File: `tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs`
- Fix: first job spends 60 s, second 30 s (was 0 s and 90 s). Shared budget gives `[false, true]`; a budget per job would give `[false, false]`. Added a one-line comment saying so; updated the stale `ProbeJob` comment.
- Proof (red): temporarily changed the handler to pass `new MaintenanceBudget(time)` to each job; the test failed. Reverted the handler (`git checkout --`), test green.
- Command: `dotnet test tests/Csps.Application.UnitTests --filter-class "*RunMaintenanceHandlerTests"` : passed (12 of 12).

#### WR-G2-04: strict-mode flag was never tested on its own
- Commit: 67ff27dd
- File: `tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySetupCommandTests.cs`
- Fix: `QueueExisting` lost the `allowed` parameter and gained `notAllowedName`. A size named there keeps its exact definition (no width shift) and only has `allowed_for_strict:false`. The test now also runs with `checkOnly: false` and asserts "12 exist, 1 different" and that only GET requests were made (nothing changed).
- Proof (red): temporarily deleted the `allowed_for_strict == false` check from `CloudinarySetupCommand.Matches`; the test failed (before, it would have passed). Reverted, green.
- Command: `dotnet test tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinarySetupCommandTests"` : passed (17 of 17).

#### WR-G2-05: removal job harness could spin forever
- Commit: e990d7e5
- File: `tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs`
- Fix: `Harness.RunAsync` now throws `TimeoutException("The job did not finish within 10 seconds.")` after 10 real seconds (`TimeProvider.System`).
- Proof: reasoned, not demonstrated red. A stalled job now ends the loop with a clear message after 10 s instead of looping forever. A hang test would itself take 10 s and was not worth adding.
- Command: `dotnet test tests/Csps.Application.UnitTests --filter-class "*ImageRemovalJobTests"` : passed (19 of 19).

#### WR-G2-06: secret exposure test could miss the last log line and ignored exceptions
- Commit: 0ab6f6ec
- File: `tests/Csps.Server.IntegrationTests/Images/ImageSecretExposureTests.cs`
- Fix: waits for the request-completion event of `/api/v1/orders/image-rules` (`LogEvents.RequestCompletionAsync`), asserts the sink is not empty, and renders each event with `CompactJsonFormatter` (the way the file sink writes it, including the exception) plus `logEvent.Exception` in full.
- Proof: reasoned. The old renderer never read `Exception`, and the new one does; the sink-not-empty assertion passes, so the shared sink does receive the derived host's events.
- Command: `CSPS_TEST_SQL=localdb dotnet test tests/Csps.Server.IntegrationTests --filter-class "*ImageSecretExposureTests"` : passed (1 of 1).

#### WR-G2-07: maintenance script import guard only saw single quotes
- Commit: 3ecea5b7
- File: `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs`
- Fix: the pattern now accepts single, double and backtick quotes. Added `CannotBeRead`, which flags any non-comment line with an `import(`/`require(` or a static `import ...` that the pattern cannot parse (for example `require(name)`); the main test fails on any such line. Added three theories with samples: every quote style is read, unparseable loads are flagged, and `import.meta.url`, `import {` and `important` are not flagged.
- Proof (red): ran the new samples against the old single-quote pattern; 5 of the quote-style samples failed. Restored the new pattern, green. The real script `web/scripts/maintenance.mjs` still passes.
- Command: `dotnet test tests/Csps.ArchitectureTests --filter-class "*MaintenanceWorkflowTests"` : passed (23 of 23).

#### WR-G2-08: upload-stays-in-memory scan skipped files and APIs
- Commit: fb4ad12e
- File: `tests/Csps.ArchitectureTests/UploadNoDiskTests.cs`
- Fix: added `ImageMetadataStripper.cs`, `ImageMetadataStripper.Heic.cs` and `CloudinaryImageStorage.cs` to `UploadFiles`. The pattern now also bans `Directory.`, `FileInfo`, `DirectoryInfo` and `Path.GetRandomFileName`. Added flag samples for each, and two allowed samples (`Path.GetFileName`, `ImageDirectory.Entry`) to show the pattern is not over-wide. No current offender in the three newly scanned files.
- Proof (red): ran the new samples against the old pattern; 4 failed (GetRandomFileName, DirectoryInfo, Directory.CreateTempSubdirectory, FileInfo). New pattern green.
- Command: `dotnet test tests/Csps.ArchitectureTests --filter-class "*UploadNoDiskTests"` : passed (22 of 22).

#### WR-G2-09: lease-release-on-cancel test accepted a cancelled token
- Commit: 74c4e9f0
- File: `tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs`
- Fix: both release checks (cancelled run and job-throws run) now require `ReleaseAsync(Arg.Any<Guid>(), CancellationToken.None)`.
- Proof (red): temporarily changed the handler's `finally` to pass `cancellationToken`; both tests failed. Reverted, green.
- Command: `dotnet test tests/Csps.Application.UnitTests --filter-class "*RunMaintenanceHandlerTests"` : passed (12 of 12).

#### IN-G2-06 (promoted to warning): Development test host could load real Cloudinary keys
- Commit: 107dbfc4
- File: `tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs`
- Choice: the narrow option. Only `AHostWithNoImageStorageStarts...` depends on the keys being absent, so only that test's host blanks `Cloudinary:CloudName`, `ApiKey` and `ApiSecret` with `UseSetting(..., string.Empty)`. Other Development hosts (OpenAPI tests) never call Cloudinary and do not depend on the keys being absent; `ImageSecretExposureTests` already sets all three to fake values. Clearing them in `CspsApiFactory` for every host would hide real configuration from tests that might legitimately want it, and it changes shared test infrastructure.
- Fix also adds an explicit precondition: `development.Services.GetRequiredService<IImageStorage>().IsConfigured.ShouldBeFalse(...)`. It prints no values.
- Proof (red, no secret value read or printed): with only the precondition added, the test failed on that assertion on this machine, which proves a Development test host does load the machine's user-secrets keys. After adding the blanking, the test passed, so the blank `UseSetting` values win over user-secrets.
- Commands: `CSPS_TEST_SQL=localdb dotnet test tests/Csps.Server.IntegrationTests --filter-method "*AHostWithNoImageStorageStarts*"` : passed (1 of 1); `... --filter-class "*OrderImagesEndpointTests"` : passed (20 of 20).
- Heads up for the orchestrator: before this fix, that test would have built the real Cloudinary adapter with the developer's real keys and could have sent a real upload to the `csps-dev` folder on a machine with secrets set. Nothing was run in that state with a upload step reaching the network by this agent beyond the red run above, where the failing assertion stopped the test before any upload.

### Skipped

None.

### Notes

- Line endings: some files are CRLF in the working tree and some LF (git normalizes to LF in the index). Edits kept each file's own endings; git warns "LF will be replaced by CRLF" for the LF ones, which is the existing repo behavior.
- Not run: the full suites. Only the affected classes above plus the four-project warning builds.

---


## Phase 9, lane G3: Code Review Fix Report

Branch: gsd/phase-10-admin-dashboard. Verification ran in the main checkout (no worktree). Plus check C-1 (fixed, 3rd commit).

### WR-G3-01: fixed
- Commit: 3cb3627d
- Files: web/src/modules/admin/components/OrderPhotosCard.tsx, web/src/modules/admin/components/OrderPhotosCard.test.tsx
- Fix: an `alive` ref set in an effect (StrictMode safe); `runPick` enqueues only if the card is still mounted. Nothing changed in `photoUploadQueue.enqueue`.
- Test: new test unmounts the card while `prepareImage` is pending, then resolves it; asserts no upload call and an empty queue. It failed before the fix (5 new tests red), passes after.

### WR-G3-02: fixed
- Commit: 3084c6a6
- Files: same two files.
- Fix: Remove and Try Again on a queued file now plan focus: the first control of the next tile, else the add control, else the card heading (same fallback as the saved-photo delete). No new copy.
- Tests (4 new): Remove goes to the next tile's control; Remove on the last tile goes to "browse"; Remove in a locked card goes to the Images heading; Try Again on the only tile goes to "browse".
- Note: it is a focus-order change only; no logic bug class, but the Try Again target ("next tile, else add control") follows your instruction, not the review's "status text" idea.

### WR-G3-03: skipped: owner ruling needed
Not touched (25 MP rule in `web/src/utils/images.ts`).

### C-1: fixed (empty photo address)
- Commit: aab1245a
- Files: web/src/components/states/LazyImage.tsx, web/src/components/states/LazyImage.test.tsx
- Finding: PhotoTile thumb, PhotoViewer, OrderCard cover and OrdersTable cover all render through `LazyImage`. With `src=""` React drops the attribute and logs a console error, and no load or error event fires, so the box showed a skeleton forever.
- Fix: in `LazyImage`, an empty `src` counts as failed at once: the existing chip-less MediaPlaceholder shows (named by the alt, or hidden if decorative), no `<img>`, no skeleton, no request. One change covers all four places.
- Tests (3 new): empty src and srcSet gives placeholder, no img, no skeleton, `console.error` not called, no axe violations; decorative variant is aria-hidden; a real address arriving later loads normally. They failed before the fix.

### Commands and results
- `npm --prefix web run typecheck`: passed, no errors (run after each fix).
- `npx eslint` on the touched files and `src/components/states` with `--max-warnings 0`: no output (clean). Prettier applied to touched files.
- `npm run test -- src/modules/admin/components/OrderPhotosCard.test.tsx`: "Tests 62 passed (62)" (58 passed with only the WR-G3-01 test).
- `npm run test -- src/components/states/LazyImage.test.tsx`: "Tests 17 passed (17)".
- `npm run test -- src/components/states src/components/media src/components/data src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/components/OrdersTable src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts`: "Test Files 17 passed (17), Tests 378 passed (378)" (includes the OR-4 no-long-dash and source-layout tests).
- Not run: full `npm run lint` across the repo, full vitest suite, Playwright.
- gitleaks (via the commit hook): "no leaks found" on all three commits.

### Notes for the orchestrator
- Commit trailer: the fixer rules file asked for `Claude Opus 5.5`, but this session's attribution reminder names `Claude Sonnet 5.5` (the real model). All three commits use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Change it with a rebase if you want the other line.
- The working tree files use CRLF; git warns about LF conversion on commit (existing repo behavior, no content impact).

---


## Phase 9, lane G4: Code Review Fix Report

**Source review:** `.planning/phases/09-order-images-maintenance-jobs/09-REVIEW.md` (lane G4)
**Branch:** gsd/phase-10-admin-dashboard (no branch switch, no worktree)
**Verification ran in:** the main checkout.
**Not run (by instruction):** Playwright and dev servers. The e2e edits (WR-G4-05, and the e2e side of WR-G4-03) are type-checked, linted, formatted and listed with `npx playwright test --list --project=chromium e2e/order-photos` (33 tests in 7 files load), but none of them were executed. The orchestrator's e2e run is the first real run of them.

### Fixed

#### CR-G4-01: second photo found by place 1

- **Outcome:** fixed
- **Commit:** 6d51586f
- **Files:** `web/scripts/owner-review.mjs`, `web/scripts/owner-review.test.ts`
- **What changed:** a new exported helper `secondPhotoOf(images)` keeps the photos that have a numeric `position`, sorts by it and takes index 1 (the same approach as the e2e twin). The `description-409` case uses it.
- **Test first:** three `secondPhotoOf` tests. Red run: `TypeError: secondPhotoOf is not a function` (3 failed). Green: `npx vitest run scripts/owner-review.test.ts -t "secondPhotoOf"` gave `Tests 3 passed`.
- **Flag:** this is a logic fix, so it is marked "fixed: requires human verification" for the real picture (needs the owner-review run to confirm the 6 `description-409` pictures now appear).

#### WR-G4-01: owner review host lifts the photo upload limit

- **Outcome:** fixed
- **Commits:** 5dd12d2a (fix), fc907d46 (type-check follow-up for the new test)
- **Files:** `web/scripts/owner-review.mjs`, `web/scripts/owner-review.test.ts`
- **What changed:** `HOST_ENV` is now exported and carries `RateLimits__Images__PermitLimit: NO_THROTTLE`; the comment on `NO_THROTTLE` now says it covers uploads too. New test reads `web/playwright.config.ts`, collects every `RateLimits__*: noThrottle` line and asserts `HOST_ENV` lifts each one (this is the "same limits" test the review suggested). The existing exact `host.env` assertion in `planReview` was extended with the new variable.
- **Test first:** red run showed `.toHaveProperty() expects to receive a valid object, but got undefined` (HOST_ENV was not exported, and the limit was missing). Green: `npx vitest run scripts/owner-review.test.ts` gave `Tests 119 passed (119)`.
- **Note:** the first commit left a `string | undefined` type error in the new test (caught by `npm run typecheck`); fixed in fc907d46.

#### WR-G4-02: maintenance job runs only from main

- **Outcome:** fixed
- **Commit:** 06d2828b
- **Files:** `.github/workflows/maintenance.yml`, `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs`, `docs/operations/ci.md`, `docs/operations/maintenance.md` (the two docs only had their `Updated:` timestamp changed, plus one added sentence each)
- **What changed:** the job now has `if: github.ref == 'refs/heads/main'` with a short comment. Actions stay pinned by SHA, both permission blocks stay `{}`, no `${{ }}` expression was added (the "no other expression" test still holds). The old test line "a job must have no `if:`" was replaced by an assertion that the only `if:` is exactly that branch guard. `ci.md` gets a "Branch guard" bullet and `maintenance.md` says Run now works only from `main`.
- **Test first:** red run of `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*MaintenanceWorkflowTests"`: `OneJobOnAPinnedRunnerWithATimeoutAndNoEnvironment` failed (guard missing), 22 of 23 passed. After the change: full `dotnet test --project tests/Csps.ArchitectureTests` gave `Test run summary: Passed! total: 289, failed: 0`.
- **Note:** `CiWorkflowTests` needed no change and passes.
- **Behavior note for the owner:** a "Run workflow" press on another branch now shows a skipped job instead of running. The monthly schedule is unaffected because it always runs on the default branch.

#### WR-G4-03: photo host lock made safe

- **Outcome:** fixed
- **Commits:** babf6998 (fix), 99d5f83b (prettier format of the new test)
- **Files:** `web/e2e/photo-host-lock.ts`, `web/scripts/photo-host-lock.test.ts` (new)
- **What changed:** the lock is still a directory, now holding a token file. The holder touches the directory every 30 s while it works (stale limit still 3 min), so a slow test is not taken over. A stale lock is taken over by renaming it to a unique name (atomic, one waiter wins), checking the token of what was moved, and putting it back if it was not the stale one. The release removes the directory only if the token inside is still the holder's own. The module now exports `createPhotoHostLock(options)` (for tests, with short timings); `withPhotoHost` is unchanged for the specs.
- **Test first:** `web/scripts/photo-host-lock.test.ts` has 7 tests (one holder at a time, a held lock stays fresh past the stale limit, takeover of a dead run's lock, two waiters on one stale lock never overlap, release never deletes another holder's lock, wait limit error, release on throw). Red: `createPhotoHostLock is not a function` (7 failed). Green: 3 runs of `npx vitest run scripts/photo-host-lock.test.ts` gave `Tests 7 passed (7)` each time. I also removed the heartbeat guard temporarily and confirmed the "stays fresh" test fails, then restored it.
- **Known limit:** a waiter that paused for a long time between seeing a stale lock and renaming it could still move a brand-new lock; it then puts it back, which fails only if a third party took the free spot in that instant. This is a very narrow window.
- **Flag:** logic and concurrency change, "fixed: requires human verification" under a real parallel Playwright run (not run here).

#### WR-G4-04: deferred backup text removed from the release list

- **Outcome:** fixed
- **Commit:** ac4e18c7
- **Files:** `docs/operations/cloudinary-setup.md` (`updated:` timestamp changed to 2026-11-05T20:58:00-05:00)
- **What changed:** step 3 (the `Maintenance__Backup__*` settings) now says backups are deferred (D-51) and to take them by hand in the control panel; the step number is kept so the list numbering does not move. Step 6 no longer mentions the "Database backups written" line or the "did not show up in the app folder" message, says to press Run now from `main`, and states there is no backup line because of D-51.
- **Grep for leftovers:** searched `docs`, `src`, `tools`, `web/scripts`, `.github`, `tests` and the README for `Maintenance__Backup`, `Database backups written`, `SqlServerFolder`, `AppFolder`, `09-32`, "database backup". Only `cloudinary-setup.md` had them. The other hits (`cutover-runbook.md`, `deploy.md`, `development.md`, `data-protection-rotation.md`) are about the legacy `.bak` and the certificate backup, not the deferred backup job, so I left them.
- **Check:** full architecture test project passed (289/289), which includes the docs tests.

#### WR-G4-05: shared photo helpers

- **Outcome:** fixed
- **Commit:** 4bb30ba5
- **Files:** new `web/e2e/photos.ts`, new `web/e2e/photo-scripts.ts`; changed `web/e2e/testing-api.ts` (new exported `CASH_ID`), `web/e2e/order-photos-a11y.spec.ts`, `order-photos-arrange.spec.ts`, `order-photos-create.spec.ts`, `order-photos-delete.spec.ts`, `order-photos-list.spec.ts`, `order-photos-upload.spec.ts`, `order-photos-view.spec.ts`, and `web/scripts/owner-review.mjs`.
- **What changed:** `photos.ts` now holds `PickedFile`, `drawJpeg`, `drawJpegs`, `seedOrder` (takes a small seed object: prefix, label, item text, optional dates, status, payment), `savedName`, `tiles`, `thumbSources`, `photoKey`, `openOrder`, `uploadAndWait`, `addPhotos`, `orderWithPhotos`, `apiToken` and `deleteOrderThroughApi`. Each spec keeps only a small `SEED` constant with its own order-number prefix, names and dates, so the order numbers, names and dates are the same as before. The a11y spec keeps three one-line wrappers so its 800 x 600 photos and 400-day due date stay as they were. `CASH_ID` is exported from `testing-api.ts`. The seven spec files lose about 550 lines and gain about 110.
- **Owner-review script:** `photo-scripts.ts` holds only the page-side `gradientScript` and has no imports, so `owner-review.mjs` imports it directly under plain Node (the script already imports `../e2e/helpers.ts` the same way, so no build step is needed) and its own copy `jpegScript` is deleted. The test that loads the script under plain Node passes. I did not share `photos.ts` with it because that module pulls in Playwright's runtime (`fixtures.ts`), so `SEEDED_JERSEY` and `SEEDED_CASH` literals stay in `owner-review.mjs`, and `addPhotos`/`ownOrder` there stay separate (they use a different request-based flow). Four other non-photo specs (`order-delete`, `order-discounts`, `order-page`, `order-payments`) still hold their own `CASH_ID` literal; they are outside this finding's file list.
- **Small behavior difference to know about (needs the e2e run to confirm):** the shared `openOrder` also waits for the "Images" level 2 heading (the a11y spec already did; the other specs did not). The Images card is on every order page those specs open, so I expect no change. The delete spec's old `deleteOrderThroughApi` and the new one both fetch a fresh token and expect 204. The unused `savedName` import was dropped from the delete spec.
- **Checks (no Playwright run):** `npm --prefix web run typecheck` passed (no output errors), `npm --prefix web run lint` passed (`eslint . --max-warnings 0`; the lint config includes `scripts/**` and `e2e/**`), `prettier --check` passed on the touched files, `npx playwright test --list --project=chromium e2e/order-photos` listed `Total: 33 tests in 7 files`, and `npx vitest run scripts/owner-review.test.ts scripts/photo-host-lock.test.ts` passed.

### Final checks (run after the last commit)

| Command | Result |
|---|---|
| `dotnet test --project tests/Csps.ArchitectureTests` | Passed, total 289, failed 0 |
| `npm --prefix web run typecheck` | Passed, no errors |
| `npm --prefix web run lint` | Passed, no warnings |
| `npx vitest run scripts` (from `web/`) | 26 files, 1200 tests passed |
| `gitleaks protect --staged --no-banner --redact` before every commit | "no leaks found" each time |

### Skipped

None.

### Notes

- Info findings (IN-G4-01 to IN-G4-05) were out of scope and not touched. IN-G4-05(c) (a test that every case id has a capture) would now be easy since `secondPhotoOf` shows the pattern, but `PHASE9_CAPTURES` is still not exported.
- No commit contains the fix report. Eight commits were made: one per finding (six) plus two follow-ups (a type-check fix for WR-G4-01's test and a formatting fix for WR-G4-03's test).
- A stray shell I started by mistake (a bare `cat` waiting on stdin) was killed; no background process is left.
