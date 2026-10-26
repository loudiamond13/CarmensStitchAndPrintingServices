// Company Expenses end to end (CEXP-01, D-23, D-25, WEB-10; plan 06-04), in all five projects. A signed-in Manager sees the
// seeded expenses of the server's window with "Upcoming" on a future one, the footer total equals the API's periodTotal, page 2
// opens from the URL, and the page fits a 320 px phone with no axe findings; a signed-in Admin reaches the page too. The shared
// CSPS_E2E database keeps the expenses earlier runs made, so each check finds its own rows by a unique description and
// compares the footer with the response it just read, never with a fixed number. Every test runs under the shared guard
// (console, page errors, CSP, failed responses). @expenses-filters (plan 06-07) searches by a new payer, filters by category and a
// custom range, reopens the same view with Back, and clears the filters. @expenses-kpis (plan 06-09) compares the three month cards with the KPI
// response the page received. @expenses-add (plan 06-12) adds an expense as an Admin with the defaults, refuses an amount of 0 and 1,000,000.01 in the
// browser with no request, fits the modal on a 320 px phone and finds the new row. @expenses-edit (plan 06-14) edits an amount from
// the row, meets the stale-save banner from a second page, shows an Admin View on a coworker's row and Edit on their own, and fits
// the Edit modal on a 320 px phone. @expenses-delete (plan 06-16) deletes, restores and permanently deletes expenses as a Manager
// (the row and its amount leave the list and the total), checks an Admin sees no delete action and is sent back from the deleted
// page, and fits both confirmations on a 320 px phone.
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL, press, RENT, SUPPLIES, uniqueWord } from './helpers.ts';
import { createExpense, createStaff } from './testing-api.ts';

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

// --- @expenses-add (plan 06-12) ---

function addExpenseButton(page: Page) {
  return page.getByRole('button', { name: 'Add Expense' }).first();
}

