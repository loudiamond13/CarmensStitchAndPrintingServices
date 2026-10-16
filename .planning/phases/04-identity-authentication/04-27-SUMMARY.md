---
phase: 04-identity-authentication
plan: 27
subsystem: auth
tags: [web, sign-in, code-step, otp, resend-countdown, e2e, playwright, cookies, webkit, a11y-03, d-01, d-10, oq-6]
status: complete
created: "2026-10-15T02:45:00-05:00"
updated: "2026-10-15T02:45:00-05:00"

requires: ["04-26", "04-14", "04-10", "04-17"]
provides:
  - "modules/admin/pages/VerifyCodePage.tsx: VerifyCodeForm (presentational, for the plan 04-32 parity preview) and VerifyCodeRoute: S2 at /admin/login/verify (six-box code, Verify Code, Resend countdown, one polite status, never-share note, back link)"
  - "modules/admin/authSchemas.ts: verifySchema (exactly six ASCII digits, 'Enter all 6 digits.') and zod in non-generated mode (no CSP eval report)"
  - "modules/admin/services/session.ts: completeSignIn, setResendAvailableAt/getResendAvailableAt, setPasswordChangeReason/getPasswordChangeReason (memory only)"
  - "components/actions Button: aria-disabled prop (focusable, looks disabled, swallows activation, no spinner)"
  - "components/entry OtpInput: a whole code (six digits or more) pasted or autofilled into any box fills all six"
  - "e2e/auth.ts: signInAs, codeFromEmail, typeCode for every later auth spec; @auth and @auth-cookies specs"
  - "playwright.config.ts: auth-cookies.spec.ts runs in chromium, firefox and webkit only"
affects: [04-28, 04-29, 04-30, 04-31, 04-32]

requirements-completed: []

actuals:
  tokens: 20700
  tasks: 3
  commits: 6
plan_head_before: d1c2adda0988df946a8f5e8210bde1efaed02bfe
plan_head_after: f11fc8db749388e324b703c60fd084fc65b10907

tech-stack:
  added: []
  patterns:
    - "The e2e bundle's dev previews shadow every guarded /admin path, so E2E proves the real session through the verify answer (server-named user) and the sign-in page redirecting a live session to /admin, not through the shell's user chip"
    - "Cookie specs read each cookie twice: the Set-Cookie header the server sent and the browser jar"
    - "A cooldown countdown is derived state (resendAt, a once-a-second clock) with one live region whose text changes only at the start and end of the wait"

key-files:
  created:
    - web/src/modules/admin/pages/VerifyCodePage.tsx
    - web/src/modules/admin/pages/VerifyCodePage.test.tsx
    - web/e2e/auth.ts
    - web/e2e/auth.spec.ts
    - web/e2e/auth-cookies.spec.ts
  modified:
    - web/src/modules/admin/authSchemas.ts
    - web/src/modules/admin/authSchemas.test.ts
    - web/src/modules/admin/services/session.ts
    - web/src/modules/admin/services/session.test.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/pages/SignInPage.tsx
    - web/src/modules/admin/pages/SignInPage.test.tsx
    - web/src/components/actions/Button.tsx
    - web/src/components/actions/Button.test.tsx
    - web/src/components/entry/OtpInput.tsx
    - web/src/components/entry/OtpInput.test.tsx
    - web/e2e/fixtures.ts
    - web/e2e/admin-keyboard.spec.ts
    - web/playwright.config.ts
    - docs/web/e2e.md
    - docs/development.md

key-decisions:
  - "Any 400 with a message on the code field shows that server message under the boxes; the screen's own words (wrong, used up, expired) are only the fallback when the server sent none"
  - "Any 401 from verify or resend means the pending sign-in is gone: the 'timed-out' notice and back to S1, whatever the error code"
  - "The 'new code sent' Note is not a live region: the screen has exactly one polite status (OQ-6), and it already says a new code was sent"
  - "The cooldown lives in session memory (set by S1 and by each resend), never in storage, so a refresh starts with Resend available"

