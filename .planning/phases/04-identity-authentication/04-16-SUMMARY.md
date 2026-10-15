---
phase: 04-identity-authentication
plan: 16
subsystem: auth
tags: [sessions, signed-in-devices, per-device-sign-out, cwe-639, auth-06, audit-01, d-43]
status: complete
created: "2026-10-15T00:25:00-05:00"
updated: "2026-10-15T00:25:00-05:00"

requires: ["04-15", "04-34"]
provides:
  - "GET /api/v1/sessions (Staff, no-store): the caller's own active sessions, at most 100, this device first, then lastActiveAt newest first, then signedInAt newest first, then id; items {id, device, signedInAt, lastActiveAt, persistent, current}"
  - "DELETE /api/v1/sessions/{id:guid} (Staff, no-store): signs out one of the caller's other sessions, 200 {alreadySignedOut}; 404 sessions.not-found for another user's or an unknown id; 422 sessions.current for the caller's own session"
  - "ListSessionsHandler, RevokeSessionHandler, SessionListItem, RevokeSessionResponse, SessionsController, ISessions.ListActiveAsync, AuthErrors.SessionNotFound and SessionCurrent"
  - "Test support: AuthClient.ListSessionsAsync/ReadSessionsAsync/RevokeSessionAsync, SignInFullyAsync(userAgent) (the device label is read at the code-verify step), VerifyAsync(userAgent)"
affects: [04-25, 04-29, 04-30, web signed-in devices page]

requirements-completed: []

actuals:
  tokens: 21000
  tasks: 2
  commits: 4
plan_head_before: 88f2f985741f77a1547346439f0ea591d0c4dc43
plan_head_after: 9881ee621b1461e533f3bf8637a2f73f60fbf999

tech-stack:
  added: []
  patterns:
    - "Both routes read the user and the current session only from IRequestContext (the token); the id in the URL is never trusted. A session that is not the caller's gets the same 404 as an unknown id"
    - "The list asks the store for a page of 100 by recent activity, then the handler orders it, re-checks IsActive and adds the current session if the page missed it, so an old current session is always listed"
    - "Per-device sign-out runs through ConflictRetry like the other session handlers (second lost race answers 409 auth.session-busy)"

key-files:
  created:
    - src/Csps.Application/Auth/ListSessionsHandler.cs
    - src/Csps.Application/Auth/RevokeSessionHandler.cs
    - src/Csps.Application/Auth/SessionListItem.cs
    - src/Csps.Server/Controllers/SessionsController.cs
    - tests/Csps.Application.UnitTests/Auth/ListSessionsHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/RevokeSessionHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Sessions/SessionsEndpointTests.cs
  modified:
    - src/Csps.Application/Ports/ISessions.cs
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Infrastructure/Identity/SessionStore.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/SessionStoreTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The store returns UserSession entities (read-only, no tokens) from ListActiveAsync, and the handler maps them to SessionListItem; the order is decided in the handler so it is unit-tested without a database"
  - "RevokeSessionResponse lives next to its handler in RevokeSessionHandler.cs, not in a separate file"
  - "A per-device sign-out marks the session revoked and evicts the cache but does not load or revoke its refresh tokens: Rotate checks the session first, so the cookie already fails (tested over HTTP)"
  - "Message for sessions.not-found: \"That device isn't in your list.\" (plain English, same for foreign and unknown ids)"

patterns-established:
  - "Own-resource routes answer one 404 for 'not yours' and 'does not exist' (CWE-639), proven with a Manager caller"

