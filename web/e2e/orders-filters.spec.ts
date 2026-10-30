// Find an order end to end (ORD-02, WEB-10, D-42, D-43, D-59, UIC-2; plan 08-09), in all five projects. A signed-in Manager
// searches the orders of one unique team, narrows them with the status, the balance box, a sort and a date range, opens an
// order and comes Back to the same view, tries a custom range, meets No matches and clears every filter. The shared CSPS_E2E
// database keeps what earlier runs made, so every check finds its own orders by a unique team word and compares the page with
// the response it just read. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, uniqueWord } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

interface ListBody {
  readonly total: number;
  /** The business today the server used. */
  readonly today: string;
  readonly items: readonly { readonly number: string }[];
}

function isListBody(value: unknown): value is ListBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total' in value &&
    typeof value.total === 'number' &&
    'today' in value &&
    typeof value.today === 'string' &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(
      (item: unknown) =>
        typeof item === 'object' && item !== null && 'number' in item && typeof item.number === 'string',
    )
  );
}

/** True for the list route only. */
function isListUrl(url: string): boolean {
  return new URL(url).pathname === '/api/v1/orders';
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
      throw new Error('GET /api/v1/orders returned an unexpected body.');
    }
    return body;
  });
}

/** "Oct 1, 2026": a date as the Dates chip words it. */
function chipDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

