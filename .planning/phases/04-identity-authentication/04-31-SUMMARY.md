---
phase: 04-identity-authentication
plan: 31
subsystem: auth
tags: [web, accept-invite, must-change-password, s3, s6, fail-closed, new-password-fields, e2e, playwright, auth-12, auth-11, auth-09, a11y-03, d-13, d-14, d-18, d-22, d-29]
status: complete
created: "2026-10-15T07:26:00-05:00"
updated: "2026-10-15T07:26:00-05:00"

requires: ["04-30", "04-28", "04-27", "04-22", "04-21"]
provides:
  - "modules/admin/services/inviteService.ts: createInviteService and inviteService (check, accept with the caller's Idempotency-Key), both skipAuthRefresh"
  - "modules/admin/pages/AcceptInvitePage.tsx: S6 at /admin/accept-invite (AcceptInviteRoute)"
  - "modules/admin/pages/NewPasswordPage.tsx: S3 at /admin/login/new-password (NewPasswordRoute)"
  - "session.ts setSignedInToast / takeSignedInToast and hooks/usePostSignInToast.ts: a one-shot toast handed from the auth layout to the admin shell"
  - "e2e/auth-invite.spec.ts (@auth-invite, 2 tests) and e2e/auth-must-change.spec.ts (@auth-must-change, 2 tests), all five projects; testing-api createInvitedStaff and the must-change states on StaffState"
affects: [04-32, 04-35]

requirements-completed: []

actuals:
  tokens: 60000
  tasks: 3
  commits: 6
plan_head_before: 76d3732718d57108659ffa6259fcbfa679cfe079
plan_head_after: c9453a16a5691f9e423b19714209c32f23a92e95

tech-stack:
  added: []
  patterns:
    - "A screen in the auth layout that ends in the admin shell cannot show a toast itself (the auth toast layer unmounts with its route): it leaves a one-shot in the session module and the shell's usePostSignInToast shows it"
    - "A 422 with a stable code (auth.breach-check-unavailable) gets its own banner and focus on the submit button; the next submit is a new submission with a fresh key because useSubmission replays a final 4xx"
    - "E2E guarded-area check uses /admin/sessions, because the e2e bundle's dev previews answer /admin itself"

key-files:
  created:
    - web/src/modules/admin/services/inviteService.ts
    - web/src/modules/admin/services/inviteService.test.ts
    - web/src/modules/admin/pages/AcceptInvitePage.tsx
    - web/src/modules/admin/pages/AcceptInvitePage.test.tsx
    - web/src/modules/admin/pages/NewPasswordPage.tsx
    - web/src/modules/admin/pages/NewPasswordPage.test.tsx
    - web/src/modules/admin/hooks/usePostSignInToast.ts
    - web/src/modules/admin/hooks/usePostSignInToast.test.tsx
    - web/e2e/auth-invite.spec.ts
    - web/e2e/auth-must-change.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/authCopy.ts
    - web/src/modules/admin/pages/ResetPasswordPage.tsx
    - web/src/modules/admin/services/session.ts
    - web/src/modules/admin/services/session.test.ts
    - web/src/layouts/AdminLayout.tsx
    - web/e2e/testing-api.ts
    - docs/web/e2e.md

key-decisions:
  - "The Password saved toast reaches the shell through a one-shot in the session module, because AuthLayout's toast layer is gone once the route changes"
  - "S6 reuses S5's tokenFromHash and removeFragment (now exported from ResetPasswordPage) so both fragment screens behave identically"
  - "S3 keeps the pending email only for the hidden username input and the email-in-password check; first and last name are checked by the server"
  - "A check that never got an answer is not called expired on S6 (same rule as S5): shared banner plus Try Again"

patterns-established:
  - "createInvitedStaff(request, role) in testing-api.ts returns the raw invite token for specs"

