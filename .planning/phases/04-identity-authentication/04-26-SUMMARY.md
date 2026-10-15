---
phase: 04-identity-authentication
plan: 26
subsystem: auth
tags: [web, sign-in, auth-layout, app-e5, zod, rhf, a11y-03, d-02, d-03, d-09, d-16, oq-1, oq-5]
status: complete
created: "2026-10-15T01:36:00-05:00"
updated: "2026-10-15T01:36:00-05:00"

requires: ["04-25"]
provides:
  - "layouts/AuthLayout.tsx: the App. E.5 page frame for every auth screen (Blush only, skip link first, brand panel with slab, bands, outlined C, logo and quote, form column as the one main#main); registers the session navigator like AdminLayout"
  - "modules/admin/pages/SignInPage.tsx: SignInForm (presentational, for the plan 04-32 parity preview) and SignInRoute (RHF + zodResolver + useSubmission over authService.signIn)"
  - "modules/admin/authCopy.ts: AUTH_COPY for S1 to S7, the notices, dialogs, menu items and toasts, no long dash"
  - "modules/admin/authSchemas.ts: signInSchema and isEmailShaped, mirroring SignInRequestValidator"
  - "modules/admin/components/AuthHeader.tsx: eyebrow, h1 (script-focusable) and muted subline"
  - "components/layout/layout.recipe.ts: authPageRootClasses and the App. C login recipes (login, brand, slab, bands, numeral, logo, quote, quote text, form column, card, title, eyebrow, row, link, back)"
  - "components/states Note (App. C .s-note, optional live status) and ErrorState align='center'|'start'"
  - "components/actions hitAreaClasses (OQ-5 invisible 44px tap area)"
  - "Logo context 'login' (the phone sizes of the auth brand panel)"
  - "Route /admin/login in a pathless AuthLayout branch outside the guard (adminRoutes), loader redirectIfSignedInLoader"
affects: [04-27, 04-28, 04-29, 04-30, 04-32]

requirements-completed: []

actuals:
  tokens: 18100
  tasks: 3
  commits: 7
plan_head_before: 192a3b49508d1463b4be51dc8e64435b9634a49b
plan_head_after: 404228507b1e1357d4ce791cd4a2a1459f55c091

tech-stack:
  added: []
  patterns:
    - "Auth screens are RHF Controllers over the in-house Field, PasswordField and Checkbox (controlled, no ref needed); the first invalid field is focused by name from the form's elements, so focus does not depend on a render"
    - "A 401 from sign-in is mapped before describeHttpError (which returns null for 401): the submit outcome is inspected in the route, not onFailure"
    - "The one-shot notice is read with a lazy useState initializer (the first call keeps it under StrictMode) and cleared at the next submit"
    - "hitAreaClasses: a fixed 44px-tall ::before box centred on the element, so small links reach 44px without changing what is drawn"

key-files:
  created:
    - web/src/layouts/AuthLayout.tsx
    - web/src/layouts/AuthLayout.test.tsx
    - web/src/modules/admin/authCopy.ts
    - web/src/modules/admin/authSchemas.ts
    - web/src/modules/admin/authSchemas.test.ts
    - web/src/modules/admin/components/AuthHeader.tsx
    - web/src/modules/admin/pages/SignInPage.tsx
    - web/src/modules/admin/pages/SignInPage.test.tsx
    - web/src/components/states/Note.tsx
    - web/src/components/states/Note.test.tsx
    - web/src/components/actions/button.recipe.node.test.ts
  modified:
    - web/src/components/layout/layout.recipe.ts
    - web/src/components/layout/layout.recipe.node.test.ts
    - web/src/components/states/ErrorState.tsx
    - web/src/components/states/ErrorState.test.tsx
    - web/src/components/states/states.recipe.ts
    - web/src/components/states/index.ts
    - web/src/components/actions/button.recipe.ts
    - web/src/components/actions/index.ts
    - web/src/components/index.test.ts
    - web/src/components/brand/brand.recipe.ts
    - web/src/components/brand/Logo.tsx
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/scripts/class-gate.config.mjs

