// Deleted Orders for Managers end to end (ORD-06, D-23, 07 D-28; plan 08-20), in all five projects. A signed-in Manager finds an order
// that was deleted, restores it with one click, and later deletes one for good after typing its number. Every test runs under the
// shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each
// check seeds its own order by a unique number.
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

/**
 * Soft-deletes an order the way the API allows it (DELETE /api/v1/orders/{id}), as the signed-in Manager of this page. The page
 * keeps its token in memory, so the request context takes a fresh one from the same refresh cookie.
 */
async function deleteOrderThroughApi(page: Page, id: string): Promise<void> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${session.accessToken}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);
}

test('@orders-deleted a Manager finds a deleted order in Deleted Orders and restores it with one click', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = uniqueNumber(2096);
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E Deleted Customer',
    teamName: 'E2E Deleted Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E deleted jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);
  await deleteOrderThroughApi(page, id);

  // The Manager reaches Deleted Orders from the Orders header.
  await page.goto('/admin/orders');
  await page.getByRole('link', { name: 'Deleted Orders' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/deleted$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Orders' })).toBeVisible();
  await expect(page.getByText('Manager only')).toBeVisible();
  const table = page.getByRole('table', { name: 'Deleted orders' });
  const row = table.getByRole('row').filter({ hasText: number });
  await expect(row).toBeVisible();
  await expect(row).toContainText('E2E Deleted Team');
  await expect(row).toContainText('E2E Deleted Customer');
  await expect(row).toContainText('In Production');
  await expect(row).toContainText('₱9,360.00');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Restore acts at once, with no dialog: the row leaves and the toast says what changed.
  await row.getByRole('button', { name: `Restore order ${number}` }).click();
  await expect(page.getByText('Order restored')).toBeVisible();
  await expect(page.getByText(`${number} counts in lists and totals again.`)).toBeVisible();
  await expect(row).toHaveCount(0);

  // The order is back in Orders.
  await page.goto(`/admin/orders?q=${number}`);
  await expect(page.getByText(number).first()).toBeVisible();
});
