// Working the expenses of an order end to end (ORD-07, ORD-19, ORD-23, D-12; plan 08-18), in all five projects. A signed-in Manager
// records a cost that a coworker paid and sees both names and the server's new Order Expenses and Estimated Profit, and every test
// runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs
// made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-expenses a Manager records a cost paid by a coworker and sees both names and the new profit', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Rec${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Paid${token}` });
  const payer = `Ana Paid${token}`;
  const number = `ORD-2088-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with no expenses, so the profit starts at the whole total.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Expenses Customer',
    teamName: 'E2E Expenses Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E expense jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}?tab=expenses`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('Estimated Profit');
  await expect(totals).toContainText('₱9,360.00');

  await page.getByRole('button', { name: 'Add Expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Expense' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Expenses Team`);
  // The window starts with no category and the signed-in person as the payer (D-11).
  await expect(dialog.getByLabel(/^Category/)).toHaveValue('');
  await expect(dialog.getByLabel(/^Paid by/)).toContainText('Mira Rec');
  await expect(dialog.getByText("Up to 30 days ahead is fine for a cost you'll pay soon.")).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Saving with no category is refused in the browser, in the server's words.
  await dialog.getByLabel(/^Amount/).fill('3825');
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog.getByText('Choose a category.')).toBeVisible();

  await dialog.getByLabel(/^Category/).selectOption({ label: 'Fabric' });
  await dialog.getByLabel(/^Description/).fill('E2E dri-fit mesh');
  await dialog.getByLabel(/^Paid by/).selectOption({ label: payer });
  await dialog.getByRole('button', { name: 'Save Expense' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(page.getByText('Order expenses now ₱3,825.00.')).toBeVisible();
  // The panel shows the server's figures: 9,360.00 - 3,825.00 = 5,535.00.
  await expect(totals).toContainText('₱3,825.00');
  await expect(totals).toContainText('₱5,535.00');
  const expenses = page.getByRole('table', { name: 'Expenses' });
  const row = expenses.getByRole('row').filter({ hasText: 'E2E dri-fit mesh' });
  // Paid by is the coworker; Recorded by is the signed-in Manager.
  await expect(row).toContainText(payer);
  await expect(row).toContainText('Mira Rec');
  await expect(row).toContainText('₱3,825.00');
  await expect(page.getByRole('button', { name: 'Add Expense' })).toBeFocused();
  await expectNoAxeViolations(page);
});

/** The seeded Fabric and Labor order expense categories (the ids are the fixed migration seed literals). */
const FABRIC_ID = '01a17fce-780b-75d1-89e0-5b3b9b185a2c';
const LABOR_ID = '01a17fce-780e-700c-90b2-d45ecdc6df9d';

test('@orders-expenses a Manager edits and deletes order expenses and the profit follows the server', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2087-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with 3,825.00 and 1,640.00 spent: 5,465.00 in expenses and 3,895.00 profit.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Expenses Customer',
    teamName: 'E2E Expenses Team',
    orderDate: manilaDate(-4),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E expense jersey', quantity: 12, unitPrice: 780 }],
    expenses: [
      {
        expenseDate: manilaDate(-3),
        amount: 3825,
        orderExpenseCategoryId: FABRIC_ID,
        paidByUserId: manager.userId,
        description: 'E2E mesh',
      },
      {
        expenseDate: manilaDate(-2),
        amount: 1640,
        orderExpenseCategoryId: LABOR_ID,
        paidByUserId: manager.userId,
        description: 'E2E sewing',
      },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}?tab=expenses`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱5,465.00');
  await expect(totals).toContainText('₱3,895.00');

  // Edit: the window opens with the saved values and the Recorded by block, and the server's figures follow the save.
  await page.getByRole('button', { name: /^Edit expense of ₱3,825\.00, / }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Expense' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue('3825.00');
  await expect(dialog.getByLabel(/^Description/)).toHaveValue('E2E mesh');
  await expect(dialog.getByText('Recorded by')).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByLabel(/^Amount/).fill('1000000.01');
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog.getByText('Enter an amount of ₱1,000,000.00 or less.')).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill('4000');
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Expense updated')).toBeVisible();
  await expect(page.getByText('Order expenses now ₱5,640.00.')).toBeVisible();
  await expect(totals).toContainText('₱3,720.00');
  await expect(page.getByRole('button', { name: /^Edit expense of ₱4,000\.00, / })).toBeFocused();

  // Delete: the dialog names the amount and the order; the server's figures follow.
  await page.getByRole('button', { name: /^Delete expense of ₱1,640\.00, / }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete expense of ₱1,640.00?' });
  await expect(confirm).toContainText(`This removes it from ${number} and updates the totals right away.`);
  await confirm.getByRole('button', { name: 'Delete Expense' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText('Expense deleted')).toBeVisible();
  await expect(page.getByText('Order expenses now ₱4,000.00.')).toBeVisible();
  await expect(totals).toContainText('₱5,360.00');
  await expect(page.getByRole('button', { name: /^Edit expense of ₱4,000\.00, / })).toBeFocused();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