key-decisions:
  - "Any 401 from sign-in shows the generic banner, not only the code auth.invalid-credentials, so no other 401 can describe an account (D-02, CWE-204)"
  - "The email and password carry aria-required instead of required, so no visible asterisk is added to the approved App. E.5 labels"
  - "Opening the sign-in page checks for a live session through its loader (redirectIfSignedInLoader from plan 04-25), so a guard redirect to /admin/login makes a second refresh request"
  - "The login numeral's 50% opacity is a D-02 allow-list entry limited to layout.recipe.ts (D-02 already names 'the login numeral')"

patterns-established:
  - "New auth screens (04-27 to 04-30) add a child under the AuthLayout branch in modules/admin/routes.tsx and reuse AuthHeader, Note, ErrorState align='start' and hitAreaClasses"

coverage:
  - id: C1
    description: "S1 is the App. E.5 screen in AuthLayout with the owner's deviations: Keep me signed in unticked and sent with the sign-in (D-03), Forgot password? a link to /admin/forgot-password (D-16), no deactivated banner (D-02)"
    requirement: "AUTH-01"
    verification:
      - "SignInPage.test.tsx 'S1 sign in tracer' (3 tests: screen content, keepSignedIn true and false in the POST body, code step opened with the same return path and the pending email kept)"
      - "AuthLayout.test.tsx (Blush root, skip link first and lands on main, one main#main, no landmark in the brand panel, axe)"
      - "layout.recipe.node.test.ts (16 login recipes equal their App. C transcription; grid 1.1fr 1fr and one column at 1023; phone panel 200px; card 420px with 20px gap; h1 44px then 36px; class gate)"
  - id: C2
    description: "OR-3: the S1 zod schema mirrors the server validator and shows its messages inline, focusing the first invalid field, before any request is sent"
    requirement: "AUTH-01"
    verification:
      - "authSchemas.test.ts (12 tests: trim, empty and whitespace email, five malformed forms, 256 and 257 characters, empty password, 200-character password, both fields at once)"
      - "SignInPage.test.tsx 'S1 client validation first' (empty submit focuses Email and sends nothing, password-only gap focuses Password, a malformed email clears as it is fixed)"
  - id: C3
    description: "D-02 and OQ-1: every credential failure is the one App. E.5 banner (role alert), values stay, focus moves to Password; 429, network and 5xx show the shared mapper banner with the reference and keep focus on Sign In; server field messages go under the fields"
    requirement: "AUTH-01"
    verification:
      - "SignInPage.test.tsx 'S1 failures' (401 with the code, 401 with another code, 429, network, 5xx with 'Reference: tr-500', 400 with Email errors, banner cleared on the next attempt, pending 'Signing in' with one request after a second click)"
  - id: C4
    description: "D-09: the email is never pre-filled or remembered; nothing is written to storage or cookies through a full sign-in"
    requirement: "AUTH-05"
    verification:
      - "SignInPage.test.tsx 'S1 never remembers the email' (empty fields, Storage.prototype.setItem spy not called, document.cookie empty after a sign-in with the box ticked)"
      - "acceptance grep: no localStorage on any non-comment line of SignInPage.tsx (0)"
  - id: C5
    description: "One-shot sign-in notices (session-ended, signed-out, password-changed, password-set, timed-out) show once in a live Note, clear at the next submit and do not return after a remount"
    requirement: "AUTH-05"
    verification:
      - "SignInPage.test.tsx 'S1 notices' (session-ended flow plus the four other keys with their icons, no notice on a plain visit); AdminLayout.test.tsx Logout and session-ended tests now assert the notice on the real sign-in page"
  - id: C6
    description: "A11Y-03: paste in both fields, Show/Hide, autocomplete username before current-password and unchanged by Show/Hide, no CAPTCHA or puzzle, zero axe violations (clean, with field errors, with a banner)"
    requirement: "A11Y-03"
    verification:
      - "SignInPage.test.tsx 'S1 accessible authentication' (4 tests)"
  - id: C7
    description: "OQ-5: Forgot password?, the checkbox label and the back link get an invisible 44px tap area; Note, ErrorState align and hitAreaClasses are exported for the other auth screens"
    requirement: "A11Y-03"
    verification:
      - "button.recipe.node.test.ts (transcription, compiled ::before box 44px tall and centred, the element itself changes only to position: relative); Note.test.tsx (4 tests); ErrorState.test.tsx 'align' (2 tests); index.test.ts pins Note; SignInPage.test.tsx 'S1 shared pieces'"
  - id: C8
    description: "AUTH_COPY holds every string of S1 to S7, the notices, dialogs, menu items and toasts, with no long dash"
    requirement: "AUTH-01"
    verification:
      - "no-long-dash.node.test.ts (passes over web/src in npm run verify); acceptance grep 'Email or password is incorrect.' in authCopy.ts"
