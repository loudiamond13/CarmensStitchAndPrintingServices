// Two staff members on one order end to end (ORD-07, D-94 to D-96; plan 08-29, gap G-08-5), in all five projects. Person A works in the
// test's own page; person B works in a second browser context and changes the order behind A's open window. The payment cap then follows
// the current order (D-95), the open window follows B's change when A's tab regains focus (D-95), and the status menu reads the order
// when it opens (D-96). The shared CSPS_E2E database keeps what earlier runs made, so each check seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

/** The second person: a signed-in page in its own context, and what its console and page errors reported. */
interface SecondPerson {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly findings: string[];
}

/** The one failed load B's sign-in page is expected to log: the refresh cookie check before any session exists. */
function isSignInRefreshLoad(text: string, url: string): boolean {
  return url.includes('/api/v1/auth/refresh') && text.includes('401');
}

/** Opens a second context, signs the person in, and watches its page for console errors and page errors. */
async function signInSecondPerson(
  browser: Browser,
  baseURL: string | undefined,
  request: APIRequestContext,
  staff: TestStaff,
): Promise<SecondPerson> {
  const context = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const findings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !isSignInRefreshLoad(message.text(), message.location().url)) {
      findings.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    findings.push(`pageerror: ${error.message}`);
  });
  await signInAs(page, request, staff);
  return { context, page, findings };
}

/** Person B removes one payment from the Payments tab and waits for the toast. */
async function deletePayment(page: Page, orderId: string, amount: string): Promise<void> {
  await page.goto(`/admin/orders/${orderId}?tab=payments`);
  await page.getByRole('button', { name: new RegExp(`^Delete payment of ${amount}, `) }).click();
  await page
    .getByRole('dialog', { name: `Delete payment of ${amount}?` })
    .getByRole('button', { name: 'Delete Payment' })
    .click();
  await expect(page.getByText('Payment deleted')).toBeVisible();
}

/** The page script that tells TanStack's focus manager the tab is visible again. */
const TAB_REGAINS_FOCUS = "document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))";

function orderNumber(): string {
  return `ORD-2093-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

test('@orders-two-staff a payment the old figures refused goes through after the window reads the order, and the server still guards the version', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // B's delete made A's opened version old, so the server answers the first save with a 409 on purpose.
  guard.expectStatus('/payments', 409);
  const token = randomUUID().slice(0, 8);
  const first = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `One${token}` });
  const second = await createStaff(request, 'Manager', undefined, { firstName: 'Nico', lastName: `Two${token}` });
  const number = orderNumber();
  // 12 x 780 = 9,360.00 with 3,000.00 paid: 6,360.00 due.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Two Staff Customer',
    teamName: 'E2E Two Staff Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E two staff jersey', quantity: 12, unitPrice: 780 }],
    payments: [{ paymentDate: manilaDate(-2), amount: 3000, paymentMethodId: CASH_ID, receivedByUserId: first.userId }],
  });
  await signInAs(page, request, first);
  const other = await signInSecondPerson(browser, baseURL, request, second);
  try {
    await page.goto(`/admin/orders/${id}?tab=payments`);
    await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
    const totals = page.getByRole('region', { name: 'Totals' });
    await expect(totals).toContainText('₱6,360.00');

    await page.getByRole('button', { name: 'Add Payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Payment' });
    await expect(dialog.getByText('Balance due: ₱6,360.00')).toBeVisible();
    await expectNoAxeViolations(page);

    // B removes the 3,000.00 payment while A's window is open, so 8,000.00 is now within the balance.
    await deletePayment(other.page, id, '₱3,000.00');

    // The held figures refuse 8,000.00; the window reads the order, the check passes, and the save sends the opened version.
    await dialog.getByLabel(/^Amount/).fill('8000');
    await dialog.getByLabel(/^Method/).selectOption({ label: 'Cash' });
    await dialog.getByRole('button', { name: 'Save Payment' }).click();
    await expect(dialog.getByText('This was changed by someone else.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Load Latest' })).toBeVisible();
    await expect(dialog.getByLabel(/^Amount/)).toHaveValue('8000.00');

    // Load Latest keeps the typed values and takes the current version; the second save goes through.
    await dialog.getByRole('button', { name: 'Load Latest' }).click();
    await expect(dialog.getByText('Latest version loaded. What you typed is kept.')).toBeVisible();
    await expect(dialog.getByLabel(/^Amount/)).toHaveValue('8000.00');
    await expect(dialog.getByLabel(/^Method/)).toHaveValue(CASH_ID);
    await dialog.getByRole('button', { name: 'Save Payment' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Payment added')).toBeVisible();
    await expect(page.getByText('Balance now ₱1,360.00.')).toBeVisible();
    await expect(totals).toContainText('₱1,360.00');
    expect(other.findings).toEqual([]);
  } finally {
    await other.context.close();
  }
});

test('@orders-two-staff an open Add Payment window shows the balance the other person left when the tab regains focus', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const first = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Fcs${token}` });
  const second = await createStaff(request, 'Manager', undefined, { firstName: 'Nico', lastName: `Oth${token}` });
  const number = orderNumber();
  // 12 x 780 = 9,360.00 with 3,000.00 paid: 6,360.00 due.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Two Staff Customer',
    teamName: 'E2E Two Staff Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E two staff jersey', quantity: 12, unitPrice: 780 }],
    payments: [{ paymentDate: manilaDate(-2), amount: 3000, paymentMethodId: CASH_ID, receivedByUserId: first.userId }],
  });
  await signInAs(page, request, first);
  const other = await signInSecondPerson(browser, baseURL, request, second);
  try {
    await page.goto(`/admin/orders/${id}?tab=payments`);
    await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
    await page.getByRole('button', { name: 'Add Payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Payment' });
    await expect(dialog.getByText('Balance due: ₱6,360.00')).toBeVisible();

    await deletePayment(other.page, id, '₱3,000.00');
    // Nothing has moved on A's side yet: the held figures are still the old ones.
    await expect(dialog.getByText('Balance due: ₱6,360.00')).toBeVisible();

    await page.evaluate(TAB_REGAINS_FOCUS);
    await expect(dialog.getByText('Balance due: ₱9,360.00')).toBeVisible();
    expect(other.findings).toEqual([]);
  } finally {
    await other.context.close();
  }
});