coverage:
  - id: C1
    description: "D-29 end to end: an invited Manager opens /admin/accept-invite#token=..., the token leaves the address bar, S6 names the email, a valid password is saved, S1 shows 'Your password is set. Sign in to continue.' and the new password plus the emailed code signs in"
    requirement: "AUTH-12"
    verification:
      - "e2e/auth-invite.spec.ts first test passes in chromium, firefox, webkit, pixel and iphone (zero guard findings; page-level axe on S6 and S1)"
      - "AcceptInvitePage.test.tsx 'removes the token from the address bar before the check request' and 'sends the token and password in the body with an Idempotency-Key and opens sign-in with the notice'"
  - id: C2
    description: "D-14 fail closed on S6: banner 'We couldn't check your password right now.' / 'Wait a minute, then try again.', values kept, focus on Save Password, nothing saved, a retry with a fresh Idempotency-Key works"
    requirement: "AUTH-11"
    verification:
      - "AcceptInvitePage.test.tsx 'fails closed when the breach check cannot be reached ...' (red before the banner existed, green after)"
      - "e2e/auth-invite.spec.ts second test: the Hibp-Down#2026 sample, banner, focus on Save Password, axe, then a different password saves with the same invite (five projects)"
  - id: C3
    description: "S6 states: checking skeleton with 'Checking your link...' then 'Link checked.'; one invalid state ('This invite has expired', focus on the h1, only the back link, no button); a failed check offers Try Again; no #token shows the invalid state with no request"
    requirement: "AUTH-12"
    verification:
      - "AcceptInvitePage.test.tsx (13 tests, axe in every state)"
  - id: C4
    description: "D-13, D-18, D-22 end to end: a temporary-password account signs in with password and code, lands on S3 with the temporary subline and no session (a second tab opening a guarded page is sent to sign in), saves a valid password and gets the shell with the 'Password saved' toast; the breach account sees the breach subline"
    requirement: "AUTH-09"
    verification:
      - "e2e/auth-must-change.spec.ts (2 tests) passes in all five projects with zero guard findings and axe on S3"
      - "NewPasswordPage.test.tsx (12 tests) and usePostSignInToast.test.tsx (2 tests)"
  - id: C5
    description: "No session until the save succeeds: opened directly, the first save returns to S1 with 'Your sign-in timed out. Sign in again.'; 'Use a different account' abandons the step"
    requirement: "AUTH-09"
    verification:
      - "NewPasswordPage.test.tsx 'a 401 means the sign-in timed out ...' and 'Use a different account abandons the step'"
  - id: C6
    description: "OR-3, A11Y-03: both screens use NewPasswordFields and newPasswordSchema (client errors before any request, server messages under New password with focus), hidden username input only with a known email, autocomplete new-password, zero axe violations"
    requirement: "A11Y-03"
    verification:
      - "AcceptInvitePage.test.tsx and NewPasswordPage.test.tsx validation, hidden-input and server-message tests, each with expectNoAxeViolations"

duration: 21 min
completed: 2026-10-15
---

# Phase 4 Plan 31: Invite Acceptance and Must-Change Screens Summary

New staff, including the first Manager, can now follow their emailed invite to S6, set a first password (the breach check fails closed) and sign in with the emailed code; staff on a temporary or breached password are held on S3 with no session until they choose their own, and then land in the admin shell with a "Password saved" toast.

## What was built

- **Tracer (Task 1):** `inviteService` (check, accept with the caller's Idempotency-Key, `skipAuthRefresh`), `AcceptInviteRoute` at `/admin/accept-invite` (fragment read once and removed at once, checking state, form on `NewPasswordFields` and `newPasswordSchema` built from the invite's email and first name, invalid state with only the back link, a Try Again state for an unanswered check), the `@auth-invite` E2E and the `createInvitedStaff` helper.
- **Task 2:** `NewPasswordRoute` at `/admin/login/new-password` in the auth branch (a live session goes on to `/admin`): subline by the reason S2 kept, `setNewPassword` then `completeSignIn`, a 401 sets the "timed out" notice and opens S1, "Use a different account" drops the pending state. The "Password saved" toast is left as a one-shot in the session module and shown by `usePostSignInToast` in the admin shell. The `@auth-must-change` E2E covers the temporary and the breach account.
- **Task 3:** `AcceptInvitePage.test.tsx` (13) and `NewPasswordPage.test.tsx` (12) for every state, plus the fail-closed banner on S6 (422 `auth.breach-check-unavailable`: the "couldn't check" banner, values kept, focus on Save Password) and a second `@auth-invite` E2E that sends the `Hibp-Down#2026` sample and then saves a different password with the same invite.

Tracer gate: interactive mode, `human_verify_mode` end-of-phase, automated-only `<verify>`. After the S6 GREEN commit the `@auth-invite` E2E (five projects) and the service unit test were re-run and passed before Task 2 started.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Invite link, set a password, sign in (E2E) | 86716ec (RED), 18dcc4e |
| 2 | Must-change screen for temporary and breached passwords | a213eea (RED), a1d8883 |
| 3 | S3 and S6 states, fail-closed banner, focus, accessibility | a96fe0b (RED), c9453a1 |

`commits: 6` is measured from the plan ledger (`plan_head_before`).

## RED / GREEN evidence

- Task 1 RED: `inviteService.test.ts` failed to load (no module) and the chromium E2E failed at "Set your password" (no route). GREEN: unit 5 passed; `@auth-invite` 5 passed in all five projects.
- Task 2 RED: both `@auth-must-change` tests failed in chromium (no route). GREEN: after one test fix (below), 10 passed (2 tests x 5 projects).
- Task 3 RED: of 25 new component tests only the fail-closed banner test failed ("Unable to find ... We couldn't check your password right now."); the other 24 passed on arrival because Tasks 1 and 2 already implemented those states. They are regression guards. GREEN: 13 and 12 tests pass.