---

# Phase 4 Plan 26: Sign-in Screen (S1) on the Auth Layout Summary

The approved App. E.5 sign-in screen now exists at `/admin/login` on a reusable auth layout. It validates in the browser exactly like the server, shows one generic error for every credential failure, never remembers the email, and hands a correct sign-in to the code step.

## What was built

- **Tracer (Task 1):** `AuthLayout` (Blush root, skip link, brand panel, form column as the single `main`), `AuthHeader`, the App. C login recipes, `AUTH_COPY`, `signInSchema`, `SignInForm`/`SignInRoute`, and the route `/admin/login` in a pathless AuthLayout branch beside the guarded layout. A correct sign-in posts `{email, password, keepSignedIn}`, keeps the email in memory, and navigates to `/admin/login/verify` with the same (validated) `returnUrl`.
- **Shared pieces (Task 2):** `Note` (App. C `.s-note`, optional `role="status"`), `ErrorState align="start"` for the App. E.5 banner, and `hitAreaClasses` (OQ-5) applied to Forgot password?, the checkbox label and the back link.
- **Behaviour (Task 3):** inline zod errors with focus on the first invalid field, the generic banner for any 401 with focus moving to Password, the shared mapper banner for 429, network and 5xx (focus stays), server field errors under their fields, the one-shot notice, no storage writes, and the accessible-authentication checks.

Tracer gate: interactive, `human_verify_mode` end-of-phase, automated-only `<verify>`. The verify commands (admin, layouts and layout-recipe tests, lint) were re-run after GREEN and passed before expanding.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | S1 on the auth layout sends the sign-in with the "Keep me signed in" choice and opens the code step | 0a119c1 (RED), 7b00d6a |
| 2 | Note, start-aligned banner and invisible 44px tap areas | 99c0726 (RED), b26053f |
| 3 | S1 behaviour: validation first, generic failure, notices, no remembered email, accessible authentication | 2437f70 (RED), 20f186e, 4042285 (D-02 deviation comment) |

## RED / GREEN evidence

- Task 1 RED: `AuthLayout`, `SignInRoute` and the login recipes did not exist (3 files failed, 19 tests). GREEN: SignInPage 3, AuthLayout 5, layout recipe tests pass.
- Task 2 RED: `Note`, `hitAreaClasses` and `align` did not exist (10 tests failed). GREEN: Note 4, ErrorState 20, node recipe test 3, index pin.
- Task 3 RED: 15 of 29 tests failed (no focus rules, no banner, no notice, no field errors). GREEN: 29 pass.

## Verification

- `npm --prefix web run verify` exit 0 after the preflight (ports 5180, 5115, 7028, 5199 free): typecheck, ESLint (0 warnings), Prettier, 125 test files and 3355 tests with coverage (statements 97.81%, branches 96%, functions 98.03%, lines 99.44%), production build, budget build, license gate, notices check.
- Class gate: `node scripts/class-gate.mjs` clean; no long dash (OR-4) in `web/src`.
- Bundles: the sign-in route is its own lazy chunk (`SignInPage` 39.13 KB gzip with react-hook-form, zod and the resolver; `AuthLayout` 0.75 KB gzip). The public entry is 119.51 KB gzip in the budget build, under the 150 KB limit; no limit was raised.
- E2E and Playwright were not run: this plan changes no E2E spec and the parity/look-equality proof for S1 belongs to plan 04-32.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Logo needed a context for the auth brand panel**
- **Found during:** Task 1 (App. C shrinks the lg logo on phones: gap 12, letters 56px, tagline 9.5px).
- **Issue:** the Logo exposes no way to reach those inner sizes from outside, and `brand.recipe.ts` was not in the plan's file list.
- **Fix:** a `login` Logo context beside `footer`, with the same pattern (`pg-phone:` steps in the context maps).
- **Files modified:** web/src/components/brand/brand.recipe.ts, Logo.tsx
- **Commit:** 7b00d6a

