---
phase: 04-identity-authentication
plan: 24
subsystem: api-security
tags: [rate-limiting, sliding-window, per-ip, retry-after, ipv6-slash-64, d-39, sec-03, cwe-307, cwe-799, cwe-770]
status: complete
created: "2026-10-15T07:05:00-05:00"
updated: "2026-10-15T07:05:00-05:00"

requires: ["04-22", "04-20", "04-07"]
provides:
  - "AddCspsRateLimiting: six named sliding-window policies (auth-sign-in, auth-verify, auth-resend, auth-forgot, auth-reset, auth-refresh), queue limit 0, partitioned by IPv4 address, IPv6 /64 or one shared 'unknown' key"
  - "RateLimitSettings (RateLimits:Auth:<SignIn|Verify|Resend|Forgot|Reset|Refresh>:PermitLimit and :Window) with the owner's D-39 numbers as defaults; start-up refuses an unusable value and names the setting, never the value"
  - "Plain 429 problem+json with code rate-limited and a whole-second Retry-After (never 0), written by the limiter before authentication, authorization, the idempotency middleware and any handler"
  - "[EnableRateLimiting] on every auth action and on SessionsController (list, revoke)"
  - "Test support: RemoteIpStartupFilter (remote address from X-Test-Remote-Ip, opt-in only) and CspsApiFactory setting every limit to 100000"
affects: [04-30, 04-31, 04-35]

requirements-completed: []

actuals:
  tokens: 26000
  tasks: 2
  commits: 4
plan_head_before: 948f16d0d6f9fdd979e9ecffe1cbf10aa45b113b
plan_head_after: 778ecd198aad9e0148c43b7a49009394a06e93ab

tech-stack:
  added: []
  patterns:
    - "A rejected request is answered inside UseRateLimiter, which sits after UseRouting and before UseAuthentication, so it costs no database work, no audit row, no email and no idempotency record"
    - "Bounded partition keys: the full IPv4 address, the first 64 bits of an IPv6 address, an IPv4-mapped IPv6 address folded to its IPv4 form, or 'unknown'"
    - "Test hosts opt out of throttling through configuration (100000), and the limit tests restore the real numbers through the factory's ConfigureSettings hook"

key-files:
  created:
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - tests/Csps.Testing/RemoteIpStartupFilter.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitPartitionTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Controllers/SignInController.cs
    - src/Csps.Server/Controllers/AuthSessionController.cs
    - src/Csps.Server/Controllers/PasswordController.cs
    - src/Csps.Server/Controllers/InviteController.cs
    - src/Csps.Server/Controllers/SessionsController.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - web/playwright.config.ts

key-decisions:
  - "Retry-After is the policy's whole window, rounded up to whole seconds and at least 1. The built-in sliding-window limiter reports no wait on a rejected lease, and the window is the one value that is always safe: after it, every earlier request has left the window"
  - "The E2E host (Playwright, one address, four workers) sets every RateLimits__Auth__*__PermitLimit to 100000 in web/playwright.config.ts; production keeps the owner's numbers because the defaults live in code and no appsettings file lowers them"
  - "Limits live only in code defaults plus configuration: no RateLimits section was added to appsettings.json, so a missing key can never silently turn a limit off"

patterns-established:
  - "RealLimitsFactory: a test host with the real D-39 numbers, an optional database and an optional remote-address header"

coverage:
  - id: C1
    description: "SEC-03 boundary and ordering: from one address the 10th sign-in in a minute is handled and the 11th is a 429 with Retry-After; ten audit rows exist, not eleven"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs#TheEleventhSignInInAMinuteGetsA429AndDoesNoWork"
        status: pass
    human_judgment: false
  - id: C2
    description: "Every auth endpoint carries its policy with the D-39 count (14 routes: sign-in, verify, resend, forgot, reset check, reset, set-new, invite check, invite accept, refresh, sign-out, sign-out-others, sessions list, session revoke)"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs#EveryAuthEndpointCarriesItsPolicy"
        status: pass
    human_judgment: false
  - id: C3
    description: "A rejected POST stores no IdempotencyRecords row even with a key"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs#ARejectedPostStoresNoIdempotencyRecord"
        status: pass
    human_judgment: false
  - id: C4
    description: "Adjacency, empty and concurrency edges: separate IPv4 buckets, shared IPv6 /64, IPv4-mapped IPv6 folded to IPv4, one shared unknown bucket, 20 parallel requests over a limit of 10 give exactly 10 handled and 10 rejected"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitPartitionTests.cs"
        status: pass
    human_judgment: false
  - id: C5
    description: "The default limits are the owner's numbers, and an unusable limit is named without echoing a value"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitPartitionTests.cs#TheDefaultLimitsAreTheOwnerNumbers"
        status: pass
    human_judgment: false
  - id: C6
    description: "The real E2E host never throttles itself under four parallel workers"
    requirement: "SEC-03"
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --project chromium (127 passed, 3 skipped as before)"
        status: pass
    human_judgment: false

