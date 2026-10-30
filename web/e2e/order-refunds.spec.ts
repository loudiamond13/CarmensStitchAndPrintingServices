// Handing money back on an order end to end (ORD-07, ORD-18, D-10, D-11, D-19, D-62; plan 08-21), in all five projects. A signed-in
// Manager clears a customer credit with Record Refund and sees the server's figures and both names in the Refunds tab. Every test runs
// under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so
// each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

test('@orders-refunds a Manager clears a customer credit with Record Refund and sees who refunded and who recorded it', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Rec${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Ref${token}` });
  const refunder = `Ana Ref${token}`;
  const number = `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with 10,000.00 paid: a customer credit of 640.00.
  const id = await createOrder(request, {
    number,
    status: 'ready',
    customerName: 'E2E Refunds Customer',
    teamName: 'E2E Refunds Team',
    orderDate: manilaDate(-4),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E refund jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-3), amount: 10_000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('Customer credit');
  await expect(totals).toContainText('₱640.00');

  // Record Refund opens the window with the credit filled in, today, and the signed-in person as the refunder.
  await totals.getByRole('button', { name: 'Record Refund' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Refund' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Refunds Team`);
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue('640.00');
  await expect(dialog.getByLabel(/^Date/)).toHaveValue(manilaDate(0));
  await expect(dialog.getByLabel(/^Refunded by/)).toContainText('Mira Rec');
  await expect(dialog.getByText('You can refund up to ₱640.00.')).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // More than the credit and a missing reason are refused in the browser, in the server's words.
  await dialog.getByLabel(/^Amount/).fill('640.01');
  await dialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(dialog.getByText('This is more than the customer credit. Enter ₱640.00 or less.')).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill('640');
  await dialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(dialog.getByText('Add a short reason for the refund.')).toBeVisible();

  await dialog.getByLabel(/^Reason/).fill('E2E overpayment returned');
  await dialog.getByLabel(/^Refunded by/).selectOption({ label: refunder });
  await dialog.getByRole('button', { name: 'Save Refund' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Refund added')).toBeVisible();
  await expect(page.getByText('Order is now fully paid.')).toBeVisible();
  await expect(totals).toContainText('+₱640.00');
  await expect(totals).toContainText('Fully Paid');
  await expect(totals.getByRole('button', { name: 'Record Refund' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Totals' })).toBeFocused();

  // The Refunds tab lists the refund with both people.
  await page.getByRole('tab', { name: /^Refunds/ }).click();
  const refunds = page.getByRole('table', { name: 'Refunds' });
  const row = refunds.getByRole('row').filter({ hasText: 'E2E overpayment returned' });
  await expect(row).toContainText('₱640.00');
  await expect(row).toContainText(refunder);
  await expect(row).toContainText('Mira Rec');
  await expectNoAxeViolations(page);
});
