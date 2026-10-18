---
phase: 05-profile-user-management
plan: 18
subsystem: ui
tags: [profile, change-email, change-password, dialog, react-hook-form, zod, idempotency, prof-02, prof-03, d-24, d-46, or-3]
created: 2026-10-18T03:10:00-05:00
updated: 2026-10-18T03:10:00-05:00
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-12 POST /profile/password; 05-14, 05-39, 05-15 email-change request, resend and cancel; 05-13 ProfilePage, profileService, profileSchemas, profileCopy; 05-16 ConfirmEmailPage at /admin/confirm-email"
provides:
  - "Sign-in Email card on the Details tab: current email, Change Email (opens the P2 dialog), and while a change waits the note 'Waiting for confirmation at {new}. Until then, you sign in with {current}.' with Resend Link and Cancel Change"
  - "ChangeEmailDialog (P2): New email and Current password checked in the browser first, server field errors under their fields with focus, a lock or other failure as one alert line, each open starts clean"
  - "Change Password card on the Security tab above Signed-in Devices: Current password, NewPasswordFields, Update Password; wrong current password under its field with focus (D-46), breached or common under New password, the 429 lock in a banner, success clears the form and toasts"
  - "profileService.requestEmailChange, resendEmailChange, cancelEmailChange, changePassword; PASSWORD_LOCKED_CODE and EMAIL_CHANGE_NONE_CODE"
  - "changeEmailSchema(currentEmail) and changePasswordSchema(personal) in profileSchemas.ts, tested against the shared password-policy golden cases"
  - "lib/forms/serverFieldMessage and utils/describeHttpError errorLine (shared by the new dialog, the password card and SignOutDialog)"
  - "web/e2e/profile-email.spec.ts: @profile-email (send, confirm from the sink, only the new address signs in; resend and cancel) and @profile-password (other device signed out, this one kept, only the new password signs in)"
affects: [05-19 create-user route, 05-31 email review, 05-37 screen review and owner wording review (D-48), 05-25 Edit panel pending-email note]

actuals:
  tokens: 25800
  tasks: 3
  commits: 5
plan_head_before: 4b8cc68723acc61bac1942f355dff64f928381d1
plan_head_after: ce32d12e03f9825b29f216fcade6d6cd19201201

tech-stack:
  added: []
  patterns:
    - "A Modal form keeps its form state in a part that is mounted again on every open (key bumped while rendering), so each open starts clean without an effect"
    - "A footer submit button outside the form is tied to it with the form attribute, so Enter in a field still submits"
    - "A press that changes what the card shows sets a focus target in a ref; an effect keyed on the new state reads it, so a refetch from elsewhere never moves focus"
    - "A useSubmission that carries no data (resend, cancel) is reset after success, otherwise the same-data rule would make the next press send nothing"

key-files:
  created:
    - web/src/modules/admin/components/ChangeEmailDialog.tsx
    - web/src/modules/admin/components/ChangeEmailDialog.test.tsx
    - web/src/lib/forms/serverFieldMessage.ts
    - web/src/lib/forms/serverFieldMessage.test.ts
    - web/e2e/profile-email.spec.ts
  modified:
    - web/src/modules/admin/pages/ProfilePage.tsx
    - web/src/modules/admin/pages/ProfilePage.test.tsx
    - web/src/modules/admin/services/profileService.ts
    - web/src/modules/admin/services/profileService.test.ts
    - web/src/modules/admin/profileSchemas.ts
    - web/src/modules/admin/profileSchemas.test.ts
    - web/src/modules/admin/profileCopy.ts
    - web/src/modules/admin/components/NewPasswordFields.tsx
    - web/src/modules/admin/components/SignOutDialog.tsx
    - web/src/modules/admin/components/profile.recipe.ts
    - web/src/utils/describeHttpError.ts
    - web/src/utils/describeHttpError.test.ts

