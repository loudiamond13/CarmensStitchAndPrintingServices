---
phase: 05-profile-user-management
plan: 39
subsystem: api
tags: [email-change, current-password, lockout, link-check, email-copy, prof-02, prof-03, d-24, d-25, d-41]
created: 2026-10-18T01:30:00-05:00
updated: 2026-10-18T01:30:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-14 request and confirm handlers, EmailChangeErrors.Invalid, the two email records and templates; 05-12 ChangePasswordHandler and ProfileErrors"
provides:
  - "CurrentPasswordCheck: one shared current-password rule (lock test, counted wrong tries, the one lockout email and audit) used by the password change and the email change"
  - "POST /api/v1/profile/email-change: 400 on newEmail for the caller's own address (any case) or an address another live account uses, only after the password is right; 429 profile.password-locked on the locking try; a correct password clears the wrong count"
  - "POST /api/v1/profile/email-change/check (anonymous, read-only, Reset rate limit, idempotency-exempt): 200 { newEmail } or the one 404 email-change.invalid"
  - "CheckEmailChangeHandler, EmailChangeErrors.AddressTaken, RequestEmailChangeRequestValidator.SameEmail and CurrentEmailKey"
  - "Docs: audit rows for profile.email-change-requested and profile.email-changed; the three routes, the 24-hour link and the error code in docs/api/auth.md"
affects: [05-15 resend/cancel/taken, 05-16 confirm page, 05-18 Change Email dialog, 05-31 email review, 05-40 Manager-initiated change]

actuals:
  tokens: 21400
  tasks: 2
  commits: 4
plan_head_before: b868b9640d3d5d7410ac3de1cdda7ca26145be19
plan_head_after: 7ee0bfb793f626338cbe1bf02037bef8b77aa8bf

tech-stack:
  added: []
  patterns:
    - "A request-time rule that needs the account (the caller's own address) reaches the shared FluentValidation validator through ValidationContext.RootContextData, so the browser-mirrored rules stay in one validator"
    - "A security proof shared by two handlers (CurrentPasswordCheck) returns Result with the ProfileErrors outcome, and the caller returns that error unchanged"
    - "A taken-address answer is checked after the password proof, so it is never an enumeration oracle for someone without the password"

key-files:
  created:
    - src/Csps.Application/Profile/CurrentPasswordCheck.cs
    - src/Csps.Application/Profile/CheckEmailChangeHandler.cs
  modified:
    - src/Csps.Application/Profile/ChangePasswordHandler.cs
    - src/Csps.Application/Profile/RequestEmailChangeHandler.cs
    - src/Csps.Application/Profile/RequestEmailChangeRequestValidator.cs
    - src/Csps.Application/Profile/EmailChangeErrors.cs
    - src/Csps.Server/Controllers/ProfileController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs
    - tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs
    - tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - docs/api/auth.md

key-decisions:
  - "The request handler loads the account before it validates, so the validator can refuse the caller's own address; order is session, account, form rules, password proof, taken check, then the transaction"
  - "A taken address is looked up with IUserAccounts.FindByEmailAsync and counts only when the holder is not deleted; soft delete scrambles the email (D-07, D-10), so a freed address finds nobody. No new port method"
  - "The right current password resets the wrong-password count in the request transaction, as the password change does and as sign-in does"
  - "The 429 that locks the account keeps its count through IdempotencyOutcome.KeepChanges, the same as the password route"
  - "The check reads the pending address through IUserDirectory, so a link whose account has nothing pending is the same invalid answer"

patterns-established:
  - "CurrentPasswordCheck is the single place for the current-password proof; 05-40 and later security actions call it instead of re-implementing the lockout count"

requirements-completed: [PROF-02, PROF-03]

