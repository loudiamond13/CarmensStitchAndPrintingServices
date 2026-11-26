---
phase: "13"
slug: "quote-inquiries"
status: issues_found
depth: deep
reviewed: "2026-11-24T07:52:16-06:00"
files_reviewed: 331
findings:
  critical: 1
  warning: 19
  info: 41
  total: 61
created: "2026-11-24T07:52:16-06:00"
updated: "2026-11-24T07:52:16-06:00"
---

# Phase 13: Code Review Report (whole phase, deep)

**Scope (D-44, owner, 2026-11-24):** the whole phase at deep depth, not only the files changed after the wave 11 review. The 331 files come from the SUMMARY key files plus the phase task commits (base `cfde8f69`), with planning files removed. Generated files were left out: the five migration Designer files, the model snapshot, `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`. The files were split into 9 groups, each reviewed by its own deep reviewer in parallel. Each reviewer was told not to re-raise findings already fixed, deferred or accepted in 13-REVIEW-W1 to W11, their fix reports, the UI review, `deferred-items.md`, `13-SECURITY.md` and the phase 999.9 decisions.

## Summary

| Group | Area | Files | Critical | Warning | Info |
|---|---|---|---|---|---|
| g1 | Domain + Application QuoteRequests | 53 | 0 | 1 | 3 |
| g2a | Server, Application Content/Orders/Maintenance, workflow, docs | 31 | 1 | 0 | 4 |
| g2b | Infrastructure | 29 | 0 | 0 | 4 |
| g3 | Domain, Application and Infrastructure tests | 33 | 0 | 2 | 6 |
| g4 | Server integration tests | 26 | 0 | 4 | 5 |
| g5 | Web public module, shared components, core/api | 49 | 0 | 3 | 4 |
| g6 | Web admin module | 44 | 0 | 2 | 4 |
| g7a | Web public and shared tests | 34 | 0 | 3 | 5 |
| g7b | Web admin tests and e2e specs | 32 | 0 | 4 | 6 |
| **Total** | | **331** | **1** | **19** | **41** |

**Orchestrator check of the critical finding:** G2A-CR-01 was confirmed against the source. `src/Csps.Application/Maintenance/ImageRemovalJob.cs:91` builds the allowed folder as `{root}/orders/` only, and `:197-202` fails every other row as `outside-folder`. It is the only removal job in `src/Csps.Application/Maintenance/`, and `ImageRemovalJobTests` uses only `orders/` ids. The check dates from phase 9 (`a7c40cf2`), so phase 11 content photo removals fail the same way. Phase 13 made it worse by queueing every quote photo removal into the same job.

**The same issue found by more than one group:**
- A name of only U+0085, or text ending in U+FEFF, passes the zod rule and fails on the server: G1-IN-03 and G5-IN-01.
- A name made only of invisible characters gives an empty alert name and subject: G1-IN-02 (part), G2B-IN-03 and G3-IN-02.
- The fake phone numbers `0917 555 0101` and `0918 555 0202` are already deferred as W11 WR-03, but they appear in more files than that item names: G7B-IN-04. G4-IN-01 notes the "0917" needle can match by chance.

Every finding below needs a recorded outcome (fixed, deferred with a reason, or accepted by the owner).

---

## Group g1: Domain + Application QuoteRequests

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 53
**Status:** issues_found

### Summary

This group holds the quote request aggregate, its rules, the handlers, validators, errors and ports. I traced the call chains into
`QuoteRequestStore`, `OutboxEmailSender`, `CloudinaryImageStorage`, `ConflictRetry`, `PublicQuoteRequestsController`, the zod schema
(`quoteSchemas.ts`) and the retention job. I also read all 11 prior wave reviews, their fix reports, `deferred-items.md` and
`999.9 DECISIONS.md`, so nothing below repeats an item that was fixed, parked or accepted there.

What holds up under checking:

- **Converted-only-by-conversion.** `Status` has a private setter. Only `MarkConverted` sets Converted. `ChangeStatus` refuses both a move
  to Converted and any move from Converted. The status validator also drops `converted`. A numeric string is not parsed.
- **Concurrency.** Status change and delete compare the row version, then the save is the second guard (`ConcurrencyConflictException`
  becomes the 409). Notes move the row version through `EditVersion`. Conversion takes the row lock first.
- **Sender limit math.** `Times[Count - PerSenderPerDay] + window - now` is correct and always positive, because the store reads only
  rows strictly after `since`. `Error.TooManyRequests` therefore never throws on it.
- **Clock use.** No `DateTime.Now` or `DateTime.UtcNow` anywhere in the group. All times come from `IBusinessCalendar` or `TimeProvider`.
- **Audit detail.** Statuses, a note id, an order id and a photo count only. No name, phone, email, message or note text.
- **Retention.** `PurgeBefore` clamps the month end correctly. The job (read, outside this group) excludes Converted.
- **Server and zod parity.** Lengths, mobile rule, product and quantity keys and the 254/2000/100 limits match `quoteSchemas.ts`.
  The W4 email gap is closed.
- **Caps.** D-09 (20 an hour, one overflow mail) and D-37 (3 a day) are off by none: the 21st and the 4th are the ones refused.

One real defect remains in the photo upload path. Three smaller items follow, each tied to an earlier review item whose outcome I
could not find recorded.

### Warnings

#### G1-WR-01: A visitor who drops the connection during a photo upload leaves a customer photo in storage that nothing queues for removal

**File:** `src/Csps.Application/QuoteRequests/UploadQuotePhotoHandler.cs:77-99`
**Issue:**
The handler passes the request-aborted token into `storage.UploadAsync` and into `store.FillPhotoSlotAsync`
(`PublicQuoteRequestsController.cs:114`, `:128`).

1. `CloudinaryImageStorage.IsTransientFailure` returns `!cancellationToken.IsCancellationRequested` for an
   `OperationCanceledException` (`CloudinaryImageStorage.cs:136`). With the caller's token cancelled it returns false, so the exception
   is not turned into a `Transient` outcome. It escapes `UploadAsync` and the handler. The `UndoUploadAsync` call at line 83 only runs
   for a `Transient` outcome, so it never runs. Cloudinary may already have stored the bytes (the abort can land after the server
   accepted the file and before the reply). The file sits in the private quotes folder under a random id that no row names, with
   nothing queued. The visitors are mostly on a phone from Facebook, so a closed tab or a lost signal during a 10 MB upload is the
   normal case, not a rare one.
2. The `catch` at line 95 undoes the upload when `FillPhotoSlotAsync` throws, including when it throws because the same token fired.
   If the conditional update had already committed (the cancel arrived after the server ran it), the row names the file and the undo
   queues that file for deletion. Staff then see a place with a dead image address on a live lead.

The existing backstop is `StraySweepJob`, which finds the file after about 2 days. That is a privacy gap for up to 2 days for any
visitor who later asks for removal under RA 10173, and it makes the "UploadUndone" promise in the class comment false for this path.
The staff order upload handler (`UploadOrderImageHandler`) has the same shape, but a staff member on an office connection rarely aborts
mid-upload.

**Failure scenario:** a visitor picks a 9 MB HEIC, taps Send, loses signal 4 seconds in. The request token fires while Cloudinary is
still answering. `UploadAsync` throws `TaskCanceledException`. The handler exits with no queue row. The file stays until the stray
sweep.

**Fix:**
```csharp
UploadOutcome stored;
try
{
    stored = await storage.UploadAsync(new ImageUpload(...), cancellationToken).ConfigureAwait(false);
}
catch (OperationCanceledException)
{
    // The file may have arrived before the caller left; queue it, then let the cancel pass.
    await UndoUploadAsync(publicId).ConfigureAwait(false);
    throw;
}
```
For the second case, write the slot with `CancellationToken.None` (a short single-row update), so a cancel can never leave the outcome
unknown:
```csharp
filled = await store.FillPhotoSlotAsync(requestId, slot, photo, CancellationToken.None).ConfigureAwait(false);
```
Add a unit test where the storage fake throws `OperationCanceledException` and assert one `UploadUndone` queue row.

### Info

#### G1-IN-01: A product line deleted between the lookup and the save still gives the visitor a 500 (13-REVIEW-W1 IN-02, no recorded outcome)

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:83`
**Issue:** `store.FindShownLineAsync` runs before `InTransactionAsync`, so the line can be deleted before the insert. The insert then
breaks the product line foreign key and the visitor sees the generic production 500 instead of the 400 on `productLineKey`.
The window is milliseconds wide, but a 500 on the one endpoint that must never lose a lead is a bad answer. W1 IN-02 offered "move the
lookup into the transaction, or accept it"; no fix report, parked item or deferred item records which.
**Fix:** Move the `FindShownLineAsync` call into `SaveUnderLockAsync`, after `LockAsync`, and return the 400 from there. The line is
then read under the same lock as the count. Or record the risk as accepted in `deferred-items.md`.

#### G1-IN-02: Format characters and weak upload keys are still accepted (13-REVIEW-W2 IN-02 and IN-03, no recorded outcome)

**File:** `src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs:172-179`, `src/Csps.Application/QuoteRequests/QuoteUploadKey.cs:17-33`,
`src/Csps.Application/QuoteRequests/QuoteAlertText.cs:34-110`
**Issue:**
- `CleanPhotoName` removes control characters only. A right-to-left override (U+202E) in a declared file name is stored and shown to
  staff, which can disguise an extension (W2 IN-03). `ImageErrors.CleanName` is a second copy of the same cleaner with different rules.
- `QuoteUploadKey.TryHash` accepts any 32 bytes, so 32 zero bytes pass (W2 IN-02).
- A name made only of zero-width characters (for example U+200B) passes the name rule, because it is not white space. The record shows
  an invisible name, and `QuoteAlertText.OneLine` drops it, so the alert subject reads "New quote request from " with nothing after it.
- `OneLine` tests `char.GetUnicodeCategory(char)`, which sees the two halves of a surrogate pair as `Surrogate`, not `Format`. Tag
  characters (U+E0000 range) are therefore not dropped from the subject. `Excerpt` keeps bidi marks in the message text.

None of this is exploitable beyond spoofing text a staff member reads. Neither W2 item has a fix, a parked item or an accepted
note, and the owner's rule is that every finding gets a recorded outcome.
**Fix:** Pick one name cleaner (drop `UnicodeCategory.Format` and unpaired surrogates) and make both callers use it. Reject a name that
is empty after that cleaning. Optionally reject a key whose bytes are all equal. Then record the choice.

#### G1-IN-03: A name of only U+0085 passes the browser rule and fails on the server (same class as 13-REVIEW-W9 IN-04, fixed for notes only)

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestRequestValidator.cs:21`, `web/src/modules/public/quoteSchemas.ts:73`
**Issue:** .NET `Trim()` and `IsNullOrWhiteSpace` treat U+0085 as white space. zod `trim()` does not. A name of only U+0085 passes
`minLength(1)` in the browser, and the server answers 400 "Enter your name.". The form shows that sentence from the server's field
error, so no lead is lost and a real visitor will never type it. W9 IN-04 fixed exactly this for the staff note schema
(`DOTNET_TRIM` in `quoteRequestsSchemas.ts`) but the public quote schema still uses the plain `trim()`. OR-3 says the browser covers
every rule the server checks.
**Fix:** Reuse the same trim list in `quoteSchemas.ts` before the length checks, and add a U+0085-only test for `customerName`. The
web file belongs to another group; the server side needs no change.

