---
phase: 01-hosting-verification-backend-foundation
plan: 08
subsystem: auth
tags: [jwt, jwtbearer, authorization, default-deny, fallback-policy, authorization-matrix, problem-details, user-secrets, nsubstitute, tdd]

requires:
  - phase: 01-hosting-verification-backend-foundation
    provides: "Plan 01-06: CspsProblemDetails, status-code pages, ResultHttpExtensions.ToHttpResult, SecurityHeadersMiddleware, /api/{**path} fallback; plan 01-07: Serilog request logging, HttpRequestContext reading the raw sub claim; plan 01-03/01-04: ISiteSettingsReader (cached), CspsDatabase fixture, CspsApiFactory.ForDatabase"
provides:
  - "Csps.Application.Security.Policies (Staff, Manager) and Roles (Admin, Manager)"
  - "GetSiteSettingsHandler.HandleAsync(CancellationToken) -> Result<SiteSettingsDto>; SiteSettingsDto.From(SiteSettingsSnapshot)"
  - "JwtOptions (Jwt:Issuer, Jwt:Audience, base64 Jwt:SigningKey >= 32 bytes) validated on start"
  - "SecurityRegistration.AddCspsSecurity: JwtBearer default scheme (HS256 only, 30 s skew, MapInboundClaims false, bare Bearer challenge), fallback RequireAuthenticatedUser, named Staff and Manager policies"
  - "ApplicationRegistration.AddCspsApplication; SiteSettingsEndpoints.MapSiteSettings: GET /api/v1/site-settings in a Staff group"
  - "UserSecretsId 7d33a131-9aea-4f9c-90eb-213d2b59cbee in Csps.Server.csproj; tools/scripts/Initialize-DevSecrets.ps1 (Jwt:SigningKey)"
  - "Test infrastructure: TestJwt, TestTokens.For/Expired/SignedWithOtherKey/WithoutSignature/WithIssuerAndAudience, ApiRequests, AuthorizationCoverage.FindViolations, AuthorizationMatrix (MatrixRow, Caller, Rows, AnonymousAllowList)"
  - "New test project tests/Csps.Application.UnitTests (NSubstitute)"
affects: [01-09 audit trail (user id from the sub claim), 01-10 Data Protection (extends Initialize-DevSecrets.ps1), phase 2 SPA host must be mapped anonymously and allow-listed, phase 4 token issuance and the active-session requirement, every later endpoint (matrix row + Policies constant)]

actuals:
  tokens: 20500
  tasks: 3
  commits: 6
plan_head_before: 3c60bc39663f88de85dfbd6d055a5409748ee899
plan_head_after: ebe3e12af6bc237fe927f06155c9b637dfe4ead8

tech-stack:
  added: []
  patterns:
    - "Every endpoint is default-deny: anonymous only with AllowAnonymous plus an AuthorizationMatrix.AnonymousAllowList entry, otherwise RequireAuthorization(Policies.X); every endpoint needs an AuthorizationMatrix row or the test run fails"
    - "Authenticated endpoints live in a MapGroup with RequireAuthorization(policy); a group is never AllowAnonymous"
    - "Tests call protected endpoints with real HS256 tokens from TestTokens and ApiRequests.Get(path, token, accept)"
    - "Use cases: one sealed handler class with HandleAsync(CancellationToken) returning Result<T>, registered in AddCspsApplication; endpoint delegates are named static methods that return ToHttpResult(...)"
    - "Application unit tests arrange NSubstitute ValueTask returns through one helper with a justified CA2012 pragma"

key-files:
  created:
    - src/Csps.Application/Security/Policies.cs
    - src/Csps.Application/Security/Roles.cs
    - src/Csps.Application/Content/GetSiteSettingsHandler.cs
    - src/Csps.Application/Content/SiteSettingsDto.cs
    - src/Csps.Server/Composition/JwtOptions.cs
    - src/Csps.Server/Composition/SecurityRegistration.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs
    - tests/Csps.Testing/TestJwt.cs
    - tests/Csps.Testing/TestTokens.cs
    - tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj
    - tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ApiRequests.cs
    - tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverage.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverageTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs
    - tools/scripts/Initialize-DevSecrets.ps1
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Csps.Server.csproj
    - src/Csps.Server/appsettings.json
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
    - Csps.slnx

