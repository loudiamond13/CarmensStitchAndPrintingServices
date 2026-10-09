// The look-equality proof (WEB-02, D-33, threat T-02-39). For each case, the approved design (the reference app,
// https://reference.parity.test) and the converted components (the parity page of the dev-route build,
// https://app.parity.test/parity.html) render the same scenario in the same browser, in the same run, under the
// production StrictCsp. The comparison is exact:
//   - computed styles and boxes (visual/compare.ts, after only the allowed normalizations; tag exceptions only from
//     visual/intentional-differences.ts, each with a decision ID);
//   - pixels: the reference screenshot is written as the expected snapshot at run time, and the implementation must
//     match it with maxDiffPixels 0 (unless the registry holds an owner-approved override) and threshold 0, so there are
//     no stored baselines and no rasterization drift; icon drawings are masked on both sides (D-32);
//   - zero axe findings (AXE_TAGS) and zero guard findings (console, page errors, CSP, failed requests) on both sides.
// The matrix (engines, widths, themes, states, passes) is visual/parity-matrix.ts; every row is one test. The
// @selftest case proves that a 1px drift fails, so the suite can never pass vacuously.
// Run it with `npm --prefix web run parity -- --grep @parity`. Guide: docs/web/parity.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expectNoAxeViolations } from '../e2e/fixtures.ts';
import type { Scenario, ScenarioState } from '../src/dev/scenarios/types.ts';
import { collectCase, diffCases, formatDifferences, normalizeRecord } from './compare.ts';
import { expect, expectCases, screenshotLocator, screenshotPage, test } from './guard.ts';
import {
  assertRegistry,
  elementExceptionsFor,
  maskedIconViewBox,
  maxDiffPixelsFor,
} from './intentional-differences.ts';
import { planMatrix, rowTimeout, type MatrixRow } from './parity-matrix.ts';
import { selectScenarios } from './reference/select.ts';
import { loadScenarios } from './scenarios.ts';
import { REFERENCE_DIST, REFERENCE_ORIGIN, routeDist } from './serve.ts';

/** The implementation side's origin and its build (`vite build --mode e2e --outDir .parity-dist`, run by npm run parity). */
export const APP_ORIGIN = 'https://app.parity.test';
export const PARITY_DIST = fileURLToPath(new URL('../.parity-dist', import.meta.url));

/** Viewport height of every row; the width comes from the row. */
const VIEWPORT_HEIGHT = 900;
/** Upper bound of Tab presses to reach a focus-visible target from a fresh page. */
const MAX_TABS = 40;

assertRegistry();
const SCENARIOS = await loadScenarios();
const ICON_VIEWBOX = maskedIconViewBox();

// `caret: 'initial'`: Playwright's caret hiding injects a <style> element, which the strict CSP blocks in WebKit and which
// would then not apply. FREEZE hides the caret of a focused field through the CSSOM instead (allowed by the CSP).
const SHOT = { animations: 'disabled', caret: 'initial' } as const;

// Settles the page before a measurement: CSS transitions and finite animations (the toast and modal entries) jump to
// their end state, so a hover or press, and an element that rises in, is read as it finally looks; infinite animations
// (the spinner, the skeleton shimmer) are paused at their start, so both sides are read at the same frame; and a
// focused field's caret is made transparent through the CSSOM (allowed by the CSP), so its blink cannot differ.
// Plan 02-21: an entry animation still running at FREEZE used to be paused at its start (opacity 0) on one side only,
// depending on how long that side's state input took, while the other side had already finished it.
const FREEZE = `(() => {
  for (const animation of document.getAnimations()) {
    const finite = Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity);
    if (animation instanceof CSSTransition || finite) {
      animation.finish();
    } else {
      animation.pause();
      animation.currentTime = 0;
    }
  }
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    active.style.setProperty('caret-color', 'transparent');
  }
})()`;

// Repaints the whole page after FREEZE, so the shot never mixes old and new raster (plan 02-17). A state change repaints
// only the changed area, and Chromium then sometimes kept anti-aliasing from the earlier frame at a clipped edge (a
// focus ring or a pressed button at the frame's right edge): the reference differed from itself by up to 16 pixels
// between runs, with the same computed styles and boxes. Toggling the root's opacity through the CSSOM (allowed by the
// CSP) re-rasters everything for two frames each way. Unlike visibility, it keeps :hover, :active and :focus-visible,
// and it changes no value the comparison reads; nothing is normalized or tolerated.
const REPAINT = `(async () => {
  const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const style = document.documentElement.style;
  style.setProperty('opacity', '0.99');
  await frames();
  style.removeProperty('opacity');
  await frames();
})()`;

