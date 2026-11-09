// Staff money end to end (MONEY-04, MONEY-05, SEC-06; plan 10-15), in all five projects. A fresh staff member who holds money from a payment
// sends part of it to a coworker from the dashboard strip, sees the server's new balance, and the coworker holds the amount. Every test runs
// under the shared guard (console, page errors, CSP, failed responses), the second person's page included. The shared CSPS_E2E database
// holds what other specs made, so nothing here asserts a shop-wide figure: only the money of the two fresh people this test makes
// (RESEARCH Pitfall 11).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, guardContext, test } from './fixtures.ts';
import { manilaDate, press } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, CASH_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

/** The second person: a signed-in page in its own context, watched by the same guard as the test's own page (IN-05). */
interface SecondPerson {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Throws with every console error, page error, CSP violation and failed response the second page reported. */
  readonly finish: () => Promise<void>;
}

/** Opens a second context, guards it, and signs the person in. */
async function signInSecondPerson(
  browser: Browser,
  baseURL: string | undefined,
  request: APIRequestContext,
  staff: TestStaff,
): Promise<SecondPerson> {
  const context = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  const watched = await guardContext(context, baseURL);
  // The sign-in page's refresh cookie check answers 401 before any session exists, as it does for the first person.
  watched.guard.expectStatus('/api/v1/auth/refresh', 401);
  const page = await context.newPage();
  await signInAs(page, request, staff);
  return { context, page, finish: watched.finish };
}

