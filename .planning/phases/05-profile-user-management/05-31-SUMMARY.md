---
phase: 05-profile-user-management
plan: 31
subsystem: email
tags: [email-preview, owner-review, d-30, d-45, d-48, tdd, prof-02, prof-03, user-07]
created: "2026-10-18T11:35:00-05:00"
updated: "2026-10-18T11:35:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "email records from 05-12 (PasswordChangedEmail.OtherDevicesOnly), 05-14 and 05-39 (EmailChangeConfirmEmail, EmailChangeNoticeEmail), 05-19 (InviteEmail.InvitedBy), 05-40 (EmailChangeConfirmEmail.ChangedBy, ManagerEmailChangedEmail) and 05-27 (ManagerResetLinkEmail)"
provides:
  - "tools/Csps.EmailPreview renders 14 samples (28 files, .html and .txt) through the real renderer: the Phase 4 emails plus invite-by-manager, manager-reset-link, email-change-confirm, email-change-confirm-by-manager, email-change-notice and password-changed-other-devices (manager-changed-email was already added by 05-40)"
  - "The owner's recorded verdict on the Phase 5 email wording: approved 2026-10-18, no changes"
affects: [05-37 screen review (screen wording still pending), /gsd-verify-work 5]

actuals:
  tokens: 1200
  tasks: 2
  commits: 2
plan_head_before: c2359c7a2b48cdba02524a5758daf42e897160c4
plan_head_after: 1edb56e950b489f89d66e435ae0172d657af531a

tech-stack:
  added: []
  patterns:
    - "Every preview sample uses the fixed SampleAddress, SampleToken and SampleTime and goes through the real EmailRenderer; output stays under git-ignored artifacts/"

key-files:
  created: []
  modified:
    - tools/Csps.EmailPreview/Program.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "The owner approved the Phase 5 email wording on 2026-10-18 with no copy or look changes. The three optional wording suggestions the orchestrator offered (a Manager-specific line in email-change-confirm-by-manager, 'Someone asked' wording in email-change-notice, a distinct subject for manager-reset-link) were not taken, so the emails stay exactly as built."

requirements-completed: [PROF-02, PROF-03, USER-07]

