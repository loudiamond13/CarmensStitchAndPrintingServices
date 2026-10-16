---
phase: 04-identity-authentication
plan: 22
subsystem: api-auth
tags: [bootstrap-manager, invite, accept-invite, breach-check, fail-closed, d-14, d-29, auth-12, auth-11, auth-13, audit-01]
status: complete
created: "2026-10-15T04:45:00-05:00"
updated: "2026-10-15T04:45:00-05:00"

requires: ["04-21", "04-27", "04-18", "04-17", "04-12", "04-09", "04-08"]
provides:
  - "BootstrapManagerHandler (Csps.Application.Users): creates the first Manager with no password, queues the 72 h InviteEmail, audits user.bootstrap-manager-created and user.invited with no actor; refuses with bootstrap.manager-exists while an active Manager exists"
  - "POST /api/v1/auth/invite/check {token} -> 200 {email, firstName} or one 404 auth.invite-invalid 'This invite has expired' (idempotency-exempt, written reason)"
  - "POST /api/v1/auth/invite/accept {token, newPassword} -> 204, no session; 400 on the password, 404 invalid invite, 409 lost race, 422 auth.breach-check-unavailable (breach check fails closed, D-14)"
  - "IUserAccounts.ConfirmEmailAsync: following the invite confirms the address"
  - "Testing fixture state invited on POST /api/testing/staff: {userId, email, inviteToken}"
  - "Matrix rows, anonymous allow-list keys and idempotency allow-list entry; OpenAPI snapshot and web types refreshed (InviteLinkResponse)"
affects: [04-23, 04-30, 04-31, 04-35, 05-users]

requirements-completed: []

actuals:
  tokens: 23000
  tasks: 2
  commits: 4
plan_head_before: 4ba123226fda4ef68245bda48505cd2ed3a82e86
plan_head_after: ffbea2cdfaebd2e1b6e0a6a1d98d8ce546c95f8c

tech-stack:
  added: []
  patterns:
    - "Invite acceptance mirrors reset: spend the token and save first, then change the account, so a racing second request loses before any other change"
    - "A fail-closed refusal saves nothing and audits independently, so the attempt is recorded without keeping the invite from being used again"

key-files:
  created:
    - src/Csps.Application/Users/BootstrapManagerCommand.cs
    - src/Csps.Application/Users/BootstrapManagerCommandValidator.cs
    - src/Csps.Application/Users/BootstrapManagerHandler.cs
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Application/Auth/InviteTokenRequest.cs
    - src/Csps.Application/Auth/InviteLinkLookup.cs
    - src/Csps.Application/Auth/CheckInviteHandler.cs
    - src/Csps.Application/Auth/AcceptInviteRequest.cs
    - src/Csps.Application/Auth/AcceptInviteRequestValidator.cs
    - src/Csps.Application/Auth/AcceptInviteHandler.cs
    - src/Csps.Server/Controllers/InviteController.cs
    - tests/Csps.Application.UnitTests/Users/BootstrapManagerHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/AcceptInviteHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/CheckInviteHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/BootstrapSignInTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs
  modified:
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Application/Auth/ResetLinkLookup.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingFixturesEndpointTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The bootstrap Manager is created unconfirmed (as 04-08 designed for passwordless accounts); accepting the invite confirms the address through the new IUserAccounts.ConfirmEmailAsync, because following a link sent to that address is the proof"
  - "A fail-closed refusal is audited as auth.breach-check-unavailable (independent entry) so the outage is visible, but nothing else is saved and the invite stays usable"
  - "An unconfirmed account may accept its invite; a deactivated one gets the same 404 as every other dead invite"
  - "bootstrap.email-taken (422) when the address already has an account, instead of letting Identity throw"

patterns-established:
  - "InviteLinkLookup: one place that turns a token into a usable invite or null, shared by check and accept"

