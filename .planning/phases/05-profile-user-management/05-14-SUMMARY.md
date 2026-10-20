---
phase: 05-profile-user-management
plan: 14
subsystem: api
tags: [email-change, account-token, confirmation-link, audit, prof-02, d-24, d-25]
created: 2026-10-18T00:58:00-05:00
updated: 2026-10-18T00:58:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-11 stamp interceptor keep rule; 05-12 current-password path and ProfileErrors; 05-09 ProfileController and PendingEmail column"
provides:
  - "POST /api/v1/profile/email-change (Staff, Idempotency-Key, Reset rate limit): current password, pending address, link to the new address, notice to the old one, 200 with the profile"
  - "POST /api/v1/profile/email-change/confirm (anonymous, Idempotency-Key): spends the link and moves Email and UserName; 404 email-change.invalid for every dead link"
  - "AccountTokenPurpose.EmailChange = 3 and AuthSettings.EmailChangeLinkLifetime (24 hours)"
  - "IUserAccounts.SetPendingEmailAsync and ApplyPendingEmailAsync (EmailApplyOutcome Applied, Taken, NothingPending)"
  - "RequestEmailChangeHandler, ConfirmEmailChangeHandler, RequestEmailChangeRequest(+Validator), EmailChangeTokenRequest, EmailChangeResponse, EmailChangeErrors"
  - "EmailChangeConfirmEmail and EmailChangeNoticeEmail (AuthEmailKind 8 and 9), AppLinksOptions.ConfirmEmailLink"
  - "Audit codes profile.email-change-requested and profile.email-changed (user id only, no detail)"
affects: [05-15 resend/cancel/taken, 05-16 confirm page, 05-18 Change Email dialog, 05-31 email review, 05-39 request rules, 05-40 Manager-initiated change]

actuals:
  tokens: 26000
  tasks: 2
  commits: 3
plan_head_before: 91576ee80bf17ce2e408cafe598f082f70e2d456
plan_head_after: a74ac9b17e6a7cac497425279e754a3c03622edf

tech-stack:
  added: []
  patterns:
    - "A bearer-link confirm applies the change first and spends the link after, so a change that cannot apply leaves the link alone and answers the one invalid 404"
    - "A second unstamped save puts the account itself on record as last changer, because the stamp interceptor nulls an unchanged UpdatedById when nobody is signed in"
    - "Pending-address set and apply retry on Identity's ConcurrencyFailure by reloading, since the pending address is not version-guarded"

key-files:
  created:
    - src/Csps.Application/Profile/RequestEmailChangeHandler.cs
    - src/Csps.Application/Profile/RequestEmailChangeRequest.cs
    - src/Csps.Application/Profile/RequestEmailChangeRequestValidator.cs
    - src/Csps.Application/Profile/ConfirmEmailChangeHandler.cs
    - src/Csps.Application/Profile/EmailChangeTokenRequest.cs
    - src/Csps.Application/Profile/EmailChangeErrors.cs
    - tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs
    - tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs
  modified:
    - src/Csps.Domain/Identity/AccountToken.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Auth/AuthSettings.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/AppLinksOptions.cs
    - src/Csps.Server/Controllers/ProfileController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs
    - tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "Confirm applies the pending address before it spends the link: a Taken or NothingPending outcome returns the invalid 404 and writes nothing, so 05-15 can decide what a taken address does to the link"
  - "Confirm with no body answers 404 email-change.invalid for every caller (matrix row), not the 400 the plan guessed, because every confirm failure is the one invalid answer"
  - "Both emails are written to the UI-SPEC copy now (the plan text asks for it), so 05-39's template work is a review of finished copy"
  - "The wrong-current-password branch is the plain check with no failed-count; 05-39 moves it into CurrentPasswordCheck where the lockout counting lands"
  - "No schema change: PendingEmail and the AccountTokens purpose byte already exist"

patterns-established:
  - "Email-change token machinery is purpose-based on AccountTokens, so 05-40's Manager-initiated change can reuse AccountToken.Create(EmailChange), the confirm handler and the two email records unchanged (D-45's save-at-once option is not in this plan)"

requirements-completed: [PROF-02]