duration: 70 min
completed: 2026-10-15
---

# Phase 4 Plan 24: Per-IP Rate Limits on the Auth Endpoints Summary

Every auth endpoint is now throttled per client address with the owner's D-39 numbers (sign-in and code check 10 a minute, resend 5 a minute, forgot 5 per 15 minutes, reset and invite links 10 per 15 minutes, refresh, sign-out and the devices list 60 a minute). A throttled request gets a plain 429 `rate-limited` with a whole-second Retry-After from the limiter itself, so it does no database work and leaves no audit entry, email or idempotency record. The per-account limits (lockout, code tries, resend caps) stay in the handlers.

## What was built

- **Tracer (Task 1):** `RateLimitTests` signs in ten times with unknown emails from one address (ten 401s and ten `auth.sign-in-failed` rows) and expects the 11th to be a 429 problem+json with code `rate-limited`, a trace id and a Retry-After of 1 to 60 whole seconds, with the audit count unchanged. GREEN adds `RateLimitSettings`, `RateLimitingRegistration`, `app.UseRateLimiter()` right after `UseRouting()`, the sign-in attribute and the 100000 settings in `CspsApiFactory`. The full integration suite was re-run before expanding (611 passed).
- **Every endpoint (Task 2):** `[EnableRateLimiting]` is on verify, resend, forgot, reset check, reset, set-new, invite check, invite accept, refresh, sign-out, sign-out-others, sessions list and session revoke. A 14-row theory proves that each route answers 429 on request limit + 1. `RateLimitPartitionTests` covers the address rules and parallel rejection with `RemoteIpStartupFilter` (a test-only filter, never registered by default).
- **E2E host:** `web/playwright.config.ts` sets all six `RateLimits__Auth__<Policy>__PermitLimit` values to 100000 on the host process only.

## Verification

- `dotnet test` in `tests/Csps.Server.IntegrationTests`: 638 passed (27 new), 0 failed.
- `tests/Csps.ArchitectureTests`: 127 passed. `dotnet build`: 0 warnings, 0 errors.
- `npm run e2e -- --grep "@testing-host|@auth" --project chromium`: 7 passed. Full `--project chromium`: 127 passed, 3 skipped (as before).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The sliding-window limiter gives no Retry-After metadata**
- **Found during:** Task 1 (GREEN)
- **Issue:** `Lease.TryGetMetadata(MetadataName.RetryAfter)` returns nothing for a rejected `SlidingWindowRateLimiter` lease, so the plan's "Retry-After from the lease metadata" produced no header.
- **Fix:** the lease value is still used when present; otherwise the policy's window (looked up from the endpoint's `EnableRateLimiting` policy name) is sent, rounded up, never below 1.
- **Files modified:** `src/Csps.Server/Security/RateLimitingRegistration.cs`
- **Commit:** b9eb6c2

**2. [Rule 3 - Blocking] A null setting reads as an empty string**
- **Found during:** Task 1 (GREEN)
- **Issue:** `RealLimitsFactory` first tried to remove the 100000 settings with `UseSetting(key, null)`; the binder then failed on an empty string.
- **Fix:** the factory sets the real D-39 permit limits explicitly (windows keep their defaults); a separate test pins the defaults to the same numbers.
- **Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs`
- **Commit:** b9eb6c2

**Total deviations:** 2 auto-fixed. No scope change.

## Decisions for the owner

- **Retry-After is the whole window.** A 429 on forgot says to wait 900 seconds even if the oldest request is already 14 minutes old. It is never too short, so a client that obeys it always succeeds. A tighter figure would need a custom limiter.
- **Shared proxy risk (T-04-87, accepted):** the address comes from `Connection.RemoteIpAddress` only. If the SmarterASP.NET front end shows every visitor as one address, all staff share one bucket (10 sign-ins a minute for the whole shop). This is the Phase 3 hosting checklist item; the numbers can be raised in configuration without a deploy of code.
- **SEC-03 stays open.** This plan delivers its per-IP auth layer. The requirement also names consent, analytics, inquiry and public endpoints, so it is not ticked.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; the plan only adds a limiter in front of existing ones.

## Self-Check: PASSED

- Files: RateLimitSettings.cs, RateLimitingRegistration.cs, RemoteIpStartupFilter.cs, RateLimitTests.cs, RateLimitPartitionTests.cs and RealLimitsFactory.cs exist.
- Commits on the branch: b7ee7c9 (test, RED), b9eb6c2 (feat, GREEN), a25a6d5 (test, RED), 778ecd1 (feat, GREEN).
