---
phase: 04-identity-authentication
plan: 13
subsystem: auth
tags: [sessions, access-token, at+jwt, immediate-revocation, hybrid-cache, refresh-token-storage, auth-05, auth-06, in-04, d-43]
status: complete
created: "2026-10-14T23:32:00-05:00"
updated: "2026-10-14T23:32:00-05:00"

requires: ["04-06", "04-12"]
provides:
  - "UserSessions and RefreshTokens tables (migration AddUserSessions): hash-only refresh tokens with a unique index, D-43 device fields, revocation reason, rowversion"
  - "ISessions (Add, FindAsync) over SessionStore, IAccessTokenIssuer/AccessToken, ISessionCache (IsActiveAsync, EvictAsync, EvictUserAsync)"
  - "SessionIssuer.StartAsync -> IssuedSession(SessionResponse, raw refresh token, cookie expiry) and SessionResponse/SessionUser"
  - "AccessTokenIssuer: 15-minute HS256 JWT, typ at+jwt, claims sub, role, sid, jti (AuthSettings.AccessTokenLifetime)"
  - "Bearer validation: ValidTypes at+jwt plus OnTokenValidated that fails unless the sid is an active session of the same sub, on every request"
  - "Test support: TestSessions.StartAsync (real account + session + token), typed TestTokens with sid, AcceptingSessionCache for hosts without a database"
affects: [04-14, 04-15, 04-16, 04-34, sign-out, devices page]

requirements-completed: []

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: e39ef36786a0c1cace9ebc0b4157866e54dc8fc2
plan_head_after: 652941a0e4cb1e6ce5f81a63a3b3632062cbdfd5

tech-stack:
  added: []
  patterns:
    - "Session check on every bearer request: HybridCache keyed by sid (60 s, in process), tagged by user, evicted by key on revocation"
    - "Cache entries hold (owner, end time) and are immutable; unknown and revoked sessions are cached too, so a replayed dead token costs one query a minute"
    - "Token-shaped records override ToString to the type name so a token cannot reach a log"
    - "Hosts without a database swap in AcceptingSessionCache; the real cache is proven only against a real database"

key-files:
  created:
    - src/Csps.Application/Ports/ISessions.cs
    - src/Csps.Application/Ports/IAccessTokenIssuer.cs
    - src/Csps.Application/Ports/ISessionCache.cs
    - src/Csps.Application/Auth/SessionIssuer.cs
    - src/Csps.Application/Auth/SessionResponse.cs
    - src/Csps.Infrastructure/Identity/SessionStore.cs
    - src/Csps.Infrastructure/Identity/SessionCache.cs
    - src/Csps.Infrastructure/Persistence/Configurations/UserSessionConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/RefreshTokenConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015042245_AddUserSessions.cs
    - src/Csps.Server/Security/AccessTokenIssuer.cs
    - tests/Csps.Testing/TestSessions.cs
    - tests/Csps.Testing/AcceptingSessionCache.cs
    - tests/Csps.Server.IntegrationTests/Auth/SessionRevocationTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/AccessTokenTests.cs
    - tests/Csps.Application.UnitTests/Auth/SessionIssuerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/SessionStoreTests.cs
  modified:
    - src/Csps.Application/Auth/AuthSettings.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Server/Composition/SecurityRegistration.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Testing/TestTokens.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
    - tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs

key-decisions:
  - "Cache key is the session id alone, tagged with the caller's user id; a lookup whose user differs from the owner removes the entry, so eviction by user stays exact and EvictAsync(sid) is a bounded key removal (no per-session tag record kept forever)"
  - "The cache stores the session's fixed end and compares it with the clock on every call, so a session ends on time even while a 60-second entry is still cached"
  - "RefreshTokens.ParentId is a plain column with no self foreign key: the domain owns the chain and a self-referencing cascade is awkward on SQL Server"
  - "IssuedSession keeps the planned shape (Response, RefreshToken, CookieExpiresAt); tests read the session id from the token's sid claim"
  - "AuthSettings.Validate also checks AccessTokenLifetime, so a zero lifetime stops the start"

patterns-established:
  - "Integration tests on a database host mint tokens through TestSessions.StartAsync; TestTokens.For is for hosts without a database"

coverage:
  - id: D1
    description: "A started session's access token reads site settings and is refused on the very next request after the session is revoked and evicted"
    requirement: "AUTH-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/SessionRevocationTests.cs#ASessionTokenReadsSettingsAndIsRefusedTheMomentTheSessionIsRevoked"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unknown, foreign-user, session-less and wrongly typed (typ JWT) tokens are refused"
    requirement: "AUTH-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/SessionRevocationTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Access token is a 15-minute HS256 at+jwt with sub, role, sid and jti"
    requirement: "AUTH-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/AccessTokenTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sessions and refresh tokens persist hash-only with a unique token hash; the cache answers from the database with expiry and eviction"
    requirement: "AUTH-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/SessionStoreTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The authorization matrix runs on a real database with a seeded Admin and Manager, each with a live session"
    requirement: "AUTH-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 13: Sessions and Typed Access Tokens Summary

Signed-in staff now have stored sessions: a started session yields a 15-minute `at+jwt` access token that names its session, every bearer request checks that session through a 60-second in-process cache, and revoking plus evicting the session makes the very next request a 401. Refresh tokens persist as SHA-256 hashes only, and the authorization matrix now runs on real sessions.