key-decisions:
  - "The JWT challenge is a bare WWW-Authenticate: Bearer (IncludeErrorDetails = false), so a rejected token never learns why (CWE-209)"
  - "Test JWT keys are 48-byte SHA-384 digests of fixed labels, computed in-process: constant across runs, but no key literal sits in git"
  - "JwtOptions failure messages are constants that never contain the configured value; the key is validated as base64 of at least 32 bytes"
  - "The coverage rule treats AllowAnonymous as winning over any policy (it must then be allow-listed), keys multi-method endpoints per method, and also reports stale allow-list entries"
  - "Unknown non-API paths now answer 401 to anonymous callers through the fallback policy (assumption A3 confirmed); Phase 2 must map the SPA host anonymously"
  - "The dev signing key lives in a new user-secrets store (UserSecretsId 7d33a131-...); the older unrelated store on this machine was left alone"

patterns-established:
  - "AuthorizationMatrix is the checked-in contract: add a MatrixRow (exact status per caller) for every new endpoint"
  - "Startup fail-fast is proven with Should.Throw<OptionsValidationException>(() => factory.CreateClient()) on a WithWebHostBuilder(UseSetting(...)) factory"
  - "500-path tests swap a port for a throwing fake via ConfigureTestServices under the Production environment"

requirements-completed: [SEC-02, FND-05, SEC-01]

coverage:
  - id: D1
    description: "GET /api/v1/site-settings returns 200 application/json with exactly the nine DTO fields (seeded businessName, Asia/Manila, PHP, en-PH, 8-byte base64 rowVersion) for Admin and Manager tokens, and a 401 ProblemDetails 'Please sign in to continue.' with traceId for anonymous callers"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*SiteSettingsEndpointTests\" (3 passed)"
        status: pass
      - kind: unit
        ref: "dotnet test --project tests/Csps.Application.UnitTests (4 passed: MapsSnapshotToDto, PassesTheCancellationTokenToTheReader, ReaderFailurePropagates, DtoFromRejectsNull)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Default-deny is proven by discovery: every RouteEndpoint must be allow-listed anonymous or carry a Policies constant, and must have a matrix row; synthetic endpoints prove each gap is reported; a temporary GET /api/v1/probe with no policy failed DiscoveredEndpointsAreFullyCovered"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*AuthorizationCoverageTests\" (12 passed) and AuthorizationMatrixTests#DiscoveredEndpointsAreFullyCovered"
        status: pass
    human_judgment: false
  - id: D3
    description: "The matrix answers each caller with the exact status using real HS256 tokens: * /health 200/200/200, * /api/{**path} 404/404/404, GET /api/v1/site-settings 401/200/200; 36 interleaved parallel calls each get their own row's status (concurrency backstop)"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*AuthorizationMatrixTests\" (11 passed: 9 matrix cases, discovery, parallel)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rejected tokens: unknown role gets 403 'You don't have access to this.'; expired, foreign-key, alg none, wrong issuer and wrong audience get 401 with a bare Bearer challenge; the clock skew is 30 s; 401/403 stay problem+json with Accept: text/html; an unknown non-API path challenges anonymous callers"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs (UnknownRoleGets403Problem, ExpiredOrForeignTokensGet401 x5, ClockSkewIsThirtySeconds x2, HtmlAcceptStillProblemJson x2, UnknownNonApiPathIsChallenged)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A handler exception under Production is a 500 with detail 'Something went wrong. Reference: <traceId>' and no secret or exception text; 401, 403, 404, 500 and 503 responses all carry the full SEC-01 header set"
    requirement: "FND-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs#HandlerExceptionIs500WithReference and ErrorResponsesCarryHeaders x5"
        status: pass
    human_judgment: false
  - id: D6
    description: "The API refuses to start when Jwt:SigningKey is empty, malformed or under 32 bytes, or Jwt:Issuer/Jwt:Audience is empty (OptionsValidationException, value never in the message); a 32-byte key starts"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs (MissingOrShortSigningKeyFailsStartup x4, MissingIssuerOrAudienceFailsStartup x2, ThirtyTwoByteSigningKeyStarts)"
        status: pass
    human_judgment: false
  - id: D7
    description: "tools/scripts/Initialize-DevSecrets.ps1 creates a 48-byte Jwt:SigningKey in this project's user-secrets once, never changes it on later runs, and never prints it"
    verification:
      - kind: other
        ref: "powershell -File tools/scripts/Initialize-DevSecrets.ps1 (twice) && dotnet user-secrets list --project src/Csps.Server | grep -q '^Jwt:SigningKey = '; value hash identical before and after a third run; decoded length 48"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 08: Default-Deny Authorization, JWT Validation and the Site-Settings Endpoint Summary

