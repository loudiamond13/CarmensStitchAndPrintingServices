// Site Content, the Products tab and the product line editor, end to end (CONT-02, PUB-03, D-04, D-08; plan 11-20), in all five projects. A
// Manager opens the Products tab, edits Polo with a price, saves, and the public Products page carries it. The product lines are one set
// for every project, so a test that reads or changes them runs under the site content lock and puts the demo lines back at the end
// (seedDemoSiteContent also deletes every line whose short name starts with "E2E-"). Signing in takes the longest, so every test signs in
// before it takes the lock. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

// Each test waits its turn for the site content lock and signs in, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Products tab. */
async function openProductsTab(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  const sidebarLink = page.locator('aside nav[aria-label="Admin"]').getByRole('link', { name: /^Site Content/ });
  // The shell may still be laying out: wait for whichever navigation this width shows before choosing.
  await expect(menu.or(sidebarLink)).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: /^Site Content/ })
      .click();
  } else {
    await sidebarLink.click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
  await page.getByRole('tab', { name: 'Products' }).click();
  await expect(page).toHaveURL(/tab=products/);
  await expect(page.getByRole('table', { name: 'Product lines' })).toBeVisible();
}

test('@site-content-products a Manager edits Polo with the price 450.00, saves, and the public Products page shows it', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);

      await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();
      await page.getByLabel(/^Starts at, per piece/).fill('450.00');
      await expect(page.getByText('Visitors see: Starts at ₱450.00 / pc')).toBeVisible();
      await press(page, page.getByRole('button', { name: 'Save Changes' }));

      await expect(page.getByText('Product line saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('The website shows the changes now.')).toBeVisible();

      await page.goto('/products');
      const polo = page.getByRole('article', { name: 'Polo Shirts' });
      await expect(polo.getByText('Starts at')).toBeVisible();
      await expect(polo.getByText('₱450.00')).toBeVisible();
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});
