---
phase: 09-order-images-maintenance-jobs
created: 2026-11-05T20:02:34-05:00
updated: 2026-11-05T22:56:00-06:00
reviewed: 2026-11-05T20:02:34-05:00
depth: standard
files_reviewed: 294
lanes: [G1A, G1B, G2, G3, G4]
findings:
  critical: 1
  warning: 28
  info: 25
  total: 54
status: issues_found
---

# Phase 9: Code Review Report

*Created: 2026-11-05T20:02:34-05:00 · Updated: 2026-11-05T22:56:00-06:00*

Five reviewers ran in parallel, one per lane, at standard depth. Their reports are merged below without changes, apart from the notes in the next section.

| Lane | Scope | Files | Critical | Warning | Info |
|------|-------|------:|---------:|--------:|-----:|
| G1A | Backend Domain + Application | 51 | 0 | 7 | 4 |
| G1B | Backend Infrastructure + Server | 52 | 0 | 4 | 5 |
| G2 | Backend tests | 77 | 0 | 9 | 6 |
| G3 | web/src | 73 | 0 | 3 | 5 |
| G4 | CI, docs, tools, e2e, web scripts | 41 | 1 | 5 | 5 |
| **Total** | | **294** | **1** | **28** | **25** |

## Orchestrator checks

- **CR-G4-01 confirmed.** `web/scripts/owner-review.mjs` looks for `image.position === 2` on an order with 2 photos. Positions count from 0 (`OrderDetailResponse.cs`, `docs/api/order-images.md`), so the case always throws. It affects only the owner-review picture tool, not the product.
- **IN-G2-06 precondition confirmed.** This machine's user-secrets for `src/Csps.Server` hold `Cloudinary:CloudName`, `Cloudinary:ApiKey` and `Cloudinary:ApiSecret` (values not read). `CspsApiFactory` does not blank them. So the test that switches its host to Development and expects `images.not-configured` could load the real keys. The test was not run. Treat this as a warning.
- **Owner rulings needed:** WR-G3-03 (refusing photos over 25 MP before the browser shrinks them), IN-G2-01 (25 MP wording for a too-wide photo), WR-G1A-03 (no cap on how many stray files the sweep queues for deletion).


---


## Phase 9 (lane G1A): Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

### Summary

This lane covers the image sniffer and metadata stripper, the maintenance jobs, the order image handlers and the domain rules.

The code is careful. Every container walk goes through one bounded `ChunkReader`. Every offset is checked against the span length. Each walk has an entry cap. I traced the JPEG, PNG, WebP and HEIC paths by hand, including the 36-byte Exif insert and the buffer sizing in `StripJpeg` and `StripWebP`. I found no out-of-range read or write.

The order handlers look up photos through their order (CWE-639), compute no money, use `TimeProvider` and `IBusinessCalendar`, and contain no inline SQL, no new triggers and no `DateTime.Now`. A full-scope grep for those patterns across the 51 files found nothing. I verified that the order store loads `Images`, so permanent delete does queue every photo file.

No blocker was found. The seven warnings are the real risks:

- A WebP size check that can be bypassed.
- Two data-safety and progress gaps in the stray sweep.
- A HEIC strip that does not insist on a clean file.
- An upload path that can leave a customer photo behind.
- Two diagnosability gaps.

### Warnings

#### WR-G1A-01: WebP size limit can be bypassed with a small VP8X canvas

**File:** `src/Csps.Application/Images/ImageSniffer.cs:135-157`
**Issue:** For an extended WebP (VP8X), `ReadWebPExtended` takes the width and height from the VP8X canvas (lines 142-143). It then reads the real VP8 or VP8L frame, but throws its size away (lines 154-155). It only checks that the frame parses.

A file can declare a 1x1 canvas and carry a 16383x16383 lossy frame. That is about 268 megapixels, and it compresses to a few KB. `ImageInspection.Check` then judges the 1x1 canvas, so the 25 MP and 10,000 px limits pass. The wrong size is also stored in `OrderImage.Width` and `Height`.

The stripper's before/after comparison does not catch it either, because both sides report the same canvas size.

Why it matters: the pixel limit exists as a decompression-bomb guard (IMG-02, T-09-01). Cloudinary or a browser decodes the real frame size.

**Fix:** Use the frame size, or refuse a file where the two disagree.
```csharp
var frame = lossy ? ReadWebPLossy(chunk) : ReadWebPLossless(chunk);
if (frame is null || frame.Width > width || frame.Height > height)
{
    return null;
}
return new ImageFacts(ImageKind.WebP, width, height, 1);
```
Refusing when the frame is larger than the canvas is enough. A valid file never has a frame larger than its canvas.

#### WR-G1A-02: Stray sweep never remembers its cursor, so a large folder can never finish

**File:** `src/Csps.Application/Maintenance/StraySweepJob.cs:276-298`
**Issue:** `cursor` is a local variable. When the budget runs out (lines 282-286), the job returns `More = true`. The next pass starts again at `cursor = null`, which is page 1.

Pages already checked are still listed and still hit the database. Once the folder is big enough that 90 seconds do not cover it, pages past the budget point are never reached. Strays in those pages are never found. The run also reports "more work left" every time.

The scale is small today, but the contract (`More`) promises progress and the job does not keep any.

**Fix:** Either store the cursor (for example in a small settings row read at the start of the pass), or drop `More` for this job. A monthly sweep that cannot finish should say so clearly instead of asking for a rerun that cannot make progress.

#### WR-G1A-03: Stray sweep has no limit on how many files it queues for permanent deletion

**File:** `src/Csps.Application/Maintenance/StraySweepJob.cs:289-294` and `327-328`
**Issue:** A file counts as stray when it is older than 2 days and neither a photo row nor a removal row names it. The job queues all of them. The removal job then deletes them, and a Cloudinary removal cannot be undone (see the `IImageInventory` remarks).

If the database ever looks empty or old (a restore from an older backup, a wrong connection string, a restore into the wrong database), every photo uploaded after that point is "stray". After 2 days the next run deletes them for good.

The host has no scheduled backups, so restoring an older backup is a realistic case. No count or percentage cap and no pause exists.

**Fix:** Add a cap per pass, for example "if strays exceed N, or more than half of the listed files, queue nothing and fail the line with a plain message". Make the cap a constant so it is visible and testable.

#### WR-G1A-04: Storage read failures are swallowed with no server log

**File:** `src/Csps.Application/Maintenance/StraySweepJob.cs:300-303`, `src/Csps.Application/Maintenance/CloudinaryUsageJob.cs:394-397`
**Issue:** Both jobs catch `ImageStorageException` and keep only a fixed sentence. `FailureCode` (`transient`, `unauthorized`) is dropped. Neither job takes `IMaintenanceJobLog`, so the code is never written anywhere.

The run goes red with "could not read the photo storage", and the operator cannot tell a wrong key from a timeout. `RunMaintenanceHandler` does log a job that throws (`log.JobFailed`), so these two are worse than an unhandled error. The removal job at least reports refused keys as its own line.

**Fix:** Inject `IMaintenanceJobLog` and record the code before returning the line. For example, add `void StorageReadFailed(string jobName, string failureCode)` to the port. Alternatively, branch on `FailureCode == ImageFailureCodes.Unauthorized` and reuse the existing keys-refused sentence.

#### WR-G1A-05: HEIC strip does not require a clean top-level box walk

**File:** `src/Csps.Application/Images/ImageMetadataStripper.Heic.cs:24-43`
**Issue:** The class contract says a file that cannot be cleaned is refused. The `meta` child walk checks `children.AtEnd` (line 79). The top-level walk has no such check.

If a malformed box appears after `ftyp` (a bad size, or the 512-box cap), `boxes.Next` returns false and the loop ends quietly. Any bytes after that point are copied through untouched. `mdats` may then be incomplete.

Trailing data can hide a second Exif or XMP copy that the item table never names. The sniffer is happy because it only needs `ftyp` and `meta`.

**Fix:** After the loop, add `if (!boxes.AtEnd) { return null; }`, matching the `meta` walk and the WebP walk.

#### WR-G1A-06: A failed or timed-out upload is not queued for removal

