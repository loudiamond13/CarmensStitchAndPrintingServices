// The dashboard header end to end (DASH-01, DASH-06; plan 10-07), in all five projects. A fresh signed-in Manager or Admin lands
// on /admin and sees "Good {part}, {first name}" and the business date from the server, with View Orders and New Order, and no
// dev preview. Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database
// holds what other specs made, so nothing here asserts a shop-wide figure (RESEARCH Pitfall 11).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { dashboardHeading, signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test, type Guard } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, CASH_ID, createOrder, createStaff } from './testing-api.ts';

/** "Wednesday, Nov 4, 2026 · Here's how the shop is doing this month." */
const SUBLINE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]{2} \d{1,2}, \d{4} · Here's how the shop is doing this month\.$/;

test('@dashboard a Manager signs in and lands on the dashboard with the greeting, the date and the two actions, clean in Blush and Espresso', async ({
  page,
  request,
  guard,
}) => {
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Manager'));

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(dashboardHeading(user));
  await expect(page).toHaveTitle('Dashboard · CSPS Admin');
  await expect(page.getByText(SUBLINE)).toBeVisible();
  await expect(page.getByText('Development only. This screen is built in a later phase.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View Orders' })).toHaveAttribute('href', '/admin/orders');
  await expect(page.getByRole('link', { name: 'New Order' })).toHaveAttribute('href', '/admin/orders/new');
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Dashboard');

  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'light');
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'dark');
  await expectNoAxeViolations(page);
});

test('@dashboard an Admin lands on the dashboard too, and View Orders opens the Orders page in the same document', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Admin'));
  await expect(page.locator('h1')).toHaveText(dashboardHeading(user));
  await page.evaluate(`window.cspsSameDocument = true`);

  await page.getByRole('link', { name: 'View Orders' }).click();

  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.locator('h1')).toHaveText('Orders');
  expect(await page.evaluate(`window.cspsSameDocument === true`), 'the router handled the link').toBe(true);
});

/** What a phone shows of the KPI row: the page width and, per card, how wide the figure is against the room it has. */
interface KpiFit {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly figures: readonly { readonly text: string; readonly needs: number; readonly has: number }[];
}

const READ_KPI_FIT = `(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  figures: Array.from(document.querySelectorAll('[data-kpi-value]'), (value) => ({
    text: value.textContent ?? '',
    needs: value.scrollWidth,
    has: value.clientWidth,
  })),
}))()`;

/** The money figures of the summary answer this file pins. */
interface DashboardSummary {
  collected: { thisMonth: number | string };
  expenses: { thisMonth: number | string };
  orders: { receivables: number | string };
}

const SIX_DIGITS = '126450.00';

/** Seeds a payment of 126,450.00 this month (a six-digit Collected figure), opens the dashboard at 320px and reads the KPI fit. */
async function openPhoneDashboard(page: Page, request: APIRequestContext, guard: Guard): Promise<KpiFit> {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const today = manilaDate(0);
  await createOrder(request, {
    number: `ORD-2092-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
    orderDate: today,
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E jersey', quantity: 1, unitPrice: 126_450 }],
    payments: [{ paymentDate: today, amount: 126_450, paymentMethodId: CASH_ID, receivedByUserId: manager.userId }],
  });
  // The money figures are shop-wide, and other specs seed payments and expenses of 1,000,000 into the same database, so by
  // the last project they reach billions. The server's answer is kept, with each money figure set to the six-digit amount.
  await page.route('**/api/v1/dashboard/summary', async (route) => {
    const response = await route.fetch();
    const summary = (await response.json()) as DashboardSummary;
    summary.collected.thisMonth = SIX_DIGITS;
    summary.expenses.thisMonth = SIX_DIGITS;
    summary.orders.receivables = SIX_DIGITS;
    await route.fulfill({ response, json: summary });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await signInAs(page, request, manager);
  await expect(page.getByRole('status').filter({ hasText: 'The shop figures loaded.' })).toBeAttached();
  return page.evaluate<KpiFit>(READ_KPI_FIT);
}

// D-107: at 420px and below the four cards sit in one column, so a six-digit Collected figure never makes the page scroll sideways.
test('@dashboard the dashboard does not scroll sideways at 320px with a six-digit Collected figure', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  const fit = await openPhoneDashboard(page, request, guard);

  expect(fit.figures).toHaveLength(4);
  expect(fit.scrollWidth, 'horizontal scroll').toBeLessThanOrEqual(fit.innerWidth);
});

// D-107: the one-column row gives each figure the full card width, so none spills into the card padding.
test('@dashboard every KPI figure fits inside its card at 320px with a six-digit Collected figure', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  const fit = await openPhoneDashboard(page, request, guard);

  expect(fit.figures).toHaveLength(4);
  const tooWide = fit.figures.filter((figure) => figure.needs > figure.has);
  expect(tooWide, 'figures wider than their card').toEqual([]);
});

/** A control's drawn height and the height of its invisible ::before tap area. */
interface TapSizes {
  readonly drawn: number;
  readonly area: number;
}

/** Page function for `locator.evaluate`: self-contained, taking only the parts of the element it reads. */
const readTapSizes = (element: {
  getBoundingClientRect(): { height: number };
  ownerDocument: { defaultView: { getComputedStyle(target: unknown, pseudo: string): { height: string } } | null };
}): TapSizes => ({
  drawn: element.getBoundingClientRect().height,
  area: Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element, '::before').height ?? ''),
});

// UI-01: the strip's Transfer and View Ledger stay 36px drawn, inside an invisible 44px tap area (the ::before box).
test("@dashboard the money strip's Transfer and View Ledger have a 44px tap area", async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const strip = page.getByRole('region', { name: 'Your money on hand' });
  await expect(strip.getByRole('button', { name: 'Transfer' })).toBeVisible();

  for (const control of [
    strip.getByRole('button', { name: 'Transfer' }),
    strip.getByRole('link', { name: 'View Ledger' }),
  ]) {
    const sizes = await control.evaluate(readTapSizes);
    expect(sizes.drawn, 'the drawn height').toBeCloseTo(36, 0);
    expect(sizes.area, 'the tap area height').toBeGreaterThanOrEqual(44);
  }
});
