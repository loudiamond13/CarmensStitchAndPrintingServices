---
phase: 09-order-images-maintenance-jobs
plan: 14
subsystem: images
tags: [upload, body-limit, idempotency, multipart, rate-limit, iis]
requires: [09-01, 09-05, 09-09, 09-12]
provides:
  - "RequestBodyLimitMiddleware after UseRouting with a per-endpoint limit (IRequestSizeLimitMetadata, default 1 MiB)"
  - "RequestSizeLimitMetadataAttribute on UploadOrderImage (10 MiB plus 64 KiB)"
  - "IdempotencyMiddleware: in-memory buffer at the endpoint limit and a part-wise multipart hash (boundary ignored)"
  - "web.config maxAllowedContentLength 11534336"
  - "RateLimitPolicies.ImageUpload (images-upload), section RateLimits:Images, default 30 per 10 minutes per address"
  - "App-wide GlobalLimiter: 2 uploads at once, 4 queued, then 429 (UploadOrderImage only)"
  - "TestingImageStorage.HoldUploadsStepwise and ReleaseNext test seam"
affects: [09-13, 09-15, 09-16, 09-17]
key-files:
  created:
    - src/Csps.Server/Http/RequestSizeLimitMetadataAttribute.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageUploadLimitsTests.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyMultipartTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/ImageUploadRateLimitTests.cs
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Http/RequestBodyLimitMiddleware.cs
    - src/Csps.Server/Security/IdempotencyMiddleware.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Controllers/OrderImagesController.cs
    - src/Csps.Server/web.config
    - src/Csps.Infrastructure/Images/TestingImageStorage.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/Http/RequestBodyLimitTests.cs
    - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.ArchitectureTests/UploadNoDiskTests.cs
    - docs/api/order-images.md
status: complete
commits: 6
plan_head_before: f27ee1493070e68ed51238211092f8ae5f4e9fd9
plan_head_after: ef43e4c659bfc00f86b88c621146f44ee1249944
actuals:
  tokens: 18000
  tasks: 3
  commits: 6
created: 2026-11-03T18:40:00-06:00
updated: 2026-11-03T18:40:00-06:00
---

# Phase 9 Plan 14: Full-size phone photos upload, and a retry never stores a photo twice Summary

*Created: 2026-11-03T18:40:00-06:00 · Updated: 2026-11-03T18:40:00-06:00*

The photo upload route alone now accepts a body of 10 MiB plus 64 KiB, every other route keeps 1 MiB, a retry with the same key replays even when the multipart boundary changed, and the small app pool is guarded by a per-address limit and a two-at-a-time cap.

## Commits

| Hash | Message |
|---|---|
| 2fcac146 | test(09-14): a full-size phone photo must upload while other routes keep 1 MiB (RED) |
| f155f4dd | feat(09-14): let a full-size phone photo reach the upload and keep 1 MiB elsewhere (GREEN) |
| dc689c30 | test(09-14): a retried photo upload with a new boundary must replay, not fail (RED) |
| b88d95b1 | feat(09-14): replay a retried photo upload whatever the multipart boundary (GREEN) |
| 331e9aff | test(09-14): uploads must be throttled per address and capped at two at a time (RED) |
| ef43e4c6 | feat(09-14): throttle photo uploads per address and cap them at two at a time (GREEN) |

## What was done

- **Task 1 (tracer): the body limit.** `RequestBodyLimitMiddleware` moved to just after `UseRouting`. It reads `IRequestSizeLimitMetadata` from the matched endpoint (default 1 MiB) for the Content-Length check and for the server's max-body feature, and exposes `LimitFor(context)` so the idempotency middleware uses the same number. `Upload` carries a 10 MiB plus 64 KiB limit. Kestrel and IIS keep their 1 MiB global limit in `Program.cs` (not changed). `web.config` is 11534336 (11 MiB) and `WebConfigTests` pins it.
- **Task 1: no disk.** The idempotency middleware buffers with `EnableBuffering(limit, limit + 8192)`, so the threshold equals the endpoint limit and nothing spills to a temp file.
- **Task 2: multipart hash.** For `multipart/form-data` with a boundary of 1 to 128 characters, `HashMultipartAsync` walks the buffered body with `MultipartReader`. For each part it adds the length-prefixed name, file name, extended file name and content type, then the part's byte count and a SHA-256 of its bytes (fixed size, so the layout is unambiguous and memory stays flat). The boundary is never hashed. The hash starts with the same length-prefixed target as before, then a `multipart/v1` label. A body that does not parse (no parts, bad headers, more than 32 parts, truncated, over-long boundary, read errors) is rewound and hashed raw exactly as before, so JSON bodies are byte-for-byte unchanged. A counting stream ends the read when the body passes the limit, and the answer is a 413. Anything after the final boundary is read and counted too.
- **Task 3: memory guard.** `RateLimitPolicies.ImageUpload = "images-upload"` with `ImageUploadRateLimit` (section `RateLimits:Images`, default 30 per 10 minutes, same validation as the maintenance rule) is applied to `Upload`. `RateLimiterOptions.GlobalLimiter` gives the endpoint named `UploadOrderImage` one shared `ConcurrencyLimiter` (2 permits, queue 4, oldest first) and every other request `GetNoLimiter`. Rejections reuse the existing 429 writer. Upload rejections carry the UI-SPEC text "Too many uploads right now. Wait a minute, then try again." (the spec marks it "server only"). A full-queue rejection answers `Retry-After: 60`; a per-address rejection answers the window's own remaining wait.
- **Docs.** `docs/api/order-images.md` now states the 10 MiB plus 64 KiB cap, the 413 and 429 rows, the pace rule and "to retry, send the same key and the same file".

