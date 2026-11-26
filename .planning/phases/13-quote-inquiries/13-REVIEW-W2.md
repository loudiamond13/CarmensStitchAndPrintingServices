---
created: 2026-11-22T19:30:00-06:00
updated: 2026-11-22T19:30:00-06:00
phase: 13-quote-inquiries
wave: 2
plan: 13-05
reviewed: 2026-11-22T19:30:00-06:00
depth: standard
files_reviewed: 35
files_reviewed_list:
  - docs/api/quote-requests.md
  - src/Csps.Application/Images/PublicIds.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/Ports/QuotePhotoTarget.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequestValidator.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
  - src/Csps.Application/QuoteRequests/QuoteUploadKey.cs
  - src/Csps.Application/QuoteRequests/UploadQuotePhotoHandler.cs
  - src/Csps.Application/QuoteRequests/UploadQuotePhotoRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestPhoto.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestPhotoConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261122233823_AddQuoteRequestPhotos.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/QuotePhotoRulesTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/UploadQuotePhotoHandlerTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestPhotosTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuotePhotoFailureTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestFixtures.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/UploadSlotsCoverageTests.cs
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 13, Wave 2 (plan 13-05): Code Review Report

**Reviewed:** 2026-11-22T19:30:00-06:00
**Depth:** standard (plus a read of `IdempotencyMiddleware`, `UploadSlotsMiddleware` and the rate limit registration, which the endpoint runs through)
**Files Reviewed:** 35 (`QuoteRequestFixtures.cs` and `CreateQuoteRequestHandlerTests.cs`, `QuotePhotoRulesTests.cs`, `QuoteRequestPhotosTests.cs` were only skimmed for scope; the other test files were read in full)
**Status:** issues_found

## Summary

The upload path holds up well against the stated focus areas. I traced each one and found no blocker.

- **Key handling.** Only the SHA-256 is stored (`varbinary(32)`). The compare uses `CryptographicOperations.FixedTimeEquals`. A malformed key is refused before decoding (`Base64Url.IsValid`), so it cannot throw. Expiry is exclusive (`now < expires`) and is tested at the exact tick. The key is never echoed by the create answer.
- **Uniform 404.** One shared `Error` instance (`PhotoNotFound`) covers a missing request, no key, a wrong key, an expired key, a Spam request, a filled slot and an undeclared or out-of-range slot. The checks are folded into one boolean with no early-out between them. The integration test compares full problem bodies, minus the trace id, across nine misses.
  - The only branches that answer before the 404 check are 503 (storage not set up), 400 (no file) and 413 (file too long). None of them depends on the id, the key or the slot, so none is an oracle.
- **Limits before storage.** The type, pixel and size checks and the metadata strip all run after the 404 check and before `UploadAsync`. The 413 is decided from `file.Length` before the copy.
- **Paths.** The stored id is `{root}/quotes/{Guid:D}/{26 base32 chars of 128 random bits}`. No file name or client text reaches a path. The file name is only echoed in a message, after `ImageErrors.CleanName`.
- **Slot race.** One conditional `ExecuteUpdate` (slot empty and request not Spam) gives exactly one winner. The loser is queued as `UploadUndone`.
- **Storage failure.** A failed or timed-out upload leaves the saved request and an empty slot. A failed save after storage queues the file and rethrows.
- **Project rules.** No raw SQL (EF `ExecuteUpdate` only), no trigger, no JSON column, `TimeProvider`/`IBusinessCalendar` for time, `[AllowAnonymous]` is declared, and the validator runs in the handler. I found no em or en dash in the changed `src`, `tests` or `docs` files. I did not check `web/src/types/api.generated.ts` or `tools/openapi-gen/openapi.v1.json`, which are generated.

The findings below are availability and hardening gaps, not correctness failures of the plan's own logic.

## Warnings

### WR-01: An anonymous caller can hold the app-wide upload slots, and the body is read before any key check

**File:** `src/Csps.Server/Controllers/PublicQuoteRequestsController.cs:71`, `src/Csps.Server/Security/UploadSlotsMiddleware.cs:7-9, 42`, `src/Csps.Server/Program.cs:151-155`
**Issue:** `[UploadSlot]` shares one app-wide limiter of 2 uploads at a time plus 4 waiting with the staff order photo, product line photo, gallery and share picture uploads. The middleware's own comment says "It runs after authorization, so a refused anonymous request never takes a slot." That was true until this endpoint. This endpoint is `[AllowAnonymous]`, so any visitor now takes a slot.

The slot is taken in `UploadSlotsMiddleware` (Program.cs line 151), which runs before `IdempotencyMiddleware` (line 155). `IdempotencyMiddleware` buffers and hashes the whole multipart body, and multipart form binding follows. All of that happens before `FindForUploadAsync` or the key check runs. A caller with a random id and no valid key therefore still occupies a slot, and a slow or large body keeps it occupied. The only counter is the per-address `images-upload` limit (30 per window, partitioned by remote address). A handful of addresses, or a few slow connections, can keep both slots and the queue full. Staff then get 429 "uploads busy" on order photos, which is a core staff task. This is also the first endpoint where an unauthenticated 10 MB body is buffered in memory.