key-decisions:
  - "ChangeEmailDialog.onSent(newEmail, profile): the page writes the profile the POST returned into the profile query. A pending email does not change the edit version (UserAccounts.SetPendingEmailAsync), so the open name form is not made stale by it."
  - "Resend and cancel update the query by hand (cancel clears pendingEmail at once) and then invalidate it, so the card never shows a state the server has left; a resend that finds nothing waiting (404 email-change.none) does the same and says so in an info toast."
  - "While a change waits the card shows no Change Email button (UI-SPEC says either/or); a new request replacing the pending one is reached by Cancel Change first."
  - "The lock line is the server's own plain-English detail (profile.password-locked), with the same words in profileCopy as a fallback; every other failure uses the shared describeHttpError copy."

patterns-established:
  - "serverFieldMessage(errors, field): the server's first message for a field in any letter case, shared by every form that maps 400s"
  - "errorLine(copy): one sentence for a dialog's alert line from a describeHttpError copy"

requirements-completed: [PROF-02, PROF-03]

coverage:
  - id: D1
    description: "PROF-02 / D-24: a staff member changes the sign-in email from the Change Email dialog; the card shows the pending note with focus on it and a toast; Resend Link and Cancel Change act on the waiting change; the link from the new inbox completes the change"
    requirement: "PROF-02"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 Details: Sign-in Email (PROF-02, D-24)"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/components/ChangeEmailDialog.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile-email.spec.ts#@profile-email (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROF-03 / D-46: the Security tab changes the password; a wrong current password is a field error with focus on Current password; breached and common answers show under New password; the lock shows in the card banner; success clears the form"
    requirement: "PROF-03"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 Security: Change Password (PROF-03, OR-3)"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile-email.spec.ts#@profile-password (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D3
    description: "OR-3: the browser checks every rule the server checks before any request (new email shape, 256 characters, not the current email, current password required, full new-password rule with the person's name and email, confirm, new differs from current)"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/profileSchemas.test.ts#changeEmailSchema and changePasswordSchema (shared golden cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A password change on one device signs out the other (session-ended notice) and keeps this one; only the new password signs in; axe zero on the dialog, the pending note and the Security tab"
    requirement: "PROF-03"
    verification:
      - kind: e2e
        ref: "web/e2e/profile-email.spec.ts#@profile-password"
        status: pass
    human_judgment: false
  - id: D5
    description: "UI-SPEC wording for the Sign-in Email card, the Change Email dialog, the email-change toasts and the password toast is built as written (D-48) but not yet owner-approved"
    verification: []
    human_judgment: true
    rationale: "Owner ruling D-48: the wording is built as written and reviewed by the owner in the 05-31 and 05-37 reviews; no test can approve wording."

duration: 45min
completed: 2026-10-18
---

# Phase 5 Plan 18: Finish My Profile Summary

**Change Email dialog with a pending-change note (resend, cancel) and a Security-tab password change, both checked in the browser first (zod mirrors of the server validators) and proven end to end in five browser projects.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-10-18
- **Tasks:** 3 (all TDD: RED test commit before each GREEN commit)
- **Files:** 17 changed (5 new), +2473 / -33 lines

## Accomplishments

- The Details tab has a Sign-in Email card. Change Email opens the P2 dialog (New email, Current password, Send Confirmation Link). A taken address and a wrong password come back under their own fields with the cursor there. On success the dialog closes, the card shows the Note with the bold new address, focus moves to the note, and a toast says the link was sent. Resend Link and Cancel Change use the WEB-09 pending state, one Idempotency-Key per press, and toast.
- The Security tab has a Change Password card above Signed-in Devices. Every rule is checked in the browser with the person's name and email; the wrong current password is a field error with focus (D-46); breached and common answers sit under New password; the 429 lock shows the server's plain-English line in a banner; success clears all three fields and toasts "Password updated".
- `@profile-email` and `@profile-password` journeys pass in chromium, firefox, webkit, pixel and iphone, including the link from the Testing sink, "Your email is changed", sign-in with the new address only, and the other device landing on sign-in with "Your session ended."

## Task Commits