**File:** `src/Csps.Application/Orders/UploadOrderImageHandler.cs:87-91`
**Issue:** When `UploadAsync` returns a failed outcome, the handler returns 503 and queues nothing. `CloudinaryImageStorage.UploadAsync` turns a timeout or transport failure into `Failed("transient")`. A timeout means the reply was lost, not that the file was not stored.

The next step in the same handler (`SavePhotoAsync`) already deals with this kind of lost reply and queues `UploadUndone`. The upload step does not.

The customer photo then sits in Cloudinary with no row, until the stray sweep removes it. That is a monthly job, and WR-G1A-02 and WR-G1A-03 apply to it.

**Fix:** On a failed outcome other than a clean refusal, call `UndoUploadAsync(publicId)` before returning. A removal of a file that was never stored is a harmless NotFound, and the removal job guards live photos.

#### WR-G1A-07: A queued file that can never be removed turns every run red forever

**File:** `src/Csps.Application/Maintenance/ImageRemovalJob.cs:174-178` and `187-192`
**Issue:** A row whose id is outside this environment's folder gets `outside-folder`. Any non-keys `Rejected` answer also fails the row. Each run fails it again and adds one attempt. The failing line has `Failed = true`, so `Ok` is false on every run, with no cap and no way to clear it except by hand in the database.

A real case is production data restored into dev, where every `csps/orders/...` row fails against `csps-dev`. The permanent red hides new real failures.

**Fix:** After a set number of attempts for these two codes, stop counting the row as "failing". Either park it (a status or a far-future next-attempt time) and report it as a separate non-failing "needs attention" count, or drop it with a clear line. Pick the behaviour with the owner, since it changes run semantics.

### Info

#### IN-G1A-01: HEIC `irot` is mapped to the opposite Exif orientations

**File:** `src/Csps.Application/Images/ImageSniffer.cs:357`
**Issue:** `irot` counts quarter turns anti-clockwise. A value of 1 is a 90 degree anti-clockwise turn, which is Exif orientation 8, and 3 is Exif 6. The code maps 1 to 6 and 3 to 8.

Today only "5 to 8 swaps width and height" is used, so output is the same. The `Orientation` value is wrong if anyone ever uses it (storing it, or passing it to delivery).

**Fix:** `(payload[0] & 3) switch { 1 => 8, 2 => 3, 3 => 6, _ => 1 }`, and fix the comment on line 336.

#### IN-G1A-02: Metadata strippers keep unknown segments and chunks (deny-list instead of allow-list)

**File:** `src/Csps.Application/Images/ImageMetadataStripper.cs:239-245` (JPEG) and `105-108` (WebP)
**Issue:** PNG uses an allow-list, but JPEG and WebP use deny-lists.

- JPEG keeps all of APP0 (a JFXX extension can carry an embedded JPEG thumbnail with its own metadata), APP14 and the unusual markers 0xF0 to 0xFD.
- WebP keeps any chunk type except `EXIF` and `XMP `.

Unknown carriers are kept by default. Cameras do not normally use these paths, so this is a hardening gap and not a likely leak.

**Fix:** Keep APP0 only when it starts with `JFIF\0`, APP14 only when it starts with `Adobe`, and WebP only the known image chunks (`VP8X`, `VP8 `, `VP8L`, `ALPH`, `ICCP`).

#### IN-G1A-03: Small message and file-name defects in `ImageErrors`

**File:** `src/Csps.Application/Images/ImageErrors.cs:14`, `65-80`, `96-101`
**Issue:** There are three small ones.

- `TooBigSuffix` hard-codes "25 megapixels", but `MaxPixels` is configurable. The message is wrong if the setting changes.
- `SizeText` uses integer division. A configured 1.5 MB limit is shown as "1 MB".
- `CleanName` removes control characters but not format characters such as the right-to-left override (U+202E), so a file name can reorder the message text. It can also cut inside a surrogate pair at 80 characters.

**Fix:** Build the suffix from `settings.MaxPixels`. Show one decimal for non-whole MB. Drop `UnicodeCategory.Format` characters, and back up one char when the cut lands on a high surrogate (`Cut` in `OrderAuditDetail` already does this).

#### IN-G1A-04: Lease release in `finally` can hide a finished run

**File:** `src/Csps.Application/Maintenance/RunMaintenanceHandler.cs:147-150`
**Issue:** If `ReleaseAsync` throws (for example the database goes away at the end), the exception replaces the successful result or the original error. The jobs have already done their work, but the caller sees a 500 with no counts. The lease would expire on its own anyway.

**Fix:** Wrap the release in a try/catch that logs the failure (for example through `IMaintenanceJobLog`) and does not rethrow.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---


## Phase 9, Lane G1B: Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

### Summary

I reviewed the Cloudinary storage and delivery, the removal queue, the maintenance lock and jobs, the EF mapping and migrations, the three image controllers and the maintenance controller, the body limit, idempotency and rate limit code, the maintenance key, Program.cs, web.config and the appsettings files.

The security basics hold up. I checked each one against the code:

- **Maintenance key.** `MaintenanceKey.Matches` hashes both values with SHA-256 and compares them with `CryptographicOperations.FixedTimeEquals`. A missing, short or wrong key gives the same 401. The key is read from configuration only and is not in any tracked file.
- **Authorization.** Every action carries an explicit attribute. The maintenance action is `[AllowAnonymous]` plus the key filter plus a rate limit plus an idempotency exemption with a written reason. The image controllers use the `Staff` policy at class level.
- **Testing controller.** It is compiled only under `CSPS_TESTING` (Debug builds). A feature provider also removes it outside the Testing environment, and a Debug build refuses to start in Production. A Release build with the Testing environment throws at startup.
- **Upload size.** It is capped three ways: Content-Length, the max-body feature, and the counted read in the idempotency middleware. The IIS backstop is looser than the app limit, but the app limit still applies.
- **Public ids.** They are 128 random bits.
- **Removal safety.** The removal job refuses to delete a file outside the environment's own orders folder.
- **SQL and clocks.** There is no inline SQL, no trigger, no JSON column and no `DateTime.Now` in the lane. The migrations are plain `CreateTable` and `CreateIndex`.
- **Secrets.** Logs carry codes and status numbers only. `ApiSecret` and `MaintenanceKey` are masked by name. No real server names, emails or local paths are in tracked files, apart from the sender address in `appsettings.json`, which existed before this phase.

I found no critical issues. I found four warnings, mostly where one control fails quietly or one failure shows the wrong message. I also found five lower-value items.

### Warnings

