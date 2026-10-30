// Creating an order end to end (ORD-03, ORD-15; plan 08-13), in all five projects. A signed-in Manager fills the New Order form,
// saves, and lands on the new order's page with the toast and the server's own total. Every test runs under the shared guard
// (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// finds its own order by a unique customer name.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
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
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

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

test('@orders-create leaving a half filled form asks "Discard changes?" and Keep Editing keeps the typed values', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  const orders = page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders' }).first();

  // A clean form leaves without asking.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Let the list finish loading before the next page opens, so no request is cut off.
  await expect(page.getByText(/\d+ orders? · \d+ active/)).toBeVisible();

  // A half filled form asks; Keep Editing stays with the typed values.
  await page.goto('/admin/orders/new');
  await page.getByLabel(/^Customer name/).fill('E2E Half Filled');
  await orders.click();
  const dialog = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep Editing' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/orders\/new$/);
  await expect(page.getByLabel(/^Customer name/)).toHaveValue('E2E Half Filled');

  // Asking again, Discard Changes leaves for the list.
  await orders.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page.getByText(/\d+ orders? · \d+ active/)).toBeVisible();
});

test('@orders-create on a phone a focused item field is never hidden under the save bar (D-54d)', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  for (let row = 0; row < 4; row += 1) {
    await page.getByRole('button', { name: 'Add Item' }).first().click();
  }
  const rows = page.getByRole('group', { name: /^Item \d+$/ });
  await expect(rows).toHaveCount(5);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  const bar = page.getByRole('button', { name: 'Save Order' }).locator('xpath=..');
  for (const label of [/^Description/, /^Unit price/]) {
    await rows.last().getByLabel(label).focus();
    const field = await rows.last().getByLabel(label).boundingBox();
    const barBox = await bar.boundingBox();
    expect(field).not.toBeNull();
    expect(barBox).not.toBeNull();
    if (field !== null && barBox !== null) {
      expect(field.y + field.height).toBeLessThanOrEqual(barBox.y + 1);
    }
  }
  // Each item control is 44px tall on a phone (D-54b).
  const box = await rows.first().getByLabel(/^Description/).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