/** Seeds an order of 5,000.00 paid in full, with the payment received by `receiver`: that person now holds 5,000.00. */
async function seedPaymentTo(request: APIRequestContext, receiver: TestStaff): Promise<void> {
  await createOrder(request, {
    number: `ORD-2095-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
    customerName: 'E2E Money Customer',
    orderDate: manilaDate(-1),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E money jersey', quantity: 1, unitPrice: 5000 }],
    payments: [
      { paymentDate: manilaDate(-1), amount: 5000, paymentMethodId: CASH_ID, receivedByUserId: receiver.userId },
    ],
  });
}

test('@money a staff member sends part of their money to a coworker from the dashboard and sees the new balance', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const sender = await createStaff(request, 'Manager', undefined, { firstName: 'Sela', lastName: `Send${token}` });
  const receiver = await createStaff(request, 'Admin', undefined, { firstName: 'Rina', lastName: `Recv${token}` });
  await seedPaymentTo(request, sender);
  await signInAs(page, request, sender);

  const strip = page.getByRole('region', { name: 'Your money on hand' });
  await expect(strip).toContainText('₱5,000.00');
  await strip.getByRole('button', { name: 'Transfer' }).click();

  const dialog = page.getByRole('dialog', { name: 'Transfer Money' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`From Sela Send${token} (you). You have ₱5,000.00 on hand.`)).toBeVisible();
  const to = dialog.getByLabel(/^To/);
  await expect(to).toBeEnabled();
  await expect(to).toBeFocused();
  await to.selectOption({ label: `Rina Recv${token}` });
  await dialog.getByLabel(/^Amount/).fill('1250.50');
  await expectNoAxeViolations(page);

  await dialog.getByRole('button', { name: 'Record Transfer' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Transfer recorded')).toBeVisible();
  await expect(page.getByText('You now have ₱3,749.50 on hand.')).toBeVisible();
  await expect(strip).toContainText('₱3,749.50');
  await expect(strip.getByRole('button', { name: 'Transfer' })).toBeFocused();

  // The coworker holds the amount: their own money answer, read after they sign in, says 1,250.50.
  const other = await signInSecondPerson(browser, baseURL, request, receiver);
  try {
    const [answer] = await Promise.all([
      other.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/staff-money/me'),
      other.page.reload(),
    ]);
    expect(answer.status(), 'GET /api/v1/staff-money/me').toBe(200);
    const body = (await answer.json()) as { balance: number | string };
    expect(Number(body.balance)).toBe(1250.5);
    await expect(other.page.getByRole('region', { name: 'Your money on hand' })).toContainText('₱1,250.50');
    await other.finish();
  } finally {
    await other.context.close();
  }
});

test('@money the ledger keeps its page, rows per page and Show deleted through an order page and Back (WEB-10)', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Lena', lastName: `Ledger${token}` });
  // Eleven payments received by this person: with 10 rows per page the ledger has two pages.
  await Promise.all(Array.from({ length: 11 }, () => seedPaymentTo(request, manager)));
  await signInAs(page, request, manager);

  await page.goto('/admin/money?size=10');
  const resultBar = page.getByText(/^Showing/);
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  await expect(resultBar).toHaveText('Showing 11 entries · newest first');
  await expect(pagination).toContainText('Page 1 of 2');

  // Show deleted replaces the entry; page 2 pushes one.
  const showDeleted = page.getByRole('checkbox', { name: 'Show deleted' });
  await showDeleted.check();
  await expect(resultBar).toHaveText('Showing 11 entries, deleted transfers included · newest first');
  await expect.poll(() => new URL(page.url()).searchParams.get('deleted')).toBe('true');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(pagination).toContainText('Page 2 of 2');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');

  // Open the order behind the row, then Back: the page, the rows per page and Show deleted are all still there.
  await page
    .getByRole('link', { name: /^ORD-2095-/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);
  await page.goBack();
  await expect(pagination).toContainText('Page 2 of 2');
  await expect(showDeleted).toBeChecked();
  await expect(resultBar).toHaveText('Showing 11 entries, deleted transfers included · newest first');
  const restored = new URL(page.url()).searchParams;
  expect(restored.get('page')).toBe('2');
  expect(restored.get('size')).toBe('10');
  expect(restored.get('deleted')).toBe('true');
  // On a phone Show deleted sits near the sticky bottom tab bar. Moving the keyboard focus to it must bring it clear of the bar (WCAG 2.4.11,
  // the root's bottom scroll padding), so the check starts at the top of the page and lets the focus do the scrolling, as a person does.
  await page.evaluate('window.scrollTo(0, 0)');
  await showDeleted.focus();
  await expect(showDeleted).toBeFocused();
  const tabBar = page.locator('nav[aria-label="Admin"]:not(aside nav)');
  const box = await showDeleted.boundingBox();
  expect(box).not.toBeNull();
  if (box !== null && (await tabBar.isVisible())) {
    const bar = await tabBar.boundingBox();
    expect(bar).not.toBeNull();
    if (bar !== null) {
      expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
    }
  }
  // Whatever is on top at the box's centre is the box or its label, never the tab bar or the top bar.
  expect(
    await page.evaluate<boolean>(`(() => {
      const element = document.activeElement;
      if (element === null) { return false; }
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return top !== null && (element.contains(top) || top.closest('label')?.contains(element) === true);
    })()`),
  ).toBe(true);
  await expectNoAxeViolations(page);
});

/** Records a transfer of `amount` from the signed-in person to `receiverName` through the dashboard strip, and waits for the window to close. */
async function recordTransfer(page: Page, receiverName: string, amount: string): Promise<void> {
  const strip = page.getByRole('region', { name: 'Your money on hand' });
  await strip.getByRole('button', { name: 'Transfer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer Money' });
  await expect(dialog).toBeVisible();
  const to = dialog.getByLabel(/^To/);
  await expect(to).toBeEnabled();
  await to.selectOption({ label: receiverName });
  await dialog.getByLabel(/^Amount/).fill(amount);
  await dialog.getByRole('button', { name: 'Record Transfer' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Transfer recorded')).toBeVisible();
}

/**
 * The page function that checks where focus is after a delete, from the row actions listed before it. It answers "as expected", or says
 * what was wanted and where focus is. Wanted: the first action after the deleted one that is still listed, else the nearest one before it
 * that is still listed, else the table caption (the list still has rows) or the heading (the list is empty and has no caption).
 */
function focusCheckScript(labelsBefore: readonly (string | null)[], ownLabel: string | null): string {
  return `(() => {
  const before = ${JSON.stringify(labelsBefore)};
  const own = ${JSON.stringify(ownLabel)};
  const shown = Array.from(document.querySelectorAll('[role="tabpanel"] table button'))
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => /^(Delete|Remove) transfer of /.test(label));
  const place = before.indexOf(own);
  const next = before.slice(place + 1).find((label) => shown.includes(label));
  const previous = before.slice(0, place).reverse().find((label) => shown.includes(label));
  const wanted = next ?? previous ?? (shown.length > 0 ? 'the table caption' : 'the heading');
  const active = document.activeElement;
  const actual =
    active?.tagName === 'CAPTION' ? 'the table caption'
    : active?.tagName === 'H2' && active.textContent === 'Transfers' ? 'the heading'
    : active?.getAttribute('aria-label') ?? active?.tagName ?? 'nothing';
  return actual === wanted ? 'as expected' : 'wanted ' + wanted + ' but focus is on ' + actual;
})()`;
}

test('@money a Manager deletes a wrong transfer from the Transfers tab and both balances correct themselves (D-29, D-35, D-48)', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const sender = await createStaff(request, 'Manager', undefined, { firstName: 'Sela', lastName: `Wrong${token}` });
  const receiver = await createStaff(request, 'Admin', undefined, { firstName: 'Rina', lastName: `Recv${token}` });
  const senderName = `Sela Wrong${token}`;
  const receiverName = `Rina Recv${token}`;
  await seedPaymentTo(request, sender);
  await signInAs(page, request, sender);
  const strip = page.getByRole('region', { name: 'Your money on hand' });
  await expect(strip).toContainText('₱5,000.00');
  await recordTransfer(page, receiverName, '1250.50');
  await expect(strip).toContainText('₱3,749.50');

  // The Transfers tab lists it; Delete opens the simple confirm with Cancel focused.
  await page.goto('/admin/money?tab=transfers&size=100');
  await expect(page.getByRole('tab', { name: 'Transfers' })).toHaveAttribute('aria-selected', 'true');
  const table = page.getByRole('table', { name: 'Transfers' });
  const row = table.getByRole('row').filter({ hasText: receiverName });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(senderName);
  await expect(row).toContainText('₱1,250.50');
  // The focus rule after a delete: the next row's action, else the previous row's, else the table caption, else the heading (an empty
  // list has no caption). The Transfers list is shop-wide and the other browser projects change it at the same time, so rows may leave
  // or arrive meanwhile. The target is found by name: the first row after the deleted one that is still listed, else the nearest one
  // before it that is still listed.
  const ownAction = row.getByRole('button', { name: /^Delete transfer of ₱1,250\.50 from / });
  const actionButtons = table.getByRole('button', { name: /^(Delete|Remove) transfer of / });
  const labelsBefore = await Promise.all(
    (await actionButtons.all()).map((button) => button.getAttribute('aria-label')),
  );
  const ownLabel = await ownAction.getAttribute('aria-label');
  expect(labelsBefore, 'the row has an action in the table').toContain(ownLabel);
  await ownAction.click();
  const confirm = page.getByRole('dialog', { name: 'Delete this transfer?' });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(confirm).toContainText(`₱1,250.50 from ${senderName} to ${receiverName}`);
  await expectNoAxeViolations(page);

  await confirm.getByRole('button', { name: 'Delete Transfer' }).click();

  await expect(confirm).toBeHidden();
  await expect(page.getByText('Transfer deleted')).toBeVisible();
  await expect(page.getByText('It no longer counts toward any balance.')).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect
    .poll(() => page.evaluate<string>(focusCheckScript(labelsBefore, ownLabel)), {
      message: 'focus is on the next row action, else the previous one',
    })
    .toBe('as expected');

  // Show deleted brings it back as a deleted row with Remove Permanently (never a restore or an edit); the stronger confirm removes it.
  await page.getByRole('checkbox', { name: 'Show deleted' }).check();
  await expect.poll(() => new URL(page.url()).searchParams.get('deleted')).toBe('true');
  await expect(row).toHaveCount(1);
  await expect(row.getByText('Deleted', { exact: true })).toBeVisible();
  await expect(row).toContainText(`Deleted by ${senderName}`);
  await expect(page.getByRole('button', { name: /restore|edit/i })).toHaveCount(0);
  await row.getByRole('button', { name: /^Remove transfer of ₱1,250\.50 from .* permanently$/ }).click();
  const strong = page.getByRole('dialog', { name: 'Permanently remove this transfer?' });
  await expect(strong).toBeVisible();
  await expect(strong.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(strong).toContainText("This can't be undone.");
  await expect(strong).toContainText(`₱1,250.50 from ${senderName} to ${receiverName}`);
  await expect(strong).toContainText(
    "Balances don't change. Only the record is removed. A copy stays in the audit log.",
  );
  await expectNoAxeViolations(page);

  await strong.getByRole('button', { name: 'Remove Permanently' }).click();

  await expect(strong).toBeHidden();
  await expect(page.getByText('Transfer removed for good')).toBeVisible();
  await expect(page.getByText("Balances didn't change.")).toBeVisible();
  await expect(row).toHaveCount(0);

  // The sender is back to 5,000.00 on My Money, and the receiver holds nothing again.
  await page.goto('/admin/money');
  await expect(page.getByRole('region', { name: 'Money on hand' })).toContainText('₱5,000.00');
  const other = await signInSecondPerson(browser, baseURL, request, receiver);
  try {
    const [answer] = await Promise.all([
      other.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/staff-money/me'),
      other.page.reload(),
    ]);
    expect(answer.status(), 'GET /api/v1/staff-money/me').toBe(200);
    const body = (await answer.json()) as { balance: number | string };
    expect(Number(body.balance)).toBe(0);
    await other.finish();
  } finally {
    await other.context.close();
  }
});

test("@money a Manager hands over a leaver's money from All Staff, and an Admin who opens that person's page lands on My Money", async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mara', lastName: `Boss${token}` });
  const leaver = await createStaff(request, 'Admin', undefined, { firstName: 'Joel', lastName: `Leaver${token}` });
  const receiver = await createStaff(request, 'Admin', undefined, { firstName: 'Rina', lastName: `Recv${token}` });
  const leaverName = `Joel Leaver${token}`;
  const receiverName = `Rina Recv${token}`;
  await seedPaymentTo(request, leaver);
  await signInAs(page, request, manager);

  // The Manager deactivates the person in Users: they now hold 5,000.00 as a leaver.
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await page.getByPlaceholder('Name or email').fill(leaver.email);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await press(page, page.locator('tbody tr').first().getByRole('button', { name: 'Deactivate Joel', exact: true }));
  await page
    .getByRole('dialog', { name: `Deactivate ${leaverName}?` })
    .getByRole('button', { name: 'Deactivate User' })
    .click();
  await expect(page.getByText('User deactivated')).toBeVisible();

  // All Staff lists the leaver after the active people, deactivated, holding 5,000.00, with Hand Over.
  await page.goto('/admin/money?tab=staff');
  await expect(page.getByRole('tab', { name: 'All Staff' })).toHaveAttribute('aria-selected', 'true');
  const staffTable = page.getByRole('table', { name: 'Staff money on hand' });
  const leaverRow = staffTable.getByRole('row').filter({ hasText: leaverName });
  await expect(leaverRow).toContainText('Deactivated');
  await expect(leaverRow).toContainText('₱5,000.00');
  await expectNoAxeViolations(page);

  // Hand Over opens the window for that person, with the Manager first in To and nothing chosen.
  await leaverRow.getByRole('button', { name: `Hand over money from ${leaverName}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Hand Over Money' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`From ${leaverName} (deactivated). They hold ₱5,000.00.`)).toBeVisible();
  const to = dialog.getByLabel(/^To/);
  await expect(to).toBeEnabled();
  await expect(to).toBeFocused();
  await expect(to).toHaveValue('');
  await expect(to.locator('option').nth(1)).toHaveText(`Mara Boss${token} (you)`);
  await expect(dialog.getByText(`${leaverName} holds ₱5,000.00.`)).toBeVisible();
  await expect(dialog.getByText('Enter the amount.')).toBeHidden();
  // More than the leaver holds is refused in the browser before any request.
  await to.selectOption({ label: receiverName });
  await dialog.getByLabel(/^Amount/).fill('5000.01');
  await dialog.getByRole('button', { name: 'Record Handover' }).click();
  await expect(dialog.getByText(`${leaverName} only has ₱5,000.00 on hand.`)).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill('5000');
  await expectNoAxeViolations(page);

  await dialog.getByRole('button', { name: 'Record Handover' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Handover recorded')).toBeVisible();
  await expect(page.getByText(`${leaverName} now holds ₱0.00.`)).toBeVisible();
  // The leaver holds nothing, so All Staff no longer lists them or offers Hand Over; focus goes to the table caption.
  await expect(staffTable.getByRole('row').filter({ hasText: leaverName })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Hand over money from ${leaverName}` })).toHaveCount(0);
  await expect(page.locator('caption', { hasText: 'Staff money on hand' })).toBeFocused();
  // The receiver now holds the amount.
  await expect(staffTable.getByRole('row').filter({ hasText: receiverName })).toContainText('₱5,000.00');

  // An Admin who opens a person's page is sent to My Money before any request for that person.
  const other = await signInSecondPerson(browser, baseURL, request, receiver);
  try {
    await other.page.goto(`/admin/money/staff/${leaver.userId}`);
    await expect(other.page.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
    await expect(other.page).toHaveURL(/\/admin\/money$/);
    await expect(other.page.getByRole('tab')).toHaveCount(0);
    await other.finish();
  } finally {
    await other.context.close();
  }
});

/** What the ledger shows at tablet width: the card, its table frame and the Balance header, as the browser lays them out. */
interface LedgerFit {
  readonly frameScroll: number;
  readonly frameWidth: number;
  readonly balanceRight: number;
  readonly cardRight: number;
  readonly pageScrollsSideways: boolean;
}

const READ_LEDGER_FIT = `(() => {
  const table = document.querySelector('table');
  const frame = table?.parentElement;
  const card = table?.closest('section');
  const balance = Array.from(table?.querySelectorAll('th') ?? []).find((cell) => cell.textContent === 'Balance');
  if (!table || !frame || !card || !balance) return null;
  return {
    frameScroll: frame.scrollWidth,
    frameWidth: frame.clientWidth,
    balanceRight: balance.getBoundingClientRect().right,
    cardRight: card.getBoundingClientRect().right,
    pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`;

/** Opens My Money at 768 x 1024 and reads how the ledger sits in its card. */
async function readLedgerFitAt768(page: Page): Promise<LedgerFit> {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/admin/money');
  await expect(page.getByRole('table', { name: 'Ledger' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ledger' }).getByRole('row')).not.toHaveCount(1);
  const fit = await page.evaluate<LedgerFit | null>(READ_LEDGER_FIT);
  if (fit === null) throw new Error('The ledger table, its card or the Balance header is missing.');
  return fit;
}

/** The ledger holds its content: the frame does not scroll, the Balance header is inside the card, and the page does not scroll sideways. */
function expectLedgerFits(fit: LedgerFit): void {
  expect(fit.frameScroll, 'the ledger frame scrolls sideways').toBeLessThanOrEqual(fit.frameWidth);
  expect(fit.balanceRight, 'the Balance header sticks out of the card').toBeLessThanOrEqual(fit.cardRight + 0.5);
  expect(fit.pageScrollsSideways, 'the page scrolls sideways').toBe(false);
}

test('@money the ledger fits its card at 768px for a Manager and an Admin', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mina', lastName: `Wide${token}` });
  const admin = await createStaff(request, 'Admin', undefined, { firstName: 'Ador', lastName: `Wide${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Rina', lastName: `Recv${token}` });
  // A six-digit payment row, then a transfer row: the Manager's ledger also gets the Actions column on the transfer.
  const today = manilaDate(-1);
  for (const person of [manager, admin]) {
    await createOrder(request, {
      number: `ORD-2096-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
      customerName: 'E2E Wide Ledger Customer',
      orderDate: today,
      items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E wide jersey', quantity: 1, unitPrice: 126_450 }],
      payments: [{ paymentDate: today, amount: 126_450, paymentMethodId: CASH_ID, receivedByUserId: person.userId }],
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInAs(page, request, manager);
  await recordTransfer(page, `Rina Recv${token}`, '1250.50');

  const managerFit = await readLedgerFitAt768(page);
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  expectLedgerFits(managerFit);
  await expectNoAxeViolations(page);

  const other = await signInSecondPerson(browser, baseURL, request, admin);
  try {
    await other.page.setViewportSize({ width: 1280, height: 800 });
    await recordTransfer(other.page, `Rina Recv${token}`, '2500');
    const adminFit = await readLedgerFitAt768(other.page);
    await expect(other.page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
    expectLedgerFits(adminFit);
    await expectNoAxeViolations(other.page);
    await other.finish();
  } finally {
    await other.context.close();
  }
});
