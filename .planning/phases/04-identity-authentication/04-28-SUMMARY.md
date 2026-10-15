---
phase: 04-identity-authentication
plan: 28
subsystem: auth
tags: [web, forgot-password, reset-password, s4, s5, new-password-fields, zod, idempotency-key, e2e, playwright, auth-08, auth-09, auth-11, a11y-03, d-16, d-17, d-19, oq-2]
status: complete
created: "2026-10-15T03:55:00-05:00"
updated: "2026-10-15T03:55:00-05:00"

requires: ["04-27", "04-19", "04-20", "04-25", "04-26", "04-04"]
provides:
  - "modules/admin/services/passwordService.ts: createPasswordService and passwordService (forgot, checkResetLink, resetPassword with the caller's Idempotency-Key; setNewPassword for plan 04-31), all skipAuthRefresh"
  - "modules/admin/authSchemas.ts: forgotSchema and newPasswordSchema(personal) (the shared password policy through passwordRules.ts, confirm-empty and mismatch)"
  - "modules/admin/components/NewPasswordFields.tsx: hidden username input, New password (strength meter, rule hint), Confirm new password, for S3, S5 and S6"
  - "modules/admin/pages/ForgotPasswordPage.tsx: S4 at /admin/forgot-password (ForgotPasswordForm, ForgotPasswordSent, ForgotPasswordRoute)"
  - "modules/admin/pages/ResetPasswordPage.tsx: S5 at /admin/reset-password (ResetPasswordForm, ResetPasswordRoute, tokenFromHash)"
  - "components/states LoadingRegion `announce` prop, components/actions ButtonLink `block` prop"
  - "core/api http client: an empty 202 resolves to undefined (the forgot-password answer)"
  - "e2e/auth-reset.spec.ts (@auth-reset) and testing-api latestEmail `after` cursor"
affects: [04-29, 04-30, 04-31, 04-32]

requirements-completed: []

actuals:
  tokens: 22000
  tasks: 2
  commits: 3
plan_head_before: e2e32cc1f5b11b8cf8b2725dab09fd60d2e1d78d
plan_head_after: 1a0b58943901f5dda496ba8c240542a3b386dd2b

tech-stack:
  added: []
  patterns:
    - "A URL-fragment token is read with a pure state initializer and removed in an effect with history.replaceState(history.state, ...) so the router keeps its history state; the token then lives in component memory and POST bodies only"
    - "A screen whose check can fail for two reasons keeps them apart: only a 400/404 from the server is 'expired'; network, 429 and 5xx show the shared banner with Try Again"
    - "A two-browser E2E uses a second raw browser context for the older session; only the fixture context is guarded"

key-files:
  created:
    - web/src/modules/admin/services/passwordService.ts
    - web/src/modules/admin/services/passwordService.test.ts
    - web/src/modules/admin/components/NewPasswordFields.tsx
    - web/src/modules/admin/components/NewPasswordFields.test.tsx
    - web/src/modules/admin/pages/ForgotPasswordPage.tsx
    - web/src/modules/admin/pages/ForgotPasswordPage.test.tsx
    - web/src/modules/admin/pages/ResetPasswordPage.tsx
    - web/src/modules/admin/pages/ResetPasswordPage.test.tsx
    - web/e2e/auth-reset.spec.ts
  modified:
    - web/src/modules/admin/authSchemas.ts
    - web/src/modules/admin/authSchemas.test.ts
    - web/src/modules/admin/authCopy.ts
    - web/src/modules/admin/components/AuthHeader.tsx
    - web/src/modules/admin/routes.tsx
    - web/src/components/states/LoadingRegion.tsx
    - web/src/components/states/loading.test.tsx
    - web/src/components/actions/ButtonLink.tsx
    - web/src/components/actions/links.test.tsx
    - web/src/core/api/http/httpClient.ts
    - web/src/core/api/http/httpClient.test.ts
    - web/src/core/api/http/HttpError.ts
    - web/e2e/testing-api.ts
    - docs/web/e2e.md

key-decisions:
  - "The reset link check returns only the account email, so the client keeps the email local part out of the password and leaves first and last name to the server"
  - "A check that never got an answer (network, 429, 5xx) is not called 'expired': S5 shows the shared banner and a Try Again button"
  - "On a saved reset this tab drops its own session (clearSession) before opening S1, so a stale in-memory session cannot send the visitor on to /admin"
  - "An empty 202 is 'no content' in the shared HTTP client (a 202 with a JSON body is still parsed)"

