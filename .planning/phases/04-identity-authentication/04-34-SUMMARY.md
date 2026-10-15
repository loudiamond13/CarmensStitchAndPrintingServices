---
phase: 04-identity-authentication
plan: 34
subsystem: auth-sessions
tags: [sessions, refresh-rotation, revocation, request-context, auth-05, auth-06, cwe-613, cwe-639]
status: complete
created: "2026-10-14T23:40:00-05:00"
updated: "2026-10-14T23:40:00-05:00"

requires: ["04-13"]
provides:
  - "ISessions.FindByRefreshHashAsync returns a RefreshLookup (session, presented token, related tokens) from the unique TokenHash index"
  - "ISessions.AddToken tracks a rotated child token"
  - "ISessions.RevokeAllAsync revokes every active session of a user except an optional one, with their open tokens, and returns the revoked ids"
  - "IRequestContext.SessionId: the sid claim as a Guid, null when absent or malformed"
affects: [04-14, 04-15, refresh, sign-out, sign-out-other-devices, password reset]

requirements-completed: []

actuals:
  tokens: 12000
  tasks: 2
  commits: 4
plan_head_before: 5b50341ce885a5ddfde74f135a496742bbe0ae6e
plan_head_after: 84b1dc430472968d0dd25eb10208ce1c9be8af60

tech-stack:
  added: []
  patterns:
    - "Store operations only change tracked entities; the unit of work saves and the caller evicts ISessionCache so revocation shows at once"
    - "Bulk revocation picks sessions with UserSession.SelectOthersToRevoke and ends each with Revoke, so the domain rule stays in one place"

key-files:
  created: []
  modified:
    - src/Csps.Application/Ports/ISessions.cs
    - src/Csps.Infrastructure/Identity/SessionStore.cs
    - src/Csps.Application/Ports/IRequestContext.cs
    - src/Csps.Server/Http/HttpRequestContext.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/SessionStoreTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Auditing/FixedRequestContext.cs
    - tests/Csps.Server.IntegrationTests/Http/HttpRequestContextTests.cs

key-decisions:
  - "RefreshLookup.Related also contains the presented token, because UserSession.Rotate documents that the related set includes it; otherwise it holds only the session's unused, unrevoked tokens and the presented token's children"
  - "RevokeAllAsync does not evict the cache itself: the store stays database-only and the handler calls ISessionCache.EvictUserAsync after saving (SessionCache already supports it)"
  - "RevokeAllAsync(userId, exceptSessionId, reason, now, ct): the reason is a parameter so sign-out-others and password reset share it"

patterns-established:
  - "Session tests drive rotation through the store (lookup, Rotate, AddToken, save) to prove the store serves the domain's inputs"
---

# Phase 4 Plan 34: Session Store Lookups, Bulk Revocation and Session Id Summary

The session store can now find a refresh token with its session and the tokens rotation needs, add the rotated child, and revoke every other session of a user, and request code can read which session is the caller's own.

## What was built

- **Tracer (Task 1):** `FindByRefreshHashAsync`, `AddToken` and `RevokeAllAsync` on `ISessions`, implemented in `SessionStore` with index-backed queries (by `TokenHash`, by `SessionId`, by `UserId` with `RevokedAt` null). `RefreshLookup` carries the session, the presented token and the related tokens. `SessionCache` already evicted by id or user tag, and tests show a bulk-revoked session is inactive after `EvictUserAsync`.
- **Task 2:** `IRequestContext.SessionId` read from the `sid` claim (`SecurityRegistration.SessionClaim`) in `HttpRequestContext`; `FixedRequestContext` has a settable `SessionId` defaulting to null.

## Verification

- `SessionStoreTests`: 11 passed (6 new: unknown hash, lookup content over A to B to C rotation, child persisted and found, revoke-all-but-one with a same-instant session and a second user, revoke-all with no exception and a second call that finds nothing).
- `HttpRequestContextTests`: 14 passed (5 new cases for `SessionId`).
- Full runs: Infrastructure.IntegrationTests 321 (320 passed, 1 skipped live HIBP test), Server.IntegrationTests 402, ArchitectureTests 127, Application.UnitTests 116, all green. `dotnet build Csps.slnx` has 0 warnings and 0 errors.

## Deviations from Plan

None - plan executed exactly as written.

## Threat model

- T-04-110: the revoke query filters by user id and `RevokedAt` null; tests use two users and a same-instant session, and check the other user's session and tokens stay open.
- T-04-111: `SessionId` is null unless the `sid` claim parses as a Guid (tests for absent, empty and malformed).

## Known Stubs

None.

## Threat Flags

None.

## Decisions for the owner

None.

## Self-Check: PASSED

All four task commits (1648d6d, 2f32445, 036fc50, 84b1dc4) are on the branch and the modified files exist.
