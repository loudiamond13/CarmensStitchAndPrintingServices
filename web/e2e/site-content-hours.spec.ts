// Site Content, the Hours & Closures tab, end to end (CONT-01, CONT-04, PUB-03, D-21; plan 11-16), in all five projects. A Manager opens the
// tab, ticks Sunday open 10 to 3, saves, and the public site carries Sunday's hours. The hours are one set for every project, so a test that
// reads or saves them runs under the site content lock and puts the demo week back at the end. Signing in takes the longest, so every test
// signs in before it takes the lock. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Hours & Closures tab. */
async function openHoursTab(page: Page): Promise<void> {
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
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
  await page.getByRole('tab', { name: 'Hours & Closures' }).click();
  await expect(page).toHaveURL(/tab=hours/);
  await expect(page.getByRole('checkbox', { name: 'Sunday' })).toBeVisible();
}

test('@site-content-hours a Manager ticks Sunday open 10 to 3, saves, and the public site carries those hours', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openHoursTab(page);
      await expect(page.getByText('Visitors see: Mon-Sat · 9:00 AM - 6:00 PM')).toBeVisible();

      await page.getByRole('checkbox', { name: 'Sunday' }).check();
      await page.getByLabel('Sunday opens').selectOption('10:00');
      await page.getByLabel('Sunday closes').selectOption('15:00');
      await expect(page.getByText('Sun · 10:00 AM - 3:00 PM')).toBeVisible();
      await press(page, page.getByRole('button', { name: 'Save Hours' }));

      await expect(page.getByText('Opening hours saved')).toBeVisible();
      await expect(page.getByText('The Contact page and the open status use them now.')).toBeVisible();

      // The public site read the Contact page and the open status draw from: Sunday now has its hours.
      const site = await request.get('/api/v1/public/site');
      expect(site.status()).toBe(200);
      const body = (await site.json()) as { hours: { day: number; opensAt: string | null; closesAt: string | null }[] };
      expect(body.hours.find((entry) => entry.day === 7)).toEqual({ day: 7, opensAt: '10:00', closesAt: '15:00' });
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});