function caseSelector(id: string): string {
  return `[data-case=${JSON.stringify(id)}]`;
}

/** The element a state is driven on: the scenario's `target` inside the case, else the case's first element. */
function targetSelector(scenario: Scenario): string {
  return scenario.target === undefined
    ? `${caseSelector(scenario.id)} > *`
    : `${caseSelector(scenario.id)} ${scenario.target}`;
}

function query(parameters: Readonly<Record<string, string>>): string {
  return `?${new URLSearchParams(parameters).toString()}`;
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
  expect(await open(reference, `${REFERENCE_ORIGIN}/${search}`), 'reference cases').toBe(expected);
  expect(await open(impl, `${APP_ORIGIN}/parity.html${search}`), 'implementation cases').toBe(expected);
}

async function axeBoth(reference: Page, impl: Page): Promise<void> {
  await expectNoAxeViolations(reference);
  await expectNoAxeViolations(impl);
}

/** Drives one interaction state with real input: the mouse for hover and active, the Tab key for focus-visible. */
async function applyState(page: Page, scenario: Scenario, state: ScenarioState): Promise<void> {
  const selector = targetSelector(scenario);
  const target = page.locator(selector).first();
  switch (state) {
    case 'rest':
      return;
    case 'hover':
      await target.hover();
      return;
    case 'active':
      await target.hover();
      await page.mouse.down();
      return;
    case 'focus-visible':
      for (let presses = 0; presses < MAX_TABS; presses += 1) {
        await page.keyboard.press('Tab');
        if (
          await page.evaluate<boolean>(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`)
        ) {
          return;
        }
      }
      throw new Error(`Tab never reached ${selector} in ${String(MAX_TABS)} presses.`);
  }
}

/** The icon drawings to mask in a screenshot of `scope` (D-32). */
function iconMasks(scope: Locator): Locator[] {
  return ICON_VIEWBOX === null ? [] : [scope.locator(`svg[viewBox=${JSON.stringify(ICON_VIEWBOX)}]`)];
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
  await reference.evaluate(FREEZE);
  await impl.evaluate(FREEZE);
  await reference.evaluate(REPAINT);
  await impl.evaluate(REPAINT);

  const differences = diffCases(
    normalizeRecord(await collectCase(reference, selector, { iconViewBox: ICON_VIEWBOX })),
    normalizeRecord(await collectCase(impl, selector, { iconViewBox: ICON_VIEWBOX })),
    elementExceptionsFor(scenario.id),
  );
  expect.soft(formatDifferences(differences), `${scenario.id}: computed styles and boxes`).toEqual([]);

  // A viewport-frame case (a fixed overlay) is compared as the whole viewport; a block case as its frame.
  const viewport = scenario.frame === 'viewport';
  const referenceFrame = reference.locator(selector);
  const implFrame = impl.locator(selector);
  const name = `${shotName}.png`;
  const expectedPath = testInfo.snapshotPath(name);
  mkdirSync(path.dirname(expectedPath), { recursive: true });
  writeFileSync(
    expectedPath,
    viewport
      ? await screenshotPage(reference, { ...SHOT, mask: iconMasks(reference.locator('body')) })
      : await screenshotLocator(referenceFrame, { ...SHOT, mask: iconMasks(referenceFrame) }),
  );
  const actual = viewport
    ? await screenshotPage(impl, { ...SHOT, mask: iconMasks(impl.locator('body')) })
    : await screenshotLocator(implFrame, { ...SHOT, mask: iconMasks(implFrame) });
  expect
    .soft(actual, `${scenario.id}: pixels`)
    .toMatchSnapshot(name, { maxDiffPixels: maxDiffPixelsFor(scenario.id), threshold: 0 });
}

/** Rest rows: one page load per group for block cases, one per case for viewport frames; parity cases compared. */
async function runRestRow(row: MatrixRow, reference: Page, impl: Page, testInfo: TestInfo): Promise<void> {
  const block = row.cases.filter((scenario) => scenario.frame !== 'viewport');
  if (block.length > 0) {
    await openBoth(reference, impl, query({ group: row.group, theme: row.theme }));
    for (const scenario of block.filter((candidate) => candidate.parity)) {
      // Scroll the case into view on both sides before FREEZE and REPAINT (plan 02-24). The screenshot used to do the
      // scrolling after the repaint, and the newly exposed raster then sometimes kept different anti-aliasing at a
      // rounded corner on the viewport's right edge (x 388–389 at 390 px), on either side and run to run: 4 of 5
      // reproductions of the data group differed by 2 to 21 pixels, with identical computed styles, boxes and layers;
      // scrolled first, 8 of 8 were equal. It changes no value the comparison reads.
      await reference.locator(caseSelector(scenario.id)).scrollIntoViewIfNeeded();
      await impl.locator(caseSelector(scenario.id)).scrollIntoViewIfNeeded();
      await compareCase(reference, impl, scenario, `${scenario.id}-${row.slug}`, testInfo);
    }
    await axeBoth(reference, impl);
  }
  for (const scenario of row.cases.filter((candidate) => candidate.frame === 'viewport')) {
    await openBoth(reference, impl, query({ case: scenario.id, theme: row.theme }));
    if (scenario.parity) {
      await compareCase(reference, impl, scenario, `${scenario.id}-${row.slug}`, testInfo);
    }
    await axeBoth(reference, impl);
  }
}

/** State rows: one fresh page load per case, the state driven on both sides, then compared and checked by axe. */
async function runStateRow(row: MatrixRow, reference: Page, impl: Page, testInfo: TestInfo): Promise<void> {
  for (const scenario of row.cases) {
    await openBoth(reference, impl, query({ case: scenario.id, theme: row.theme }));
    await applyState(reference, scenario, row.state);
    await applyState(impl, scenario, row.state);
    await compareCase(reference, impl, scenario, `${scenario.id}-${row.slug}`, testInfo);
    await axeBoth(reference, impl);
    if (row.state === 'active') {
      await reference.mouse.up();
      await impl.mouse.up();
    }
  }
}

test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page, appPage }, testInfo) => {
  // The reference shot is the only expected snapshot; an update run would overwrite it with the implementation's and
  // pass without comparing anything (T-02-39).
  expect(testInfo.config.updateSnapshots, 'Never run the parity suite with --update-snapshots').toBe('none');
  await routeDist(page, { origin: REFERENCE_ORIGIN, distDir: REFERENCE_DIST });
  await routeDist(appPage, { origin: APP_ORIGIN, distDir: PARITY_DIST });
});

for (const row of planMatrix(SCENARIOS)) {
  test.describe(() => {
    test.use({
      viewport: { width: row.width, height: VIEWPORT_HEIGHT },
      ...(row.pass === 'motion' ? { reducedMotion: 'reduce' as const } : {}),
      // `(hover: none)` holds only for a touch-only mobile device in Chromium (D-05).
      ...(row.pass === 'touch' ? { hasTouch: true, isMobile: true } : {}),
    });

    test(row.title, async ({ page, appPage }, testInfo) => {
      test.setTimeout(rowTimeout(row));
      if (row.state === 'rest') {
        await runRestRow(row, page, appPage, testInfo);
      } else {
        await runStateRow(row, page, appPage, testInfo);
      }
    });
  });
}

test.describe(() => {
  test.use({ viewport: { width: 390, height: VIEWPORT_HEIGHT } });

  test('@parity @selftest a 1px padding change on the implementation is reported as a style and a pixel difference', async ({
    page,
    appPage,
  }, testInfo) => {
    const id = 'button-primary-md';
    const selector = caseSelector(id);
    await openBoth(page, appPage, query({ case: id, theme: 'light' }));
    // A deliberate drift, written through the CSSOM (allowed by the CSP, unlike a style attribute): the button's
    // padding-top grows by 1px on the implementation side only.
    await appPage.evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(`${selector} > *`)});
      const current = Number.parseFloat(getComputedStyle(button).paddingTop);
      button.style.setProperty('padding-top', String(current + 1) + 'px');
    })()`);
    await page.evaluate(FREEZE);
    await appPage.evaluate(FREEZE);

    const differences = diffCases(
      normalizeRecord(await collectCase(page, selector)),
      normalizeRecord(await collectCase(appPage, selector)),
    );
    expect(differences.length, 'the comparator reports the drift').toBeGreaterThan(0);
    expect(differences).toContainEqual(
      expect.objectContaining({ kind: 'style', property: 'padding-top', reference: '0px', impl: '1px' }),
    );

    const name = 'selftest-button-primary-md.png';
    const expectedPath = testInfo.snapshotPath(name);
    mkdirSync(path.dirname(expectedPath), { recursive: true });
    writeFileSync(expectedPath, await screenshotLocator(page.locator(selector), SHOT));
    const drifted = await screenshotLocator(appPage.locator(selector), SHOT);
    expect(() => {
      expect(drifted).toMatchSnapshot(name, { maxDiffPixels: 0, threshold: 0 });
    }, 'the pixel comparison rejects the drift').toThrow(/different/);
  });
});