#### WR-G1B-01: The two-at-a-time upload cap is taken before sign-in, so anonymous calls can crowd out staff

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:71,86-94` and `src/Csps.Server/Program.cs:135-139`
**Issue:** The cap is a global limiter that takes a slot for any request whose endpoint name is `UploadOrderImage`. `UseRateLimiter()` runs before `UseAuthentication()` and `UseAuthorization()`. So an unauthenticated POST to `/api/v1/orders/{any guid}/images` takes one of the 2 shared slots, and up to 4 more queue behind them, until its 401 is written. The per-address policy runs after the global cap in the chain, so one address is not held to 30 per 10 minutes before it can touch the shared slots.

A small flood of anonymous requests can therefore make signed-in staff get "Too many uploads right now" (429) on real photo uploads. Each anonymous request holds a slot only briefly, but that is enough to fill 2 slots and 4 queue places under modest concurrency. This is CWE-770, a denial of service on the one feature this cap protects.
**Fix:** Take the slot only for a request that has passed authorization. One way is a small middleware placed after `UseAuthorization()` that holds a static `ConcurrencyLimiter(PermitLimit = 2, QueueLimit = 4)` lease only for the upload endpoint, and writes the same 429 on refusal. A second way is to keep the per-address policy as the only pre-auth limit and move the global cap into that post-auth middleware.

#### WR-G1B-02: The maintenance run lease (3 minutes) can end while a run is still working

**File:** `src/Csps.Infrastructure/Maintenance/MaintenanceRunLock.cs:21` (with `src/Csps.Infrastructure/Images/ImagesRegistration.cs:18`)
**Issue:** The lease is `TimeSpan.FromMinutes(3)` and is never renewed. The pass budget is 90 seconds, but it is checked only between rows or batches. One queued photo removal can try Cloudinary 3 times. Each try may wait for the 60 second HTTP timeout, plus the 2 and 8 second waits: 3 x 60 + 10 = 190 seconds, which is more than the 180 second lease. This happens only when Cloudinary hangs, which is when a run is most likely to be slow.

Once the lease passes, a second call (the "Run now" button, or a repeated call from another caller) takes the lock and runs every job again at the same time. `PurgeExpiredRecordsJob` also deletes expired `DatabaseLocks` rows, so it removes the expired `maintenance-run` row itself while the first run is still going. The photo removal rows have their own 5 minute leases, so double removal is mostly guarded. The purge and sweep jobs are not guarded the same way, and the "one run at a time" promise in the handler no longer holds.
**Fix:** Make the lease longer than the worst case (for example 10 minutes), or renew it between jobs and between removal rows with a conditional `ExecuteUpdate` on `ExpiresAtUtc` for the holder. Also stop a removal try when the budget is spent by passing a budget-linked cancellation token to the storage call.

#### WR-G1B-03: Every Cloudinary 400 on upload is reported to the person as "not a usable photo type"

**File:** `src/Csps.Infrastructure/Images/CloudinaryResults.cs:27`
**Issue:** `ForUpload` maps `HttpStatusCode.BadRequest` straight to `ImageErrors.TypeCode`. The server already sniffs the real file type before it calls storage, so a 400 from Cloudinary is rarely a type problem. It can be a plan limit (size or megapixels), a bad parameter or a folder problem. The member of staff is then told the photo is the wrong type and retries the same file forever. The log line says only `type (HTTP 400)`, which points the owner at the wrong cause.
**Fix:** Map a 400 to `RefusedCode` and let the handler show a general "could not store this photo" message. Keep `TypeCode` only when the Cloudinary error text names the format (read it from `result.Error?.Message`, and never log or return that text).

#### WR-G1B-04: One missing Cloudinary setting turns every order that has photos into a 500

**File:** `src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs:37-40`, used by `src/Csps.Infrastructure/Orders/OrderReader.cs:638`
**Issue:** `CheckInput` throws `InvalidOperationException` when `Cloudinary:CloudName` is empty. The registration comment promises that a host without photo keys "still starts and answers 503 on upload". It does start: `appsettings.json` always supplies `Cloudinary:RootFolder`, so the validator passes with no cloud name. But `OrderReader.ToResponse` calls `ForPhoto` for each photo, so `GET` of an order that already has photos then fails with a generic 500. The same applies to the deleted-order view. This is the page where staff read payments and balances, so one lost host secret takes away the core order screen, not just photos.
**Fix:** Make the delivery tolerant: when the cloud name is empty, return empty `ImageSource` values (or an agreed placeholder) and log one warning at startup. Alternatively, make a photo-bearing order read fail only for the photo section. Add a test for "photos exist, cloud name missing".

### Info

#### IN-G1B-01: The IIS backstop comment says 10 MiB plus 64 KiB, but the value is 11 MiB

**File:** `src/Csps.Server/web.config:12-13`
**Issue:** The comment says the limit is "10 MiB plus 64 KiB". `ImageUploadLimits.BodyBytes` is 10,551,296. The configured `maxAllowedContentLength` is 11,534,336, which is exactly 11 MiB. The value is safe because it is above the app limit, and the app still returns its own 413. But the comment and the value disagree, so the next reader cannot tell which is right.
**Fix:** Either change the comment to "11 MiB, above the upload limit of 10 MiB plus 64 KiB" or set the exact number. A small test that compares the two values would keep them in step.

#### IN-G1B-02: The upload cap finds its endpoint by a copied string

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:19,87` and `src/Csps.Server/Controllers/OrderImagesController.cs:44`
**Issue:** The limiter matches the literal `"UploadOrderImage"` against the endpoint name, and the controller repeats the same literal in `[EndpointName]`. If one is renamed, the cap stops applying with no error. A test (`ImageUploadRateLimitTests`) exists and would likely catch it, but the coupling is still a trap.
**Fix:** Put the name in one `public const string` that both the attribute and the limiter use, or mark the action with a small metadata attribute and test for that.

#### IN-G1B-03: A half-finished setup run leaves a named size that the tool will never repair

**File:** `src/Csps.Infrastructure/Images/CloudinarySetupCommand.cs:188-196,233-242`
**Issue:** `CreateAsync` makes the size and then sets `AllowedForStrict` in a second call. If the second call fails, the run exits with code 3. On the next run `Matches` sees `allowed_for_strict == false`, reports the size as "different" and leaves it alone, because the tool never changes an existing size. The owner must fix it by hand, and the message ("live photos use it") is wrong for a size that was just created.
**Fix:** In `CreateAsync`, treat a failed second call as "created, not yet allowed for strict" and, on the next run, re-send only the `allowed_for_strict` update when the definition matches but the flag is false. This changes no definition.

#### IN-G1B-04: An upload holds several copies of the file in memory at once

**File:** `src/Csps.Server/Controllers/OrderImagesController.cs:64-70`, `src/Csps.Server/Security/IdempotencyMiddleware.cs:148-149`, `src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs:38`
**Issue:** For a 10 MiB photo the request body is buffered in the idempotency middleware, buffered again as a form file (`MemoryBufferThreshold = BodyBytes + 1`), copied into a `MemoryStream` in the controller, and copied once more by `upload.Bytes.ToArray()` before the SDK builds its own multipart body. That is four or more large copies, times two uploads at a time, inside a 256 MB app pool. This is a performance point and out of scope for v1, but it also reduces the headroom against memory exhaustion.
**Fix:** Pass `ReadOnlyMemory<byte>` into a `ReadOnlyMemoryStream`-style wrapper (or `MemoryMarshal.TryGetArray`) instead of `ToArray()`, and read the form file stream directly rather than copying it again in the controller.

#### IN-G1B-05: Two masking names are already covered by the suffix rule

**File:** `src/Csps.Server/Logging/SensitiveDataMasking.cs:38,47`
**Issue:** `ApiSecret` already ends with `Secret`, and `MaintenanceKey` already ends with `Key`, so both exact names are redundant. They do no harm. The exact-name list is meant for names the suffix rule would miss.
**Fix:** Leave them as documentation, or remove them and add a one-line test that both names are sensitive.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---


## Phase 9: Code Review Report (lane G2, backend tests)

**Reviewed:** 2026-11-05
**Depth:** standard
**Files Reviewed:** 77
**Status:** issues_found

### Summary

I read the maintenance, image, order, rate-limit, authorization and workflow tests in full. I read the large byte-fixture files
(`ImageSnifferTests`, `ImageMetadataStripperTests`, `OrderAuditDetailTests`, `SyntheticImages`, the back half of `OrderImageTests`, the tail of
`CiWorkflowTests`, `ErrorTests`) only in part, plus a scripted scan for tests with no assertion (the scan found none).

Overall the suite is strong. Highlights I checked and found sound:

- No test opens a `BetsLLC_*` database. Every database name comes from `CspsDatabase` / `TestDatabaseName` (`CSPS_Test_<guid>`).
- Every secret-looking value is clearly fake (`test-secret-not-real`, `000000000000000`, `new string('k', 40)`).
- No test reaches the network. The Cloudinary stub and the Testing image store are used throughout.
- The authorization matrix has a row for every new route (maintenance run, image-rules, image upload, move, describe, delete, testing image routes).
  Idempotency allow-list and rate-limit lists are cross-checked against discovered endpoints, so a missed endpoint fails the build.

There are no blockers. The nine warnings are tests that look protective but cannot fail for the reason they name, one calendar time bomb, one possible
infinite loop in a helper, and two guard tests with blind spots.

### Warnings

#### WR-G2-01: Order search test hard-codes the year 2026 and will fail from 2027-01-01

