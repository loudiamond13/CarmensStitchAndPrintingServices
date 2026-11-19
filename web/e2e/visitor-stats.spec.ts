// Visitor Stats end to end (PRD §14 "metrics dashboard shows recorded page views"; ANL-08, D-21, D-23, D-57, D-67, D-68, D-70, WEB-10),
// in all five projects. A visitor with no cookie choice (there is no cookie bar) opens three public pages; a Manager in a separate
// browser context then sees each page count rise on Visitor Stats. Pages a signed-in Manager opens add nothing (D-21). An Admin never
// reaches the page (D-23). The range lives in the URL, a custom range that does not pass sends nothing, a range two years back shows
// the seeded page views, and Export CSV saves the range. Other specs and the other projects count page views on the same CSPS_E2E
// database at the same time, so live counts are "at least"; days seeded through the Testing route are exact, and each project
// seeds its own days.
import { readFileSync } from 'node:fs';
import type { APIRequestContext, Locator, Page, Request, Response } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, guardContext, test, type Guard } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { ensureDemoSiteContent, isDemoSeeded, withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedAnalytics, type AnalyticsSeedDay } from './testing-api.ts';

const STATS = '/admin/visitor-stats';
const PAGE_VIEWS = '/api/v1/analytics/page-views';
const STAFF_COOKIE = '__Secure-csps_staff';
const STATS_API = '/api/v1/visitor-stats';
const CSV_HEADER = 'Date,Page,Page views';
const ORDER_MESSAGE = 'The start date must be on or before the end date.';

/** Each project seeds its own days, so the five projects never replace each other's rows. */
const PROJECTS = ['chromium', 'firefox', 'webkit', 'pixel', 'iphone'];
function projectSlot(): number {
  const index = PROJECTS.indexOf(test.info().project.name);
  return index < 0 ? PROJECTS.length : index;
}

/**
 * Six days about two years ago (inside the 3 year reach of the date picker): day k has k + 1 Home views, and the first day also has
 * 4 Products views. Page views 25, Home 21, Products 4. `rows` is each date, page name and page view count, as the CSV lists them.
 */
function oldRange(): { from: string; to: string; days: AnalyticsSeedDay[]; rows: string[][] } {
  const start = -(730 + projectSlot() * 10) - 5;
  const offsets = [0, 1, 2, 3, 4, 5].map((k) => start + k);
  const days: AnalyticsSeedDay[] = offsets.map((offsetDays, k) => ({ offsetDays, pageKey: 'home', views: k + 1 }));
  days.push({ offsetDays: start, pageKey: 'products', views: 4 });
  const rows = offsets.flatMap((offsetDays, k) => {
    const home = [manilaDate(offsetDays), 'Home', String(k + 1)];
    return k === 0 ? [home, [manilaDate(offsetDays), 'Products', '4']] : [home];
  });
  return { from: manilaDate(start), to: manilaDate(start + 5), days, rows };
}

/** A day of the last 30 with views, so the default range always has a chart. */
function recentDay(): AnalyticsSeedDay {
  return { offsetDays: -(5 + projectSlot()), pageKey: 'contact', views: 3 };
}

function query(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

const isStatsRead = (request: Request): boolean => new URL(request.url()).pathname === STATS_API;

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
 * Loads every font face of the current page before the test moves on. A glyph that arrives with late data (the peso sign on the
 * dashboard) starts one more font download, and Firefox logs a font download that a navigation cuts off as a console error,
 * which the guard counts. Loading the faces first means no download is left to cut off.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate('Promise.all(Array.from(document.fonts, (face) => face.load())).then(() => true)');
}