test('@orders-two-staff Mark Completed turns on after the other person records the last payment, and completes the order', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const first = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Cmp${token}` });
  const second = await createStaff(request, 'Manager', undefined, { firstName: 'Nico', lastName: `Pay${token}` });
  const number = orderNumber();
  // 12 x 780 = 9,360.00 with 9,000.00 paid: 360.00 due.
  const id = await createOrder(request, {
    number,
    status: 'delivered',
    customerName: 'E2E Two Staff Customer',
    teamName: 'E2E Two Staff Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E two staff jersey', quantity: 12, unitPrice: 780 }],
    payments: [{ paymentDate: manilaDate(-2), amount: 9000, paymentMethodId: CASH_ID, receivedByUserId: first.userId }],
  });
  await signInAs(page, request, first);
  const other = await signInSecondPerson(browser, baseURL, request, second);
  try {
    await page.goto(`/admin/orders/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Totals' })).toContainText('₱360.00');

    // B records the last 360.00 while A's page still holds the old balance.
    await other.page.goto(`/admin/orders/${id}?tab=payments`);
    await other.page.getByRole('button', { name: 'Add Payment' }).click();
    const add = other.page.getByRole('dialog', { name: 'Add Payment' });
    await add.getByLabel(/^Amount/).fill('360');
    await add.getByLabel(/^Method/).selectOption({ label: 'Cash' });
    await add.getByRole('button', { name: 'Save Payment' }).click();
    await expect(add).toBeHidden();
    await expect(other.page.getByText('Order is now fully paid.')).toBeVisible();

    // A opens Change Status: the menu reads the order, and Mark Completed is on with no reason line.
    await page.getByRole('button', { name: 'Change Status' }).click();
    const menu = page.getByRole('menu', { name: 'Change Status' });
    const item = menu.getByRole('menuitem', { name: 'Mark Completed' });
    await expect(item).not.toHaveAttribute('aria-disabled', 'true');
    await expect(menu.getByText('Balance must be ₱0.00 to complete.')).toHaveCount(0);
    await item.click();
    await expect(page.getByText('Order completed')).toBeVisible();
    await expect(page.getByText('This order is completed.')).toBeVisible();
    expect(other.findings).toEqual([]);
  } finally {
    await other.context.close();
  }
});
