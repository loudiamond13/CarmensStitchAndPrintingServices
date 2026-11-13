// Site Content, the Hours & Closures tab, end to end (CONT-01, CONT-04, PUB-03, D-21; plan 11-16), in all five projects. A Manager opens the
// tab, ticks Sunday open 10 to 3, saves, and the public site carries Sunday's hours. The hours are one set for every project, so a test that
// reads or saves them runs under the site content lock and puts the demo week back at the end. Signing in takes the longest, so every test
// signs in before it takes the lock. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Hours & Closures tab. */
async function openHoursTab(page: Page): Promise<void> {
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

      await expect(page.getByText('Opening hours saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('The Contact page and the open status use them now.')).toBeVisible();

      // The public site read the Contact page and the open status draw from: Sunday now has its hours.
      const site = await request.get('/api/v1/public/site');
      expect(site.status()).toBe(200);
      const body = (await site.json()) as { hours: { day: number; opensAt: string | null; closesAt: string | null }[] };
      expect(body.hours.find((entry) => entry.day === 7)).toEqual({ day: 7, opensAt: '10:00', closesAt: '15:00' });

      // The Contact page's hours card draws Sunday as its own row with the new hours.
      const contact = await page.context().newPage();
      await contact.goto('/contact');
      const card = contact.locator('[data-hours-card]');
      await expect(card.getByText('Monday to Saturday', { exact: true })).toBeVisible();
      await expect(card.getByText('Sunday', { exact: true })).toBeVisible();
      await expect(card.getByText('10:00 AM - 3:00 PM', { exact: true })).toBeVisible();
      await expect(card.getByText('Closed', { exact: true })).toHaveCount(0);
      await contact.close();
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

/** "Nov 19, 2026": a business date as the closure list writes it. */
function listed(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The closures the public site lists as coming up. */
async function publicClosures(request: APIRequestContext): Promise<{ firstDay: string; note: string | null }[]> {
  const site = await request.get('/api/v1/public/site');
  expect(site.status()).toBe(200);
  return ((await site.json()) as { upcomingClosures: { firstDay: string; note: string | null }[] }).upcomingClosures;
}

test('@site-content-hours a Manager adds a closure for next week, the public site lists it, and deleting it takes it off again', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const day = manilaDate(7);
  const label = listed(day);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openHoursTab(page);
      await expect(page.getByRole('table', { name: 'Upcoming closures' })).toBeVisible();

      await page.getByRole('button', { name: 'Add Closure' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Closure' });
      await dialog.getByLabel(/^First day/).fill(day);
      await dialog.getByLabel(/^Public note/).fill('E2E-holiday');
      await press(page, dialog.getByRole('button', { name: 'Save Closure' }));

      await expect(page.getByText('Closure added')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText(`${label} shows as closed.`)).toBeVisible();
      await expect(page.getByRole('button', { name: `Edit closure on ${label}` })).toBeVisible();
      expect(await publicClosures(request)).toContainEqual({ firstDay: day, lastDay: day, note: 'E2E-holiday' });

      // The Contact page lists it under Closed on with its date and note.
      const contact = await page.context().newPage();
      await contact.goto('/contact');
      const card = contact.locator('[data-hours-card]');
      await expect(card.getByRole('heading', { level: 3, name: 'Closed on' })).toBeVisible();
      await expect(card.getByText(`${label} · E2E-holiday`, { exact: true })).toBeVisible();
      await contact.close();

      await page.getByRole('button', { name: `Delete closure on ${label}` }).click();
      const question = page.getByRole('dialog', { name: 'Delete this closure?' });
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await press(page, question.getByRole('button', { name: 'Delete Closure' }));

      await expect(page.getByText('Closure deleted')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByRole('button', { name: `Edit closure on ${label}` })).toHaveCount(0);
      expect((await publicClosures(request)).map((closure) => closure.note)).not.toContain('E2E-holiday');
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

// This one only looks at the layout, which any saved hours give, so it does not take the lock.
test('@site-content-hours at 320px a day row stacks with Opens and Closes side by side, the page has no sideways scroll and axe finds nothing, window open or not', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 320, height: 640 });
  await openHoursTab(page);
  await expect(page.getByRole('table', { name: 'Upcoming closures' })).toBeVisible();

  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  // Monday is open: the checkbox is on top, Opens and Closes are side by side under it and inside the window.
  const day = await page.getByRole('checkbox', { name: 'Monday' }).boundingBox();
  const opens = await page.getByLabel('Monday opens').boundingBox();
  const closes = await page.getByLabel('Monday closes').boundingBox();
  expect((opens?.y ?? 0) >= (day?.y ?? 0) + (day?.height ?? 0) - 1).toBe(true);
  expect(Math.abs((closes?.y ?? 0) - (opens?.y ?? 0)) <= 2).toBe(true);
  expect((closes?.x ?? 0) > (opens?.x ?? 0) + (opens?.width ?? 0) - 1).toBe(true);
  expect((closes?.x ?? 0) + (closes?.width ?? 0) <= 320).toBe(true);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Add Closure' }).click();
  await expect(page.getByRole('dialog', { name: 'Add Closure' })).toBeVisible();
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