patterns-established:
  - "Every auth E2E test calls guard.expectStatus('/api/v1/auth/refresh', 401) for a page that opens without a session (the sign-in routes ask the refresh cookie first)"
  - "Ticking a checkbox in E2E goes through its label (the OQ-5 tap area covers the box)"

coverage:
  - id: C1
    description: "AUTH-02, D-01: a staff member signs in on S1, reads the 6-digit code from the sink, enters it on S2 and reaches the admin shell; a visit to /admin/login after sign-in goes on to /admin through the refresh cookie"
    requirement: "AUTH-02"
    verification:
      - "e2e/auth.spec.ts '@auth a staff member signs in ...' passes in chromium, firefox, webkit, pixel and iphone (verify answer names E2E Staff, Manager; zero guard findings)"
      - "VerifyCodePage.test.tsx 'S2 code step tracer' (8 tests: email named, fallback, no auto-submit, signed-in and return path, unsafe return path, set-new-password hand-off with the reason in memory and no session, empty submit)"
  - id: C2
    description: "OR-3, A11Y-03: verifySchema mirrors the server; anything but six digits shows 'Enter all 6 digits.' and focuses box 1 without a request; a whole code pasted into any box fills all six; nothing auto-submits"
    requirement: "A11Y-03"
    verification:
      - "authSchemas.test.ts verifySchema (accepts 000123 and 048213, rejects '', 12345, 12 45, 1234567, 12a456, ' 123456', full-width digits)"
      - "VerifyCodePage.test.tsx 'S2 client validation first' (3 tests) and OtpInput.test.tsx (2 new tests)"
      - "e2e/auth.spec.ts second test: six digits typed, still on S2"
  - id: C3
    description: "Server code errors show under the code in the server's words, clear all six boxes and focus box 1; the lock shows 'Too many wrong codes.'; a gone ticket returns to S1 with the 'timed-out' notice; network and 5xx show the shared banner with the reference; a signed-in answer with no session is a server fault"
    requirement: "AUTH-03"
    verification:
      - "VerifyCodePage.test.tsx 'S2 code errors' (11 tests including it.each over wrong, used-up and expired, the fallback words, Resend still usable, the pending 'Verifying' state with one request)"
  - id: C4
    description: "AUTH-04, OQ-6, D-10: Resend is aria-disabled and counts down m:ss from the server's 60 seconds; one polite status speaks only at the start and end; a resend shows the note and restarts the count; the hourly cap shows the banner, keeps Resend aria-disabled with no time; a refresh starts with Resend available; a refused-inside-cooldown resend shows the shared 429 copy"
    requirement: "AUTH-04"
    verification:
      - "VerifyCodePage.test.tsx 'S2 resend countdown' (9 tests, fake timers; the status is asserted by recording its distinct texts, [started, ready] and [started, ready, started] after a resend)"
      - "Button.test.tsx 'Button aria-disabled' (2 tests)"
      - "session.test.ts 'sign-in completion and the code step state' (4 tests) and SignInPage.test.tsx (the wait is kept in memory)"
  - id: C5
    description: "AUTH-05 cookie spike (research Pitfall 2, A8): __Secure-csps_rt is HttpOnly, Secure, SameSite Strict, Path /api/v1/auth, about 90 days with Keep me signed in and a session cookie without; scripts cannot read it; the ticket cookie is gone"
    requirement: "AUTH-05"
    verification:
      - "e2e/auth-cookies.spec.ts: 6 tests pass (2 per engine, chromium, firefox, webkit). Set-Cookie header on the verify answer and the jar: see 'Cookie spike result per engine'"
  - id: C6
    description: "A11Y-03 on S2 and accessible authentication: one-time-code on the first box only, paste, no CAPTCHA, zero axe violations clean, with a code error and with a banner; the code never reaches a URL or a browser store"
    requirement: "A11Y-03"
    verification:
      - "VerifyCodePage.test.tsx 'S2 accessible authentication' (2 tests); e2e/auth.spec.ts axe on S1 and S2 in all five projects"
---

# Phase 4 Plan 27: Code Step (S2), End-to-End Sign-in and the Cookie Spike Summary

Staff can now finish a real sign-in in the browser: password on S1, the emailed 6-digit code on S2, then the admin. The flow is proven on the real host in all five Playwright projects, and the secure refresh cookie is proven in Chromium, Firefox and WebKit.

