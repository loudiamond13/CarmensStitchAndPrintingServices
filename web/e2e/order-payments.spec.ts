// Working the payments of an order end to end (ORD-07, ORD-22, D-09, D-11, D-29, D-48; plan 08-16), in all five projects. A signed-in
// Manager records a payment that a coworker received and sees both names and the server's new balance, edits and deletes payments, and
// sees Add Payment go and return with the balance. Every test runs under the shared
// guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

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

test('@orders-payments a Manager edits and deletes payments, and Add Payment goes and returns with the balance', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2099-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with 2,000.00 and 3,000.00 paid: 4,360.00 due.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Payments Customer',
    teamName: 'E2E Payments Team',
    orderDate: manilaDate(-4),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E payment jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-3), amount: 2000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
      { paymentDate: manilaDate(-2), amount: 3000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}?tab=payments`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱4,360.00');

  // Edit: the cap is the balance plus the saved amount, and the server's new balance follows the save.
  await page.getByRole('button', { name: /^Edit payment of ₱3,000\.00, / }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Payment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue('3000.00');
  await expect(dialog.getByText('Balance due: ₱7,360.00')).toBeVisible();
  await expect(dialog.getByText('Recorded by')).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByLabel(/^Amount/).fill('7360.01');
  await dialog.getByRole('button', { name: 'Save Payment' }).click();
  await expect(dialog.getByText('This is more than the balance. Enter ₱7,360.00 or less.')).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill('3500');
  await dialog.getByRole('button', { name: 'Save Payment' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Payment updated')).toBeVisible();
  await expect(totals).toContainText('₱3,860.00');
  await expect(page.getByRole('button', { name: /^Edit payment of ₱3,500\.00, / })).toBeFocused();

  // Delete: the dialog names the amount and the order; the server's balance follows.
  await page.getByRole('button', { name: /^Delete payment of ₱2,000\.00, / }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete payment of ₱2,000.00?' });
  await expect(confirm).toContainText(`This removes it from ${number} and updates the totals right away.`);
  await confirm.getByRole('button', { name: 'Delete Payment' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText('Payment deleted')).toBeVisible();
  await expect(totals).toContainText('₱5,860.00');
  await expect(page.getByRole('button', { name: /^Edit payment of ₱3,500\.00, / })).toBeFocused();

  // Pay the rest: Add Payment goes, the caption says nothing is owed, and the heading takes the cursor.
  await page.getByRole('button', { name: 'Add Payment' }).click();
  const add = page.getByRole('dialog', { name: 'Add Payment' });
  await add.getByLabel(/^Amount/).fill('5860');
  await add.getByLabel(/^Method/).selectOption({ label: 'Cash' });
  await add.getByRole('button', { name: 'Save Payment' }).click();
  await expect(add).toBeHidden();
  await expect(page.getByText('Order is now fully paid.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Payment' })).toHaveCount(0);
  await expect(page.getByText('Nothing is owed on this order.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Payments' })).toBeFocused();

  // Delete one again: money is owed, so Add Payment returns.
  await page.getByRole('button', { name: /^Delete payment of ₱5,860\.00, / }).click();
  await page
    .getByRole('dialog', { name: 'Delete payment of ₱5,860.00?' })
    .getByRole('button', { name: 'Delete Payment' })
    .click();
  await expect(page.getByRole('button', { name: 'Add Payment' })).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

// A page script (the e2e program has no DOM types): hit-tests the centre of the named button and the eight points 21 px away,
// which lie inside the 44 x 44 px square the row action answers a tap in. A hit on the button or a node inside it counts.
function probeTapArea(name: string): string {
  return `(() => {
    const element = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === ${JSON.stringify(name)});
    if (element === undefined) {
      return ['not found'];
    }
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const misses = [];
    for (const [dx, dy] of [[0, 0], [21, 0], [-21, 0], [0, 21], [0, -21], [21, 21], [21, -21], [-21, 21], [-21, -21]]) {
      const hit = document.elementFromPoint(x + dx, y + dy);
      if (hit === null || !(hit === element || element.contains(hit))) {
        misses.push(dx + ',' + dy);
      }
    }
    return misses;
  })()`;
}

test('@orders-payments on a phone the payment card shows both people, the row actions answer a 44 px tap area, and the window fits', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Pho${token}` });
  const number = `ORD-2094-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Payments Customer',
    teamName: 'E2E Payments Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E phone jersey', quantity: 12, unitPrice: 780 }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 2000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/orders/${id}?tab=payments`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  // Both people show in the card, and the row actions keep their drawn size (36 px) with a 44 px tap area (D-31 O-8, D-51).
  const card = page.getByRole('table', { name: 'Payments' });
  await expect(card).toContainText(`Mira Pho${token}`);
  for (const name of [/^Edit payment of ₱2,000\.00, /, /^Delete payment of ₱2,000\.00, /]) {
    const button = page.getByRole('button', { name });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) {
      expect({ width: box.width, height: box.height }).toEqual({ width: 36, height: 36 });
      expect(box.x).toBeGreaterThan(390 / 2);
    }
    const label = (await button.getAttribute('aria-label')) ?? '';
    const misses = await page.evaluate<string[]>(probeTapArea(label));
    expect(misses, `tap probes that missed ${label}`).toEqual([]);
  }
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // The Add Payment window fits a phone: no sideways scroll, and every control is 44 px tall.
  await page.getByRole('button', { name: 'Add Payment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  // The window rises into place first, and a box measured mid-rise is a little small.
  await expect
    .poll(async () => (await dialog.getByLabel(/^Amount/).boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  await expectNoAxeViolations(page);
});
