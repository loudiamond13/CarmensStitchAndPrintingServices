// Company Expenses end to end (CEXP-01, D-23, D-25, WEB-10; plan 06-04), in all five projects. A signed-in Manager sees the
// seeded expenses of the server's window with "Upcoming" on a future one, the footer total equals the API's periodTotal, page 2
// opens from the URL, and the page fits a 320 px phone with no axe findings; a signed-in Admin reaches the page too. The shared
// CSPS_E2E database keeps the expenses earlier runs made, so each check finds its own rows by a unique description and
// compares the footer with the response it just read, never with a fixed number. Every test runs under the shared guard
// (console, page errors, CSP, failed responses). @expenses-filters (plan 06-07) searches by a new payer, filters by category and a
// custom range, reopens the same view with Back, and clears the filters.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createExpense, createStaff } from './testing-api.ts';

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

/** Two of the seeded categories (the ids are the fixed migration seed literals). */
const RENT = '6869715c-a01f-4053-87d8-8fd39feebebc';
const SUPPLIES = '447ad32e-1433-4b70-8786-72e3dc3f9937';

/** The business date (Asia/Manila) `offsetDays` from today, as yyyy-MM-dd. */
function manilaDate(offsetDays: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

/** "₱12,450.00": the figure as the page shows money (no float arithmetic, only formatting). */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ListBody {
  readonly total: number;
  readonly periodTotal: number;
  /** The business today the server used. */
  readonly today: string;
  /** The window (or range) the server used. */
  readonly from: string;
  readonly to: string;
  readonly items: readonly { readonly date: string }[];
}

function isListBody(value: unknown): value is ListBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total' in value &&
    typeof value.total === 'number' &&
    'periodTotal' in value &&
    typeof value.periodTotal === 'number' &&
    'today' in value &&
    typeof value.today === 'string' &&
    'from' in value &&
    typeof value.from === 'string' &&
    'to' in value &&
    typeof value.to === 'string' &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(
      (item: unknown) => typeof item === 'object' && item !== null && 'date' in item && typeof item.date === 'string',
    )
  );
}

/** True for the list route only; the KPI route sits under it and is read by the same page. */
function isListUrl(url: string): boolean {
  return new URL(url).pathname === '/api/v1/company-expenses';
}

/** Opens a Company Expenses URL and returns what the list call answered. */
async function openList(page: Page, path: string): Promise<ListBody> {
  const listed = page.waitForResponse((response) => isListUrl(response.url()) && response.request().method() === 'GET');
  await page.goto(path);
  const body: unknown = await (await listed).json();
  if (!isListBody(body)) {
    throw new Error('GET /api/v1/company-expenses returned an unexpected body.');
  }
  return body;
}

test('@expenses-list a Manager sees the window newest first with Upcoming, the server total in the footer, and page 2 by URL', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const token = randomUUID().slice(0, 8);
  const soon = `E2E upcoming ${token}`;
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(29),
    categoryId: RENT,
    description: soon,
    amount: 1250.5,
  });
  // Enough rows for a second page at 10 a page, whatever earlier runs left behind, and some dated before today.
  await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      createExpense(request, {
        paidByUserId: manager.userId,
        recordedByUserId: manager.userId,
        date: manilaDate(-4 - index),
        categoryId: SUPPLIES,
        description: `E2E filler ${token} ${String(index)}`,
        amount: 10 + index,
      }),
    ),
  );
  await signInAs(page, request, manager);

  // The page: title, table name and the rows of the window newest first. The earlier runs keep their rows in the shared
  // database, so the view is 100 a page and every row is judged against the response it was drawn from.
  const first = await openList(page, '/admin/expenses?size=100');
  await expect(page.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
  await expect(page).toHaveTitle('Company Expenses · CSPS Admin');
  await expect(page.getByRole('table', { name: 'Company expenses' })).toBeAttached();
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Company Expenses');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(first.items.length);
  const soonRow = rows.filter({ hasText: soon });
  await expect(soonRow).toHaveCount(1);
  await expect(soonRow).toContainText('Upcoming');
  await expect(soonRow).toContainText('Rent');
  await expect(soonRow).toContainText('₱1,250.50');
  await expect(soonRow).toContainText('E2E Staff');

  // D-23: a row is Upcoming exactly when its date is after the server's today, never by the device clock.
  const flags = (await rows.allTextContents()).map((text) => text.includes('Upcoming'));
  expect(flags).toEqual(first.items.map((item) => item.date > first.today));
  expect(first.items.some((item) => item.date <= first.today)).toBe(true);

  // Core Value: the footer shows the server's figures for every page, not the rows on screen.
  const foot = page.locator('tfoot');
  await expect(foot.locator('td[data-label="Total"]')).toHaveText(peso(first.periodTotal));
  await expect(foot).toContainText(`${String(first.total)} expense`);
  await expect(
    page.getByText('The total covers every page of this list for the filters above. Deleted expenses never count.'),
  ).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // WEB-10: page 2 by URL, with a page size of 10; the footer still shows that call's total over every page.
  const second = await openList(page, '/admin/expenses?size=10&page=2');
  expect(second.total).toBeGreaterThan(10);
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
  await expect(page.locator('tfoot td[data-label="Total"]')).toHaveText(peso(second.periodTotal));
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  await expectNoAxeViolations(page);

  // A 320 px phone: the rows become cards and nothing scrolls sideways.
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@expenses-list an Admin reaches Company Expenses too (D-25)', async ({ page, request, guard }) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await createExpense(request, {
    paidByUserId: admin.userId,
    recordedByUserId: admin.userId,
    date: manilaDate(-1),
    categoryId: SUPPLIES,
    description: `E2E admin view ${randomUUID().slice(0, 8)}`,
    amount: 75,
  });
  await signInAs(page, request, admin);

  const body = await openList(page, '/admin/expenses');
  await expect(page.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Company expenses' })).toBeAttached();
  await expect(page.locator('tfoot td[data-label="Total"]')).toHaveText(peso(body.periodTotal));
  await expectNoAxeViolations(page);
});