patterns-established:
  - "Auth E2E that needs a second session opens a second browser context; the fixture guard watches the first"
  - "latestEmail(request, to, { subject, after }) reads only mail after a cursor id, so a test that signs in twice reads the second code"

coverage:
  - id: C1
    description: "AUTH-08, AUTH-09, D-16, D-17, D-19: forgot a password on S1, S4 sends the request, the emailed link opens S5, a new password is saved, S1 shows the 'password was changed' notice, the new password plus a fresh emailed code signs in, and a second browser's refresh cookie no longer works"
    requirement: "AUTH-09"
    verification:
      - "e2e/auth-reset.spec.ts '@auth-reset a forgotten password is reset from the emailed link and the old session ends' passes in chromium, firefox, webkit, pixel and iphone (zero guard findings; page-level axe on S4 form, S4 sent and S5)"
  - id: C2
    description: "AUTH-08, SEC-06: S4 always swaps to the same 'Check your email' card for an accepted request, focus on its h1; 'Use a Different Email' returns to an empty focused form; one Idempotency-Key per submission, reused on a retry, new after a different email"
    requirement: "AUTH-08"
    verification:
      - "ForgotPasswordPage.test.tsx (9 tests: field errors with no request, sent state with the typed email in bold and h1 focus, the same card for an address with no account, a new key after Use a Different Email, retry reuses the key via a spy on passwordService.forgot, shared 429 copy, server email message under the field, axe)"
      - "e2e/auth-reset.spec.ts asserts an Idempotency-Key header on the forgot and reset requests (orchestrator note from plan 04-20)"
  - id: C3
    description: "T-04-98: the token is read from the fragment, removed from the address bar before any request, and sent only in POST bodies"
    requirement: "AUTH-09"
    verification:
      - "ResetPasswordPage.test.tsx 'removes the token from the address bar before the check request' (the page hash is '' when the check request arrives); the same test fails when removeFragment is commented out (checked by hand)"
      - "passwordService.test.ts (token in the body, empty query string); e2e asserts page.url() has no 'token' after S5 opens"
  - id: C4
    description: "OR-3, AUTH-11: newPasswordSchema returns the same first failure as every full and composition case in tests/fixtures/password-policy-cases.json, plus confirm-empty and mismatch; client errors show before any request; the server's message wins and takes focus"
    requirement: "AUTH-11"
    verification:
      - "authSchemas.test.ts (all golden cases through newPasswordSchema, forgotSchema, confirm rules; 70 tests)"
      - "ResetPasswordPage.test.tsx 'S5 validation that mirrors the server' (symbol rule, account email, confirm empty and mismatch, no request) and 'shows the server's message under New password and moves focus there'"
  - id: C5
    description: "S5 states: checking skeleton with 'Checking your link…' then 'Link checked.'; invalid state for no fragment, an empty token or a refused link with focus on the h1 and 'Request a New Link'; a failed check offers Try Again"
    requirement: "AUTH-08"
    verification:
      - "ResetPasswordPage.test.tsx (22 tests across tokenFromHash, token handling, invalid and failed links, validation, saving; axe in checking, form, invalid, failed and error states)"
      - "loading.test.tsx 'speaks the announce words'; links.test.tsx 'fills the width ... with block'"
  - id: C6
    description: "A11Y-03, OQ-2 default A: paste works in both fields, Show/Hide on both, autocomplete new-password, hidden username input only with an email, the strength meter stays and the rule is in the hint line"
    requirement: "A11Y-03"
    verification:
      - "NewPasswordFields.test.tsx (5 tests including paste, Show/Hide, meter and hint, axe)"
---

# Phase 4 Plan 28: Forgot and Reset Password Screens Summary

Staff who forgot their password can now recover it in the browser: S4 asks for the email and always answers with the same "Check your email" card, the emailed link opens S5 (token removed from the address bar at once), a new password is saved with the same rules the server uses, and every older session of the account stops working.

## What was built

