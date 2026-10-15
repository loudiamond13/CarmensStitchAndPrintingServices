# End-to-end tests: the Playwright host on HTTPS 5199

*Created: 2026-10-08T12:05:27-05:00 · Updated: 2026-10-15T02:50:00-05:00*

This page explains how to run the browser tests in `web/e2e/` (requirements QUAL-04 and A11Y-01). They drive the **real** API host, serving the real e2e build, in three browser engines and two phone profiles. Every test fails on console noise, Content-Security-Policy violations, unexpected failed responses and accessibility (axe) findings.

> **This machine is shared** with another project (TheBETSLLC). Read [Shared-machine rules](../development.md#shared-machine-rules) first. The E2E host uses only port **5199**, and the runner **never** stops another process.

## 1. Prerequisites (once per machine)

| What | How to check | How to fix |
|---|---|---|
| The ASP.NET Core HTTPS development certificate is trusted | `dotnet dev-certs https --check --trust` exits 0 | `dotnet dev-certs https --trust` |
| User-secrets hold the JWT signing key and the dev Data Protection certificate | `dotnet user-secrets list --project src/Csps.Server` lists `Jwt:SigningKey` and `DataProtection:*` (don't paste the values anywhere) | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1` |
| The default LocalDB instance `(localdb)\MSSQLLocalDB` can start | `sqllocaldb info MSSQLLocalDB` | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1` (see [First-time setup](../development.md#first-time-setup)) |
| `web/node_modules` is installed | the folder exists | `npm --prefix web ci` (installs exactly the committed lockfile) |
| The Playwright browsers for the pinned Playwright version | `npx --prefix web playwright install --list` | `npx --prefix web playwright install chromium firefox webkit` (a download only, not a package change) |

The tests use the `CSPS_E2E` database only. It is created, migrated and seeded through the guarded dev-seed tool, which refuses every database except `CSPS_Dev` and `CSPS_E2E` on `(localdb)\MSSQLLocalDB`.

## 2. Run the preflight, then the tests

Before every run, check that the ports are free and the other project isn't running its tests:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
```

If a port is in use by another project, or TheBETSLLC's test processes are listed, **wait** and try again later. Never stop another project's process.

Then run the suite, or one tag of it:

```powershell
npm --prefix web run e2e                                  # everything
npm --prefix web run e2e -- --grep @smoke                 # one tag
npm --prefix web run e2e -- --grep "@smoke|@fixture"      # several tags
npm --prefix web run e2e -- --grep @smoke --project webkit
npm --prefix web run e2e -- --grep @dialog-fit --project chromium-overlay-scrollbars
```

Everything after `--` goes straight to `playwright test`. Always start through `npm run e2e`; don't call `playwright test` directly, because the runner does the safety steps below first.

## 3. What `npm run e2e` does (web/scripts/e2e.mjs)

1. **Takes the run lock** `web/.locks/e2e.lock`. The file is created exclusively, so only one E2E, parity or Lighthouse run (they all start the same host) can hold it. A second run waits for it, up to 15 minutes, then exits 1 and asks you to wait and run again. The lock is removed when the run ends, including after Ctrl+C or a closed terminal (SIGHUP). A lock left behind by a run that was killed (Task Manager, `taskkill /F`, a power loss) is taken over at once when its process is no longer running (checked read-only with `tasklist`/`ps`), or when it is older than 3 hours (TOOL-WR-09). Never delete a lock that another run holds; the timeout message names the file to delete only when no run is going on.
2. **Waits for the shared machine.** Runs the shared-machine wait (`web/scripts/shared-machine.mjs`): it runs the preflight report and waits, up to 15 minutes, while one of this project's ports is in use by another program or TheBETSLLC's dev/test processes are listed, then exits 1. It never stops anything. Without the preflight script (CI) it says so and goes on.
3. **Refuses a busy port.** If anything answers on port 5199, it prints "Port 5199 is in use by another process. Wait for it to finish; this script never stops other processes." and exits 1. It never kills, stops or reuses that process.
4. **Seeds `CSPS_E2E`:** `dotnet run --project tools/Csps.DevSeed -- --database CSPS_E2E` (idempotent).
5. **Builds the e2e bundle** into `web/.e2e-dist` (`vite build --mode e2e`). That folder is git-ignored and is never copied into the API's `wwwroot`, so its dev-only routes can't be deployed.
6. **Runs Playwright.** `web/playwright.config.ts` starts the real API host with `dotnet run --project src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot <web/.e2e-dist> --staticWebAssets <a file that does not exist>`, waits for `https://localhost:5199/health`, runs the tests, then stops the host it started. The `--staticWebAssets` argument turns off the Development static web assets loader for this host: that loader always maps `src/Csps.Server/wwwroot`, and a production build left there would otherwise be served instead of the e2e bundle (plan 02-29).

Details that matter on this machine:

- **Environment variables** for the host (`ASPNETCORE_ENVIRONMENT=Testing`, `Csps__Testing__LoadUserSecrets=true`, `App__PublicBaseUrl`, a 1-second email dispatcher sweep and the `CSPS_E2E` connection string) are set on that one child process only. Nothing is set at User or Machine level, and no secret is passed or written anywhere: the host reads the JWT key and the Data Protection certificate from your user-secrets because of `Csps__Testing__LoadUserSecrets`. Environment variables and the command line still win over user-secrets. See [the Testing environment](#8-the-testing-environment-and-its-helpers).
- **`reuseExistingServer: false`:** Playwright never attaches to a server someone else started on 5199. A busy port is an error.
- Node tools run on the current Node binary with their JS entry (`node_modules/vite/bin/vite.js`, `node_modules/@playwright/test/cli.js`), because Windows can't start the `.cmd` shims without a shell.
- MSBuild worker processes can linger for a few minutes after `dotnet run`. They are not servers; leave them alone.

## 4. Why HTTPS

The app's strict CSP ends with `upgrade-insecure-requests`. WebKit applies that to `http://localhost` too, so the webkit and iphone projects would load a blank page over plain http (research Pitfall 2, decision D-30). The host therefore runs on `https://localhost:5199` with the development certificate, and the tests set `ignoreHTTPSErrors`. No test turns the CSP off.

## 5. Projects

| Project | Device |
|---|---|
| `chromium` | Desktop Chrome |
| `firefox` | Desktop Firefox |
| `webkit` | Desktop Safari |
| `pixel` | Pixel 7 (Chromium) |
| `iphone` | iPhone 15 (WebKit) |
| `chromium-classic-scrollbars` | Desktop Chrome with its scrollbars shown, classic: they take about 15px, as Chrome on Windows |
| `chromium-overlay-scrollbars` | Desktop Chrome with overlay scrollbars, which take no layout space, as macOS with a trackpad and ChromeOS |

The fixture self-tests (`fixture-selftest.spec.ts`) run on the three desktop engines only, because the phone projects use the same engines. Headless Chromium hides scrollbars, so the two scrollbar projects turn them back on, and they run only `dialog-scrollbars.spec.ts` (plan 02-42).

## 6. Writing a test

Import `test`, `expect` and `expectNoAxeViolations` from `./fixtures.ts`, never from `@playwright/test`:

```ts
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test('@smoke the home page loads clean', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoAxeViolations(page);
});
```

The guard is automatic. After every test it fails the test when it recorded any of these:

- a console message of type `error` or `warning`;
- an uncaught page error;
- a CSP violation (reported through a Playwright binding, so it is kept even after the page navigates);
- a same-origin response with status 400 or higher.

If a test expects a failed response on purpose, declare it before it happens: `guard.expectStatus('/api/v1/orders/missing', 404)`. That covers both the response and the browser's own "Failed to load resource" console line for it (Chromium and WebKit write one; Firefox doesn't). Anything else still fails. A same-origin request that gets no response at all (reset, refused) is a finding too, because it never reaches the response check and Firefox logs nothing for it; declare an expected one with `guard.expectFailure('/api/v1/x')`. A cancelled request (a navigation or an AbortController) is not a failure. Every page of the test's browser context is guarded, including `context.newPage()` pages and popups (TOOL-WR-14).

`expectNoAxeViolations(page)` runs axe over the whole page with the same WCAG 2.0/2.1/2.2 A and AA tags as the component tests (`web/src/test/axeTags.ts`). Unlike the jsdom tests, the colour-contrast rule is on here.

## 7. Tags

Put the tag at the start of the test title so `--grep` can select it.

| Tag | What it covers | Added by |
|---|---|---|
| `@smoke` | The home page loads clean in all five projects | plan 02-09 |
| `@fixture` | Self-tests that prove each guard fires: a console error, a CSP violation (an injected `<style>` element), an unlabelled image (axe `image-alt`), and an undeclared 404 | plan 02-09 |
| `@public`, `@admin`, `@showcase` | The public frame, the admin shell and the Component Showcase, with page-level axe | plans 02-29, 02-31, 02-34 |
| `@keyboard` | Keyboard-only paths and focus order: skip link, Tabs, SegmentedControl, dialog traps, toast Dismiss, the phone drawer and the user menu | plans 02-32, 02-35 |
| `@responsive` | 320 to 1920 px in portrait and landscape: no horizontal scroll, one h1, the skip link, labelled landmarks, axe, 16px phone inputs | plan 02-35 |
| `@fonts` | One font preload, same-origin woff2 only, ₱ drawn in Archivo Variable | plan 02-35 |
| `@a11y-rulings` | The owner's accessibility rulings on computed styles (D-02, D-03, D-05, D-BL-02, O-3, O-6) | plan 02-35 |
| `@testing-host` | The Testing environment on the E2E host: `createStaff` makes a staff user under `csps.test` and `readEmails` returns an empty mailbox for it (Chromium only) | plan 04-10 |
| `@auth` | Sign-in end to end in all five projects: S1, the emailed code read from the sink, S2 (`Check your email`), the admin shell and a reload that keeps the session through the refresh cookie; page-level axe on S1 and S2; the six boxes never submit by themselves | plan 04-27 |
| `@auth-cookies` | The refresh cookie `__Secure-csps_rt` in chromium, firefox and webkit (the phone projects skip it), with and without "Keep me signed in": the Set-Cookie header the server sent and the cookie jar both show HttpOnly, Secure, Path `/api/v1/auth`; SameSite Strict in the header everywhere and in the jar for chromium and firefox; about 90 days with the box ticked, a session cookie without it; `document.cookie` cannot see it; the ticket cookie is gone; a visit to `/admin/login` goes on to `/admin` because the cookie still holds the session | plan 04-27 |
| `@dialog-fit` | Dialogs on short windows: the Delete Order dialog at 1440x900 (140px down), 1274x585 (fits, gap shrinks), 1280x420 (16px down, the backdrop scrolls by wheel and keyboard) and on phone pages / devices (96px down to 0, scrolls); the backdrop close rule: a drag or a press on the backdrop's scrollbar (classic and overlay, in the two scrollbar projects) and a middle or right press never close the dialog, and a left click on the dark area still does (all seven projects); from a scrolled backdrop (1280x420) a middle or right press and a press or drag on the backdrop's scrollbar keep the caret in the confirm field and the backdrop's scrollTop unchanged (Firefox's own middle-button scroll is the one documented exception), and on the phone screens a right press above the sheet keeps the caret (the focus trap returns focus without scrolling) | plans 02-41, 02-42, 02-43 (D-42) |

Every gate, its command and its pass rule, and the order to run them before verification: [release-gates.md](release-gates.md).

## 8. The Testing environment and its helpers

The E2E host runs in the **Testing** environment of a **Debug** build, the same environment the .NET integration tests use. That gives E2E tests two things they need, because every sign-in ends with an emailed code (plan 04-10, QUAL-05):

- `GET /api/testing/emails?after=<id>&to=<address>` returns the mail the app delivered to the in-memory sink as `[{ id, to, subject, text, html, sentAt }]`, oldest first. **E2E never sends real mail** (D-27): in Testing every email goes to the sink, and nothing is sent over SMTP.
- `POST /api/testing/staff` with `{ "role": "Admin" | "Manager", "state"?: "active" | "deactivated" }` creates a fresh staff user (`e2e-<guid>@csps.test`, a random 16-character password that meets the password rule) and returns `{ userId, email, password }`. Every test makes its own user, so one test's resend cooldown, caps and lockouts never reach another.

Both routes are compiled into Debug builds only (`CSPS_TESTING`), mapped only in the Testing environment, and a Release build is proven to contain none of it (`ReleaseHasNoEmailSinkTests`). A Debug build refuses to start as Production.

Use the helpers in `web/e2e/testing-api.ts` (they take the Playwright `request` fixture):

```ts
import { expect, test } from './fixtures.ts';
import { createStaff, latestEmail, readEmails } from './testing-api.ts';

test('@example a staff user gets a code by email', async ({ request }) => {
  const staff = await createStaff(request, 'Manager'); // { userId, email, password }
  // ... trigger a sign-in for staff.email ...
  const mail = await latestEmail(request, staff.email, { subject: 'sign-in code' }); // waits up to 15 s
  expect(mail.text).toMatch(/\b\d{6}\b/);
  expect(await readEmails(request, { to: staff.email, after: mail.id })).toEqual([]);
});
```

`createStaff(request, role, state?)`, `readEmails(request, { to?, after? })` and `latestEmail(request, to, { subject? })` are the whole API.

`web/e2e/auth.ts` builds on them for the sign-in flow (plan 04-27):

- `codeFromEmail(email)` reads the six digits from the subject of a sign-in code email (`123456 is your CSPS sign-in code`).
- `signInAs(page, request, staff, { keepSignedIn? })` opens `/admin/login`, types the email and password, ticks "Keep me signed in" when asked, reads the code from the sink, types it into the six boxes, presses Verify Code and resolves with the user the server named once the admin shell shows.
- `typeCode(page, code)` types a code into the six boxes from the first one.

Every auth spec makes its own staff user with `createStaff` and calls `guard.expectStatus('/api/v1/auth/refresh', 401)` for a page that opens without a session: the sign-in routes ask the refresh cookie for a session first, and with none that answer is a 401. The e2e bundle has the dev-only admin previews, which shadow the guarded `/admin`, `/admin/orders` and so on, so the shell there shows the placeholder user; the server's own answer (the verify response) and the redirect from `/admin/login` back to `/admin` are what prove the real session in E2E. `testing-host.spec.ts` (`@testing-host`, Chromium only) proves the host is in the Testing environment.

User-secrets load in the Testing environment only when `Csps:Testing:LoadUserSecrets` is true. Only the Playwright `webServer.env` sets it; the .NET test factory never does, so a developer's secrets cannot change an integration test.

### Cookie attributes and the WebKit jar (plan 04-27)

`@auth-cookies` reads each cookie two ways: the `Set-Cookie` header on the verify answer (what the server sent) and the browser's cookie jar (what the engine stored). Playwright's WebKit on Windows reports `sameSite: "None"` for every cookie in its jar, even one added with `sameSite: "Strict"`, so the jar's SameSite is asserted in chromium and firefox only; WebKit's SameSite rests on the header. Real Safari honouring Strict over HTTPS is checked in Phase 3 on the staging host. The same engines run the phone projects, so `@auth-cookies` skips `pixel` and `iphone`.

### WebKit and late module preloads

WebKit writes a console warning ("... was preloaded using link preload but not used within a few seconds from the window's load event") when a route's lazy chunk is fetched, through a Vite `modulepreload` link, more than about 3 seconds after the page loaded. The chunk is used, but WebKit does not count a module-map hit as a use. Typing a password and a code takes that long, so the guard in `fixtures.ts` ignores exactly this warning for the app's own `/assets/*.js` chunks. Nothing else is ignored.

## 9. Reports

The list reporter prints to the terminal. The HTML report goes to `web/playwright-report/` and failure traces to `web/test-results/`; both are git-ignored. Open the report with `npx --prefix web playwright show-report web/playwright-report`.
