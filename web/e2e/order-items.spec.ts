// Working the items of an order end to end (ORD-07, D-28; plan 08-14), in all five projects. A signed-in Manager adds, edits and
// deletes items from the Items tab, and after each save the page shows the server's own figures. Every test runs under the shared
// guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-items a Manager adds an item and sees the new total from the server', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2095-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with nothing paid.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Items Customer',
    teamName: 'E2E Items Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E first jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');

  await page.getByRole('button', { name: 'Add Item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Item' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Items Team`);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // 10 x 500 = 5,000.00 more.
  await dialog.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await dialog.getByLabel(/^Size \/ variant/).fill('M');
  await dialog.getByLabel(/^Description/).fill('E2E second item');
  await dialog.getByLabel(/^Quantity/).fill('10');
  await dialog.getByLabel(/^Unit price/).fill('500');
  await expect(dialog.getByText('Line total: ₱5,000.00')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Item' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Item added')).toBeVisible();
  await expect(page.getByText('Balance now ₱14,360.00.')).toBeVisible();
  await expect(totals).toContainText('₱14,360.00');
  const items = page.getByRole('table', { name: 'Order items' });
  await expect(items).toContainText('E2E second item');
  await expect(items).toContainText('Items subtotal · 22 pcs');
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeFocused();
});