- **Tracer (Task 1):** `passwordService`, `forgotSchema`, `newPasswordSchema`, `NewPasswordFields`, `ForgotPasswordRoute` (`/admin/forgot-password`, redirects a live session to `/admin`), `ResetPasswordRoute` (`/admin/reset-password`, works signed in or out) and the `@auth-reset` E2E in all five projects.
- **Behaviour (Task 2):** the unit and component tests for every S4 and S5 state, the shared-policy golden cases through `newPasswordSchema`, and the Idempotency-Key assertion in E2E. The behaviour itself was already delivered by Task 1's implementation, so these tests passed on their first run (see RED / GREEN evidence).

Tracer gate: interactive mode, `human_verify_mode` end-of-phase, automated-only `<verify>`. After GREEN the `@auth-reset` E2E (all five projects) and the typecheck were re-run and passed before the Task 2 tests were written.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Forgot, follow the emailed link, set a new password and sign in with it (E2E) | 248bd79 (RED), f7d4239 |
| 2 | S4 and S5 states, mirrored validation, focus rules and accessibility | 1a0b589 |

`commits: 3` is measured from the plan ledger (`plan_head_before`).

## RED / GREEN evidence

- Task 1 RED: `passwordService.test.ts` failed to load (the module did not exist) and the E2E had no route to reach. GREEN: the unit suite passes and `@auth-reset` passes in chromium, firefox, webkit, pixel and iphone (the first full run failed on two real findings, below).
- Task 2: there was no failing run to record. Task 1's implementation already met every listed behaviour, so all new tests passed first time (ForgotPasswordPage 9, ResetPasswordPage 22, NewPasswordFields 5, authSchemas 70 total). To prove the tests bite, `removeFragment()` was commented out by hand: two ResetPasswordPage tests failed; it was restored. This is why Task 2 has one `test(...)` commit and no separate `feat(...)` commit.

## Verification

- `npm --prefix web run verify` exit 0 after the preflight: typecheck, ESLint (0 warnings), Prettier, 130 test files and 3500 tests with coverage (statements 97.51%, branches 95.23%, functions 97.96%, lines 99.5%), production build, budget build, license gate, notices check.
- Bundles (gzip): production public JS 132.15 KB (limit 150), dev-route public JS 133.97 KB, admin JS 163.90 KB (limit 250), CSS 13.54 KB (limit 35). S4 and S5 are their own lazy chunks (2.21 KB and 3.47 KB gzip). No limit was raised.
- E2E: `--grep @auth-reset` 5 passed (chromium, firefox, webkit, pixel, iphone). The full 30-minute suite was not re-run for this plan; the changes outside the new files are the 202 rule in the HTTP client, two optional props and one E2E helper option, each unit-tested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The shared HTTP client rejected the forgot-password answer**
- **Found during:** Task 1 (first unit run of the S4 page).
- **Issue:** the server answers `202` with no body, but the client accepted an empty body only for 204, 205 and HEAD, so a successful request became `kind: 'parse'`.
- **Fix:** 202 joins the "may carry no body" statuses; a 202 with a JSON body is still parsed. Tests for both in `httpClient.test.ts`; the `HttpError` comment is updated.
- **Files modified:** web/src/core/api/http/httpClient.ts, HttpError.ts, httpClient.test.ts
- **Commit:** f7d4239

**2. [Rule 3 - Blocking] ButtonLink had no `block` prop**
- **Found during:** Task 1 (typecheck). UI-SPEC wants "Request a New Link" as a primary lg block link.
- **Fix:** `block` on `ButtonLink`, passed to `buttonClasses`, with a test.
- **Files modified:** web/src/components/actions/ButtonLink.tsx, links.test.tsx
- **Commit:** f7d4239

**3. [Rule 3 - Blocking] LoadingRegion could not speak the S5 words**
- **Found during:** Task 1. UI-SPEC wants "Checking your link…" then "Link checked.", but LoadingRegion only says "Loading {things}…" / "{Things} loaded.".
- **Fix:** an optional `announce` prop with the two sentences; the default pair is unchanged. One test.
- **Files modified:** web/src/components/states/LoadingRegion.tsx, loading.test.tsx
- **Commit:** f7d4239