1. **Task 1: Tracer, Change Email dialog and pending note** - `00dd27e` (test, RED), `f2228ba` (feat)
2. **Task 2: Security tab password change** - `913a000` (test, RED), `d61ca74` (feat)
3. **Task 3: Browser proof, password change signs out the other device** - `ce32d12` (test, e2e)

**Plan metadata:** the docs commit that carries this file.

## Files Created/Modified

- `web/src/modules/admin/components/ChangeEmailDialog.tsx` - P2 dialog on Modal with Field, PasswordField and useSubmission
- `web/src/modules/admin/pages/ProfilePage.tsx` - SignInEmailCard and ChangePasswordCard
- `web/src/modules/admin/services/profileService.ts` - the four new calls and the two machine codes
- `web/src/modules/admin/profileSchemas.ts` - `changeEmailSchema`, `changePasswordSchema`
- `web/src/modules/admin/profileCopy.ts` - card, dialog, toast and error wording
- `web/src/modules/admin/components/NewPasswordFields.tsx` - accepts a form that has more fields than the pair
- `web/src/lib/forms/serverFieldMessage.ts`, `web/src/utils/describeHttpError.ts` (`errorLine`) - shared helpers; `SignOutDialog.tsx` now uses `errorLine`
- `web/e2e/profile-email.spec.ts` - the three journeys

## Decisions Made

See `key-decisions` above. Two more worth knowing: the Resend toast names the waiting address, and the card hides Change Email while a change waits (UI-SPEC says either/or), so replacing a pending change means Cancel Change first. The owner may want a "Change to a different address" path in the 05-37 review.

## TDD Gate Compliance

- **Task 1 RED (`00dd27e`):** 33 tests failed on the planned behavior: `service.requestEmailChange is not a function` (and the resend and cancel twins), `changeEmailSchema is not a function`, and the ProfilePage Sign-in Email tests timing out waiting for the card. `ChangeEmailDialog.test.tsx` failed at import because the component did not exist, a load failure by the strict #3770 reading (the same situation as 05-16), so the semantic RED rests on the service, schema and page failures, and the dialog tests passing only once the component existed. 72 passed before GREEN, 265 after.
- **Task 2 RED (`913a000`):** 22 tests failed (`service.changePassword is not a function`, the Security card tests waiting for "Change Password") and the 48 `changePasswordSchema` cases failed with `changePasswordSchema is not a function`. The schema file first failed at load because it read the shared JSON under jsdom; the `// @vitest-environment node` header was added before the RED commit, as in `authSchemas.test.ts`.
- **GREEN:** `f2228ba` and `d61ca74` precede no REFACTOR commit; the small refactor (shared `errorLine`, `serverFieldMessage`) landed inside Task 1's GREEN commit with its own tests.
- **Task 3:** an e2e-only task. Its RED evidence is the Task 1 and Task 2 Vitest failures, as the plan says.
- **Tracer gate:** Task 1 `<verify>` is automated-only, so it was re-run end to end before expanding: Vitest 4 files green, `@profile-email` 10 of 10 across five projects (see Issues Encountered for the Firefox runs).

## Verification

- `npm --prefix web run verify`: passed. 163 test files, 4814 tests, coverage thresholds, typecheck, lint, format, build, `build:budget` (admin bundle within budget), license gate, notices.
- `npm --prefix web run e2e -- --grep "@profile-password|@profile-email|@profile"`: all 35 passed across the runs (chromium, webkit and pixel in the full run; firefox and iphone re-run with 2 workers, 14 of 14).
- Acceptance greps: `export function ChangeEmailDialog` 1; `Waiting for confirmation at` 1; `@profile-email` 2; `changePasswordSchema` 2 in schemas and 2 in ProfilePage; `Your other devices were signed out.` 1.
- Preflight before every Playwright and verify run: ports 5180, 5115, 7028, 5199 free, no other project's processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A resend that finds no change waiting needed words**
- **Found during:** Task 1 (the 404 `email-change.none` answer of resend)
- **Issue:** The generic 404 copy says "refresh the list", which is wrong here, and the card would keep showing a note for a change that is gone.
- **Fix:** `PROFILE_COPY.toasts.nothingWaiting` ("No email change is waiting" / "It may have been canceled or finished in another tab."), and the card clears the pending state and re-reads the profile.
- **Files modified:** `profileCopy.ts`, `ProfilePage.tsx`
- **Commit:** `f2228ba`