coverage:
  - id: D1
    description: "The email-change request checks the current password exactly as the password change does: wrong tries count toward the shared five-try lock, the locking try answers 429 profile.password-locked, a correct password clears the count"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#FiveWrongCurrentPasswordsLockTheAccountAndTheFifthAnswers429"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#WrongPasswordsOnTheEmailChangeAndThePasswordChangeShareOneCount"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs#TheWrongPasswordThatLocksTheAccountAnswers429AndSendsTheOneLockoutEmail"
        status: pass
    human_judgment: false
  - id: D2
    description: "The new address must not be the caller's own (any case) and must not be used by another account that is not deleted; an address freed by a soft delete is accepted; a taken address is revealed only after the password is right"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#TheCurrentEmailInAnotherLetterCaseIsRefused"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#AnAddressAnotherAccountUsesIsRefusedAndNothingIsSent"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#AnAddressFreedByASoftDeleteIsAccepted"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-24: a new request replaces the pending one and the older link dies"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#ANewRequestReplacesThePendingOneAndKillsTheOldLink"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-25: the anonymous read-only check answers { newEmail } for a live link and the one 404 email-change.invalid for every dead link, with or without a session, and it spends nothing"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#ALiveLinkIsCheckedWithNoSessionAndTheCheckSpendsNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangeTests.cs#TheCheckWorksUntilTheLastMomentAndIsInvalidAtExactlyTwentyFourHours"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyCoverageTests.cs#EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason"
        status: pass
    human_judgment: false
  - id: D5
    description: "The confirm and notice emails carry the UI-SPEC contract text, the Manila request time and device, the right buttons and targets, and HTML-encoded addresses"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#TheConfirmEmailGoesToTheNewAddressWithTheContractWordsAndTheTokenOnlyInTheLink"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#TheNoticeGoesToTheOldAddressWithTheManilaTimeTheDeviceAndNoToken"
        status: pass
    human_judgment: false
  - id: D6
    description: "The wording of the confirm and notice emails is built as the UI-SPEC writes it but is not yet approved by the owner (D-48)"
    verification: []
    human_judgment: true
    rationale: "Owner wording review is scheduled for 05-31; no test can approve wording"

duration: 22min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 39: Email change request rules, link check and email copy Summary

**The email change now asks for the same counted, lockable current-password proof as a password change (one shared `CurrentPasswordCheck`), refuses the caller's own or a taken address only after that proof, and the confirm page can look a link up through a read-only anonymous check that gives every dead link the same 404.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-18T00:58:00-05:00 (approximate)
- **Completed:** 2026-10-18T01:20:00-05:00
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 19 (2 created, 17 modified), plus this summary

## Accomplishments

- `CurrentPasswordCheck` (Application/Profile) holds the lock test, the wrong-password count, and the one lockout email and audit entry. `ChangePasswordHandler` and `RequestEmailChangeHandler` both call it, so five wrong tries across the two routes lock the account and the locking try answers `429 profile.password-locked` with `Retry-After` on both.
- `POST /api/v1/profile/email-change` refuses the caller's own address in any letter case ("This is already your email.") and an address another live account uses ("Another account already uses this email."), both on `newEmail`. The taken check runs after the password is right, so it is no way to learn which emails exist. A soft-deleted account's scrambled row frees its old address. A correct password clears the wrong-password count.
- A new request replaces the pending one: the older link answers 404 on confirm and the newer works (pinned end to end).
- `POST /api/v1/profile/email-change/check` is anonymous, read-only, on the Reset rate limit and idempotency-exempt with the reason "Read-only lookup; changes nothing." It answers `200 { newEmail }` for a live link and the one `404 email-change.invalid` for an expired (exactly at 24 hours), used, replaced, other-purpose, deactivated-account, missing or malformed link. It works with no session or another person's session and spends nothing.
- The confirm and notice email templates already carried the UI-SPEC copy from 05-14; the renderer tests now pin the exact subject, preheader, heading, body lines, Manila request time, device line, button and target, and HTML encoding of both addresses.
- Docs: audit rows for `profile.email-change-requested` and `profile.email-changed` (no detail, user id only), the three email-change routes, the 24-hour link, the rate-limit grouping and `email-change.invalid` in `docs/api/auth.md`.
- Final runs: Server integration 787, Infrastructure integration 475 (1 live-HIBP skip), Application 533, Domain 592, Architecture 217, all passing. Coverage gate: Domain 100% line and branch, Application 99.6% line. `npm --prefix tools/openapi-gen run check` passes. Solution builds with 0 warnings.

## Task Commits

1. **Task 1 (tracer): request rules, shared password check, replacement**
   - RED `338a100` test(05-39): email change request rules (RED)
   - GREEN `2849de0` feat(05-39): email change checks the current password and replaces a pending change (D-24)
2. **Task 2: link check, emails, docs**
   - RED `550259d` test(05-39): email change link check and emails (RED)
   - GREEN `7ee0bfb` feat(05-39): email change link check; confirm and notice emails (D-25)

**Plan metadata:** the docs(05-39) commit that holds this file.