**4. [Rule 3 - Blocking] A latestEmail call could read the first sign-in's code**
- **Found during:** Task 1 (writing the spec). The test signs in twice for one address, and the second read could return the first code.
- **Fix:** `latestEmail(..., { after })` reads only mail after a cursor id. Documented in `docs/web/e2e.md`.
- **Files modified:** web/e2e/testing-api.ts, docs/web/e2e.md
- **Commit:** 248bd79 (helper), f7d4239 (docs)

**5. [Rule 1 - Bug] The E2E timed out in WebKit**
- **Found during:** Task 1 (all five projects at once). Two sign-ins, a reset and a third sign-in exceed Playwright's 30 s default in WebKit under four workers (39 s).
- **Fix:** `test.setTimeout(90_000)` in the spec.
- **Commit:** f7d4239

**6. [Rule 3 - Blocking] The fixture file could not be read from a jsdom test**
- **Found during:** Task 2. `authSchemas.ts` imports `authCopy`, which imports component types, so a `*.golden.test.ts` (node tsconfig, no JSX) cannot import it; the jsdom environment cannot build a `file:` URL; and Vite blocks `?raw` outside the web folder.
- **Fix:** `authSchemas.test.ts` runs in the node environment (`// @vitest-environment node`) with a `/// <reference types="node" />`, and reads `tests/fixtures/password-policy-cases.json` with `readFileSync`.
- **Commit:** 1a0b589

### Plan interpretation

- **"Older session ... signed out at its next refresh ... 'Your session ended. Sign in again.'":** the e2e bundle's dev previews shadow `/admin` (see 04-27), so a reload there never refreshes; and the "session ended" notice is only set when a live tab's session ends in the page, not when the sign-in route's cookie check gets a 401 (that is also what a first-time visitor gets, so it cannot show a notice). The E2E therefore opens `/admin/login` in the older browser: a live session would go on to `/admin`, so S1 staying put proves the refresh cookie no longer works. The notice itself is not asserted.
- **Forgot route loader:** `redirectIfSignedIn` as planned, so the E2E declares the 401 refresh answer with `guard.expectStatus`. The reset route has no loader, so it makes no refresh call.
- **`setNewPassword`:** its body type is hand-written (`{ newPassword }`) because `POST /auth/password/set-new` is not in the generated API types yet (plan 04-21 adds it). No screen calls it until plan 04-31.
- **Extra files:** `ButtonLink`, `LoadingRegion`, `AuthHeader`, the HTTP client, `authCopy`, `testing-api.ts` and their tests were not in the plan's file list; each change is above.

## Decisions for the owner

- **Wording that is mine (SPEC-GAP, for the D-06 review):** when the reset link cannot be checked at all (offline, rate limit, server error) S5 says "We could not check your reset link yet." with the shared banner and a "Try Again" button, instead of claiming the link expired. UI-SPEC had no wording for this.
- **Name check is partly server-side:** the link check returns only the account email, so the browser keeps the email's local part out of the password, but the first and last name are only checked by the server (message shows under New password after the save attempt). Say so if you want the check endpoint to return the names too.
- **No "session ended" notice after a reset in another browser:** the old browser simply lands on the plain sign-in page the next time it needs a session. Showing the notice there would also show it to every first-time visitor.
- **Requirements not ticked:** AUTH-08, AUTH-09 and AUTH-11 now have their server and screen halves in place, but plans 04-21 (set-new) and 04-31 (S3 and S6) still touch AUTH-09 and AUTH-11, and A11Y-03 is shared with 04-29 to 04-32, so I left all four pending for the phase verification.

## Known Stubs

- `passwordService.setNewPassword` has no caller and no server route yet: the route comes in plan 04-21 and the screen (S3) in plan 04-31. It is covered by its own service test.

## Threat Flags

None beyond the plan's register. T-04-98 is mitigated by the fragment removal before any request (unit test plus E2E URL check) and the body-only token; T-04-99 by the single sent state for every accepted request (the server answers 202 for all). No installs.

## Self-Check: PASSED

Created files exist (`passwordService.ts`, `passwordService.test.ts`, `NewPasswordFields.tsx`, `NewPasswordFields.test.tsx`, `ForgotPasswordPage.tsx`, `ForgotPasswordPage.test.tsx`, `ResetPasswordPage.tsx`, `ResetPasswordPage.test.tsx`, `auth-reset.spec.ts`), and commits 248bd79, f7d4239 and 1a0b589 are ancestors of HEAD.
