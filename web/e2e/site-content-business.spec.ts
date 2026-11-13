// Site Content, the Business Info tab, end to end (CONT-01, PUB-03, PUB-04, D-26, D-27; plans 11-12 and 11-34), in all five projects. A
// Manager opens Site Content from the sidebar (the drawer on a phone), changes the tagline, saves, and the public footer shows it in the same
// browser. The link preview picture (@site-content-share) is chosen and removed on its own, and the server's HTML of Home follows it.
// The shop facts are one set for every project, so a test that reads or saves them runs under the site content lock and puts the demo
// shop back at the end. Signing in takes the longest, so every test signs in before it takes the lock and holds the lock only for the
// work on the settings. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { holdsItsContent, NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg, photoKey } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent, type TestStaff } from './testing-api.ts';

// The demo shown orders (the Testing seeder) show on Home as Recent work. Their photos have no stored file, so they answer 404.
test.beforeEach(({ guard }) => {
  guard.expectStatus('/api/testing/images/', 404);
});

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

/** A picture save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

/** The og:image address in the server's HTML for `path`, fetched with no script and no cookies: what a crawler reads. */
async function ogImageOf(request: APIRequestContext, path: string): Promise<string | null> {
  const html = await (await request.get(path)).text();
  return /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? null;
}

test('@site-content-share a Manager chooses a link preview picture, and the next server HTML of Home has it as og:image', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const shot = await drawJpeg(page, 'share.jpg', 120, 1200, 630);
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openSiteContent(page);
      const slot = page.getByRole('group', { name: 'Link preview picture' });
      await slot.scrollIntoViewIfNeeded();

      await withPhotoHost(async () => {
        await slot.locator('input[type="file"]:not([capture])').setInputFiles(shot);
        await expect(page.getByText('Picture saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
      });
      await expect(page.getByText('Shared links use it now.')).toBeVisible();
      await expect(slot.getByRole('status')).toContainText('Saved');
      const preview = slot.getByRole('img', { name: 'The link preview picture' });
      await expect(preview).toBeVisible();
      const key = photoKey(await preview.getAttribute('src'));

      // A crawler's view: the server's own HTML, with no script run.
      const og = await ogImageOf(request, '/');
      expect(og).toContain(key);
      expect(og).toContain('csps_share_1200');
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

test('@site-content-share a Manager removes the link preview picture after the question, and Home has no og:image', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      // The demo seed leaves a share picture in place, so Home starts with an og:image.
      await seedDemoSiteContent(request);
      expect(await ogImageOf(request, '/')).not.toBeNull();
      await openSiteContent(page);
      const slot = page.getByRole('group', { name: 'Link preview picture' });
      await slot.scrollIntoViewIfNeeded();

      await press(page, slot.getByRole('button', { name: 'Remove Picture' }));
      const question = page.getByRole('dialog', { name: 'Remove the link preview picture?' });
      await expect(question.getByText('Shared links show no picture until you add one.')).toBeVisible();
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await expectNoAxeViolations(page);
      await press(page, question.getByRole('button', { name: 'Remove Picture' }));

      await expect(page.getByText('Picture removed')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('Shared links show no picture.')).toBeVisible();
      await expect(slot.getByText('No picture yet')).toBeVisible();
      await expect(slot.getByRole('button', { name: 'Choose Picture' })).toBeFocused();
      expect(await ogImageOf(request, '/')).toBeNull();

      // The settings were read again, so a Business Info save right after is not refused as stale.
      await page.getByLabel(/^Tagline/).fill('Made for the whole team.');
      await press(page, page.getByRole('button', { name: 'Save Business Info' }));
      await expect(page.getByText('Business info saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

// This one only looks at the layout, which any saved settings give, so it takes no lock and uploads nothing.
test('@site-content-share the preview is 320px wide beside a tablet and fills the card on a phone, with no sideways scroll and no axe finding', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 1024, height: 900 });
  await openSiteContent(page);
  const slot = page.getByRole('group', { name: 'Link preview picture' });
  const frame = slot.locator('[data-ratio="1.91/1"]');
  await slot.scrollIntoViewIfNeeded();
  expect((await frame.boundingBox())?.width).toBeCloseTo(320, 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await slot.scrollIntoViewIfNeeded();
  const slotBox = await slot.boundingBox();
  const frameBox = await frame.boundingBox();
  expect(Math.abs((frameBox?.width ?? 0) - (slotBox?.width ?? 1))).toBeLessThan(2);
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);

  await page.setViewportSize({ width: 320, height: 640 });
  await slot.scrollIntoViewIfNeeded();
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
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
