// Site Content, the Business Info tab, end to end (CONT-01, PUB-03, D-27; plan 11-12), in all five projects. A Manager opens Site
// Content from the sidebar (the drawer on a phone), changes the tagline, saves, and the public footer shows it in the same browser.
// The shop facts are one set for every project, so each test runs under the site content lock and puts the demo shop back at the
// end. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone). */
async function openSiteContent(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: /^Site Content/ })
      .click();
  } else {
    await page
      .locator('aside nav[aria-label="Admin"]')
      .getByRole('link', { name: /^Site Content/ })
      .click();
  }
  await expect(page).toHaveURL(/\/admin\/site-content$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
  await expect(page.getByLabel(/^Tagline/)).toBeVisible();
}

test('@site-content-business a Manager changes the tagline, saves, and the public footer shows it', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const tagline = `Made for the whole team ${randomUUID().slice(0, 8)}.`;
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      const manager = await createStaff(request, 'Manager');
      await signInAs(page, request, manager);
      await page.goto('/admin/sessions');
      await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();

      await openSiteContent(page);
      await expect(page).toHaveTitle('Site Content · CSPS Admin');
      await expect(page.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');

      const field = page.getByLabel(/^Tagline/);
      await field.fill(tagline);
      const save = page.getByRole('button', { name: 'Save Business Info' });
      await save.click();

      await expect(page.getByText('Business info saved')).toBeVisible();
      await expect(page.getByText('The website shows the new details now.')).toBeVisible();
      await expect(save).toBeFocused();

      // The same browser, the public site: the footer carries the new tagline.
      await page.goto('/');
      await expect(page.getByRole('contentinfo').getByText(tagline)).toBeVisible();
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});
