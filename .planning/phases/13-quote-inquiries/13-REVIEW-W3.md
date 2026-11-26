---
created: 2026-11-22T22:00:00-06:00
updated: 2026-11-22T22:00:00-06:00
phase: 13-quote-inquiries
wave: 3
plans: [13-06, 13-08]
reviewed: 2026-11-22T22:00:00-06:00
depth: standard
files_reviewed: 48
files_reviewed_list:
  - docs/api/quote-requests.md
  - docs/operations/maintenance.md
  - src/Csps.Application/Maintenance/StraySweepJob.cs
  - src/Csps.Application/Ports/IImageDeletionQueue.cs
  - src/Csps.Application/Ports/IQuoteBotCatchLog.cs
  - src/Csps.Application/Ports/IQuoteFormTickets.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/Ports/QuoteSenderRecent.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
  - src/Csps.Application/QuoteRequests/GetQuoteFormTicketHandler.cs
  - src/Csps.Application/QuoteRequests/QuoteFormTicketResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRetention.cs
  - src/Csps.Infrastructure/Images/ImageInventory.cs
  - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
  - src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261123013252_AddQuoteRequestsLock.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteBotCatchLog.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteFormTickets.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
  - src/Csps.Server/Security/RateLimitSettings.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - src/Csps.Server/Security/SiteWideCeilingLimiter.cs
  - tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteFormTicketHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestRetentionTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteFormTicketsTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestFixtures.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
  - tests/Csps.Testing/CspsApiFactory.cs
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 13 Wave 3: Code Review Report (plans 13-06 and 13-08)

*Created: 2026-11-22T22:00:00-06:00 · Updated: 2026-11-22T22:00:00-06:00*

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 48 (the list file had 48 entries; some test files were skimmed by test name and key assertions, all source files were read in full)
**Status:** issues_found

## Summary

Plan 13-08 (6-month purge, quotes stray sweep, inventory) holds up. I traced the cut (business-day start, month-end clamp through `AddMonths`), the converted-request guard (applied both when ids are read and again in the delete), the queue-before-delete transaction, the rollback when the delete count differs, the shared cap and cursor handling in the sweep (a cap hit resumes from the page start; queued files are "known" so the next run makes progress), and the inventory union (live quote photos and pending removal rows are both "known", so the sweep never queues them). No defect found there beyond a test gap (IN-03).

Plan 13-06 has one real data-loss defect in the contract between the minimum-time guard and the documented "ticket expired, fetch a new ticket and resend" flow (CR-01), and one robustness gap in the new lock path (WR-01). The ticket itself is sound: purpose string is unique, a changed or foreign ticket throws `CryptographicException` and is mapped to a 400, expiry is checked by the protector and again against the injected clock, `ticks` parsing is strict. The sender limit is race-free: the lock row is updated first inside the transaction, so the count statement starts after the other send's commit (read committed snapshot) and phone/email matching is on the stored E.164 and an explicit case-insensitive collation. `CspsApiFactory` only calls `UseSetting` inside the test project, so the relaxations cannot reach production configuration; production defaults (`MinimumSeconds` 3, `PerSenderPerDay` 3, 5 and 60 an hour) come from the settings classes and are validated at start.

Known items not re-reported: wave 2 WR-01 (photo action shares staff upload slots, still unchanged) and the replay using one per-address and site-wide permit. On WR-01 of wave 2 I see one new angle: a caught bot or too-fast sender is handed photo slot names for a made-up request id (see CR-01), so any client that follows the slots will spend upload slots on guaranteed 404s. That does not change its severity.

## Critical Issues

### CR-01: A real visitor's resend after `ticket-expired` is silently dropped by the minimum-time guard

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:56-59`, contract in `docs/api/quote-requests.md:124-125` and `src/Csps.Application/QuoteRequests/QuoteFormTicketResponse.cs`
**Issue:** The documented recovery for an expired or changed ticket (Pitfall 4) is: the form gets a 400, fetches a new ticket and "sends once more" (plan summary "Next Phase Readiness" says the same, and says to resend immediately with a new Idempotency-Key). A ticket fetched just now has an age of a few hundred milliseconds. `ticket.Age < TimeSpan.FromSeconds(settings.MinimumSeconds)` (default 3 s) is then true, so the resend is treated as a bot: the handler returns a normal-looking 200 with a made-up id, saves nothing, and logs only `too-fast`. The visitor sees success and the lead is lost. This is exactly the failure the plan's own truth forbids ("no real lead silently dropped"), and it happens on the single path the design created for real visitors who left the tab open (the main audience: phones, tabs left open from Facebook). The same applies to any client that refreshes its ticket and posts at once. The ticket response gives the client no way to learn the minimum (`QuoteFormTicketResponse` holds only the ticket and photo rules), so a client author cannot get this right from the API alone. No test covers "expired, then fresh ticket, then immediate resend".
**Fix:** Pick one, and add a test for the expired-then-resend path:
```csharp
// Option A (server, no client rule needed): on ticket-expired, the 400 carries a replacement ticket issued
// already MinimumSeconds old, so the single resend is not "too fast". A bot gains nothing: it could already
// wait 3 seconds after any GET /ticket.
var replacement = tickets.Issue(clock.UtcNow - TimeSpan.FromSeconds(settings.MinimumSeconds));
// return it on the error (for example an extension member "ticket") and document it.

