// Visitor Stats end to end (PRD §14 "metrics dashboard shows recorded visits"; ANL-05, ANL-06, ANL-08, D-21, D-23), in all five
// projects. A visitor accepts visitor stats and opens three public pages; a Manager in a separate browser context then sees those
// visits on Visitor Stats. Pages a signed-in Manager opens add nothing (D-21). An Admin never reaches the page (D-23). Other specs
// and the other projects record visits on the same CSPS_E2E database at the same time, so live counts are "at least".
import type { Locator, Page, Response } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, guardContext, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { ensureDemoSiteContent, isDemoSeeded } from './site-content-lock.ts';
import { createStaff } from './testing-api.ts';

const STATS = '/admin/visitor-stats';
const PAGE_VIEWS = '/api/v1/analytics/page-views';
const STAFF_COOKIE = '__Secure-csps_staff';

/** The figure of one KPI card, by its label. */
function kpiValue(page: Page, label: string): Locator {
  return page.locator(`xpath=//div[div/span[normalize-space()="${label}"]]/div[@data-kpi-value]`);
}

/** The KPI figure as a number ("1,234" reads 1234). */
async function kpiCount(page: Page, label: string): Promise<number> {
  const value = kpiValue(page, label);
  await expect(value).toHaveText(/^[\d,]+$/);
  return Number((await value.innerText()).replaceAll(',', ''));
}

/** One ranked list card, by its title. */
function listCard(page: Page, title: string): Locator {
  return page.locator('section', { has: page.getByRole('heading', { level: 2, name: title, exact: true }) });
}

/** The count of one row of a list card ("4 · 12%" reads 4), or 0 when the row or the whole list is absent. */
async function listCount(page: Page, title: string, name: string): Promise<number> {
  const row = listCard(page, title).locator('li', {
    has: page.locator('[data-stat-name]', { hasText: new RegExp(`^${name}$`) }),
  });
  if ((await row.count()) === 0) {
    return 0;
  }
  const figure = await row.locator('[data-stat-figure]').innerText();
  return Number(figure.split(' · ')[0]?.replaceAll(',', '') ?? 'NaN');
}

/**
 * Opens a path once the current page has its fonts: Firefox logs a font download that a navigation cuts off as a console error,
 * and the guard counts it.
 */
async function go(page: Page, path: string): Promise<void> {
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.goto(path);
}

/** Waits for the next page view the page sends to be answered. */
function nextPageView(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) => new URL(response.url()).pathname === PAGE_VIEWS && response.request().method() === 'POST',
  );
}

/** Opens a public page and waits until its page view was answered, so the count has it. */
async function openCounted(page: Page, path: string): Promise<void> {
  const view = nextPageView(page);
  await go(page, path);
  await expect(page.locator('h1')).toBeVisible();
  expect((await view).status()).toBe(204);
}

/** Opens Visitor Stats and waits for the figures of the default range (Last 30 days). */
async function openStats(page: Page): Promise<void> {
  await go(page, STATS);
  await expect(page.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toBeVisible();
  await expect(kpiValue(page, 'Page views')).toBeVisible();
}

/** The full admin menu: the sidebar on desktop, or on a phone the navigation drawer, opened. The phone tab bar is not the menu. */
async function adminMenu(page: Page): Promise<Locator> {
  const opener = page.getByRole('button', { name: 'Open navigation' }).filter({ visible: true });
  const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Admin' }).filter({ visible: true });
  await expect(opener.or(sidebar).first()).toBeVisible();
  const menu = (await opener.count()) > 0 ? page.getByRole('dialog', { name: 'Navigation' }) : sidebar;
  if ((await opener.count()) > 0) {
    await opener.click();
  }
  await expect(menu.getByRole('link', { name: /^Dashboard/ })).toBeVisible();
  return menu;
}

test.describe('a visitor who allows visitor stats', () => {
  test.use({ consent: 'none' });

  test('@visitor-stats a visitor accepts and opens three pages, and a Manager in another browser sees the visits', async ({
    page,
    browser,
    baseURL,
    request,
  }) => {
    // The first test of a worker can wait up to 6 minutes for the site content lock (the Gallery needs the demo photos).
    test.setTimeout(isDemoSeeded() ? 180_000 : 660_000);
    await ensureDemoSiteContent(request);

    const landing = nextPageView(page);
    await page.goto('/');
    await page.getByRole('region', { name: 'Cookie choices' }).getByRole('button', { name: 'Accept All' }).click();
    expect((await landing).status()).toBe(204);
    await openCounted(page, '/products');
    await openCounted(page, '/gallery');

    const context = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
    const watched = await guardContext(context, baseURL);
    watched.guard.expectStatus('/api/v1/auth/refresh', 401);
    try {
      const manager = await context.newPage();
      await signInAs(manager, request, await createStaff(request, 'Manager'));
      const menu = await adminMenu(manager);
      await menu.getByRole('link', { name: /^Visitor Stats/ }).click();
      await expect(manager).toHaveURL(/\/admin\/visitor-stats$/);
      await expect(manager.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toBeVisible();
      await expect(manager).toHaveTitle('Visitor Stats · CSPS Admin');

      expect(await kpiCount(manager, 'Page views')).toBeGreaterThanOrEqual(3);
      expect(await kpiCount(manager, 'Visits')).toBeGreaterThanOrEqual(1);
      expect(await kpiCount(manager, 'Unique visitors')).toBeGreaterThanOrEqual(1);
      await expect(manager.locator(`svg [data-bucket="${manilaDate(0)}"]`)).toHaveCount(1);
      for (const name of ['Home', 'Products', 'Gallery']) {
        expect(await listCount(manager, 'Most viewed pages', name), name).toBeGreaterThanOrEqual(1);
      }
      await watched.finish();
    } finally {
      await context.close();
    }
  });
});

test('@visitor-stats a page a signed-in Manager opens on the public site adds nothing to the counts', async ({
  page,
  context,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  expect(
    (await context.cookies()).some((cookie) => cookie.name === STAFF_COOKIE),
    'the staff marker is set',
  ).toBe(true);

  // Terms of Use: the one page no other visitor stats journey opens, so its row moves only if this view is counted.
  await openStats(page);
  const before = await listCount(page, 'Most viewed pages', 'Terms of Use');
  await openCounted(page, '/terms');
  await openStats(page);
  expect(await listCount(page, 'Most viewed pages', 'Terms of Use')).toBe(before);
});

test('@visitor-stats an Admin who opens Visitor Stats lands on /admin and the menu has no Visitor Stats item', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Admin'));

  await go(page, STATS);

  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toHaveCount(0);
  const menu = await adminMenu(page);
  await expect(menu.getByRole('link', { name: /^Users/ })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: /^Visitor Stats/ })).toHaveCount(0);
  await expect(page.locator(`a[href="${STATS}"]`)).toHaveCount(0);
});
