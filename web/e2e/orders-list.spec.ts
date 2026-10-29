// The Orders list end to end (ORD-01, ORD-11, ORD-12, D-41, D-61; plan 08-06), in all five projects. A signed-in Manager opens
// /admin/orders and sees an order seeded through the Testing API as a card with its number, pieces and Total, the subline
// counts come from the list response, and nothing on the page shows an expense or profit figure. Every test runs under the
// shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each
// check finds its own order by a unique number and compares the page with the response it just read.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** "₱9,360.00": the figure as the page shows money (no float arithmetic, only formatting). */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ListRow {
  readonly number: string;
  readonly pieces: number;
  readonly total: number;
}

interface ListBody {
  readonly allOrders: number;
  readonly activeOrders: number;
  readonly today: string;
  readonly items: readonly ListRow[];
}

function isListRow(value: unknown): value is ListRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'number' in value &&
    typeof value.number === 'string' &&
    'pieces' in value &&
    typeof value.pieces === 'number' &&
    'total' in value &&
    typeof value.total === 'number'
  );
}

function isListBody(value: unknown): value is ListBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'allOrders' in value &&
    typeof value.allOrders === 'number' &&
    'activeOrders' in value &&
    typeof value.activeOrders === 'number' &&
    'today' in value &&
    typeof value.today === 'string' &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(isListRow)
  );
}

/** True for the list route only. */
function isListUrl(url: string): boolean {
  return new URL(url).pathname === '/api/v1/orders';
}

/** Opens an Orders URL and returns what the list call answered. */
async function openList(page: Page, path: string): Promise<ListBody> {
  const listed = page.waitForResponse((response) => isListUrl(response.url()) && response.request().method() === 'GET');
  await page.goto(path);
  const body: unknown = await (await listed).json();
  if (!isListBody(body)) {
    throw new Error('GET /api/v1/orders returned an unexpected body.');
  }
  return body;
}

/** "1 order" or "n orders", with en-US thousands: the subline words of the page. */
function ordersWord(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'order' : 'orders'}`;
}

test('@orders-list a Manager lands on Orders and sees a seeded order as a card with its number, pieces and Total', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2091-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // Due long ago, so the default "soonest due first" puts it on the first page whatever else the database holds.
  await createOrder(request, {
    number,
    customerName: 'E2E Orders Customer',
    teamName: 'E2E Orders Team',
    orderDate: '2000-01-01',
    dueDate: '2000-01-02',
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  // D-61: /admin lands on Orders. The first list answer of the visit is what the page draws.
  const landed = page.waitForResponse((response) => isListUrl(response.url()) && response.request().method() === 'GET');
  await page.goto('/admin');
  const first: unknown = await (await landed).json();
  if (!isListBody(first)) {
    throw new Error('GET /api/v1/orders returned an unexpected body.');
  }
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page).toHaveTitle('Orders · CSPS Admin');
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Orders');

  // D-41: the subline counts are the response's, not the rows on screen.
  await expect(
    page.getByText(`${ordersWord(first.allOrders)} · ${first.activeOrders.toLocaleString('en-US')} active`),
  ).toBeVisible();

  // The seeded order: its card shows the number, the pieces and the server's Total.
  const body = await openList(page, '/admin/orders?size=100');
  const row = body.items.find((item) => item.number === number);
  if (row === undefined) {
    throw new Error(`The list did not return ${number}.`);
  }
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('E2E Orders Team');
  await expect(card).toContainText(`${String(row.pieces)} pcs`);
  await expect(card).toContainText(peso(row.total));
  // 2000-01-02 is long past in the server's business time: the flag names the overdue days.
  await expect(card).toContainText(/Overdue by [\d,]+ days/);

  // ORD-19, D-06, D-20, D-22: no internal figures and no status or delete control on the list.
  await expect(page.getByText(/Order Expenses|Estimated Profit/)).toHaveCount(0);
  await expect(card.getByRole('button', { name: /status|delete/i })).toHaveCount(0);

  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@orders-list an Admin reaches Orders too and a 320 px phone shows one column without sideways scroll', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  const number = `ORD-2092-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  await createOrder(request, {
    number,
    customerName: 'E2E Admin Customer',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E jersey', quantity: 5, unitPrice: 600 }],
  });
  await signInAs(page, request, admin);

  await page.setViewportSize({ width: 320, height: 800 });
  const body = await openList(page, '/admin/orders?size=100');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('article').first()).toBeVisible();
  expect(body.items.some((item) => item.number === number)).toBe(true);
  await expect(page.getByRole('article').filter({ hasText: number })).toContainText('5 days left');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
