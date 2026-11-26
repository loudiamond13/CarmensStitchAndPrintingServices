---
created: 2026-11-22T18:20:00-06:00
updated: 2026-11-22T18:20:00-06:00
phase: 13-quote-inquiries
plan: 05
subsystem: api
tags: [quote-requests, photos, anonymous-endpoint, private-storage, ef-core, tdd, cwe-434, cwe-639, cwe-203]

requires:
  - phase: 13-quote-inquiries
    provides: "13-01 QuoteRequest aggregate, anonymous create, QuoteRequests table, OpenAPI snapshot"
  - phase: 09-order-images
    provides: "ImageInspection, ImageMetadataStripper, IImageStorage (private type), IImageDeletionQueue, UploadSlot cap, images-upload rate limit"
provides:
  - "QuoteRequestPhotos table (one row per declared place, a null public id is a missing photo) and the UploadKeyHash and UploadKeyExpiresAtUtc columns"
  - "Create body takes photos (file names) and uploadKey; the answer lists photoSlots and never the key"
  - "POST /api/v1/public/quote-requests/{id}/photos/{slot} (UploadQuotePhoto): one photo per call, private storage under {root}/quotes/{id}/"
  - "One 404 for every wrong key, id, expiry, place or Spam request; 422 for a non-photo or a 25 MP photo; 413 one byte over 10 MB"
  - "QuoteRequestSettings (QuoteRequests:UploadKeyLifetime, 2 hours default, 5 minutes to 24 hours), PublicIds.QuoteFolder and NewQuote"
affects: [13-06, 13-08, 13-09, 13-12, 13-16]

actuals:
  tokens: 77600
  tasks: 3
  commits: 7
plan_head_before: 95cd8d2f74827602e503ad0288872450cf87fb65
plan_head_after: 20383315a561baeac912f37a7529ef622ffdb201

tech-stack:
  added: []
  patterns:
    - "A visitor's upload key is made by the browser; the server stores only its SHA-256 and an end time and compares with CryptographicOperations.FixedTimeEquals"
    - "One handler check gives one answer for every miss (CWE-639, CWE-203): the key hash, expiry, status and place are all tested before any file is read"
    - "A place is filled with one conditional ExecuteUpdate (public id still null, request not Spam), so parallel uploads never contend for the request row version"
    - "A 413 for a file one byte over the limit is decided in the action, because the body limit leaves 64 KiB of room for the form"

key-files:
  created:
    - src/Csps.Domain/QuoteRequests/QuoteRequestPhoto.cs
    - src/Csps.Application/QuoteRequests/UploadQuotePhotoHandler.cs
    - src/Csps.Application/QuoteRequests/UploadQuotePhotoRequest.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
    - src/Csps.Application/QuoteRequests/QuoteUploadKey.cs
    - src/Csps.Application/Ports/QuotePhotoTarget.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestPhotoConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261122233823_AddQuoteRequestPhotos.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuotePhotoFailureTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/UploadQuotePhotoHandlerTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/QuotePhotoRulesTests.cs
    - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestPhotosTests.cs
  modified:
    - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
    - src/Csps.Application/Images/PublicIds.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequestValidator.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestResponse.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/UploadSlotsCoverageTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/quote-requests.md

key-decisions:
  - "A file one byte over 10,485,760 bytes is a 413 decided in the controller action (file.Length), not by the body limit, because the body limit is 10 MB plus 64 KiB for the form; the Error type has no 413 kind, so no shared type was changed"
  - "A non-photo and a 25 MP photo are 422 (a BusinessRule error) with the UI-SPEC words; a configured lower byte limit keeps the existing images.too-large 400 (as the plan says: keep the codes for size and storage)"
  - "A photo file name that is empty once cleaned is stored as 'Photo {n}'; the plan did not say"
  - "The photo answer is 200 with no body (the plan names no response type)"
  - "Messages the UI-SPEC does not give: 'Keep each photo file name to 255 characters or fewer.' and 'Photos could not be attached. Try sending them again.' (empty or repeated photo list, bad or missing key)"

patterns-established:
  - "RED evidence for xUnit v3 comes from --report-xunit-junit; the target must be the fully qualified test name for tdd-red-evidence to accept it"

requirements-completed: [INQ-02]