---

_Reviewed: 2026-11-24T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g2a: Server, Application Content/Orders/Maintenance, workflow, docs

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 31
**Status:** issues_found

### Summary

I read all 31 files and followed calls into the removal job, the image inventory, the quote store, the unit of work, the audit trail,
the maintenance script and the program pipeline. I also checked the earlier wave reviews, the fix reports, `deferred-items.md` and
`13-SECURITY.md`, so nothing already fixed, deferred or accepted is raised again (for example W1 WR-02, the month cursor, stays deferred).

What held up:

- Default-deny: every action in the three new or changed controllers is covered by a class-level `[Authorize(Policy = Policies.Staff)]`
  or `[AllowAnonymous]`, and every Manager-only action carries its own `[Authorize(Policy = Policies.Manager)]`. Controllers are thin
  (one handler per action).
- Rate limiter: per-address window runs before the site ceiling in the chained global limiter, the route name is part of the partition key,
  IPv4-mapped and IPv6 /64 keys are right, and `Retry-After` is whole seconds, rounded up, at least 1.
- Conversion and permanent delete (D-22, D-23): the quote lock is taken after the site-content lock and before the number lock, so a
  missing or used request takes no number. The request is removed before the order, as the missing cascade needs.
- Workflow: all actions pinned by SHA, `permissions: {}`, key and origin through env only, main-only guard on the job,
  `persist-credentials: false`. The script refuses a non-https origin and redirects.
- Docs match the code for routes, status codes, rate numbers and audit detail, apart from the items below.

One blocker: the photo removal job refuses every file that is not under `{root}/orders/`, so quote photos (and Phase 11 content photos)
are never removed from storage.

### Critical Issues

#### G2A-CR-01: The photo removal job never removes quote photos (or content photos): every queued row fails as "outside-folder"

**File:** `src/Csps.Application/Maintenance/ImageRemovalJob.cs:91` and `:198-202` (root cause, outside my list); touches
`src/Csps.Application/Maintenance/StraySweepJob.cs:75,80,123`, `src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs:88-98`,
`docs/operations/maintenance.md:64-67` and `:76`, `docs/api/quote-requests.md:375,476,488`

**Issue:** `ImageRemovalJob` builds `var folder = $"{storage.RootFolder}/orders/";` and, for every claimed row, runs
`if (!row.PublicId.StartsWith(folder, Ordinal))` then `FailRowAsync(..., OutsideFolderCode ...)` and never calls the storage.
Quote photos are stored under `{root}/quotes/{id}/...` (`PublicIds.QuoteFolder`) and content photos under `{root}/content/...`.
Phase 13 queues quote photo ids from five places, all of which this job then refuses:

- Spam move (`ChangeQuoteRequestStatusHandler.cs:80`, reason `QuoteSpam`, D-04),
- Manager delete (`DeleteQuoteRequestHandler.cs:82`, `QuoteDeleted`),
- the 6-month purge (`QuoteRequestRetentionJob.cs:114`, `QuotePurged`),
- permanent order delete (`PermanentlyDeleteOrderHandler.cs:93`, `OrderDeleted`, D-22),
- stray sweep passes over `content/` and `quotes/` (`StraySweepJob.cs:75-80,123`, `Stray`).

Failure scenario: a visitor asks for their data to be removed. A Manager deletes the quote request. The photo ids are queued. Every
daily run claims them, finds they are not under `csps/orders/`, sets `LastFailureCode = "outside-folder"` and never calls Cloudinary.
For the first 4 attempts the run turns red ("Photo removals still failing"), which looks like a storage fault. From attempt 5 the rows move
to the quiet "needing attention" line (D-55) and the run goes green. The customer photos stay in Cloudinary for good. This breaks owner
rulings D-04 ("deleted within a day") and D-22, the privacy promise on `docs/api/quote-requests.md:375,476`, and the stray sweep, which
queues strays that can never leave. The same defect already affects Phase 11 content photos (`PhotoDeleted`, `PhotoReplaced`).

No test catches it: `ImageRemovalJobTests` use only `csps-test/orders/...` ids (line 26), and the deletion handler tests stop at "enqueued".
The docs contradict themselves: `maintenance.md:64-67` says both jobs touch orders, content and quotes, but `:76` says "A file outside the
site's own orders folder is never removed either", and `:93` explains `outside-folder` as "the file is not in this site's folder".
I did not find this in the earlier wave reviews, fix reports, `deferred-items.md` or `13-SECURITY.md`.

**Fix:** Let the removal job accept the three own folders, each with its trailing slash, and keep refusing anything else:

```csharp
// ImageRemovalJob.RunAsync
var folders = new[]
{
    $"{storage.RootFolder}/orders/",
    $"{storage.RootFolder}/content/",
    $"{storage.RootFolder}/quotes/",
};
...
// RemoveRowAsync(..., string[] folders, ...)
if (!folders.Any(folder => row.PublicId.StartsWith(folder, StringComparison.Ordinal)))
{
    await FailRowAsync(row, holder, OutsideFolderCode, startedAt, cancellationToken).ConfigureAwait(false);
    return FailedStep(row);
}
```

Add red tests first: a queued `{root}/quotes/{guid}/{id}` and a `{root}/content/lines/{guid}/{id}` row are removed through the storage and
completed, and `csps-test-more/quotes/...` and `csps-test/quotes-old/...` still fail as `outside-folder`. Then correct
`docs/operations/maintenance.md:76`. Rows already stuck with attempts of 5 or more are still claimed every run, so they clear on the
first run after the fix. Report this to the owner as a data-removal gap that was live since the Phase 11 content photos.

### Warnings

None.

### Info

#### IN-01 (G2A-IN-01): Three doc and comment statements are stale

**File:** `docs/api/quote-requests.md:11-12`, `docs/api/orders.md:584-585`, `src/Csps.Server/Controllers/OrdersController.cs:268`
**Issue:**
- `quote-requests.md` says "Turning a request into an order comes in a later plan of Phase 13 and will be added here", but the same file
  has the full section "Turning a request into an order" at line 404.
- `orders.md` ("Images (ORD-06)") says "There are none yet, so nothing is scheduled today", and the controller comment says "Image cleanup
  joins this delete when orders have images". Order images exist since Phase 9, and `PermanentlyDeleteOrderHandler.cs:82-85` queues each one.
**Fix:** Delete the "later plan" sentence. Reword the other two to say the photo files of the order are queued in the same save and removed
by the daily run.

#### IN-02 (G2A-IN-02): `docs/web/budgets.md` still describes the end of plan 13-09

**File:** `docs/web/budgets.md:237-253`
**Issue:** The table is headed "at the end of plan 13-09 (... no photo picker yet)" and says the picker "joins the form's piece". The picker
shipped later as its own lazy piece, and later waves measured Quote form at about 44.4 KB, Contact about 148.2 KB and Privacy about 149.1 KB
(`13-REVIEW-FIX-W9.md`). The fix W10 report recorded the rows "no code", so the doc was never updated. Someone reading it sees 1.11 KB of room
on the Quote form row and 2.80 KB on Contact, which is no longer true (about 0.6 KB and 1.8 KB).
**Fix:** Replace the table with the final plan 13-26 figures, or add a dated "later figures" line, and reword the "photo picker joins" sentence.

