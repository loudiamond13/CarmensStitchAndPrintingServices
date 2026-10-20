---
phase: 05-profile-user-management
plan: 44
subsystem: auth
tags: [gap-closure, cr-01, auth-06, use-submission, tdd, tracer, e2e]
created: "2026-10-19T02:35:00-05:00"
updated: "2026-10-19T02:35:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-08 (always-mounted dialogs, D-39), 05-VERIFICATION.md gap 1 (CR-01)"
provides:
  - "Sign Out Other Devices sends a new request on every use in one admin visit (CR-01, AUTH-06)"
  - "The code step's Resend Code sends a new request after each countdown"
  - "E2E proof that a device signed in after the first use is signed out by the second"
  - "Sweep of every no-data useSubmission in web/src (table below)"
affects: [05-VERIFICATION gap 1]

actuals:
  tokens: 1700
  tasks: 2
  commits: 4
plan_head_before: 2df0d9e741623ab11f818675704ab94bfc90b163
plan_head_after: 384ee1e5c772657a12409e095e79a01e6f85cb04

tech-stack:
  added: []
  patterns:
    - "A no-data useSubmission on a component that stays mounted calls reset() when its success settles (SignOutOthersDialog, VerifyCodePage resend, ProfilePage resend and cancel)"

key-files:
  created: []
  modified:
    - web/src/modules/admin/components/SignOutOthersDialog.tsx
    - web/src/modules/admin/components/SignOutOthersDialog.test.tsx
    - web/src/modules/admin/pages/VerifyCodePage.tsx
    - web/src/modules/admin/pages/VerifyCodePage.test.tsx
    - web/src/modules/admin/pages/SessionsPage.test.tsx
    - web/e2e/session-menu.spec.ts

key-decisions:
  - "submission.reset() runs as the first statement of onSuccess in SignOutOthersDialog: the same onSuccess closes the dialog, so no click can land between the reset and the close, and the endpoint is naturally idempotent (allow-listed, no key)"
  - "VerifyCodePage resets the resend submission right after outcome.ok; the countdown (resendWaiting) already blocks early presses, so no double-click protection is lost"

requirements-completed: [AUTH-06, PROF-03, USER-05]

coverage:
  - id: D1
    description: "Sign Out Other Devices ends the other sessions on every use in one visit"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/SignOutOthersDialog.test.tsx#signs out the others on every use of one mounted dialog"
        status: pass
      - kind: e2e
        ref: "web/e2e/session-menu.spec.ts#@session-menu a second Sign Out Other Devices in one visit ends a device that signed in after the first (chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed-in devices: a second Sign Out Other Devices refreshes the list again"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SessionsPage.test.tsx#signs out the others again on a second use in one visit and refreshes the list each time"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second Resend Code after the countdown sends a second request and restarts the countdown from the new answer"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VerifyCodePage.test.tsx#a second resend after the countdown sends a second request and restarts the countdown from its answer"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two fast clicks on the confirm button still send one request"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/SignOutOthersDialog.test.tsx#sends one request for two fast clicks on the confirm button"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 44: Sign Out Other Devices works on every use Summary

**A reset of the finished no-data submission in SignOutOthersDialog and VerifyCodePage's resend, so the always-mounted dialog and the code step send a new request on every deliberate press (CR-01).**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-19
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files modified:** 6

## Accomplishments

- CR-01 closed. Since 05-08 kept the dialogs mounted (D-39), the dialog's `useSubmission<undefined, undefined>` remembered its first success; every later confirm resolved with the cached outcome, sent nothing, and the dialog never closed. `submission.reset()` at the top of `onSuccess` makes each confirm a new submission.
- The tracer ran first: RED showed the second confirm leaves the dialog open in both the component test and the browser; GREEN passes both, and `⚡ Tracer verified end-to-end - expanding` before Task 2.
- VerifyCodePage had the same fault in Resend Code (the second resend returned the cached success). It now takes `reset` from the resend submission and calls it right after `outcome.ok`.
- A new E2E (`@session-menu`) signs one Manager in on three browser contexts: the first use ends the second context; a third signs in afterwards; the second use, with no reload, ends the third.

