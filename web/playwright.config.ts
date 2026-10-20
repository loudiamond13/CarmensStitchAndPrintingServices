// Playwright E2E config (QUAL-04, A11Y-01, research Pattern 11). Run it through `npm run e2e` (scripts/e2e.mjs), which
// takes the run lock, refuses a busy port 5199, runs the shared-machine preflight, seeds CSPS_E2E and builds the e2e
// bundle first. Guide: docs/web/e2e.md.
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { e2eConnection } from './scripts/e2e.mjs';

// The host serves the e2e bundle straight from web/.e2e-dist (git-ignored). It is never copied into the API's wwwroot,
// so the dev routes in that bundle can never be deployed (D-20).
const e2eDist = fileURLToPath(new URL('./.e2e-dist', import.meta.url));
// In Development the host also loads the build-time static web assets manifest, which always maps
// src/Csps.Server/wwwroot, and that folder's files then win over --webroot. A production build left in wwwroot made the
// host serve it instead of the e2e bundle (plan 02-29). Pointing the manifest setting at a file that does not exist turns
// the loader off for this host only, as the .NET test hosts do (plan 02-01).
const noStaticWebAssets = fileURLToPath(new URL('./.e2e-dist/no-static-web-assets.json', import.meta.url));
const serverProject = fileURLToPath(new URL('../src/Csps.Server', import.meta.url));

// HTTPS is mandatory: the strict CSP ends with upgrade-insecure-requests, and WebKit applies it to http://localhost, so
// the webkit and iphone projects would load a blank page over http (research Pitfall 2, D-30). 5199 is this project's
// Playwright port (CLAUDE.md).
const origin = 'https://localhost:5199';

// The per-address auth limit the E2E host runs with: high enough that no worker count can reach it (plan 04-24).
const noThrottle = '100000';

// The fixture self-tests prove the guards once per engine; the phone projects reuse those engines.
const engineOnly = ['**/fixture-selftest.spec.ts'];

// The Testing host smoke calls API routes only, so one engine proves it (plan 04-10).
const chromiumOnly = ['**/testing-host.spec.ts'];

// The cookie attributes belong to the engine, not the screen size; the phone projects reuse the same engines (plan 04-27).
// The two-tab session proof (Web Locks, BroadcastChannel) is likewise per engine (plan 04-30).
const desktopEnginesOnly = ['**/auth-cookies.spec.ts', '**/auth-multitab.spec.ts'];

// The real-scrollbar dialog tests run only in the two scrollbar projects below (plan 02-42).
const scrollbarSpecs = ['**/dialog-scrollbars.spec.ts'];

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  // No CSP bypass anywhere: the tests run under the same strict CSP as production.
  use: { baseURL: origin, ignoreHTTPSErrors: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: scrollbarSpecs },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: [...chromiumOnly, ...scrollbarSpecs] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: [...chromiumOnly, ...scrollbarSpecs] },
    {
      name: 'pixel',
      use: { ...devices['Pixel 7'] },
      testIgnore: [...engineOnly, ...chromiumOnly, ...desktopEnginesOnly, ...scrollbarSpecs],
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
      testIgnore: [...engineOnly, ...chromiumOnly, ...desktopEnginesOnly, ...scrollbarSpecs],
    },
    // Headless Chromium starts with --hide-scrollbars, so no project above ever presses a real scrollbar. These two show
    // them again: classic scrollbars, which take about 15px of the window as in Chrome on Windows (the owner's setup),
    // and overlay scrollbars, which take no space as on macOS with a trackpad and on ChromeOS. They run only
    // dialog-scrollbars.spec.ts, under the same base URL, HTTPS host and guard as every other project (plan 02-42,
    // review WR-02).
    {
      name: 'chromium-classic-scrollbars',
      use: { ...devices['Desktop Chrome'], launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } },
      testMatch: scrollbarSpecs,
    },
    {
      name: 'chromium-overlay-scrollbars',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--enable-features=OverlayScrollbar'] },
      },
      testMatch: scrollbarSpecs,
    },
  ],
  webServer: {
    // The real ASP.NET Core host. Its working directory is the server project, so the content root (appsettings, logs)
    // is the same as in a normal `dotnet run`.
    command: `dotnet run --project "${serverProject}" --no-launch-profile -- --urls ${origin} --webroot "${e2eDist}" --staticWebAssets "${noStaticWebAssets}"`,
    cwd: serverProject,
    url: `${origin}/health`,
    ignoreHTTPSErrors: true,
    // Never attach to a server someone else started on 5199: a busy port is an error (CLAUDE.md shared machine).
    reuseExistingServer: false,
    timeout: 120_000,
    // Set on the host process only, never at User or Machine level. The Testing environment serves the Testing-only
    // routes (/api/testing/*, QUAL-05) and sends mail to the in-memory sink (D-27). Csps__Testing__LoadUserSecrets makes
    // the host read this developer's user-secrets for the JWT signing key and the Data Protection certificate (D-37);
    // nothing secret is passed or written here (T-02-25).
    // ConnectionStrings__Csps is the LocalDB CSPS_E2E literal unless CSPS_E2E_CONNECTION is set for this run (CI only).
    // The seed step in scripts/e2e.mjs reads the same value.
    env: {
      ASPNETCORE_ENVIRONMENT: 'Testing',
      Csps__Testing__LoadUserSecrets: 'true',
      App__PublicBaseUrl: origin,
      Email__Dispatcher__SweepInterval: '00:00:01',
      ConnectionStrings__Csps: e2eConnection(),
      // Every worker and project signs in from this one address, so the per-address auth limits (D-39) are set very high
      // here, as in the .NET test host. Production keeps the owner's numbers (plan 04-24).
      RateLimits__Auth__SignIn__PermitLimit: noThrottle,
      RateLimits__Auth__Verify__PermitLimit: noThrottle,
      RateLimits__Auth__Resend__PermitLimit: noThrottle,
      RateLimits__Auth__Forgot__PermitLimit: noThrottle,
      RateLimits__Auth__Reset__PermitLimit: noThrottle,
      RateLimits__Auth__Refresh__PermitLimit: noThrottle,
    },
  },
});
