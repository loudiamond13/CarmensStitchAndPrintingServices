// Smoke test (QUAL-04, A11Y-01): the real host serves the app on HTTPS 5199 under the strict CSP, and the page is clean
// in every engine. It settles assumption A1: axe injection and the CSP listener both work under the strict CSP.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

// A copy of SecurityHeadersMiddleware.StrictCsp (src/Csps.Server/Http/SecurityHeadersMiddleware.cs). The test compares
// the exact header text, so a relaxed policy fails here.
const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

test('@smoke shell loads clean', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toBe(STRICT_CSP);
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoAxeViolations(page);
});