coverage:
  - id: C1
    description: "AUTH-12 local proof: empty migrated database, bootstrap, invite email, check, accept, sign-in with the emailed code as a Manager"
    requirement: "AUTH-12"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/BootstrapSignInTests.cs#AnEmptyDatabaseGetsItsFirstManagerByInviteAndTheManagerSignsInWithTheEmailedCode"
        status: pass
    human_judgment: false
  - id: C2
    description: "Invite lifetime and single use: 72 h edge, used, revoked, malformed, unknown and deactivated all give one 404"
    requirement: "AUTH-12"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs"
        status: pass
    human_judgment: false
  - id: C3
    description: "Breach check fails closed on invite acceptance (422, nothing saved, invite still usable) and refused passwords are 400"
    requirement: "AUTH-11"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs#WhenTheBreachListCannotBeReachedNothingIsSavedAndTheInviteStaysUsable"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/AcceptInviteHandlerTests.cs#AnUnreachableBreachListSavesNothingAndNeverSetsThePassword"
        status: pass
    human_judgment: false
  - id: C4
    description: "One-Manager guard: an active Manager blocks the bootstrap; both audit entries carry no actor"
    requirement: "AUTH-12"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/BootstrapManagerHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/BootstrapSignInTests.cs"
        status: pass
    human_judgment: false
  - id: C5
    description: "Authorization matrix and idempotency allow-list cover both new endpoints; the API contract and web types match"
    requirement: "AUTH-13"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests (Authorization, Idempotency, OpenApiSnapshot classes)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 40 min
completed: 2026-10-15
---

# Phase 4 Plan 22: Bootstrap Manager and Invite Acceptance Summary

An empty, freshly migrated database can now be signed into without seed data: `BootstrapManagerHandler` creates the first Manager with no password and queues a 72-hour, single-use invite email; `POST /api/v1/auth/invite/check` and `/accept` let the link holder set a first password under the full rule with the breach check failing closed; the Manager then signs in with password and emailed code. The guarded `bootstrap-manager` command and the runbook are plan 04-35.

## What was built

