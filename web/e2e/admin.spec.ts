// Admin shell E2E (WEB-05, A11Y-01, A11Y-02, D-20): the e2e bundle has the dev-only admin routes, and each admin path
// renders the shell on the real host in all five projects: its preview page h1, the matching current sidebar item, the
// document title, the skip link first in the document, and no console, page, CSP, response (the guard) or axe findings.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

interface AdminPath {
  readonly path: string;
  /** The nav label: the h1, the current item and the first half of the document title. */
  readonly label: string;
}

const PATHS: readonly AdminPath[] = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/orders', label: 'Orders' },
  { path: '/admin/expenses', label: 'Company Expenses' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/profile', label: 'My Profile' },
];

/** The text of the first element in document order that Tab can reach (a page script: the node program has no DOM). */
const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

for (const { path, label } of PATHS) {
  test(`@admin ${path} renders the admin shell with ${label} current`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(label);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page).toHaveTitle(`${label} · CSPS Admin`);
    await expect(page.getByText('Development only. This screen is built in a later phase.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Component Showcase' })).toHaveAttribute(
      'href',
      '/dev/components',
    );

    // The current item: the sidebar's where the sidebar shows (768px and up), and in the DOM at every width.
    const current = page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(label);

    // A11Y-02: nothing focusable comes before the skip link (WebKit's Tab skips links, so the order is read here).
    expect(await page.evaluate(FIRST_FOCUSABLE_TEXT)).toBe('Skip to main content');

    await expectNoAxeViolations(page);
  });
}
