---
created: 2026-11-22T23:58:00-06:00
updated: 2026-11-22T23:58:00-06:00
phase: 13-quote-inquiries
waves: [1, 2, 3]
reviews: [13-REVIEW-W1.md, 13-REVIEW-W2.md, 13-REVIEW-W3.md]
findings_in_scope: 5
fixed: 5
not_fixed: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report (waves 1 to 3)

*Created: 2026-11-22T23:58:00-06:00 · Updated: 2026-11-22T23:58:00-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree), with `CSPS_TEST_SQL=localdb` set on the command only.

Only the five findings the owner named were in scope. W1 WR-02 (the usage check month cursor) waits on the owner and was not touched.

## Fixed

### W3 CR-01 (D-38): the expired-ticket answer carries a usable replacement ticket

**Commit:** 8c10783e
The `quote-requests.ticket-expired` 400 now holds `replacementTicket`, a ticket issued already `QuoteRequests:MinimumSeconds` old, so the visitor's one resend is saved and not treated as too fast. Expiry and tamper checks are unchanged. A fresh ticket from `GET /ticket` is still too young when used at once (tested). `Error` gained an `Extensions` map that `ResultHttpExtensions` copies into the ProblemDetails body. Documented in `docs/api/quote-requests.md`, the controller comments, the OpenAPI snapshot and the generated web types.
Tests: handler unit tests (replacement issued at `Now - MinimumSeconds` for 0, 3 and 60), `ErrorTests`, and two integration tests in `QuoteBotGuardTests` (expired ticket, 400 with replacement, immediate resend, 200 and one saved row; tampered ticket likewise, then a fresh ticket used at once is still caught as `too-fast`).
Status: fixed. Logic change: please confirm by reading the handler lines 44-50.

### W2 WR-01 (D-39): public quote photo uploads have their own upload pool

**Commit:** b0695fd3
New `PublicUploadSlots` (its own `ConcurrencyLimiter`) selected by `[UploadSlot(Pool = UploadSlotPool.Public)]` on the anonymous photo action. Staff actions keep the staff pool of 2 at once and 4 waiting, unchanged. The size is a setting, `UploadSlots:Public:AtOnce` (1 to 8) and `UploadSlots:Public:Waiting` (0 to 20), checked at start; a bad value stops the start and names the setting, never the value. The false comment in `UploadSlotsMiddleware` is corrected, and the three API docs mention the separate pool.
Default chosen: **2 at once, 4 waiting** (owner to confirm).
Tests: middleware unit tests (a full public pool refuses public but never staff; a full staff pool never refuses public; a public upload takes no staff permit), a test that only the quote photo action uses the public pool, settings validation tests, and an integration test where the public pool is full (2 running, 4 waiting, 1 refused with 429) and a staff order photo upload still runs next to them and returns 200.
Status: fixed.

### W3 WR-01: a lock timeout on the `quote-requests` lock is the busy try-again answer

**Commit:** 224909c7
`QuoteRequestStore.LockAsync` now mirrors `StaffMoneyLock`: a timeout becomes `QuoteRequestsBusyException` (one warning logged, cause kept), a deadlock victim becomes `ConcurrencyConflictException` with the tracker cleared. `CreateQuoteRequestHandler` runs its save through `ConflictRetry` (one more pass after a lost race) and answers the existing 409 `auth.session-busy` "Something changed at the same time. Try again." for a busy lock or a second lost race. The 409 is documented and added to the OpenAPI snapshot.
Tests: `QuoteRequestStoreLockTests` (timeout as busy with cause and one warning, missing row never busy, free lock no log, deadlock inside an outer transaction is a lost race with the transaction ended) and handler unit tests (busy lock, one lost race retried and saved, two lost races busy).
Status: fixed.

### W3 WR-02 (D-40): documentation only

**Commit:** 51bd7506
`docs/api/quote-requests.md` now says the ticket is reusable for its whole lifetime, is not tied to a visitor or an `Idempotency-Key`, and that the minimum time is a one-time delay. It says the per-address, site-wide and per-sender limits are the real guard. The same correction is in the doc comments of `IQuoteFormTickets`, `QuoteRequestSettings.MinimumSeconds` and the ticket action. No code change to ticket reuse.
Status: fixed.

### W1 WR-01: monthly wording changed to daily

**Commit:** db59ccdc
`ci.md` (maintenance endpoint called every day), `cloudinary-setup.md` (the daily cleanup), `order-images.md` (two places) and `site-content.md` (two places) now say daily. The usage check is still described as once a month, and the dependabot schedule is untouched. `updated` stamps bumped.
Not done: the review also suggested a test that the docs no longer say "monthly cleanup". The task said wording only, so no test was added.
Status: fixed (wording only).

## Verification

| Check | Result |
|---|---|
| `dotnet build Csps.slnx -warnaserror` | 0 warnings, 0 errors |
| `Csps.ArchitectureTests` (whole project) | 290 of 290 |
| `Csps.Domain.UnitTests` `ErrorTests` | 21 of 21 |
| `Csps.Application.UnitTests` `CreateQuoteRequestHandlerTests` | 26 of 26 |
| `Csps.Infrastructure.IntegrationTests` `QuoteRequestStoreLockTests`, `QuoteFormTicketsTests` | 18 of 18 |
| `Csps.Server.IntegrationTests` `QuoteBotGuardTests`, `UploadSlotsCoverageTests`, `ImageUploadRateLimitTests`, `RateLimitTests`, `AuthorizationMatrixTests`, `OpenApiSnapshotTests`, `CreateQuoteRequestTests`, `QuoteSenderLimitTests`, `UploadQuotePhotoTests`, `QuoteRateLimitTests` | 716 of 716 |

The OpenAPI snapshot was refreshed twice with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` (the write run itself reports one non-success exit by design), the types were regenerated, and `OpenApiSnapshotTests` then passed without the variable (11 of 11).

## For the owner

1. Confirm the public photo pool default of 2 at once and 4 waiting (`UploadSlots:Public`). A visitor sending 5 photos at once gets 2 running and 3 waiting, so all 5 fit; a sixth caller at the same moment gets a 429 and retries.
2. Plans 13-09 and 13-12 (the form) must use `replacementTicket` for the one resend and must wait out the minimum time after it gets a ticket (documented in `docs/api/quote-requests.md`).

---

_Fixed: 2026-11-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
