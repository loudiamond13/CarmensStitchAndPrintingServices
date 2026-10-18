---
phase: 05-profile-user-management
plan: 06
subsystem: auth
tags: [invite, email, authsettings, d-13]
created: "2026-10-17T20:45:00-05:00"
updated: "2026-10-17T20:45:00-05:00"

requires:
  - phase: 04-auth
    provides: AuthSettings.InviteLinkLifetime, EmailRenderer invite email, bootstrap-manager invite, AcceptInvitePage
provides:
  - "Invitation links last 7 days (one setting for the bootstrap invite and the Manager invites of 05-19 and 05-27)"
  - "Invite email lifetime wording that reads whole days (two or more) as days"
  - "Invalid-invite screen copy and docs that say 7 days"
affects: [05-19, 05-27]

actuals:
  tokens: 4000
  tasks: 2
  commits: 4
plan_head_before: b88a28c6f598917dd044ef835f2f913569561ffa
plan_head_after: e003027a918033ed25c8c19e11fd514abfa0591c

tech-stack:
  added: []
  patterns: ["Email lifetime wording is computed from ExpiresAt minus RequestedAt, so copy follows the setting"]

key-files:
  created: []
  modified:
    - src/Csps.Application/Auth/AuthSettings.cs
    - src/Csps.Application/Users/BootstrapManagerHandler.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - tools/Csps.EmailPreview/Program.cs
    - web/src/modules/admin/authCopy.ts
    - docs/api/auth.md
    - docs/operations/bootstrap-manager.md
    - tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs
    - tests/Csps.Application.UnitTests/Users/BootstrapManagerHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - web/src/modules/admin/pages/AcceptInvitePage.test.tsx

key-decisions:
  - "D-13: invite links last 7 days; existing rows keep their stored 72-hour ExpiresAt, only new tokens use 7 days"
  - "Email wording: whole days from two up read as days, so 24 hours stays '24 hours'"

requirements-completed: [USER-02, USER-07]

coverage:
  - id: D1
    description: "Default InviteLinkLifetime is 7 days; an invite works until exactly 7 days and fails 1 ms later"
    requirement: USER-02
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs#DefaultsAreTheApprovedLimits"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/BootstrapManagerHandlerTests.cs#AnEmptySystemGetsAPasswordlessManagerAndAnInviteInOneTransaction"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs#AnInviteWorksUntilTheLastMomentAndIsInvalidAtExactlySevenDays"
        status: pass
    human_judgment: false
  - id: D2
    description: "Invite email states the real lifetime in days, hours or minutes"
    requirement: USER-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#InviteLinksToAcceptInviteWithTheTokenInTheFragment"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#LifetimesAreWordedFromTheRealExpiryNotFromFixedText"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid-invite screen and docs say 7 days"
    requirement: USER-07
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/AcceptInvitePage.test.tsx"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 06: Invite Links Last 7 Days Summary

**Invitation links now last 7 days through one `AuthSettings.InviteLinkLifetime` default, with the invite email wording computed from the real expiry (days from two up), plus the invalid-invite screen copy and docs updated (D-13).**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-17T20:34:00-05:00
- **Completed:** 2026-10-17T20:45:00-05:00
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `InviteLinkLifetime` defaults to `TimeSpan.FromDays(7)`; the bootstrap invite and the testing fixture use it, and 05-19 and 05-27 will too.
- A fresh invite answers 200 at 7 days minus 1 ms and the same invalid-invite 404 at 7 days.
- `EmailRenderer.Span` says "7 days" and "2 days"; "24 hours", "1 hour", "15 minutes" and "30 minutes" are unchanged.
- `authCopy.invite.invalidBody` reads "Invite links work for 7 days and only once. Ask a Manager to send you a new invite."
- `docs/api/auth.md`, `docs/operations/bootstrap-manager.md` and the email preview sample now say 7 days. No production file, doc or web copy says 72 hours for the invite.

## TDD Gate Compliance