**The API now validates HS256 access tokens (issuer, audience, lifetime with a 30 s skew, signature, HS256 only) and denies by default: a fallback policy requires a signed-in user, and the named `Staff` and `Manager` policies guard real endpoints. `GET /api/v1/site-settings` is the first protected endpoint. A discovery test fails the run when any endpoint lacks an allow-listed `AllowAnonymous` or a `Policies` constant, or lacks a matrix row. The checked-in matrix runs every row for Anonymous, Admin and Manager with real tokens. Every 401, 403 and 500 is a ProblemDetails with the full header set and no internals, the API refuses to start without valid JWT settings, and one idempotent script creates the dev signing key in user-secrets.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-07T16:24:29Z
- **Completed:** 2026-10-07T16:41:03Z
- **Tasks:** 3 (tracer + 2)
- **Files modified:** 26 (20 new, 6 changed)

## Accomplishments

- **JWT validation (T-01-30).** `AddCspsSecurity` registers JwtBearer as the default scheme and configures it lazily from `JwtOptions`:
  - `MapInboundClaims = false`, `RoleClaimType "role"`, `NameClaimType "sub"`
  - issuer, audience, lifetime (expiry required) and signing-key validation on
  - `ValidAlgorithms` HS256 only, signed tokens required
  - `ClockSkew` 30 s
  - `IncludeErrorDetails = false`, so the challenge is a bare `Bearer`
- **Fail-fast settings (T-01-31).** `JwtOptions` is bound from `Jwt` and validated on start: non-empty issuer and audience, and a signing key that is base64 of at least 32 bytes. The messages never contain the value. `appsettings.json` holds only issuer `csps` and audience `csps-api`.
- **Default deny (T-01-28, T-01-29).** The fallback policy is `RequireAuthenticatedUser`. `Policies.Staff` is Admin or Manager, and `Policies.Manager` is Manager only. `UseAuthentication`/`UseAuthorization` sit after request logging and inside status-code pages, so empty 401/403 responses become ProblemDetails.
- **The protected endpoint (D-29).**
  - `GetSiteSettingsHandler` reads the cached `ISiteSettingsReader` and returns `Result<SiteSettingsDto>`, mapped manually by `SiteSettingsDto.From`.
  - `MapSiteSettings` puts `GET /site-settings` in an `/api/v1` group with `RequireAuthorization(Policies.Staff)`.
  - The Server never touches `DbContext`; the architecture tests still pass.
- **Discovery-driven coverage (SEC-02).**
  - `AuthorizationCoverage.FindViolations` keys endpoints as `"{METHOD|*} {RawText}"` and requires `IAllowAnonymous` plus an allow-list entry, or a `Policies` constant read by reflection.
  - It also reports missing matrix rows, orphan rows and stale allow-list entries.
  - Synthetic `RouteEndpointBuilder` endpoints prove each failure.
- **The matrix.**
  - `* /health` 200/200/200
  - `* /api/{**path}` 404/404/404
  - `GET /api/v1/site-settings` 401/200/200

  All 9 cases use real tokens. A parallel run of 36 interleaved calls proves that per-request authorization keeps no shared state.
- **Error paths (FND-05, SEC-01, D-27).**
  - An unknown role gets 403.
  - Expired, foreign-key, unsigned, wrong-issuer and wrong-audience tokens get 401.
  - `Accept: text/html` still gets problem+json.
  - A Production handler exception is a generic 500 with a reference.
  - 401/403/404/500/503 all carry the header set.
  - Unknown non-API paths are challenged (A3).
