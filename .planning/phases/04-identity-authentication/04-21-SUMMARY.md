---
phase: 04-identity-authentication
plan: 21
subsystem: api-auth
tags: [must-change-password, set-new-password, breach-recheck, hibp, d-13, d-18, d-21, d-22, auth-09, auth-11]
status: complete
created: "2026-10-15T04:06:00-05:00"
updated: "2026-10-15T04:06:00-05:00"

requires: ["04-20", "04-17", "04-14", "04-13", "04-08", "04-05"]
provides:
  - "POST /api/v1/auth/password/set-new {newPassword}: ticket cookie + X-CSPS-CSRF; 200 SessionResponse with the refresh cookie set and the ticket cleared"
  - "SetNewPasswordHandler: ticket must be a code-verified, unexpired challenge of an active, unlocked account; full password rule (FailOpenWithFloor); one transaction saves the password, clears the flag, starts the session, queues the changed email and audits"
  - "D-18 late breach re-check in SignInHandler, only on the correct-password branch of an account with BreachRecheckPending"
  - "Testing fixture states must-change-temporary and must-change-breach on POST /api/testing/staff"
  - "Matrix row, anonymous allow-list key and idempotency allow-list entry for set-new; OpenAPI snapshot and web types refreshed"
affects: [04-22, 04-31, 05-users]

requirements-completed: []

actuals:
  tokens: 17200
  tasks: 2
  commits: 4
plan_head_before: 286007c72fa16ee42d84a1d8052fdb76f767510f
plan_head_after: 8bf2e759eea2c71f1f2c65e94e175519a41f23e5

tech-stack:
  added: []
  patterns:
    - "Spend the pending sign-in and save first, then change the account: a second request on the same ticket loses on the rowversion before any other change"
    - "The breach re-check hangs off the correct-password branch only, so nothing about timing or the answer changes for a wrong password"

key-files:
  created:
    - src/Csps.Application/Auth/SetNewPasswordRequest.cs
    - src/Csps.Application/Auth/SetNewPasswordRequestValidator.cs
    - src/Csps.Application/Auth/SetNewPasswordHandler.cs
    - tests/Csps.Application.UnitTests/Auth/SetNewPasswordHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/BreachRecheckTests.cs
  modified:
    - src/Csps.Application/Auth/SignInHandler.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/PasswordController.cs
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingFixturesEndpointTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "A locked account also gets 401 auth.ticket-expired at set-new (the code step already does this); the plan named only inactive accounts"
  - "The ticket is checked before the form, so a missing ticket is 401 for every caller and the matrix row is 401, not 400"
  - "A breach found at sign-in sets reason Breach even if the account already carried Temporary: both lead to the same step"

duration: 14 min
completed: 2026-10-15
---

# Phase 4 Plan 21: Must-Change Password Gate Summary

An account flagged "must set a new password" (Manager-set temporary password, or a password later found in a breach) still signs in with password and emailed code, but gets no session until `POST /api/v1/auth/password/set-new` saves a password that passes the full rule; that save is the sign-in. A password accepted while HIBP was down is re-checked at the next correct password and moves the account into the same gate if it is now breached.

## What was built

- **Tracer (Task 1):** `MustChangePasswordTests` drives the whole path over HTTP: an account created with `Tela-Sukat-7381` and the Temporary flag signs in, verifies the code and gets `next: set-new-password, reason: temporary` with no session and no cookie; `/api/v1/site-settings` is 401; set-new with the ticket cookie and `X-CSPS-CSRF` answers 200 with the session and refresh cookie, clears the ticket cookie, the access token works, the flag is cleared, the "Your CSPS password was changed" email (no "signed out" line) is in the sink, `auth.password-changed` and `auth.signed-in` are audited, and a later sign-in with the new password goes straight to signed-in. `SetNewPasswordHandler`, the request and its validator, the `set-new` action (`[RequireCsrfHeader]`, `[IdempotencyExempt]` with the written reason), registrations, the matrix row, the anonymous allow-list key, the idempotency allow-list entry and the refreshed API contract landed in the GREEN commit.
- **Rules and D-18 (Task 2):**
  - `SetNewPasswordHandlerTests` (16 cases): missing or unknown ticket, a sign-in that has not passed the code step, a challenge at its 30-minute expiry, a missing, deactivated or locked account, empty password, policy rejections, breach and common-password rejections (nothing saved), skipped breach check (recheck marked, `auth.breach-check-unavailable`), the full success path in one transaction, spend-first ordering, a lost race, rollback and audit hygiene.
  - `SignInHandlerTests` (+9): the re-check never runs on any failure branch or when nothing is pending; a breach sets the flag with reason Breach, clears the mark, audits `auth.password-breach-found` and still sends the code; clean clears the mark only; unavailable leaves it pending.
  - `BreachRecheckTests` (HTTP, 4): breached goes to set-new-password with reason breach and can then complete it; clean is cleared and signs in; `Hibp-Down#2026` stays pending and sign-in completes; a wrong password never triggers the re-check.
  - `MustChangePasswordTests` (+6): no ticket, no code step, single use (a replay with the captured ticket is 401), a refused breached password keeps the step open and the temporary password is then accepted as any valid one, deactivated after the code step, missing CSRF header.
  - `TestingFixturesEndpointTests`: both new states create an active, confirmed account with the flag and reason set.