**2. [Rule 3 - Blocking] The login numeral's 50% opacity failed the class gate**
- **Found during:** Task 1.
- **Issue:** the D-02 opacity allow-list names "the login numeral" for later phases but had no entry.
- **Fix:** one allow-list entry `opacity-50`, limited to `layout.recipe.ts`, decision D-02. `class-gate.config.mjs` was not in the file list.
- **Commit:** 7b00d6a

**3. [Rule 1 - Bug] Existing tests assumed `/admin/login` was a dead end**
- **Found during:** Task 1 and Task 3.
- **Issue:** with the real route in place, Logout and a session that ends now land on a page whose loader looks for a session (an unhandled refresh request failed the AdminLayout tests), the sign-in page takes the one-shot notice before the tests could, and the 04-25 routes test counted one refresh request.
- **Fix:** `answerSignOut` also answers the refresh with 401; the Logout and session-ended tests now assert the notice on the sign-in page ("You've signed out.", "Your session ended. Sign in again."); the routes test expects the guard's refresh plus the sign-in page's own check (2 requests, both with `X-CSPS-CSRF: 1`).
- **Files modified:** web/src/layouts/AdminLayout.test.tsx, web/src/modules/admin/routes.test.tsx
- **Commits:** 7b00d6a, 20f186e

### Plan interpretation

- **Staff-only line in Task 1:** `Note` is Task 2, so the tracer GREEN used a small inline block for the staff-only line and Task 2 replaced it with `Note`.
- **Banner and notice in Task 3, not Task 1:** the tracer page had no banner or notice; Task 3 added them, so the RED/GREEN split follows the plan's tasks.
- **Focus by name, not `focusFirstInvalid`:** the first invalid field is focused from the form's `elements` right after the failed validation, because `aria-invalid` is only rendered after the next paint. `focusFirstInvalid` was not needed.
- **Extra files:** `button.recipe.node.test.ts` (the plan asks for the compiled-CSS proof of `hitAreaClasses`, in a recipe node test of its own), `authSchemas.test.ts` committed with Task 1 because the schema ships there.

## Decisions for the owner

- **No asterisk on Email and Password:** UI-SPEC says "required"; App. E.5 draws no asterisk. The fields use `aria-required`, so screen readers announce them as required and the approved look is unchanged.
- **Any 401 reads as the generic banner**, not only `auth.invalid-credentials`. A different 401 body can then never describe an account.
- **A second refresh request on the way to sign-in:** opening `/admin/orders` signed out makes the guard's refresh (401), the redirect, then the sign-in page's own session check (another 401). It is harmless and keeps the plan 04-25 loader as designed. Say so if you would rather remember "no session" for a few seconds to save the second request.
- **Pending label:** "Signing in" replaces the arrow icon with the spinner (WEB-09), as the App. E.5 loading state shows.
- **No requirement ticked:** AUTH-01, AUTH-05 and A11Y-03 need the code step, the reset screens and the E2E proof (04-27 to 04-32).

## Known Stubs

None in code. Two links point at screens built in later plans: "Forgot password?" goes to `/admin/forgot-password` (plans 04-28/04-29) and a correct sign-in goes to `/admin/login/verify` (plan 04-27). Until those exist, both fall through to the public placeholder page.

## Threat Flags

None beyond the plan's threat model. T-04-92 (remembered email) is proven by the storage-spy test and the empty-field test; T-04-93 (account state on screen) by the 401 tests (including a 401 with an unknown code) and by the absence of any deactivated copy in `AUTH_COPY`; T-04-94 by no inline style or script on the screen (class gate, strict CSP rules unchanged). No installs.

## Self-Check: PASSED

All created and modified files exist, and commits 0a119c1, 7b00d6a, 99c0726, b26053f, 2437f70, 20f186e and 4042285 are ancestors of HEAD.