test('@orders-filters search by team, narrow by status, balance, sort and dates, Back restores the view, Clear Filters resets it', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const word = uniqueWord();
  const team = `${word} Ballers`;
  const run = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  const numberOf = (index: number): string => `ORD-2093-${run}${index.toString(36).toUpperCase()}`;

  // Twelve orders for one team. 0 is Delivered and unpaid, due in 20 days; 1 is Delivered and paid in full; 2 is Delivered and
  // unpaid, ordered 60 days ago and due sooner than 0; 3 to 11 are Pending and unpaid.
  const seed = (index: number): Promise<string> => {
    const delivered = index <= 2;
    const paid = index === 1;
    return createOrder(request, {
      number: numberOf(index),
      status: delivered ? 'delivered' : 'pending',
      customerName: `E2E Filter ${String(index)}`,
      teamName: team,
      orderDate: index === 2 ? manilaDate(-60) : manilaDate(-1),
      dueDate: index === 2 ? manilaDate(5) : manilaDate(20),
      items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E jersey', quantity: 5, unitPrice: 500 }],
      ...(paid
        ? {
            payments: [
              {
                paymentDate: manilaDate(0),
                amount: 2500,
                paymentMethodId: CASH_ID,
                receivedByUserId: manager.userId,
              },
            ],
          }
        : {}),
    });
  };
  const ids = await Promise.all(Array.from({ length: 12 }, (_, index) => seed(index)));
  await signInAs(page, request, manager);

  const cards = page.getByRole('article');
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  const searchBox = page.getByPlaceholder('Order no., customer, team or phone');

  const first = listAnswer(page, () => true);
  await page.goto('/admin/orders?size=10');
  await first;
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();

  // Search by the team word: the URL, the chip, the result bar and the cards follow the server's answer.
  const searched = listAnswer(page, (url) => url.searchParams.get('q') === word);
  await searchBox.fill(word);
  const bySearch = await searched;
  expect(bySearch.total).toBe(12);
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();
  await expect(page.getByText(/^Showing/)).toHaveText('Showing 12 orders · sorted by due date');
  await expect(cards).toHaveCount(10);
  await expect(pagination).toContainText('Page 1 of 2');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(word);

  // Page 2 pushes an entry; Back brings page 1 with the search.
  const second = listAnswer(page, (url) => url.searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Next page' }).click();
  expect((await second).items).toHaveLength(2);
  await expect(pagination).toContainText('Page 2 of 2');
  await page.goBack();
  await expect(pagination).toContainText('Page 1 of 2');
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();

  // Status Delivered: three orders, back on page 1.
  const delivered = listAnswer(page, (url) => url.searchParams.get('status') === 'delivered');
  await page.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Delivered' });
  expect((await delivered).total).toBe(3);
  await expect(page.getByText('Status: Delivered')).toBeVisible();
  await expect(cards).toHaveCount(3);

  // Only orders with a balance: the paid one leaves. The soonest due comes first (order 2, due in 5 days).
  const owing = listAnswer(page, (url) => url.searchParams.get('hasBalance') === 'true');
  await page.getByRole('checkbox', { name: 'Only orders with a balance' }).check();
  const owingBody = await owing;
  expect(owingBody.items.map((item) => item.number)).toEqual([numberOf(2), numberOf(0)]);
  await expect(page.getByText('Has a balance', { exact: true })).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText(numberOf(2));

  // Newest first: the list keeps the server's order (order 0 was placed 59 days after order 2).
  const newest = listAnswer(page, (url) => url.searchParams.get('sort') === 'newest');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Newest first' });
  expect((await newest).items.map((item) => item.number)).toEqual([numberOf(0), numberOf(2)]);
  await expect(cards.first()).toContainText(numberOf(0));
  await expect(page.getByText(/^Showing/)).toHaveText('Showing 2 orders · sorted by newest first');

  // Last 30 days is worked out from the server's business today: order 2 (60 days old) leaves.
  const thirty = listAnswer(page, (url) => url.searchParams.has('from'));
  await page.getByRole('combobox', { name: 'Order date' }).selectOption({ label: 'Last 30 days' });
  const thirtyBody = await thirty;
  expect(thirtyBody.items.map((item) => item.number)).toEqual([numberOf(0)]);
  await expect(page.getByText('Dates: Last 30 days')).toBeVisible();
  await expect(cards).toHaveCount(1);
  // The URL is written a moment after the screen changes (the browser limits how fast the address may change).
  await expect.poll(() => new URL(page.url()).searchParams.get('dates')).toBe('30d');
  expect(new URL(page.url()).searchParams.has('from')).toBe(false);
  await expectNoAxeViolations(page);

  // Open the order and come Back: the same filters, the same result.
  await cards
    .first()
    .getByRole('button', { name: `View order ${numberOf(0)}`, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${ids[0] ?? ''}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/orders\?/);
  const restored = new URL(page.url()).searchParams;
  expect(restored.get('q')).toBe(word);
  expect(restored.get('status')).toBe('delivered');
  expect(restored.get('hasBalance')).toBe('true');
  expect(restored.get('sort')).toBe('newest');
  expect(restored.get('dates')).toBe('30d');
  await expect(page.getByText(`Search: ${word}`)).toBeVisible();
  await expect(page.getByText('Status: Delivered')).toBeVisible();
  await expect(page.getByText('Has a balance', { exact: true })).toBeVisible();
  await expect(page.getByText('Dates: Last 30 days')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('newest');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(numberOf(0));

  // A custom range applies once both dates are real: 90 to 30 days back holds order 2 only.
  const from = manilaDate(-90);
  const to = manilaDate(-30);
  await page.getByRole('combobox', { name: 'Order date' }).selectOption({ label: 'Custom range…' });
  await page.getByLabel('From', { exact: true }).fill(from);
  const ranged = listAnswer(page, (url) => url.searchParams.get('from') === from && url.searchParams.get('to') === to);
  await page.getByLabel('To', { exact: true }).fill(to);
  expect((await ranged).items.map((item) => item.number)).toEqual([numberOf(2)]);
  await expect(page.getByText(`Dates: ${chipDate(from)} to ${chipDate(to)}`)).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(numberOf(2));
  await expectNoAxeViolations(page);

  // No matches, then Clear Filters: the search and every filter go; the sort stays.
  const none = listAnswer(page, (url) => url.searchParams.get('q') === `${word}-none`);
  await searchBox.fill(`${word}-none`);
  await none;
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  await expectNoAxeViolations(page);
  const cleared = listAnswer(
    page,
    (url) => !url.searchParams.has('q') && !url.searchParams.has('from') && url.searchParams.get('status') === 'active',
  );
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await cleared;
  await expect.poll(() => [...new URL(page.url()).searchParams.keys()].sort()).toEqual(['size', 'sort']);
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('newest');
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('active');
  await expect(page.getByRole('combobox', { name: 'Order date' })).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Only orders with a balance' })).not.toBeChecked();
  await expect(page.getByText(/^(Search|Status|Dates|Product):/)).toHaveCount(0);
  await expect(page.getByText('Has a balance', { exact: true })).toHaveCount(0);
  await expectNoAxeViolations(page);
});