coverage:
  - id: D1
    description: "A signed-in staff member asks to change their email: the right current password, a pending address on the profile, a confirmation link to the new address, a notice to the old one, and no change to the sign-in email yet"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#RequestingAChangeEmailsTheNewAddressALinkAndTheOldOneANoticeAndChangesNoSignIn"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs#ARequestDoesEveryEffectInOneTransaction"
        status: pass
    human_judgment: false
  - id: D2
    description: "Confirming the emailed link moves Email and UserName to the pending address, clears it, rotates the edit version, records the account as last changer, and sign-in then works with the new email only"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#ConfirmingTheLinkMovesTheSignInEmailAndClearsThePendingOne"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#TheLastChangerIsTheAccountItselfEvenAfterAnEarlierSelfEdit"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-25: the link is hashed, single-use and lasts 24 hours (live at 24 h minus 1 ms, dead at 24 h); every malformed, unknown, used, replaced, expired or blocked-account link gets the same 404 email-change.invalid"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#TheLinkLastsTwentyFourHoursAndIsStoredAsAHash"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#AConfirmedLinkIsDeadTheSecondTime"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs#TheLinkIsLiveJustBeforeTwentyFourHoursAndDeadAtTwentyFourHours"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER-06 / D-40: profile.email-change-requested and profile.email-changed target the User id with no detail, and no address is written to any audit entry"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#TheChangeIsAuditedByUserIdWithNoAddressAndNoDetail"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wording of the confirm and notice emails is built as the UI-SPEC writes it but is not yet approved by the owner (D-48)"
    verification: []
    human_judgment: true
    rationale: "Owner wording review is scheduled for 05-31; no test can approve wording"

duration: 22min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 14: Change email through a confirmation link Summary

**A staff member changes their sign-in email by entering the current password, opening a 24-hour single-use link sent to the new address, and confirming it; the old address gets a notice, the sign-in email moves only on confirmation, and the audit records user ids only.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-18T00:33:00-05:00 (approximate)
- **Completed:** 2026-10-18T00:55:00-05:00
- **Tasks:** 2 (a tracer and a characterization task)
- **Files modified:** 27 (8 created, 19 modified), plus this summary and the deferred-items note

## Accomplishments

- `POST /api/v1/profile/email-change` and `POST /api/v1/profile/email-change/confirm` work end to end: request answers the profile with `pendingEmail`, the new address gets "Confirm your new CSPS email" with a `/admin/confirm-email#token=` link, the old one gets "Your CSPS email is being changed", sign-in keeps using the old email until the confirm, and after it only the new email signs in.
- The link is an `AccountToken` with purpose `EmailChange = 3`, SHA-256 at rest, 24 hours (`AuthSettings.EmailChangeLinkLifetime`), single use, one live link at a time (older ones are revoked inside the per-account lock), and dead for a blocked account.
- The confirm moves `Email`, `UserName` and their normalized forms, clears `PendingEmail`, rotates `EditVersion`, and leaves the account itself as "Last changed by" even after an earlier self-edit.
- Both emails use the UI-SPEC contract copy and a link builder (`AppLinksOptions.ConfirmEmailLink`); the matrix, rate-limit, idempotency-coverage and OpenAPI/TS contract all include the new routes.
- Full suites at the end: Server integration 763, Infrastructure integration 468 (1 live-HIBP skip), Application 507, Domain 592, Architecture 217, all passing; coverage gate: Domain 100% line and branch, Application 99.5% line; `npm --prefix tools/openapi-gen run check` passes; solution builds with 0 warnings.

## Task Commits

1. **Task 1 (tracer): request, link, confirm**
   - RED `fbe00e0` test(05-14): change my email through a confirmation link (RED)
   - GREEN `fc934cc` feat(05-14): email change applies only after the new address confirms (PROF-02, D-25)
2. **Task 2: handler unit coverage**
   - `a74ac9b` test(05-14): email change handler units (characterization of the GREEN handlers)

**Plan metadata:** the docs(05-14) commit that holds this file.

## TDD Gate Compliance