## Checks seen

- RED 1: `OrderImageUploadLimitsTests`, `RequestBodyLimitTests`, `WebConfigTests`: total 20, failed 6 (the 8 MB upload and the exact-limit body answered 413; web.config was still 2097152; the unit tests for the endpoint limit failed).
- GREEN 1: same three classes: total 20, failed 0, succeeded 20. With `OrderImagesEndpointTests` and `IdempotencyTests`: total 82, failed 0.
- RED 2: `IdempotencyMultipartTests`: total 7, failed 1 (the new-boundary replay answered 422). The other six are guard tests that passed on arrival (changed bytes, description, file name or part type give 422; invalid multipart and an over-long boundary give 400). `UploadNoDiskTests` guards passed on arrival (the attribute and the buffer threshold were already right after Task 1).
- GREEN 2: `IdempotencyMultipartTests`, `IdempotencyTests`, `IdempotencyGateTests`, `IdempotencyCoverageTests`, `OrderImageUploadLimitsTests`: total 64, failed 0. `UploadNoDiskTests`: total 16, failed 0.
- RED 3: `ImageUploadRateLimitTests`: total 3, failed 2 (no 429 on the 31st upload; no 429 for the seventh at once).
- GREEN 3: `ImageUploadRateLimitTests`, `RateLimitTests`, `RateLimitPartitionTests`, `MaintenanceKeySafetyTests`: total 48, failed 0. `ImageUploadRateLimitTests` plus `IdempotencyMultipartTests` run three times in a row: total 10, failed 0 each time.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output (run before the last commit; no source change after it).
- `dotnet test --project tests/Csps.ArchitectureTests`: total 265, failed 0.
- Full `dotnet test --project tests/Csps.Server.IntegrationTests`, second run (12 minutes): total 1965, failed 2, succeeded 1963. The two failures are `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` (far page of 100 rows: p95 687 ms, limit 300; the default list p95 117 ms, search 249 ms and filter 97 ms in the same run were inside the limit) and `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData`. The first full run showed 3 failed of 1965; its output was cut to the last 40 lines so I only saw the count, not the names. Idempotency, rate-limit, body-limit and order-image suites passed in the second full run.
- Re-run of the two timing classes alone, after the full run: both failed again (5 minutes each) while four other executors were using the same SQL instance and CPU. These tests seed five years of data and measure latency, and this plan changes no list query. This is the known timing flake from the dispatch notes, recorded and not hidden. They should be re-run alone on a quiet machine before the phase is verified.
- `gitleaks protect --staged --no-banner` before every commit: no leaks found.
- Dash check on the diff (no em or en dash added): none found.
- Preflight: PowerShell was not used. `netstat` for 5180, 5115, 7028 and 5199 showed no listener (only three `TIME_WAIT` lines on 5199). Every test ran in the in-memory test server against `CSPS_Test_<guid>` databases; no dev server, Playwright run or fixed port was used.

## Tracer gate

Task 1 is the tracer. Its `<verify>` is automated only, so the gate was the re-run of `OrderImageUploadLimitsTests`, `RequestBodyLimitTests` and `WebConfigTests` after the commit (20 of 20) and before Task 2. No checkpoint was needed. Verified end to end before expanding.

## Deviations from Plan

**1. [Rule 1 - Bug] A metadata-only attribute replaces `[RequestSizeLimit]` on `Upload`.** `[RequestSizeLimit]` also adds a framework filter. The routing middleware already applies `IRequestSizeLimitMetadata` to the server's max-body feature, so the filter is redundant, and by the time the filter runs the idempotency middleware has already read the body, so the feature is read-only and the filter logs a warning on every upload (the test host logged it as a warning for the missing feature). `RequestSizeLimitMetadataAttribute` carries only the metadata. The behavior is what the plan states: only this endpoint raises its limit, through `IRequestSizeLimitMetadata`. A test fails if the `RequestSizeLimitFilter` logs a warning during an 8 MB upload. File: `src/Csps.Server/Http/RequestSizeLimitMetadataAttribute.cs`. Commit f155f4dd.