- **Task 1 RED** (`c6c6c01`): three tests changed to 7 days. Targets `AuthSettingsTests.DefaultsAreTheApprovedLimits` (was 3.00:00:00, expected 7.00:00:00), `BootstrapManagerHandlerTests.AnEmptySystemGetsAPasswordlessManagerAndAnInviteInOneTransaction` (ExpiresAt 3 days out, expected 7) and `InviteTests.AnInviteWorksUntilTheLastMomentAndIsInvalidAtExactlySevenDays` (404 instead of 200 at day 7 minus 1 ms) each failed on the planned assertion. Semantic assessment: the targets ran, failed for the intended reason (old 72-hour default), no setup or load faults.
- **Task 1 GREEN** (`92c27ba`): default set to 7 days, all pass.
- **Task 2 RED** (`6495a36`): `EmailRendererTests.InviteLinksToAcceptInviteWithTheTokenInTheFragment` and `LifetimesAreWordedFromTheRealExpiryNotFromFixedText` (7 days rendered as "168 hours") and `AcceptInvitePage.test.tsx` invalid state (copy still 72 hours) failed on the planned text assertions. Semantic assessment: intended assertions, no fixture faults.
- **Task 2 GREEN** (`e003027`): all pass.
- No REFACTOR commit needed. The `gsd_run check tdd-red-evidence` classifier was not used: the .NET MTP and Vitest console output is not one of its supported report formats, so RED was inspected by hand against the real failing assertions above.

## Task Commits

1. **Task 1: Tracer, a fresh invite works on day 7** - `c6c6c01` (test, RED), `92c27ba` (feat, GREEN)
2. **Task 2: email, screen and docs say 7 days** - `6495a36` (test, RED), `e003027` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Tracer Gate

Tracer verified end-to-end: `InviteTests` (16 tests) and `BootstrapManagerHandlerTests` (12 tests) pass, then expansion (Task 2) proceeded.

## Files Created/Modified

- `src/Csps.Application/Auth/AuthSettings.cs` - `InviteLinkLifetime` default 7 days
- `src/Csps.Application/Users/BootstrapManagerHandler.cs` - class doc says 7-day
- `src/Csps.Infrastructure/Email/EmailRenderer.cs` - `Span` reads whole days (two or more) as days, `MinutesPerDay` constant
- `tools/Csps.EmailPreview/Program.cs` - sample invite expiry 7 days
- `web/src/modules/admin/authCopy.ts` - `invalidBody` 7-day sentence
- `docs/api/auth.md`, `docs/operations/bootstrap-manager.md` - lifetime rows and steps, timestamps updated
- Tests: `AuthSettingsTests`, `BootstrapManagerHandlerTests`, `InviteTests`, `EmailRendererTests`, `AcceptInvitePage.test.tsx`

## Decisions Made

- Existing invitation rows keep their stored 72-hour `ExpiresAt` (no data change); only new tokens get 7 days, as the plan's Runtime State note says.
- `AcceptInviteHandlerTests` and `CheckInviteHandlerTests` still build tokens with an explicit 72-hour lifetime: they test expiry of a given token, not the default, so they were left alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Expired-invite test relied on the old default**
- **Found during:** Task 1 (GREEN run of `InviteTests`)
- **Issue:** `AnyInviteThatDoesNotWorkIsTheSame404ForCheckAndAccept("expired")` advanced the clock 73 hours, which is inside the new 7-day window, so the invite was still valid.
- **Fix:** Advance 8 days instead.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs`
- **Verification:** `InviteTests` 16/16 pass; `Csps.Server.IntegrationTests` Auth namespace 291/291 pass.
- **Committed in:** `92c27ba`

**2. [Rule 2 - Consistency] Email preview sample still showed 72 hours**
- **Found during:** Task 2 (grep for remaining 72-hour references)
- **Issue:** `tools/Csps.EmailPreview/Program.cs` sample invite used a 72-hour expiry, so the previewed email would say 168 hours or the old figure.
- **Fix:** Sample expiry set to 7 days.
- **Files modified:** `tools/Csps.EmailPreview/Program.cs`
- **Verification:** tool builds with 0 warnings.
- **Committed in:** `e003027`

---

**Total deviations:** 2 auto-fixed (1 bug in a test, 1 consistency)
**Impact on plan:** Both needed so no file still implies a 72-hour invite. No scope creep.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-05-13 (longer exposure window) accepted by the owner; T-05-14 mitigated: wording is computed from the token's `ExpiresAt`, pinned by tests for 7 days, 2 days, 24 hours and minutes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The 7-day setting is ready for the Manager invite (05-19) and resend (05-27) plans.

## Self-Check: PASSED

- All modified files exist; commits `c6c6c01`, `92c27ba`, `6495a36`, `e003027` are ancestors of HEAD.
- Acceptance criteria: `TimeSpan.FromDays(7)` count in AuthSettings.cs is 1; "72" count in BootstrapManagerHandler.cs is 0; "72 hours" count is 0 in authCopy.ts, docs/api/auth.md and docs/operations/bootstrap-manager.md; "7 days" in authCopy.ts is 1.
- Verification: Application.UnitTests 376/376, Server.IntegrationTests Auth 291/291, EmailRendererTests 46/46, BootstrapManagerTests 46/46, web admin and test folders 628/628 pass.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*
