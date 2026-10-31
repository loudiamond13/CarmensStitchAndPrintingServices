// Deleting an order from its page end to end (ORD-06, D-21, D-22, D-51; plan 08-22), in all five projects. A signed-in Manager opens
// an order from the Orders list, reads what the delete hides, deletes it and lands back on the list as it was, where the order is
// gone. Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what
// earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

/** Seeds an order with two items, a payment and a discount, and returns its number and id. */
async function seedOrder(
  request: Parameters<typeof createOrder>[0],
  manager: TestStaff,
  year: number,
): Promise<{ number: string; id: string }> {
  const number = `ORD-${String(year)}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E Delete Customer',
    teamName: 'E2E Delete Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E delete jersey', quantity: 12, unitPrice: 780 },
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E delete shorts', quantity: 12, unitPrice: 300 },
    ],
    discounts: [{ kind: 'fixed', value: 360, reason: 'E2E delete discount' }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 1000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  return { number, id };
}

/** Opens the order from its card on the filtered Orders list, so the page knows the list address to return to. */
async function openFromList(page: Page, number: string): Promise<void> {
  await page.goto(`/admin/orders?q=${number}`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: `View order ${number}`, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
}

/** Soft-deletes an order through the API as the signed-in Manager of this page (the page keeps its token in memory). */
async function deleteOrderThroughApi(page: Page, id: string): Promise<void> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${session.accessToken}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);
}

test('@orders-delete a Manager reads what a delete hides, keeps the order with Cancel, then deletes it and lands back on the list', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { number } = await seedOrder(request, manager, 2094);
  await signInAs(page, request, manager);
  await openFromList(page, number);

  // The confirm names the order and what it hides; Cancel is focused first and the order stays.
  const remove = page.getByRole('button', { name: 'Delete Order' });
  await remove.click();
  const confirm = page.getByRole('dialog', { name: `Delete ${number}?` });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByText(
      'Its 2 items, 1 payment and 1 discount are hidden from every list and total. A Manager can restore it.',
    ),
  ).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(confirm.getByRole('textbox')).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(remove).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  // Delete Order sends one delete, goes back to the filtered list, toasts, and the order is gone from Orders.
  await remove.click();
  await confirm.getByRole('button', { name: 'Delete Order' }).click();
  await expect(page).toHaveURL(`/admin/orders?q=${number}`);
  await expect(page.getByText(`Order ${number} deleted`)).toBeVisible();
  await expect(page.getByText('A Manager can restore it from Deleted Orders.')).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: number })).toHaveCount(0);

  // It is in Deleted Orders for a Manager to restore.
  await page.goto('/admin/orders/deleted');
  await expect(
    page.getByRole('table', { name: 'Deleted orders' }).getByRole('row').filter({ hasText: number }),
  ).toBeVisible();
});

test('@orders-delete the subline count of the Orders list follows the server after a delete', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { number } = await seedOrder(request, manager, 2093);
  await signInAs(page, request, manager);
  await openFromList(page, number);

  await page.getByRole('button', { name: 'Delete Order' }).click();
  const listed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/orders' && response.request().method() === 'GET',
  );
  await page
    .getByRole('dialog', { name: `Delete ${number}?` })
    .getByRole('button', { name: 'Delete Order' })
    .click();
  await expect(page).toHaveURL(`/admin/orders?q=${number}`);

  // The list is read again after the delete; the subline shows that answer's counts (D-41), and the order is not in it.
  const body = (await (await listed).json()) as { allOrders: number; items: { number: string }[] };
  expect(body.items.map((item) => item.number)).not.toContain(number);
  const orders = `${body.allOrders.toLocaleString('en-US')} ${body.allOrders === 1 ? 'order' : 'orders'}`;
  await expect(page.getByText(new RegExp(`^${orders} · [\\d,]+ active$`))).toBeVisible();
});

test('@orders-delete an order someone else already deleted says Already deleted and returns to the list', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { number, id } = await seedOrder(request, manager, 2092);
  // The delete that finds the order gone answers 404.
  guard.expectStatus(`/api/v1/orders/${id}`, 404);
  await signInAs(page, request, manager);
  await openFromList(page, number);

  await page.getByRole('button', { name: 'Delete Order' }).click();
  const confirm = page.getByRole('dialog', { name: `Delete ${number}?` });
  await expect(confirm).toBeVisible();
  await deleteOrderThroughApi(page, id);
  await confirm.getByRole('button', { name: 'Delete Order' }).click();

  await expect(page.getByText('Already deleted')).toBeVisible();
  await expect(page.getByText('Someone else deleted this order. The list is up to date.')).toBeVisible();
  await expect(page).toHaveURL(`/admin/orders?q=${number}`);
  await expect(confirm).toBeHidden();
});