/** "Oct 6, 2026": a business date as the page writes it in a chip. */
function chipDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A word no other run has used, letters only: it is a staff member's first name, so searching it finds only this run's rows. */
function uniqueWord(): string {
  const letters = Array.from(randomUUID().replaceAll('-', '').slice(0, 8), (digit) =>
    String.fromCharCode(97 + Number.parseInt(digit, 16)),
  );
  return `Zq${letters.join('')}`;
}

/** Starts waiting for a list answer whose request passes the check (start it before the action that causes the request). */
function listAnswer(page: Page, matches: (url: URL) => boolean): Promise<ListBody> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && isListUrl(response.url()) && matches(new URL(response.url())),
  );
  return answered.then(async (response) => {
    const body: unknown = await response.json();
    if (!isListBody(body)) {
      throw new Error('GET /api/v1/company-expenses returned an unexpected body.');
    }
    return body;
  });
}

test('@expenses-filters search by a payer, filter by category and dates, chips and rows match, Back restores the view', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const word = uniqueWord();
  const payer = await createStaff(request, 'Admin', undefined, { firstName: word, lastName: 'Payer' });
  const payerName = `${word} Payer`;
  // Twelve rows for this payer, newest first, two to thirteen days back: the even ones Supplies, the odd ones Rent.
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      createExpense(request, {
        paidByUserId: payer.userId,
        recordedByUserId: manager.userId,
        date: manilaDate(-2 - index),
        categoryId: index % 2 === 0 ? SUPPLIES : RENT,
        description: `E2E filter ${word} ${String(index)}`,
        amount: 100 + index,
      }),
    ),
  );
  await signInAs(page, request, manager);

  await openList(page, '/admin/expenses?size=10');
  const rows = page.locator('tbody tr');
  const pagination = page.getByRole('navigation', { name: 'Pagination' });

  // Search by the payer's name: the URL, the chip and the rows follow the server's answer.
  const searched = listAnswer(page, (url) => url.searchParams.get('q') === word);
  await page.getByPlaceholder('Description or staff name').fill(word);
  const bySearch = await searched;
  expect(bySearch.total).toBe(12);
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();
  await expect(rows).toHaveCount(bySearch.items.length);
  await expect(rows.filter({ hasText: payerName })).toHaveCount(bySearch.items.length);
  expect(new URL(page.url()).searchParams.get('q')).toBe(word);

  // Page 2 pushes an entry; Back brings page 1 with the search and its rows.
  const second = listAnswer(page, (url) => url.searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Next page' }).click();
  expect((await second).items).toHaveLength(2);
  await expect(pagination).toContainText('Page 2 of 2');
  await page.goBack();
  await expect(pagination).toContainText('Page 1 of 2');
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();
  await expect(rows).toHaveCount(10);

  // A category: only this payer's Supplies rows remain.
  const byCategory = listAnswer(page, (url) => url.searchParams.get('category') === SUPPLIES);
  await page.getByRole('combobox', { name: 'Category' }).selectOption({ label: 'Supplies' });
  const supplies = await byCategory;
  expect(supplies.total).toBe(6);
  await expect(page.getByText('Category: Supplies')).toBeVisible();
  await expect(rows).toHaveCount(6);
  await expect(rows.filter({ hasText: 'Supplies' })).toHaveCount(6);

  // A custom range: it applies once both dates are valid; three of the six Supplies rows fall inside it.
  const from = manilaDate(-9);
  const to = manilaDate(-3);
  await page.getByLabel('From', { exact: true }).fill(from);
  const ranged = listAnswer(page, (url) => url.searchParams.get('from') === from && url.searchParams.get('to') === to);
  await page.getByLabel('To', { exact: true }).fill(to);
  const inRange = await ranged;
  expect(inRange.total).toBe(3);
  expect(inRange.items.every((item) => item.date >= from && item.date <= to)).toBe(true);
  await expect(page.getByText(`Dates: ${chipDate(from)} to ${chipDate(to)}`)).toBeVisible();
  await expect(rows).toHaveCount(3);
  await expect(page.locator('tfoot td[data-label="Total"]')).toHaveText(peso(inRange.periodTotal));
  await expectNoAxeViolations(page);

  // Leave and come Back: the search, category, dates and rows are all in the URL.
  await page.goto('/admin/profile');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const restored = listAnswer(
    page,
    (url) => url.searchParams.get('q') === word && url.searchParams.get('from') === from,
  );
  await page.goBack();
  const again = await restored;
  expect(again.total).toBe(3);
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();
  await expect(page.getByText('Category: Supplies')).toBeVisible();
  await expect(page.getByText(`Dates: ${chipDate(from)} to ${chipDate(to)}`)).toBeVisible();
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(from);
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(to);
  await expect(rows).toHaveCount(3);
  await expectNoAxeViolations(page);

  // No matches, then Clear Filters: back to the server's default window, Rows per page kept.
  const none = listAnswer(page, (url) => url.searchParams.get('q') === `${word}-none`);
  await page.getByPlaceholder('Description or staff name').fill(`${word}-none`);
  await none;
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  await expectNoAxeViolations(page);
  const cleared = listAnswer(
    page,
    (url) => !url.searchParams.has('q') && !url.searchParams.has('category') && !url.searchParams.has('from'),
  );
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  const defaults = await cleared;
  const search = new URL(page.url()).searchParams;
  expect([...search.keys()]).toEqual(['size']);
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(defaults.from);
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(defaults.to);
  await expect(page.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('10');
  await expect(page.getByText(/^(Search|Category|Dates):/)).toHaveCount(0);
  await expectNoAxeViolations(page);
});