coverage:
  - id: D1
    description: "GET /api/v1/sessions lists the caller's active sessions with device, sign-in time, last activity, kind and current; this device first; revoked and other users' sessions never appear; anonymous 401; no-store"
    requirement: "AUTH-06"
    verification:
      - "SessionsEndpointTests.TwoDevicesAreListedWithThisOneFirstAndMarked, AnotherUsersSessionsNeverAppear, ASignedOutDeviceDisappearsFromTheList, AnAnonymousCallerIsRefused; matrix row GET /api/v1/sessions (401, 200, 200)"
  - id: D2
    description: "Stable order and the cap: current first even when oldest, 105 sessions give 100, equal activity falls back to sign-in time then id, expired excluded"
    requirement: "AUTH-06"
    verification:
      - "ListSessionsHandlerTests (9 tests); SessionStoreTests.ListingGivesTheUsersActiveSessionsNewestActivityFirstWithinTheCap"
  - id: D3
    description: "DELETE signs out another of the caller's sessions: its token and refresh cookie fail at once, alreadySignedOut false; repeating gives true"
    requirement: "AUTH-06"
    verification:
      - "SessionsEndpointTests.SigningOutAnotherDeviceStopsItsTokenAndCookieAndAnswersNotAlreadySignedOut, RepeatingTheSignOutIsAnAlreadySignedOutSuccessAndAuditsOnce; RevokeSessionHandlerTests"
  - id: D4
    description: "CWE-639: another user's session (even from a Manager) and an unknown id get the identical 404 sessions.not-found and change nothing; the current session gets 422 sessions.current and keeps working"
    requirement: "AUTH-06"
    verification:
      - "SessionsEndpointTests.AnotherUsersSessionEvenForAManagerAndAnUnknownIdGetTheSameNotFoundAndChangeNothing, SigningOutTheCurrentSessionIsRefusedAndTheSessionKeepsWorking; matrix row DELETE /api/v1/sessions/{id:guid} (401, 404, 404)"
  - id: D5
    description: "AUDIT-01: one auth.session-revoked (UserSession id, actor the caller) per real per-device sign-out; nothing for an already-gone or refused request"
    requirement: "AUDIT-01"
    verification:
      - "SessionsEndpointTests (repeat and refusal tests count audit rows); RevokeSessionHandlerTests (audit entries)"
  - id: D6
    description: "Prohibition: no route shows or accepts another staff member's sessions, Managers included"
    requirement: "AUTH-06"
    verification:
      - "SessionsEndpointTests.AnotherUsersSessionsNeverAppear and the Manager 404 test; both handlers read the user only from IRequestContext"
---

# Phase 4 Plan 16: Signed-in Devices API Summary

Each staff member can now list their own signed-in devices (this device first, marked, with device label, sign-in time, last activity and "Keep me signed in") and sign out any one of their other devices, with another user's sessions unreachable even for a Manager and every real sign-out audited.

## What was built

- **Tracer (Task 1):** `GET /api/v1/sessions`. `ISessions.ListActiveAsync(userId, now, cap, ct)` is an index-backed, no-tracking query (existing `IX_UserSessions_UserId_RevokedAt`, no schema change) ordered by last activity, sign-in time, then id. `ListSessionsHandler` takes the user and current session from `IRequestContext`, re-checks `IsActive`, adds the current session if the capped page missed it, then orders: current first, `lastActiveAt` newest, `signedInAt` newest, id. Result is capped at 100.
- **Per-device sign-out (Task 2):** `DELETE /api/v1/sessions/{id:guid}`. `RevokeSessionHandler` loads the session and answers `sessions.not-found` (404) when it is missing or belongs to someone else, `sessions.current` (422, "Use Logout to sign out this device.") for the caller's own session, `alreadySignedOut: true` for an ended or expired one, and otherwise revokes with `DeviceSignedOut`, saves, evicts the cache and audits `auth.session-revoked`. Runs through `ConflictRetry`.
- Matrix rows for both routes; OpenAPI snapshot and TS types refreshed (`SessionListItem`, `RevokeSessionResponse`, `ListSessions`, `RevokeSession`); the audit-log doc row for `auth.session-revoked` now names this case.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | A user signed in on two devices sees both, current first and marked | 93091f9 (RED), fb77943 |
| 2 | Sign out one other device: own sessions only, never the current one, idempotent, audited | c9ee748 (RED), 9881ee6 |

Tracer gate: interactive, `human_verify_mode` end-of-phase and automated-only `<verify>`; both verify commands were re-run after GREEN (SessionsEndpointTests 4, ListSessionsHandlerTests 9) before expanding. Tracer verified end-to-end, expanding.

## RED / GREEN evidence

