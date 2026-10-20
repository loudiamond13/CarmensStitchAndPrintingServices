---
phase: 05-profile-user-management
plan: 16
subsystem: ui
tags: [confirm-email, email-change, auth-layout, idempotency, url-fragment, prof-02, c-17, in-18]
created: 2026-10-18T02:03:00-05:00
updated: 2026-10-18T02:03:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-13 profileService and profileCopy; 05-14 and 05-39 POST /profile/email-change/check and /confirm; 05-15 email-change.taken (409)"
provides:
  - "P3 Confirm your email screen (ConfirmEmailRoute) at /admin/confirm-email, reachable signed in or not, in the AuthLayout branch with no sign-in loader"
  - "profileService.checkEmailChange(token, signal) and confirmEmailChange(token, idempotencyKey, signal): token in the JSON body, skipAuthRefresh"
  - "PROFILE_COPY.confirmEmail: the P3 strings (UI-SPEC wording, built not yet owner-approved, D-48)"
  - "web/src/utils/urlFragment.ts: tokenFromHash and removeFragment, shared by the reset, invite and confirm-email screens (IN-18 part)"
affects: [05-18 profile Details tab and @profile-email spec, 05-36 IN-18 finish, 05-37 IN-18 disposition and screen review, 05-31 email review]

actuals:
  tokens: 11100
  tasks: 2
  commits: 4
plan_head_before: 67c7705b9863a45f6fcd85a565750d042a9cfc45
plan_head_after: 8030735647cf5e543c3b18b34df01d898a3860ab

tech-stack:
  added: []
  patterns:
    - "A link screen whose action is destructive checks read-only on load and acts only on an explicit press (mail scanners open links)"
    - "End states (invalid, taken, done) share one ResultCard that focuses its h1 on mount"
    - "Fragment token helpers live in utils/, never exported from a page"

key-files:
  created:
    - web/src/modules/admin/pages/ConfirmEmailPage.tsx
    - web/src/modules/admin/pages/ConfirmEmailPage.test.tsx
    - web/src/utils/urlFragment.ts
    - web/src/utils/urlFragment.test.ts
  modified:
    - web/src/modules/admin/services/profileService.ts
    - web/src/modules/admin/services/profileService.test.ts
    - web/src/modules/admin/profileCopy.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/pages/ResetPasswordPage.tsx
    - web/src/modules/admin/pages/ResetPasswordPage.test.tsx
    - web/src/modules/admin/pages/AcceptInvitePage.tsx

key-decisions:
  - "Only a 409 with code email-change.taken is the can't-be-used state; any other 409 on the confirm press keeps Ready with the shared banner (the same Idempotency-Key is reused on retry because useSubmission treats a 409 as maybe-run)"
  - "The check's 409 does not carry the address, so a link whose address was taken before it was opened says 'this email' (bodyNoAddress); a taken answer to the press names the address already shown"
  - "A check that gets no answer (network, 429, 5xx) shows the heading, the shared banner and Try Again, never the expired state (T-05-46, 04-28 rule)"

patterns-established:
  - "P3 follows the S5/S6 structure (checking via LoadingRegion + CheckingCard, failed card with Try Again) but the Ready state is a button, not a form"

requirements-completed: [PROF-02]

coverage:
  - id: D1
    description: "PROF-02 / C-17: the new inbox's owner opens the link, sees the address, presses Confirm New Email and is told the email changed; nothing is posted to confirm before the press, and the confirm carries one Idempotency-Key reused on retry"
    requirement: "PROF-02"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ConfirmEmailPage.test.tsx#P3 confirming > sends the token with one Idempotency-Key, shows Confirming while it runs, then Done with focus on the heading"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ConfirmEmailPage.test.tsx#P3 ready > names the new address in bold, offers the button and posts nothing to confirm until it is pressed"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ConfirmEmailPage.test.tsx#P3 confirming > keeps Ready with the shared banner when the confirm gets no answer, and retries with the same Idempotency-Key"
        status: pass
    human_judgment: false
  - id: D2
    description: "The token leaves the address bar before the first request and travels only in POST bodies; no fragment or an empty one shows the invalid state with no request"
    requirement: "PROF-02"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ConfirmEmailPage.test.tsx#P3 token handling and the checking state"
        status: pass
      - kind: unit
        ref: "web/src/utils/urlFragment.test.ts#removeFragment"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid, taken (at check and at press) and failed-check states with heading focus, the 04-28 rule that a check with no answer is never called expired, and zero axe violations"
    requirement: "PROF-02"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/ConfirmEmailPage.test.tsx#P3 invalid, taken and failed links"
        status: pass
    human_judgment: false
  - id: D4
    description: "profileService check and confirm calls and the /admin/confirm-email route (signed in or not, no refresh)"
    requirement: "PROF-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/services/profileService.test.ts#profileService.confirmEmailChange"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#the confirm-email link (PROF-02, C-17)"
        status: pass
    human_judgment: false
  - id: D5
    description: "IN-18 part: tokenFromHash and removeFragment moved to utils/urlFragment.ts; no page under admin/pages imports another page"
    verification:
      - kind: unit
        ref: "web/src/utils/urlFragment.test.ts"
        status: pass
      - kind: other
        ref: "grep of admin/pages for page-to-page imports returns nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "P3 wording (SPEC-GAP strings, including the no-address taken variant) reads right to the owner"
    verification: []
    human_judgment: true
    rationale: "Owner ruling D-48: the UI-SPEC wording is built as written and is not approved until the owner reviews it (05-31 email review, 05-37 screen review)"