## TDD Gate Compliance

Both tasks have a `test(05-39)` commit before their `feat(05-39)` commit; no REFACTOR commit was needed. xunit.v3 on Microsoft Testing Platform is not a report format `gsd check tdd-red-evidence` reads, so the evidence is the real runs plus a semantic check.

- **Task 1 RED:** `*EmailChangeHandlerTests` 51 tests, 6 failed; `*EmailChangeTests` 28 tests, 6 failed. Every failure was on a planned assertion: the fifth wrong password answered 400 instead of 429, the shared count (2 + 2 + 1) did not lock, the own-address and taken-address requests answered 200 instead of 400, and the unit cases saw no `RecordFailedPasswordAsync`, no lockout email and no field error. The remaining new tests (soft-deleted address accepted, replacement, taken address hidden behind a wrong password, the 05-14 behaviours) passed at RED because 05-14 already implemented them; they are characterization of the existing behaviour and guards for the GREEN refactor. Semantic assessment: the target tests executed and failed for the intended reason, with no load or fixture fault. (A first RED attempt hit a banned-API analyzer error on `DateTimeOffset.UtcNow` in a test helper; that was a test mistake fixed before the RED run counted.)
- **Task 2 RED:** `*EmailChangeTests` 38 tests, 8 failed (the live-link, other-session, expiry boundary, used or replaced link, and the four missing or malformed token cases, all on the missing route); `AuthorizationMatrixTests.DiscoveredEndpointsAreFullyCovered` and `IdempotencyCoverageTests.EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason` failed because the allow-listed route did not exist. The renderer tests passed at RED (05-14 shipped the copy). Semantic assessment: failures were the planned assertions for a route that did not exist.
- **Unit tests for `CheckEmailChangeHandler`** were added in the GREEN commit, not the RED one, because the class does not exist before GREEN and the test project would not compile (a compile error is not a valid RED). The integration tests carry the RED for it.

## Files Created/Modified

- `src/Csps.Application/Profile/CurrentPasswordCheck.cs` - the shared proof: locked account refused without a password check, wrong password counted, lockout email and audit on the locking try.
- `src/Csps.Application/Profile/CheckEmailChangeHandler.cs` - read-only link lookup.
- `src/Csps.Application/Profile/ChangePasswordHandler.cs`, `RequestEmailChangeHandler.cs` - use the shared check; the request now orders account, form rules, password, taken check, transaction.
- `src/Csps.Application/Profile/RequestEmailChangeRequestValidator.cs`, `EmailChangeErrors.cs` - the same-address rule (context key `currentEmail`) and the `AddressTaken` error.
- `src/Csps.Server/Controllers/ProfileController.cs`, `Composition/ApplicationRegistration.cs` - the check route, the 429 keep-changes on the request route, registrations.
- Tests: `EmailChangeTests` (38), `EmailChangeHandlerTests` (67), `EmailRendererTests`, matrix, rate-limit and idempotency allow-list rows, `ChangePasswordHandlerTests` constructor.
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed twice (the 429 on the request, then the check route).
- `docs/api/auth.md`, `docs/operations/audit-log.md` - as listed above (timestamps updated).

## Decisions Made

See `key-decisions` above. The ones to remember: a taken address is only revealed after a correct password; the right password clears the wrong count; and the same-address rule lives in the shared validator through the validation context, so the browser-side zod mirror (05-18) has one server rule to copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] A correct current password clears the wrong-password count**
- **Found during:** Task 1 (writing the "correct password resets the count" case that the password change already has)
- **Issue:** Without it, a person's typos on earlier days would add up toward a lock that a successful request should have ended. The plan says "exactly as the 05-12 password change does", and the password change resets the count.
- **Fix:** `RequestEmailChangeHandler.StartAsync` calls `ResetFailedCountAsync` first in its transaction.
- **Files modified:** `src/Csps.Application/Profile/RequestEmailChangeHandler.cs`
- **Verification:** `TheCorrectCurrentPasswordResetsTheWrongCount` (integration) and `TheCorrectPasswordIsNotCountedAndClearsTheCountSoFar` (unit).
- **Committed in:** `2849de0`

