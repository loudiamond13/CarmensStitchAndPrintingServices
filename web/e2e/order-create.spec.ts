// Creating an order end to end (ORD-03, ORD-15; plan 08-13), in all five projects. A signed-in Manager fills the New Order form,
// saves, and lands on the new order's page with the toast and the server's own total. Every test runs under the shared guard
// (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// finds its own order by a unique customer name.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { createStaff } from './testing-api.ts';

test('@orders-create a Manager creates an order with one item and lands on its page with the server total', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const customer = `E2E Create ${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  await signInAs(page, request, manager);

  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await expect(page).toHaveTitle('New Order · CSPS Admin');
  await expect(page.getByText('Image uploads are coming soon.')).toBeVisible();
  await expect(page.getByLabel(/^Status/)).toHaveValue('pending');

  await page.getByLabel(/^Customer name/).fill(customer);
  await page.getByLabel(/^Team \/ organization/).fill('E2E Create Team');
  await page.getByLabel(/^Contact number/).fill('0917 000 0000');
  await page.getByLabel(/^Due date/).fill(manilaDate(5));
  await page.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await page.getByLabel(/^Description/).fill('E2E create jersey');
  await page.getByLabel(/^Qty/).fill('12');
  await page.getByLabel(/^Unit price/).fill('780');

  await page.getByRole('button', { name: 'Save Order' }).click();

  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: /^ORD-\d{4}-\d{4,}$/ })).toBeVisible();
  await expect(page.getByText(/E2E Create Team · E2E Create \w+ · Ordered /)).toBeVisible();
  await expect(page.getByText('Order saved')).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');
  const items = page.getByRole('table', { name: 'Order items' });
  await expect(items).toContainText('E2E create jersey');
  await expect(items).toContainText('Items subtotal · 12 pcs');
});
