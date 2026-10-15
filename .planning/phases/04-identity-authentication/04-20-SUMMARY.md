---
phase: 04-identity-authentication
plan: 20
subsystem: api-idempotency
tags: [idempotency-key, sp_getapplock, replay, middleware, allow-list, sec-06, d-40, auth-08]
status: complete
created: "2026-10-15T03:30:00-05:00"
updated: "2026-10-15T03:30:00-05:00"

requires: ["04-19", "04-18", "04-15", "04-07", "04-03"]
provides:
  - "Default-on Idempotency-Key gate on every POST that names POST in its route metadata, unless the action carries [IdempotencyExempt(reason)]"
  - "IdempotencyRecords table (relational, nvarchar body, unique (Key, Route, UserId) with no filter, index on ExpiresAt for the JOB-01 purge)"
  - "IdempotencyGate (transaction plus sp_getapplock, Proceed / Replay / Mismatch / Busy) and IdempotencyLease (StoreAndCommitAsync, RollbackAsync)"
  - "Error codes idempotency.key-missing (400), idempotency.key-mismatch (422), idempotency.in-progress (409); response header Idempotent-Replayed: true"
  - "Written allow-list (IdempotencyAllowList) and discovery test (IdempotencyCoverage.FindViolations) that fail on any exempt-but-unlisted, listed-but-not-exempt or stale entry"
affects: [04-21, 04-22, 04-24, 04-28, JOB-01, every later phase POST]

requirements-completed: []

actuals:
  tokens: 21400
  tasks: 3
  commits: 4
plan_head_before: 4d560b1815375ee7266fdaeea95c5db4c2d82503
plan_head_after: 32319ebc13ad5fbf6d64617c432e11a1d0963bf9

tech-stack:
  added: []
  patterns:
    - "One transaction on the request's scoped CspsDbContext, opened by the middleware: handlers' InTransactionAsync joins it (the outer transaction owns commit and rollback), the stored answer is added last and both commit together, and the client sees the answer only after the commit"
    - "Duplicate in-flight requests are turned away with sp_getapplock (Exclusive, Transaction owner, timeout 0) on a SHA-256 resource name, so nothing waits and the record never races"
    - "Coverage by default, exemption by written reason: the attribute reason and the test-side allow-list entry must match word for word"

key-files:
  created:
    - src/Csps.Infrastructure/Idempotency/IdempotencyRecord.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/IdempotencyRecordConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015081003_AddIdempotencyRecords.cs
    - src/Csps.Server/Security/IdempotencyMiddleware.cs
    - src/Csps.Server/Security/IdempotencyExemptAttribute.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyCoverageTests.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Controllers/SignInController.cs
    - src/Csps.Server/Controllers/AuthSessionController.cs
    - src/Csps.Server/Controllers/PasswordController.cs
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs

key-decisions:
  - "The gate is registered after UseAuthorization, so a refused (401/403) request never takes a key; only endpoints whose route metadata names POST are covered, so the /api fallback (all methods) keeps answering its plain 404"
  - "The stored answer is committed with CancellationToken.None: once the handler has finished, the record is kept even if the client has gone away"
  - "A response that sets a cookie, has a body over 1 MB or has a non-text body is never stored, on top of the plan's status rule (belt and braces for T-04-72)"
  - "The key must be one header holding a hyphenated UUID; two headers, an empty value, braces or any other text are 400 idempotency.key-missing"
  - "Replays and the middleware's own errors send Cache-Control: no-store, like the controllers' ResponseCache(NoStore)"

duration: 35 min
completed: 2026-10-15
---

# Phase 4 Plan 20: Idempotency Keys Summary

Every state-changing form post now needs an Idempotency-Key and is safe to repeat: the first answer is stored in the same SQL transaction as the business change and replayed for 24 hours to the same user and route, a different body is a 422, a duplicate that arrives mid-flight is a 409, and a written allow-list with a discovery test decides the few posts that must never be stored.

## What was built

- **Tracer (Task 1):** `IdempotencyRecords` table and migration `AddIdempotencyRecords`, `IdempotencyGate`, `IdempotencyMiddleware` (registered right after `UseAuthorization`), `[IdempotencyExempt]` on sign-in, code verify, code resend, refresh, sign-out, sign-out-others, reset-link check and the Testing staff fixture. The HTTP tracer posts forgot-password twice with one key: both 202, the second carries `Idempotent-Replayed: true`, one email, one `AccountTokens` row, and one record (status 202, no user, route `POST /api/v1/auth/password/forgot`, 32-byte hash). The full existing suite still passes with the gate on.
- **Rules (Task 2):** 29 integration tests (with a small test-only probe controller added to the host as an application part) cover a missing, empty, malformed, braced or doubled key (400, handler not run, nothing stored); same key with another body (422, nothing new stored); an empty body hashed like any other; two overlapping forgot posts (one 202, one 409, then a replay); stored statuses 200, 201 (Location replayed), 202, 400, 404, 422; unstored 401, 403, 409, 429, 500, 503 (same key runs again); business row and record committing or rolling back together; an exception; a cookie-setting answer; a 1.2 MB answer that reaches the client but is not kept; per-user and per-route scoping; and the 24-hour expiry (kept at 23:59:59, replaced after 24:00:01).
- **Allow-list (Task 3):** `IdempotencyAllowList` (key, reason, decision D-40 per entry; the Testing fixture only in Debug builds) and `IdempotencyCoverage.FindViolations`, used on the real endpoints and on synthetic ones. Later plans add their exempt POSTs here (set-new-password in 04-21, invitation check in 04-22).

## Verification