Task 1 has a `test(05-14)` commit before the `feat(05-14)` commit. Task 2's 41 tests all passed on their first run against Task 1's handlers, so they are characterization tests with no separate RED or fix commit, as the plan allows. No REFACTOR commit was needed.

RED evidence (xunit.v3 on Microsoft Testing Platform is not a report format `gsd check tdd-red-evidence` reads, so the evidence is the real run plus a semantic check): `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChangeTests"` ran 18 tests, 17 failed and 1 passed. Every failure was on the planned assertion for the missing endpoints (200 or 404 `email-change.invalid` expected, a framework 404 received, or a setup call that expected 200 from the request route). The passing test (`TheTokenOfAnotherPurposeCannotConfirmAnEmailChange`) expects a 404 that the missing route also gives; it only becomes meaningful at GREEN, where the purpose-bound lookup produces that 404. Semantic assessment: the target tests executed and failed for the intended reason (the routes do not exist), with no load or fixture fault.

The `AuthSettingsTests` default and validation cases were added in the GREEN commit, not the RED one, because `AuthSettings.EmailChangeLinkLifetime` does not exist before GREEN and the test would not compile. The 24-hour lifetime was already under RED through `TheLinkLastsTwentyFourHoursAndIsStoredAsAHash`.

## Files Created/Modified

- `src/Csps.Application/Profile/RequestEmailChangeHandler.cs` - password check, then one transaction: account lock, revoke open links, pending address, 24-hour token, confirm and notice emails, audit; answers the profile.
- `src/Csps.Application/Profile/ConfirmEmailChangeHandler.cs` - find the link, require it live and the account unblocked, lock, apply the pending address, spend the link, audit; one invalid answer for everything else.
- `src/Csps.Application/Profile/RequestEmailChangeRequest.cs`, `RequestEmailChangeRequestValidator.cs`, `EmailChangeTokenRequest.cs` (with `EmailChangeResponse`), `EmailChangeErrors.cs` - the forms, the client-mirrored rules (required, shape, 256 characters, current password required) and the 404 value.
- `src/Csps.Infrastructure/Identity/UserAccounts.cs` - `SetPendingEmailAsync` and `ApplyPendingEmailAsync` (taken check, Identity duplicate and unique-index handling, edit-version rotation, last-changer correction).
- `src/Csps.Application/Email/AuthEmail.cs`, `src/Csps.Infrastructure/Email/EmailRenderer.cs`, `AppLinksOptions.cs` - the two records, templates and the confirm link.
- `src/Csps.Server/Controllers/ProfileController.cs`, `ApplicationRegistration.cs`, `AuthRegistration.cs` - the two routes and registrations.
- `src/Csps.Domain/Identity/AccountToken.cs`, `AuditActions.cs`, `src/Csps.Application/Auth/AuthSettings.cs`, `src/Csps.Application/Ports/IUserAccounts.cs` - the purpose, the codes, the lifetime and the port.
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract.
- Tests: `EmailChangeTests` (18 integration), `EmailChangeHandlerTests` (41 unit), matrix rows, rate-limit rows, audit, settings, email and renderer tests.

## Decisions Made

