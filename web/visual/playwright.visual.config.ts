// Playwright config for the look-equality proof (WEB-02, D-33). Run it through `npm run parity` (scripts/parity.mjs),
// which takes the parity run lock, runs the shared-machine preflight, extracts the pinned spec appendices and builds the
// reference first. Guide: docs/web/parity.md.
//
// There is no webServer: every page is served by page.route from its dist folder on an https origin with the real
// StrictCsp (visual/serve.ts), so the suite opens no port and needs no API host or database.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: '../test-results/visual',
  // Plan 02-14 writes the reference shot as the "expected" snapshot at run time; nothing is stored in git.
  snapshotPathTemplate: '{testDir}/../test-results/parity/{projectName}/{arg}{ext}',
  // The reference screenshot is written as the expected snapshot by the spec itself; an update run would replace it
  // with the implementation's shot and compare nothing (T-02-39), so nothing is ever updated (the spec checks it too).
  updateSnapshots: 'none',
  // No CSP bypass anywhere: the pages run under the same strict CSP as production.
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