- **Dev secrets.** `Initialize-DevSecrets.ps1` creates `Jwt:SigningKey` (48 random bytes) in the new user-secrets store only when it is missing, and never prints it.

## Task Commits

1. **Task 1 (tracer): Staff JWT reads GET /api/v1/site-settings; anonymous gets 401 ProblemDetails**
   - RED: `82f5c7c` (test, with compile-only stubs)
   - GREEN: `0fae6e2` (feat)
2. **Task 2: discovery-driven authorization coverage and the matrix (SEC-02)**
   - RED: `4e567b7` (test, `FindViolations` stub)
   - GREEN: `8ae1aba` (feat)
3. **Task 3: 401/403/500 error paths, headers, JWT fail-fast and the dev secrets script**
   - RED: `496db4b` (test, mutation record)
   - GREEN: `ebe3e12` (feat, the script)

No REFACTOR commits were needed.

## TDD Gate Compliance

Every task has a `test(01-08)` commit before its `feat(01-08)` commit. Each RED run used `--report-xunit-junit` and was checked with `gsd check tdd-red-evidence`, which returned `RED_EVIDENCE_OK` (`target_test_failed`, exit 2).

- **Task 1 RED:** two records.
  - `SiteSettingsEndpointTests.ManagerReadsSettings` failed with `response.StatusCode should be HttpStatusCode.OK but was HttpStatusCode.NotFound`. All 3 failed.
  - `GetSiteSettingsHandlerTests.MapsSnapshotToDto` failed on the empty stub DTO. All 4 failed.
- **Task 2 RED:** `AuthorizationCoverageTests.EndpointWithNoAuthorizationMetadataIsAViolation` failed with `violations should have single item but had 0 items`. 9 of 23 failed. The 14 that passed are the negative or characterization cases: the fully covered set, keys, policy names, discovery, the 9 matrix cases and the parallel test. Task 1 had already built the endpoint they exercise.
- **Task 3 RED (mutation record, as the plan allows):** all 24 tests passed straight away, because Task 1 had already built the behavior. A temporary mutation in `SecurityRegistration` removed `ValidateOnStart()` and set `IncludeErrorDetails = true`. With it, 11 of 24 failed:
  - the target `MissingOrShortSigningKeyFailsStartup(signingKey: "")` with `factory.CreateClient() should throw OptionsValidationException but did not`
  - the other startup cases
  - the five 401 cases, on the WWW-Authenticate detail

  The file was restored from a copy, `git diff` showed no change, and the suite was green (24/24) before the test commit.
- **Task 2 mutation (acceptance criterion):** a temporary `app.MapGet("/api/v1/probe", ...)` in `Program.cs` made `DiscoveredEndpointsAreFullyCovered` fail with `GET /api/v1/probe: has no named authorization policy` and `GET /api/v1/probe: has no authorization-matrix row`. It was reverted (no diff), and the suite went back to 23/23.
- **Tracer gate (interactive, end-of-phase, automated-only verify):** after Task 1 GREEN, both verify commands were run again: `*SiteSettingsEndpointTests` 3/3 and `Csps.Application.UnitTests` 4/4. Expansion went ahead after that.

## Files Created/Modified

- `src/Csps.Application/Security/Policies.cs`, `Roles.cs`: policy and role name constants.
- `src/Csps.Application/Content/GetSiteSettingsHandler.cs`, `SiteSettingsDto.cs`: the read use case and its manual mapping.
- `src/Csps.Server/Composition/JwtOptions.cs`: the JWT settings, the key decoding and the failure messages.
- `src/Csps.Server/Composition/SecurityRegistration.cs`: JwtBearer, the fallback policy and the named policies.
- `src/Csps.Server/Composition/ApplicationRegistration.cs`: handler registration.
- `src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs`: the Staff group and `GET /api/v1/site-settings`.
- `src/Csps.Server/Program.cs`: `AddCspsSecurity`, `AddCspsApplication`, `UseAuthentication`/`UseAuthorization`, `MapSiteSettings`.
- `src/Csps.Server/Csps.Server.csproj`: `UserSecretsId`.
- `src/Csps.Server/appsettings.json`: `Jwt:Issuer` and `Jwt:Audience`.
- `tests/Csps.Testing/TestJwt.cs`, `TestTokens.cs`, `CspsApiFactory.cs`: test JWT settings, token minting, and settings injection.
- `tests/Csps.Application.UnitTests/*`: the new project and `GetSiteSettingsHandlerTests`.
- `tests/Csps.Server.IntegrationTests/Authorization/*`: the coverage rule, the matrix and the three test classes.
- `tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs`, `Http/ApiRequests.cs`.
- `tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs`: the 500 test now signs in.
- `tools/scripts/Initialize-DevSecrets.ps1`: the dev JWT signing key.
- `Csps.slnx`: lists `Csps.Application.UnitTests`.

