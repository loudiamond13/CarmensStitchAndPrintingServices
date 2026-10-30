// The read-only deleted order end to end (ORD-06, ORD-07, D-24, D-57; plan 08-23), in all five projects. A signed-in Manager opens a
// deleted order from Deleted Orders, reads its rows and totals with no way to change them, then restores it or deletes it for good.
// Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what
// earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** A unique order number for one check. */
function uniqueNumber(year: number): string {
  return `ORD-${String(year)}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

/** Soft-deletes an order through the API as the signed-in Manager of this page, with a fresh token from its refresh cookie. */
async function deleteOrderThroughApi(page: Page, id: string): Promise<void> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${session.accessToken}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);
}

test('@orders-deleted-view a Manager opens a deleted order from Deleted Orders, sees it read-only and restores it', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = uniqueNumber(2094);
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E View Customer',
    teamName: 'E2E View Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E view jersey', quantity: 12, unitPrice: 780 }],
  });
  // The check at the end reads the restored order at its deleted address, which answers 404.
  guard.expectStatus(`/api/v1/orders/deleted/${id}`, 404);
  await signInAs(page, request, manager);
  await deleteOrderThroughApi(page, id);

  await page.goto('/admin/orders/deleted');
  const row = page.getByRole('table', { name: 'Deleted orders' }).getByRole('row').filter({ hasText: number });
  await row.getByRole('link', { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/deleted/${id}$`));

  // The order, its rows and its figures, and the banner that says it is deleted.
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(page).toHaveTitle(`${number} (deleted) · CSPS Admin`);
  await expect(page.getByText('In Production').first()).toBeVisible();
  await expect(page.getByText(/^This order was deleted on .+ by .+\.$/)).toBeVisible();
  await expect(page.getByText("It counts nowhere until it's restored.")).toBeVisible();
  const items = page.getByRole('table', { name: 'Order items' });
  await expect(items).toContainText('E2E view jersey');
  await expect(items).toContainText('₱9,360.00');
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('Order Expenses');
  await expect(totals).toContainText('Estimated Profit');

  // Nothing here changes the order.
  await expect(page.getByRole('button', { name: 'Change Status' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Details' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete Order', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record Refund' })).toHaveCount(0);

  // A tab keeps its place in the address.
  await page.getByRole('tab', { name: /^Payments/ }).click();
  await expect(page).toHaveURL(/tab=payments/);
  await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Restore goes to the live order, which counts again.
  await page.getByRole('button', { name: 'Restore Order' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${id}$`));
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(page.getByText('Order restored')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change Status' })).toBeVisible();

  // Once restored, the deleted address no longer holds the order.
  await page.goto(`/admin/orders/deleted/${id}`);
  await expect(page.getByText("This order isn't in Deleted Orders.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Deleted Orders' })).toBeVisible();
});

test('@orders-deleted-view a Manager deletes a deleted order for good from its page after typing the number', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = uniqueNumber(2093);
  const id = await createOrder(request, {
    number,
    status: 'pending',
    customerName: 'E2E Gone Customer',
    teamName: 'E2E Gone Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E gone jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);
  await deleteOrderThroughApi(page, id);

  await page.goto(`/admin/orders/deleted/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Order Permanently' }).click();
  const dialog = page.getByRole('dialog', { name: `Delete ${number} permanently?` });
  await expect(dialog).toContainText('This will also delete 1 item.');
  const confirm = dialog.getByRole('button', { name: 'Delete Order Permanently' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox', { name: `Type ${number} to confirm` }).fill(number);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL(/\/admin\/orders\/deleted$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Orders' })).toBeVisible();
  await expect(page.getByText('Order permanently deleted')).toBeVisible();
  await expect(page.getByText(number)).toHaveCount(0);
});

test('@orders-deleted-view an Admin opening a deleted order is sent back to Orders', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);

  await page.goto(`/admin/orders/deleted/${randomUUID()}`);
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore Order' })).toHaveCount(0);
});
