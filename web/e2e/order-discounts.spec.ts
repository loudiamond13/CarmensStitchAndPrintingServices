// Working the discounts of an order end to end (ORD-07, D-15; plan 08-17), in all five projects. A signed-in Manager gives a percent
// discount from the Discounts tab and sees the server's own Discount and Total rows, edits and deletes discounts with the cap
// holding, and every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database
// keeps what earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

test('@orders-discounts a Manager gives a 5% discount and sees the server Discount and Total rows', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2092-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with no discount; 5% is 468.00 and the total becomes 8,892.00.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Discounts Customer',
    teamName: 'E2E Discounts Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E discount jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}?tab=discounts`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');

  await page.getByRole('button', { name: 'Add Discount' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Discount' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Discounts Team`);
  await expect(dialog.getByRole('radio', { name: 'Fixed ₱' })).toBeChecked();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Saving with nothing typed is refused in the browser, in the server's words.
  await dialog.getByRole('button', { name: 'Save Discount' }).click();
  await expect(dialog.getByText('Enter a reason for the discount.')).toBeVisible();

  await dialog.getByLabel(/^Reason/).fill('E2E league discount');
  await dialog.getByRole('radio', { name: 'Percent %' }).click();
  await dialog.getByLabel(/^Value/).fill('5');
  await expect(dialog.getByText('Computed amount: ₱468.00')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Discount' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Discount added')).toBeVisible();
  await expect(page.getByText('Balance now ₱8,892.00.')).toBeVisible();
  await expect(totals).toContainText('₱468.00');
  await expect(totals).toContainText('₱8,892.00');
  const discounts = page.getByRole('table', { name: 'Discounts' });
  const row = discounts.getByRole('row').filter({ hasText: 'E2E league discount' });
  await expect(row).toContainText('Percentage');
  await expect(row).toContainText('5%');
  await expect(row).toContainText('₱468.00');
  await expect(page.getByRole('button', { name: 'Add Discount' })).toBeFocused();
  await expectNoAxeViolations(page);
});

test('@orders-discounts a Manager edits and deletes discounts with the cap holding, and the server totals follow each time', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2091-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 less 468.00 (5%) and 500.00 (fixed) is 8,392.00.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Discounts Customer',
    teamName: 'E2E Discounts Team',
    orderDate: manilaDate(-4),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E discount jersey', quantity: 12, unitPrice: 780 }],
    discounts: [
      { kind: 'percentage', value: 5, reason: 'E2E league discount' },
      { kind: 'fixed', value: 500, reason: 'E2E club discount' },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}?tab=discounts`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱8,392.00');

  // Edit: the cap leaves out the discount's own saved amount (9,360.00 less 468.00 leaves 8,892.00).
  await page.getByRole('button', { name: 'Edit discount, E2E club discount' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Discount' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Value/)).toHaveValue('500.00');
  await expect(dialog.getByText('Recorded by')).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByLabel(/^Value/).fill('8892.01');
  await dialog.getByRole('button', { name: 'Save Discount' }).click();
  await expect(
    dialog.getByText('The discounts would be more than the items total. Lower or remove a discount first.'),
  ).toBeVisible();
  await dialog.getByLabel(/^Value/).fill('1000');
  await dialog.getByRole('button', { name: 'Save Discount' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Discount updated')).toBeVisible();
  await expect(totals).toContainText('₱7,892.00');
  await expect(page.getByRole('button', { name: 'Edit discount, E2E club discount' })).toBeFocused();

  // Delete: the dialog names the reason and the order; the server's total follows.
  await page.getByRole('button', { name: 'Delete discount, E2E league discount' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete discount "E2E league discount"?' });
  await expect(confirm).toContainText(`This removes it from ${number} and updates the totals right away.`);
  await confirm.getByRole('button', { name: 'Delete Discount' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText('Discount deleted')).toBeVisible();
  await expect(totals).toContainText('₱8,360.00');
  await expect(page.getByRole('button', { name: 'Edit discount, E2E club discount' })).toBeFocused();
  await expectNoAxeViolations(page);
});

test('@orders-discounts a discount on a paid order is allowed and the toast names the customer credit', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2090-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with 9,000.00 paid. A 1,000.00 discount makes the total 8,360.00, so 640.00 is owed back.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Discounts Customer',
    teamName: 'E2E Discounts Team',
    orderDate: manilaDate(-4),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E discount jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-3), amount: 9000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}?tab=discounts`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  await page.getByRole('button', { name: 'Add Discount' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Discount' });
  await dialog.getByLabel(/^Reason/).fill('E2E goodwill');
  await dialog.getByLabel(/^Value/).fill('1000');
  await dialog.getByRole('button', { name: 'Save Discount' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Discount added')).toBeVisible();
  await expect(page.getByText('Customer credit now ₱640.00.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Totals' })).toContainText('₱640.00');
});
