// Reference smoke (WEB-02, D-33): the frozen App. D.3 Button renders from the shared 02-38 scenario list, styled by the
// verbatim spec CSS plus the rulings layer, under the production StrictCsp, in chromium, firefox and webkit. Run it with
// `npm --prefix web run parity -- --grep @reference`.
import { expect, expectCases, EMPTY_SELECTION_MESSAGE, test } from './guard.ts';
import { readStrictCsp, REFERENCE_DIST, REFERENCE_ORIGIN, routeDist } from './serve.ts';

test.beforeEach(async ({ page }) => {
  await routeDist(page, { origin: REFERENCE_ORIGIN, distDir: REFERENCE_DIST });
});

test('@reference the frozen spec Button renders from the shared scenario list under the strict CSP', async ({
  page,
  guard,
}) => {
  const response = await page.goto(`${REFERENCE_ORIGIN}/?case=button-primary-md&theme=light`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toBe(readStrictCsp());

  expect(await expectCases(page)).toBe(1);
  expect(await page.evaluate('document.fonts.ready.then(() => document.fonts.status)')).toBe('loaded');

  const frame = page.locator('[data-case="button-primary-md"]');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('data-theme', 'light');
  await expect(frame).toHaveClass('s-page');
  const button = frame.locator('button').first();
  await expect(button).toHaveText('Save Order');
  // --primary in Blush (#572e2b), from the verbatim App. A tokens through App. B .csp-btn-primary.
  await expect(button).toHaveCSS('background-color', 'rgb(87, 46, 43)');

  const record = await guard.peek();
  expect(record.cspViolations).toEqual([]);
  expect(record.console).toEqual([]);
});

test('@reference a filter that selects no scenario shows the empty marker, and the run fails on it', async ({
  page,
}) => {
  await page.goto(`${REFERENCE_ORIGIN}/?case=does-not-exist&theme=light`);

  await expect(page.locator('[data-parity-empty]')).toHaveCount(1);
  await expect(page.locator('[data-case]')).toHaveCount(0);
  await expect(expectCases(page)).rejects.toThrow(EMPTY_SELECTION_MESSAGE);
});
