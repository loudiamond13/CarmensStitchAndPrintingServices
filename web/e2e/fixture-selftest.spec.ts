// Fixture self-tests (QUAL-04, A11Y-01): each E2E guard must catch its own class of failure in every engine (chromium,
// firefox, webkit; the phone projects skip this file in playwright.config.ts). Each test provokes exactly one finding on
// the real home page, inspects it through the guard, proves the guard's end-of-test check would fail on it, and then
// takes (clears) the record, so the auto check passes. One more test proves the axe check stays fast on a large page, and
// two prove the D-71 re-check: a target only a sticky bar partly covers passes once scrolled clear, one still covered fails.
// Nothing here uses test.fail(), which could hide a real failure.
// Page scripts are strings: the e2e TypeScript program has no DOM types, and Playwright evaluates them outside the CSP.
import { assertNoFindings, expect, expectNoAxeViolations, listFindings, pageAxe, test } from './fixtures.ts';

const DELIBERATE = 'e2e fixture: deliberate console error';

// Resolves true once the browser reports the blocked <style> element (false after 5 s, so a missing report fails the
// assertion instead of hanging the test).
const INSERT_STYLE = `new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), 5000);
  document.addEventListener('securitypolicyviolation', () => { clearTimeout(timer); resolve(true); }, { once: true });
  const style = document.createElement('style');
  style.textContent = 'main { outline: 4px solid red; }';
  document.head.append(style);
})`;

const INSERT_UNLABELLED_IMAGE = `(() => {
  const image = document.createElement('img');
  image.src = '/mark.svg';
  (document.querySelector('main') ?? document.body).append(image);
})()`;

// A labelled picker with 3,000 options, like the Paid by picker once the shared CSPS_E2E database holds that many staff.
const INSERT_LONG_PICKER = `(() => {
  const label = document.createElement('label');
  label.textContent = 'Paid by';
  const select = document.createElement('select');
  for (let index = 0; index < 3000; index += 1) {
    const option = document.createElement('option');
    option.textContent = 'Staff member ' + String(index);
    select.append(option);
  }
  label.append(select);
  (document.querySelector('main') ?? document.body).append(label);
})()`;

// A tall page with a sticky 64px bottom bar (one full-size link) and a 296x44 button with 9px showing above the bar. The
// bar is sticky like the app's own bars: axe 4.13 does not count a position: fixed bar as covering a target. With
// `overlay`, an in-content link also stacks over the button's lower 35px. Built with CSSOM only: the CSP bans style attributes.
// It waits until the scroll position stops moving: WebKit moves it again a frame or two after scrollTo.
function insertBarCoveredButton(overlay: boolean): string {
  return `(async () => {
  const spacer = document.createElement('div');
  spacer.style.height = '3000px';
  document.body.append(spacer);
  const bar = document.createElement('div');
  bar.style.position = 'sticky';
  bar.style.bottom = '0';
  bar.style.height = '64px';
  bar.style.background = '#fff';
  bar.style.zIndex = '3';
  const barLink = document.createElement('a');
  barLink.href = '#e2e-fixture-bar';
  barLink.textContent = 'Bar link';
  barLink.style.display = 'block';
  barLink.style.height = '64px';
  barLink.style.color = '#000';
  bar.append(barLink);
  document.body.append(bar);
  window.scrollTo({ top: 100, behavior: 'instant' });
  let steady = 0;
  let last = -1;
  while (steady < 5) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    steady = window.scrollY === last ? steady + 1 : 0;
    last = window.scrollY;
  }
  const top = window.scrollY + window.innerHeight - 64 - 9;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'e2e-fixture-covered';
  button.textContent = 'Covered target';
  button.style.position = 'absolute';
  button.style.left = '8px';
  button.style.top = top + 'px';
  button.style.width = '296px';
  button.style.height = '44px';
  button.style.zIndex = '1';
  button.style.background = '#fff';
  button.style.color = '#000';
  button.style.border = '1px solid #000';
  document.body.append(button);
  if (${String(overlay)}) {
    const link = document.createElement('a');
    link.href = '#e2e-fixture-overlay';
    link.textContent = 'Overlay link';
    link.style.position = 'absolute';
    link.style.left = '8px';
    link.style.top = (top + 9) + 'px';
    link.style.width = '296px';
    link.style.height = '35px';
    link.style.zIndex = '2';
    link.style.background = '#fff';
    link.style.color = '#000';
    document.body.append(link);
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
})()`;
}

/** Fetches a same-origin path from the page and returns the status. */
function fetchStatus(path: string): string {
  return `fetch(${JSON.stringify(path)}).then((response) => response.status)`;
}

test('@fixture a console error is caught', async ({ page, guard }) => {
  await page.goto('/');
  expect(listFindings(await guard.peek())).toEqual([]);

  await page.evaluate(`console.error(${JSON.stringify(DELIBERATE)})`);
  const record = await guard.take();

  expect(record.console).toEqual([expect.stringContaining(`console.error: ${DELIBERATE}`)]);
  expect(record.pageErrors).toEqual([]);
  expect(record.cspViolations).toEqual([]);
  expect(record.failedResponses).toEqual([]);
  expect(() => {
    assertNoFindings(record);
  }).toThrow(DELIBERATE);
});

