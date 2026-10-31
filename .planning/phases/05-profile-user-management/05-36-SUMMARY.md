---
phase: 05-profile-user-management
plan: 36
subsystem: web-auth
tags: [react, session, open-redirect, a11y, react-hook-form, playwright, vitest]
created: "2026-10-18T04:51:00-05:00"
updated: "2026-10-18T04:51:00-05:00"

requires:
  - phase: 05-profile-user-management
    provides: "05-06, 05-13 and 05-16 (fragment helpers in utils/urlFragment, password rules, profile schemas)"
provides:
  - "Session refresh state that cannot hide a later 401"
  - "safeReturnUrl that returns exactly the literal path it validated"
  - "Resend announcement that follows the server's wait"
  - "useSetPasswordForm shared by the three set-password screens"
  - "One origin constant in playwright.config.ts"
affects: [05-37 (writes the IN outcomes into 04-REVIEW-DISPOSITION.md), USER-08 redirects, PROF-03 password screens]

actuals:
  tokens: 11100
  tasks: 3
  commits: 6

plan_head_before: 966ee2923d4728df819ea809bf4962250d0e8e7d
plan_head_after: 8ce3c25e323089407e3502b0e0cf204644d89917

tech-stack:
  added: []
  patterns:
    - "One hook owns the shared set-password form state; each screen keeps only its own save and failure branches"
    - "Return paths: validate the literal text, return the literal text"

key-files:
  created:
    - web/src/modules/admin/hooks/useSetPasswordForm.ts
    - web/src/modules/admin/hooks/useSetPasswordForm.test.tsx
  modified:
    - web/src/modules/admin/services/session.ts
    - web/src/modules/admin/services/session.test.ts
    - web/src/modules/admin/guard.ts
    - web/src/modules/admin/guard.test.ts
    - web/src/modules/admin/authCopy.ts
    - web/src/modules/admin/pages/VerifyCodePage.tsx
    - web/src/modules/admin/pages/VerifyCodePage.test.tsx
    - web/src/modules/admin/pages/ResetPasswordPage.tsx
    - web/src/modules/admin/pages/AcceptInvitePage.tsx
    - web/src/modules/admin/pages/NewPasswordPage.tsx
    - web/playwright.config.ts

key-decisions:
  - "refreshFailure is reset at the start of refreshSession's inner function (before the lock), and the old reset inside requestSession was removed so there is one place"
  - "safeReturnUrl checks only the path part decoded once; the query and hash are kept as given, so ?q=50%25 survives while an encoded start (%2Fadmin...) is refused"
  - "The spoken resend wait is held in a cooldownSeconds state (the server's resendAfterSeconds, or the seconds left when the screen opens) so it stays stable across countdown ticks"
  - "IN-15 resolved by deleting the dead keys; PASSWORD_RULE_MESSAGES stays the only home of the live rule wording"

patterns-established:
  - "Server field-error mapping for the set-password screens lives in useSetPasswordForm.applyFieldErrors (400 only, newPassword then confirmPassword, case-insensitive)"

requirements-completed: [USER-08, PROF-03]

coverage:
  - id: D1
    description: "A 401 after an earlier 503 and a peer-tab refresh still signs the tab out (IN-13); router callback renamed routerNavigate (IN-19)"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/services/session.test.ts#a 401 after an earlier 503 and a peer-tab refresh still ends the session (IN-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "safeReturnUrl accepts only literal single-slash /admin paths, keeps a percent-encoded query and refuses encoded and protocol-relative forms (IN-14)"
    requirement: "USER-08"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/guard.test.ts#safeReturnUrl (D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The code screen's polite announcement uses the server's resendAfterSeconds (IN-16)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/VerifyCodePage.test.tsx#announces the wait the server gave on a resend, the same number as the countdown (IN-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dead authCopy keys removed (IN-15)"
    verification:
      - kind: other
        ref: "grep -c fallbackEmail web/src/modules/admin/authCopy.ts is 0; typecheck and lint clean"
        status: pass
    human_judgment: false
  - id: D5
    description: "useSetPasswordForm shared by the reset, invite and new-password screens (IN-18)"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useSetPasswordForm.test.tsx"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @auth (94 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "playwright.config.ts uses one origin constant for webServer and use.baseURL (IN-11)"
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @auth (94 passed)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 36: Phase 4 web review notes Summary

