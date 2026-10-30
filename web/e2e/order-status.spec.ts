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