## What was built

- **Tracer (Task 1):** `VerifyCodePage` at `/admin/login/verify` in the auth branch, `verifySchema`, session hand-off helpers (`completeSignIn`, the resend time and the password-change reason in memory), and the E2E helpers `signInAs` and `codeFromEmail`. Sign-in goes S1, then the code read from the Testing sink, then S2, then the admin shell. A must-change account goes to `/admin/login/new-password` with the reason kept in memory.
- **Behaviour (Task 2):** server code errors under the boxes (boxes cleared, focus on box 1), the lock and resend-cap banners, the timed-out return, the `m:ss` Resend countdown with a single polite status that speaks only at the start and the end, and the "new code sent" note.
- **Cookie spike (Task 3):** `@auth-cookies` in chromium, firefox and webkit, with and without "Keep me signed in".

Tracer gate: interactive mode, `human_verify_mode` end-of-phase, automated-only `<verify>`. After GREEN the `@auth` E2E (all five projects) and the typecheck were re-run and passed before expanding.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | S1 then S2 on the real host, code read from the sink, in every browser project | 881b751 (RED), ab32f07 |
| 2 | S2 code errors, resend countdown and announcements, caps, timed-out return | c7458b4 (RED), 84d7bf6 |
| 3 | Cookie spike in three engines and the two session kinds | 4435d25 (RED), f11fc8d |

`commits: 6` is measured from the plan ledger (`plan_head_before`).

## Cookie spike result per engine

Run on `https://localhost:5199` (ASP.NET dev certificate, `ignoreHTTPSErrors`), after a real sign-in.

| Engine | Cookie stored | HttpOnly | Secure | Path `/api/v1/auth` | SameSite Strict | 90 days vs session |
|---|---|---|---|---|---|---|
| Chromium | yes | yes | yes | yes | header and jar | about 90 days with the box ticked, `expires -1` without |
| Firefox | yes | yes | yes | yes | header and jar | same |
| WebKit | yes (not refused) | yes | yes | yes | header; **jar reports "None"** (see below) | same |

- `document.cookie` does not contain `csps_rt` in any engine; the ticket cookie (`__Secure-csps_2fa`) is gone after sign-in; a visit to `/admin/login` after sign-in goes on to `/admin` through the cookie alone, and the cookie keeps its flags after that rotation.
- **WebKit did not refuse the `__Secure-` cookie**, so the plan's conditional checkpoint (cookie refused) did not trigger. One observation: Playwright's WebKit on Windows reports `sameSite: "None"` for every cookie in its jar, even one added with `sameSite: "Strict"` (checked directly with `addCookies`; Chromium reads all three back correctly). So for WebKit the spec asserts SameSite from the `Set-Cookie` header the browser received (`samesite=strict`) and asserts HttpOnly, Secure, Path and lifetime from the jar. Whether real Safari honours Strict is for Phase 3 to confirm over real HTTPS (see Decisions for the owner).

## RED / GREEN evidence

- Task 1 RED: the new E2E specs failed in chromium (no S2 route), the unit tests failed (`verifySchema`, `completeSignIn`, the resend helpers and `VerifyCodeRoute` did not exist; 13 tests failed). GREEN: the same suites pass, and `@auth` passes in all five projects.
- Task 2 RED: 22 tests failed (the countdown, errors, caps, the Button prop and the OtpInput whole-code paste). GREEN: 102 tests across the three files pass.
- Task 3: the spec was written after the server and the helper already existed, so there was no failing server behaviour to turn green. Its first run did fail, for two real findings: the tap-area overlay made `check()` on the checkbox time out in every engine (fixed in `signInAs`), and WebKit's jar reports SameSite "None" (documented above). It then passes in all three engines.

## Verification

