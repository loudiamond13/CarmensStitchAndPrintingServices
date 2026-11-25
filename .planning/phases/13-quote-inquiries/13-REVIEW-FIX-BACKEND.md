---
phase: 13
created: 2026-11-25T08:05:00-06:00
updated: 2026-11-25T08:05:00-06:00
fixed_at: 2026-11-25T08:05:00-06:00
review_path: .planning/phases/13-quote-inquiries/13-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report (backend slice)

*Created: 2026-11-25T08:05:00-06:00 · Updated: 2026-11-25T08:05:00-06:00*

**Source review:** `.planning/phases/13-quote-inquiries/13-REVIEW.md`
**Slice:** .NET backend only (web findings are fixed by other fixers)
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (G2A-CR-01 plus seven warnings)
- Fixed: 7
- Skipped: 1 (G2A-CR-01, already fixed by plan 13-27)

**Verification ran in:** the isolated worktree on branch `worktree-agent-ac3bb362eeaf1a520` (LocalDB, `CSPS_TEST_SQL=localdb`, set on each command only). The numbers are reproducible from that branch.

## Fixed Issues

### G1-WR-01: Photo left in storage after a dropped upload connection

**Files modified:** `src/Csps.Application/QuoteRequests/UploadQuotePhotoHandler.cs`, `tests/Csps.Application.UnitTests/QuoteRequests/UploadQuotePhotoHandlerTests.cs`
**Commit:** fa72525b
**Applied fix:** The storage upload is wrapped so an `OperationCanceledException` queues the file as `UploadUndone` and then rethrows. The slot write now uses `CancellationToken.None`, so a visitor who leaves cannot leave the outcome unknown.
**Tests (red first):** two new tests (`AnUploadCutOffByALeftVisitorQueuesTheFileAndLetsTheCancelThrough`, `ThePlaceIsFilledEvenWhenTheVisitorHasLeftSoTheOutcomeIsNeverUnknown`) failed (2 failed of 17) before the change. After: 17 of 17 passed.
**Status note:** logic fix, fixed: requires human verification (one choice worth a look: the slot write ignores the cancel, so the answer to a departed visitor is still computed; this is the review's own suggestion).

### G3-WR-02: Honeypot and too-fast checks run before validation (D-25)

**Files modified:** `tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs`
**Commit:** c3c77ff9
**Applied fix:** Two new cases send an empty form with a filled hidden field, and with a 1-second ticket, and expect success with `Caught == ["honeypot"]` / `["too-fast"]` and nothing added.
**Evidence:** test-only. With the validation call temporarily moved above the honeypot check, 4 tests failed (both new ones and the two old honeypot cases). Reverted. Final: 39 of 39 passed in the class.

### G3-WR-01: Retention job rollback branch untested

**Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs`
**Commit:** 5b6d180f
**Applied fix:** New test `ARequestConvertedAfterTheReadSurvivesWithItsPhotosAndNothingIsQueued` with a `ConvertBeforeFirstDelete` interceptor that converts the request on a second context just before the first `DELETE`. It asserts value 0, not failed, `More` true, request kept (Converted), photo row kept, no `ImageDeletion` row.
**Evidence:** test-only. With the `Status != Converted` guard removed from the delete, the new test failed (1 failed of 15). Reverted. Final: 15 of 15 passed. Note: the review's `deleted != ids.Count` to `deleted < ids.Count` change is an equivalent mutation (the delete count cannot exceed the id count), so no test can tell them apart.

### G4-WR-01: Tampered ticket case also expired

**Files modified:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs`
**Commit:** 6828ea3f
**Applied fix:** The old test is now `AnExpiredOrNonsenseTicketIsA400AndNothingIsSaved` (past 24 hours and `not-a-ticket` only). New test `AYoungTicketWithOneCharacterChangedIsRefusedWhileTheSameTicketUnchangedIsSaved` changes a middle character of a young ticket (clock at 3 seconds), expects 400 `ticket-expired` and no row, then posts the unchanged ticket as a control and expects 200 and one row.
**Evidence:** test-only. With `QuoteFormTickets.Read` made to accept a bad signature (catch returns a valid reading), the new test failed along with three others. Reverted. Final class: 12 of 12 passed. (The old merged case would also have failed under this mutation, because a valid reading skips the expiry answer; the new test no longer depends on the age check at all.)

### G4-WR-03: `TheGuardsNeverAskTheVisitorToSolveAnything` could not fail

**Files modified:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs`
**Commit:** c5ce3fb5
**Applied fix:** The test now posts a body with only the documented members (name, number, ticket) and expects it to be saved (one row), then posts an empty form with a ticket and checks the 400 names exactly `customerName` and `contactNumber` and the body has none of: captcha, puzzle, challenge, recaptcha, turnstile, token.
**Evidence:** test-only. With a temporary required extra member (`captchaAnswer`) in the validator, 7 tests failed including this one. Reverted.
**Note:** G4-WR-01 and G4-WR-03 touch one file; the comment line above the rewritten test landed in the G4-WR-01 commit (6828ea3f), the rest of G4-WR-03 is in c5ce3fb5.

### G4-WR-02: Three "at the same time" tests did not force an overlap

**Files modified:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertCapTests.cs`, `QuoteSenderLimitTests.cs`, `CreateQuoteRequestTests.cs`
**Commit:** 9d0c3c9e
**Applied fix:** Each test fetches every ticket first, then releases only the POSTs through `ConcurrentRequests` (`SendAllTogetherAsync` for five senders, `SendTogetherAsync` for two). Responses are disposed.
**Evidence:** test-only. With the `quote-requests` lock made a no-op in `QuoteRequestStore.LockAsync`, `ParallelSendsNeverPassTwenty` and `ParallelSendsFromOnePhoneNeverMakeAFourthRow` failed. Reverted. `TwoCreatesAtOnceAreBothSaved` asserts both are saved, which holds with or without the lock, so it stays a contention regression test, not a race proof. Not repeated in rounds (the review said "a few rounds"; the state builds up between rounds, so one gated round was kept). Final: 22 of 22 in the three classes.

### G4-WR-04: Ceiling test named for three routes checked two

**Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs`
**Commit:** d77451bf
**Applied fix:** Added a page view POST (CSRF header, fresh address header) that must answer 204, and the photo post must now answer 400 with code `images.file-missing` instead of "not 429".
**Evidence:** test-only. With the page view route sharing the quote ceiling partition, the test failed (1 of 11). Reverted. Final: 11 of 11 passed.

## Skipped Issues

### G2A-CR-01

**Reason:** already fixed by 13-27 (commit 262c0f15), skipped as instructed. Not touched.

## Final checks

- `dotnet build Csps.slnx -warnaserror`: 0 Warning(s), 0 Error(s).
- `Csps.Application.UnitTests`, classes `UploadQuotePhotoHandlerTests` + `CreateQuoteRequestHandlerTests`: 56 of 56 passed.
- `Csps.Infrastructure.IntegrationTests`, `QuoteRequestRetentionJobTests`: 15 of 15 passed.
- `Csps.Server.IntegrationTests`, `QuoteBotGuardTests`, `QuoteAlertCapTests`, `QuoteSenderLimitTests`, `CreateQuoteRequestTests`, `QuoteRateLimitTests`: 45 of 45 passed.
- Preflight run before the first integration run: ports 5180, 5115, 7028, 5199 free; no other dotnet host busy.
- Every commit passed `gitleaks protect --staged` (no leaks). No packages, schema, SQL or triggers touched.

---

_Fixed: 2026-11-25T08:05:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
