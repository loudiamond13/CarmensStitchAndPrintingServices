// Editing an order's details end to end (ORD-15, D-28, D-46; plan 08-15), in all five projects. A signed-in Manager opens Edit
// Details from the order page, changes the team name and the contact number, saves, and sees the change in the order header.
// Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what
// earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-edit a Manager edits the team name and sees it in the order header', async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Edit Customer',
    teamName: 'E2E Edit Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E edit jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await page.getByRole('link', { name: 'Edit Details' }).first().click();

  await expect(page).toHaveURL(new RegExp(`/admin/orders/${id}/edit$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Order' })).toBeVisible();
  await expect(page).toHaveTitle(`Edit ${number} · CSPS Admin`);
  await expect(page.getByLabel(/^Customer name/)).toHaveValue('E2E Edit Customer');
  await expect(page.getByLabel(/^Status/)).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  await page.getByLabel(/^Team \/ organization/).fill('E2E Edited Team');
  await page.getByLabel(/^Contact number/).fill('0917 555 0101');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/orders/${id}$`));
  await expect(page.getByText('Order details saved')).toBeVisible();
  await expect(page.getByText(/E2E Edited Team · E2E Edit Customer · Ordered /)).toBeVisible();
  await expect(page.getByText('Last changed by')).toBeVisible();
});