coverage:
  - id: D1
    description: "The preview tool writes every Phase 5 email (and the Phase 4 ones) as .html and .txt with fixed sample values, and sends them with --to, only in Development"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class *EmailPreviewTests (8 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Phase 5 email templates still render as specified"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class *EmailRendererTests (76 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The owner reviewed the rendered Phase 5 emails (copy, lifetimes, buttons, look next to Phase 4) and approved them"
    requirement: "USER-07"
    verification: []
    human_judgment: true
    rationale: "Wording and look are the owner's call (UI-SPEC Email Design Contract, D-48); the verdict 'approved' on 2026-10-18 is the evidence"

duration: 12 min active (plus the owner's review wait)
completed: 2026-10-18
---

# Phase 5 Plan 31: Phase 5 email preview and owner review Summary

**The email preview tool now renders all 14 auth email samples (28 .html and .txt files) through the real renderer, and the owner reviewed the seven Phase 5 emails against Phase 4's and approved them on 2026-10-18 with no changes.**

## Performance

- **Duration:** 12 min of active work (the owner's review time is not counted)
- **Started:** 2026-10-18T11:19:00-05:00 (RED commit at 11:20)
- **Completed:** 2026-10-18T11:35:00-05:00
- **Tasks:** 2 (1 tracer with a RED and a GREEN commit, 1 owner checkpoint)
- **Files modified:** 3 (2 code, 1 planning)

## Accomplishments

- `tools/Csps.EmailPreview/Program.cs` gained six samples (`invite-by-manager`, `manager-reset-link`, `email-change-confirm`, `email-change-confirm-by-manager`, `email-change-notice`, `password-changed-other-devices`); with the eight already there (Phase 4 plus `manager-changed-email` from 05-40) the tool shows 14 emails. The tool's summary comment says "fourteen".
- `EmailPreviewTests` pin 28 files for `--out` and 14 sends for `--to`, with 10 distinct subjects, every sample on the fixed address, token and time, and no real-looking secret in the output.
- The previews were written to `artifacts/email-preview-phase5` (git-ignored, `git status --porcelain artifacts/` prints nothing) with `DOTNET_ENVIRONMENT=Development` set for that one process.
- **Owner verdict (2026-10-18): "approved".** The owner opened all seven Phase 5 emails (invite-by-manager, manager-reset-link, email-change-confirm, email-change-confirm-by-manager, email-change-notice, password-changed-other-devices, manager-changed-email) and compared them with Phase 4's password-changed email. No copy or look changes were asked for, so `EmailRenderer.cs` was not touched and no `fix(05-31)` commit exists.
- `deferred-items.md` marks the Phase 5 email wording (the OQ-7/OQ-11 email additions and plan 05-40's manager-changed-email) as owner-approved on 2026-10-18. The screen wording review stays pending for 05-37.

## Task Commits

1. **Task 1 (RED): preview tests expect 14 samples** - `5e7962b` (test)
2. **Task 1 (GREEN): preview tool writes every Phase 5 email** - `1edb56e` (feat)
3. **Task 2: The owner reviews the Phase 5 emails** - checkpoint approved 2026-10-18; recorded here and in `deferred-items.md` (no code commit)

**Plan metadata:** the docs commit that holds this file (docs: complete plan)

## Files Created/Modified

- `tools/Csps.EmailPreview/Program.cs` - six new Phase 5 samples and the "fourteen" comments
- `tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs` - expected counts (28 files, 14 sends, 10 distinct subjects) and the new sample names
- `.planning/phases/05-profile-user-management/deferred-items.md` - email wording marked owner-approved 2026-10-18; screen wording still pending

## Decisions Made

- The owner's approval stands as given. The orchestrator's three optional wording suggestions were not taken by the owner, so the emails stay exactly as built (no change to `EmailRenderer.cs`).

## Deviations from Plan

### Count changes (plan numbers were stale)

**1. [Plan assumption] 14 samples and 28 files instead of 13 and 26**
- **Found during:** Task 1 (RED)
- **Issue:** The plan says Phase 4 has seven emails and Phase 5 adds six, giving 13. Plan 05-40 had already added `manager-changed-email` to the tool (noted in `deferred-items.md`), so the tool held eight samples, and the six new ones make 14.
- **Fix:** The tests and the tool use 14 samples, 28 files and 14 sends. The tool comment says "fourteen".
- **Files modified:** `tools/Csps.EmailPreview/Program.cs`, `tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs`
- **Committed in:** `5e7962b`, `1edb56e`

**2. [Plan assumption] 10 distinct subjects instead of 13**
- **Found during:** Task 1 (RED)
- **Issue:** The plan expects one distinct subject per sample. The variants (invite-by-manager, email-change-confirm-by-manager, password-changed-other-devices) and the Manager reset link share their base email's subject by design, so only 10 of the 14 subjects differ.
- **Fix:** The test asserts the real count (10 distinct subjects) rather than forcing the renderer to invent new subjects.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs`
- **Committed in:** `5e7962b`

---

**Total deviations:** 2 plan-number corrections, no auto-fixes (Rules 1-4 not triggered)
**Impact on plan:** None on scope. Behavior and coverage match the plan's intent; only the stale counts changed.

## Issues Encountered

None. The verify commands passed first time: `*EmailRendererTests` 76 passed, `*EmailPreviewTests` 8 passed.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. The tool is Development-only, uses fixed fictional values, and writes under git-ignored `artifacts/` (T-05-89 mitigated); no packages were installed (T-05-SC).

## Known Stubs

None.

## Next Phase Readiness

- The Phase 5 email wording is approved. Remaining owner review is the screen wording in plan 05-37 (listed in `deferred-items.md`).
- Remaining Phase 5 plans continue per STATE.md.

## Self-Check: PASSED

- `tools/Csps.EmailPreview/Program.cs` and `tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs` exist and are changed in `5e7962b` and `1edb56e`.
- `5e7962b` and `1edb56e` are ancestors of HEAD; `git rev-list --count c2359c7..HEAD` is 2.
- `artifacts/email-preview-phase5` holds 28 files and is ignored by git.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