**File:** `tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs:252`
**Issue:** `SearchFindsAnOrderByItsNumberOrByTheYearPartOfEveryNumber` runs `rig.ReadAsync("q=ORD-2026")` and expects both new orders. Order numbers take the
year from the business calendar (`CreateOrderHandlerTests` proves 2026-12-31 gives `ORD-2027-0001`). Today is 2026-11-05, so this test starts failing in about two
months, for no code reason.
**Why it matters:** A calendar-dependent failure on the first working day of 2027 will look like a regression and waste a debugging session.
**Fix:** Build the year from the same business date the rig already holds:
```csharp
var all = await rig.ReadAsync($"q=ORD-{rig.Today.Year:D4}");
```

#### WR-G2-02: "A successful upload" test never checks the upload succeeded, and its result is actually a 404

**File:** `tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs:88-98` (cause at `:182`)
**Issue:** `ASuccessfulUploadQueuesNothing` ends with `result.ShouldNotBeNull()`. `Result<T>` is a class that is never null, so this can never fail. The harness
makes `IOrderReader.GetDetailAsync` return `null` (line 182). In `UploadOrderImageHandler` a null read becomes `OrderErrors.NotFound` (`OrderChildWrite.ReadAsync`), so the
"successful" call actually returns a failure. The other asserts (commit count, image count, empty queue) pass, so nothing notices.
**Why it matters:** The test name and its assertion disagree. A regression where the handler returns a failure after a good save would pass unseen.
**Fix:** Return a real `OrderDetailResponse` from the reader in this test and assert the result:
```csharp
harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
result.IsSuccess.ShouldBeTrue();
```
Expose `Reader` on the `Harness` (it is a local variable now).

#### WR-G2-03: "Every job shares one budget" test cannot tell a shared budget from one budget per job

**File:** `tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs:56-66` and `:257-269`
**Issue:** `ProbeJob` advances the clock by `advanceBefore` and then reads `budget.IsSpent`. The first job advances 0 and sees false. The second job advances 90 seconds
and sees true. If the handler built a new `MaintenanceBudget` before each job, the second job's fresh budget (deadline = now + 90 s, created before its own advance) would
also read spent after the same 90 s advance. The result `[false, true]` is identical, so the test passes for both designs.
**Why it matters:** The shared 90 second budget is the guard that keeps one maintenance pass inside the host timeout. The test named for it does not protect it.
**Fix:** Spend part of the budget in the first job and the rest in the second:
```csharp
new ProbeJob(10, "first", clock, seen, TimeSpan.FromSeconds(60)),
new ProbeJob(20, "second", clock, seen, TimeSpan.FromSeconds(30)),
// shared budget: [false, true]; one budget per job: [false, false]
```

#### WR-G2-04: "Not allowed for strict mode" test is made "different" by a width change, so the strict flag is never tested

**File:** `tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySetupCommandTests.cs:194-203` (cause at `:74-82`)
**Issue:** `ASizeNotAllowedForStrictModeIsReportedAsDifferentAndNotChanged` calls `QueueExisting(..., differentName: "csps_full_2000", allowed: "false")`. In `QueueExisting`
the same `differentName` also sets `widthShift = 1`, so the stored size is 2001 wide as well as not allowed. It is "different" because of the width alone. The code under test
(`CloudinarySetupCommand.cs:235`, `allowed_for_strict == false`) can be deleted and this test still passes.
**Why it matters:** Strict transformations are what stops anyone building their own image URLs. The check that a size is allowed for strict mode has no working test.
**Fix:** Let the caller choose the two changes separately:
```csharp
// widthShift stays 0 for the strict test; only `allowed` is "false"
handler.Reply(HttpStatusCode.OK, DetailJson(size, widthShift: 0, allowed: "false"));
```

#### WR-G2-05: The removal job test harness can spin forever on a hang

**File:** `tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs:376-392`
**Issue:** `Harness.RunAsync` loops `while (!run.IsCompleted)` and calls `await Task.Yield()` when no timer is waiting. If the job stalls on anything but the fake clock (a bug that
awaits a never-completing task, or a wait that does not use the injected `TimeProvider`), the loop spins at full CPU with no timeout. xUnit v3 has no default per-test timeout, so the run
hangs instead of failing.
**Why it matters:** A hung suite on CI burns the free minutes (the CI workflow has a job timeout, but a local run just freezes).
**Fix:** Give the loop a real-time cap and fail with a message:
```csharp
var deadline = TimeProvider.System.GetUtcNow() + TimeSpan.FromSeconds(10);
while (!run.IsCompleted)
{
    if (TimeProvider.System.GetUtcNow() > deadline) { throw new TimeoutException("The job did not finish."); }
    ...
}
```

#### WR-G2-06: Secret-exposure test can miss the last log line and ignores exception text

**File:** `tests/Csps.Server.IntegrationTests/Images/ImageSecretExposureTests.cs:71-79`
**Issue:** Two gaps in the log check.
1. The test reads `baseFactory.Sink.Events` straight after the last response. `LogEvents.RequestCompletionAsync` exists because the request-completion event is written "a moment later than
   the response" (its own doc comment). Other tests wait for it; this one does not, and never asserts that the sink holds any event at all.
2. `Render` writes the message and the property values only. `logEvent.Exception` (type, message, stack, inner exception) is never included. A failed Cloudinary call (the 401 and 503 path
   this test provokes) is exactly where a secret could leak through an exception message.
**Why it matters:** This is the one test that proves the Cloudinary key and secret never reach a log. As written it can pass while a log line holds them.
**Fix:** Wait for the completion event of the last request, assert the sink is not empty, and render the full event as the file sink does:
```csharp
await LogEvents.RequestCompletionAsync(baseFactory.Sink, "/api/v1/orders/image-rules", TestContext.Current.CancellationToken);
baseFactory.Sink.Events.ShouldNotBeEmpty();
var logs = string.Join('\n', baseFactory.Sink.Events.Select(e => RenderJson(e) + e.Exception));
```
(`MaintenanceKeySafetyTests.Render` already uses `CompactJsonFormatter`; reuse it, and append `e.Exception?.ToString()`.)

#### WR-G2-07: Maintenance script "built-ins only" guard only sees single-quoted imports

