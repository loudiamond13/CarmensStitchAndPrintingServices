# End-to-end tests: the Playwright host on HTTPS 5199

*Created: 2026-10-08T12:05:27-05:00 · Updated: 2026-10-13T10:20:00-05:00*

This page explains how to run the browser tests in `web/e2e/` (requirements QUAL-04 and A11Y-01). They drive the **real** API host, serving the real e2e build, in three browser engines and two phone profiles. Every test fails on console noise, Content-Security-Policy violations, unexpected failed responses and accessibility (axe) findings.

> **This machine is shared** with another project (TheBETSLLC). Read [Shared-machine rules](../development.md#shared-machine-rules) first. The E2E host uses only port **5199**, and the runner **never** stops another process.

## 1. Prerequisites (once per machine)

| What | How to check | How to fix |
|---|---|---|
| The ASP.NET Core HTTPS development certificate is trusted | `dotnet dev-certs https --check --trust` exits 0 | `dotnet dev-certs https --trust` |
| User-secrets hold the JWT signing key and the dev Data Protection certificate | `dotnet user-secrets list --project src/Csps.Server` lists `Jwt:SigningKey` and `DataProtection:*` (don't paste the values anywhere) | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1` |
| The dedicated LocalDB instance `(localdb)\CSPS` exists | `sqllocaldb info CSPS` | `sqllocaldb create CSPS` (see [First-time setup](../development.md#first-time-setup)) |
| `web/node_modules` is installed | the folder exists | `npm --prefix web ci` (installs exactly the committed lockfile) |
| The Playwright browsers for the pinned Playwright version | `npx --prefix web playwright install --list` | `npx --prefix web playwright install chromium firefox webkit` (a download only, not a package change) |

The tests use the `CSPS_E2E` database only. It is created, migrated and seeded through the guarded dev-seed tool, which refuses every database except `CSPS_Dev` and `CSPS_E2E` on `(localdb)\CSPS`.

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

- **Environment variables** for the host (`ASPNETCORE_ENVIRONMENT=Development` and the `CSPS_E2E` connection string) are set on that one child process only. Nothing is set at User or Machine level, and no secret is passed or written anywhere: Development reads the JWT key and the Data Protection certificate from your user-secrets.
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

The fixture self-tests (`fixture-selftest.spec.ts`) run on the three desktop engines only, because the phone projects use the same engines.

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

Every gate, its command and its pass rule, and the order to run them before verification: [release-gates.md](release-gates.md).

## 8. Reports

The list reporter prints to the terminal. The HTML report goes to `web/playwright-report/` and failure traces to `web/test-results/`; both are git-ignored. Open the report with `npx --prefix web playwright show-report web/playwright-report`.