test('@expenses-add an Admin adds an expense with the defaults, bad amounts are refused in the browser, the modal fits a 320 px phone and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const admin = await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Add${token}` });
  const fullName = `Ana Add${token}`;
  await signInAs(page, request, admin);
  // Every create the page sends: none may go out while a rule fails in the browser.
  const posts: string[] = [];
  page.on('request', (sent) => {
    if (sent.method() === 'POST' && isListUrl(sent.url())) {
      posts.push(sent.url());
    }
  });
  const list = await openList(page, '/admin/expenses?size=100');

  // Opened from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved.
  await addExpenseButton(page).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add Expense' });
  await expect(dialog).toBeVisible();
  const date = dialog.getByLabel(/^Date/);
  await expect(date).toBeFocused();
  await expect(date).toHaveValue(list.today);
  const paidBy = dialog.getByRole('combobox', { name: /^Paid by/ });
  await expect(paidBy).toBeEnabled();
  await expect(paidBy).toHaveValue(admin.userId);
  await expect(paidBy.locator('option').first()).toHaveText(`${fullName} (you)`);
  await expect(dialog.getByRole('combobox', { name: /^Category/ })).toHaveValue('');
  await expect(dialog.getByText('Recorded by', { exact: true }).locator('xpath=following-sibling::span')).toContainText(
    `${fullName} (you)`,
  );
  await expectNoAxeViolations(page);

  // A blank form and two bad amounts are refused in the browser, with the exact words and no request.
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog.getByText('Choose a category.')).toBeVisible();
  await expect(dialog.getByText('Enter an amount greater than ₱0.00.')).toBeVisible();
  await expectNoAxeViolations(page);
  const description = `E2E add ${token}`;
  await dialog.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Supplies' });
  await dialog.getByRole('textbox', { name: /^Description/ }).fill(description);
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill('0');
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog.getByText('Enter an amount greater than ₱0.00.')).toBeVisible();
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill('1000000.01');
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog.getByText('Enter an amount of ₱1,000,000.00 or less.')).toBeVisible();
  expect(posts).toHaveLength(0);

  // The modal fits a 320 px phone: it scrolls inside, the footer stays reachable and nothing scrolls sideways.
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`,
    ),
  ).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Save Expense' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expectNoAxeViolations(page);

  // A good amount saves with Enter in Description: the dialog closes, focus is back on Add Expense and the toast reports it.
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill('640');
  await dialog.getByRole('textbox', { name: /^Description/ }).press('Enter');
  await expect(dialog).toBeHidden();
  await expect(addExpenseButton(page)).toBeFocused();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(page.getByText('₱640.00 · Supplies', { exact: true })).toBeVisible();
  expect(posts).toHaveLength(1);

  // The list read again: the new row is there, paid and recorded by the person who added it.
  await page.getByPlaceholder('Description or staff name').fill(token);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(description);
  await expect(rows.first()).toContainText('₱640.00');
  await expect(rows.first().locator('td[data-label="Paid by"]')).toContainText(fullName);
  await expect(rows.first().locator('td[data-label="Recorded by"]')).toContainText(fullName);
  await expectNoAxeViolations(page);
});

// --- @expenses-edit (plan 06-14) ---

/** Finds one expense by its unique description with Search and returns its row. */
async function findRow(page: Page, token: string) {
  await page.getByPlaceholder('Description or staff name').fill(token);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  return rows.first();
}

/** The value beside a RecordMeta term, like "Last changed by". */
function recordMetaValue(dialog: Locator, term: string) {
  return dialog.getByText(term, { exact: true }).locator('xpath=following-sibling::dd');
}

/** Finds one expense by its token and opens its Edit modal from the keyboard (Safari does not focus a button on click). */
async function openEdit(page: Page, token: string) {
  const row = await findRow(page, token);
  const edit = row.getByRole('button', { name: new RegExp(`^Edit E2E edit ${token}, `) });
  await edit.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit Expense' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Date/)).toBeFocused();
  return { dialog, edit };
}

test('@expenses-edit a Manager edits an amount from the row: the toast and the new row show it, focus returns to Edit, and Last changed by names the Manager', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Edit${token}` });
  const fullName = `Mira Edit${token}`;
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: SUPPLIES,
    description: `E2E edit ${token}`,
    amount: 640,
    notes: 'Bought in bulk',
  });
  await signInAs(page, request, manager);
  await openList(page, '/admin/expenses');

  const { dialog, edit } = await openEdit(page, token);
  await expect(dialog.getByRole('textbox', { name: /^Description/ })).toHaveValue(`E2E edit ${token}`);
  await expect(dialog.getByRole('textbox', { name: /^Amount/ })).toHaveValue('640.00');
  await expect(dialog.getByRole('textbox', { name: /^Notes/ })).toHaveValue('Bought in bulk');
  await expect(dialog.getByRole('combobox', { name: /^Category/ }).locator('option:checked')).toHaveText('Supplies');
  await expect(dialog.getByRole('combobox', { name: /^Paid by/ }).locator('option:checked')).toHaveText(
    `${fullName} (you)`,
  );
  await expect(recordMetaValue(dialog, 'Recorded by')).toContainText(fullName);
  await expect(recordMetaValue(dialog, 'Last changed by')).toHaveText('Not set');
  await expectNoAxeViolations(page);

  await dialog.getByRole('textbox', { name: /^Amount/ }).fill('700');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  // The dialog closes, focus is back on that row's Edit button, the toast reports it and the list shows the new figure.
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  await expect(page.getByText('Expense updated')).toBeVisible();
  await expect(page.getByText('₱700.00 · Supplies', { exact: true })).toBeVisible();
  const row = page.locator('tbody tr').first();
  await expect(row).toContainText('₱700.00');
  await expectNoAxeViolations(page);

  // Read fresh on this open: Last changed by now names the Manager, Recorded by is still the recorder.
  await edit.focus();
  await page.keyboard.press('Enter');
  const again = page.getByRole('dialog', { name: 'Edit Expense' });
  await expect(again.getByRole('textbox', { name: /^Amount/ })).toHaveValue('700.00');
  await expect(recordMetaValue(again, 'Last changed by')).toContainText(fullName);
  await expectNoAxeViolations(page);
});

