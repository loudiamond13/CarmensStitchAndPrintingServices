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

test('@orders-refunds a Manager works the refunds of a cancelled order without reopening it, up to what was paid', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2096-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 paid in full, cancelled, with 500.00 already handed back: 8,860.00 can still be refunded.
  const id = await createOrder(request, {
    number,
    status: 'cancelled',
    customerName: 'E2E Refunds Customer',
    teamName: 'E2E Refunds Team',
    orderDate: manilaDate(-6),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E refund jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-5), amount: 9360, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
    refunds: [
      { refundDate: manilaDate(-2), amount: 500, reason: 'E2E first refund', refundedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}?tab=refunds`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const refunds = page.getByRole('table', { name: 'Refunds' });
  await expect(refunds).toContainText('E2E first refund');
  await expect(refunds).toContainText('Total refunded');
  await expect(page.getByText('You can refund up to ₱8,860.00.')).toBeVisible();

  // Edit: the cap adds back the refund's own amount; the new amount shows in the table and in the Totals panel.
  await page.getByRole('button', { name: /^Edit refund of ₱500\.00, / }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Refund' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue('500.00');
  await expect(dialog.getByText('You can refund up to ₱9,360.00.')).toBeVisible();
  await expect(dialog.getByText('Recorded by')).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByLabel(/^Amount/).fill('9360.01');
  await dialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(
    dialog.getByText('This is more than was paid and not yet refunded. Enter ₱9,360.00 or less.'),
  ).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill('700');
  await dialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Refund updated')).toBeVisible();
  await expect(refunds).toContainText('₱700.00');
  await expect(page.getByRole('button', { name: /^Edit refund of ₱700\.00, / })).toBeFocused();

  // Add: handing back the rest takes Add Refund away and the caption loses its cap sentence.
  await page.getByRole('button', { name: 'Add Refund' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Add Refund' });
  await expect(addDialog.getByLabel(/^Amount/)).toHaveValue('');
  await addDialog.getByLabel(/^Amount/).fill('8660.01');
  await addDialog.getByLabel(/^Reason/).fill('E2E rest');
  await addDialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(
    addDialog.getByText('This is more than was paid and not yet refunded. Enter ₱8,660.00 or less.'),
  ).toBeVisible();
  await addDialog.getByLabel(/^Amount/).fill('8660');
  await addDialog.getByRole('button', { name: 'Save Refund' }).click();
  await expect(addDialog).toBeHidden();
  await expect(page.getByText('Refund added')).toBeVisible();
  await expect(refunds).toContainText('₱9,360.00');
  await expect(page.getByRole('button', { name: 'Add Refund' })).toHaveCount(0);
  await expect(page.getByText(/You can refund up to/)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 3, name: 'Refunds' })).toBeFocused();

  // Delete: the dialog names the amount; the cap returns with Add Refund.
  await page.getByRole('button', { name: /^Delete refund of ₱8,660\.00, / }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete refund of ₱8,660.00?' });
  await expect(confirm).toContainText(`This removes it from ${number} and updates the totals right away.`);
  await confirm.getByRole('button', { name: 'Delete Refund' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText('Refund deleted')).toBeVisible();
  await expect(refunds).not.toContainText('E2E rest');
  await expect(page.getByText('You can refund up to ₱8,660.00.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Refund' })).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