// Option B (client rule): add MinimumSeconds to QuoteFormTicketResponse and document that the form must
// wait out the remainder before every send, including the resend after ticket-expired.
```
Also document in `docs/api/quote-requests.md` that a too-fast send is a silent 200 and must never be produced by the official client.

## Warnings

### WR-01: A lock timeout or deadlock on the new `quote-requests` lock becomes a 500 and loses the lead

**File:** `src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs:20-27`
**Issue:** `DatabaseLocks.TakeAsync` throws `DatabaseLockTimeoutException` after 10 s or when the wait is a deadlock victim. Every other caller (`StaffMoneyLock`, `SiteContentLock`, `OrderNumberAllocator`, `ManagerRosterLock`, `AccountTokenStore`) catches it and rethrows a typed exception (a busy answer, or `ConcurrencyConflictException` for a deadlock victim, which the unit of work and idempotency gate understand, including `outerTransactionEnded`). `QuoteRequestStore.LockAsync` does not, and nothing in the Server maps `DatabaseLockTimeoutException`, so it surfaces as the generic production 500. The lock is global and is held to the end of the surrounding transaction (including the idempotency gate's outer transaction when the header is present), so one slow send makes the next sends wait. Under load or a stalled commit a visitor gets "Something went wrong" instead of a retryable answer, and a deadlock victim inside the idempotency transaction is not translated, so the gate may not end its lease correctly.
**Fix:** Mirror `StaffMoneyLock`:
```csharp
try { await DatabaseLocks.TakeAsync(...); }
catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
{ context.ChangeTracker.Clear(); throw new ConcurrencyConflictException(error); }
catch (DatabaseLockTimeoutException error)
{ /* log once, then a typed busy exception mapped to 503 + Retry-After */ throw new QuoteRequestsBusyException(error); }
```
and add a test with a shortened wait, as `StaffMoneyLock` has.

### WR-02: The ticket is reusable for its whole lifetime, so the minimum-time guard is a one-time 3 second delay

**File:** `src/Csps.Infrastructure/QuoteRequests/QuoteFormTickets.cs:29-57`, `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:44-59`
**Issue:** The ticket is signed but not bound to anything and not single use. A script can call `GET /ticket` once, wait 3 seconds, and then post any number of requests with that one ticket for 24 hours (up to 72 hours by setting) with `ticket.Age` always above the minimum. The honeypot is the only other silent guard, and it is defeated by leaving the field empty. The real protection is then only the per-address and per-sender limits plus the ceiling. That may be acceptable, but the docs and summary present the ticket plus minimum time as a bot guard ("Four quiet guards protect the inbox"), which overstates it, and the owner decides scope.
**Fix:** Either state plainly in `docs/api/quote-requests.md` that min-time only stops the naive first-request bot and the limits are the real defense, or make the guard meaningful by binding the ticket to the idempotency key (a ticket valid for one `Idempotency-Key`) or by keeping a short-lived used-ticket set in memory (single process, so a `MemoryCache` entry keyed by a hash of the ticket for its lifetime is enough). The second option must keep CR-01's resend path working. This is a decision for the owner.

## Info

### IN-01: The caught-bot answer is distinguishable by an invalid body

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:51-65`
**Issue:** A honeypot or too-fast send returns 200 before validation. A bot that sends one deliberately invalid body with the honeypot filled gets 200 where a clean send gets 400 with field errors, so it can learn it was caught. The shape test (`AFilledHoneypotLooksLikeSuccess`) only compares a valid caught body with a valid saved one. Cheap to leave as is; the honeypot only needs to fool unsophisticated bots.
**Fix:** If wanted, run the validator before the honeypot and too-fast checks and only skip the save, so a bad body is a 400 either way. Otherwise note the limit in the docs.

### IN-02: Per-sender 429 uses the "from this address" text and lets anyone block a known phone or email for a day

**File:** `src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs:47`, `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:103-108`
**Issue:** Three valid requests naming a victim's phone or email (within the 5 an hour per-address allowance) make the victim's own next request a 429 for up to 24 hours, and also put three junk rows in the staff inbox. The 429 text says "from this address", which is wrong for a per-sender block, and the answer confirms that the number or email has sent three requests recently. This is the owner's D-37 trade and the form shows Messenger copy for every 429, so the harm is limited; flagged so it is a recorded decision.
**Fix:** Optionally give the sender 429 its own plain text ("This number or email has sent several requests today. Please message us on Messenger.") and log nothing more. Record the abuse case as accepted.

### IN-03: The batch rollback branch of the purge job has no test

**File:** `src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs:124-127`
**Issue:** The summary says no test forces the "delete count differs from read count" race. The branch is the one that protects D-22 (a request converted between the read and the delete) and the one that stops photos being queued for a request that stays. It is simple, but it is also the only branch that returns `-1` and `More = true`.
**Fix:** Add an integration test that converts one of the read requests between the read and the delete (for example by a decorating `IImageDeletionQueue` that updates a request's status inside `Enqueue`/after save, or by pre-setting one row to Converted after the id read through a test hook) and asserts: nothing deleted, no queue rows, `More` true.

### IN-04: A request-level 400 for a missing ticket hides field errors in the authorization matrix

**File:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:108`
**Issue:** The matrix row for `POST /public/quote-requests` expects 400 for every caller. With the ticket guard in front, an empty body is now a `ticket-expired` 400, not a validation 400, so the row no longer shows that the validator is reachable by Admin and Manager callers. It still proves authorization (not 401/403), which is what the matrix is for.
**Fix:** None required; if the row is meant to double as a reachability check, post a ticket with the empty body and keep the 400.

---

_Reviewed: 2026-11-22T22:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