## Task Commits

1. **Task 1 RED:** `0b33d1d` test(05-44): a second Sign Out Other Devices in one visit sends nothing (RED, CR-01)
2. **Task 1 GREEN:** `0f31f0e` fix(05-44): Sign Out Other Devices sends a new request on every use (CR-01)
3. **Task 2 RED:** `89e9eb1` test(05-44): a second Resend Code sends nothing (RED)
4. **Task 2 GREEN:** `384ee1e` fix(05-44): Resend Code sends a new request on every use

## Characterization tests (passed at once)

- `SignOutOthersDialog.test.tsx` "sends one request for two fast clicks on the confirm button": the double-click protection already held (pending in-flight promise), so it is a characterization of behavior the fix must keep.
- `SessionsPage.test.tsx` "signs out the others again on a second use in one visit and refreshes the list each time": the same dialog, so it passed once Task 1 is in; committed in the Task 2 RED commit as a characterization of the fix through the page (it was written after the Task 1 GREEN).

## No-data submissions

| Site | Stays mounted across uses | How it starts a new submission |
|------|---------------------------|--------------------------------|
| `SignOutOthersDialog` (AdminLayout, SessionsPage) | Yes (D-39, whole visit) | Fixed here: `reset()` first in `onSuccess` |
| `VerifyCodePage` resend | Yes (the page) | Fixed here: `reset()` right after a successful resend; the countdown blocks early presses |
| `EditUserPanel` lock, unlock, cancel email, resend invitation, reset link | Yes (panel open for a person) | `afterAction` calls `action.reset()` after the person is read again; a failed action keeps its key for a retry |
| `ProfilePage` email-change resend | Yes (page) | `resend.reset()` in `onSuccess` (existing) |
| `ProfilePage` email-change cancel | Yes (page) | `cancel.reset()` in `onSuccess` (existing) |
| `ConfirmEmailPage` (ReadyCard) | No: single use, `onDone` replaces the card with the done state | None needed |
| `useUserAction` (UsersPage deactivate, activate, delete) | Yes, but it carries data (`user.id:generation`), not a no-data submission | The generation moves on after the roster reads again (existing) |

No other site needed a fix.

## Deviations from Plan

None - plan executed exactly as written. Two small notes, neither a deviation: the SessionsPage test is a characterization test as the plan predicted, and `useUserAction` was added to the sweep table although the plan's list did not name it (it is not no-data).

**Commit trailer:** the dispatch note asked for a `Claude Opus 5.5` Co-Authored-By line; the session's attribution instruction names `Claude Sonnet 5.5`, which is the model that did the work, so commits carry that line.

## Verification

- `npm --prefix web run test -- --run SignOutOthersDialog.test.tsx` : 11 passed.
- `npm --prefix web run test -- --run VerifyCodePage.test.tsx SessionsPage.test.tsx` : 70 passed.
- `npm --prefix web run verify` : exit 0 (coverage, lint, types, class gate, build, budgets, license, notices).
- `npm --prefix web run e2e -- --grep "@session-menu|@sessions|@auth" --project chromium` : 23 passed. The phase gate runs the five-project matrix later.
- Acceptance greps: `submission.reset()` x1, `toHaveBeenCalledTimes(2)` x2, `@session-menu` x2, `reset` in VerifyCodePage `onResend`.
- Preflight before each E2E run: ports 5180, 5115, 7028, 5199 free, no foreign processes. No package or migration changes.

## Known Stubs

None.

## Threat Flags

None. T-05-107 (second Sign Out Other Devices sends nothing) and T-05-108 (second Resend Code sends nothing) are mitigated by the resets and the tests above.

## Self-Check: PASSED

- Files modified exist; commits `0b33d1d`, `0f31f0e`, `89e9eb1`, `384ee1e` are on the branch.
- No other gap plan's files were touched.
