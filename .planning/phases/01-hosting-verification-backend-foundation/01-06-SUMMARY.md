---
phase: 01-hosting-verification-backend-foundation
plan: 06
subsystem: api
tags: [problem-details, rfc-9457, security-headers, csp, hsts, openapi, scalar, web-config, result-type, tdd]

requires:
  - phase: 01-hosting-verification-backend-foundation
    provides: "Plan 01-02/01-03: Csps.Server composition root with /health, CspsApiFactory.ForDatabase, CspsDatabase class fixture, BCL-only Csps.Domain"
provides:
  - "CspsProblemDetails.Build/Apply/WriteAsync: the one place every ProblemDetails gets a plain-English title, a 32-hex traceId and the fixed 5xx reference text"
  - "PlainEnglish.TitleFor(int) and CorrelationId.For(HttpContext) (Activity W3C trace id)"
  - "ApiRouting.MapApiFallback: anonymous /api/{**path} ProblemDetails 404, never a page"
  - "Csps.Domain.Common: ErrorKind, Error (Validation needs at least one field error), Result, Result<T>"
  - "ResultHttpExtensions.ToHttpResult (both overloads): Validation 400 with ordinal-sorted errors, NotFound 404, Conflict 409, BusinessRule 422, Forbidden 403"
  - "SecurityHeadersMiddleware: strict CSP, nosniff, Referrer-Policy, Permissions-Policy, COOP and HTTPS-only HSTS in OnStarting; Development-only Scalar nonce carve-out"
  - "OpenApiRegistration.AddCspsOpenApi/MapCspsApiDocs: /openapi/v1.json and /scalar in Development only"
  - "src/Csps.Server/web.config: in-process IIS hosting, removeServerHeader, X-Powered-By removed"
affects: [01-07 Serilog trace id must equal the ProblemDetails traceId, 01-08 auth and authorization matrix (401/403 ProblemDetails), phase 2 SPA fallback and http client, every later endpoint]

actuals:
  tokens: 16300
  tasks: 3
  commits: 6
plan_head_before: f83e48f9f88e4b4de4b592968f4c927671ba7c85
plan_head_after: 603731546b271f43f891f5988d376af74352779c

tech-stack:
  added: []
  patterns:
    - "API errors are written with TypedResults.Problem(CspsProblemDetails.Build(...)), so they are application/problem+json whatever the Accept header says"
    - "Expected failures are returned as Result/Result<T> with an Error, and mapped to HTTP in one switch (ResultHttpExtensions); exceptions are only for programming errors"
    - "Response headers are set in Response.OnStarting from the outermost middleware, with the indexer (never Append), so they survive exception-handler clearing and appear once"
    - "Tests for other environments use factory.WithWebHostBuilder(b => b.UseEnvironment(...)); a test-only failing path is added through an IStartupFilter appended after the real pipeline"

key-files:
  created:
    - src/Csps.Server/Http/CorrelationId.cs
    - src/Csps.Server/Http/PlainEnglish.cs
    - src/Csps.Server/Http/CspsProblemDetails.cs
    - src/Csps.Server/Http/ResultHttpExtensions.cs
    - src/Csps.Server/Http/SecurityHeadersMiddleware.cs
    - src/Csps.Server/Endpoints/ApiRouting.cs
    - src/Csps.Server/Composition/OpenApiRegistration.cs
    - src/Csps.Server/web.config
    - src/Csps.Domain/Common/ErrorKind.cs
    - src/Csps.Domain/Common/Error.cs
    - src/Csps.Domain/Common/Result.cs
    - tests/Csps.Domain.UnitTests/Common/ResultTests.cs
    - tests/Csps.Domain.UnitTests/Common/ErrorTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ResultHttpExtensionsTests.cs
    - tests/Csps.Server.IntegrationTests/Http/CspsProblemDetailsTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs
    - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemJson.cs
    - tests/Csps.Server.IntegrationTests/Http/ResultHarness.cs
  modified:
    - src/Csps.Server/Program.cs

key-decisions:
  - "The custom exception handler is registered in every environment, Development included, so an API client never sees exception text; developers read the logs (plan 07) instead of the developer exception page"
  - "For any 5xx, CspsProblemDetails.Apply also clears every extension except traceId (for example a framework 'exception' extension), not only the detail"
  - "Error keeps the PRD name; CA1716 (VB keyword) is suppressed on the type with a justification because the solution is C#-only"
  - "Result factories live on the non-generic Result (Result.Success<T>, Result.Failure<T>), so Result<T> has no static members (CA1000) and only Domain can derive from Result"
  - "The Scalar carve-out CSP only accepts a base64/base64url nonce before putting it into the header; /scalar assets without a nonce get the carve-out with no nonce source"
  - "HTTPS redirection (port 443) is on outside Development and the Testing environment; the Testing name is a literal in Program.cs because Server cannot reference Csps.Testing"

