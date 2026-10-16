---
phase: 04-identity-authentication
plan: 07
subsystem: api
tags: [controllers, problem-details, error-contract, request-limits, sec-03, auth-01]
status: complete
created: "2026-10-14T20:58:00-05:00"
updated: "2026-10-14T20:58:00-05:00"

requires: ["04-02"]
provides:
  - "SiteSettingsController: first [ApiController], Staff policy, same responses as the old Minimal API endpoint"
  - "AddControllers with SuppressModelStateInvalidFilter and MapControllers before MapSpaHost"
  - "ErrorKind.Unauthenticated (401) and ErrorKind.TooManyRequests (429), Error.Unauthenticated, Error.TooManyRequests, Error.RetryAfter"
  - "Retry-After in whole seconds (rounded up, at least 1) on 429"
  - "ProblemDetails extension `code` on every 4xx built from an Error; web ProblemDetails.code and HttpError.code"
  - "RequestBodyLimitMiddleware.MaxBytes (1,048,576), 413 ProblemDetails, Kestrel + IIS in-process + web.config requestLimits"
  - "ListQueryLimits and ListQueryRules.PageSize / SearchText (100 / 100 UTF-16 code units)"
affects: [04-08, 04-11, 04-12, 04-15, 04-16, 04-24, 04-32]

requirements-completed: []

actuals:
  tokens: 21000
  tasks: 3
  commits: 6
plan_head_before: b1021aa017f5d247564f5bf788cf2a25dffc5ab3
plan_head_after: 5ade1f0a608e029690e759c50fde76466f0a234f

tech-stack:
  added: []
  patterns:
    - "Controller actions return Task<IResult> through the existing ToHttpResult, so the one error switch stays the only mapping"
    - "Machine code is an extension on 4xx only; CspsProblemDetails.Apply still clears extensions for 5xx"
    - "Body limit enforced at three layers: middleware (declared length), server max-body feature, IIS requestFiltering"

key-files:
  created:
    - src/Csps.Server/Controllers/SiteSettingsController.cs
    - src/Csps.Server/Http/RequestBodyLimitMiddleware.cs
    - src/Csps.Application/Common/ListQueryRules.cs
    - tests/Csps.Server.IntegrationTests/Http/RequestBodyLimitTests.cs
    - tests/Csps.Application.UnitTests/Common/ListQueryRulesTests.cs
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/web.config
    - src/Csps.Server/Http/CspsProblemDetails.cs
    - src/Csps.Server/Http/ResultHttpExtensions.cs
    - src/Csps.Server/Http/PlainEnglish.cs
    - src/Csps.Domain/Common/Error.cs
    - src/Csps.Domain/Common/ErrorKind.cs
    - web/src/core/api/http/HttpError.ts
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
  deleted:
    - src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs

key-decisions:
  - "A controller action returning IResult through ToHttpResult works as-is (research assumption A2 proven by the unchanged SiteSettingsEndpointTests and matrix rows)"
  - "[Produces(\"application/json\")] on the controller keeps the OpenAPI contract JSON-only; without it MVC adds text/json and text/plain response types"
  - "The `code` extension is added in CspsProblemDetails.Build after Apply and only below 500, so a 5xx can never carry a code even if one is passed"
  - "Retry-After is set by ResultHttpExtensions (not the Error) so the only HTTP rounding rule lives in the one mapping switch"
  - "A declared Content-Length over the limit is refused by the middleware; bodies without a length are capped through IHttpMaxRequestBodySizeFeature when the server exposes it and it is not read-only"
---

# Phase 4 Plan 7: HTTP Ground for Phase 4 (Controllers, 401/429 Contract, SEC-03 Limits) Summary

`GET /api/v1/site-settings` is now served by the first `[ApiController]`, and the error contract, request-body limit and list caps that every later Phase 4 endpoint relies on are in place and tested.

## What was built