**Closed Phase 4 web review notes IN-11, IN-13..IN-16, IN-18 and IN-19: a refresh failure that can no longer hide a 401, an exact-return-path `safeReturnUrl`, a resend announcement that follows the server, and one tested `useSetPasswordForm` for the three set-password screens.**

## Performance

- **Duration:** about 30 min (the @auth E2E run took 11 min)
- **Started:** 2026-10-18T04:21:00-05:00 (approximate)
- **Completed:** 2026-10-18T04:51:00-05:00
- **Tasks:** 3
- **Files modified:** 13 (2 created)

## Accomplishments

- IN-13 (test-first): `refreshFailure` is cleared at the start of every refresh, including the peer-tab shortcut, so a 401 after an earlier 503 signs the tab out.
- IN-19: the router callback inside `createSession` is `routerNavigate`; nothing shadows `navigator`.
- IN-14 (test-first, T-05-99): `safeReturnUrl` needs a literal start of a single `/`, validates the path decoded once, keeps the query and hash as given and returns the validated text. `?q=50%25` is kept; `%2Fadmin%2Forders`, `//evil`, `/\evil`, encoded dots and double-encoded paths are refused.
- IN-16 (test-first): `resendStarted(seconds)`; the screen holds the cooldown length so the spoken wait equals the visible countdown start.
- IN-15: removed `fallbackEmail`, `menu`, the eight unused `newPassword.errors` rule keys and `sessions.deviceLabel` after confirming no consumer.
- IN-18: `useSetPasswordForm` owns form, schema, focus, first-invalid focus, server field-error mapping, banner and submit handler. Reset, invite and new-password screens keep only their saves and screen-specific failures. The fragment helpers had already moved to `utils/urlFragment` in 05-16.
- IN-11: `use.baseURL` reads the same `origin` constant as `webServer`.

## IN outcomes (for 05-37 and 04-REVIEW-DISPOSITION.md)

| Note | Outcome | Commit |
|------|---------|--------|
| IN-11 | Fixed (`baseURL: origin`) | 8ce3c25 |
| IN-13 | Fixed test-first | b192099 (RED), 05a7272 |
| IN-14 | Fixed test-first | 81800f9 (RED), 8559e0a |
| IN-15 | Fixed (dead keys deleted; PASSWORD_RULE_MESSAGES unchanged) | 8559e0a |
| IN-16 | Fixed test-first | 81800f9 (RED), 8559e0a |
| IN-18 | Finished (shared hook; helper move was 05-16) | 18f9ef3 |
| IN-19 | Fixed | 05a7272 |

## Task Commits

1. **Task 1 (tracer): IN-13, IN-19** - `b192099` (test, RED), `05a7272` (fix, GREEN)
2. **Task 2: IN-14, IN-16, IN-15** - `81800f9` (test, RED), `8559e0a` (fix, GREEN)
3. **Task 3: IN-18, IN-11** - `18f9ef3` (refactor), `8ce3c25` (refactor)

**Plan metadata:** recorded in the docs commit that follows this file.

## TDD Gate Compliance

- **RED (IN-13):** the 503, peer-tab shortcut, 401 case failed on `getSessionUser()?.id` expected undefined, received the signed-in user. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (TAP, target_test_failed). Semantic assessment: the target ran and failed on the planned assertion for the planned reason.
- **RED (IN-14):** `keeps /admin/users?q=50%25 exactly as given` and `falls back to /admin for an encoded slash at the start` failed; both `RED_EVIDENCE_OK`. Semantic assessment: the old code refused the percent query and returned the raw encoded text.
- **RED (IN-16):** the new 45-second case failed expecting "45 seconds", receiving "60 seconds"; `RED_EVIDENCE_OK`. The existing 5-second countdown test also failed against the hardcoded 60 (its expectation was updated to `started(5)`, see Deviations).
- **GREEN:** every target passes; the full `src/modules/admin` suite passed (761 tests) before the refactor commits and the whole suite at the end (4890 tests).
- **REFACTOR:** Task 3 is a plan-defined refactor (suites green before and after).
- Tracer gate: Task 1's `<verify>` re-run after GREEN (62 passed), tracer verified before expansion.