## Verification

- Preflight was clean before every test run: ports 5180, 5115, 7028 and 5199 free, and no TheBETSLLC test processes.
- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 478 passed, 0 failed, 0 skipped.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Plan verify commands:
  - `*SiteSettingsEndpointTests` 3/3
  - `Csps.Application.UnitTests` 4/4
  - `*Authorization*` 47/47 (coverage 12, matrix 11, failure 24)
  - `*AuthorizationFailureTests` 24/24
  - the script twice, then `user-secrets list | grep -q '^Jwt:SigningKey = '`
- Acceptance greps passed: `SetFallbackPolicy`, `MapInboundClaims = false`, `UserSecretsId`, and the Application.UnitTests path in `Csps.slnx`.
- `dotnet test --project tests/Csps.ArchitectureTests`: 76/76. Server still has no EF or Persistence dependency, and Application has no packages.
- The script's second run printed `Jwt:SigningKey already exists in user-secrets. Left unchanged.` A SHA-256 of the stored entry was identical before and after a third run, and the decoded key is 48 bytes. The value was never printed.
- `src/Csps.Server/logs` does not exist after the full run.

## Decisions Made

- **Bare challenge:** `IncludeErrorDetails = false`. Otherwise JwtBearer puts `error_description` (for example "The token expired at ...") into `WWW-Authenticate`.
- **Derived test keys:** the plan asked for a constant 48-byte test key. It is constant, but derived in-process (`SHA384` of fixed labels), so no high-entropy key literal is committed or flagged by secret scanners.
- **Safe failure messages:** `JwtOptions` exposes the three failure messages as constants. The tests assert them, and none contains the configured value.
- **Stricter coverage rule:** `AllowAnonymous` wins over a policy and must be allow-listed. Multi-method endpoints need one row per method. Stale allow-list entries are violations.
- **A3 confirmed:** an anonymous request to a path with no endpoint gets 401 through the fallback policy.
- **New user-secrets store:** a fresh `UserSecretsId` was added. The older, unrelated user-secrets folder on this machine was not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The 01-06 500 test was challenged by the new fallback policy**
- **Found during:** Task 1 (full Server suite after GREEN)
- **Issue:** `ProblemDetailsTests.UnhandledExceptionIsGeneric500WithReference` throws from a test-only path that is not an endpoint. Under default deny, the anonymous request got 401 before reaching the throw.
- **Fix:** the test sends a Manager token (`ApiRequests.Get(path, TestTokens.For(Roles.Manager, ...))`), so it still exercises the 500 writer.
- **Files modified:** tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
- **Verification:** Server suite 120/120, then 478/478 for the full solution.
- **Committed in:** `0fae6e2`

**2. [Rule 2 - Missing Critical] No error details in the Bearer challenge (CWE-209)**
- **Found during:** Task 1
- **Issue:** by default JwtBearer tells the caller why a token failed.
- **Fix:** `IncludeErrorDetails = false`. `ExpiredOrForeignTokensGet401` asserts that the header is exactly `Bearer`.
- **Committed in:** `0fae6e2` / `496db4b`