**2. [Rule 3 - Blocking] Enter cannot be simulated for a footer button in jsdom**
- **Found during:** Task 1 (the Enter test)
- **Issue:** The dialog's submit button lives in the Modal footer, outside the `form`, tied to it with `form="…"`. Browsers submit on Enter through that button; user-event only looks for a submit button inside the form.
- **Fix:** The unit test asserts the tie (`type="submit"`, `form` equals the form id), and the e2e presses Enter in the password box.
- **Files modified:** `ChangeEmailDialog.test.tsx`, `profile-email.spec.ts`
- **Commit:** `f2228ba`

**3. [Rule 3 - Blocking] React Hook Form's Control is invariant, so a three-field form could not be passed to NewPasswordFields**
- **Found during:** Task 2 (typecheck)
- **Fix:** `NewPasswordFields` is generic over a form that has at least the pair and narrows the control once, with a comment saying why it is safe.
- **Files modified:** `NewPasswordFields.tsx`
- **Commit:** `d61ca74`

**4. [Rule 3 - Blocking] Two e2e assertions raced or hit sticky bars**
- **Found during:** Task 1 and Task 3 (e2e)
- **Issue:** `page.url()` was read right after `goto` while the confirm page still held the fragment; on the iPhone project axe flagged `target-size` on a "Show password" button because the sticky bars covered the field that took focus.
- **Fix:** wait for the Confirm New Email button before reading the URL; scroll to the top before axe once errors showed (the same remedy `profile.spec.ts` already uses).
- **Files modified:** `profile-email.spec.ts`
- **Commit:** `f2228ba`, `ce32d12`

**5. [Rule 3 - Scope] Shared helpers instead of copies**
- **Issue:** The dialog, the password card and the existing name card all needed the server's field message in any letter case, and the dialog needed SignOutDialog's one-line failure text.
- **Fix:** `serverFieldMessage` (with tests) and an exported `errorLine` (with tests); `SignOutDialog` and the name card now use them. No behavior change.
- **Commit:** `f2228ba`

**Total deviations:** 5 auto-fixed (1 missing critical, 4 blocking). **Impact:** no scope change; one extra string needs the owner's wording review.

## Issues Encountered

- **Firefox "font preloaded but not used within a few seconds" warning under load.** In the full 5-project run (4 workers) Firefox failed 4 tests with that console warning, two of them in the untouched `profile.spec.ts`; with `--workers=2` all Firefox and iPhone tests passed, and the plan's tracer run passed in Firefox alone. It is the same warning 05-08 recorded. It was added to `deferred-items.md` for the Phase 5 close-out test review.
- **`routes.test.tsx` timeouts** (5 s) in full parallel Vitest runs: the known item in `deferred-items.md`; it passes alone and inside `verify`.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; left alone.

## Known Stubs

None.

## Threat Flags

None: no new endpoint, auth path or schema; passwords stay out of URLs, toasts and the console (asserted in the unit and e2e tests), the form is cleared on success, and every state-changing POST carries one Idempotency-Key.

## Next Phase Readiness

Ready for 05-19. Owner wording review (D-48): the Sign-in Email card, the Change Email dialog, the three email-change toasts, "No email change is waiting" and the password toast are built as written and still need the owner's approval in the 05-31 and 05-37 reviews.

## Self-Check: PASSED

- Created files exist: `ChangeEmailDialog.tsx`, `ChangeEmailDialog.test.tsx`, `serverFieldMessage.ts`, `serverFieldMessage.test.ts`, `web/e2e/profile-email.spec.ts`.
- Commits `00dd27e`, `f2228ba`, `913a000`, `d61ca74`, `ce32d12` are ancestors of HEAD.