coverage:
  - id: D1
    description: "A declared photo is posted to its slot with the upload key, checked by its bytes, stripped of metadata and stored privately under {root}/quotes/{id}/; the slot row keeps its public id, size and format"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#ADeclaredPhotoIsStoredInItsSlot"
        status: pass
    human_judgment: false
  - id: D2
    description: "A wrong key, no key, a bad key, a wrong id, an expired key (exact end time), a filled slot, an undeclared slot, slot 5, slot -1 and a Spam request all answer the same 404 and store nothing; the create answer never holds the key"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#EveryMissAnswersTheSame404"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/UploadQuotePhotoHandlerTests.cs#EveryMissIsTheSameNotFoundAndStoresNothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Limits hold at their edges: 5 names are taken and a sixth is a 400; 10,485,760 bytes are stored and one more is a 413; 30 MP and non-photo files are 422 with the UI-SPEC words"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#ATenMegabytePhotoIsStoredAndOneByteMoreIs413"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#AThirtyMegapixelPhotoIsRefusedAs422WithThePixelMessage"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#SixDeclaredNamesAnswer400OnThePhotosField"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two photos for different slots at once are both stored; two for one slot give one 200 and one 404 and the loser's file is queued as UploadUndone"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#TwoPhotosForOneSlotAtTheSameTimeGiveOneOkAndOne404AndTheLoserIsQueuedForRemoval"
        status: pass
    human_judgment: false
  - id: D5
    description: "With storage failing, the request stays saved, the slot stays empty and the next photo works; a timeout queues the file for removal; unset storage answers 503 after the text was saved (D-03)"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuotePhotoFailureTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "Photos keep their pixels as sent and have no creator and no audit row (D-05, SEC-08)"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs#ADeclaredPhotoIsStoredInItsSlot"
        status: pass
    human_judgment: true
    rationale: "The test shows the stored bytes are the stripped file of the same size class and that no creator is set; that no audit row is written is true by construction (the handler has no audit port) and no test queries the audit table"
  - id: D7
    description: "The table, migration, matrix row, rate limit list, upload slot coverage, OpenAPI snapshot, web types and the API note agree"
    requirement: INQ-02
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class *AuthorizationMatrixTests,*OpenApiSnapshotTests,*UploadSlotsCoverageTests"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Infrastructure.IntegrationTests (whole project, 1288 total, 1287 passed, 1 live-only skipped)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 05: Quote photos Summary

**A visitor's photos are posted one per call to the slots the saved request declared, proved by a hashed upload key, checked by their bytes and stored privately under the quotes folder; every wrong try gets one identical 404, and a failed photo is a missing photo, never a lost request.**

## Performance

- **Duration:** about 100 min (no start stamp was recorded; estimated from the first and last commit)
- **Completed:** 2026-11-22
- **Tasks:** 3 (a tracer and two TDD tasks)
- **Commits:** 7 production, test and docs commits, plus this summary
- **Files changed:** 38 (about 6,200 added lines, mostly tests, the migration and the generated OpenAPI files)

## Accomplishments

- **Pattern 1 works end to end.** The create call takes `photos` and `uploadKey`, saves the text and one empty place per name, and answers `{ id, photoSlots }`. The key is 32 random bytes as base64url; only its SHA-256 and an end time (2 hours by default) are stored.
- **The photo endpoint** (`POST /api/v1/public/quote-requests/{id}/photos/{slot}`) follows `UploadOrderImageHandler` without the user check and without audit (SEC-08): storage set up (503), file present (400), one combined check of request, key (fixed-time compare), expiry, status and place (one 404), `ImageInspection.Check`, `ImageMetadataStripper.Strip`, then a private upload to `{root}/quotes/{id}/`.
- **No contention.** A place is filled with one conditional `ExecuteUpdate`, so two photos for one request never fight over the request row version. The loser of a same-slot race gets the 404 and its file is queued as `UploadUndone`.
- **Edges hold:** 5 names taken and a sixth is a 400; exactly 10,485,760 bytes stored and one more is a 413; 6000 x 5000 is a 422 with the pixel message; a text file named `.jpg` is a 422 with the quote message.
- **D-03 holds:** with storage failing the request stays saved with a missing slot and the next photo works; a lost reply queues the file; unset storage answers 503 after the create call saved the text.
- Domain stays at the 100% gate targets by test (see Verification); Application tests cover every branch of the handler.

