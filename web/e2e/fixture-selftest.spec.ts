// Fixture self-tests (QUAL-04, A11Y-01): each E2E guard must catch its own class of failure in every engine (chromium,
// firefox, webkit; the phone projects skip this file in playwright.config.ts). Each test provokes exactly one finding on
// the real home page, inspects it through the guard, proves the guard's end-of-test check would fail on it, and then
// takes (clears) the record, so the auto check passes. Nothing here uses test.fail(), which could hide a real failure.
// Page scripts are strings: the e2e TypeScript program has no DOM types, and Playwright evaluates them outside the CSP.
import { assertNoFindings, expect, expectNoAxeViolations, listFindings, test } from './fixtures.ts';

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