- Task 1 RED: `ListSessionsHandlerTests` did not compile (no handler, `SessionListItem`, `ListActiveAsync`); the 4 endpoint tests failed with 404. GREEN: 4 endpoint, 9 handler, 13 store tests pass; matrix 93.
- Task 2 RED: `RevokeSessionHandlerTests` did not compile; 5 of 9 endpoint tests failed (the 404 tests failed on the missing `sessions.not-found` code). GREEN: handler 7, endpoint 9, matrix 96.

## Verification

- `dotnet build`: 0 warnings, 0 errors.
- Domain 576, Application 206, Architecture 127, Infrastructure integration 323 (322 passed, 1 skipped as before), Server integration 492: all green after the preflight.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 99.8% line (655/656), branch 97.4% (not gated). PASS.
- `npm --prefix tools/openapi-gen run check` passes; `OpenApiSnapshotTests` pass against the refreshed snapshot.
- Acceptance greps: `ListActiveAsync` in ISessions.cs, `GET /api/v1/sessions` in the matrix, `SessionListItem` in api.generated.ts, `sessions.current` and `sessions.not-found` in AuthErrors.cs, `AuditActions.SessionRevoked` in RevokeSessionHandler.cs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The capped page could omit the current session**
- **Found during:** Task 1 design (behavior: "current first even when it is the oldest").
- **Issue:** with more than 100 sessions the store's page by activity drops the oldest, which can be the caller's own device.
- **Fix:** the handler looks the current session up (`FindAsync`, only when the page misses it and it belongs to the caller and is active) and keeps it, trimming the last page item to stay at 100. Unit-tested both ways.
- **Commit:** fb77943

**2. [Rule 3 - Blocking] The test sign-in helper gave every device "Unknown browser"**
- **Found during:** Task 1 GREEN.
- **Issue:** the session's device label comes from the User-Agent of the code-verify request (`SessionIssuer`), but `AuthClient.SignInFullyAsync` sent the agent only on the password step.
- **Fix:** `VerifyAsync` and `SignInFullyAsync` take a `userAgent` and send it on verify. No production change; existing tests do not assert a label.
- **Commit:** fb77943

### Plan interpretation

- `SessionStoreTests` gained a list-query test (not in the plan's file list) to prove the scoping, ordering and cap against a real database.
- `docs/operations/audit-log.md` was updated for the `auth.session-revoked` row (not in the plan's file list).
- `RevokeSessionResponse` is declared in `RevokeSessionHandler.cs`.

## Decisions for the owner

- **No requirement ticked.** AUTH-06 still needs the web devices page and sign-out UI (04-29/04-30), and AUDIT-01 still has the remaining event catalog plans. Say so if you want the server half of AUTH-06 ticked now.
- **Per-device sign-out leaves that session's refresh-token rows unrevoked.** The session itself is revoked, which already stops the access token (cache evicted) and the refresh cookie (`Rotate` checks the session first; tested over HTTP). Revoking the token rows too would need a new store method; it is a small follow-up if you want it for tidiness.
- **Copy:** `sessions.not-found` reads "That device isn't in your list." The web page treats 404 as "already gone" per the UI spec, so this text is rarely shown.

## Known Stubs

None.

## Threat Flags

None. The two routes are the surfaces in the plan's threat model: T-04-55 (ownership against the token's user, identical 404, Manager-caller test), T-04-56 (query scoped by the token's user, coarse label only), T-04-57 (422 `sessions.current`, tested). No installs.

## Notes for later plans

- The web client calls `DELETE /api/v1/sessions/{id}` with the bearer token only (no CSRF header needed). Treat a 404 as "already gone" (info toast) and `alreadySignedOut: true` as the same, per UI-SPEC S7. A 409 `auth.session-busy` means try again.
- The list gives `current: true` on exactly one item (this device); the UI never offers sign-out for it.
- Test helpers: `AuthClient.SignInFullyAsync(client, staff, keepSignedIn, signInsSoFar, userAgent)` now labels the device from `userAgent`.

## Self-Check: PASSED

All created and modified files exist, and the four commits (93091f9, fb77943, c9ee748, 9881ee6) are ancestors of HEAD.
