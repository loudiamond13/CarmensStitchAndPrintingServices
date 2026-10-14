// Smoke test (QUAL-04, A11Y-01): the real host serves the e2e build on HTTPS 5199 under the strict CSP, and the page is
// clean in all five projects: no console, page, CSP or response findings (the guard), and no axe violations.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test('@smoke the home page loads clean', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  // The strict policy from SecurityHeadersMiddleware; a relaxed one would make the CSP guard meaningless.
  const policy = response?.headers()['content-security-policy'] ?? '';
  expect(policy).toContain("script-src 'self';");
  expect(policy).toContain("style-src 'self';");
  expect(policy).not.toContain('unsafe-');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Site update in progress.');
  await expectNoAxeViolations(page);
});