test('@expenses-edit two pages editing the same expense: the second save shows the conflict banner with the typed value kept, and Load Latest shows the first save', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The second page's stale save is refused with a 409 (05 D-20); that is the behavior under test.
  guard.expectStatus('/api/v1/company-expenses/', 409);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: RENT,
    description: `E2E edit ${token}`,
    amount: 500,
  });
  await signInAs(page, request, manager);
  await openList(page, '/admin/expenses');

  // Both pages are the same Manager (one browser, two tabs) and open the same expense at the same version.
  const second = await page.context().newPage();
  await openList(second, '/admin/expenses');
  const first = await openEdit(page, token);
  const later = await openEdit(second, token);

  await first.dialog.getByRole('textbox', { name: /^Amount/ }).fill('510');
  await first.dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(first.dialog).toBeHidden();

  // The second page is now stale: its save keeps the typed value and offers Load Latest, which takes focus.
  const typed = later.dialog.getByRole('textbox', { name: /^Amount/ });
  await typed.fill('520');
  await later.dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(later.dialog.getByText('This was changed by someone else.')).toBeVisible();
  await expect(later.dialog.getByRole('button', { name: 'Load Latest' })).toBeFocused();
  await expect(typed).toHaveValue('520.00');
  await expectNoAxeViolations(second);

  // Load Latest brings the first save, drops the banner and puts the cursor on Date.
  await later.dialog.getByRole('button', { name: 'Load Latest' }).click();
  await expect(typed).toHaveValue('510.00');
  await expect(later.dialog.getByText('This was changed by someone else.')).toBeHidden();
  await expect(later.dialog.getByLabel(/^Date/)).toBeFocused();
  await expect(later.dialog.getByText('Latest version loaded. Make your changes again.')).toBeAttached();

  // Typing again and saving now goes through.
  await typed.fill('530');
  await later.dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(later.dialog).toBeHidden();
  await expect(second.locator('tbody tr').first()).toContainText('₱530.00');
});

test("@expenses-edit an Admin sees View on a coworker's row and reads its notes, and Edit on their own row", async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Boss${token}` });
  const admin = await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Own${token}` });
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: RENT,
    description: `E2E edit ${token} coworker`,
    amount: 800,
    notes: `Private note ${token}`,
  });
  await createExpense(request, {
    paidByUserId: admin.userId,
    recordedByUserId: admin.userId,
    date: manilaDate(-2),
    categoryId: SUPPLIES,
    description: `E2E edit ${token} own`,
    amount: 120,
  });
  await signInAs(page, request, admin);
  await openList(page, '/admin/expenses');
  await page.getByPlaceholder('Description or staff name').fill(token);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);

  // The coworker's row: View (the eye), no Edit and no delete.
  const coworker = rows.filter({ hasText: 'coworker' });
  await expect(coworker.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(coworker.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  const view = coworker.getByRole('button', { name: new RegExp(`^View E2E edit ${token} coworker, `) });
  await view.focus();
  await page.keyboard.press('Enter');
  const details = page.getByRole('dialog', { name: 'Expense details' });
  await expect(details).toBeVisible();
  await expect(details.getByText(`Private note ${token}`)).toBeVisible();
  await expect(details.getByText('₱800.00')).toBeVisible();
  await expect(recordMetaValue(details, 'Recorded by')).toContainText(`Mira Boss${token}`);
  await expect(details.getByRole('textbox')).toHaveCount(0);
  const closers = details.getByRole('button', { name: 'Close' });
  await expect(closers.last()).toBeFocused();
  await expectNoAxeViolations(page);
  await closers.last().click();
  await expect(details).toBeHidden();
  await expect(view).toBeFocused();

  // Their own row: Edit, and the edit modal opens.
  const own = rows.filter({ hasText: `E2E edit ${token} own` });
  await expect(own.getByRole('button', { name: /^View / })).toHaveCount(0);
  const edit = own.getByRole('button', { name: new RegExp(`^Edit E2E edit ${token} own, `) });
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit Expense' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Amount/ })).toHaveValue('120.00');
  await expectNoAxeViolations(page);
});