/** Opens a path once the current page has settled. */
async function go(page: Page, path: string): Promise<void> {
  await settle(page);
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

test.describe('a visitor with no cookie choice', () => {
  test('@visitor-stats a visitor with no choice opens Home, Products and Gallery, and a Manager in another browser sees each count rise', async ({
    page,
    browser,
    baseURL,
    request,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    // The first test of a worker can wait up to 6 minutes for the site content lock (the Gallery needs the demo photos).
    if (!isDemoSeeded()) {
      testInfo.setTimeout(testInfo.timeout + 480_000);
    }
    await ensureDemoSiteContent(request);

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

      const names = ['Home', 'Products', 'Gallery'];
      const before = new Map<string, number>();
      for (const name of names) {
        before.set(name, await listCount(manager, 'Most viewed pages', name));
      }

      await openCounted(page, '/');
      await expect(page.getByRole('region', { name: 'Cookie choices' })).toHaveCount(0);
      await openCounted(page, '/products');
      await openCounted(page, '/gallery');

      await openStats(manager);
      await expect(manager.locator(`svg [data-bucket="${manilaDate(0)}"]`)).toHaveCount(1);
      for (const name of names) {
        expect(await listCount(manager, 'Most viewed pages', name), name).toBeGreaterThanOrEqual(
          (before.get(name) ?? 0) + 1,
        );
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
  // The site content lock can take up to 6 minutes to get (the sweep and consent specs hold it while they open /terms).
  test.setTimeout(480_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  expect(
    (await context.cookies()).some((cookie) => cookie.name === STAFF_COOKIE),
    'the staff marker is set',
  ).toBe(true);

  // Terms of Use: the Terms sweep and the consent journey also open it, and a visitor view of it is counted. Every spec that opens
  // /terms does so under the site content lock, so under it the row moves only if this Manager's view is counted.
  await withSiteContentLock(async () => {
    await openStats(page);
    const before = await listCount(page, 'Most viewed pages', 'Terms of Use');
    await openCounted(page, '/terms');
    await openStats(page);
    expect(await listCount(page, 'Most viewed pages', 'Terms of Use')).toBe(before);
  });
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

/** Blush is the light theme, Espresso the dark one. */
async function switchTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const root = page.locator('[data-theme]').first();
  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByRole('button', { name: theme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode' }).click();
  }
  await expect(root).toHaveAttribute('data-theme', theme);
}

/** Signs a fresh Manager in; opening the sign-in page asks for a session first, and with none that answer is a 401. */
async function signInManager(page: Page, request: APIRequestContext, guard: Guard): Promise<void> {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
}

test('@visitor-stats This year is written to the URL, a reload keeps it, and Back and Forward bring it back', async ({
  page,
  request,
  guard,
}) => {
  await signInManager(page, request, guard);
  await openStats(page);
  expect(page.url().includes('?'), 'the default range stays out of the URL').toBe(false);
  const range = page.getByLabel('Date range', { exact: true });
  await expect(range).toHaveValue('last-30-days');

  const read = page.waitForRequest(
    (sent) => isStatsRead(sent) && new URL(sent.url()).searchParams.get('range') === 'this-year',
  );
  await range.selectOption('this-year');
  await read;
  await expect.poll(() => query(page).get('range')).toBe('this-year');
  const subline = page.getByText(/^Jan 1 to [A-Z][a-z]{2} \d{1,2}, \d{4} · Page views on the public website\./);
  await expect(subline).toBeVisible();

  await settle(page);
  await page.reload();
  await expect(range).toHaveValue('this-year');
  await expect(subline).toBeVisible();
  expect(query(page).get('range')).toBe('this-year');

  // A range change replaces the history entry (UI-SPEC "URL params"), so Back and Forward are proved over a trip to the Dashboard.
  const menu = await adminMenu(page);
  await menu.getByRole('link', { name: /^Dashboard/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goBack();
  await expect(range).toHaveValue('this-year');
  await expect(subline).toBeVisible();
  expect(query(page).get('range')).toBe('this-year');
  await page.goForward();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goBack();
  await expect(range).toHaveValue('this-year');
  await expect(subline).toBeVisible();
});

test('@visitor-stats a custom range with From after To shows the message and sends no request until it is fixed', async ({
  page,
  request,
  guard,
}) => {
  await signInManager(page, request, guard);
  await openStats(page);
  const reads: string[] = [];
  page.on('request', (sent) => {
    if (isStatsRead(sent)) {
      reads.push(sent.url());
    }
  });

  await page.getByLabel('Date range', { exact: true }).selectOption('custom');
  const from = page.getByLabel('From', { exact: true });
  const to = page.getByLabel('To', { exact: true });
  await from.fill(manilaDate(0));
  await to.fill(manilaDate(-1));

  await expect(page.getByText(ORDER_MESSAGE)).toBeVisible();
  await expect(from).toHaveAttribute('aria-invalid', 'true');
  await page.waitForLoadState('networkidle');
  expect(reads, 'no stats read for a range that does not pass').toEqual([]);
  expect(query(page).get('from')).toBeNull();

  // Fixing To applies the range: one read with both dates, and the message goes.
  const applied = page.waitForRequest(
    (sent) => isStatsRead(sent) && new URL(sent.url()).searchParams.get('to') === manilaDate(0),
  );
  await to.fill(manilaDate(0));
  await applied;
  await expect(page.getByText(ORDER_MESSAGE)).toHaveCount(0);
  await expect.poll(() => query(page).get('from')).toBe(manilaDate(0));
});

test('@visitor-stats a custom range two years back shows the seeded page views', async ({ page, request, guard }) => {
  const old = oldRange();
  await seedAnalytics(request, old.days);
  await signInManager(page, request, guard);

  await go(page, `${STATS}?range=custom&from=${old.from}&to=${old.to}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toBeVisible();
  expect(await kpiCount(page, 'Page views')).toBe(25);
  expect(await listCount(page, 'Most viewed pages', 'Home')).toBe(21);
  expect(await listCount(page, 'Most viewed pages', 'Products')).toBe(4);
  await expect(page.getByText(/13 months/)).toHaveCount(0);
  await expect(page.getByText(/Not available/)).toHaveCount(0);
  await expect(page.getByLabel('Date range', { exact: true })).toHaveValue('custom');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(old.from);
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(old.to);
});

test('@visitor-stats Export CSV saves the range with a byte-order mark, the header and one row per day', async ({
  page,
  request,
  guard,
}) => {
  const old = oldRange();
  await seedAnalytics(request, old.days);
  await signInManager(page, request, guard);
  await go(page, `${STATS}?range=custom&from=${old.from}&to=${old.to}`);
  expect(await kpiCount(page, 'Page views')).toBe(25);

  await settle(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;

  const name = `visitor-stats-${old.from}-to-${old.to}.csv`;
  expect(file.suggestedFilename()).toBe(name);
  const bytes = readFileSync(await file.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.subarray(3).toString('utf8');
  const lines = text.split('\r\n');
  expect(lines[0]).toBe(CSV_HEADER);
  expect(lines.at(-1), 'the file ends with a line break').toBe('');
  expect(lines.slice(1, -1).map((line) => line.split(','))).toEqual(old.rows);
  await expect(page.getByText(`${name} is in your downloads.`)).toBeVisible();
});

test('@visitor-stats Export CSV for a range with no views saves the header alone under the range name', async ({
  page,
  request,
  guard,
}) => {
  const from = manilaDate(-1000);
  const to = manilaDate(-995);
  await signInManager(page, request, guard);
  await go(page, `${STATS}?range=custom&from=${from}&to=${to}`);
  expect(await kpiCount(page, 'Page views')).toBe(0);

  await settle(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toBe(`visitor-stats-${from}-to-${to}.csv`);
  const bytes = readFileSync(await file.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.subarray(3).toString('utf8')).toBe(`${CSV_HEADER}\r\n`);
});

test('@visitor-stats one h1 and no axe violations at 390 and 1440 in Blush and Espresso, no sideways scroll at 320, and the chart is one tab stop', async ({
  page,
  request,
  guard,
}) => {
  await seedAnalytics(request, [recentDay()]);
  await signInManager(page, request, guard);
  await openStats(page);
  const chart = page.getByRole('group', { name: /^Page views, / });
  await expect(chart).toBeVisible();

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await switchTheme(page, theme);
      await expect(page.locator('h1')).toHaveCount(1);
      await expectNoAxeViolations(page);
    }
  }
  await switchTheme(page, 'light');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // A11Y-CHART: the plot is the figure's only tab stop; the arrow keys move the tooltip, read out by the live text.
  await page.setViewportSize({ width: 1440, height: 900 });
  const figure = page.locator('figure', { has: chart });
  expect(await figure.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count()).toBe(1);
  const live = figure.locator('p[aria-live="polite"]');
  const tip = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, Page views [\d,]+$/;
  await page.getByRole('button', { name: 'Export CSV' }).focus();
  await page.keyboard.press('Tab');
  await expect(chart).toBeFocused();
  await expect(live).toHaveText(tip);
  const first = await live.innerText();
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(tip);
  await expect(live).not.toHaveText(first);
  // Shift+Tab leaves the plot in one press, back to Export CSV: nothing inside the figure takes focus between them.
  await page.keyboard.press('Shift+Tab');
  await expect(chart).not.toBeFocused();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeFocused();
});