#### IN-03 (G2A-IN-03): The ceiling 429 says "try again in a minute", but `Retry-After` can be up to an hour for the quote create route

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:26,224`
**Issue:** `SiteBusyDetail` is shared by the page view ceiling (600 a minute) and the quote ceiling (60 an hour). For the quote ceiling the
header can be hundreds of seconds, and the existing test accepts any value from 1 to 3600 (`QuoteRateLimitTests.cs:113`). The API text and
header disagree. The web form uses its own copy, so no visitor sees the server text; only API callers do.
**Fix:** Make the detail neutral, for example "The site is busy. Please try again later.", or pick the text by policy window.

#### IN-04 (G2A-IN-04): The workflow timeout (20 minutes) can be shorter than the script's worst case

**File:** `.github/workflows/maintenance.yml:24` with `web/scripts/maintenance.mjs` (`MAX_CALLS` 10, `CALL_TIMEOUT_MS` 120000, 4 conflict waits of 60 s)
**Issue:** The script allows 10 calls of up to 120 s each, plus busy waits. That is 20 minutes or more. If a large backlog (for example the first
runs after the quote photo strays pile up) needs all 10 calls, GitHub cancels the job at 20 minutes. The run is red but the script's own
summary is not written, so the owner gets no counts.
**Fix:** Set `timeout-minutes: 30`, or lower `MAX_CALLS` so the script always finishes first.

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g2b: Infrastructure

**Depth:** deep
**Files reviewed:** 29
**Status:** issues_found (4 Info only)

### Summary

I read all 29 files, the migrations against the configurations and the snapshot, and the callers that decide the transaction scope (`CreateQuoteRequestHandler`, `CreateOrderHandler`, `PermanentlyDeleteOrderHandler`, `ChangeQuoteRequestStatusHandler`, `OutboxEmailSender`, `OutboxSignalInterceptor`, `QuoteAlertText`, `StraySweepJob`).

I found no Critical issue and no Warning. The areas on the focus list hold up, and I checked each against the source:

- **No raw SQL, no triggers, no JSON columns.** A grep over the quote store, reader, retention job, inventory and the seven migrations finds no `FromSql`, `ExecuteSql`, `SqlQuery`, `migrationBuilder.Sql` or `CREATE TRIGGER`. The only SQL text is check-constraint and filter definitions in Fluent config, which is schema, not application SQL.
- **Order link.** `IX_QuoteRequests_OrderId` is unique with `[OrderId] IS NOT NULL` in the migration, in the config and in the snapshot. `FindByOrderAsync` can use `SingleOrDefault` safely. The FK to Orders is NO ACTION, and the permanent order delete removes the request first, so EF orders the commands correctly. The `QuoteRequestStatusChanges.OrderId` rows go with the request by cascade in the same statement.
- **Save request then queue alert.** `SaveUnderLockAsync` adds the request and the outbox row to one context and calls one `SaveChangesAsync` inside `InTransactionAsync`. `OutboxEmailSender.EnqueueAsync` only adds to the context. A rollback queues nothing. `OutboxSignalInterceptor` wakes the dispatcher only after the commit. The exception swallowed by `EnqueueQuietlyAsync` is thrown before anything is added, so nothing is left half done.
- **Alert cap (D-09).** The count and the insert both run under the `quote-requests` row lock, which is held to the end of the transaction. A later send can only take the lock after the earlier send's outbox row is committed, so the cap holds under concurrency, with or without read-committed snapshot.
- **Conversion lock.** `LockForConversionAsync` updates the request row before the tracked read, so the tracked row version is fresh. A second order save waits, re-checks `Status != Converted`, matches zero rows and gets the already-converted answer. A timeout or deadlock maps to `ConcurrencyConflictException`, which `CreateOrderHandler` turns into the busy answer. The earlier IN-06 (wait length) is fixed in the source.
- **Retention.** Batches are one transaction each. The photo ids are queued, the requests deleted, and a count mismatch leaves the transaction uncommitted (rollback on dispose). Photos, status history and notes go by database cascade. Converted requests are excluded in both the select and the delete. The queue rows survive the photo rows, so the stray sweep (min age 2 days, plus the "known" check against queued ids) cannot re-queue or miss them. Outbox rows holding visitor text are purged by the existing 30-day outbox rule.
- **Email.** Every value goes through `WebUtility.HtmlEncode` (quotes included). Link URLs come from `AppLinksOptions` only. The subject and all single-line fields pass through `QuoteAlertText.OneLine`, which removes line breaks, control and format characters, so a visitor cannot add a header. The alert address comes from Site Content, which validates its shape.
- **EF translation.** `Contains` over the status array, the explicit `Collate` for email, the grouped counts, the left joins with `IgnoreQueryFilters(["SoftDelete"])` and the correlated subquery in `OrderReader` all translate to one command each. There is no N+1. The list page size and page number are bounded in the validator, so `Skip` cannot overflow.
- **UTC and types.** All times are `datetimeoffset` UTC. Byte-backed enums have check constraints that match the enum values (Status 1 to 6, ProductChoice 1 to 3, QuantityRange 1 to 5, Slot 0 to 4). Column lengths match the rule constants. Row version is on `QuoteRequests`. `DatabaseLocks` has no row version, as designed.

Earlier findings were not re-raised: W3 WR-01 (lock timeout), W3 WR-02 (ticket reuse), W3 IN-03 (rollback branch test), W7 IN-02 (detail read is now retried on a moved row version), W8/W9 IN-01/IN-05 (upload race, accepted), W9 IN-06 (conversion wait).

### Info

#### G2B-IN-01: `CspsDbContext` still says the lock table holds 67 standing locks, but the code now seeds 69

**File:** `src/Csps.Infrastructure/Persistence/CspsDbContext.cs:116`
**Issue:** The doc comment on `DatabaseLocks` says "67 standing locks". The standing list is 5 named locks plus 64 account stripes, which is 69, and `DatabaseLockConfiguration` was updated to say 69 in this phase. The context comment was missed, so the two comments now disagree. The count is also repeated by hand, so it will drift again on the next new lock.
**Fix:** Say "the standing locks (see `DatabaseLocks.StandingNames`) and short-lived idempotency claims", with no number, in both comments.

#### G2B-IN-02: `LockForConversionAsync` does not check that a transaction is open, unlike `DatabaseLocks.TakeAsync`

**File:** `src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs:34-59`
**Issue:** `DatabaseLocks.TakeAsync` throws `InvalidOperationException` when `context.Database.CurrentTransaction` is null, because a row lock taken outside a transaction ends at once and locks nothing. `LockForConversionAsync` is the same kind of lock (an `ExecuteUpdate` used only for its row lock) but has no such guard. Today the only caller, `CreateOrderHandler.ConvertQuoteRequestAsync`, runs inside `InTransactionAsync`, so nothing is broken now. A later caller that forgets the transaction would see `true`, then read and convert the request with no protection, and a second order could pass the check. The unique index would still stop the second link, but only as a late 500-style failure after the order is built.
**Fix:** Add the same guard as `TakeAsync` at the top of the method:
```csharp
if (context.Database.CurrentTransaction is null)
{
    throw new InvalidOperationException("A conversion lock can only be taken inside a transaction.");
}
```

#### G2B-IN-03: A quote alert for a name made only of invisible characters has an empty name line and an empty subject name

**File:** `src/Csps.Infrastructure/Email/EmailRenderer.cs:133, 150-151`
**Issue:** `QuoteAlert` uses `QuoteAlertText.OneLine(email.CustomerName)` for the Name field, the subject and the preheader. `OneLine` drops Unicode format characters. The domain only trims the name and checks that it is not empty (`QuoteRequestRules.cs:201-204`), and `char.IsWhiteSpace` is false for U+200B, so a name such as two zero-width spaces is accepted and stored. The alert then reads "Name: " with nothing after it, the subject is "New quote request from " with a trailing space, and the preheader starts with " sent a quote request." Staff get a lead with no readable name in the email. The root cause of the invisible stored name is in the domain rules (another group), but the renderer is where it shows and it has no fallback. This is cosmetic, with no security effect.
**Fix:** In the renderer, use a fallback when the cleaned name is empty, for example:
```csharp
var name = QuoteAlertText.ShortName(email.CustomerName);
if (name.Length == 0) { name = "a visitor"; }
```
and use it for the Name field, subject and preheader. A fuller fix is to reject a name with no visible character in `QuoteRequestRules`.

#### G2B-IN-04: A retention run that fails after some batches reports no count for the batches already committed

**File:** `src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs:49-57`
**Issue:** `DrainAsync` commits each batch on its own. If batch 3 throws a database error, the catch returns `MaintenanceLine(RemovedLabel, null, true, FailedText)`. Batches 1 and 2 (up to 400 requests and their queued photo files) are already committed, but the owner sees only "could not be removed" with no count. The data is correct, since each batch is atomic and the next run continues, but the report is misleading when partial work was done.
**Fix:** Keep the running total in a field or an out value and, on failure, report it, for example `new MaintenanceLine(RemovedLabel, removedSoFar, true, FailedText)`, if the line type allows a count with a failure. Otherwise note in the doc comment that a failed line can follow committed batches.

---

_Reviewed: 2026-11-24T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g3: Domain, Application and Infrastructure tests

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 33
**Status:** issues_found

### Summary

I read every test file in the list and the production code each one targets (the quote request aggregate and rules, the create, upload, status, note, delete, detail, prefill and ticket handlers, the alert text, the settings, the retention job, the ticket maker, the Cloudinary usage job, the create order handler and the rate limit registration).

The suite is strong. I found no test that asserts only a mock, no tautology and no test that cannot fail. Time is always fixed (`FakeTimeProvider`, fixed `DateTimeOffset` values or a fixed `IBusinessCalendar`). No file touches `DateTime.Now`, sleeps, or sets an environment variable. Test databases come only from the `CspsDatabase` fixture (`CSPS_Test_<guid>`); no `BetsLLC_*` name appears. `CspsApiFactory` sets everything through `UseSetting` (process local) and the new keys (`RateLimits:QuoteCreate`, `RateLimits:QuoteCeiling`, `RateLimits:QuoteAlertTest`, `QuoteRequests:MinimumSeconds`, `QuoteRequests:PerSenderPerDay`) match the real section names and bounds. All fake values (`example.com`, `example.test`, `0917 123 4567`, random upload keys) are plainly fake and would not trip a scanner. The privacy fixture, the C# `LegalPages` facts and the web `legalPages.ts` agree (1.1, 2026-11-22, draft).

The findings below are gaps: two behaviors the tests claim to cover but would not catch if broken, and six smaller points. Earlier outcomes respected: W1 WR-02 (usage cursor saved before the alarm lines) is parked for the owner, so `AddsNoLineLaterTheSameMonth` is not raised again.

### Warnings

#### G3-WR-01: The retention job's rollback branch is still untested (earlier W3 IN-03, never fixed)

**File:** `tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs` (whole file; the branch is `src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs:67` and `:121-127`)
**Issue:** `13-REVIEW-W3.md` IN-03 asked for a test of the "delete count differs from read count" branch. The W1-3 fix report covered only five owner-named findings, and `deferred-items.md` does not list IN-03, so it has no recorded outcome and is still open. This is the branch that protects D-22 (a request converted between the id read and the delete must survive) and stops photos being queued for a request that stays. Every test in the file either removes everything it reads or removes nothing. The `Status != Converted` guard inside the `ExecuteDeleteAsync` and the `batch < 0` result (`More = true`, nothing deleted, nothing queued) are never run.
**Failure scenario:** Someone drops `&& request.Status != QuoteRequestStatus.Converted` from the delete, or changes `deleted != ids.Count` to `deleted < ids.Count`. A converted request is then purged with its photos, a D-22 data loss, and the suite stays green.
**Fix:** Add one test that flips a read request to Converted after the id read and before the delete, then asserts: the request and its photo rows survive, no `ImageDeletion` row exists, and `More` is true. A small `DbCommandInterceptor` on the context can run `UPDATE QuoteRequests SET Status = Converted` (via `ExecuteUpdateAsync` on a second context) when it sees the first `DELETE` command, like `SpendBudgetAfterFirst` already does.

#### G3-WR-02: Nothing pins that the honeypot and too-fast checks run before validation (D-25)

**File:** `tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs:198-216` and `:316-332` (handler order is `CreateQuoteRequestHandler.cs:52-71`)
**Issue:** D-25 says a request caught by the honeypot or the minimum-time check gets a normal success answer and learns nothing. Every caught-bot test sends a form that is otherwise valid (`Request()` has a name and a phone). The ticket-before-honeypot order is pinned (`ASendWithNoGoodTicket...` sends a filled honeypot and expects the ticket error), but the honeypot-before-validation and too-fast-before-validation orders are not.
**Failure scenario:** A refactor moves `validator.ValidateAsync` above the honeypot check. A bot that fills the hidden field and also posts an empty or malformed form now gets a 400 with the names of the failing fields, so it learns which fields exist and that it was not treated as a normal send. All current tests still pass.
**Fix:** Add two cases: `CreateQuoteRequestRequest.Empty with { Ticket = "ticket", SubjectLine = "x" }` must return success with `Caught == ["honeypot"]`, and the same empty form with `TicketReading = QuoteTicketReading.Valid(TimeSpan.FromSeconds(1))` must return success with `Caught == ["too-fast"]`. Both must leave `Added` empty.

### Info

#### IN-01 (G3-IN-01): The detail handler test leaves several mapped fields unasserted

**File:** `tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs:116-137` (mapping at `GetQuoteRequestHandler.cs:80-102`)
**Issue:** The shared `View(...)` passes no notes (`[]`, line 132) and no `PhotosRemovedAtUtc` (`null`, line 130), and the first test never asserts `Email`, `TeamName`, `Message`, `Product.Title`, `StatusChangedAt` or `LastChangedAt`. The response constructor takes several same-typed positional values (`DateTimeOffset`, `DateTimeOffset?`, `string?`), so a swap compiles and passes this file. The server integration tests (`QuoteRequestNoteTests`, `GetQuoteRequestTests`) do read `notes` and `photosRemovedAt` through the API, which limits the risk.
**Fix:** Give the view one note, a `PhotosRemovedAtUtc`, a team, an email, a message and a product title, and assert each on the response.

#### IN-02 (G3-IN-02): No test for a name that is empty after cleaning, or for bidi marks in the message excerpt

**File:** `tests/Csps.Application.UnitTests/QuoteRequests/QuoteAlertTextTests.cs:64-75`, `:108-112` (behavior in `QuoteAlertText.cs:34-63` and `:71-110`)
**Issue:** `OneLine` drops format characters, so a name made only of zero-width characters (for example U+200B, which `string.Trim` does not remove and which passes the domain name rule) becomes `""`. The subject is then `"New quote request from "` and the body line is `"Name: "`. Separately, `Excerpt` only strips `char.IsControl` characters, so U+202E and other bidi overrides in the message pass into the plain text body, while the subject tests prove they are dropped there. No test states either behavior.
**Fix:** Add a case for an all-format-character name (decide the wanted subject, for example fall back to "a visitor") and a case for bidi marks in `Excerpt` (strip them, as the subject does). Fix the two small production gaps with the tests.

#### IN-03 (G3-IN-03): "Business hour" test runs in UTC, so it cannot tell the business zone from UTC

**File:** `tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs:425-435` and `:611-615` (production `HourStart`, `CreateQuoteRequestHandler.cs:143-147`)
**Issue:** `FixedCalendar` always returns `TimeZoneInfo.Utc`. `TheCountStartsAtTheTopOfTheBusinessHour...` expects `10:00Z` for `10:30Z`. If `HourStart` used `clock.UtcNow` directly and ignored the zone, the test would still pass. The business zone is Manager-editable, so a half-hour offset zone is possible in principle (the 20-an-hour cap would then reset on the wrong boundary).
**Fix:** Give the harness a calendar with a +05:30 offset. At `10:15Z` the local time is 15:45, so the local hour starts at 15:00, which is `09:30Z`. Assert the count starts at `09:30Z`.

#### IN-04 (G3-IN-04): The tamper test may exercise base64 strictness instead of the signature

**File:** `tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteFormTicketsTests.cs:57-65`
**Issue:** `AChangedTicketIsExpired` changes only the last character (`'A'` becomes `'B'`, anything else becomes `'A'`). A base64url string whose length is not a multiple of 4 has unused low bits in its last character. I checked on the installed .NET 10 shared framework: `WebEncoders.Base64UrlDecode("QQ")` decodes, `("QR")` throws `FormatException`. When the last character is `'A'` the flip lands only in unused bits, so the ticket is refused for a format error and the signature check is not what the test proves. Which path runs depends on the random ticket. The result (expired) is right either way, and `ATicketFromAnotherPurposeOrKeyRingIsExpired` does prove the key check, so this is a clarity gap only.
**Fix:** Flip a character in the middle (`ticket.Length / 2`) so the payload bytes change and the authentication check fails every time.

#### IN-05 (G3-IN-05): Stale or misleading names and a vacuous assertion in the email tests

**File:** `tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs:11-15`, `:600-611`
**Issue:** The class summary still says "all ten auth emails"; the `AllKinds` theory now holds 14. `TheQuoteAlertHasNoAttachmentAndOnlyTheSitesOwnAdminLink` claims "no attachment", but `RenderedEmail` is only `(Subject, Text, Html)`, so no attachment can exist and nothing is asserted about one. Its two `ShouldAllBe` calls also pass on an empty match list, so the test would pass if the admin link were missing (the first quote test does assert the link, which covers this).
**Fix:** Update the summary, rename the test to what it checks (only the logo image and only the admin link), and add `.ShouldNotBeEmpty()` on the href matches.

#### IN-06 (G3-IN-06): "Every status" skips Converted, and five audit tests are copies

**File:** `tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs:232-239`; `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:34-87`
**Issue:** `ANoteCanBeAddedInEveryStatus` filters out Converted, so whether a converted request still takes notes is not pinned (the domain allows it today, and D-17 does not forbid it). Also, the five new `The...CodeIsInTheCatalogAndAcceptedByAuditEntry` tests are the same body with a different name and code.
**Fix:** Add a Converted case through `MarkConverted` that states the intended result. Fold the five audit tests into one `[Theory]` over (field name, code).

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g4: Server integration tests

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

### Summary

I read all 26 files and the production code they target (the quote controllers, `QuoteFormTickets`, `CspsApiFactory`, `CspsDatabase`, `ConcurrentRequests`, `AuthorizationMatrixTests`). I also checked the W1 to W11 reviews and fix reports so nothing already settled is raised again.

What holds up:

- **Authorization matrix.** Every new endpoint has a row. That is the 3 public routes (ticket, create, photo), the 7 staff routes (list, new-count, get, order-prefill, status, notes, delete) and `quote-alerts/test`. The two anonymous public POSTs and the ticket GET are in the allow-list. The key strings match the controller route templates. `DiscoveredEndpointsAreFullyCovered` fails on a missing row, and `MatrixRowReturnsExpectedStatus` plus the parallel run exercise each row for all three callers. I found no gap.
- **Database naming.** Every database comes from `CspsDatabase` (`CSPS_Test_<guid>`) or the never-created `CspsApiFactory()` name. Nothing creates or drops a database by hand.
- **Fixture isolation.** Each class has its own database, and every test resets it first. `SiteSettings`, `ProductLines`, `DatabaseLocks` and `AuditLog` survive a reset. The tests handle this: each alert test sets the address itself, the line tests restore the six lines, and audit lookups are scoped by target id or actor id.
- **Rate limits.** Each test builds its own host, so limiter state is not shared. The limits use real windows of 10 minutes or 1 hour, so no wall-clock wait is involved.
- **Test data.** Addresses use example.com, example.test, example.invalid and TEST-NET-3 IPs. Phone numbers are the UI-SPEC sample style. Nothing a secret scanner would flag.

The problems are all about test strength. One assertion cannot fail, three concurrency tests do not force the race they claim to cover, and two tests promise more than they check. I found no production defect and no blocker.

### Warnings

#### G4-WR-01: The "tampered ticket" case also expires, so it cannot detect a tamper

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs:109-135` (tamper built at line 118, clock moved at line 119)
**Issue:** `old` and `fresh` are both issued at `Start`. The test builds `tampered` from `fresh`, then moves the fake clock forward 24 hours and 1 second, and then posts all three cases. `QuoteFormTickets.Read` runs the Data Protection check first and the age check second (`age > TicketLifetime`, using the fake clock). So even if a one-character change were NOT detected, the tampered ticket would still fail the age check and answer 400 `quote-requests.ticket-expired`. The case passes whether or not tampering is detected.