**2. [Rule 3 - Blocking] Test-infrastructure edits outside the plan's file list.** `tests/Csps.Testing/CspsApiFactory.cs` sets `RateLimits:Images:PermitLimit` to 100000 like the auth limits; `RealLimitsFactory.cs` restores the real 30; `RateLimitTests.LimitedEndpoints` gained the upload row (its completeness test fails otherwise, as in plan 09-12); `TestingImageStorage` gained `HoldUploadsStepwise` and `ReleaseNext` (Debug builds only, `#if CSPS_TESTING`). Commits 331e9aff and ef43e4c6.

**3. [Process] The concurrency test finishes uploads one at a time (found a real defect, see "Deferred issues").** Releasing both in-flight uploads together deadlocked in SQL Server every time (3 of 3 runs). The test now uses `ReleaseNext` so the database steps do not overlap. The finding is recorded below and in the owner backlog, not hidden.

**4. [Process] Several guard tests passed on arrival**, so those tasks have one failing test each for RED (new-boundary replay; the 429s), not one per guard.

**5. The 429 wording and `Retry-After: 60` for a full upload queue are my choice.** The UI-SPEC marks the text "server only" and says "Wait a minute", so `Retry-After: 60` follows it. The per-address window answers its real remaining wait (up to 600 seconds). If you want other numbers, it is one constant in `RateLimitingRegistration.cs`.

## Deferred issues

**Two uploads to different orders that save at the same moment can deadlock in SQL Server (answer 500).** Evidence from the SQL Server `system_health` deadlock report: both transactions run the order photo read in `OrderReader.ReadDetailOnceAsync` (`FROM OrderImages ... INNER JOIN Orders ... ORDER BY Position, Slot`), each already holds an exclusive lock on its own new `PK_OrderImages` row, and the clustered-index scan of the near-empty test table asks for a shared lock on the other's row. On a production-sized table the optimizer probably seeks instead, so the risk is lower there but not zero (a fresh host database is nearly empty). This plan did not cause it and cannot fix it without an index hint, a read-committed-snapshot database setting, or a retry on error 1205. Those are owner decisions (a database setting) or a change to the reader. The new two-at-a-time cap limits how many can overlap. Reproduce: upload to two different orders at the same moment on an almost empty database (before this plan the 1 MiB cap made this hard to trigger with real photos).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: dos-upload-slots | src/Csps.Server/Security/RateLimitingRegistration.cs | The limiter runs before authentication (existing SEC-03 order), so an unauthenticated caller can take a slot or a queue place for the short time the 401 takes. The per-address limit (30 per 10 minutes) applies before authentication as well. A flood from many addresses could make staff see 429 for a moment. No body is read before authentication, so a slot is held for milliseconds. Accepted for now. |

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Deadlock on simultaneous uploads (found by plan 09-14, evidence above): decide how to remove it. Options: (a) turn on read-committed snapshot for the application database (host database setting, so it needs the owner and the hosting checklist); (b) retry the whole upload once when SQL Server reports a deadlock victim (error 1205); (c) change the order photo read so it cannot scan other orders' rows (an index change or a different query shape). My recommendation: (b) first, because it is application code only and keeps the one-save-one-photo rule through the idempotency key. Until then two staff uploading to two orders in the same second may see "Something went wrong" once and must press Try Again (same key, so nothing doubles).
- [ ] Re-run `OrderListTimingTests` and `ExpenseListTimingTests` alone on a quiet machine before verifying Phase 9. Both failed in this plan's runs while four executors shared the machine (far page p95 687 ms against 300 ms); this plan changes no list query.
- [ ] The web "Try Again" for a failed upload must send the same `Idempotency-Key` and the same file (docs/api/order-images.md now says so). Check this when the upload UI plans land. On a 429 the web should show the server's own text (UI-SPEC: "server only").

## Self-Check: PASSED

- Files found: RequestSizeLimitMetadataAttribute.cs, OrderImageUploadLimitsTests.cs, IdempotencyMultipartTests.cs, ImageUploadRateLimitTests.cs, and every modified file listed above.
- Commits 2fcac146, f155f4dd, dc689c30, b88d95b1, 331e9aff and ef43e4c6 are ancestors of HEAD; base f27ee149 is an ancestor of HEAD; `git rev-list --count f27ee149..HEAD` was 6 before this summary commit.
- Acceptance greps: `11534336` in web.config (1), `IRequestSizeLimitMetadata` in RequestBodyLimitMiddleware.cs (1), `MultipartReader` in IdempotencyMiddleware.cs (present), `GlobalLimiter` in RateLimitingRegistration.cs (present), `ImageUpload` in OrderImagesController.cs (present), `UseRouting` before the body-limit registration in Program.cs.