- `npm --prefix web run verify` exit 0 after the preflight: typecheck, ESLint (0 warnings), Prettier, 126 test files and 3406 tests with coverage (statements 97.87%, branches 95.97%, functions 98.11%, lines 99.5%), production build, budget build, license gate, notices check.
- Bundles (gzip): production public JS 131.63 KB (limit 150), dev-route public JS 133.71 KB, admin JS 163.35 KB (limit 250), CSS 13.54 KB (limit 35). `VerifyCodePage` is its own lazy chunk (3.26 KB gzip). No limit was raised.
- E2E after the preflight: `--grep @auth` 10 passed (5 projects); `--grep @auth-cookies` 6 passed; `--grep "@auth|@testing-host|@smoke"` 22 passed. Full suite (every spec, all seven projects, 30.7 minutes): **582 passed, 0 failed, 31 skipped** (the 31 are the existing per-project skips; the 16 new passes are `@auth` and `@auth-cookies`; the previous full run was 566 passed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zod's code-generation probe raised a CSP violation on S1**
- **Found during:** Task 1 (the first E2E run; plan 04-26 ran no E2E).
- **Issue:** zod 4 probes `new Function('')` for its fast path. The strict CSP has no `unsafe-eval`, so the browser reports `script-src blocked eval` even though the probe is caught, and the E2E guard fails on it.
- **Fix:** `z.config({ jitless: true })` at the top of `authSchemas.ts`, with a test (`z.config().jitless`). It is a global zod setting, so it applies to every later schema once `authSchemas` is loaded; a form outside the admin auth chunks that uses zod must set it too.
- **Commit:** ab32f07

**2. [Rule 1 - Bug] Logout test failed on the sign-in page's 401 refresh (from plan 04-26)**
- **Found during:** Task 1 (repeat runs in WebKit).
- **Issue:** since plan 04-26 the sign-in route checks the refresh cookie first; with no session that answer is a 401 and the guard flags it. `admin-keyboard.spec.ts` "user menu ... Logout" had no declaration for it.
- **Fix:** `guard.expectStatus('/api/v1/auth/refresh', 401)` in that test.
- **Files modified:** web/e2e/admin-keyboard.spec.ts
- **Commit:** ab32f07

**3. [Rule 2/3 - Missing critical, blocking] WebKit reports its own console warning for late module preloads**
- **Found during:** Task 1 (the first `@auth` test failed in WebKit when all five projects ran at once).
- **Issue:** WebKit writes "... was preloaded using link preload but not used within a few seconds from the window's load event" when a lazy route chunk is fetched, via Vite's `modulepreload` link, more than about 3 seconds after the page loaded (typing a password and a code takes that long). The chunk is used; WebKit does not count a module-map hit as a use. The guard failed the test.
- **Fix:** `fixtures.ts` ignores exactly that warning for the app's own `/assets/*.js` chunks (one anchored regex, WebKit's exact wording). Nothing else is ignored. Documented in `docs/web/e2e.md`.
- **Files modified:** web/e2e/fixtures.ts, docs/web/e2e.md
- **Commit:** ab32f07

**4. [Rule 2 - Missing critical] A whole code pasted into a later box must fill all six (A11Y-03 adjacency)**
- **Found during:** Task 2.
- **Issue:** `OtpInput` filled a paste from the focused box, so six digits pasted into box 3 filled only boxes 3 to 6. The plan's behaviour and A11Y-03 say a six-digit code fills all six wherever it lands.
- **Fix:** a code of six digits or more always fills from box 1; shorter pastes still fill from the focused box. Two tests.
- **Files modified:** web/src/components/entry/OtpInput.tsx, OtpInput.test.tsx
- **Commit:** 84d7bf6 (tests in c7458b4)

**5. [Rule 3 - Blocking] The Resend button needed a waiting state without a spinner**
- **Found during:** Task 2.
- **Issue:** `Button` only had `pending` (aria-disabled plus a spinner). The countdown needs `aria-disabled`, focusable, no spinner, no `aria-busy`.
- **Fix:** an `aria-disabled` prop on `Button` that looks and acts the same as pending without the spinner or `aria-busy`. Two tests.
- **Files modified:** web/src/components/actions/Button.tsx, Button.test.tsx
- **Commit:** 84d7bf6

