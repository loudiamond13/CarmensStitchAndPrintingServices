// Company Expenses end to end (CEXP-01, D-23, D-25, WEB-10; plan 06-04), in all five projects. A signed-in Manager sees the
// seeded expenses of the server's window with "Upcoming" on a future one, the footer total equals the API's periodTotal, page 2
// opens from the URL, and the page fits a 320 px phone with no axe findings; a signed-in Admin reaches the page too. The shared
// CSPS_E2E database keeps the expenses earlier runs made, so each check finds its own rows by a unique description and
// compares the footer with the response it just read, never with a fixed number. Every test runs under the shared guard
// (console, page errors, CSP, failed responses).
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
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(
      (item: unknown) => typeof item === 'object' && item !== null && 'date' in item && typeof item.date === 'string',
    )
  );
}

/** Opens a Company Expenses URL and returns what the list call answered. */
async function openList(page: Page, path: string): Promise<ListBody> {
  const listed = page.waitForResponse(
    (response) => response.url().includes('/api/v1/company-expenses') && response.request().method() === 'GET',
  );
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