There is a second weak point. The last character of a base64url ticket can carry unused bits, so changing it may decode to the same bytes. Only a check before the clock move would tell. The other tamper test (`ATamperedTicketAnswerAlsoCarriesAUsableReplacement...`) uses the text `not-a-ticket`, not a one-character change, so nothing else covers it.

**Failure scenario:** someone changes `Read` to skip the Data Protection `Unprotect` or to accept a bad signature. The ticket in this test is still expired by age, so the build stays green, and a forged ticket would be accepted in production.

**Fix:** test the tamper at a time when the ticket is otherwise valid.

```csharp
// Before the clock move: a one-character change must be refused even though the ticket is young.
var tamperedYoung = fresh[..^1] + (fresh[^1] == 'A' ? 'B' : 'A');
```

Post `tamperedYoung` with the clock at `Start` plus 3 seconds. A valid young ticket would answer 200 and save a row. A tampered one must answer 400 `ticket-expired` and save nothing. Better still, change a character in the middle of the ticket, not the last one, so unused trailing bits cannot hide the change. Keep the "past 24 hours" case for `old` only.

#### G4-WR-02: Three "at the same time" tests do not force an overlap and can pass without a race

**Files:**
- `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertCapTests.cs:92-96` (`ParallelSendsNeverPassTwenty`)
- `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs:109-111` (`ParallelSendsFromOnePhoneNeverMakeAFourthRow`)
- `tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs:250-252` (`TwoCreatesAtOnceAreBothSaved`)

**Issue:** each sender calls `QuoteRequestFixtures.PostAsync`, which first awaits a `GET /ticket` and only then sends the POST. In the first two tests there is no start gate at all: the senders are `Task.WhenAll` of async lambdas. In the third, `ConcurrentRequests.SendTogetherAsync` releases the gate before the ticket fetch, so the gate synchronizes the GETs and not the POSTs. The two POSTs can arrive 10 or more ms apart, and if they run one after the other the test still passes.

For the cap and sender-limit tests this matters because the assertions are the same for a correct and a racy server. For example, `OK` and `429` is the expected pair in both cases when the sends are serialized.

**Failure scenario:** someone removes or weakens the `quote-requests` lock in `QuoteRequestStore.SaveUnderLockAsync`. On a fast machine the five POSTs happen to run one after the other, the counts come out right, and the test stays green. The 20-alert cap and the 3-a-day limit are then unprotected against real concurrency (CWE-362). W5 recorded this test as the proof of the cap race, so the weakness is worth fixing.

**Fix:** fetch every ticket first, then release only the POSTs through one gate, and repeat a few rounds.

```csharp
var bodies = await Task.WhenAll(Enumerable.Range(0, 5).Select(async _ =>
{
    var body = QuoteRequestFixtures.MinimalBody();
    body["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
    return body;
}));
var responses = await ConcurrentRequests.SendAllTogetherAsync(
    [.. bodies.Select(body => (Func<Task<HttpResponseMessage>>)(() => QuoteRequestFixtures.PostAsync(client, body)))]);
```

Dispose the responses afterwards. The same shape fixes the sender-limit test (two bodies) and the "two creates" test.

#### G4-WR-03: `TheGuardsNeverAskTheVisitorToSolveAnything` cannot fail in a way that matters

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs:257-269`
**Issue:** the test fetches the `GET /ticket` JSON and asserts it does not contain "captcha", "puzzle", "challenge", "recaptcha" or "turnstile". That body is a ticket string, the photo rules and a number. A word like these could not appear there however the guards change. A visitor puzzle would live in the page or in a 400 answer, and neither is read. The test name claims D-25 ("no puzzle") coverage that it does not give. It is a permanent green.

**Failure scenario:** a developer adds a captcha step and a `captchaToken` requirement to `POST /public/quote-requests`. This test stays green, so the repo shows a passing D-25 check while a puzzle exists.

**Fix:** either remove the test and keep D-25 as a web-side assertion, or make it real: post a body with no extra member besides the ticket and the honeypot absent, and assert that no 400 problem body asks for anything beyond `ticket-expired` and the field errors (for example, that the create route accepts a valid body with only the documented members). A short assertion on the OpenAPI request schema (no member with `captcha`, `token` or `challenge` in its name) is also cheap.

#### G4-WR-04: The ceiling test is named for three routes and checks two, one of them weakly

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs:149-176` (`TheQuoteCeilingLeavesTheTicketThePhotoAndThePageViewRoutesAlone`)
**Issue:** the test sends a ticket GET and a photo POST while the ceiling is used up. It never sends a page view request, so one of the three promised routes is unchecked. The photo check is `ShouldNotBe(429)`, which also passes for a 500 or a 404. The ticket check is a strict 200.

**Failure scenario:** a change attaches the `quote-ceiling` policy to the whole `/api/v1/public` group or to the page view beacon. Page views start answering 429 once the quote ceiling is hit, and this test stays green.

**Fix:** add the page view call (`POST /api/v1/analytics/page-views` with the CSRF header the beacon uses, from a fresh address header) and assert it is not 429, or drop "PageView" from the name. Assert the photo answer is the expected non-limit status (400 `images.file-missing` for the no-body post) so a 500 fails the test.

### Info

