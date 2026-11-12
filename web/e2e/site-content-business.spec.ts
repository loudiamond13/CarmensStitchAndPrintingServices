// Site Content, the Business Info tab, end to end (CONT-01, PUB-03, D-27; plan 11-12), in all five projects. A Manager opens Site
// Content from the sidebar (the drawer on a phone), changes the tagline, saves, and the public footer shows it in the same browser.
// The shop facts are one set for every project, so a test that reads or saves them runs under the site content lock and puts the demo
// shop back at the end. Signing in takes the longest, so every test signs in before it takes the lock and holds the lock only for the
// work on the settings. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { holdsItsContent, NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent, type TestStaff } from './testing-api.ts';

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
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const tagline = `Made for the whole team ${randomUUID().slice(0, 8)}.`;
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openSiteContent(page);
      await expect(page).toHaveTitle('Site Content · CSPS Admin');
      await expect(page.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');

      await page.getByLabel(/^Tagline/).fill(tagline);
      const save = page.getByRole('button', { name: 'Save Business Info' });
      await press(page, save);

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

// This one only looks at the layout, which any saved settings give, so it does not take the lock.
test('@site-content-business at 320px the page has no sideways scroll, the tab strip holds itself and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 320, height: 640 });
  await openSiteContent(page);

  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(await page.getByRole('tablist').evaluate(holdsItsContent)).toBe(true);
  // A phone row stacks: the Number and its Label are on top of each other and inside the window.
  const [number, label] = await page.getByLabel(/^(Number|Label \(optional\))/).all();
  const numberBox = await number?.boundingBox();
  const labelBox = await label?.boundingBox();
  expect((labelBox?.y ?? 0) > (numberBox?.y ?? 0)).toBe(true);
  expect((numberBox?.x ?? 0) + (numberBox?.width ?? 0) <= 320).toBe(true);
  await expectNoAxeViolations(page);
});

/** Opens a second browser context and signs a second Manager in, so two people can work on the same settings. */
async function signInSecondManager(
  browser: Browser,
  baseURL: string | undefined,
  request: APIRequestContext,
  staff: TestStaff,
): Promise<Page> {
  const context = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await signInAs(page, request, staff);
  return page;
}

test('@site-content-business a second Manager saving first makes the first save show the conflict banner, and Load Latest shows their words', async ({
  page,
  request,
  browser,
  baseURL,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  guard.expectStatus('/api/v1/site-settings', 409);
  const token = randomUUID().slice(0, 8);
  const mine = `My words ${token}.`;
  const theirs = `Their words ${token}.`;
  const other = await signInSecondManager(browser, baseURL, request, await createStaff(request, 'Manager'));
  try {
    await signInAs(page, request, await createStaff(request, 'Manager'));
    await withSiteContentLock(async () => {
      try {
        await seedDemoSiteContent(request);
        await openSiteContent(page);
        await page.getByLabel(/^Tagline/).fill(mine);

        // The other person opens the same settings and saves first.
        await openSiteContent(other);
        await other.getByLabel(/^Tagline/).fill(theirs);
        await press(other, other.getByRole('button', { name: 'Save Business Info' }));
        await expect(other.getByText('Business info saved')).toBeVisible();

        await press(page, page.getByRole('button', { name: 'Save Business Info' }));

        await expect(page.getByRole('alert').getByText('This was changed by someone else.')).toBeVisible();
        await expect(page.getByLabel(/^Tagline/)).toHaveValue(mine);
        await expectNoAxeViolations(page);

        await press(page, page.getByRole('button', { name: 'Load Latest' }));
        await press(
          page,
          page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard Changes' }),
        );
        await expect(page.getByLabel(/^Tagline/)).toHaveValue(theirs);
        await expect(page.getByText('This was changed by someone else.')).toHaveCount(0);
      } finally {
        await seedDemoSiteContent(request);
      }
    });
  } finally {
    await other.context().close();
  }
});

test('@site-content-business an Admin who opens Site Content is sent to the dashboard and has no Site Content item', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Admin'));

  await page.goto('/admin/site-content');

  // The route's loader sends an Admin to /admin; the page never shows, and the shell has no Site Content item.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('main')).toBeVisible();
  await page.evaluate('document.fonts.ready.then(() => true)');
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Admin"] a', { hasText: 'Site Content' })).toHaveCount(0);
});
