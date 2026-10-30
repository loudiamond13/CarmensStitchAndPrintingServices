// The order page end to end (ORD-07, ORD-19, D-27, D-46, D-51; plan 08-10), in all five projects. A signed-in Manager finds a seeded
// order on the list, opens it and sees the header, the server's totals with Order Expenses and Estimated Profit, the Images card
// and the Items tab; Back returns to the list as the user left it. Every test runs under the shared guard (console, page errors,
// CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check finds its own order by a
// unique number.
import { randomUUID } from 'node:crypto';
import type { Locator } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

test('@orders-page a Manager opens an order from the list and sees its header, totals with profit, images card and items', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2093-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00; a fixed 360.00 discount gives a 9,000.00 total; 4,000.00 paid leaves 5,000.00 due.
  await createOrder(request, {
    number,
    customerName: 'E2E Page Customer',
    teamName: 'E2E Page Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [
      {
        productTypeId: BASKETBALL_JERSEY_ID,
        description: 'E2E page jersey',
        quantity: 12,
        unitPrice: 780,
        sizeVariant: 'S-XL',
      },
    ],
    discounts: [{ kind: 'fixed', value: 360, reason: 'E2E page discount' }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 4000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);

  // Find the order on the list and open it from its card.
  await page.goto(`/admin/orders?q=${number}`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: `View order ${number}`, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);

  // The header: number, status, the subline and who recorded it.
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(page).toHaveTitle(`${number} · CSPS Admin`);
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/E2E Page Team · E2E Page Customer · Ordered /)).toBeVisible();
  await expect(page.getByText('5 days left')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit Details' }).first()).toBeVisible();

  // The totals are the server's, with the internal figures (ORD-19: this page only).
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');
  await expect(totals).toContainText('₱9,000.00');
  await expect(totals).toContainText('₱5,000.00');
  await expect(totals.getByText('Order Expenses')).toBeVisible();
  await expect(totals.getByText('Estimated Profit')).toBeVisible();

  // The Images card says uploads are coming (D-27); the Items tab lists the item with its subtotal footer.
  await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
  await expect(page.getByText('Image uploads are coming soon.')).toBeVisible();
  const items = page.getByRole('table', { name: 'Order items' });
  await expect(items).toContainText('E2E page jersey');
  await expect(items).toContainText('S-XL');
  await expect(items).toContainText('Items subtotal · 12 pcs');
  await expect(items).toContainText('₱9,360.00');

  // Another tab goes in the URL with a replace (WEB-10).
  await page.getByRole('tab', { name: /^Payments/ }).click();
  await expect(page).toHaveURL(/\?tab=payments$/);
  await page.getByRole('tab', { name: /^Items/ }).click();
  await expect(page).not.toHaveURL(/tab=/);

  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Back returns to the list as the user left it, with the search (D-51).
  await page.locator('main').getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page).toHaveURL(`/admin/orders?q=${number}`);
  await expect(page.getByRole('article').filter({ hasText: number })).toHaveCount(1);
});

/** The box of an element that must be on screen. */
async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('The element has no box on screen.');
  }
  return box;
}

test('@orders-page the order page lays out by screen width, with the customer card, the status history and the phone balance card', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2094-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00; a fixed 360.00 discount gives 9,000.00; 4,000.00 paid leaves 5,000.00 due.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Layout Customer',
    teamName: 'E2E Layout Team',
    contactNumber: '0917 000 0000',
    email: 'layout.customer@example.test',
    address: 'E2E Layout Street',
    notes: 'E2E layout note',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E layout jersey', quantity: 12, unitPrice: 780 }],
    discounts: [{ kind: 'fixed', value: 360, reason: 'E2E layout discount' }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 4000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);

  const strip = page.getByRole('button', { name: 'Total ₱9,000.00, balance due ₱5,000.00. Show totals.' });
  const title = page.getByRole('heading', { level: 1, name: number });
  const images = page.getByRole('heading', { level: 2, name: 'Images' });
  const tabs = page.getByRole('tablist');
  const totals = page.getByRole('region', { name: 'Totals' });
  const customer = page.getByRole('region', { name: 'Customer' });
  const history = page.getByRole('region', { name: 'Status history' });

  // Phone: the balance card sits under the header; the side follows the tab card; nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/orders/${id}`);
  await expect(title).toBeVisible();
  await expect(strip).toBeVisible();
  expect((await boxOf(strip)).y).toBeGreaterThan((await boxOf(title)).y);
  expect((await boxOf(images)).y).toBeGreaterThan((await boxOf(strip)).y);
  expect((await boxOf(totals)).y).toBeGreaterThan((await boxOf(tabs)).y);
  expect((await boxOf(customer)).y).toBeGreaterThan((await boxOf(totals)).y);
  expect((await boxOf(history)).y).toBeGreaterThan((await boxOf(customer)).y);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
  await strip.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Totals' })).toBeFocused();

  // The customer card and the history read from the order.
  await expect(customer).toContainText('E2E Layout Customer');
  await expect(customer).toContainText('E2E Layout Team');
  await expect(customer).toContainText('layout.customer@example.test');
  await expect(customer).toContainText('E2E layout note');
  await expect(history).toContainText('Created as Pending');

  // The Payments tab shows who received and who recorded the payment.
  await page.getByRole('tab', { name: /^Payments/ }).click();
  const payments = page.getByRole('table', { name: 'Payments' });
  await expect(payments).toContainText('Cash');
  await expect(payments).toContainText('₱4,000.00');
  await expect(payments).toContainText('Total paid');
  await expect(page.getByText('Downpayments and settlements.')).toContainText('Balance due: ₱5,000.00');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // A small phone: the tab strip scrolls inside itself and keeps the chosen tab in view; the page does not scroll sideways.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('tab', { name: /^Expenses/ }).click();
  const expenses = page.getByRole('tab', { name: /^Expenses/ });
  await expect
    .poll(async () => {
      const box = await boxOf(expenses);
      return box.x >= 0 && box.x + box.width <= 320;
    })
    .toBe(true);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await page.getByRole('tab', { name: /^Items/ }).click();

  // Tablet: the balance card is gone; the totals and the customer card sit side by side above the images and the tabs.
  await page.setViewportSize({ width: 820, height: 900 });
  await expect(strip).toBeHidden();
  const tabletTotals = await boxOf(totals);
  const tabletCustomer = await boxOf(customer);
  expect(tabletTotals.y + tabletTotals.height).toBeLessThanOrEqual((await boxOf(images)).y);
  expect(tabletCustomer.y + tabletCustomer.height).toBeLessThanOrEqual((await boxOf(images)).y);
  expect(tabletCustomer.x).toBeGreaterThan(tabletTotals.x);
  expect((await boxOf(history)).y).toBeGreaterThanOrEqual(tabletCustomer.y + tabletCustomer.height);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Desktop: the side sits beside the tab card.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(strip).toBeHidden();
  expect((await boxOf(totals)).x).toBeGreaterThan((await boxOf(tabs)).x + (await boxOf(tabs)).width - 1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
});