patterns-established:
  - "ProblemJson.ReadAsync(response) asserts problem+json with ShouldNotBeNull before reading; never write ContentType?.MediaType.ShouldBe(...), because the ?. skips the assertion"
  - "SecurityHeadersTests.AssertStrictHeaderSet(response, expectHsts) is the reusable SEC-01 header assertion"

requirements-completed: [FND-05, SEC-01]

coverage:
  - id: D1
    description: "Any unknown /api route (GET/POST/PUT/DELETE on /api, /api/, /api/v1/nope, /api/v1/nope.json) returns a 404 application/problem+json with title \"We couldn't find that.\", status 404 and a 32-hex traceId, also with Accept: text/html, and 10 parallel requests get 10 distinct traceIds"
    requirement: "FND-05"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*ProblemDetailsTests\" (19 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unhandled exception gives a 500 with title \"Something went wrong.\", detail \"Something went wrong. Reference: <traceId>\", no exception text, and the strict CSP still present"
    requirement: "FND-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs#UnhandledExceptionIsGeneric500WithReference"
        status: pass
      - kind: unit
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*CspsProblemDetailsTests\" (20 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Result/Error types: Validation needs at least one field error; wrong accessor throws; Domain stays at 100% line and branch coverage"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Domain.UnitTests --filter-class \"*Common*\" (21 passed)"
        status: pass
      - kind: other
        ref: "coverlet.MTP cobertura run (temporary reference, reverted): Csps.Domain line-rate 1, branch-rate 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Result failures map in one place: Validation 400 with ordinal-sorted errors (messages in insertion order, identical failures serialize identically), NotFound 404, Conflict 409, BusinessRule 422, Forbidden 403, each with the plain-English title, the message as detail and a traceId"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*ResultHttpExtensionsTests\" (8 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every tested response (API 404, /health GET and HEAD, 500) carries the exact SEC-01 header set once each; HSTS only over HTTPS; no Server or X-Powered-By; Production redirects HTTP to https://localhost"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*SecurityHeadersTests\" (6 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "OpenAPI and Scalar are mapped only in Development; Production has no /openapi or /scalar route and answers both with a ProblemDetails 404; no Production response CSP contains unsafe-inline or unsafe-eval; Development /scalar gets a CSP nonce that matches its inline scripts"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*OpenApiExposureTests\" (7 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "web.config hosts in-process with processPath dotnet, removes the Server header and X-Powered-By"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*WebConfigTests\" (3 passed)"
        status: pass
    human_judgment: false
  - id: D8
    description: "In a real browser, https://localhost:7028/scalar renders the API reference with zero CSP violations in the DevTools console (assumption A7: style-src 'unsafe-inline' carve-out)"
    requirement: "SEC-01"
    verification: []
    human_judgment: true
    rationale: "Browser CSP enforcement and Scalar's runtime style injection can only be observed in a real browser console (Task 3 <human-check>, end-of-phase)."

duration: 17min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 06: ProblemDetails Contract, Security Headers and Dev-only API Docs Summary

**Every API error is now an RFC 9457 `application/problem+json` with a plain-English title and the request's 32-hex W3C trace id. Unknown `/api/*` routes answer 404 through an anonymous `/api/{**path}` fallback, and 500s say only "Something went wrong. Reference: <traceId>". Every response carries the strict PRD section 11.3 header set from an outermost `OnStarting` middleware. Result/Error map to HTTP in one switch, and OpenAPI plus Scalar (with a nonce CSP) exist only in Development.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-07T15:22:46Z
- **Completed:** 2026-10-07T15:40:00Z
- **Tasks:** 3 (tracer + 2)
- **Files modified:** 22 (21 new, `Program.cs` changed)

## Accomplishments

- **ProblemDetails pipeline.** Three writers share one helper, `CspsProblemDetails.WriteAsync`, which uses `TypedResults.Problem(Build(...))`:
  - the exception handler (500)
  - status-code pages (empty 404/405 and similar)
  - the `/api/{**path}` fallback

  `AddProblemDetails` also runs `CspsProblemDetails.Apply` on framework-created problems. `traceId` is `Activity.Current.TraceId.ToHexString()`, so it is 32 lowercase hex characters. Assumption A9 is confirmed: ASP.NET Core creates the request `Activity` under TestServer, and the regex `^[0-9a-f]{32}$` held on every request.