## Verification

- `npm --prefix web run verify` exit 0 after the preflight: ESLint with `--max-warnings 0`, typecheck, Prettier, 141 test files and 3659 tests, coverage (statements 97.31%, branches 94.42%, functions 98.69%, lines 99.61%), production build, budget build, license gate, notices check.
- Bundles (gzip): public JS 132.59 KB (limit 150), CSS 13.54 KB (limit 35). S3 and S6 are their own lazy chunks (1.98 KB and 3.11 KB gzip). No limit was raised.
- E2E: `--grep @auth-invite` 10 passed and `--grep @auth-must-change` 10 passed (chromium, firefox, webkit, pixel, iphone). The full 30-minute suite was not re-run; the shared code touched outside the new files is the `ResetPasswordPage` export, two `AdminLayout` lines, the session one-shot and `testing-api`, each unit-tested or covered by the E2E above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The success toast could not be shown from S3**
- **Found during:** Task 2. The plan has S3 show "Password saved" on success and then navigate. S3 sits under `AuthLayout`'s `ToastProvider`, which unmounts when the route changes to `/admin`.
- **Fix:** `setSignedInToast` / `takeSignedInToast` (one-shot in the session module, like the sign-in notices) and `usePostSignInToast` called in `AdminShell`. Unit tests for both.
- **Files modified:** session.ts, session.test.ts, usePostSignInToast.ts(.test.tsx), AdminLayout.tsx
- **Commit:** a1d8883

**2. [Rule 1 - Bug in the plan text] "navigating to /admin redirects to sign-in" does not hold in the e2e bundle**
- **Found during:** Task 2 (all five projects failed on this step). The e2e bundle's dev previews answer `/admin` themselves (see 04-27/04-28), so there is no guard redirect there.
- **Fix:** the spec opens `/admin/sessions` in a second tab of the same browser instead; that route is guarded, and it is sent to `/admin/login`.
- **Commit:** a1d8883

**3. [Rule 3 - Blocking] Small shared edits outside the plan's file list**
- `removeFragment` is exported from `ResetPasswordPage.tsx` so S6 uses the same fragment code as S5; `authCopy.ts` gained `invite.checkFailed` and `invite.retry`; `testing-api.ts` gained `createInvitedStaff`, the `InvitedStaff` type and the must-change values on `StaffState` (the plan wrote `createStaff(request, role, 'invited')`, but an invited account returns a token instead of a password, so it has its own function); `AdminLayout.tsx` and `session.ts` as above.
- **Commits:** 18dcc4e, a1d8883

### Plan interpretation

- **Second `@auth-invite` test:** the plan's `<behavior>` lists one invite E2E; I added the fail-closed run because the plan's truths name it and the `Hibp-Down#2026` stand-in works on the e2e host. The 422 is declared with `guard.expectStatus`.
- **S6 spec formatting:** the RED spec and service test were not Prettier-clean; they were formatted in the GREEN commit.
- **Line endings:** Python edits wrote CRLF into a `web/**` file once (`testing-api.ts`); fixed to LF before the first commit. No file shows a line-ending-only change.

## Decisions for the owner

- **Wording that is mine (SPEC-GAP, for the D-06 review):** when the invite cannot be checked at all (offline, rate limit, server error) S6 says "We could not check your invite yet." with the shared banner and a "Try Again" button, instead of claiming the invite expired. The checking words on S6 are the S5 ones ("Checking your link..." then "Link checked.") because UI-SPEC says S6 is "as S5".
- **First and last name on S3:** the browser only keeps the pending email out of the password (the server also checks the names and its message shows under New password after the save). The invite check returns the first name, so S6 checks it in the browser; S3 has no name until the sign-in answer is extended.
- **Reloading S3:** the pending email and the reason live in memory only, so after a reload the page shows the temporary wording (also for a breached account) and has no hidden username input. The ticket cookie still works, so the save succeeds. Say so if you want the reason to survive a reload.
- **Requirements not ticked:** AUTH-12 still needs the guarded bootstrap command and runbook (04-35), and AUTH-09, AUTH-11 and A11Y-03 are shared with later plans (04-32 and the phase verification), so all four stay pending.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-04-104 is mitigated: the invite token is read from the fragment, removed from the address bar before any request (unit test and E2E URL check) and sent only in POST bodies. T-04-105 holds: S3 holds no token until `completeSignIn`, and a second tab cannot open a guarded page before the save (E2E). No installs.

## Self-Check: PASSED

Created files exist (inviteService.ts and test, AcceptInvitePage.tsx and test, NewPasswordPage.tsx and test, usePostSignInToast.ts and test, auth-invite.spec.ts, auth-must-change.spec.ts), and commits 86716ec, 18dcc4e, a213eea, a1d8883, a96fe0b and c9453a1 are ancestors of HEAD.