**3. [Rule 2 - Missing Critical] Extra edge tests beyond the plan's behaviors**
- **Added:**
  - wrong-issuer and wrong-audience tokens
  - the 30 s clock-skew boundary (10 s accepted, 60 s rejected)
  - the 32-byte key boundary, a malformed base64 key, and empty issuer/audience at startup
  - AllowAnonymous overriding a policy, stale allow-list entries, per-method keys
  - the parallel-callers backstop for the SEC-02 concurrency truth
  - the handler passing its cancellation token, and `From(null)`
- **Committed in:** `82f5c7c`, `4e567b7`, `496db4b`

**4. [Rule 3 - Blocking] Analyzer findings in new test code**
- **Issue:** CA2012 fires on NSubstitute `ValueTask` arrangement, and CA1720 on a method named `Unsigned`.
- **Fix:** one `Reader(...)` helper with a justified `#pragma warning disable CA2012`, and the method was renamed `TestTokens.WithoutSignature`.
- **Committed in:** `82f5c7c`

**5. [Rule 3 - Blocking] Request helper not in the file list**
- **Fix:** `tests/Csps.Server.IntegrationTests/Http/ApiRequests.cs` builds bearer and Accept requests for all the new test classes.
- **Committed in:** `82f5c7c`

---

**Total deviations:** 5 auto-fixed (1 Rule 1, 2 Rule 2, 2 Rule 3). Task 3's RED is a mutation record, as the plan provides.
**Impact on plan:** each change was needed for correctness, security or a clean build. There is no scope creep, and no packages were added (NSubstitute and JwtBearer were already pinned and approved in plan 01).

## Issues Encountered

- None blocking. The `tdd-red-evidence` target for a theory case uses the raw JUnit name with `&quot;` (as noted in plan 01-06).
- Application coverage (target 95%) was not measured in this plan. Every new Application line is exercised by `GetSiteSettingsHandlerTests`, and `Policies`/`Roles` are constants only.

## Threat Model Coverage

- **T-01-28 (EoP, endpoint authorization):** the fallback policy plus `DiscoveredEndpointsAreFullyCovered`, proven by the probe mutation and the synthetic-endpoint tests.
- **T-01-29 (EoP, role checks):** the Staff/Manager policies and the matrix with real JWTs. `UnknownRoleGets403Problem` shows an unknown role gets 403.
- **T-01-30 (spoofing, JWT validation):**
  - HS256 only, a key of at least 32 bytes, and issuer/audience/lifetime/signature validation with a 30 s skew
  - expired, foreign-key, unsigned, wrong-issuer and wrong-audience tokens are rejected
  - the clock-skew boundary is tested
- **T-01-31 (information disclosure, signing key):**
  - the key comes only from user-secrets (dev) or host settings (prod); appsettings and git have none
  - `ValidateOnStart` makes startup fail fast
  - failure messages carry no value, and the script never prints it
  - Serilog masks the `SigningKey` name (plan 01-07)
- **T-01-SC (supply chain):** no packages were added.

## User Setup Required

None. Developers run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1` once before `dotnet run` in Development. It has already been run on this machine. Production's `Jwt:SigningKey` goes into the host settings at deploy time (Phase 3).

## Next Phase Readiness

- **Every later endpoint:** add a `MatrixRow` with the exact status per caller, and use `RequireAuthorization(Policies.X)` on a non-anonymous group. Otherwise `DiscoveredEndpointsAreFullyCovered` fails.
- **Plan 09 (audit):** the user id comes from the raw `sub` claim through `IRequestContext`, which works because `MapInboundClaims = false`.
- **Plan 10 (Data Protection):** extend `Initialize-DevSecrets.ps1` with the certificate secrets, using the same idempotent, never-print pattern.
- **Phase 2:** map the SPA host and static assets anonymously and add them to `AnonymousAllowList` and the matrix, because unknown non-API paths are currently 401.
- **Phase 3:** set `Jwt:SigningKey` (base64, at least 32 bytes) in the SmarterASP.NET host settings, or the API will not start.
- **Phase 4:** token issuance and the active-session requirement build on this validation.
- No blockers.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 20 created files and the 6 modified files exist on disk.
- Commits `82f5c7c`, `0fae6e2`, `4e567b7`, `8ae1aba`, `496db4b` and `ebe3e12` exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- The ledger count (`3c60bc3..HEAD`) is 6, which matches `actuals.commits`.