test('@fixture a CSP violation (an injected <style> element) is caught', async ({ page, guard }) => {
  await page.goto('/');
  expect(listFindings(await guard.peek())).toEqual([]);

  expect(await page.evaluate<boolean>(INSERT_STYLE)).toBe(true);
  const record = await guard.take();

  // style-src-elem where the engine reports the specific directive, style-src where it reports the fallback.
  expect(record.cspViolations.map((violation) => violation.directive)).toEqual([
    expect.stringMatching(/^style-src(-elem)?$/),
  ]);
  expect(() => {
    assertNoFindings(record);
  }).toThrow(/csp: style-src/);
});

test('@fixture an unlabelled image fails the axe check', async ({ page, guard }) => {
  await page.goto('/');
  await expectNoAxeViolations(page);

  await page.evaluate(INSERT_UNLABELLED_IMAGE);

  await expect(expectNoAxeViolations(page)).rejects.toThrow(/image-alt/);
  expect(listFindings(await guard.take())).toEqual([]);
});

// Every option is a passing axe node. The check must not spend time per passing node: WebKit took about 25 s per check on
// the Add Expense dialog's 2,300 options and @expenses-add timed out (debug session expenses-add-save-slow).
test('@fixture the axe check takes seconds, not minutes, on a page with thousands of passing nodes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(INSERT_LONG_PICKER);

  const started = Date.now();
  await expectNoAxeViolations(page);
  expect(Date.now() - started).toBeLessThan(10_000);
});

test('@fixture a target only a sticky bar partly covers passes the axe check once scrolled clear, and the scroll position is kept', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(insertBarCoveredButton(false));
  const scrollBefore = await page.evaluate<number>('window.scrollY');

  const direct = await pageAxe(page).analyze();
  const targetSize = direct.violations.find((violation) => violation.id === 'target-size');
  expect(targetSize?.nodes.map((node) => node.target.join(' '))).toEqual(['#e2e-fixture-covered']);

  await expectNoAxeViolations(page);
  expect(await page.evaluate<number>('window.scrollY')).toBe(scrollBefore);
});

test('@fixture a target still covered after it is scrolled clear fails the axe check', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(insertBarCoveredButton(true));

  await expect(expectNoAxeViolations(page)).rejects.toThrow(
    /^axe found 1 violation\(s\):\ntarget-size: #e2e-fixture-covered$/,
  );
});

test('@fixture an unexpected same-origin 404 is caught, and a declared one is not', async ({
  page,
  guard,
  baseURL,
  browserName,
}) => {
  await page.goto('/');
  guard.expectStatus('/e2e-fixture-declared.js', 404);

  expect(await page.evaluate<number>(fetchStatus('/e2e-fixture-declared.js'))).toBe(404);
  expect(await page.evaluate<number>(fetchStatus('/e2e-fixture-undeclared.js'))).toBe(404);
  // Chromium and WebKit also log each failed load to the console, in request order, so once the undeclared line is
  // there the declared one would be too. Firefox logs neither.
  if (browserName !== 'firefox') {
    await expect
      .poll(async () => (await guard.peek()).console.some((line) => line.includes('/e2e-fixture-undeclared.js')))
      .toBe(true);
  }
  const record = await guard.take();

  expect(record.failedResponses).toEqual([`404 GET ${String(baseURL)}/e2e-fixture-undeclared.js`]);
  expect(record.console.every((line) => line.includes('/e2e-fixture-undeclared.js'))).toBe(true);
  expect(() => {
    assertNoFindings(record);
  }).toThrow('response: 404 GET');
});

// TOOL-WR-14: a same-origin request that fails at network level gets no response event (and Firefox writes no console
// line for it), so the guard records requestfailed too. A cancellation (navigation, AbortController) is not a failure.
test('@fixture a same-origin request that fails at network level is caught, and a declared one is not', async ({
  page,
  guard,
  baseURL,
}) => {
  await page.goto('/');
  await page.route('**/e2e-fixture-reset*.js', (route) => route.abort('connectionreset'));
  guard.expectFailure('/e2e-fixture-reset-declared.js');

  await page.evaluate(`fetch('/e2e-fixture-reset-declared.js').then(() => 'ok', () => 'failed')`);
  expect(await page.evaluate<string>(`fetch('/e2e-fixture-reset.js').then(() => 'ok', () => 'failed')`)).toBe('failed');
  await expect.poll(async () => (await guard.peek()).failedResponses.length).toBe(1);
  const record = await guard.take();

  expect(record.failedResponses).toEqual([
    expect.stringMatching(new RegExp(`^failed GET ${String(baseURL)}/e2e-fixture-reset\\.js \\(.+\\)$`)),
  ]);
  expect(() => {
    assertNoFindings(record);
  }).toThrow('response: failed GET');
});

test('@fixture a second page of the same context is guarded too', async ({ page, guard }) => {
  await page.goto('/');
  const second = await page.context().newPage();
  await second.goto('/');
  await second.evaluate(`console.error(${JSON.stringify(DELIBERATE)})`);
  await second.close();
  const record = await guard.take();

  expect(record.console).toEqual([expect.stringContaining(`console.error: ${DELIBERATE}`)]);
  expect(() => {
    assertNoFindings(record);
  }).toThrow(DELIBERATE);
});
