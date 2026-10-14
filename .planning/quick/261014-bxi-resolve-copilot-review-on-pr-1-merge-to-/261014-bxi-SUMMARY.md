---
quick_id: 261014-bxi
mode: quick
status: complete
created: 2026-10-14T08:43:22-05:00
updated: 2026-10-14T08:43:22-05:00
subsystem: server (logging, health, http), docs
tags: [copilot-review, pr-1, security, health, correlation-id]
key-files:
  modified:
    - src/Csps.Server/Logging/SensitiveDataMasking.cs
    - src/Csps.Server/Http/CorrelationId.cs
    - src/Csps.Server/Endpoints/HealthEndpoint.cs
    - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
    - tests/Csps.Server.IntegrationTests/Http/CspsProblemDetailsTests.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverageTests.cs
    - CLAUDE.md
decisions:
  - "/health is restricted to GET and HEAD by HttpMethodMetadata. Other methods get the normal unserved-request answer (anonymous 401, signed-in 404), not 405 (research A4)."
  - "The fallback correlation id is a random W3C trace id cached in HttpContext.Items under a private object key."
metrics:
  duration: ~7min
  completed: 2026-10-14
actuals:
  tasks: 2
  commits: 4
plan_head_before: ef76680221119fd736dc38646ad18e9700ca656d
plan_head_after: 1dfb873135e1c265b840e8c24b2b253596b6614a
---

# Quick 261014-bxi: Resolve Copilot review on PR #1, Tasks 1-2 Summary

This change fixes 4 of the Copilot findings on PR #1: logs now mask Identity `PasswordHash`/`SecurityStamp`, `/health` accepts only GET and HEAD, the fallback correlation id is a stable W3C id, and the `ContentType` assertions can no longer skip. CLAUDE.md now gives the 8-month audit retention (D-32). Task 3 (GitHub) is left to the orchestrator.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | e7451c4 | fix(quick-261014-bxi): mask Identity PasswordHash and SecurityStamp in logs |
| 1 | 03d4bcc | fix(quick-261014-bxi): W3C fallback correlation id when no Activity exists |
| 1 | 9bb1c9c | fix(quick-261014-bxi): restrict /health to GET and HEAD |
| 2 | 1dfb873 | docs(quick-261014-bxi): CLAUDE.md audit retention is 8 months (D-32) |

## What changed

- **Masking (finding 1):** `PasswordHash` and `SecurityStamp` are added to the exact-name set. The XML doc now says why they need exact names. New theory cases cover `PasswordHash`, `passwordhash` and `SecurityStamp`.
- **Correlation id (finding 3):** with no `Activity`, `CorrelationId.For` now returns `ActivityTraceId.CreateRandom().ToHexString()`, created once per request and cached in `HttpContext.Items` under a private `object` key. The old `fallback-id` test now asserts 32 lowercase hex, not all zeros, the same value across two calls, and a different value for another request.
- **Health methods (finding 2):** `MapCspsHealth` adds `.WithMetadata(new HttpMethodMetadata([GET, HEAD]))`. `AuthorizationCoverage.KeysOf` builds one key per `IHttpMethodMetadata` method, so the matrix and allow-list now hold `GET /health` and `HEAD /health` instead of `* /health`. The synthetic coverage tests use the explicit keys too, and `* /api/{**path}` keeps the star-key case covered.
- **ContentType assertions (findings 5, 6):** both `ContentType?.MediaType.ShouldBe(` uses in `tests/` (HealthEndpointTests, HealthEndpointFailureTests) became `ContentType.ShouldNotBeNull().MediaType.ShouldBe(`. A grep for `ContentType?.` in tests/ (bin/obj excluded) now finds nothing.
- **Docs (finding 0):** in root CLAUDE.md, the Audit/logs bullet now reads "8-month audit retention (D-32)", and `Updated:` is 2026-10-14T08:43:04-05:00. The audit trigger and index comments already use 8 months.

## Deviations from Plan

**1. [Rule 1 - Real behavior differs from the expected 405] Other methods on /health return 401 or 404, not 405**
- **Found during:** Task 1 (green phase)
- **Issue:** the planned test expected `POST /health` to return 405. What actually happens:
  - Anonymous callers get **401**. ASP.NET's 405 endpoint has no `[AllowAnonymous]`, so the default-deny fallback policy answers first.
  - Signed-in callers get **404**. The SPA's any-method `{*path:file}` fallback shares the routing node, so `HttpMethodMatcherPolicy` never creates a 405 endpoint, and the `file` constraint then rejects `/health`.
  - This is the project's documented behavior for unserved methods: research A3/A4, and `UnservedMethodOnAPagePathIsChallenged` (POST `/products` gives 401).
- **Fix:** the test asserts the real behavior. `OtherMethodsNeverRunTheChecks` covers POST/PUT/DELETE for anonymous (401) and Admin (404) callers. The response must be `application/problem+json`, and the body must contain neither "Healthy" nor "checks". A mutation check confirmed the test is meaningful: with the method metadata removed, all 6 cases fail with 200 because the checks ran.
- **Not done:** getting a true 405 would mean restructuring the SPA file fallback, or exempting the routing 405 endpoint from default deny. That is an architecture change outside this quick task. The HealthEndpoint XML doc and the matrix comment describe the actual behavior.
- **Commit:** 9bb1c9c

## Verification

- `dotnet build Csps.slnx --no-incremental`: Build succeeded, **0 warnings, 0 errors**.
- Red phase: 8 new or changed tests failed as expected before the fix (3 masking, 1 correlation, 3 health methods, 1 matrix coverage).
- `dotnet test --solution Csps.slnx` with `CSPS_TEST_SQL=localdb` (set for that one process; preflight clean): **920 total, 920 passed, 0 failed, 0 skipped**.
  - Csps.Server.IntegrationTests alone: **287 total, 287 passed, 0 failed, 0 skipped**.
  - There is no separate Csps.Server unit-test project. The Server tests are all in Csps.Server.IntegrationTests.

## Known Stubs

None.

## Self-Check: PASSED

- The 10 modified files exist and are committed.
- Commits e7451c4, 03d4bcc, 9bb1c9c and 1dfb873 are present on `gsd/phase-2-web-foundation-design-system`.