- **Controllers (owner rule 2026-10-07):** `SiteSettingsController` (`[Route("api/v1/site-settings")]`, `[Authorize(Policy = Policies.Staff)]`, one thin `[HttpGet]` action named `GetSiteSettings`). `Program.cs` calls `AddControllers().ConfigureApiBehaviorOptions(SuppressModelStateInvalidFilter = true)` and `MapControllers()` before `MapSpaHost()`. `SiteSettingsEndpoints.cs` is deleted. Responses are unchanged: 401 anonymous, 200 for Admin and Manager, same body, same matrix key `GET /api/v1/site-settings`. `AuthorizationCoverage.KeysOf` now adds the leading slash that controller `RawText` lacks and leaves patterns starting with `/` or `{` alone.
- **Error contract (AUTH-01):** `ErrorKind.Unauthenticated` maps to 401 (no `WWW-Authenticate`), `ErrorKind.TooManyRequests` to 429. `Error.TooManyRequests(code, message, retryAfter?)` rejects zero or negative waits. A 429 with a wait sends `Retry-After` as whole seconds, rounded up, never below 1 (41.2 s gives 42, 0.3 s gives 1). Every 4xx ProblemDetails built from an `Error` carries `code`; 5xx bodies keep only the reference text. The web `ProblemDetails` and `HttpError` expose `code`.
- **SEC-03 limits:** `RequestBodyLimitMiddleware` (right after `SecurityHeadersMiddleware`) answers a declared body of 1,048,577 bytes or more with a 413 ProblemDetails ("The request is too large.") before routing; exactly 1,048,576 passes. The same value is set on Kestrel, `IISServerOptions` and `web.config` `requestLimits maxAllowedContentLength`. `ListQueryLimits` and `ListQueryRules.PageSize()` / `SearchText()` cap page size at 100 and search text at 100 UTF-16 code units (50 emoji pass, 51 fail), with the plan's messages. No list endpoint uses them yet.

## OpenAPI diff summary

Only the site-settings operation changed: tag `SiteSettingsEndpoints` became `SiteSettings`, an operation `summary` ("Returns the site settings.") was added, and the 200 description is now "The settings, or the failure as ProblemDetails." (taken from the XML doc `returns`). The response schema is still `SiteSettingsDto`, so `api.generated.ts` changed by two lines (summary and description) and the type name is untouched. `tools/openapi-gen run check` passes.

## Verification

- `dotnet test --solution Csps.slnx`: 1163 passed, 0 failed (Domain 576, Server integration 325, Application 16 in this project's run, Infrastructure, Architecture). `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `npm --prefix web run verify` passes (typecheck, eslint, prettier, coverage, bundle budgets, license gate); `vitest run --coverage` exits 0 with the core/api thresholds (100%) met.
- Tracer gate (interactive, end-of-phase, automated-only verify): the Authorization, SiteSettingsEndpointTests, `openapi-gen check` and typecheck commands were re-run after the commit and passed before Task 2 started.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing web test and preview fixtures built `ProblemDetails` object literals**
- **Found during:** Task 2 (typecheck after adding the required `code` member)
- **Issue:** `ProblemDetails.code` is a required key (`string | undefined`), so six fixtures that build the literal no longer compiled.
- **Fix:** added `code: undefined` to each fixture.
- **Files modified:** `web/src/components/overlays/ConfirmDialog.test.tsx`, `web/src/components/states/ErrorState.test.tsx`, `web/src/lib/forms/useSubmission.test.tsx`, `web/src/utils/describeHttpError.test.ts`, `web/src/dev/previews/FailedConfirmDialog.tsx`, `web/src/dev/previews/TracedErrorState.tsx`
- **Commit:** dfa19a2

**2. [Rule 1 - Bug] Controller response advertised text/json and text/plain**
- **Found during:** Task 1 (OpenAPI snapshot diff)
- **Issue:** MVC adds extra response content types to the 200 response, which would have changed the contract for no reason.
- **Fix:** `[Produces("application/json")]` on the controller.
- **Files modified:** `src/Csps.Server/Controllers/SiteSettingsController.cs`
- **Commit:** bba49cf

**3. [Rule 1 - Bug] Emoji literal in the search-cap test**
- **Found during:** Task 3 (after the RED commit)
- **Issue:** a raw emoji in the C# source depends on file encoding; the RED commit carried it.
- **Fix:** replaced with the `\U0001F600` escape in the GREEN commit.
- **Files modified:** `tests/Csps.Application.UnitTests/Common/ListQueryRulesTests.cs`
- **Commit:** 5ade1f0

The plan said to note the "uploads raise it per endpoint" point in the Phase 3 checklist in plan 04-32; that is left to 04-32 as written.

## Known Stubs

None. `ListQueryRules` has no caller yet by design (later list endpoints in later phases use it); that is a planned unused utility, not a stub.

## Threat Flags

None. The controller keeps the Staff policy (T-04-20), the body limit covers all three layers (T-04-18), the one mapping switch emits `code` on 4xx only (T-04-19), and the list caps exist for later endpoints (T-04-21).

## Commits

- edae4c8 test(04-07): matrix keys for controller routes (RED)
- bba49cf feat(04-07): serve site settings from the first controller (owner controller rule)
- a308f1d test(04-07): 401/429 kinds, Retry-After and the problem code (RED)
- dfa19a2 feat(04-07): 401 and 429 results with Retry-After and machine codes (AUTH-01, SEC-03)
- 03ff7df test(04-07): 1 MB body limit and list caps (RED)
- 5ade1f0 feat(04-07): 1 MB body limit and shared list caps (SEC-03)

## Self-Check: PASSED
