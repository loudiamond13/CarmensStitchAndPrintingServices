---
phase: 05-profile-user-management
plan: 15
subsystem: api
tags: [email-change, resend, cancel, taken-address, audit, prof-02, d-24, d-40]
created: 2026-10-18T01:40:00-05:00
updated: 2026-10-18T01:40:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-14 request and confirm handlers, IAccountTokens.RevokeOpenAsync, IUserAccounts.SetPendingEmailAsync and ApplyPendingEmailAsync, EmailChangeConfirmEmail; 05-39 CheckEmailChangeHandler and the current-password rule"
provides:
  - "POST /api/v1/profile/email-change/resend (Staff, Idempotency-Key, Reset rate limit): revokes the open link and emails a fresh 24-hour link to the pending address only; 204, or 404 email-change.none when nothing waits"
  - "DELETE /api/v1/profile/email-change (Staff): revokes the links and clears the pending address; 204 always, and no audit entry when nothing was pending"
  - "email-change.taken (409, 'This email can't be used.') from the link check and from confirm when another live account took the pending address; confirm also spends the link and clears the pending change"
  - "ResendEmailChangeHandler, CancelEmailChangeHandler, EmailChangeErrors.None and .Taken, AuditActions.ProfileEmailChangeCanceled; audit details resent and taken"
affects: [05-16 confirm page, 05-18 Details tab pending note and Change Email dialog, 05-31 email review, 05-40 Manager-initiated change]

actuals:
  tokens: 22300
  tasks: 2
  commits: 4
plan_head_before: e5002b72ee9985dfd50b3c83a1707594383e69ae
plan_head_after: 8a5f18c63373646848b7e043fd0a4b5b34764bc1

tech-stack:
  added: []
  patterns:
    - "A failed Result inside InTransactionAsync still commits, so a handler that must keep its writes on a failure answer (taken confirm) saves before it returns the error"
    - "A 4xx the idempotency gate does not store (409) needs IdempotencyOutcome.KeepChanges in the controller when the handler's writes must survive"
    - "A naturally idempotent DELETE takes no row version and answers 204 with no side effects when there is nothing to remove"

key-files:
  created:
    - src/Csps.Application/Profile/ResendEmailChangeHandler.cs
    - src/Csps.Application/Profile/CancelEmailChangeHandler.cs
    - tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs
    - tests/Csps.Application.UnitTests/Profile/EmailChangePendingHandlerTests.cs
  modified:
    - src/Csps.Application/Profile/EmailChangeErrors.cs
    - src/Csps.Application/Profile/CheckEmailChangeHandler.cs
    - src/Csps.Application/Profile/ConfirmEmailChangeHandler.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/ProfileController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - docs/api/auth.md

key-decisions:
  - "Resend and cancel read the pending address through IUserDirectory.GetProfileAsync inside the per-account link lock, so two racing calls run one after the other and only the newest link lives (T-05-40)"
  - "The taken check uses IUserAccounts.FindByEmailAsync and counts only a holder that is not deleted (soft delete scrambles the address); no new port method"
  - "Confirm on Taken saves its writes (pending cleared, link spent, audit canceled with detail taken) and returns the 409; the controller calls KeepChanges because the gate would otherwise roll a 409 back"
  - "Cancel records profile.email-change-canceled with no detail only when something was pending; DELETE takes no row version (recorded D-21-style deviation)"

patterns-established:
  - "Pending-change use cases lock the account's link row first, read the pending address second, write third"

requirements-completed: [PROF-02]

coverage:
  - id: D1
    description: "D-24: a resend revokes the open link, emails a fresh 24-hour link to the pending address only, and the first link stops working while the new one confirms"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#ResendEmailsAFreshLinkToThePendingAddressOnlyAndTheFirstLinkDies"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#TheResentLinkLastsAFreshTwentyFourHours"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/EmailChangePendingHandlerTests.cs#AResendDoesEveryEffectInOneTransaction"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-24: a cancel clears the pending change and kills the link; sign-in keeps using the current email; a repeat cancel answers 204 and writes nothing; a resend with nothing pending is 404 email-change.none"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#CancelClearsThePendingChangeKillsTheLinkAndKeepsTheCurrentEmail"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#CancelAgainAnswers204AndWritesNoNewAuditEntry"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#ResendWithNothingWaitingIsA404EmailChangeNone"
        status: pass
    human_judgment: false
  - id: D3
    description: "The address was taken before the link was used: check and confirm answer 409 email-change.taken, confirm spends the link and clears the pending change, the account's email is unchanged, and a Manager-locked or deleted account's link stays the invalid 404"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#ConfirmingATakenAddressIsA409SpendsTheLinkAndClearsThePendingChange"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#AnAddressTakenMeanwhileIsA409OnTheCheckAndTheAccountIsLeftAsItWas"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#AManagerLockedAccountsLiveLinkIsTheInvalidAnswerOnCheckAndConfirm"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs#AnAddressTakenMeanwhileSpendsTheLinkClearsThePendingAddressAndAnswersTaken"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER-06 / D-40: resend audits profile.email-change-requested with detail resent, cancel audits profile.email-change-canceled with no detail, a taken confirm audits canceled with detail taken; no address is ever written"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#ResendIsAuditedAsRequestedWithTheDetailResentAndCancelWithNoDetail"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs#ATakenAddressIsAuditedAsCanceledWithTheDetailTakenAndNeverAsChanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two new routes are covered by the authorization matrix, the Reset rate limit table and the idempotency coverage test, and the OpenAPI snapshot and generated types match"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OpenApi/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 'This email can't be used.' and 'There is no email change waiting.' wording is UI-SPEC copy built as written (D-48) and not yet owner-approved"
    verification: []
    human_judgment: true
    rationale: "Owner wording review (OQ-7, OQ-11) is open; the strings are built as written and presented in the 05-31 and 05-37 reviews."

