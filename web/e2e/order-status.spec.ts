// Running an order through its statuses end to end (ORD-07, D-14 to D-20; plan 08-19), in all five projects. A signed-in Manager moves
// a seeded order from the order page with the Change Status menu and sees the badge, the history and the toast from the server's
// answer. Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps
// what earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-status a Manager moves an order from In Production to Delivered and sees the badge and a new history row', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with nothing paid, so Mark Completed is unavailable.
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E Status Customer',
    teamName: 'E2E Status Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E status jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  const heading = page.getByRole('heading', { level: 1, name: number });
  await expect(heading).toBeVisible();
  const titleRow = heading.locator('..');
  await expect(titleRow).toContainText('In Production');

  // The menu opens on its first item from the keyboard and lists only the allowed moves.
  const change = page.getByRole('button', { name: 'Change Status' });
  await change.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Change Status' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Move to Pending' })).toBeFocused();
  await expect(menu.getByRole('menuitem', { name: 'Move to In Production' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: /^Mark Completed/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByText('Balance must be ₱0.00 to complete.')).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // A move acts at once and shows the server's answer.
  await menu.getByRole('menuitem', { name: 'Move to Delivered' }).click();
  await expect(page.getByText('Status changed')).toBeVisible();
  await expect(page.getByText(`${number} is now Delivered.`)).toBeVisible();
  await expect(titleRow).toContainText('Delivered');
  await expect(page.getByText('In Production to Delivered')).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(change).toBeFocused();
});

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

test('@orders-status a Manager cancels an order, sees the locked banner and Refunds tab, then reopens it to In Production', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2098-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with 3,000.00 paid.
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E Cancel Customer',
    teamName: 'E2E Cancel Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E cancel jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 3000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const change = page.getByRole('button', { name: 'Change Status' });

  // The confirm explains the money; Keep Order is focused first and leaves the order as it was.
  await change.click();
  await page.getByRole('menuitem', { name: 'Cancel Order' }).click();
  const confirm = page.getByRole('dialog', { name: `Cancel ${number}?` });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Payments of ₱3,000.00 stay as collected cash.');
  await expect(confirm).toContainText('Record a refund on the Refunds tab if you give money back.');
  await expect(confirm).toContainText('You can reopen it later.');
  await expect(confirm.getByRole('button', { name: 'Keep Order' })).toBeFocused();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Keep Order' }).click();
  await expect(confirm).toBeHidden();
  await expect(change).toBeFocused();
  await expect(page.getByText('This order is cancelled.')).toHaveCount(0);

  // Cancelling locks the order: the banner, the Refunds tab, no actions, and focus on Reopen Order. No refund is recorded.
  await change.click();
  await page.getByRole('menuitem', { name: 'Cancel Order' }).click();
  await confirm.getByRole('button', { name: 'Cancel Order' }).click();
  await expect(page.getByText('Order cancelled')).toBeVisible();
  await expect(page.getByText(`${number} is locked. Payments stay as collected cash.`)).toBeVisible();
  await expect(page.getByText('This order is cancelled.')).toBeVisible();
  await expect(page.getByText('Refunds can still be recorded on the Refunds tab.')).toBeVisible();
  const reopen = page.getByRole('button', { name: 'Reopen Order' });
  await expect(reopen).toBeFocused();
  await expect(page.getByRole('tab', { name: /^Refunds/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change Status' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Details' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Item' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Totals' }).getByText('Refunded', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Reopen goes back to the status before the end state and brings the actions back.
  await reopen.click();
  const reopenWindow = page.getByRole('dialog', { name: `Reopen ${number}` });
  await expect(reopenWindow).toBeVisible();
  await expect(reopenWindow.getByRole('radio', { name: 'In Production' })).toBeChecked();
  await expect(reopenWindow.getByRole('radio', { name: 'In Production' })).toBeFocused();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
  await reopenWindow.getByRole('button', { name: 'Reopen Order' }).click();
  await expect(page.getByText('Order reopened')).toBeVisible();
  await expect(page.getByText(`${number} is now In Production.`)).toBeVisible();
  await expect(reopenWindow).toBeHidden();
  await expect(page.getByRole('button', { name: 'Change Status' })).toBeFocused();
  await expect(page.getByText('This order is cancelled.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Details' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();
  await expect(page.getByText('Cancelled to In Production')).toBeVisible();
});

test('@orders-status a Manager completes a fully paid order at once and the order locks', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2099-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00, paid in full.
  const id = await createOrder(request, {
    number,
    status: 'delivered',
    customerName: 'E2E Complete Customer',
    teamName: 'E2E Complete Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E complete jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 9360, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  await page.getByRole('button', { name: 'Change Status' }).click();
  const item = page.getByRole('menuitem', { name: 'Mark Completed' });
  await expect(item).not.toHaveAttribute('aria-disabled', 'true');
  await item.click();

  // No confirm (D-47): the order locks at once.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Order completed')).toBeVisible();
  await expect(page.getByText(`${number} is locked. Reopen it to make changes.`)).toBeVisible();
  await expect(page.getByText('This order is completed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen Order' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Change Status' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Details' })).toHaveCount(0);
  await expect(page.getByText('Delivered to Completed')).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