**6. [Rule 3 - Blocking] S1 did not keep the wait for the next code**
- **Found during:** Task 1.
- **Issue:** S2's countdown starts from the 60 seconds S1 received, but `SignInPage` only kept the email.
- **Fix:** `setResendAvailableAt(now + resendAfterSeconds)` on a successful sign-in, with a test.
- **Files modified:** web/src/modules/admin/pages/SignInPage.tsx, SignInPage.test.tsx
- **Commit:** ab32f07

**7. [Rule 3 - Blocking] The tap-area overlay blocks Playwright's `check()`**
- **Found during:** Task 3.
- **Issue:** the 44px `::before` of the checkbox label (OQ-5, plan 04-26) sits over the native box, so `check()` waits forever for the input to "receive events". A real click on the label works.
- **Fix:** `signInAs` clicks the label and asserts the box is checked.
- **Commit:** f11fc8d

### Plan interpretation

- **User chip:** the plan's "user menu shows 'E2E Staff'" cannot hold in the e2e bundle, because its dev previews shadow every guarded `/admin` path (the shell there shows the placeholder Carmen Reyes). The real session is proven by the verify answer naming `E2E Staff` (Manager) and by `/admin/login` redirecting to `/admin` after sign-in and after a reload. When plan 04-29 adds the guarded `/admin/sessions` page, it can also assert the real user chip.
- **Phone projects skip `@auth-cookies`** through `testIgnore` in `playwright.config.ts` (the same way the fixture self-tests and the Testing smoke are scoped), not through `test.skip`.
- **"Resend code in 0:42" assertion** was moved out of the Task 1 E2E (it is Task 2 behaviour) and is covered by the unit tests with fake timers.
- **Verify route loader:** `/admin/login/verify` uses `redirectIfSignedInLoader` like S1 (UI-SPEC: with a live session it redirects to `/admin`), so opening S2 makes the same refresh check and a 401 when there is no session; the E2E tests declare it.
- **Extra files:** `OtpInput.tsx/.test.tsx`, `Button.tsx/.test.tsx`, `SignInPage.tsx/.test.tsx`, `fixtures.ts`, `admin-keyboard.spec.ts`, `playwright.config.ts` were not in the plan's file list; each change is listed above.

## Decisions for the owner

- **WebKit and SameSite in the jar:** Playwright's WebKit on Windows cannot report a cookie's SameSite (it says "None" for every cookie). I asserted Strict from the `Set-Cookie` header for WebKit and from the jar for Chromium and Firefox, and did not skip the test. Real Safari honouring Strict should be confirmed on the Phase 3 staging host over real HTTPS. The WebKit cookie was not refused, so I did not stop at the plan's cookie checkpoint. Say so if you want a macOS WebKit run before Phase 3.
- **WebKit's late-preload warning is ignored in the E2E guard** (one exact message, our own chunks only). The warning also happens for real Safari users after a slow sign-in; it is console-only and harmless. The alternative is turning off Vite's module-preload links for lazy chunks, which would make route changes a little slower. Say so if you prefer that.
- **One polite status, not two:** the "new code sent" note is not a live region, because UI-SPEC lists both the note as live and a single polite status (OQ-6). Two would speak twice. The one status says "We sent a new code. You can ask for another in 60 seconds."
- **Requirements not ticked:** AUTH-02 and AUTH-04 were already complete. AUTH-05 and A11Y-03 are also claimed by plans 04-28 to 04-32 (password screens, devices page, parity), so I left them pending.

## Known Stubs

None. `/admin/login/new-password` (must-change accounts) is built in plan 04-31; until then a must-change sign-in falls through to the public placeholder page. `/admin/sessions` is built in a later plan, as noted in plan 04-25.

## Threat Flags

None beyond the plan's register. T-04-95 is mitigated by the HttpOnly assertions in three engines plus the `document.cookie` check; T-04-96 by the POST-body-only code, the URL and browser-store test and the existing client refusal of secret query params; T-04-97 by `onComplete` not being used (tested, and checked in E2E). No installs.

## Self-Check: PASSED

Created files exist (`VerifyCodePage.tsx`, `VerifyCodePage.test.tsx`, `auth.ts`, `auth.spec.ts`, `auth-cookies.spec.ts`), and commits 881b751, ab32f07, c7458b4, 84d7bf6, 4435d25 and f11fc8d are ancestors of HEAD.