## Task Commits

1. **Task 1 (tracer): a declared photo is uploaded to its slot and stored privately**
   - RED: `0ecbf653` (test)
   - GREEN: `6c0449e3` (feat)
2. **Task 2 (TDD): wrong keys, slots and files are refused the same way; limits hold**
   - RED: `8854dd35` (test)
   - GREEN: `80c50f50` (feat)
3. **Task 3 (TDD): a storage failure leaves a missing slot**
   - Tests: `5195ffb2` (test, passed on first run, see the TDD gate note)
   - Docs: `ca142b7d` (docs, `docs/api/quote-requests.md`)

No refactor commit: nothing needed cleaning after GREEN.

## TDD Gate Compliance

RED evidence came from xUnit v3 `--report-xunit-junit` reports, checked with `gsd-tools check tdd-red-evidence`. Each returned `RED_EVIDENCE_OK`, reason `target_test_failed`.

| Run | Target test | Result | Semantic assessment |
|---|---|---|---|
| Task 1, Server integration | `UploadQuotePhotoTests.ADeclaredPhotoIsStoredInItsSlot` | 16 total, 2 failed | The create answer had no `photoSlots` (the planned first assertion); the coverage test failed on 5 against the planned 6 |
| Task 2, Server integration | `UploadQuotePhotoTests.ATextFileNamedJpgIsRefusedAs422WithTheQuoteMessage` | 8 total, 3 failed | The answer was 400 with the image message where 422 with the quote message was planned; the 413 and pixel tests failed the same way (400 instead of 413 and 422) |
| Task 2, Application unit | `UploadQuotePhotoHandlerTests.ATextFileIsRefusedWithTheQuoteMessageAndNeverStored` | 15 total, 3 failed | The error was a validation (400) error instead of the BusinessRule `quote-requests.photo-refused` |

Notes that matter for the gate:

- **Unexpected green in Task 2 and Task 3.** The uniform 404, expiry edge, six-names, race and storage-failure tests passed on their first run, because the tracer's handler already held those rules. They are recorded as characterization tests. The mutation of one line (the transient branch of the upload failure) made `ATimeoutQueuesTheFileForRemoval` fail, so that test does bite. Task 3 therefore has no RED commit with a failing run; its tests are in a `test(13-05)` commit that passed on first run.
- **Declaration rules were not RED-first.** The domain `DeclarePhotos` rules, the validator photo rules and the upload key reader were written in Task 1 GREEN with their unit tests in the same commit (as 13-01 did for one rule). One real bug surfaced from those tests: `Base64Url.TryDecodeFromChars` throws on a bad character, which would have been a 500 for a bad key. Fixed with `Base64Url.IsValid` first.

## Decisions Made