See `key-decisions` above. The ones to remember: confirm applies before it spends (so 05-15 owns what a taken address does to the link), and the wrong-password branch is deliberately the plain check until 05-39 shares the counted one with the password change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Confirm with no body is 404 for every caller, not 400**
- **Found during:** Task 1 (GREEN, authorization matrix)
- **Issue:** The plan asks for matrix row "confirm: 400 for all with no body". The matrix client always sends an Idempotency-Key, and with no body the token is missing, which the plan itself says is the single `email-change.invalid` 404 (as for the invite check).
- **Fix:** The row expects 404 for Anonymous, Admin and Manager, with a comment saying why.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`
- **Verification:** `*Authorization*` (132 tests) pass.
- **Committed in:** `fc934cc`

**2. [Rule 1 - Bug] The stamp interceptor would have recorded "System" as last changer**
- **Found during:** Task 1 (design, before GREEN)
- **Issue:** With nobody signed in, `RecordStampInterceptor` overwrites an `UpdatedById` that code left unchanged with null. A staff member who had ever edited their own name (UpdatedById already themselves) would show "System" after an anonymous confirm, against the plan's "Last changed by is the account's own user". The same applies if another user's session rides along on the confirm call.
- **Fix:** `ApplyPendingEmailAsync` checks `UpdatedById` after the first save and, when it is not the account, sets it in a second save that leaves the edit version alone (so it is not a staff edit and is not stamped).
- **Files modified:** `src/Csps.Infrastructure/Identity/UserAccounts.cs`
- **Verification:** `TheLastChangerIsTheAccountItselfEvenAfterAnEarlierSelfEdit`.
- **Committed in:** `fc934cc`

**3. [Rule 3 - Blocking] Validator registered in AuthRegistration, not ApplicationRegistration**
- **Found during:** Task 1
- **Issue:** All request validators are registered in `AuthRegistration.cs` (as 05-12 also found); the plan lists only `ApplicationRegistration.cs`.
- **Fix:** Handlers in `ApplicationRegistration.cs`, the validator in `AuthRegistration.cs`.
- **Committed in:** `fc934cc`

**4. [Rule 2 - Missing] Rate-limit coverage rows and existing enumerating tests**
- **Found during:** Task 1
- **Issue:** `RateLimitTests.LimitedEndpoints`, `AuthEmailTests`, `EmailRendererTests.AllKinds`, `AuditActionsTests` and `AuthSettingsTests` enumerate every route, kind, code or setting, so they needed the new entries (none are in the plan's file list).
- **Fix:** Added both routes (limit 10, the Reset policy) and the new kinds, codes and setting.
- **Verification:** all suites pass.
- **Committed in:** `fc934cc`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** All needed for correctness or for existing enumerating tests to keep covering the new surface. No scope creep; docs (`audit-log.md`, `auth.md`) stay with 05-39 as the plan says.

## Issues Encountered

- Two of the 41 first-run unit tests failed on test-harness mistakes (a shared in-memory link state across the conflict retry, and a helper asserting an unspent link in a test that spent it), not on the handlers; the harness now returns a fresh link copy on a retry, like the real store.
- The first shell attempt to write the handlers failed on heredoc quoting; they were written with the file tool instead. No code was affected.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: stored-body-hash | src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs | The two new routes also store an unsalted SHA-256 of their body for 24 hours (the current password for the request, the link token for the confirm). Added to `deferred-items.md` beside the 05-12 entry for the security review. |

The new anonymous POST (`email-change/confirm`) is the surface the plan's threat model (T-05-37, T-05-38) already covers: bearer token in the body, hashed at rest, fragment-only link, one invalid answer, the Reset rate limit and a required Idempotency-Key. It is on the matrix's anonymous allow-list.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-39 can extract `CurrentPasswordCheck` from `ChangePasswordHandler` and use it in `RequestEmailChangeHandler` (the wrong-password branch is one `if` with `ProfileErrors.WrongPassword`), add the same-address and taken-address rules, and add the read-only check route; the two emails already carry the contract copy, so its renderer work is a review plus the exact-text tests.
- 05-15 maps the `Taken` outcome of `ApplyPendingEmailAsync` to `email-change.taken` and decides about spending the link there; today it returns the invalid 404 and leaves the link unspent.
- 05-40 can reuse `AccountToken.Create(EmailChange)`, `ConfirmEmailChangeHandler` and the two email records for a Manager-initiated change.
- The confirm page (05-16) posts `{ token }` with a fresh `Idempotency-Key` and no session; it need not send an Authorization header.
- The notice and confirm wording is built as written in the UI-SPEC and waits for the owner's review in 05-31 (D-48).

## Self-Check: PASSED

- Created files exist (checked with `[ -f ]`): the six Application files, `EmailChangeTests.cs`, `EmailChangeHandlerTests.cs` and this summary.
- Commits exist on the branch (`git merge-base --is-ancestor`): `fbe00e0`, `fc934cc`, `a74ac9b`.
- Acceptance greps: `EmailChange = 3` 1; `EmailChangeLinkLifetime` 2; audit codes 2; `/admin/confirm-email` 1; `ConfirmEmailLink` in the renderer 1; `ConfirmEmailChangeHandler` in the unit tests 1.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
