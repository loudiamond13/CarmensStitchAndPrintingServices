// Working the items of an order end to end (ORD-07, D-28; plan 08-14), in all five projects. A signed-in Manager adds, edits and
// deletes items from the Items tab, and after each save the page shows the server's own figures. Every test runs under the shared
// guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database keeps what earlier runs made, so each check
// seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

test('@orders-items a Manager adds an item and sees the new total from the server', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2095-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 with nothing paid.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Items Customer',
    teamName: 'E2E Items Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E first jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱9,360.00');

  await page.getByRole('button', { name: 'Add Item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Item' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${number} · E2E Items Team`);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // 10 x 500 = 5,000.00 more.
  await dialog.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await dialog.getByLabel(/^Size \/ variant/).fill('M');
  await dialog.getByLabel(/^Description/).fill('E2E second item');
  await dialog.getByLabel(/^Quantity/).fill('10');
  await dialog.getByLabel(/^Unit price/).fill('500');
  await expect(dialog.getByText('Line total: ₱5,000.00')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Item' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Item added')).toBeVisible();
  await expect(page.getByText('Balance now ₱14,360.00.')).toBeVisible();
  await expect(totals).toContainText('₱14,360.00');
  const items = page.getByRole('table', { name: 'Order items' });
  await expect(items).toContainText('E2E second item');
  await expect(items).toContainText('Items subtotal · 22 pcs');
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeFocused();
});

test('@orders-items a Manager edits an item, deletes another and sees the server totals each time, and the last item cannot be deleted', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2096-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  // 12 x 780 = 9,360.00 and 5 x 400 = 2,000.00: 11,360.00 in all.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Items Customer',
    teamName: 'E2E Items Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E edit jersey', quantity: 12, unitPrice: 780 },
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E delete shorts', quantity: 5, unitPrice: 400 },
    ],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('₱11,360.00');

  // Edit: the window opens with the item, shows who recorded it, and a save shows the server's new total.
  await page.getByRole('button', { name: 'Edit item 1, E2E edit jersey' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Item' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Description/)).toHaveValue('E2E edit jersey');
  await expect(dialog.getByText('Recorded by')).toBeVisible();
  await expect(dialog.getByText('Last changed by')).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByLabel(/^Quantity/).fill('10');
  await expect(dialog.getByText('Line total: ₱7,800.00')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Item' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Item updated')).toBeVisible();
  await expect(totals).toContainText('₱9,800.00');
  await expect(page.getByRole('button', { name: 'Edit item 1, E2E edit jersey' })).toBeFocused();

  // A half filled edit asks before it closes; Keep Editing keeps the typed value.
  await page.getByRole('button', { name: 'Edit item 1, E2E edit jersey' }).click();
  await dialog.getByLabel(/^Quantity/).fill('11');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  const question = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(question.getByRole('button', { name: 'Keep Editing' })).toBeFocused();
  await question.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(dialog.getByLabel(/^Quantity/)).toHaveValue('11');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await question.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(dialog).toBeHidden();

  // Delete: the dialog names the item and the order; the server's total follows; the last item cannot be deleted.
  await page.getByRole('button', { name: 'Delete item 2, E2E delete shorts' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete item "E2E delete shorts"?' });
  await expect(confirm).toContainText(`This removes it from ${number} and updates the totals right away.`);
  await confirm.getByRole('button', { name: 'Delete Item' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText('Item deleted')).toBeVisible();
  await expect(totals).toContainText('₱7,800.00');
  await expect(page.getByRole('button', { name: 'Edit item 1, E2E edit jersey' })).toBeFocused();
  await expect(page.getByRole('button', { name: /^Delete item / })).toHaveCount(0);
  await expect(page.getByText("An order needs at least one item, so the last one can't be deleted.")).toBeVisible();
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

test('@orders-items on a phone the row actions sit top right and answer a 44 px tap area, and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Items Customer',
    teamName: 'E2E Items Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E phone jersey', quantity: 12, unitPrice: 780 },
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E phone shorts', quantity: 5, unitPrice: 400 },
    ],
  });
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  // Row actions keep their drawn size (36 px) and answer a tap anywhere in a 44 px square around them (D-31 O-8, D-51).
  for (const name of ['Edit item 1, E2E phone jersey', 'Delete item 1, E2E phone jersey']) {
    const button = page.getByRole('button', { name });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) {
      expect({ width: box.width, height: box.height }).toEqual({ width: 36, height: 36 });
      // Top right of the card: in the right half of the screen.
      expect(box.x).toBeGreaterThan(390 / 2);
    }
    const misses = await page.evaluate<string[]>(probeTapArea(name));
    expect(misses, `tap probes that missed ${name}`).toEqual([]);
  }
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // The Add Item window fits a phone: no sideways scroll, and every control is 44 px tall.
  await page.getByRole('button', { name: 'Add Item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Item' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  // The window rises into place first, and a box measured mid-rise is a little small.
  await expect
    .poll(async () => (await dialog.getByLabel(/^Quantity/).boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  await expectNoAxeViolations(page);
});