**2. [Rule 2 - Missing] The 429 that locks the account must keep its failed count**
- **Found during:** Task 1
- **Issue:** A 429 is not stored by the idempotency gate, so without `IdempotencyOutcome.KeepChanges` the transaction that counted the fifth wrong password would be rolled back and the account would never lock (the password route already handles this).
- **Fix:** The same `KeepChanges` call in `ProfileController.RequestEmailChange`.
- **Files modified:** `src/Csps.Server/Controllers/ProfileController.cs`
- **Verification:** `FiveWrongCurrentPasswordsLockTheAccountAndTheFifthAnswers429` (sign-in is then refused).
- **Committed in:** `2849de0`

**3. [Rule 3 - Blocking] Enumerating tests and 05-14 test assertions needed updating**
- **Found during:** Task 1 and Task 2
- **Issue:** `ChangePasswordHandler` no longer takes `AuthSettings` (the lockout duration moved into `CurrentPasswordCheck`), so its unit harness had to build the new dependency; 05-14's "invalid form" unit case asserted the account was never loaded, which no longer holds because the same-address rule needs the account; a wrong password now commits its own count transaction, so `AssertNothingChangedAsync` takes the expected commit count; the rate-limit, matrix and idempotency allow-list enumerations needed the new route.
- **Fix:** Updated those tests (none in the plan's file list except the allow-list and matrix); the "invalid form" case now asserts the password is never checked.
- **Files modified:** `tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs`, `EmailChangeHandlerTests.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs`
- **Committed in:** `2849de0`, `550259d`

**4. [Rule 3 - Blocking] `docs/api/auth.md` had no profile section**
- **Found during:** Task 2
- **Issue:** The plan asks for the 24-hour link "in docs/api/auth.md's token table", but the file had no email-change route text and its lifetimes table is the token table.
- **Fix:** Added the Lifetimes row, plus a short "Change my email" section for the three routes, the rate-limit grouping, the error code and the idempotency allow-list row, so the document matches the code.
- **Files modified:** `docs/api/auth.md`
- **Committed in:** `7ee0bfb`

---

**Total deviations:** 4 auto-fixed (2 Rule 2, 2 Rule 3)
**Impact on plan:** All needed for correctness, or for existing enumerating tests and the docs to cover the new surface. No scope creep.

## Issues Encountered

- A shell heredoc with unescaped quotes broke an inline Python edit on the first try; edits then went through small Node scripts that preserve line endings, and no source was affected.
- Soft delete is not built yet (it belongs to a later plan), so the freed-address test scrambles the row in the database the way D-07 and D-10 describe (`deleted-{id:N}@deleted.invalid`, deleted marker set). If the delete plan scrambles differently, this test's helper is the one place to match it.

## Known Stubs

None.

## Threat Flags

None new. The check route is the anonymous read-only surface T-05-39 covers: it spends nothing, answers one invalid 404, sits behind the Reset rate limit and takes the token in the body. The request route now closes T-05-103 (one `CurrentPasswordCheck`, shared lockout count). The stored-body-hash item from 05-14 in `deferred-items.md` applies unchanged to the request route; the new check route stores no idempotency record.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-16 (confirm page) can call `POST /api/v1/profile/email-change/check` on load with `{ token }` and no `Idempotency-Key`, show `newEmail`, and post to `.../confirm` from its button.
- 05-18 (Change Email dialog) can mirror in zod: required after trim, one `@` with text either side, at most 256 characters, not the current email case-insensitively ("This is already your email."); the taken-address and wrong-password messages come back from the server as field errors on `newEmail` and `currentPassword`, and a `429 profile.password-locked` with `Retry-After`.
- 05-15 maps the `Taken` outcome of `ApplyPendingEmailAsync` to its own code; this plan's `AddressTaken` is a request-time 400 on `newEmail`.
- 05-31: the owner reviews the rendered confirm and notice emails (D-48); the copy is built as the UI-SPEC writes it.

## Self-Check: PASSED

- Created files exist (checked with `[ -f ]`): `CurrentPasswordCheck.cs`, `CheckEmailChangeHandler.cs` and this summary.
- Commits exist on the branch (`git merge-base --is-ancestor`): `338a100`, `2849de0`, `550259d`, `7ee0bfb`.
- Acceptance greps: `CurrentPasswordCheck` in `ChangePasswordHandler.cs` 1 and `RequestEmailChangeHandler.cs` 1; "This is already your email." in the validator 1; the check route in `IdempotencyAllowList.cs` 1; `email-change.invalid` in `EmailChangeErrors.cs` 1; "24 hours" in `docs/api/auth.md` 2.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