#### G4-IN-01: The needle "0917" can appear by chance inside a GUID or a timestamp

**Files:**
- `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStatusTests.cs:112`
- `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestNoteTests.cs:119`
- `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs:281`

**Issue:** the "no personal data in the stored answer or the logs" checks use `0917` (case-insensitive) as the stand-in for the visitor's phone. The stored response holds a random request id, a random note id, a base64 version and an ISO time with seven fractional digits. A hex or digit run of `0917` can appear in those by chance. The chance is small (roughly 0.1% per run in total), but the failure would look like a data leak and be hard to explain.
**Fix:** search for something that cannot occur by chance: `"0917 123"`, `"639171234567"` or the whole phone text, and keep `"Juan"`.

#### G4-IN-02: `QuoteRequestFixtures.PostAsync` changes the caller's dictionary, and a test depends on it

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestFixtures.cs:36-39`, used by `CreateQuoteRequestTests.cs:62-81` (`AReplayReturnsTheSameAnswer`)
**Issue:** the helper adds the fetched `ticket` to the dictionary it was given. `AReplayReturnsTheSameAnswer` only works because of that: the second call sees the ticket from the first and sends the identical body. If the helper is later made side-effect free, the replay sends a different ticket, the idempotency fingerprint differs, and the test fails for a reason that looks unrelated. The doc comment hides the side effect.
**Fix:** state the mutation in the `<remarks>`, or make the replay test fetch the ticket itself and set `body["ticket"]` before the first call.

#### G4-IN-03: The "no route changes or removes a note" check would miss a singular `note` route

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestNoteTests.cs:220-223`
**Issue:** the filter keeps endpoints whose pattern contains `quote-requests` and `notes`. A route such as `DELETE quote-requests/{id}/note/{noteId}` (singular) is not selected, so the test passes while the rule it guards (D-17: add-only notes) is broken.
**Fix:** match on `"note"` instead of `"notes"`, or assert the set of all `quote-requests` routes and methods against an expected list.

#### G4-IN-04: The list tests repeat the staff rig and seed code

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/ListQuoteRequestsTests.cs:289-426` (`Seed` and `Rig`), against `QuoteRequestStaffRig.cs:27-217` (`QuoteSeed` and `QuoteRequestStaffRig`)
**Issue:** the two rigs do the same job (reset, start a host with an Admin, save a request and then set the received time and the status straight in the table, get with a token, read a body). They differ in small ways (stored photo columns, the `Id` override, `Email` and `Message`). Any change to how requests are seeded must be made twice, and the two copies can drift apart.
**Fix:** give `QuoteSeed` an optional `Id` and a `DeclaredCount`, and make the list tests use `QuoteRequestStaffRig`.

#### G4-IN-05: `HoldLockAsync` and the first/second sends can leak if an assertion fails

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs:259-267` and `:146-154`
**Issue:** `HoldLockAsync` opens a context and a transaction, then runs `changed.ShouldBe(1)` before the `LockHold` that owns them exists. If that assertion throws, nothing disposes the open transaction, and the `order-numbers` lock row stays held until the process ends, so every later test in the class waits 10 seconds on that lock. In the same test, if `WaitUntilLockedAsync` throws the timeout, the `first` and `second` send tasks are never awaited while the host is torn down. Both only happen on a failing run, which is when a clean report matters most.
**Fix:** wrap the `ShouldBe(1)` in `try` and dispose the transaction and context on failure, or build the `LockHold` first and check the count through it. In the test, await or cancel `first` and `second` in a `finally`.

---

_Reviewed: 2026-11-24T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g5: Web public module, shared components, core/api

**Reviewed:** 2026-11-24T12:00:00-06:00
**Depth:** deep
**Files Reviewed:** 49
**Status:** issues_found

### Summary

I read all 49 files, followed the quote form into `useSubmission`, `Button`, the server `CreateQuoteRequestRequestValidator`, `QuoteRequestRules`, `PhilippinePhone`, `CreateQuoteRequestHandler` and `IdempotencyMiddleware`, and compared them with the zod schema and the earlier wave reviews (W1 to W11, UI review).

What holds up:

- **Schema parity.** The zod rules, limits, messages, quantity values and product choice values match the server word for word. The phone rule matches `PhilippinePhone`, including the 30 character cap on the trimmed text.
- **Idempotency.** One key per filled form. The same key is reused on a maybe-sent retry, and the upload key is tied to that key. A replacement ticket gets its own key `R`, kept in `resendRef`, so a retry of the resend repeats `R` and never sends twice.
- **Ticket logic.** Expired ticket handling is one resend only. A missing replacement refreshes the ticket and throws.
- **Photos.** Previews are `data:` URLs, so there is no object URL to leak. The CSP allows `img-src data:`. There is no `dangerouslySetInnerHTML`, `eval` or inline script in scope. No personal data goes into a URL or a log. There is no long dash in `web/src`.
- **Lazy chunk boundaries.** `QuoteForm` imports the photo kit and the send-answers piece only as types, so the D-35 and D-43 splits hold.

I found no blocker. Three warnings are real defects in the photo picker and the send-failure box. Four info items are minor.

### Warnings

#### G5-WR-01: A photo preview stays a grey skeleton for good when the photo being drawn is removed

**File:** `web/src/modules/public/components/QuotePhotoPicker.tsx:108-124`

**Issue:** Only one preview is drawn at a time (`drawing.current`). When the draw ends for a photo that was removed meanwhile, the guard on line 120 (`latest.current.includes(next)`) skips `setPreviews`. That guard is the W1 IN-05 fix. But `drawing.current = null` is a ref write, so nothing re-renders. The effect depends on `[photos, previews, rules.maxBytes]` and none of them changed, so it never runs again.

**Failure scenario:**
1. A visitor picks photos A and B. A is decoding. A large phone photo takes a second or more.
2. The visitor presses Remove on A. `remove` sets a fresh `previews` map, the effect re-runs, and it returns early because `drawing.current` is still A.
3. A's draw ends. `drawing.current` becomes null and A is no longer in `latest`, so no state is set.
4. B shows the `Skeleton` placeholder until the visitor adds or removes another photo. The same happens to a photo added while A was drawing.

The photo still sends, but the visitor sees a loading placeholder that never finishes. This is the same shape as W1 IN-05: that fix guarded the write but did not keep the draw loop alive.

**Fix:** Always change state when a draw ends, so the effect runs again for the next photo:
```tsx
.then((url) => {
  drawing.current = null;
  setPreviews((current) => {
    const next_ = new Map(current);
    if (latest.current.includes(next)) next_.set(next, url);
    return next_;
  });
});
```
Add a picker test: remove the photo being drawn while a second photo waits, then expect the second preview to appear.

#### G5-WR-02: The failed-send box stays on screen during the retry, and a second identical failure is not announced

**File:** `web/src/modules/public/components/QuoteForm.tsx:249-270` (with `web/src/lib/forms/useSubmission.ts:162-185`)

**Issue:**
- `useSubmission.run` does not clear `error` when a new attempt starts. It only clears it on success or `reset()`.
- `sendStatus()` returns null only when `sendError === undefined` or `answers === null`. It does not look at `pending`.
- So after a failed send, the red "Couldn't send" or "We're not sure it went through" box stays visible while the retry runs and the button says "Sending".
- If the retry fails the same way, `SendStatus` re-renders the same `QuoteSendBox` with the same text. The `role="alert"` node is not replaced, so a screen reader announces nothing for the second failure (WCAG 4.1.3).

**Failure scenario:** A visitor on a weak connection presses Send, hears "We're not sure your inquiry went through", presses Send again, and the request times out again. A sighted visitor sees the old box through the whole retry. A screen reader user gets no feedback that the second attempt failed.

**Fix:** Hide the box while a send is running, so the next failure mounts a fresh alert:
```tsx
const sendStatus = (): ReactNode => {
  if (pending || sendError === undefined || answers === null) {
    return null;
  }
  ...
```
`SendStatus` remounts, and its `applied` ref starts clean, so a repeated 400 still puts its messages on the fields. Add a test that fails twice with a timeout and checks the alert text is announced the second time (the alert node is a new element).

#### G5-WR-03: Keyboard focus drops to the page body after the first photo pick

**File:** `web/src/modules/public/components/QuotePhotoSlot.tsx:52-63` (and `QuotePhotoPicker.tsx:127-139`)

**Issue:** Before the first pick, the visitor presses the Slot's `Choose Photos` button. While the photo piece loads, that button is `aria-disabled` and keeps focus. When `loaded` is set, the Slot returns the picker, which is a different component tree. The button is removed from the DOM and focus falls to `<body>`. The picker only moves focus after a Remove (`focusTick !== 0`). Nothing moves focus on mount.

**Failure scenario:** A keyboard or screen reader user tabs to Choose Photos, picks files, and the photo list appears. Focus is now at the top of the document. They must Tab through the whole form again to reach Remove or the Send button (WCAG 2.4.3 Focus Order). The UI review and W5 checked focus after Remove and on errors, but not this hand-off.

**Fix:** Have the picker take focus when it mounts from a first pick. For example, pass `focusOnMount` from the Slot and, in the picker, start with `focusTarget.current = photos[0] ?? 'add'` and `focusTick = 1`. The existing `focusTick` effect then focuses the first photo's Remove button, or the add control when no photo was accepted. Add a Slot or form test that picks a file by keyboard and expects `document.activeElement` to be inside the picker group.

### Info

#### G5-IN-01: The quote schema trims with JavaScript's rules, not .NET's, so a few edge inputs pass the browser and fail on the server

**File:** `web/src/modules/public/quoteSchemas.ts:68-83` (server: `CreateQuoteRequestRequestValidator.cs:19-46`)

**Issue:** The schema uses zod `trim()` (JavaScript `trim`). The server uses .NET `Trim()` and `IsNullOrWhiteSpace`. They differ on U+0085 (.NET trims it, JavaScript does not) and U+FEFF (JavaScript trims it, .NET does not). W9 IN-04 fixed this for the staff note schema only. In this form:
- A name made only of U+0085 passes the browser (`minLength(1)`) and the server answers 400 "Enter your name.".
- A message of exactly 2,000 characters followed by U+FEFF passes the browser and fails on the server's 2,000 limit.

Both end in a server message on the field, so nothing is lost. But OR-3 says the browser covers every rule.

**Fix:** Reuse the note schema's .NET-exact trim for `customerName`, `teamName`, `contactNumber`, `email` and `message`, with tests for U+0085 only and a trailing U+FEFF at the limit.

#### G5-IN-02: A comment in `canRetry` says the server answers 422 to a keyed multipart retry, which is no longer true

**File:** `web/src/core/api/http/httpClient.ts:479-483`

**Issue:** The comment says a new multipart boundary makes a keyed retry a different body, so "the server would answer 422". `IdempotencyMiddleware` now hashes a multipart body part by part, never by boundary (LIB-CR-02, `IdempotencyMiddleware.cs:21, 151-157`), so a retry with the same bytes is a repeat. `quotePhotoUpload.ts` relies on that when it resends a photo with the same key. The code still never retries keyed FormData, which is safe, but the reason written down is wrong and could mislead a later change.