**File:** `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs:18` and `:113-124`
**Issue:** `ModuleReference` matches `from 'x'`, `import 'x'`, `import('x')` and `require('x')` with single quotes only. The script runs in CI with no `npm ci`, with the
maintenance key in its environment (T-09-SC). An `import x from "left-pad"` or a backtick dynamic import is invisible to the scanner. The "imports not empty" guard only proves at least one
single-quoted import was found, not that all were.
**Why it matters:** This test is the supply-chain guard for the one script that holds `MAINTENANCE_KEY`.
**Fix:** Accept all three quote styles, and fail on any `import`/`require` the regex cannot parse:
```csharp
new(@"(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)['""`](?<module>[^'""`]+)['""`]", RegexOptions.CultureInvariant)
```
Add a sample line with double quotes to prove the pattern catches it (the way `CiWorkflowTests` pairs detectors with samples).

#### WR-G2-08: "Upload stays in memory" scan skips the new metadata stripper and misses other disk APIs

**File:** `tests/Csps.ArchitectureTests/UploadNoDiskTests.cs:17-25` and `:105`
**Issue:** `UploadFiles` lists the handler, `ImageInspection`, `ImageSniffer`, the controller and the two middlewares. It does not list `ImageMetadataStripper.cs` or
`ImageMetadataStripper.Heic.cs`, which process the uploaded bytes (added with IMG-03), nor `CloudinaryImageStorage`. The `DiskUse` pattern also lets `Directory.`, `FileInfo`,
`DirectoryInfo` and `Path.GetRandomFileName` through. I found no current offender, so this is a guard gap, not a live bug.
**Why it matters:** IMG-02 and T-09-03 rely on this test to stop a future change from writing uploads to the 256 MB shared host's disk.
**Fix:** Add the two stripper files and `src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs` to `UploadFiles`, and extend the pattern:
```csharp
@"(?<![A-Za-z0-9_])(?:File|Directory)\.|\b(?:FileStream|FileInfo|DirectoryInfo)\b|\bPath\.(?:GetTempFileName|GetTempPath|GetRandomFileName)\b"
```
Add `[InlineData]` samples for each new name.

#### WR-G2-09: Lease-release-on-cancel test cannot catch a cancelled token being passed to the release

**File:** `tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs:114-125` (also `:163-172`)
**Issue:** `TheLeaseIsReleasedWhenTheRunIsCancelled` checks `ReleaseAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())` was received once. The handler deliberately calls
`ReleaseAsync(holder, CancellationToken.None)` in its `finally`, because a real EF call with the cancelled request token would throw and leave the lease held for 3 minutes. The NSubstitute
mock accepts any token and never throws, so changing the handler to pass `cancellationToken` would keep this test green.
**Why it matters:** The point of the test is "a dropped request still frees the lease". The mock hides the one thing that makes that true.
**Fix:** Pin the token:
```csharp
await runLock.Received(1).ReleaseAsync(Arg.Any<Guid>(), CancellationToken.None);
```

### Info

#### IN-G2-01: Tests lock in a misleading refusal message for the side-length limit

**File:** `tests/Csps.Application.UnitTests/Images/ImageInspectionTests.cs:27-44`; `tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs:301-321`
**Issue:** A photo of 10001 x 100 pixels is only about 1 megapixel, yet both tests assert the refusal text "print.jpg is too big. Photos can be at most 25 megapixels." The text also hard-codes 25
even though `MaxPixels` is configurable. Staff who upload a long thin panorama are told a limit they did not break.
**Fix:** Ask the owner (this is wording, so their call). If they agree, use a second message for the side limit, e.g. "is too long. The longest side can be at most 10,000 pixels.", build both from the
settings, and update these tests.

#### IN-G2-02: Test setup leaks hosts or a held upload when an assertion fails midway

**File:** `tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs:193-212`; `tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs:128-134`
**Issue:** `StartSceneAsync` / `StartDeletedPhotoSceneAsync` create two factories and a client, then run steps that can throw (session start, order create, upload, permanent delete). The `Scene` is not
yet inside an `await using`, so nothing is disposed on failure. `OrderImageDeletionQueueTests` calls `storage.HoldUploads()` and only calls `Release()` after two assertions, so a failed assertion leaves a request
parked until the host is torn down. `OrderListQueryCountTests.Rig.StartAsync` and `ListOrdersEndpointTests.Rig.StartAsync` already do this correctly with try/catch.
**Fix:** Mirror the try/catch-dispose pattern used in `OrderListQueryCountTests.Rig.StartAsync`; wrap the held-upload section in `try { ... } finally { storage.Release(); }`.

#### IN-G2-03: "Exactly the upload limit" test accepts any 400

**File:** `tests/Csps.Server.IntegrationTests/Orders/OrderImageUploadLimitsTests.cs:54-65`
**Issue:** `ABodyOfExactlyTheUploadLimitReachesTheActionAndIsRefusedForItsContent` asserts only `400`. A malformed-multipart 400 from the framework, a missing-file 400 or an `images.type` 400 all pass. Only
the last proves the body reached the action.
**Fix:** Read the problem and assert the code: `(await ProblemJson.ReadAsync(response, ct)).GetProperty("code").GetString().ShouldBe("images.type");`

#### IN-G2-04: Small leftovers in the maintenance endpoint tests

**File:** `tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs:160, 210, 341-349`
**Issue:** `started` (a `TaskCompletionSource`) is created, passed to `HeldJob` and set, but never awaited, so it does nothing. `labels.Count.ShouldBeGreaterThan(3)` is a weak stand-in for the real expected list.
**Fix:** Remove `started`, or await it before the second call. Replace the count check with the exact label list in order.

#### IN-G2-05: Index and count pins in `AuditActionsTests` break on any mid-list insert

**File:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:14, 155, 249-250`
**Issue:** The test pins `All.Count == 97`, `Skip(37).Take(12)`, `Skip(49)`, `PhaseSeven.Length == 43`. These are change-detector numbers. Line 250 also uses the literal `"order-image.deleted"` while the four other
codes in the same list use constants (`AuditActions.OrderImageDeleted` exists).
**Fix:** Replace the literal with the constant. Consider asserting the order by names (as `PhaseSeven` already does) and dropping the raw count, or keep it but expect a deliberate edit with each phase.

#### IN-G2-06: Development-environment test hosts may load a developer's user-secrets (not confirmed)

**File:** `tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs:169-187, 189-203`; `tests/Csps.Testing/CspsApiFactory.cs:75-147`
**Issue:** `AHostWithNoImageStorageStarts...` switches the host to `Development` and expects `images.not-configured`. `Csps.Server` has a `UserSecretsId`, and `WebApplication.CreateBuilder` adds user-secrets in
`Development`. `CspsApiFactory` only turns that off for `Testing` (see `TestingConfiguration.AddUserSecretsWhenAsked`). If a developer has real `Cloudinary:*` values in their user-secrets (the one-time
`Csps.CloudinarySetup` tool needs them), this test could build the real adapter and upload to the `csps-dev` folder instead of getting a 503. I could not confirm from the code alone whether user-secrets reach a
WAF-built `Development` host, so this needs a 5 minute check on the owner's machine.
**Fix:** If confirmed, blank the three keys in that test with `builder.UseSetting("Cloudinary:CloudName", string.Empty)` (and `ApiKey`, `ApiSecret`), which also makes the intent explicit.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer), lane G2_
_Depth: standard_

---


## Phase 9, Lane G3 (web/src): Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard
**Files Reviewed:** 73 (`api.generated.ts` skimmed only; test files read for reliability, not line by line)
**Status:** issues_found

### Summary

The photo code is in good shape. I checked these points against the real code and found them sound:

- No `blob:` or object URLs are made anywhere, so nothing needs revoking. Previews are `data:` URLs.
- The upload queue has no stale-closure problem. Every effect that adds a listener returns its cleanup.
- The queue is cleared on leave, with a StrictMode-safe timer.
- Each file keeps one Idempotency-Key for Try Again.
- `exactOptionalPropertyTypes` handling is correct.
- The zod description rule (UTF-16 length, trimmed, limit from the server rules) matches `OrderImageRules.CheckDescription` and `DescribeOrderImageRequestValidator`.
- The move range matches `MoveOrderImageRequestValidator` (0 to 4).
- The type list from `GET /orders/image-rules` is matched by the file sniff.
- No em or en dash is in any file in the lane (grep for U+2012 to U+2015 found none).
- Only `core/api/http` touches `fetch` (OR-5).
- The viewer traps focus, makes the page inert, locks scroll and closes on Esc. It returns focus to the thumb of the photo shown last.
- The `fullSize` link has `rel="noopener noreferrer"`.

No Critical issue was found. There are three Warnings and five Info items.

### Warnings

#### WR-G3-01: A pick that finishes after the card has gone starts an orphan upload queue

**File:** `web/src/modules/admin/components/OrderPhotosCard.tsx:480-540` (the call at line 535), with `web/src/modules/admin/hooks/usePhotoUploadQueue.ts:283-301` and `:345-358`

**Issue:** `runPick` is async. It awaits the rules, then `prepareImage` for each file (decode, resize, encode). When it ends it calls `queue.enqueue(ready)`. Nothing checks that the card is still on screen.

If staff pick photos and leave the order page while the files are still being prepared:
- `show()` has already run its cleanup, and the old entry is gone.
- No leave guard fires, because `pending` is still 0 until the enqueue.
- The late `enqueue` creates a new entry with `disposed: false` and starts uploading in the background.
- Nobody calls `show()` for that entry, so `clear()` never runs for it.
- The entry stays in the module map with its blobs.
- If the order page is opened again, the card shows that old queue. Failed files from an earlier visit appear, with the stale `deps` captured at pick time. This breaks the stated rule: "the queue is dropped when the Images card leaves the page", and nothing in memory should outlive it.

**Fix:** Track "still mounted" in the card and skip the enqueue when it is gone. This must be StrictMode-safe, so set the ref in the effect setup.

```tsx
const alive = useRef(false);
useEffect(() => {
  alive.current = true;
  return () => {
    alive.current = false;
  };
}, []);
// in runPick, last lines:
setPickErrors(refused);
setLeftOut(leftOutCount);
if (alive.current) queue.enqueue(ready);
```

Do not guard inside `photoUploadQueue.enqueue` with the `shown` count. The New Order hand-off (`OrderFormPage.tsx:282`) enqueues before the order page shows the order, on purpose.

#### WR-G3-02: Focus is lost after Try Again or Remove on a queued file (WCAG 2.4.3, 2.4.11)

**File:** `web/src/modules/admin/components/OrderPhotosCard.tsx:594-595` (`onRemove={queue.remove}`, `onRetry={queue.retry}`), with `web/src/components/media/PhotoTile.tsx:267-305`

**Issue:** Pressing Try Again moves the file to `waiting`, then `uploading`.
- The failed-file buttons are removed from the DOM. `fileActions()` returns a different, empty row while uploading.
- The focused button disappears and focus falls to `<body>`.

Pressing Remove removes the whole tile (`queue.remove`) with no focus target either.

The saved-photo flows (move, delete, description, viewer) have careful focus plans. The queue flows have none. A keyboard or screen-reader user loses their place in the list and must tab in from the top. The New Order picker does handle this (`OrderPhotoPicker.remove` calls `moveFocusTo('add')`), so the two screens are inconsistent.

**Fix:**
- After Remove, focus the next tile's control, else the add control, else the card heading (reuse the `focusAfterDelete` pattern).
- After Try Again, move focus to the tile's status text, or to the card's `role="status"` region. Give the `<li>` `tabIndex={-1}` and focus it.

#### WR-G3-03: Phone photos over 25 megapixels are refused even though the browser would shrink them

**File:** `web/src/utils/images.ts:211-213` (locked in by `web/src/utils/images.test.ts:272-275`)

**Issue:** `prepareImage` rejects a photo when `width * height > maxPixels` (25 MP) or a side is over `maxSide`. It does this on the original, before `planDownscale`. D-18 says every upload is resized to a 2000 px long side, and the server only sees the resized copy.

A 48 MP or 50 MP flagship phone photo (about 8000 x 6000, common in "high-res" camera modes) is decoded, then refused with "is too big. Photos can be at most 25 megapixels". The server would accept the 2000 px version. Staff on those phones cannot add the photo at all.

The test names this a deliberate rule ("refuses a 6000 x 5000 photo"). It is a behavior and scope question, so this needs an owner ruling.

**Fix (after the ruling):**
- Test the server limits against the prepared output (`plan.width * plan.height`). `pickIssue` in `OrderPhotosCard.runPick` already does this check on the output.
- Keep only a much higher client memory ceiling on the original, for example 100 MP, with its own message.
- Update `images.test.ts` to match.

### Info

#### IN-G3-01: A repeated identical announcement is not read out again

**File:** `web/src/modules/admin/hooks/usePhotoUploadQueue.ts:191` and `:197`, with `OrderPhotosCard.tsx:599-601`

**Issue:** `entry.announcement` is never cleared between batches.
- A second single-photo batch sets `allUploaded` again, identical to the text already in the polite region, so a screen reader says nothing.
- The same happens for a repeated `someFailed(n, m)` line.
- The toast still shows, which softens the effect.

The card clears its own `announcement` state before each action for this reason. The queue should do the same.

**Fix:** Set `entry.announcement = ''` and publish when a batch starts (in `enqueue` when idle), or append a zero-width alternation.

#### IN-G3-02: `photoUploadQueue.remove` silently drops the batch's "Photos added" feedback

**File:** `web/src/modules/admin/hooks/usePhotoUploadQueue.ts:318`

**Issue:** When the last failed file is removed, `entry.saved` is set to 0. The photos that did upload earlier in that batch never get the `onBatchDone` toast or the "All photos uploaded" announcement.

**Fix:** When `items.length` reaches 0 and `entry.saved > 0`, call `finish(entry)` instead of resetting `saved`.

#### IN-G3-03: Duplicate branch in `classify`

**File:** `web/src/modules/admin/hooks/usePhotoUploadQueue.ts:168-170`

**Issue:** The `STORAGE_FAILED` branch and the final fallthrough return the same value, so `STORAGE_FAILED` is dead code. Only `NOT_CONFIGURED` differs.

**Fix:** Remove the `STORAGE_FAILED` constant and its branch, or give it distinct handling.

#### IN-G3-04: The serial pick chain has no catch

**File:** `web/src/modules/admin/components/OrderPhotosCard.tsx:538-540`, `web/src/modules/admin/components/OrderPhotoPicker.tsx:253-255`

**Issue:** `picking.current = picking.current.then(() => runPick(files))` has no `.catch`. I found no current throw path, because `prepareImage` is wrapped and zod `safeParse` does not throw. If one ever throws, every later pick is skipped silently and the promise is unhandled. On the New Order form, `pickerRef.settled()` would then reject, so `onValid` would throw and Save would stop working.

**Fix:**
```ts
picking.current = picking.current.then(() => runPick(files)).catch(() => undefined);
```

#### IN-G3-05: `pickCandidate` is test-only code in a production module

**File:** `web/src/modules/admin/imageSlots.ts:11-39`

**Issue:** `pickCandidate` and `SrcSetCandidate` are used only by tests. The file is otherwise two `sizes` constants. They will be tree-shaken, but they sit in the app tree as a test helper.

**Fix:** Move them next to `imageSlots.test.ts`, or into `web/src/test/`.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---


## Phase 9, lane G4: Code Review Report

*Created: 2026-11-05T12:00:00-05:00 · Updated: 2026-11-05T22:56:00-06:00*

**Reviewed:** 2026-11-05
**Depth:** standard
**Files reviewed:** 41 (`tools/openapi-gen/openapi.v1.json` skimmed only, as it is generated)
**Status:** issues_found

### Summary

The monthly maintenance path is in good shape. `maintenance.yml` pins both actions to the same commit SHAs the other workflows use, passes the key and the site address only through `env`, gives the token no rights, prints no key and uses a correct cron (19:17 UTC on the 1st is 03:17 on the 2nd in Manila). `maintenance.mjs` matches the server contract (`X-Maintenance-Key`, `POST /api/v1/maintenance/run`, `{ ok, more, lines[{label,value,failed,text}] }`), refuses redirects, prints only cleaned labels and fixed sentences, and cannot emit a `::` workflow command because every printed line starts with `- ` or `## `. The 409 retry window (4 x 60 s) is longer than the server lease (3 min), so a crashed run clears in time. No real hostnames, DB names, account ids, emails or local user paths were added in this lane's files (the shop's public domain in `mail-setup.md` is older content, not part of this phase).

The problems are in the owner-review tool (one capture that can never work, and a missing rate-limit override), a weak spot in how the maintenance secret can be used from other branches, a race in the E2E photo lock, and a few docs that describe the deferred backup work or contradict the code.

### Critical Issues

#### CR-G4-01: Owner review "description-409" picture can never be taken (photo places count from 0, the code looks for place 2)

**File:** `web/scripts/owner-review.mjs:4674`
**Issue:** The case makes an order with 2 photos, then looks for the coworker's target with `images.find((image) => isRecord(image) && image.position === 2)`. The order answer numbers places from 0 (`OrderDetailResponse.cs:147`: "The display order from 0; the photo at 0 is the cover"; `docs/api/order-images.md:116`). With 2 photos the places are 0 and 1, so nothing matches, `second` is undefined and the case always throws "The order has no second photo." Every `description-409` picture (2 themes x 3 widths = 6 pictures) is missing from the owner's report, and the failure only shows up as a line in the report's problem list. The e2e twin of this step (`order-photos-a11y.spec.ts:410`) sorts by position and takes index 1, which is why it works there. No unit test catches this, because `PHASE9_CAPTURES` is not exported and not exercised.
**Fix:**
```js
const second = images
  .filter((image) => isRecord(image) && typeof image.position === 'number')
  .sort((a, b) => a.position - b.position)[1];
```
or compare with `image.position === 1`.

### Warnings

#### WR-G4-01: Owner review host does not lift the photo upload limit, so most Phase 9 pictures will hit 429

**File:** `web/scripts/owner-review.mjs:189-201` (`HOST_ENV`)
**Issue:** `web/playwright.config.ts:110-111` was changed in this phase to set `RateLimits__Images__PermitLimit` to the "no throttle" value, with the comment that the photo journeys upload from one address (30 per 10 minutes by default, `RateLimitSettings.cs:39`). The owner-review host is documented as running "exactly as the Playwright E2E host does", but `HOST_ENV` only lifts the six `RateLimits__Auth__*` limits. The Phase 9 run uploads 18 photos while seeding and about 10 more for each theme and width view (`o1-uploading` 3, `o1-failed` 2, `o1-saved-line` 3, `description-409` 2) across 6 views, roughly 78 uploads from `localhost`. After the 30th, uploads answer 429 `rate-limited`; later `ownOrder` calls throw and the UI uploads in `o1-uploading` and `o1-failed` time out. Each failed picture is only reported in the problem list.
**Fix:** Add the same line to `HOST_ENV`:
```js
RateLimits__Images__PermitLimit: NO_THROTTLE,
```
and update the `HOST_ENV` comment. Consider a small unit test that asserts `HOST_ENV` and the Playwright `webServer.env` lift the same limits.

#### WR-G4-02: The maintenance key is readable by a workflow run from any branch

**File:** `.github/workflows/maintenance.yml:10, 41-45`
**Issue:** `workflow_dispatch` lets anyone with write access pick any branch in "Run workflow". The job reads the repository secret `MAINTENANCE_KEY` and runs `web/scripts/maintenance.mjs` from that branch. A changed copy of the script on a throw-away branch could send the key anywhere. The comment says an environment was left out so that cron runs are not held for approval, but an environment with only a "deployment branches: main" rule and no required reviewer would not hold anything. The key can only trigger cleanup jobs and is rate limited, so the impact is low, but it is the one secret in a public repository that anything on any branch can read.
**Fix:** Guard the job so it only runs from `main`, which also matches the docs ("use Run now from `main`"):
```yaml
jobs:
  run:
    if: github.ref == 'refs/heads/main'
```
or move the secret into an environment limited to the `main` branch with no reviewers. Update `CiWorkflowTests`/`MaintenanceWorkflowTests` and `docs/operations/ci.md` to match.

#### WR-G4-03: The photo host lock can be taken by two tests at once

**File:** `web/e2e/photo-host-lock.ts:11, 31-48`
**Issue:** Two problems in the stale-lock takeover. (1) The lock is considered stale after 3 minutes (`STALE_AFTER_MS`) measured from the directory's creation time, and the holder never refreshes it. The specs allow a single `withPhotoHost` block to run for up to 120 s of waiting plus drawing and uploading (`uploadAndWait`, `orderWithPhotos`), so a slow WebKit or phone project can legitimately hold it past 3 minutes. (2) Two waiters can both see the lock as stale; the first removes it and creates its own, then the second runs its pending `rmSync` and deletes the first one's fresh lock and creates another. Both now think they hold it. When the original holder finishes, its `finally` also removes whoever holds the lock now. Result: the shared `fail-next` switch can be consumed by the wrong test, which is the exact flake the lock exists to prevent, and it shows up only on slow machines.
**Fix:** Keep the lock alive while held (touch it with `utimesSync` every 30 s in `withPhotoHost`), take over a stale lock by renaming it to a unique name first (`renameSync` is atomic, only one waiter wins) and only then delete that copy, and make the release delete only a lock that still carries the holder's own token (write a token file in the directory).

#### WR-G4-04: `cloudinary-setup.md` tells the owner to set backup variables and read a backup line that do not exist

**File:** `docs/operations/cloudinary-setup.md:138, 141`
**Issue:** Release-day steps 3 and 6 describe `Maintenance__Backup__SqlServerFolder`, `Maintenance__Backup__AppFolder`, a `Database backups written: 1` summary line and a "did not show up in the app folder" message that "is explained in `docs/operations/maintenance.md`". Decision D-51 (2026-11-05) deferred the backup plans and removed the probe code; a search of `src`, `tools`, `web/scripts` and `.github` finds none of these names, and `maintenance.md` has no backup section. The owner following the release list would add settings that nothing reads and look for a line that never appears.
**Fix:** Remove steps 3 and the backup sentence in step 6, or replace them with one line: "Database backups are deferred (D-51); take backups by hand in the control panel until the owner decides otherwise." Re-add the text when the backup plan is rebuilt.

#### WR-G4-05: The same E2E helpers are copied into six spec files

**File:** `web/e2e/order-photos-a11y.spec.ts:25-153`, `order-photos-arrange.spec.ts:20-98`, `order-photos-delete.spec.ts:21-125`, `order-photos-upload.spec.ts:20-69`, `order-photos-view.spec.ts`, `order-photos-list.spec.ts`
**Issue:** `drawScript`/`gradientScript`, `drawJpeg`, `PickedFile`, `seedOrder`, `savedName`, `tiles`, `thumbSources`, `photoKey`, `orderWithPhotos` and the soft-delete-through-API snippet are pasted into each file with only the order-number prefix and names changed. A fix to one (for example a timeout, or the position handling in WR-G4-01's twin) has to be repeated in six places and drifts, as the `ORD-2094` prefix already shared by two specs shows. The owner-review script holds a seventh copy (`jpegScript`, `SEEDED_JERSEY`, `SEEDED_CASH`, `addPhotos`), and `CASH_ID` in the a11y spec repeats the seeded literal.
**Fix:** Move the shared pieces into one `web/e2e/photos.ts` (exported `drawJpeg`, `savedName`, `tiles`, `thumbSources`, `photoKey`, `orderWithPhotos`, `seedOrder(prefix)`), and import `BASKETBALL_JERSEY_ID` and a shared `CASH_ID` from `testing-api.ts`.

### Info

#### IN-G4-01: Purge doc says a row exactly at the cut-off stays, but two rules remove it

**File:** `docs/operations/maintenance.md:28` (code: `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs:86, 91`)
**Issue:** The intro says "A row exactly at the cut-off stays." The request-key and claim rules use `ExpiresAt <= now` and `ExpiresAtUtc <= now`, so a row expiring at that very instant is removed. The other four rules use `<` and match the sentence.
**Fix:** Say "A row exactly at the cut-off stays (except request keys and claims, which go once their own expiry has been reached)."

#### IN-G4-02: `mail-setup.md` still talks about the job as future, and the 30-day promise is looser than the monthly schedule

**File:** `docs/operations/mail-setup.md:128, 131`
**Issue:** Line 131 still says "the Phase 9 job has a definition to follow" although the job now exists. Line 128 says the address is "not kept longer than" 30 days, but the job runs once a month, so a closed row can live up to about 60 days (the sentence after it is accurate, the first is not). This matters because the 30 days is a personal-data rule.
**Fix:** Reword line 131 in the present tense, and write "deleted by the first monthly run after the 30 days are over, so at most about 60 days".

#### IN-G4-03: Three E2E checks of the photo count hint cannot fail on a missing visible hint

**File:** `web/e2e/order-page.spec.ts:75`, `web/e2e/order-photos-upload.spec.ts:124`, `web/e2e/order-photos-create.spec.ts:77`
**Issue:** `getByText(...).first()).toBeAttached()` accepts a node that is in the DOM but not shown. `ImageUploader.test.tsx:158` shows the hint is rendered twice (`toHaveLength(2)`), so if the visible copy were lost while the other copy stayed, these lines would still pass. `getByText('3/5')` is also a substring match that any other text containing "3/5" would satisfy.
**Fix:** Assert the visible copy: `await expect(page.getByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 3/5').first()).toBeVisible()` (or `.last()` if the sr-only copy comes first).

#### IN-G4-04: `maintenance.mjs` gives up at once on a transient 502/503/504

**File:** `web/scripts/maintenance.mjs:162-171`
**Issue:** Only 409 is retried. On a shared IIS host the first request after an app pool restart can return 502/503/504 for a moment, which turns the monthly run red and costs the owner a manual "Run now". The behaviour is documented, so this is a robustness choice, not a bug.
**Fix:** Treat 502, 503 and 504 like the busy case with one or two retries and a short wait, and add a test beside the 409 ones.

#### IN-G4-05: Small tidy-ups

**File:** `Directory.Packages.props:25`, `.github/workflows/maintenance.yml:28-31`, `web/scripts/owner-review.mjs` (`PHASE9_CAPTURES`)
**Issue:** (a) `CloudinaryDotNet` is added after `Microsoft.Extensions.Http.Resilience` out of alphabetical order. (b) The `checkout` step fetches the whole repository only to run one file, and with job `permissions: {}` it works only because the repository is public; if it ever goes private the step fails with no `contents: read`. The top-level and job-level `permissions: {}` are also duplicates. (c) No unit test checks that every id in `PHASE9_REVIEW_CASES` has a function in `PHASE9_CAPTURES`; a missing one only fails at run time (the same gap that hid CR-G4-01).
**Fix:** (a) Move the line. (b) Keep it, but note the dependency on a public repository in the workflow comment, or add `contents: read` to the job. (c) Export `PHASE9_CAPTURES` and add a test that its keys equal the case ids.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Second review: the fix commits (689b59c8..HEAD)

*Added: 2026-11-05T22:56:00-06:00*


### Phase 9: Second Code Review Report (review fixes 689b59c8..HEAD)

**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

#### Summary

I read each fix against its finding and against the rulings D-52 to D-55. No fix introduced a crash, a data loss path or a security hole. The risky ones hold up:

- **UploadSlotsMiddleware** is correct. It sits after `UseAuthorization` and before the idempotency step. `using var lease` frees the slot on a normal finish, on an exception and on an early 429. The limiter is a singleton, so each app has its own two slots. A full queue gives the 429 with `Retry-After: 60` and the same code as the address limits. An aborted request that is still waiting throws from `AcquireAsync`, and the existing exception handler deals with that, so no slot leaks.
- **MaintenanceCursors**: the migration only adds one table. It has no JSON column, no trigger and no inline SQL; it uses LINQ with `ExecuteUpdate` and `ExecuteDelete`. The model snapshot matches the configuration and the migration.
- **Sweep save and clear logic**: I walked through every branch (budget spent, over the cap, transient or unauthorized failure, other failure, normal end). Each saves, keeps or clears the place correctly. It matches D-52 and D-54.
- **D-55 logic**: `Attempts + 1 >= 5` is right, because `FailAsync` adds one after the claim read the old count. The attention line is non-failing, and the log line is written.
- **Photo host lock rewrite** is a clear improvement. It has two small gaps (WR-R2-02).
- **order-photos-view.spec.ts** resolution is correct. `seedOrder(request, SEED)` and `uploadAndWait(page, number, files, files.length)` match the signatures in `photos.ts`. The helper waits for the same `savedName(n, n)` tile as the old private helper. The three 09-33 viewer tests build the same files with the same sizes. No unused imports remain, and `isTouch` is still defined locally.
- **No long dashes** were added.

Two warnings and three info items remain.

#### Warnings

##### WR-R2-01: The `if: github.ref == 'refs/heads/main'` guard does not protect the maintenance key, and the docs say it does

**File:** `.github/workflows/maintenance.yml:26-28`, `docs/operations/ci.md:344`, `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs:57-58`
**Issue:** The guard lives inside the workflow file. "Run workflow" on another branch runs that branch's copy of the file. Anyone who can push a branch can delete the `if:` line (and change the script) in their copy, then press Run workflow on it. The secret `MAINTENANCE_KEY` is a repository secret with no environment, so that branch run can read it. The guard only stops an accident by the owner. `ci.md` says "a changed copy of the script on a throw-away branch can never read `MAINTENANCE_KEY`", and the architecture test calls it a security guard. That claim is false. The finding it answers (WR-G4-02) was a key-exposure risk, so the fix looks done while the risk stays.
**Why it matters:** The repo is public and the key opens the maintenance endpoint. A false "can never" in the ops docs leads the owner to relax other controls. Only people with write access can exploit this, so the risk is low, but the claim is wrong.
**Fix:** Move the secret into a GitHub environment named for the job (for example `maintenance`) and limit its deployment branches to `main`, with no required reviewer so the cron run is not held. Add `environment: maintenance` to the job and update the architecture test (it currently forbids `environment:`; change it to require the branch-limited one). If the owner prefers to keep a repository secret, change the `ci.md` and workflow comment to say the guard prevents accidents only, and rely on branch rules for protection.

##### WR-R2-02: The stale-lock takeover can delete a live lock

**File:** `web/e2e/photo-host-lock.ts:60-77` (`takeOverStale`)
**Issue:** The function reads the token (`seen`) after `isStale()` returned true, not before. If, between those two steps, another waiter takes over the stale lock and a third process takes the now free lock and writes its token, then `seen` is the new holder's token. The waiter then renames the new, live lock away. `tokenIn(away) === seen` is true, so it deletes it. The put-back branch has a second gap. If a fourth process has already created a new directory at the old path, `renameSync(away, directory)` fails and the catch runs `rmSync(away)`, which also deletes a live lock. In both cases two tests can upload at once, which is the problem the lock exists to stop (a shared `fail-next` switch gets used up by the wrong test). It can also make the new holder's `writeFileSync` throw `ENOENT`, failing a test with an unrelated error. The unit test `lets only one of two waiters take over` cannot catch this, because both waiters run in one process and the code is synchronous.
**Why it matters:** The window is small, but waiters in separate Playwright worker processes all poll on the same 250 ms rhythm, and a crashed run makes them all see "stale" together. The cost is an occasional flaky E2E run that is hard to explain.
**Fix:** Decide staleness from the directory you actually moved, not from a token read earlier:
```ts
function takeOverStale(): void {
  const away = `${directory}.stale-${randomUUID()}`;
  try { renameSync(directory, away); } catch { return; }
  const stale = Date.now() - statSync(away).mtimeMs > staleAfterMs;
  if (stale) { rmSync(away, { recursive: true, force: true }); return; }
  try { renameSync(away, directory); } catch { /* a newer lock exists; leave `away` for the next run to clean */ }
}
```
Do not `rmSync(away)` when the put-back fails and the moved directory was fresh.

#### Info

##### IN-R2-01: A client that aborts an upload mid-send can leave a stored file that is never queued

**File:** `src/Csps.Application/Orders/UploadOrderImageHandler.cs:87-97`, `src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs:134-136`
**Issue:** The WR-G1A-06 fix queues the file only when the storage returns the `transient` code. If the request itself is cancelled (the phone drops off), `IsTransientFailure` returns false for `OperationCanceledException` when the caller's token is cancelled, so the exception propagates out of `UploadAsync`. Cloudinary may already have stored the file, and nothing queues it. The stray sweep removes it after 2 days, so nothing is lost for good.
**Fix:** In the handler, wrap `storage.UploadAsync` in `catch (OperationCanceledException)` that calls `UndoUploadAsync(publicId)` (it already uses `CancellationToken.None`) and then rethrows. Or accept the 2 day sweep as the answer and say so in the handler comment.

##### IN-R2-02: The upload endpoint name is written twice

**File:** `src/Csps.Server/Controllers/OrderImagesController.cs:44`, `src/Csps.Server/Security/UploadSlotsMiddleware.cs:15`
**Issue:** The middleware compares against `UploadSlotsMiddleware.UploadEndpointName`, but the controller still has the string `"UploadOrderImage"` as a literal. If one is renamed, the slot cap silently stops applying and only a test that runs seven uploads together would notice.
**Fix:** Use `[EndpointName(UploadSlotsMiddleware.UploadEndpointName)]` on the action.

##### IN-R2-03: No test for slot release on an exception or an aborted request

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/ImageUploadRateLimitTests.cs`
**Issue:** The tests cover queueing, the 429, the anonymous 401 and the other-endpoint pass-through. Nothing proves that a handler that throws, or a client that aborts while waiting in the queue, frees its slot. The code is correct today (`using var lease`), but a later edit to a manual `Dispose` would not be caught, and a leaked slot would lock uploads for the whole app until restart.
**Fix:** Add a test where the held upload's storage call throws, then check that two more uploads can run at once. Add one that cancels a queued request and checks the next request still gets a slot.

---

_Reviewed: 2026-11-05T22:30:00-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
