// The look-equality proof (WEB-02, D-33, threat T-02-39). For each case, the approved design (the reference app,
// https://reference.parity.test) and the converted components (the parity page of the dev-route build,
// https://app.parity.test/parity.html) render the same scenario in the same browser, in the same run, under the
// production StrictCsp. The comparison is exact:
//   - computed styles and boxes (visual/compare.ts, after only the allowed normalizations);
//   - pixels: the reference screenshot is written as the expected snapshot at run time, and the implementation must
//     match it with maxDiffPixels 0 and threshold 0, so there are no stored baselines and no rasterization drift;
//   - zero axe findings (AXE_TAGS) and zero guard findings (console, page errors, CSP, failed requests) on both sides.
// Run it with `npm --prefix web run parity -- --grep @parity`. Guide: docs/web/parity.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, TestInfo } from '@playwright/test';
import { expectNoAxeViolations } from '../e2e/fixtures.ts';
import type { Scenario } from '../src/dev/scenarios/types.ts';
import { collectCase, diffCases, formatDifferences, normalizeRecord } from './compare.ts';
import { expect, expectCases, test } from './guard.ts';
import { selectScenarios } from './reference/select.ts';
import { loadScenarios } from './scenarios.ts';
import { REFERENCE_DIST, REFERENCE_ORIGIN, routeDist } from './serve.ts';

/** The implementation side's origin and its build (`vite build --mode e2e --outDir .parity-dist`, run by npm run parity). */
export const APP_ORIGIN = 'https://app.parity.test';
export const PARITY_DIST = fileURLToPath(new URL('../.parity-dist', import.meta.url));

const SCENARIOS = await loadScenarios();

const SHOT = { animations: 'disabled', caret: 'hide' } as const;

// Settles every running animation before a measurement: CSS transitions jump to their end state (a hover or press is
// read as it finally looks), and every other animation (the spinner) is paused at its start, so both sides are read at
// the same frame.
const FREEZE_ANIMATIONS = `(() => {
  for (const animation of document.getAnimations()) {
    if (animation instanceof CSSTransition) {
      animation.finish();
    } else {
      animation.pause();
      animation.currentTime = 0;
    }
  }
})()`;

function caseSelector(id: string): string {
  return `[data-case=${JSON.stringify(id)}]`;
}

/** Loads one side and waits for its cases and fonts; returns how many cases it rendered. */
async function open(page: Page, url: string): Promise<number> {
  const response = await page.goto(url);
  expect(response?.status(), url).toBe(200);
  const count = await expectCases(page);
  expect(await page.evaluate('document.fonts.ready.then(() => document.fonts.status)'), url).toBe('loaded');
  return count;
}

/** Opens both sides with the same query and checks that each rendered exactly the cases the shared list selects. */
async function openBoth(reference: Page, impl: Page, search: string): Promise<void> {
  const expected = selectScenarios(SCENARIOS, search).scenarios.length;
  expect(await open(reference, `${REFERENCE_ORIGIN}/${search}`)).toBe(expected);
  expect(await open(impl, `${APP_ORIGIN}/parity.html${search}`)).toBe(expected);
}

/** Compares one case: computed styles and boxes, then pixels. Records soft failures, so every case is reported. */
async function compareCase(
  reference: Page,
  impl: Page,
  scenario: Scenario,
  shotName: string,
  testInfo: TestInfo,
): Promise<void> {
  const selector = caseSelector(scenario.id);
  await reference.evaluate(FREEZE_ANIMATIONS);
  await impl.evaluate(FREEZE_ANIMATIONS);

  const differences = diffCases(
    normalizeRecord(await collectCase(reference, selector)),
    normalizeRecord(await collectCase(impl, selector)),
  );
  expect.soft(formatDifferences(differences), `${scenario.id}: computed styles and boxes`).toEqual([]);

  const name = `${shotName}.png`;
  const expectedPath = testInfo.snapshotPath(name);
  mkdirSync(path.dirname(expectedPath), { recursive: true });
  writeFileSync(expectedPath, await reference.locator(selector).screenshot(SHOT));
  expect
    .soft(await impl.locator(selector).screenshot(SHOT), `${scenario.id}: pixels`)
    .toMatchSnapshot(name, { maxDiffPixels: 0, threshold: 0 });
}

test.beforeEach(async ({ page, appPage }, testInfo) => {
  // The reference shot is the only expected snapshot; an update run would overwrite it with the implementation's and
  // pass without comparing anything (T-02-39).
  expect(testInfo.config.updateSnapshots, 'Never run the parity suite with --update-snapshots').toBe('none');
  await routeDist(page, { origin: REFERENCE_ORIGIN, distDir: REFERENCE_DIST });
  await routeDist(appPage, { origin: APP_ORIGIN, distDir: PARITY_DIST });
});

test.describe('390px', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('@parity @actions button-primary-md light 390px rest', async ({ page, appPage }, testInfo) => {
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'button-primary-md');
    expect(scenario, 'the button-primary-md scenario').toBeDefined();
    if (scenario === undefined) {
      return;
    }
    await openBoth(page, appPage, '?case=button-primary-md&theme=light');
    await compareCase(page, appPage, scenario, 'button-primary-md-light-390-rest', testInfo);
    await expectNoAxeViolations(page);
    await expectNoAxeViolations(appPage);
  });
});