**Fix:** Reword the comment: the client does not retry a keyed multipart body on its own because the caller owns the retry (`uploadPhotos` resends once with the same key, and the server hashes the parts, not the boundary).

#### G5-IN-03: An orphaned doc comment sits above the wrong constant

**File:** `web/src/modules/public/quoteSchemas.ts:90-91`

**Issue:** `/** A blank form. */` sits directly above `/** The visible fields in page order ... */` and documents nothing. The blank form is `EMPTY_QUOTE_FORM`, declared 22 lines later.

**Fix:** Delete line 90 and put `/** A blank form. */` above `EMPTY_QUOTE_FORM`.

#### G5-IN-04: The Choose Photos hint before the first pick hard-codes "10 MB" and "5"

**File:** `web/src/modules/public/components/QuotePhotoSlot.tsx:104`

**Issue:** `COPY.hint('10 MB', 5)` repeats `QUOTE_PHOTO_RULES` (10,485,760 bytes and 5 photos), which live in the lazy photo kit. The server limits can differ, because the picker takes them from the ticket answer (`photoRules`). If the server limits change, this line says one thing before the first pick and the picker says another after it. The ticket's limits are already available through the `limits()` callback the Slot receives.

**Fix:** Use a shared constant in a small module the form chunk may import (two numbers, no kit code), or read the hint from `limits()` once the ticket is in.

---

_Reviewed: 2026-11-24T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g6: Web admin module

*Created: 2026-11-24T12:00:00-06:00 · Updated: 2026-11-24T12:00:00-06:00*

**Reviewed:** 2026-11-24
**Depth:** deep (call chains followed into the server controllers, handlers and generated types)
**Files Reviewed:** 44
**Status:** issues_found

### Summary

The module is in good shape. I traced each focus area and found no blocker.

Checked and found sound:

- **Cache keys and invalidation.** `['quote-requests']` is the shared prefix for the inbox lists, the detail page and the New count. A status move, a note, a delete and an order save all invalidate that prefix. The delete path excludes its own detail key and removes it on unmount.
- **Row version and 409.** The status menu, the Spam confirm, the Delete confirm and the notes card all raise the same ConflictBanner. Load Latest reads again and moves focus to the h1. The note answer's version is written into the cache, which matches the server rule that a note moves the version.
- **Idempotency.** `useSubmission` keys match the server contract. The unlinked save from the already-converted box has different data, so it gets a new key.
- **Manager-only actions.** Delete Request and Send Test Email are hidden for an Admin. The server enforces both (`[Authorize(Policy = Policies.Manager)]` on the delete, Manager-only on the test route), and Site Content is behind `requireManager`.
- **Money.** No client totals are computed in the files reviewed.
- **Mirrors and conventions.**
  - The note rule mirrors the server, including the .NET trim set.
  - `isContactEmail` mirrors `SiteLinks.IsContactEmail` character for character.
  - The order form limits match the quote request limits, so a prefill always fits.
  - No em or en dash in any file (byte scan).
  - Calls sit only in module services.
  - All audit codes the server defines exist in `auditCopy.ts`.
- **Prefill path.** `fromRequest` is read once, validated as a GUID and dropped with one replace. The prefill query sits outside the `['quote-requests']` prefix, so form invalidations never refill the form.

Not re-raised (already recorded): AR-13-05 (personal data in `q`), W6 WR-01/02, W7 WR-01, W8 WR-01 to WR-04, W9 WR-01 to WR-03, W10 WR-01 to WR-03.

### Warnings

#### G6-WR-01: A kept earlier page makes the inbox show the wrong empty state while the next view loads

**File:** `web/src/modules/admin/pages/QuoteRequestsPage.tsx:134` (used at 181 and 193 to 197)
**Issue:** The query uses `placeholderData: keepPreviousData`. While the next view loads, TanStack reports `isSuccess` true and `isPlaceholderData` true, with the old rows still in `data`. `empty` is `query.isSuccess && !hasRows && !pastTheEnd`. It does not check `isPlaceholderData`. The empty copy then reads the new, immediate `values.status` and `values.q`, not the settled params the query is running with.

Failure scenarios:
- A staff member is on the Spam pill, which is empty. They press Open. For the whole request time the page says "No open quote requests / New requests from the website's Get a Quote form show here", even if Open holds several requests. On a slow phone connection that is seconds of a false statement. The same happens in the other direction between any empty pill and a full one.
- A search that returned nothing is followed by typing a better one. `values.q` updates at once and the query key waits 300 ms, so the page shows `No requests match "jos"` before "jos" has been searched.

`OrdersPage.tsx:151` has the same `empty` line, but its empty copy does not depend on the pill, so the flash is mostly hidden there. Here the pill words make it visible.

**Fix:** Treat a kept page as loading, and read the settled values for the words.

```tsx
const settledView = !query.isPlaceholderData;
const empty = query.isSuccess && settledView && !hasRows && !pastTheEnd;
// ...
{empty && params.q !== null && ( ... searchTitle(params.q) ... )}
{empty && params.q === null && ( ... titles[params.status] ... )}
```

While the kept page shows, render the table in its pending state, not the empty state. Add a test that switches from an empty pill to a full one and asserts that no empty state shows before the answer.

#### G6-WR-02: Send Test Email blames the internet connection for a refused address (422) or a missing address (409)

**File:** `web/src/modules/admin/components/QuoteAlertsCard.tsx:52`
**Issue:** The failure line is `status === 429 ? limited : failed`. The server also answers:
- 422 `site-settings.quote-alerts-address-undeliverable` (documented in `SiteSettingsController.cs:68-71` and `siteSettingsService.ts:33-36`), and
- 409 `site-settings.no-quote-alerts-address` (another Manager cleared the address).

Both show "Couldn't send the test email. Check your internet connection and try again."

Failure scenario: a Manager saves `owner@mailbox.invalid`. The save passes the shape check. Send Test Email answers 422, and the toast tells them to check their internet. Every retry says the same, and the real cause is never named. The UI-SPEC (R5 test, line 522) lists only the 429 and the generic line, so this is a spec gap and not a coding slip.

Wording is the owner's call, so park this as an owner question and do not decide it in code. Suggested options (recommended first):
- **A.** Add a line for 422: "That address can't receive email. Check the spelling and save it again."
- **B.** Add lines for both 422 and 409.
- **C.** Keep the generic line.

**Fix:** After the owner rules, branch on `outcome.error.code`:

```ts
const code = isHttpError(outcome.error) ? outcome.error.code : undefined;
const copy =
  isHttpError(outcome.error) && outcome.error.status === 429 ? TEST.limited
  : code === 'site-settings.quote-alerts-address-undeliverable' ? TEST.undeliverable
  : TEST.failed;
```

### Info

#### G6-IN-01: Status pills keep a stale tab stop when the status changes from the address bar or Back

**File:** `web/src/modules/admin/components/QuoteStatusFilter.tsx:36-38, 66`
**Issue:** The one tab stop is `focused ?? indexOf(selected)`. After the first focus, `focused` is never cleared. If the status then changes without a pill press (browser Back or Forward, or a pasted URL on the same route), `selected` moves but the tab stop stays on the last-focused pill. Tab from the search box then lands on a pill that is not the selected one. The pattern is allowed for a toolbar, but the module's own header says the tab stop is "the last one focused, else the selected one", so the unselected landing is surprising for screen reader users who expect the pressed pill.
**Fix:** Reset `focused` when `selected` changes outside the toolbar, for example with the render-time "adjust state" pattern (`if (prevSelected !== selected && !bar.current?.contains(document.activeElement)) { setFocused(null); }`).

#### G6-IN-02: The request id is not normalised, and the GUID pattern is copied four times

**Files:** `web/src/modules/admin/hooks/useQuoteRequestQuery.ts:9-17`, `web/src/modules/admin/pages/OrderFormPage.tsx:210`, also `web/src/lib/url-state/parsers.ts:250` and `web/src/modules/admin/hooks/useAuditListParams.ts:17`
**Issue:**
- `isQuoteRequestId` accepts upper-case hex, and the page keys its query on the raw `id` from the URL. Everything else uses the server's lower-case `request.id`, for example `quoteRequestKey(request.id)` in `QuoteStatusMenu.tsx` and `QuoteNotesCard.tsx` and the delete cleanup in `QuoteRequestPage.tsx`.
- On a hand-typed upper-case address, a 404 from a move or note calls `resetQueries` on a different key. The page then does not switch to its not-found state, and a deleted request stays cached under the upper-case key.
- `knownConversion` has the same mismatch, because it uses the URL's casing against a detail cached under the lower-case key.
- Reaching this needs a typed or pasted upper-case address, so it is rare.
- The same GUID regex now exists in four places.

**Fix:** Export one `isGuid` from `lib/url-state/parsers.ts`. In `useQuoteRequestQuery`, key on `id.toLowerCase()`. In `QuoteRequestPage`, use `const id = (params.id ?? '').toLowerCase()`. Also use it for `fromRequest` in `NewOrderPage`.

#### G6-IN-03: The mailto link does not encode `,` or `"`, so a quoted local part can add a recipient

**File:** `web/src/modules/admin/components/QuoteRequestDetailsCard.tsx:44-46`
**Issue:** The comment says encoding `% ? # &` stops the address adding a Cc or a subject. The server accepts the visitor's email through `MailAddress.TryCreate` with `address.Address == text` (`OrderRules.IsValidEmail`). As I read .NET, that allows a quoted local part such as `"a,b@other.example"@shop.example`. In `mailto:` a comma separates recipients, so this link would address a second recipient. I have not run it.

Impact is low: the visitor would only add addresses to a message staff send to that same visitor, and the address is shown in full next to the link.

**Fix:** Encode the whole address with `encodeURIComponent` but keep `@`: `` `mailto:${encodeURIComponent(email).replace('%40', '@')}` ``. Add a test with a quoted local part.

#### G6-IN-04: Audit rows for the four quote request actions have no "what changed" line

**File:** `web/src/modules/admin/auditCopy.ts:128-131` (with `describeAuditDetail`, line 287)
**Issue:** The labels were added, but `describeAuditDetail` has no reader for `quote-request.*`. The server stores `status=new>contacted`, `note=<id>`, `order=<id>` and `status=..;photos=n` (`QuoteRequestAuditDetail.cs`). A Manager sees "Quote request status changed" and cannot tell from which status to which. The stored words are fixed and carry no personal data, so showing them is safe.
**Fix:** Optional, and a wording decision for the owner. Add a reader for `quote-request.status-changed` that maps the two status keys to their words (`New to Contacted`) and one for `quote-request.deleted` (`Was Contacted, 2 photos queued for removal`). Leave the note and conversion rows as they are.

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g7a: Web public and shared tests

*Created: 2026-11-24T12:00:00-06:00 · Updated: 2026-11-24T12:00:00-06:00*

**Depth:** deep
**Files reviewed:** 34
**Status:** issues_found

### Summary

I read every file in the list. For the MSW fixtures I compared each handler with the server controllers and handler records:

- `PublicQuoteRequestsController` and `QuoteFormTicketResponse` match the ticket, create and photo-slot answers in `quoteFixtures.ts`.
- `NewQuoteCountResponse(int Count)` matches `newQuoteCountHandler`.
- `QuoteRequestStatusChangedResponse` and `QuoteRequestDetailResponse` match the detail and status fixtures. These are also typed from the generated schema.
- The problem-detail extensions (`replacementTicket`, `minimumSeconds`, `orderId`, `orderNumber`) match `QuoteRequestErrors`.

No handler drifts from the real contract. I found no blocker.

What is sound:

- `setup.ts` leaks no global stub. `matchMedia` and `scrollIntoView` are installed once and are harmless.
- `URL.createObjectURL` in the picker test is added in `beforeEach` and deleted in `afterEach`.
- Every `useFakeTimers` has a matching `useRealTimers` in an `afterEach` that runs before the RTL cleanup.
- The unawaited-`user-event` and `act()` scan found nothing. The console guard would fail such a test anyway.
- No secret-scanner bait or real personal data appears. All values are `example.test`, made-up names, UI-SPEC sample numbers and fake tickets. The `0917 555 0101` numbers in `quoteRequestFixtures.ts` are already recorded in `deferred-items.md` (W11 WR-03), so I do not raise them again.
- The DRAFT legal pins (D-28) were skipped as instructed.

The remaining problems are test reliability and a few tests that cannot fail for the reason they claim.

### Warnings

#### G7A-WR-01: No global async timeout, so every `findBy` and `waitFor` has 1 second, and the load flakes keep recurring

**File:** `web/src/test/setup.ts:1-12, 55`
**Issue:** The setup never calls `configure({ asyncUtilTimeout })` from `@testing-library/react`. I confirmed there is no `asyncUtilTimeout` anywhere in `web/src` (only `strictMode.ts` calls `configure`). Every `findBy*` and `waitFor` therefore uses the Testing Library default of 1000 ms.

`deferred-items.md` lists many load-only failures of this kind:
- `GalleryPage.test.tsx` "puts focus back on the tile" (3 times, "worth a quick task to make it steady").
- `routes.test.tsx` (4 times).
- `PublicLayout.test.tsx` (3 times).
- `QuoteFormPhotos.test.tsx` "loads the picker when photos are chosen" and others.
- `ComponentShowcasePage.lazy.test.tsx`.

Each one was fixed or recorded one test at a time. Many tests already pass their own `{ timeout: 5000 }`, `WAIT` or `{ timeout: 15_000 }` (for example `AdminLayout.test.tsx:130`, `GalleryPage.test.tsx:20`, `quote.test.tsx:46`). That is the same fix repeated by hand. The shared root cause is still open, and the next load run will fail another unlisted test.

**Failure scenario:** On a loaded machine the lazy route chunk, the lazy photo piece or the MSW answer takes more than 1 s. `await waitFor(() => expect(tiles()).toHaveLength(16))` throws "Unable to find" and the test fails, although the product is fine. The gate then needs a re-run, and a deferred-items entry is written again.

**Fix:** Add one line to `setup.ts` next to the existing RTL import:
```ts
import { cleanup, configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 5000 });
```
Do this inside the `typeof window !== 'undefined'` guard, or only in the jsdom branch, so the node-env tests are unaffected. Passing tests are not slowed, because they resolve as soon as the condition holds. Tests that assert an absence are the exception, and they should use a fixed wait instead.

#### G7A-WR-02: The "Sending" tests race a real 1 second wait and have already flaked 4 times (recorded, never fixed)

**File:** `web/src/modules/public/components/QuoteForm.test.tsx:103-112`; `web/src/modules/public/components/QuoteFormPhotos.test.tsx:160-174` and `:291-301`
**Issue:** These tests use `answerQuote({ minimumSeconds: 1 })`. They click Send and then `findByRole('button', { name: 'Sending' })`, and some also assert a negative such as "no upload yet". The form really waits 1 s of wall-clock time before it sends. The test's own `findBy` timeout is also 1 s. Once the machine stalls for about 1 s between the click and the poll, the form has already reached "Inquiry sent" and the Sending button is gone.

`deferred-items.md` records this failure at plan 13-14, plan 13-17, plan 13-19 and the W11 fixes. The `QuoteFormPhotos` "starts no upload before the text is saved" case is also in that list. In each case the outcome was "passed alone". The cause is understood, because the W11 note says "the Sending state lasts only the 1 s ticket wait", so the recorded outcome of "flake, no change" is not acceptable. The describe block "QuoteForm minimum wait" in the same file already shows the stable pattern.

**Failure scenario:** A full web run on a busy machine takes more than 1 s between `userEvent.click` and the next poll. `findByRole('button', { name: 'Sending' })` fails with "Unable to find". In the photo test, `expect(uploads).not.toHaveBeenCalled()` can also fail, because the text really was saved. The suite fails for a reason unrelated to the code.

**Fix:** Hold the pending state in the test, so it does not depend on elapsed time. For example, give the create a gate that the test opens, as `holdUploads()` already does for uploads:
```ts
const gate = new Promise<CreateQuoteAnswer>((resolve) => { release = resolve; });
vi.spyOn(quoteService, 'create').mockReturnValue(gate);
// ... click, assert Sending and "uploads not called", then
release({ id: QUOTE_ID, photoSlots: [] });
```
Or run the three tests on the fake clock used in "QuoteForm minimum wait" and step the 1 s by hand. Then remove the matching rows from `deferred-items.md`.

#### G7A-WR-03: "shows no chip and no shell error when the count read fails" asserts the absence before the failure is handled

**File:** `web/src/layouts/AdminLayout.test.tsx:1244-1253`
**Issue:** The test waits until `probe.reads > 0`, and the handler increments that counter on the way in, before the 500 is returned. The test then checks at once that the link name is plain and that there is no `alert`. At that moment the client has not yet received or processed the 500. An alert or a "NaN new" chip that appears 10 ms later would not be seen, so the test passes whatever the shell does with the failure. The failure branch (D-14: a failed count shows nothing) is therefore not really tested.

**Failure scenario:** A regression makes the shell render an error banner or a broken chip when `/new-count` answers 500. The count handler runs, the test checks the DOM in the same tick, finds nothing yet, and passes.

**Fix:** Wait until the failure has been processed, then assert the absence. For example, have the handler resolve a promise after it builds the response, then `await act(async () => { await settled; await new Promise((r) => setTimeout(r, 0)); })`. A better check is to wait for the query to leave the fetching state, using the shared query client. The test at `:1255` already uses a 50 ms settle for its negative check, so this one should get the same.

### Info

#### IN-01 (G7A-IN-01): Two "no axe violations" tests run on the loading state, not on the loaded content

**File:** `web/src/modules/public/pages/GalleryPage.test.tsx:68-71`; `web/src/modules/public/components/QuoteForm.test.tsx:71-76`
**Issue:** `renderGallery()` returns as soon as the h1 shows, and the tiles arrive later (the test at `:237` shows the skeleton state exists at that point). The test named "has no axe violations" therefore checks the skeleton. In `QuoteForm.test.tsx:71` the axe check runs before the product lines arrive. The populated Gallery is covered by the test at `:288-308`, so the real gap is small, but the first test's name promises more than it checks.
**Fix:** In `GalleryPage.test.tsx:68`, `await waitFor(() => { expect(tiles()).toHaveLength(16); })` before the axe call, or drop the duplicate. In `QuoteForm.test.tsx:71`, `await screen.findByRole('option', { name: 'Basketball Jerseys' })` before the axe call.

#### IN-02 (G7A-IN-02): The failed-load case throws away all console output instead of only the expected error

**File:** `web/src/dev/scenarios/groups/quote.test.tsx:255-258`
**Issue:** `afterEach(() => { collectConsole(); })` clears every recorded `console.error` and `console.warn` of the test. React reports the boundary error there, which is expected. A real warning in the same test (an act warning, a key warning, a React Compiler message) would also be discarded, and the project's fail-on-console guard is switched off for this case. `AdminLayout.test.tsx:118-122` has the better pattern, `expectOnlyReportsOf(error)`.
**Fix:** In the test, collect the calls and assert that each one is about `'chunk 404'` (or is the boundary notice), instead of dropping them all in an `afterEach`.

#### IN-03 (G7A-IN-03): Two Sidebar rail and dot tests assert the recipe constant against itself

**File:** `web/src/components/navigation/Sidebar.test.tsx:663-690`
**Issue:** The chip and dot are found by the class string from `navCountClasses` and `navCountDotClasses`. The test then asserts that the same constant `toContain('pg-tablet:in-data-[ui=s-admin-side]:hidden')`, `arrayContaining(['absolute', 'size-2.5', ...])` and so on. Those `expect(tokens(constant))` lines cannot fail unless the constant is edited, and they say nothing about what is rendered. Only the lookup (the element exists) tests the DOM. In `:663`, `part(...)` finds the element by the full constant, so the rendered classes equal the constant, and the extra lines add nothing. A wrong constant (for example a rail token that does not hide the chip) would pass.
**Fix:** Assert against fixed literals taken from UI-SPEC R4 (the existing `NOTE` literal in `Note.test.tsx` is the model), or assert on the rendered element's `classList`.

#### IN-04 (G7A-IN-04): A test pins the grammar "up to 1 photos"

**File:** `web/src/modules/public/quotePhotoKit.test.ts:43-44` (the string is built in `web/src/modules/public/copy.ts:360-361`)
**Issue:** With `maxPhotos: 1` the expected text is `"You can send up to 1 photos. ..."`. The server can send any `maxPhotos` in the ticket, so the copy needs a singular. The test locks the wrong plural in. `copy.ts` also has the singular only for "1 of the photos", not for the limit.
**Fix:** Change the copy to say "up to 1 photo" (singular for 1) and update this assertion. Or use `maxPhotos: 3` in this test so it does not pin the grammar bug.

#### IN-05 (G7A-IN-05): Photo file helpers are copied into three test files

**File:** `web/src/modules/public/components/QuotePhotoPicker.test.tsx:20-28`; `web/src/modules/public/quotePhotos.test.ts:15-34`; `web/src/test/quotePhotoFixtures.ts:9-16`
**Issue:** `pngFile`, `textFile` (and `withHead`/`png`/`text`) are written three times with the same PNG signature. The shared `pngFile` in `quotePhotoFixtures.ts` also writes a size-dependent byte, and the two local copies do not, so the helpers now behave differently under the same name. A change to the signature or the rules would have to be made in three places.
**Fix:** Import `pngFile` from `@/test/quotePhotoFixtures` in the two tests, and add a shared `textFile` helper beside it. Keep `withHead` in `quotePhotos.test.ts` only if it needs the other formats.

---

_Reviewed: 2026-11-24T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Group g7b: Web admin tests and e2e specs

*Created: 2026-11-24T12:00:00-06:00 · Updated: 2026-11-24T12:00:00-06:00*

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 32
**Status:** issues_found

### Summary

I read all 32 files and the code each one targets. For the e2e specs I also read `playwright.config.ts`, `fixtures.ts`, `helpers.ts`, `sweep.ts`, `photo-host-lock.ts`, `site-content-lock.ts`, the public quote controller, the Testing image storage and the Testing controllers. I did not run any test.

Things that hold up:

- The Testing-only routes are safe. The helper calls `/api/testing/*` only for staff, expenses, orders, emails, site content and analytics, and the controllers carry `[TestingOnly]`. The new quote helpers use the real public and staff routes only. Nothing in the helper can reach production.
- The quote helpers match the real contract: the ticket, create and photo routes, the `X-Upload-Key` header, the quantity ranges, and every problem code the MSW fixtures use (`quote-requests.conflict`, `.not-found`, `.converted-locked`, `.validation`, `.already-converted`, `site-settings.no-quote-alerts-address`).
- The list, detail and move fixtures are typed against the generated OpenAPI types, so drift there fails the type check.
- Privacy checks are real: the beacon body is compared to the exact path-only string, the title and URL are checked for the visitor's name, and the inbox search is shown to ride only in `q`.
- The removed `cleanFileName` tests in `orderPhotosSchemas.test.ts` are not a coverage loss: the function moved to `utils/images` and `utils/images.test.ts` still covers it.
- Nothing found here repeats an item already fixed, deferred or accepted in the W1 to W11 reviews, `deferred-items.md` or the UI review ("1 requests" is P13-BL-14, the webkit focus failure is fixed in 13-24).

The remaining defects are all about the e2e specs sharing one host across five projects. Four are warnings. None is critical. The 150 of 150 `@quote` run in 13-24 only ran `@quote`, so it could not meet the order photo specs or the site content specs, which is where these collisions live.

### Warnings

#### G7B-WR-01: Two quote form tests upload photos without the photo host lock

**File:** `web/e2e/quote-form.spec.ts:40-64` and `:68-99` (uploads start at `:58` and `:91`)
**Issue:** The Testing switch `POST /api/testing/images/fail-next` is shared by the whole host. `TestingImageStorage.FailNext` sets one global counter, and `UploadQuotePhotoHandler` uses the same `IImageStorage`, so a quote photo upload uses up a failure that another test armed. Every other spec that uploads a photo runs that part under `withPhotoHost` (the order photo specs, the site content specs, and the quote request and sweep specs in this group, through `requestWithPhoto`). The two quote form tests that send a photo from the browser are the exception. `photo-host-lock.ts` says the lock only works if every uploader takes it.
**Failure scenario:** In a full e2e run, `order-photos-upload.spec.ts` arms `fail-next` with count 1 under the lock. In the same second, the chromium or webkit quote form test uploads `logo.jpg`. Its upload eats the armed failure and gets a failed upload, so `expect((await upload).status()).toBe(200)` fails and the page shows "didn't upload". The order photos test then sees no failure and fails too. The `@quote`-only run in 13-24 could not show this, because no order photo spec ran beside it.
**Fix:** Wrap the click and the two waits in `withPhotoHost`, as `quote-request.spec.ts` does. For example:

```ts
await withPhotoHost(async () => {
  const create = page.waitForResponse(/* ... */);
  const upload = page.waitForResponse(/* ... */);
  await form.getByRole('button', { name: 'Send Inquiry' }).click();
  expect((await create).status()).toBe(200);
  expect((await upload).status()).toBe(200);
});
```

Add `test.setTimeout(...)` that allows for the lock wait, as the other photo specs do.

#### G7B-WR-02: Contact page tests read the shared site content without the site content lock

**File:** `web/e2e/quote-form.spec.ts:12-205` (every test except the last one at `:209`); `web/e2e/quote-sweep.spec.ts:93-100` (`openContact`, used by the four Contact tests at `:102`, `:131`, `:151` and `:164`)
**Issue:** `site-content-lock.ts` states that specs that read or change the singleton site settings run under `withSiteContentLock`. `contact.spec.ts`, `home.spec.ts`, `products.spec.ts` and `public-sweep.spec.ts` follow this, and `public-sweep.spec.ts` says why: "The pages read the shared site content, so each test seeds the demo shop under the site content lock." The Contact page and its aside, header and footer show the shop name, phones, hours and Messenger link from that content. The one product line test in `quote-form.spec.ts` takes the lock, which shows the author knew the rule. The other tests in the file, and all four Contact sweep tests, do not.
**Failure scenario:** `site-content-business.spec.ts` (holding the lock) saves a very long unbroken business name or a changed phone list while the sweep test "Contact at rest" is loading `/contact`. The sweep then reports a sideways scroll at 320 px, a contrast finding, or a layout shift above 0.05, none of which is a Contact bug. The CLS check at `quote-sweep.spec.ts:117` is the most exposed because it reads shifts while the page loads.
**Fix:** Run these tests under `withSiteContentLock` after `seedDemoSiteContent`, like `contact.spec.ts`, and raise the timeout to match (the sweep already sets 480 s). Or call `ensureDemoSiteContent` from a `beforeEach`, as `public.spec.ts` does, if holding the lock for the whole sweep is too slow.

#### G7B-WR-03: The nav count test compares two reads of a counter that other specs also lower

**File:** `web/e2e/quote-nav.spec.ts:56-65`
**Issue:** The test reads the New count (`before`), creates two requests, reads it again (`after`), and asserts `after >= before + 2`. The header of the file says other specs send requests at the same time, which is why the count is read from the page. But New is not only growing. `quote-sweep` moves its requests to Spam, `quote-request` moves one to Spam, and `quote-convert` and the sweep turn requests into orders, each within seconds of creating them. Every one of those removes a request from New.
**Failure scenario:** At the moment of the `before` read, another project's sweep test holds a New request that it spams one second later. `after` is then `before + 2 - 1 + (other creations)`. If no other creation lands in the same window, `after` equals `before + 1` and the assertion fails with "the two new requests are counted". It needs the five projects to be busy together, which is the normal full-run case. The 13-24 run passing 150 of 150 shows the net is usually positive, not that the check is sound.
**Fix:** Do not compare two reads of a shared counter. Check what the test controls: that the chip text equals the count the page just read (`item` already does this through `chip(after)`), and that the two new requests are in the inbox (search by their unique names, as `quote-inbox.spec.ts` does). If a numeric check is wanted, use `expect(after).toBeGreaterThanOrEqual(1)`.

#### G7B-WR-04: `img.complete` is true for a broken image, so the photo checks cannot see one

**File:** `web/e2e/quote-request.spec.ts:56`; `web/e2e/quote-sweep.spec.ts:321`
**Issue:** `await expect(tile.locator('img')).toHaveJSProperty('complete', true)` is used as the proof that the photo shows (the test is named "staff open a request with a photo") and as the "ready" gate before axe in the sweep. By the HTML spec, `complete` is also true when the image is broken (the load failed or the bytes could not be decoded). The fixture guard only catches a failed HTTP status on a same-origin response.
**Failure scenario:** The thumbnail address is built wrongly but the host answers 200 with the wrong content type, or the stored bytes do not decode. The `<img>` shows the broken icon, `complete` is true, nothing is logged as an error, and the test passes. In the sweep, axe and the layout checks then run on a broken tile.
**Fix:** Also require a real picture:

```ts
await expect(tile.locator('img')).toHaveJSProperty('complete', true);
await expect.poll(() => tile.locator('img').evaluate((img: { naturalWidth: number }) => img.naturalWidth)).toBeGreaterThan(0);
```

### Info

#### G7B-IN-01: A layout check passes when both boxes are missing

**File:** `web/e2e/quote-form.spec.ts:148-152`
**Issue:** `expect(nameBox?.x).toBe(teamBox?.x)` compares two optional values. `formBox` and `asideBox` are asserted non-null, but `nameBox` and `teamBox` are not. If both boxes come back `null` (both fields hidden), `undefined` equals `undefined` and the "one column" claim passes.
**Fix:** Add `expect(nameBox).not.toBeNull(); expect(teamBox).not.toBeNull();` before the comparison.

#### G7B-IN-02: Two count checks match by substring

**File:** `web/e2e/quote-nav.spec.ts:134` and `:70`
**Issue:** `expect(strip).toContainText(count.toLocaleString('en-PH'))` passes when the strip merely contains the digits. With a real count of 3 it also passes if the strip shows 13 or 30. Line 70 is redundant with the exact link name at `:67`, but the same style.
**Fix:** Read the figure element and compare exactly, for example `await expect(strip.getByText(count.toLocaleString('en-PH'), { exact: true })).toBeVisible()`.

#### G7B-IN-03: The 429 declaration also covers the ticket and photo addresses

**File:** `web/e2e/quote-form.spec.ts:104`
**Issue:** `guard.expectStatus('/api/v1/public/quote-requests', 429)` matches with `url.includes(...)` (`fixtures.ts:137`). The ticket (`.../ticket`) and photo (`.../{id}/photos/{slot}`) addresses contain that text, so an unexpected 429 on either would be silently allowed in this test. Only the one faked POST should be allowed.
**Fix:** Declare a narrower part, or check the POST by method inside the route handler and keep the declaration, but add `expect` on the number of 429 answers the page saw.

#### G7B-IN-04: The recorded fake phone number follow-up is wider than recorded

**File:** `web/src/modules/admin/services/quoteRequestsService.test.ts:146`; `web/src/modules/admin/pages/QuoteRequestsPage.test.tsx:77,148`; `web/src/modules/admin/pages/QuoteRequestPage.test.tsx:98-100,694`; `web/src/modules/admin/pages/OrderFormPage.test.tsx:1627,1663,1691`
**Issue:** `deferred-items.md` records a follow-up (13-REVIEW-W11 WR-03) to change the `0917 555 0101` style numbers in `web/src/test/quoteRequestFixtures.ts` to the UI-SPEC sample style, because they are valid Philippine mobile numbers. The same literal, and `0918 555 0202`, are also typed straight into the tests listed above (and the derived `tel:09175550101` href). Changing only the fixtures file will break those tests, and leave real-looking numbers in the others.
**Fix:** When the follow-up is done, change these literals together, or export one constant from the fixtures file and use it in these tests. Update the follow-up note to name them.

#### G7B-IN-05: The notes answer in the page test is not typed against the contract

**File:** `web/src/modules/admin/pages/QuoteRequestPage.test.tsx:723` and `:743`
**Issue:** `notesBackend(answer: () => Response | object)` and the `ADDED` constant are untyped, while `QuoteNotesCard.test.tsx` types the same answer as `QuoteRequestNoteAdded`. If the server renames a field of the notes answer and the generated type changes, this test keeps passing with the old shape.
**Fix:** Type the parameter as `() => QuoteRequestNoteAdded | Response` and `ADDED` as `QuoteRequestNoteAdded`, importing the type from `quoteRequestsService`.

#### G7B-IN-06: Two "nothing happens" checks rely on a short fixed sleep

**File:** `web/src/modules/admin/hooks/useNewQuoteCountQuery.test.tsx:95` (20 ms); `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx:495` (50 ms)
**Issue:** Each test proves that something does not happen (no count request while disabled; focus stays on the body) by waiting a few milliseconds. A slow machine can start the request or move focus after the wait, and the test still passes. The deferred-items file shows these suites already run under heavy load.
**Fix:** For the hook, assert after the first render and after `await queryClient.isFetching()` is 0, or use fake timers and advance them past the 60 second interval. For the showcase, wait for the last eager case to reach its state and then check focus, with no sleep.

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
