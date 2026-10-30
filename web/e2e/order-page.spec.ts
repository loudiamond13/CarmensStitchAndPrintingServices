// The order page end to end (ORD-07, ORD-19, D-27, D-46, D-51; plan 08-10), in all five projects. A signed-in Manager finds a seeded
// order on the list, opens it and sees the header, the server's totals with Order Expenses and Estimated Profit, the Images card
// and the Items tab; Back returns to the list as the user left it. Every test runs under the shared guard (console, page errors,
// CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check finds its own order by a
// unique number.
import { randomUUID } from 'node:crypto';
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
  await expect(page.getByRole('link', { name: 'Edit Details' })).toBeVisible();

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