- **413 in the action.** The body limit is 10 MB plus 64 KiB, so a file one byte over the limit still reaches the action. The action refuses it from `file.Length` before copying. No new error kind was added.
- **422 words.** Non-photo and pixel refusals are BusinessRule errors with code `quote-requests.photo-refused`. The size error for a lower configured limit keeps the image 400, as the plan says.
- **Judgment calls the plan did not make** (owner may change): an empty cleaned file name is stored as `Photo {n}`; the photo answer has no body; two messages are new (`Keep each photo file name to 255 characters or fewer.` and `Photos could not be attached. Try sending them again.`).
- **Expiry is exclusive:** a key works up to but not at its end time (`now < expiry`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A bad upload key threw instead of being refused**
- **Found during:** Task 1 GREEN (unit tests of the key reader)
- **Issue:** `Base64Url.TryDecodeFromChars` throws `FormatException` for a character outside the alphabet, so a key such as `not a key` would have been a 500 on create and on upload.
- **Fix:** `QuoteUploadKey.TryHash` checks `Base64Url.IsValid(key, out length)` and the size first, then decodes.
- **Files:** `src/Csps.Application/QuoteRequests/QuoteUploadKey.cs`
- **Commit:** `6c0449e3`

**2. [Rule 3 - Blocking] The rate limit list did not know the new endpoint**
- **Found during:** the full Server integration run
- **Issue:** `RateLimitTests.EveryRateLimitedEndpointIsInTheList` found the new photo action (it carries the images-upload rate limit) missing from `LimitedEndpoints`.
- **Fix:** one row, `POST /api/v1/public/quote-requests/{id}/photos/0` with limit 30. `RateLimitTests.cs` is not in the plan's file list.
- **Files:** `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs`
- **Commit:** `20383315`

**3. [Rule 2 - Missing critical] Tests and handler wiring the plan did not list**
- The create handler gained a settings parameter, so `CreateQuoteRequestHandlerTests` was updated and three tests added; `QuotePhotoRulesTests` and `QuoteRequestPhotosTests` were added to hold Domain 100% and Application coverage; `PublicQuoteRequestsController` gained a 422 `ProducesResponseType`. The OpenAPI snapshot and types were refreshed after Task 1 and again after Task 2.

**4. Commit trailer and branch.** The plan text names `Claude Opus 5.5` and `gsd/phase-13-quote-inquiries`. This run was dispatched into a parallel worktree with its own branch and the orchestrator's attribution line (`Claude Sonnet 5.5`), so those were used. No branch was created, switched or merged.

**Total deviations:** 1 bug fix (Rule 1), 1 blocking fix (Rule 3), 1 addition (Rule 2), 1 note. **Impact:** none on scope.

## Issues Encountered

- A first RED check failed `INVALID_RED` (`no_target_test_failure`) because the target name was not fully qualified. Using `Namespace.Class.Method` fixed it.
- A one-line mutation test left the Server binaries built from the mutated source for a while. The source was restored at once and the solution was rebuilt before every later run.
- No flaky tests were seen.

## Verification Results

All run in this worktree with `CSPS_TEST_SQL=localdb`, preflight clean (ports free, no other project processes).

- Task 1 verify set (`UploadQuotePhotoTests`, `UploadSlotsCoverageTests`, `AuthorizationMatrixTests`, `OpenApiSnapshotTests`, `CreateQuoteRequestTests`): 611 total, 0 failed.
- Plan verify set (plus `QuotePhotoFailureTests`): 621 total, 0 failed.
- `UploadQuotePhotoHandlerTests`: 15 passed. Domain unit tests: 2064 passed. Application unit tests: 3273 passed.
- Infrastructure integration tests (whole project, includes `MigrationScriptTests` and `TriggerInventoryTests`): 1288 total, 1287 passed, 1 live-only skipped.
- Whole Server integration project: first run 3060 total, 1 failed (`RateLimitTests.EveryRateLimitedEndpointIsInTheList`, fixed by commit `20383315`); `RateLimitTests` then 58 of 58 passed. The other 3059 tests passed in that run.
- Architecture tests: 290 passed.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Domain 100% line (4576/4576) and 100% branch (1945/1945); Application 98.2% line (gate 95%).
- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes --no-restore`: exit 0.
- `npm --prefix tools/openapi-gen run check`: types match the snapshot.
- Acceptance greps: `uploadActions.Count.ShouldBe(6` = 1; `quotes` in `PublicIds.cs` = 1; `FixedTimeEquals` in the handler = 1; `ExpiredKey` in `UploadQuotePhotoTests.cs` = 2; `StorageDownLeavesTheRequestAndAMissingSlot` in `QuotePhotoFailureTests.cs` = 1.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-13-11 (magic bytes, strip, private type), T-13-12 (hashed per-request key, fixed-time compare, expiry, one 404), T-13-13 (one file per call, bounded copy, upload slots, images-upload rate limit, 5 places) and T-13-14 (identical 404 bodies, compared in `EveryMissAnswersTheSame404`) are mitigated and tested. The branch still must not be deployed before plan 13-06 (bot guards and per-address limits for the create call).

## Next Phase Readiness

- 13-06 adds the create call's limits and bot guards; 13-08 sweeps `{root}/quotes/` strays; 13-09 and 13-12 build the form's photo upload on `photoSlots` and `X-Upload-Key`; 13-16 shows missing photos (a place with no public id) to staff.
- The key is not wiped after the last photo or after expiry. If the owner wants it cleared, that is a later cleanup.

## Self-Check: PASSED

- All 14 created files were found on disk.
- Commits `0ecbf653`, `6c0449e3`, `8854dd35`, `80c50f50`, `5195ffb2`, `ca142b7d` and `20383315` are ancestors of HEAD.
- The measured commit count from the plan base is 7 (`rev-list --count`), before this summary's own commit.