## Verification

| Check | Result |
| --- | --- |
| Csps.Application.UnitTests | 306 passed |
| Csps.Server.IntegrationTests | 587 passed (the Idempotency, Authorization, OpenApiSnapshot, MustChangePassword and BreachRecheck classes all included) |
| Csps.Infrastructure.IntegrationTests | 322 passed, 1 skipped (the live HIBP test, by design) |
| `npm --prefix tools/openapi-gen run check` | passes (types match the snapshot) |
| Build | 0 warnings, 0 errors |
| Acceptance greps | `"set-new"` in PasswordController 1, `password/set-new` in the allow-list 1, `, false)` (SessionsEnded false) in the handler 1, `AuditActions.PasswordBreachFound` in SignInHandler 1, `must-change-breach` in the fixtures controller 2 |

Not measured: Application line coverage (the `--coverlet` run did not start from the test project directory; the report tooling was not set up for a single-plan run). Every branch of the new handler and of the D-18 step has a unit test.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written. Small additions beyond the plan text:

- A **locked** account also gets 401 at set-new (the plan listed only inactive). Mirrors the code step, so a pause applied between the two steps still holds. Covered by a unit test.
- `AuditActions.PasswordBreachFound` doc comment now also describes the late finding (D-18).
- `AuthClient` (test helper, not in the plan's file list) gained `SetNewPasswordAsync`, `CreateStaffWithPasswordAsync`, `SignInThroughCodeAsync` and `TicketOf`.

### Process

**1. [Process] Several Task 2 HTTP tests passed on arrival.** Task 1's handler already implements the ticket, expiry, account-state, rule and single-use behaviour, so the `MustChangePasswordTests` additions in the Task 2 RED commit passed immediately. The genuine RED was the D-18 behaviour (two `BreachRecheckTests` failed at runtime) and the `SignInHandler` constructor (the unit project did not compile). The extra tests are regression guards for behaviour delivered in Task 1.

## Known Stubs

None.

## Threat Flags

None. `set-new` is the only new endpoint and it is in the plan's threat model (T-04-74, T-04-75, T-04-76). T-04-74 is mitigated and tested (no session before a valid new password; set-new needs a code-verified, unexpired, single-use challenge). T-04-75 is mitigated by the D-18 re-check and the full rule on set-new.

## Decisions for the owner

1. **Requirements not ticked.** AUTH-09, AUTH-11, AUTH-02 and AUDIT-01 each still depend on later plans (the S3 screen in 04-31, the invitation and change-password flows, the audit viewer), so none is marked complete here.
2. **Locked accounts at set-new** answer the same 401 as an expired sign-in. If you would rather let a locked person finish the password change once the lock ends, that is a one-line removal; I chose the conservative option.

## Self-Check: PASSED

- Created files exist: SetNewPasswordRequest.cs, SetNewPasswordRequestValidator.cs, SetNewPasswordHandler.cs, SetNewPasswordHandlerTests.cs, MustChangePasswordTests.cs, BreachRecheckTests.cs (all FOUND).
- Commits are ancestors of HEAD: b1aa0e7 (RED 1), 65f06bb (GREEN 1), 283ed3e (RED 2), 8bf2e75 (GREEN 2).