test('@expenses-edit the Edit modal fits a 320 px phone: it scrolls inside, the footer stays reachable, Recorded by is visible and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: SUPPLIES,
    description: `E2E edit ${token}`,
    amount: 75,
  });
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 320, height: 568 });
  await openList(page, '/admin/expenses');

  const { dialog } = await openEdit(page, token);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`,
    ),
  ).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();

  // Recorded by sits at the bottom of the body: scrolled into view, it is visible.
  const term = dialog.getByText('Recorded by', { exact: true });
  await term.scrollIntoViewIfNeeded();
  await expect(term).toBeVisible();
  await expect(recordMetaValue(dialog, 'Recorded by')).toBeVisible();
  await expectNoAxeViolations(page);
});

// --- @expenses-delete (plan 06-16) ---

/** The expense table's footer: it holds the server's period total for the search in use. */
function footer(page: Page) {
  return page.locator('tfoot');
}

test('@expenses-delete a Manager deletes, restores and permanently deletes expenses: the row and its amount leave the list and the total, Deleted Expenses holds the deleted one, and Restore counts it again', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Del${token}` });
  const fullName = `Mira Del${token}`;
  const names = { a: `E2E del ${token} a`, b: `E2E del ${token} b`, c: `E2E del ${token} c` };
  // Three dates, so the rows sit a, b, c from the top.
  const seeds = [
    { key: 'a', date: manilaDate(-1), amount: 100 },
    { key: 'b', date: manilaDate(-2), amount: 200 },
    { key: 'c', date: manilaDate(-3), amount: 300 },
  ] as const;
  for (const seed of seeds) {
    await createExpense(request, {
      paidByUserId: manager.userId,
      recordedByUserId: manager.userId,
      date: seed.date,
      categoryId: SUPPLIES,
      description: names[seed.key],
      amount: seed.amount,
    });
  }
  await signInAs(page, request, manager);
  await openList(page, '/admin/expenses');
  await page.getByPlaceholder('Description or staff name').fill(token);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(footer(page)).toContainText(peso(600));

  // Delete a: the plain confirmation names it and its amount, Cancel has focus, and nothing is sent until the confirm.
  const deleteA = rows.getByRole('button', { name: new RegExp(`^Delete ${names.a}, [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`) });
  await press(page, deleteA);
  const confirm = page.getByRole('dialog', { name: `Delete “${names.a}” (${peso(100)})?` });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByText(
      "It won't count in the expense list, totals or the payer's balance. You can restore it later from Deleted Expenses.",
    ),
  ).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Delete Expense' }).click();

  // The row and its amount leave the list and the total, the toast says where to restore it, and focus moves to the next row.
  await expect(confirm).toBeHidden();
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: names.a })).toHaveCount(0);
  await expect(footer(page)).toContainText(peso(500));
  await expect(page.getByText('Expense deleted', { exact: true })).toBeVisible();
  await expect(page.getByText(`${names.a}. You can restore it from Deleted Expenses.`)).toBeVisible();
  await expect(rows.first().getByRole('button', { name: new RegExp(`^Edit ${names.b}, `) })).toBeFocused();
  await expectNoAxeViolations(page);

  // Deleted Expenses: the link is there for a Manager, the page holds the deleted expense with who and when.
  await page.getByRole('link', { name: 'Deleted Expenses' }).click();
  await expect(page).toHaveURL(/\/admin\/expenses\/deleted$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toBeVisible();
  await expect(page).toHaveTitle('Deleted Expenses · CSPS Admin');
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Company Expenses');
  await page.getByPlaceholder('Description or staff name').fill(token);
  const deletedRows = page.locator('tbody tr');
  await expect(deletedRows).toHaveCount(1);
  await expect(deletedRows.first()).toContainText(names.a);
  await expect(deletedRows.first()).toContainText(peso(100));
  await expect(deletedRows.first().locator('td[data-label="Deleted by"]')).toContainText(fullName);
  await expect(deletedRows.first().locator('time')).toBeVisible();
  await expectNoAxeViolations(page);

  // Restore acts at once: the row leaves the deleted list, focus moves to the heading (the list is now empty for this search).
  await deletedRows
    .first()
    .getByRole('button', { name: new RegExp(`^Restore ${names.a}, `) })
    .click();
  await expect(page.getByText('Expense restored', { exact: true })).toBeVisible();
  await expect(page.getByText(`${names.a} counts in totals again.`)).toBeVisible();
  await expect(deletedRows).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toBeFocused();
  await expectNoAxeViolations(page);

  // Back on the list the restored expense counts again.
  await page.getByRole('link', { name: 'Back to Company Expenses' }).click();
  await expect(page).toHaveURL(/\/admin\/expenses$/);
  // The address changes before the page does, and both pages have the same search box: wait for the list's own heading.
  await expect(page.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
  await page.getByPlaceholder('Description or staff name').fill(token);
  await expect(rows).toHaveCount(3);
  await expect(footer(page)).toContainText(peso(600));

  // Delete b permanently from the list: the warning says it cannot be undone, and the row and amount are gone for good.
  const purgeB = rows.getByRole('button', { name: new RegExp(`^Delete ${names.b}, .* permanently$`) });
  await press(page, purgeB);
  const warning = page.getByRole('dialog', { name: `Delete “${names.b}” (${peso(200)}) permanently?` });
  await expect(warning).toBeVisible();
  await expect(
    warning.getByText(
      "This removes the expense for good. It can't be restored, and this can't be undone. The audit log keeps its date, category, amount and payer.",
    ),
  ).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await warning.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(warning).toBeHidden();
  await expect(rows).toHaveCount(2);
  await expect(footer(page)).toContainText(peso(400));
  await expect(page.getByText('Expense permanently deleted', { exact: true })).toBeVisible();

  // Delete c, then delete it permanently from the deleted list.
  await press(
    page,
    rows.getByRole('button', { name: new RegExp(`^Delete ${names.c}, [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`) }),
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Expense' }).click();
  await expect(rows).toHaveCount(1);
  await expect(footer(page)).toContainText(peso(100));
  await page.getByRole('link', { name: 'Deleted Expenses' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toBeVisible();
  await page.getByPlaceholder('Description or staff name').fill(token);
  await expect(deletedRows).toHaveCount(1);
  await expect(deletedRows.first()).toContainText(names.c);
  await press(
    page,
    deletedRows.first().getByRole('button', { name: new RegExp(`^Delete ${names.c}, .* permanently$`) }),
  );
  const lastWarning = page.getByRole('dialog', { name: `Delete “${names.c}” (${peso(300)}) permanently?` });
  await expect(lastWarning).toBeVisible();
  await lastWarning.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(lastWarning).toBeHidden();
  await expect(deletedRows).toHaveCount(0);
  // The earlier permanent delete's toast may still show: the newest one is the last.
  await expect(page.getByText('Expense permanently deleted', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toBeFocused();
  await expectNoAxeViolations(page);
});

test('@expenses-delete an Admin sees no delete action and no Deleted Expenses link, and is sent back to the list from /admin/expenses/deleted', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Boss${token}` });
  const admin = await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Own${token}` });
  await createExpense(request, {
    paidByUserId: admin.userId,
    recordedByUserId: admin.userId,
    date: manilaDate(-1),
    categoryId: SUPPLIES,
    description: `E2E del ${token} own`,
    amount: 120,
  });
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-2),
    categoryId: RENT,
    description: `E2E del ${token} coworker`,
    amount: 800,
  });
  await signInAs(page, request, admin);
  await openList(page, '/admin/expenses');
  await page.getByPlaceholder('Description or staff name').fill(token);
  await expect(page.locator('tbody tr')).toHaveCount(2);

  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Deleted Expenses' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Expense' })).toBeVisible();
  await expectNoAxeViolations(page);

  // The route loader sends an Admin back to the list; nothing of the deleted page shows.
  await page.goto('/admin/expenses/deleted');
  await expect(page).toHaveURL(/\/admin\/expenses$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Expenses' })).toHaveCount(0);
});

test('@expenses-delete both confirmations fit a 320 px phone: the dialog scrolls inside, Cancel and the confirm button stay in view and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  const description = `E2E del ${token} ${'long description '.repeat(6)}`.trim().slice(0, 200);
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: SUPPLIES,
    description,
    amount: 75,
  });
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 320, height: 568 });
  await openList(page, '/admin/expenses');
  await page.getByPlaceholder('Description or staff name').fill(token);
  const row = page.locator('tbody tr');
  await expect(row).toHaveCount(1);

  for (const [name, confirmLabel] of [
    [/^Delete .*, [A-Z][a-z]{2} \d{1,2}, \d{4}$/, 'Delete Expense'],
    [/^Delete .* permanently$/, 'Delete Permanently'],
  ] as const) {
    await press(page, row.getByRole('button', { name }));
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
    expect(
      await page.evaluate(
        `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`,
      ),
    ).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: confirmLabel })).toBeInViewport();
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  }
});