- **Tracer (Task 1):** `BootstrapSignInTests` runs the whole AUTH-12 path on a fresh `CSPS_Test_<guid>` database: the handler (resolved from the host's service scope) commits; the host's dispatcher delivers "Set up your CSPS staff account" with a link starting `https://localhost/admin/accept-invite#token=`; invite/check answers `{email, firstName: "Carmen"}`; invite/accept answers 204 with no cookies; password sign-in plus the emailed code gives a session with role Manager. `user.bootstrap-manager-created` and `user.invited` have no actor, `auth.invite-accepted` targets the new user. The GREEN commit holds the Users and Auth handlers, `InviteController`, registrations, matrix rows, allow-list entries and the refreshed contract.
- **Rules (Task 2):**
  - `InviteTests` (HTTP, 15 cases): used, expired, revoked, malformed, unknown and deactivated-user invites are the identical 404 `auth.invite-invalid` for check and accept; the invite works 1 ms before 72:00 and is dead at 72:00; `Hibp-Down#2026` is 422 `auth.breach-check-unavailable` with nothing saved, the invite still usable and one `auth.breach-check-unavailable` audit entry; breached, personal-information and too-short passwords are 400 on `newPassword` and leave the invite usable; a missing password is 400; accepting issues no cookie and only the new password signs in; the `invited` fixture state returns a token that accepts.
  - `AcceptInviteHandlerTests` (unit): fail-closed never calls `SetPasswordAsync`, spend-first ordering, every dead-invite reason, an unconfirmed account may accept, lost race reads as invalid, two lost races are busy, rollback, audit hygiene.
  - `CheckInviteHandlerTests` and `BootstrapManagerHandlerTests` (unit): the one-Manager guard, email taken, field errors and the 100-character name limit, trimmed input, token purpose and lifetime, both audit entries, rollback.
  - `TestingFixturesEndpointTests`: the `invited` state.

## Verification

| Check | Result |
| --- | --- |
| Csps.Application.UnitTests | 350 passed |
| Csps.Server.IntegrationTests | 610 passed (Idempotency, Authorization, OpenApi, BootstrapSignIn, Invite and TestingFixtures classes included) |
| Csps.Infrastructure.IntegrationTests | 322 passed |
| Csps.ArchitectureTests | 127 passed |
| Csps.Domain.UnitTests | 590 passed |
| `npm --prefix tools/openapi-gen run check` | passes (types match the snapshot) |
| Build | 0 warnings, 0 errors |
| Acceptance greps | `invite/check` in InviteController 1, `BreachCheckMode.FailClosed` in AcceptInviteHandler 1, `InviteLinkResponse` in api.generated.ts 2, `bootstrap.manager-exists` in BootstrapManagerHandler 1 (doc comment; the constant is in `UserErrors.cs`), `"invited"` in the fixtures controller 2, `auth.breach-check-unavailable` in AuthErrors 1 |

Not measured: Application line coverage (no single-plan coverage run set up). Every branch of the three new handlers has a unit test.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written. Small additions beyond the plan text:

- `IUserAccounts.ConfirmEmailAsync` (port plus `UserAccounts`), because sign-in needs a confirmed address and `CreateAsync` with no password leaves it unconfirmed (see Decisions).
- `UserErrors` (`bootstrap.manager-exists`, `bootstrap.email-taken`) and `InviteTokenRequest`/`InviteLinkLookup` as small shared types; `ResetLinkLookup.IsWellFormed` became `internal` so both lookups share the token-shape check.
- `AuthClient` (test helper) gained `CheckInviteAsync`, `AcceptInviteAsync` and `TokenOf`.

### Process

**1. [Process] Task 2's unit tests passed on arrival.** Task 1's handlers already implement the full rule set (the plan said "happy path here"), so the Task 2 unit tests are regression guards. The genuine Task 2 RED was the missing `invited` fixture state: 15 `InviteTests` and one `TestingFixturesEndpointTests` case failed before the GREEN commit.

**2. [Process] A Task 2 test bug fixed in the GREEN commit.** The first run of `AnyInviteThatDoesNotWorkIsTheSame404...("used")` asserted the password was still null, which is wrong for an invite that was legitimately accepted once. The assertion now skips the "used" case.

## Known Stubs

None.

## Threat Flags

None. The two endpoints and the handler are in the plan's threat model. T-04-77 is mitigated and tested (an active Manager refuses the bootstrap; both audit entries have no actor). T-04-80 is mitigated: 256-bit hashed single-use 72 h token, fragment-only link, one indistinguishable 404 for every dead invite, and the breach check fails closed.

## Decisions for the owner

1. **Email confirmation happens at accept, not at bootstrap.** The plan text says the bootstrap creates a "confirmed" Manager, but the port from 04-08 creates a passwordless account unconfirmed (the Phase 5 invitation flow was meant to confirm it). I kept that and made accepting the invite confirm the address, because following the emailed link is the proof of ownership and the same code then serves Phase 5 invites. Until the invite is accepted the account cannot sign in or be sent a reset link. If you want the account confirmed at bootstrap instead, it is one extra port call in the handler.
2. **Requirements not ticked.** AUTH-12 still needs the guarded command and runbook (04-35); AUTH-11, AUTH-13 and AUDIT-01 each still depend on later plans (the S6 screen, the audit viewer), so none is marked complete here.
3. **Dead-invite attempts are not audited.** There is no audit action for an invalid invite (unlike `auth.password-reset-link-invalid`), and the plan lists none, so none was added. Say if you want one.
4. **`bootstrap.email-taken`** is a 422 added so a reused address gives a plain answer instead of an Identity exception; plan 04-35 will want to show that message.

## Self-Check: PASSED

- Created files exist: all 16 files under key-files.created (FOUND).
- Commits are ancestors of HEAD: 24fce52 (RED 1), 9ca9634 (GREEN 1), 67c515e (RED 2), ffbea2c (GREEN 2).
