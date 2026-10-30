// Recording payments end to end (ORD-07, ORD-22, D-09, D-11, D-29; plan 08-16), in all five projects. A signed-in Manager records a
// payment that a coworker received, and the page shows both names and the server's new balance. Every test runs under the shared
// guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-payments a Manager records a payment received by a coworker and sees both names and the new balance', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Rec${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Got${token}` });
  const receiver = `Ana Got${token}`;
  const number = `ORD-2098-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with nothing paid.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Payments Customer',
    teamName: 'E2E Payments Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E payment jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}?tab=payments`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');

  await page.getByRole('button', { name: 'Add Payment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Payments Team`);
  // The window starts with no method (D-29) and the signed-in person as the receiver (D-11).
  await expect(dialog.getByLabel(/^Method/)).toHaveValue('');
  await expect(dialog.getByLabel(/^Received by/)).toContainText('Mira Rec');
  await expect(dialog.getByText('Balance due: ₱9,360.00')).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Saving with no method is refused in the browser, in the server's words.
  await dialog.getByLabel(/^Amount/).fill('3000');
  await dialog.getByRole('button', { name: 'Save Payment' }).click();
  await expect(dialog.getByText('Choose a payment method.')).toBeVisible();

  await dialog.getByLabel(/^Method/).selectOption({ label: 'Cash' });
  await dialog.getByLabel(/^Received by/).selectOption({ label: receiver });
  await dialog.getByLabel(/^Reference no\./).fill('E2E receipt 1');
  await dialog.getByRole('button', { name: 'Save Payment' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Payment added')).toBeVisible();
  await expect(page.getByText('Balance now ₱6,360.00.')).toBeVisible();
  await expect(totals).toContainText('₱6,360.00');
  const payments = page.getByRole('table', { name: 'Payments' });
  await expect(payments).toContainText('₱3,000.00');
  await expect(payments).toContainText('E2E receipt 1');
  // Received by is the coworker; Recorded by is the signed-in Manager.
  const row = payments.getByRole('row').filter({ hasText: 'E2E receipt 1' });
  await expect(row).toContainText(receiver);
  await expect(row).toContainText('Mira Rec');
  await expect(page.getByRole('button', { name: 'Add Payment' })).toBeFocused();
  await expectNoAxeViolations(page);
});