- **The `/api` fallback.** `/api` and `/api/` match the catch-all (the plan's open question), so no extra `"/api"` mapping was needed. File-like paths (`/api/v1/nope.json`) match too, and all four methods get 404.
- **Domain `Result`/`Error`.** `Error.Validation` rejects a null field map (`ArgumentNullException`) or an empty one (`ArgumentException`), and every factory rejects a blank code or message. `Result.Error` on a success and `Result<T>.Value` on a failure throw `InvalidOperationException`.
- **`ResultHttpExtensions.ToHttpResult`.** Validation errors are copied into a `SortedDictionary` with `StringComparer.Ordinal`, so the output order is `Zulu`, `alpha`, `zeta`, and each key keeps its messages in insertion order.
- **`SecurityHeadersMiddleware`** is outermost and sets these with the indexer:
  - CSP (verbatim)
  - `nosniff`
  - `strict-origin-when-cross-origin`
  - a `Permissions-Policy` naming eight recognized features
  - COOP `same-origin`
  - HSTS, only when `Request.IsHttps`

  It also removes `Server` and `X-Powered-By`. Assumption A5 is confirmed: the headers survive the exception handler's response clearing, as `UnhandledExceptionIsGeneric500WithReference` shows.
- **Development-only API docs.** OpenAPI and Scalar (`WithNonce().DisableDefaultFonts().DisableTelemetry()`) are mapped only in Development. `/scalar` in Development gets `script-src 'self' 'nonce-<n>'`, and the test checks that this nonce matches every inline `<script>` tag.
- **Transport and hosting.**
  - Kestrel's `AddServerHeader` is false.
  - HTTPS redirection to port 443 is on outside Development and Testing.
  - `web.config` uses in-process hosting with `removeServerHeader="true"` and removes `X-Powered-By`.

## Task Commits

1. **Task 1 (tracer): unknown /api route returns a ProblemDetails 404 with traceId and the strict header set**
   - RED: `5f6c91a` (test)
   - GREEN: `faf30dc` (feat)
2. **Task 2: Result/Error types and the single ProblemDetails mapping**
   - RED: `fd380fe` (test, with compile-only stubs)
   - GREEN: `ece9b3d` (feat)
3. **Task 3: HSTS/HTTPS, server-header removal, web.config, Development-only OpenAPI + Scalar with a nonce CSP**
   - RED: `e57fae0` (test)
   - GREEN: `6037315` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

Every task has a `test(01-06)` RED commit before its `feat(01-06)` GREEN commit. Each RED run used `--report-xunit-junit`, was checked with `gsd check tdd-red-evidence`, and returned `RED_EVIDENCE_OK` (`target_test_failed`, exit 2). Theory targets use the `&quot;`-encoded JUnit name.

- **Task 1 RED:** the target was `UnknownApiRouteIsProblem404(method: "GET", path: "/api/v1/nope")`. It failed with `response.Content.Headers.ContentType should not be null but was`, because the old pipeline returned an empty 404. All 19 tests failed. The first RED attempt failed on a JSON parse instead, because the helper's `ContentType?.MediaType.ShouldBe(...)` skipped the media-type assertion. The helper was fixed before the RED commit, so the recorded RED is an assertion failure.
- **Task 2 RED:** C# needs the types to exist before the tests compile, so the commit carries compile-only stubs. Two records:
  - Domain `ErrorTests.ValidationRequiresAtLeastOneFieldError` failed with `should throw System.ArgumentException but did not`. 15 of 21 tests failed.
  - Server `ResultHttpExtensionsTests.ValidationIs400WithOrdinalSortedErrors` failed with `http.Response.StatusCode should be 400 but was 500`. 7 of 28 tests failed. The 20 `CspsProblemDetailsTests` passed, because they describe Task 1 code.
- **Task 3 RED:** the target was `SecurityHeadersTests.ProductionRedirectsHttpToHttps`, which failed with `should be one of [307, 308] but was 200`. A second record on `OpenApiExposureTests.DevelopmentServesOpenApiAndScalar` failed with `should be HttpStatusCode.OK but was HttpStatusCode.NotFound`. 6 of 16 tests failed: the three WebConfig tests, the two Development docs tests and the redirect test.
- **Tracer gate (auto mode):** after Task 1 GREEN, both Task 1 verify commands were run again. `*ProblemDetailsTests` passed 19/19 and `*SecurityHeadersTests` passed 1/1. The full Server suite passed 28/28 and ArchitectureTests 61/61. Expansion went ahead after that.

## Files Created/Modified

- `src/Csps.Server/Http/CorrelationId.cs`: Activity W3C trace id, falling back to `TraceIdentifier`.
- `src/Csps.Server/Http/PlainEnglish.cs`: the status-to-title table (D-26).
- `src/Csps.Server/Http/CspsProblemDetails.cs`: `Build`, `Apply`, `WriteAsync` and `TraceIdKey`.
- `src/Csps.Server/Http/ResultHttpExtensions.cs`: the one `ErrorKind` to status switch, with ordinal-sorted field errors.
- `src/Csps.Server/Http/SecurityHeadersMiddleware.cs`: the SEC-01 headers and the Development Scalar carve-out.
- `src/Csps.Server/Endpoints/ApiRouting.cs`: `MapApiFallback` (`/api/{**path}`, anonymous, excluded from OpenAPI).
- `src/Csps.Server/Composition/OpenApiRegistration.cs`: `AddCspsOpenApi` and `MapCspsApiDocs`, both Development only.
- `src/Csps.Server/web.config`: IIS in-process hosting and banner removal.
- `src/Csps.Server/Program.cs`: Kestrel banner off, HTTPS redirection, ProblemDetails, header middleware, exception handler, status-code pages, fallback and docs.
- `src/Csps.Domain/Common/{ErrorKind,Error,Result}.cs`: the typed outcomes from PRD section 3.3.
- Tests:
  - `ResultTests`, `ErrorTests` (Domain)
  - `ProblemDetailsTests`, `ResultHttpExtensionsTests`, `CspsProblemDetailsTests`, `SecurityHeadersTests`, `OpenApiExposureTests`, `WebConfigTests`
  - helpers `ProblemJson` and `ResultHarness`

## Verification

- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`, run after a clean preflight: 363 passed, 0 failed.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- All the plan's per-class verify commands passed:
  - ProblemDetails 19
  - SecurityHeaders 6
  - Domain `*Common*` 21
  - ResultHttpExtensions 8
  - CspsProblemDetails 20
  - OpenApiExposure 7
  - WebConfig 3
- All acceptance greps passed: `frame-ancestors 'none'` and `OnStarting`, `/api/{**path}`, `We couldn't find that.`, `Something went wrong. Reference:` and `StringComparer.Ordinal`, `AddServerHeader = false`, `DisableDefaultFonts`, `hostingModel="inprocess"`.
- Domain coverage, from a temporary `coverlet.MTP` reference that was reverted afterwards: `Csps.Domain` line-rate 1 and branch-rate 1, with `Error`, `Result` and `Result<T>` each at 1/1.

## Decisions Made

- **Exception handler everywhere:** the custom 500 handler is also used in Development, so the API never returns exception text in any environment. The plan allowed the developer page, but one code path is simpler and safer. Logs (plan 07) carry the details.
- **5xx extensions cleared:** `Apply` keeps only `traceId` on a 5xx. A framework `exception` extension cannot leak through (CWE-209).
- **CA1716 on `Error`:** suppressed on the type with a justification instead of renaming, so the PRD and plan name is kept.
- **Result factories on the base type:** `Result.Success<T>` and `Result.Failure<T>` live on the base type, which avoids static members on a generic type. The constructor is `private protected`.
- **Nonce check:** the Scalar nonce goes into the CSP only if it contains base64/base64url characters, so no header injection is possible.
- **Fallback hidden from docs:** the `/api` fallback is `.ExcludeFromDescription()`, so it never appears in the OpenAPI document.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added an end-to-end 500 test through the real pipeline**
- **Found during:** Task 1
- **Issue:** the plan's tests check 500 text only through `Build`/`Apply`. Research assumption A5 (headers survive the exception handler) and threat T-01-18 need a real 500 that goes through the pipeline.
- **Fix:** added `ProblemDetailsTests.UnhandledExceptionIsGeneric500WithReference`. It uses a test-only `IStartupFilter` that throws `InvalidOperationException("SELECT secret FROM Users")` after the real pipeline. The test asserts the generic title, the reference detail, that neither "Exception" nor the secret appears in the body, and that the strict CSP is present.
- **Files modified:** tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
- **Committed in:** `5f6c91a` / `faf30dc`

**2. [Rule 1 - Bug] Null-conditional assertions that silently skip**
- **Found during:** Task 1 RED and Task 3 RED
- **Issue:** `x?.Value.ShouldBe(...)` does not assert at all when `x` is null. This hid a missing Content-Type in the first Task 1 RED, and would have hidden missing web.config attributes.
- **Fix:** `ProblemJson.ReadAsync` and `WebConfigTests` use `ShouldNotBeNull()` first. The same pattern in plan 01-03's Health tests is out of scope and is logged in `deferred-items.md`.
- **Files modified:** tests/Csps.Server.IntegrationTests/Http/ProblemJson.cs, tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
- **Committed in:** `5f6c91a`, `e57fae0`

**3. [Rule 3 - Blocking] CA1716 on the `Error` type**
- **Found during:** Task 2 RED build
- **Issue:** `Error` is a VB keyword, and warnings are errors.
- **Fix:** a targeted `[SuppressMessage]` with a justification on the type.
- **Files modified:** src/Csps.Domain/Common/Error.cs
- **Committed in:** `fd380fe`

**4. [Process] Task 3 RED target**
- **Issue:** the plan named `HstsOnlyOverHttps` or `ProductionHasNoApiDocs` as the RED target. Both already passed, because Task 1 already emits HSTS on HTTPS only and nothing maps docs in Production.
- **Fix:** `ProductionRedirectsHttpToHttps` (and `DevelopmentServesOpenApiAndScalar`) were the failing targets instead. The two characterization tests stay as regression guards.

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3) plus 1 RED-target process note.
**Impact on plan:** all were needed for correct tests or a clean build. No scope creep, and no new packages.