duration: 23min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 16: Confirm-your-email screen Summary

**P3 `/admin/confirm-email` page that checks an email-change link read-only, shows the new address, and changes the sign-in email only on an explicit "Confirm New Email" press (one Idempotency-Key per press), plus the shared `utils/urlFragment` helpers that remove the page-to-page import (IN-18 part).**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-18T01:39:02-05:00
- **Completed:** 2026-10-18T02:02:00-05:00
- **Tasks:** 2
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments

- ConfirmEmailPage covers every P3 state: checking ("Checking your link…" then "Link checked."), Ready (address in bold, "Confirm New Email", "Confirming" while pending), Done (h1 "Your email is changed" focused, "Continue to CSPS Admin" to `/admin`), Invalid and Taken (h1 focused, one state each, no detail), and a failed check (shared banner and Try Again, never "expired").
- Opening the link changes nothing: the check is read-only and the confirm POST fires only from the button (prohibition resolved by test: `confirmBodies` stays empty until the press). The token is removed from the address bar before the first request and only ever sent in POST bodies.
- `/admin/confirm-email` is in the auth branch with no sign-in loader and works with or without a session (routes test, no refresh call).
- IN-18 (part): `tokenFromHash` and `removeFragment` moved verbatim to `web/src/utils/urlFragment.ts`; ResetPasswordPage, AcceptInvitePage and ConfirmEmailPage import them from there and no page under `admin/pages` imports another page. 05-36 finishes IN-18 and 05-37 writes its disposition.

## Task Commits

1. **Task 1: Tracer, confirm-your-email screen (PROF-02)**
   - `90dabe3` test (RED)
   - `92f5185` feat (GREEN)
2. **Task 2: Fragment helpers move to utils (IN-18 part)**
   - `fb5a4ba` test (RED)
   - `8030735` refactor (GREEN)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## TDD Gate Compliance

- **Task 1 RED:** `profileService` tests failed on the planned assertion (`service.checkEmailChange is not a function`, `typeof ... toBe 'function'` got `undefined`) and the two routes tests timed out waiting for the "Confirm New Email" button (the path fell through to the holding page). The `ConfirmEmailPage.test.tsx` file failed at import because the page module did not exist yet; that is a load failure by the strict #3770 reading, so the semantic RED evidence for the page rests on the service and route failures plus the page tests passing only once the page existed. 9 tests failed before GREEN; 44 passed after.
- **Task 2 RED:** `urlFragment.test.ts` failed with "Failed to resolve import '@/utils/urlFragment'" (the module is the thing being created by a move). The existing tokenFromHash cases moved out of ResetPasswordPage.test.tsx, so no coverage was lost. 
- **GREEN/REFACTOR:** Task 1 `feat(05-16)` and Task 2 `refactor(05-16)` as the plan names them. All RED commits precede their GREEN commits.
- **Tracer gate:** Task 1 `<verify>` is automated-only, so it was re-run end to end (3 files, 44 tests passed) before expanding.

## Verification