The "known-deferred" items (no per-address limit or bot guard on create, key not wiped) do not cover this.
**Fix:** Give the anonymous quote photo its own limiter, so it can never starve staff uploads. Either:
- a second `ConcurrencyLimiter` (for example 1 at a time, 2 waiting) selected by endpoint metadata in `UploadSlotsMiddleware`; or
- a cheap pre-check before the slot is taken: parse the id from the route and check that the `X-Upload-Key` header is well formed with `QuoteUploadKey.TryHash`, answering the same 404 without reading the body.

Update the middleware comment and `docs/api/quote-requests.md` (the 429 row) to match.

### WR-02: Photo files are orphaned in private storage if the save is rolled back after the 200, and nothing removes them yet

**File:** `src/Csps.Application/QuoteRequests/UploadQuotePhotoHandler.cs:77-108`
**Issue:** The handler uploads the file, then calls `FillPhotoSlotAsync` inside the idempotency lease's transaction. The middleware rolls the transaction back when the answer is not storable, and `StoreAndCommitAsync` can fail. In either case the handler has already returned `Result.Success()`, so the `UndoUploadAsync` paths never run. The slot stays empty and the file stays in `{root}/quotes/{id}/`. The row that would have named it was never committed. A customer photo is then kept with no database reference, and the visitor's retry uploads it again under a new id.

The only cleanup named is the plan 13-08 stray sweep, which is not in this wave. The existing order image flow has the same shape, but there staff can see and delete the image.
**Fix:** Do one of these:
- make plan 13-08 a hard dependency of shipping 13-05, and record it as a ruling in the plan;
- queue the id as `UploadUndone` from the middleware when the commit fails; or
- record the pending id before the upload (an intent row) so the sweep can tell a stray from an in-flight file.

## Info

### IN-01: The idempotency hash does not cover `X-Upload-Key`, so a stored answer can be replayed without the key

**File:** `src/Csps.Server/Security/IdempotencyMiddleware.cs:203-210` (applies to `PublicQuoteRequestsController.cs:68`)
**Issue:** The request hash covers the path, the query and the multipart parts, but not the `X-Upload-Key` header. Two consequences follow:
- A caller who knows the `Idempotency-Key` UUID, the request id, the slot and the exact file bytes gets the stored 200 back without presenting the upload key.
- A 404 stored for a first attempt with a bad key is replayed for a later attempt with the same `Idempotency-Key` and a good key.

Exploiting the first needs secrets at least as strong as the upload key itself, and the answer is an empty 200, so this is a hardening gap and not an exploitable bypass.
**Fix:** Add a hook so an endpoint can contribute a header to the hash, or require a fresh `Idempotency-Key` per attempt. Document either choice in `docs/api/quote-requests.md`.

### IN-02: The server accepts any 32-byte upload key, including a weak one

**File:** `src/Csps.Application/QuoteRequests/QuoteUploadKey.cs:17-33`
**Issue:** Only the length is checked (43 characters of base64url, 32 bytes). A client that sends 32 zero bytes, or a key from a weak random source, is accepted. Upload then depends on the request id alone (UUIDv7, 74 random bits, but time-prefixed). This only weakens the visitor's own request, and the form is the owner's own client, so it is low risk. It does become real if plan 13-09 ever ships a fallback generator.
**Fix:** Optionally reject degenerate keys (all bytes equal), and make the browser use `crypto.getRandomValues` only. Add a client test for it in 13-09.

### IN-03: `CleanPhotoName` duplicates `ImageErrors.CleanName` and keeps bidirectional format characters

**File:** `src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs:139-146`, `src/Csps.Application/Images/ImageErrors.cs:83-95`
**Issue:** The same leaf, strip-controls and trim logic exists twice, with different fallbacks ("Photo n" and "This file") and different truncation. `char.IsControl` does not strip format characters such as U+202E (right-to-left override). A visitor-chosen name such as `photo` plus U+202E plus `gpj.exe` is stored as is and later shown to staff in the inbox (13-16), where it can disguise the extension. React escapes markup, so this is not an injection, only spoofing.
**Fix:** Keep one cleaner and have the other call it. Drop `UnicodeCategory.Format` characters and surrogates that are unpaired, and add a test for the override character.

### IN-04: Missing test that one request's key does not work on another request

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/UploadQuotePhotoTests.cs:85`
**Issue:** The "wrong key" case uses a random new key. Nothing creates two requests and posts request A's valid key to request B. The code is correct (the hash is read per request), but this is the exact property that stops a leaked key from working across requests, and a regression such as a cached or global hash lookup would pass every current test.
**Fix:** Add a case to `EveryMissAnswersTheSame404`: create a second request with its own key and post the first request's key to it. Expect the same 404 body.

---

_Reviewed: 2026-11-22T19:30:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