duration: 18min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 15: Email change pending state Summary

**Resend and cancel for a waiting email change, and a distinct 409 `email-change.taken` on the link check and confirm when another account took the new address first, all audited by user id only.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-18T01:20:00-05:00
- **Completed:** 2026-10-18T01:38:00-05:00
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- `POST /api/v1/profile/email-change/resend` revokes the open email-change link and emails a fresh 24-hour link to the pending address only. Nothing goes to the current address. The first link then answers the invalid 404 on check and confirm, and the new one confirms.
- `DELETE /api/v1/profile/email-change` revokes the links and clears the pending address. It answers 204 every time; with nothing pending it writes nothing, so a repeat adds no audit entry. Sign-in keeps using the current email throughout.
- A resend with nothing pending is `404 email-change.none` ("There is no email change waiting.").
- If another live account takes the pending address, the check and confirm answer `409 email-change.taken` ("This email can't be used."). Confirm also spends the link, clears `PendingEmail` and audits `profile.email-change-canceled` with detail `taken`. The account's email is unchanged. A Manager-locked, deactivated or deleted account's link is still the invalid 404.
- Audit: resend writes `profile.email-change-requested` with detail `resent`; cancel writes `profile.email-change-canceled` with no detail; no address appears in any entry.
- Contract: matrix rows, Reset rate-limit row, OpenAPI snapshot and generated types, `docs/operations/audit-log.md` and `docs/api/auth.md` are updated.

## Task Commits

1. **Task 1: Tracer, resend or cancel a pending email change (D-24)**
   - RED `e4e0aa8` test(05-15): resend or cancel a pending email change (RED)
   - GREEN `db0b9e7` feat(05-15): resend and cancel a pending email change (D-24)
2. **Task 2: Address taken before the link was used**
   - RED `86c3e47` test(05-15): pending address taken meanwhile (RED)
   - GREEN `8a5f18c` feat(05-15): taken-meanwhile answer for email change links

**Plan metadata:** the docs(05-15) commit that carries this file, STATE.md and ROADMAP.md.

## TDD Gate Compliance

Both tasks have a `test(05-15)` commit before their `feat(05-15)` commit; no REFACTOR commit was needed. xunit.v3 on Microsoft Testing Platform is not a report format `gsd check tdd-red-evidence` reads, so the RED evidence is the real runs plus a semantic check, as in 05-39.

- **Task 1 RED (`e4e0aa8`):** `*EmailChangePendingTests` 12 tests, 10 failed. Every failure was a planned assertion: the resend and cancel routes did not exist, so resend, cancel and the audit checks got 404 instead of 204, and `email-change.none` was absent. The two that passed (the profile shows `pendingEmail` while sign-in keeps the current email, and an anonymous caller gets 401) are characterization of existing behaviour. Semantic assessment: the target tests executed and failed for the intended reason, with no load or fixture fault. The unit tests for the two new handlers were written in the GREEN commit because the classes do not exist before it and the test project would not compile (a compile error is not a valid RED); the integration tests carry the RED for them.
- **Task 2 RED (`86c3e47`):** `*EmailChange*` unit tests: 3 of 71 new or changed cases failed (taken confirm, taken check, holder lookup); integration `*EmailChangePendingTests` 18 tests, 3 failed (check, confirm and audit for a taken address). The check test failed on the media-type assertion because the old code answered 200, not a problem document, which is the planned difference. The soft-delete, Manager-locked and deleted-account cases passed at RED because 05-14 and 05-39 already behave that way; they are guards for the GREEN change. Semantic assessment: failures were the planned assertions for the new 409.

## Files Created/Modified