- `npm --prefix web run test -- --run src/modules/admin/pages/ConfirmEmailPage.test.tsx src/modules/admin/services/profileService.test.ts src/modules/admin/routes.test.tsx`: 44 passed.
- `npm --prefix web run test -- --run src/utils/urlFragment.test.ts src/modules/admin/pages`: 10 files, 225 passed.
- `npm --prefix web run verify` (typecheck, lint, format:check, test:coverage with thresholds, build, build:budget, license:check, notices:check): passed on the second run, 161 files, 4681 tests (see Issues Encountered for the first run).
- Acceptance criteria: `grep -c "admin/confirm-email" routes.tsx` = 1; SPEC-GAP marker in ConfirmEmailPage = 1; `replaceState|removeFragment` in ConfirmEmailPage = 3; no page-to-page imports; `export function tokenFromHash` in urlFragment.ts = 1.
- Preflight before the test runs: ports 5180, 5115, 7028, 5199 free, no other project's processes. No dev server or Playwright was started; the end-to-end journey is 05-18's `@profile-email` spec.

## Decisions Made

- Only `409 email-change.taken` opens the can't-be-used state. Another 409 on the press (for example a lost save race) keeps Ready and shows the shared banner; a retry reuses the Idempotency-Key.
- The check's 409 carries no address (the generated `EmailChangeResponse` is only on 200), so the check-time Taken state uses a sentence without the address ("Another account now uses this email. …"). A taken answer to the press names the address the person already saw. Backend left unchanged (out of this plan's files).
- Confirm and check use `skipAuthRefresh`, so a stray 401 never ends or refreshes a session on this anonymous page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gitleaks flagged the fake link token in the new tests**
- **Found during:** Task 1 (first RED commit attempt, staged scan)
- **Issue:** `TOKEN = 'abcDEF0123456789…'` in `ConfirmEmailPage.test.tsx` and a similar literal in `routes.test.tsx` tripped `generic-api-key` (entropy 3.98), and the commit hook failed.
- **Fix:** Used `'x'.repeat(43)` and `'z'.repeat(43)` (still 43 characters, like a real token) instead of adding path entries to `.gitleaks.toml`. No config weakened.
- **Files modified:** `ConfirmEmailPage.test.tsx`, `routes.test.tsx`
- **Verification:** `gitleaks protect --staged` clean; commit hook passed.
- **Committed in:** `90dabe3`

**2. [Rule 2 - Missing critical] Taken state without an address for the check-time 409**
- **Found during:** Task 1 (copy)
- **Issue:** UI-SPEC's taken body names `{new email}`, but the check's 409 problem body does not carry it, so there is no address to show.
- **Fix:** Added `PROFILE_COPY.confirmEmail.taken.bodyNoAddress` for that one path; the address is named whenever it is known. Needs the owner's wording review (D-48).
- **Files modified:** `profileCopy.ts`, `ConfirmEmailPage.tsx`
- **Committed in:** `92f5185`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** No scope change. Both keep the plan's behavior; the second adds one string.

## Issues Encountered

- The first full `verify` run failed one test: the cold-start timeout of `routes.test.tsx > opening /admin/orders without a session…` (5 s default, 24 parallel workers). This is the known item already in `deferred-items.md` ("Slow first test in the admin route suite", found in 05-07), not caused by this plan's changes; the same file passed in isolation and the second full `verify` passed. Left for the Phase 5 close-out test review as recorded.
- A keyed POST is retried by the HTTP client on a 503, so the "retries with the same Idempotency-Key" test uses a 500 for the first answer (503 never reaches the screen).
- Wording note for the owner review (D-48, deferred-items "Owner wording review"): the P3 strings are built as written and are not approved, including the extra no-address taken sentence above.

## Known Stubs

None.

## Threat Flags

None. The page adds no endpoint; it calls two anonymous routes already covered by T-05-41 and the plan's T-05-43 to T-05-46. Mitigations applied: fragment removed with `replaceState` before any request and token only in POST bodies (T-05-43); confirm only on the button press (T-05-44); the address rendered as a text node inside `<strong>` (T-05-45); a failed check shows the banner and Try Again, not the expired state (T-05-46).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-18 can link the emailed address flow end to end (`@profile-email` spec) against `/admin/confirm-email#token=…`.
- 05-36 and 05-37 finish and dispose IN-18; the page-to-page import is gone as of this plan.
- Open for the owner: wording review of the P3 strings (D-48).

## Self-Check: PASSED

- Files exist: `ConfirmEmailPage.tsx`, `ConfirmEmailPage.test.tsx`, `urlFragment.ts`, `urlFragment.test.ts` (checked below with `[ -f ]`).
- Commits `90dabe3`, `92f5185`, `fb5a4ba`, `8030735` are ancestors of HEAD.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