## Files Created/Modified

- `web/src/modules/admin/services/session.ts` - refresh failure reset in `refreshSession`, `routerNavigate`
- `web/src/modules/admin/guard.ts` - literal-path `safeReturnUrl`
- `web/src/modules/admin/authCopy.ts` - `resendStarted(seconds)`, dead keys removed
- `web/src/modules/admin/pages/VerifyCodePage.tsx` - `cooldownSeconds` state for the announcement
- `web/src/modules/admin/hooks/useSetPasswordForm.ts` (+ test) - shared set-password form state
- `web/src/modules/admin/pages/{ResetPassword,AcceptInvite,NewPassword}Page.tsx` - use the hook
- `web/playwright.config.ts` - `baseURL: origin`
- Tests: `session.test.ts`, `guard.test.ts`, `VerifyCodePage.test.tsx`

## Decisions Made

See `key-decisions` above. Behaviour that changed on purpose: a return path whose query holds a literal percent is no longer dropped, and the code screen now says the real remaining wait (including "5 seconds" when the screen opens mid-cooldown).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing countdown test encoded the hardcoded 60-second announcement**
- **Found during:** Task 2 (RED)
- **Issue:** `VerifyCodePage.test.tsx` asserted "60 seconds" for a screen opened with a 5-second cooldown, which is the IN-16 bug itself.
- **Fix:** replaced the `STARTED` constant with `started(seconds)` and expected `started(5)` then `started(60)`.
- **Files modified:** `web/src/modules/admin/pages/VerifyCodePage.test.tsx`
- **Committed in:** 81800f9

**2. [Rule 3 - Blocking] react-hooks/refs lint error in the new hook test harness**
- **Found during:** Task 3
- **Issue:** reading `form.banner` and passing `form.formRef` from the returned object in a JSX harness tripped the React Compiler lint rule.
- **Fix:** destructured the hook result in the harness.
- **Files modified:** `web/src/modules/admin/hooks/useSetPasswordForm.test.tsx`
- **Committed in:** 18f9ef3

---

**Total deviations:** 2 auto-fixed (1 bug-in-test, 1 blocking lint)
**Impact on plan:** None on scope.

## Issues Encountered

- Vitest's TAP reporter prints multi-line assertion diffs, which the RED classifier reads as malformed TAP. The RED assertions were written to fail with single-line messages (`toBe` on a string) so the classifier could validate them. No product code was affected.
- The first RED commit for IN-13 and IN-16 relies on those single-line assertions; the IN-14 reds are string comparisons.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only diff from an earlier plan; left untouched.

## Known Stubs

None.

## Threat Flags

None. T-05-99 (open redirect, CWE-601) and T-05-100 (dead session after a stale failure) are mitigated and test-covered; no new network surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-37 can copy the IN outcomes table above into `04-REVIEW-DISPOSITION.md`.
- Verification: `src/modules/admin` Vitest passes, `npm --prefix web run e2e -- --grep @auth` 94 passed, `npm --prefix web run verify` exit 0 (4890 tests, coverage gates, license and notices gates).

## Self-Check: PASSED

- Files exist: useSetPasswordForm.ts and its test, this SUMMARY.
- Commits exist on the branch: b192099, 05a7272, 81800f9, 8559e0a, 18f9ef3, 8ce3c25.
- Acceptance criteria: `routerNavigate` count 3, `let navigator` 0, `fallbackEmail` 0, `60 seconds` 0 in authCopy, `baseURL: origin` 1, `useSetPasswordForm` present in all three pages.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
