// Playwright E2E config (QUAL-04, A11Y-01, research Pattern 11). Run it through `npm run e2e` (scripts/e2e.mjs), which
// runs the shared-machine preflight, refuses a busy port 5199, migrates CSPS_E2E and builds the e2e bundle first.
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The host serves the e2e bundle straight from web/.e2e-dist (assumption A2). It is never copied into the API's
// wwwroot, so the dev routes in that bundle can never be deployed.
const e2eDist = fileURLToPath(new URL('./.e2e-dist', import.meta.url));
const serverProject = fileURLToPath(new URL('../src/Csps.Server', import.meta.url));

// HTTPS is mandatory: the strict CSP ends with upgrade-insecure-requests, and WebKit applies it to http://localhost, so
// WebKit and the iPhone project would load a blank page over http (research Pitfall 2, D-30). 5199 is this project's
// Playwright port (CLAUDE.md).
const origin = 'https://localhost:5199';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  // No CSP bypass anywhere: the tests run under the same strict CSP as production.
  use: { baseURL: origin, ignoreHTTPSErrors: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    // The real ASP.NET Core host. Its working directory is the server project, so the content root (appsettings,
    // logs) is the same as in a normal `dotnet run`.
    command: `dotnet run --project "${serverProject}" --no-launch-profile -- --urls ${origin} --webroot "${e2eDist}"`,
    cwd: serverProject,
    url: `${origin}/health`,
    ignoreHTTPSErrors: true,
    // Never attach to a server someone else started on 5199: a busy port is an error (CLAUDE.md shared machine).
    reuseExistingServer: false,
    timeout: 120_000,
    // Set on the host process only, never at User or Machine level. Development loads the JWT signing key and the
    // Data Protection certificate from this developer's user-secrets (D-30); no secret is passed here.
    env: {
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__Csps: 'Server=(localdb)\\CSPS;Database=CSPS_E2E;Integrated Security=true',
    },
  },
});