| Check | Result |
| --- | --- |
| Csps.Domain.UnitTests | 590 passed |
| Csps.Application.UnitTests | 276 passed |
| Csps.ArchitectureTests | 127 passed |
| Csps.Server.IntegrationTests | 571 passed in two clean full runs (41 new: 29 in IdempotencyTests, 12 in IdempotencyCoverageTests); one earlier full run had a single failure in the pre-existing, untouched `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime` that passes alone (3 of 3) and in the next two full runs (see `deferred-items.md`) |
| Csps.Infrastructure.IntegrationTests | 322 passed, 1 skipped (the live HIBP test, by design); migration script tests included |
| Build | 0 warnings, 0 errors |
| Acceptance greps | sp_getapplock in the gate 4, IdempotencyMiddleware in Program.cs 1, IdempotencyExempt in SignInController 3, `_AddIdempotencyRecords.cs` 1, key-mismatch 1, in-progress 1, Idempotent-Replayed 2, D-40 in the allow-list 3 |

### Mutation evidence (plan Task 3 acceptance)

Each change was made by hand, the suite run, then the file restored with `git checkout -- <file>`.

| Mutation | Result |
| --- | --- |
| Remove `[IdempotencyExempt]` from sign-in | `EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason` fails: "POST /api/v1/auth/sign-in: is on the allow-list but carries no [IdempotencyExempt]." |
| Add `[IdempotencyExempt("No entry yet.")]` to forgot without an allow-list entry | discovery test fails: "POST /api/v1/auth/password/forgot: is [IdempotencyExempt] but is not on the allow-list."; `ThePasswordPostsThatChangeStateAreCovered` fails too |
| Store 429 as well | the 429 theory case and the business-row atomicity test fail |
| Ignore `Set-Cookie` when deciding to store | the cookie test fails |
| Drop the 1 MB cap | the big-response test fails |
| Ignore the 24-hour expiry (shifted by 10 years) | the expiry test fails |
| Leave the user out of the scope | the different-user test fails |
| Treat any body as a match | the mismatch and empty-body tests fail |

A new covered POST needs no decision (that is the point of coverage by default); a new exempt POST without an entry, or an entry without an exemption, fails the build's tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests posted to covered routes with no key**
- **Found during:** Task 1 (first full suite run).
- **Issue:** The authorization matrix posts every POST row, and `ForgotPasswordTests` posted forgot-password directly; with the gate on they met the new 400.
- **Fix:** `AuthClient.ForgotPasswordAsync` and `ResetPasswordAsync` send a fresh key (or a test-supplied one); the matrix tests add a fresh key per call; the one direct post in `ForgotPasswordTests` adds a key.
- **Files modified:** `AuthClient.cs`, `AuthorizationMatrixTests.cs`, `ForgotPasswordTests.cs`.
- **Commit:** 037811d (the AuthClient key helpers are in the RED commit 2d2bd65).

**2. [Rule 2 - Missing critical] Extra "never store" rules for T-04-72**
- **Found during:** Task 1 (design review against the threat model).
- **Issue:** The allow-list keeps token-bearing posts out of the gate, but a future covered endpoint could still set a cookie or return a non-text body; the gate would store and replay it.
- **Fix:** a response that sets a cookie, has a non-text body or a body over 1 MB is never stored (rolled back, still sent). Tested.
- **Commit:** 037811d, tests in 1370be0.

### Process

**3. [Process] Tasks 2 and 3 had no RED run**
- Task 1 delivered the whole middleware and gate, because the plan's Task 1 action already specifies the 400, 409, 422, storage and expiry behaviour. The Task 2 and Task 3 tests therefore passed on arrival (the plan type is `execute`, not `tdd`). To prove they test something, the eight mutations in the table above were each run and each failed the intended test. Tasks 2 and 3 are one test commit each (1370be0, 32319eb) instead of a RED/GREEN pair, because there was no production code left to change.

### Plan files touched beyond the list

- `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs` (test-only covered endpoints, added to a derived host as an application part, never seen by the matrix or the discovery test), `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs`, `tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs` and `src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs` (generated).

## Decisions for the owner

None blocking. For awareness:

1. **SEC-06 and AUTH-08 are not ticked.** SEC-06 also names the JOB-01 purge of expired keys (the table has an index on `ExpiresAt` for it, and expired keys are already ignored and replaced on reuse); AUTH-08 still needs the web pages (04-28).
2. **The `Idempotency-Key` header is not in the OpenAPI snapshot.** The web client already sends it on every POST (WEB-09), and documenting it per operation would change the generated types; say so if you want it declared.
3. **The Idempotency-Key must be a hyphenated UUID** (the form `crypto.randomUUID()` produces). Other spellings of a GUID are refused with the same 400.
4. **A busy duplicate gets a 409 immediately** (lock timeout 0) with "This request is already being processed. Wait a moment, then check the result.", rather than waiting for the first to finish.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: raw-sql | src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs | `sp_getapplock` is the one reviewed raw-SQL call (CWE-89). It runs through `ExecuteSqlRawAsync` with a constant statement and two parameters (`@result` output, `@resource` a 69-character SHA-256 name); no user text reaches the SQL. Note it for `/gsd-secure-phase 4`. |

No other new surface: the gate adds no endpoint. T-04-70 to T-04-73 each have a test (atomic record and rows, in-flight 409, cross-user and cross-route isolation, token-bearing posts exempt by the listed reasons plus the cookie rule, parameterized lock call).

## Known Stubs

None.

## Self-Check: PASSED

- Files: the eleven created files above exist (`ls` of `src/Csps.Infrastructure/Idempotency`, `src/Csps.Server/Security`, the migration folder and `tests/Csps.Server.IntegrationTests/Idempotency`).
- Commits: 2d2bd65, 037811d, 1370be0 and 32319eb are on branch gsd/phase-04-identity-authentication (`git rev-list --count 4d560b1..HEAD` was 4 before this summary).