interface MonthBody {
  readonly month: string;
  readonly total: number;
  readonly count: number;
}

interface KpisBody {
  readonly thisMonth: MonthBody;
  readonly lastMonth: MonthBody;
  readonly topCategory: {
    readonly category: { readonly name: string };
    readonly total: number;
    readonly sharePercent: number;
  } | null;
}

function isMonthBody(value: unknown): value is MonthBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'month' in value &&
    typeof value.month === 'string' &&
    'total' in value &&
    typeof value.total === 'number' &&
    'count' in value &&
    typeof value.count === 'number'
  );
}

function isTopCategory(value: unknown): value is NonNullable<KpisBody['topCategory']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'category' in value &&
    typeof value.category === 'object' &&
    value.category !== null &&
    'name' in value.category &&
    typeof value.category.name === 'string' &&
    'total' in value &&
    typeof value.total === 'number' &&
    'sharePercent' in value &&
    typeof value.sharePercent === 'number'
  );
}

function isKpisBody(value: unknown): value is KpisBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'thisMonth' in value &&
    isMonthBody(value.thisMonth) &&
    'lastMonth' in value &&
    isMonthBody(value.lastMonth) &&
    'topCategory' in value &&
    (value.topCategory === null || isTopCategory(value.topCategory))
  );
}

/** "Oct": the short month name of a first-of-month date, in English, from the server's own month field. */
function monthName(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

/** The card that holds an overline label (the label sits in the card's head). */
function kpiCard(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('xpath=../..');
}

test('@expenses-kpis the three cards match the KPI answer the page received, and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  // One expense today, so this month holds at least one entry whatever the shared database held before.
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(0),
    categoryId: SUPPLIES,
    description: `E2E kpi ${randomUUID().slice(0, 8)}`,
    amount: 42.5,
  });
  await signInAs(page, request, manager);

  const answered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/company-expenses/kpis' && response.request().method() === 'GET',
  );
  await page.goto('/admin/expenses');
  const body: unknown = await (await answered).json();
  if (!isKpisBody(body)) {
    throw new Error('GET /api/v1/company-expenses/kpis returned an unexpected body.');
  }

  // Core Value: the cards show the server's figures and the server's month names, nothing recomputed in the browser.
  const thisMonth = kpiCard(page, `This month · ${monthName(body.thisMonth.month)}`);
  await expect(thisMonth).toContainText(peso(body.thisMonth.total));
  await expect(thisMonth).toContainText(
    body.thisMonth.count === 1 ? '1 entry so far' : `${String(body.thisMonth.count)} entries so far`,
  );
  const lastMonth = kpiCard(page, `Last month · ${monthName(body.lastMonth.month)}`);
  await expect(lastMonth).toContainText(peso(body.lastMonth.total));
  await expect(lastMonth).toContainText('Full month');
  expect(body.thisMonth.count).toBeGreaterThan(0);
  expect(body.topCategory).not.toBeNull();
  if (body.topCategory !== null) {
    const top = kpiCard(page, `Top category · ${monthName(body.thisMonth.month)}`);
    await expect(top).toContainText(body.topCategory.category.name);
    await expect(top).toContainText(
      `${peso(body.topCategory.total)} · ${String(body.topCategory.sharePercent)}% of this month`,
    );
  }

  // The KPI row sits above the toolbar, and the page still fits a 320 px phone with the row in one column.
  const rowTop = (await thisMonth.boundingBox())?.y ?? 0;
  const toolbarTop = (await page.getByRole('search').boundingBox())?.y ?? 0;
  expect(rowTop).toBeLessThan(toolbarTop);
  await expectNoAxeViolations(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(thisMonth).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