## What was built

- **Tracer (Task 1):** `UserSessions` and `RefreshTokens` tables (migration `AddUserSessions`, no JSON, additive), `SessionStore`, `SessionIssuer` (device label from the User-Agent, first refresh token hashed, access token issued), `AccessTokenIssuer` over `JsonWebTokenHandler` (typ `at+jwt`, claims `sub`, `role`, `sid`, `jti`), `SessionCache` over `HybridCache` and `IDbContextFactory`, and the bearer events: `ValidTypes = [at+jwt]` closes review IN-04, and `OnTokenValidated` fails the request unless `sub` and `sid` parse and the session is active for that user.
- **Test support:** `TestTokens` now writes typ `at+jwt` and a `sid` and gains `WithType` and `WithoutSession`. `TestSessions.StartAsync` creates a real account and session through the real services. `AcceptingSessionCache` is registered only in the no-database mode of `CspsApiFactory`. The tests that use a database host with tokens (site settings, health, problem details, the matrix) now mint tokens through `TestSessions`.
- **Task 2:** `AccessTokenTests` (header, claims, 15-minute lifetime with a fake clock, unique `jti`, the host accepts the issuer's token, bad key and blank role are refused). The matrix seeds one Admin and one Manager with live sessions once per database.
- **Unit and store tests added beyond the plan** to keep Application at its coverage line: `SessionIssuerTests`, the `AuthSettings` rows, and `SessionStoreTests` (round trip, hash-only storage, unique hash, owner check, fixed end, eviction by session and by user).

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | A started session's token reads site settings and dies with the session | 6642cb0 (RED), feac727 |
| 2 | Typed test tokens with session ids and a database-backed matrix | 652941a |

Tracer gate: interactive, `human_verify_mode` end-of-phase and an automated-only `<verify>`, so `SessionRevocationTests` was re-run after the slice (6 passed) and the whole Server suite (393 passed) before expanding. Tracer verified end-to-end, expanding.

## RED / GREEN evidence

- Task 1 RED: the test projects did not build (`SessionIssuer`, `ISessions`, `ISessionCache`, `TestTokens` session overloads missing). GREEN: `SessionRevocationTests` 6 passed on the first run.
- Task 2: see Deviations. The typed test tokens, the accepting cache and the seeded matrix had to land with the tracer to keep the suite green (a validator that requires `at+jwt` and a real session breaks every existing database-host test with a random sid), so `AccessTokenTests` were written after the implementation and passed on their first run. They are characterization tests, not a RED step.

## Verification

- `dotnet build`: 0 warnings, 0 errors.
- Domain 576, Application 116, Architecture 127, Infrastructure integration 316 (315 passed, 1 skipped live HIBP), Server integration 398: all green, 0 failed.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 100% line (321/321), branch 98% (not gated). PASS.
- Acceptance greps: `ValidTypes` and `OnTokenValidated` in SecurityRegistration.cs, `"at+jwt"` in AccessTokenIssuer.cs, `_AddUserSessions.cs` in Migrations, `at+jwt` and `"sid"` in TestTokens.cs, `ForDatabase` in AuthorizationMatrixTests.cs: all present.
- OpenAPI contract unchanged (no endpoint added); the openapi snapshot test passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 test-support work moved into Task 1**
- **Found during:** Task 1 GREEN
- **Issue:** Requiring `at+jwt` and an active session broke every database-host test that used a random-sid token (site settings, health, problem details, the matrix, 9 failures).
- **Fix:** Typed `TestTokens`, `AcceptingSessionCache`, `TestSessions` and the seeded matrix landed in the Task 1 GREEN commit; Task 2 then added `AccessTokenTests` only.
- **Files modified:** tests/Csps.Testing/*, the four Server integration test files above.
- **Commit:** feac727

**2. [Rule 2 - Missing critical] Tests for the new Application and Infrastructure code**
- **Issue:** The plan listed no unit test for `SessionIssuer` or the store and cache, and the Application coverage line must stay at or above 95%.
- **Fix:** `SessionIssuerTests`, `AuthSettingsTests` rows and `SessionStoreTests`.
- **Commit:** feac727

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical). **Impact:** none on scope; the plan's files and symbols are all delivered.

## Decisions for the owner

None needed. Small judgment calls, all conservative:
- `RefreshTokens.ParentId` has no self foreign key (plain column; the domain owns the chain).
- The session cache holds unknown and revoked sessions for 60 seconds too, so repeated replays of a dead token do not reach the database each time.
- `requirements-completed` is left empty on purpose: AUTH-05 still needs rotation, cookies and the refresh endpoint (04-14, 04-15, 04-34) and AUTH-06 still needs the sign-out endpoint. No requirement is ticked.

## Known Stubs

None.

## Threat Flags

None. The new surface (session tables, per-request session check) is the one the plan's threat model (T-04-42 to T-04-45) covers; no new endpoint was added.

## Next

Ready for 04-14. Plan 04-34 adds rotation and bulk-revocation store operations and `IRequestContext.SessionId`.

## Self-Check: PASSED

- Files created exist (checked below), commits 6642cb0, feac727 and 652941a are ancestors of HEAD, and the full suites and the coverage gate pass.