## Issues Encountered

- **Temporary coverage reference:** an `sed` edit to add the coverage reference silently matched nothing, because of the backslashes in the csproj. It was redone with the Edit tool. The csproj and `packages.lock.json` were then restored with `git checkout --` on those two files only.

## Threat Model Coverage

- **T-01-18 (information disclosure, 500s):** the custom 500 writer returns fixed text plus `traceId`. `Apply` overrides any 5xx detail and extensions. `UnhandledExceptionIsGeneric500WithReference`, `FiveHundredHidesDetail` and `ApplyHidesAFrameworkFiveHundred` prove it.
- **T-01-19 (tampering, headers):** the strict CSP has no unsafe-inline or unsafe-eval outside Development `/scalar`, and the headers are set in `OnStarting` on every response. `AssertStrictHeaderSet` on 404, 500, GET and HEAD `/health`, and `NoUnsafeInlineOutsideDevScalar` prove it.
- **T-01-20 (docs exposure):** the docs are registered and mapped only in Development. `ProductionHasNoApiDocs` checks EndpointDataSource and both paths.
- **T-01-21 (transport):** HSTS is sent on HTTPS, the CSP includes `upgrade-insecure-requests`, and HTTPS redirection is on outside Development and Testing. `HstsOnlyOverHttps` and `ProductionRedirectsHttpToHttps` prove it.
- **T-01-22 (banners):** Kestrel `AddServerHeader = false`, plus the web.config removals checked by `WebConfigTests`.
- **T-01-SC (supply chain):** no packages were added. OpenApi and Scalar were already pinned and approved in plan 01.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **End-of-phase human check (Task 3 `<human-check>`, assumption A7):**
  1. Run preflight.
  2. Run `dotnet run --project src/Csps.Server --launch-profile https`.
  3. Open https://localhost:7028/scalar in Chrome.
  4. Confirm the reference renders and the DevTools console shows zero CSP violations.
  5. Stop the server.

  If no violation appears without `'unsafe-inline'`, tighten the carve-out.
- **Plan 07 (Serilog):** must log the same 32-hex trace id that `CorrelationId.For` returns (A9).
- **Plan 08 (auth):** its 401/403 responses will become ProblemDetails automatically, through status-code pages and `Apply`. Note that the `/api/{**path}` fallback is anonymous. A wrong method on a known API route answers 404, not 405 (A4).
- **Phase 2:** must add the SPA fallback and anonymous static assets. Unknown non-API paths currently get a ProblemDetails 404.
- No blockers.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 21 created files and the modified `Program.cs` exist on disk.
- Commits `5f6c91a`, `faf30dc`, `fd380fe`, `ece9b3d`, `e57fae0` and `6037315` exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- The ledger count (`f83e48f..HEAD`) is 6, which matches `actuals.commits`.