- `src/Csps.Application/Profile/ResendEmailChangeHandler.cs` - lock, read pending, revoke, new token, one email to the pending address, audit `resent`.
- `src/Csps.Application/Profile/CancelEmailChangeHandler.cs` - lock, read pending, revoke, clear, audit canceled; a quiet success when nothing is pending.
- `src/Csps.Application/Profile/EmailChangeErrors.cs` - `None` (404) and `Taken` (409) with their codes and texts.
- `src/Csps.Application/Profile/CheckEmailChangeHandler.cs` - answers Taken when a live account holds the pending address.
- `src/Csps.Application/Profile/ConfirmEmailChangeHandler.cs` - Taken outcome spends the link, clears the pending address, audits canceled (taken) and returns the 409.
- `src/Csps.Domain/Auditing/AuditActions.cs` - `ProfileEmailChangeCanceled` in the catalog.
- `src/Csps.Server/Controllers/ProfileController.cs` - resend and cancel routes; `KeepChanges` on the taken 409; 409 documented on the check.
- `src/Csps.Server/Composition/ApplicationRegistration.cs` - registers the two handlers.
- `tests/Csps.Server.IntegrationTests/Profile/EmailChangePendingTests.cs` - 18 end-to-end cases.
- `tests/Csps.Application.UnitTests/Profile/EmailChangePendingHandlerTests.cs` - resend and cancel branches with NSubstitute ports and the audit calls.
- `tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs` - taken confirm, taken check, deleted holder.
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`, `.../RateLimiting/RateLimitTests.cs` - rows for the two routes.
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract and types.
- `docs/operations/audit-log.md`, `docs/api/auth.md` - the new codes, details, routes and errors.

## Decisions Made

- Read the pending address through `IUserDirectory` after taking the per-account lock, so racing resend, cancel and request calls run in order and only the newest link lives.
- The taken check looks the holder up with `FindByEmailAsync` and ignores a deleted holder (its address is scrambled by the soft delete), so no new port method was needed.
- Confirm saves its writes before it returns the 409; `InTransactionAsync` commits when the work returns, and the controller marks the answer `KeepChanges` so the idempotency gate commits without storing it.
- DELETE takes no row version (naturally idempotent): the recorded D-21-style deviation the plan asked for.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The 409 taken answer would have rolled back its own writes**
- **Found during:** Task 2 (design, before GREEN)
- **Issue:** The idempotency gate stores only 2xx, 400, 404 and 422 and rolls back everything else, so a 409 from confirm would have undone the spent link and the cleared pending address that the plan requires.
- **Fix:** `ProfileController.ConfirmEmailChange` calls `IdempotencyOutcome.KeepChanges` for `email-change.taken`, as the password and email-change routes already do for their 429.
- **Files modified:** `src/Csps.Server/Controllers/ProfileController.cs`
- **Verification:** `ConfirmingATakenAddressIsA409SpendsTheLinkAndClearsThePendingChange` (profile `pendingEmail` null and a second confirm is 404).
- **Committed in:** `8a5f18c`

**2. [Rule 3 - Blocking] Existing tests had to follow the new behaviour**
- **Found during:** Task 1 and Task 2
- **Issue:** `AuditActionsTests` pinned the catalog size at 24; `EmailChangeHandlerTests` pinned "Taken is invalid and leaves the link unspent"; `RateLimitTests` lists every Reset-limited route.
- **Fix:** Catalog count 25; the combined theory split into a NothingPending case and new Taken cases; a rate-limit row for the resend route.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `tests/Csps.Application.UnitTests/Profile/EmailChangeHandlerTests.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs`
- **Committed in:** `db0b9e7`, `86c3e47`

### Plan-listing differences (not behaviour changes)

- The taken-address unit tests live in `EmailChangeHandlerTests.cs` (its harness already builds the confirm and check handlers), not in `EmailChangePendingHandlerTests.cs`, which holds the resend and cancel branches.
- `docs/api/auth.md` was updated as well as `docs/operations/audit-log.md`, so the API contract page lists the routes and codes.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were needed for correctness; no scope creep.

## Issues Encountered

- `gsd check tdd-red-evidence` cannot read xunit.v3 output; the RED evidence is recorded above from the real runs.
- The OpenAPI snapshot test fails once on purpose when run with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` (it rewrites the file); a second run without the switch passes.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 812 passed. `tests/Csps.Application.UnitTests`: 558 passed. `tests/Csps.Domain.UnitTests`: 592 passed. `tests/Csps.ArchitectureTests`: 217 passed.
- `npm --prefix tools/openapi-gen run check`: passes.
- Acceptance greps: `email-change.none` once in `EmailChangeErrors.cs`; `profile.email-change-canceled` once in `AuditActions.cs`; `/api/v1/profile/email-change` on 7 lines of the matrix; `email-change.taken` once in `EmailChangeErrors.cs`; `taken` appears in `audit-log.md`.
- Tracer gate: the resend and cancel behaviour was re-run end to end before Task 2 started (`*EmailChangePendingTests` 12 of 12) and the full integration suite stayed green.

## Known Stubs

None.

## Threat Flags

None. The two new routes and the 409 are inside the plan's threat model (T-05-40, T-05-41, T-05-42).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-16 (confirm page) can show "This email can't be used" for `409 email-change.taken` from either the check or the confirm, and "This link has expired" for the 404.
- 05-18 (Details tab) can call `POST .../resend` and `DELETE .../email-change` from the pending note; both answer 204.
- The new wording ("This email can't be used.", "There is no email change waiting.") is UI-SPEC copy built as written (D-48) and still awaits the owner's wording review.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

## Self-Check: PASSED
