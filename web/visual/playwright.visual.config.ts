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
  // A parity row loads two pages per case and runs axe on both; WebKit at 1440 px takes about 12 s for one row alone and
  // close to 30 s with the other workers busy, so the default 30 s test timeout is too tight (plan 02-14).
  timeout: 120_000,
  retries: 0,
  // The JSON report is the latest run's result per engine and group; the owner review (scripts/owner-review.mjs, plan
  // 02-36) shows it in plain words. Git-ignored like the rest of test-results/.
  reporter: [['list'], ['json', { outputFile: '../test-results/parity-results.json' }]],
  outputDir: '../test-results/visual',
  // Plan 02-14 writes the reference shot as the "expected" snapshot at run time; nothing is stored in git.
  snapshotPathTemplate: '{testDir}/../test-results/parity/{projectName}/{arg}{ext}',
  // The reference screenshot is written as the expected snapshot by the spec itself; an update run would replace it
  // with the implementation's shot and compare nothing (T-02-39), so nothing is ever updated (the spec checks it too).
  updateSnapshots: 'none',
  // No CSP bypass anywhere: the pages run under the same strict CSP as production.
  // The trace keeps the action log of a failed test, without DOM snapshots or screencast frames: those are recorded for
  // every action even when the test passes, and in WebKit (device scale 2) at 1440 px they made one actions row take
  // 5.3 min instead of 42 s (plan 02-17). For a full trace, add `--trace on` to the run.
  use: { trace: { mode: 'retain-on-failure', snapshots: false, screenshots: false, sources: true } },
  projects: [
    // Chromium raster without partial raster (plan 02-24): with it, a re-raster redraws only the changed part of a tile,
    // and a rounded corner on the viewport's right edge sometimes kept anti-aliasing from an earlier frame, on either
    // side and from run to run (2 to 21 pixels, x 388–389 at 390 px; computed styles, boxes and layers equal). Under
    // the suite's parallel load 3 of 20 reproductions differed; with the flag 25 of 25 were equal. Both sides run in the
    // same browser, so it changes nothing that is compared.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-partial-raster'] } },
    },
    // Firefox and WebKit run every parity scenario at 390 and 1440, rest and hover; the Chromium-only rows of the matrix
    // (320/820, focus-visible, active, the reduced-motion and touch passes; visual/parity-matrix.ts) are skipped here.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@chromium-only/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@chromium-only/ },
  ],
});
