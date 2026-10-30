// The five Phase 8 success criteria end to end in a real browser (ORD-01, ORD-02, ORD-06, ORD-07, ORD-10 to ORD-12, ORD-15, ORD-19;
// plan 08-24), in all five projects: find an order, create one, work its detail page, see the internal figures only there, and delete
// it safely. Every journey runs under the shared guard (console, page errors, CSP, failed responses) and checks axe on its main
// screens. The shared CSPS_E2E database keeps what earlier runs made, so each journey seeds its own orders by a unique number.
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

/** The seeded Cash payment method (the id is the fixed migration seed literal). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';

/** A unique order number for one journey. */
function uniqueNumber(year: number): string {
  return `ORD-${String(year)}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

/** "₱9,360.00": a figure as the page shows money (formatting only, no arithmetic). */
function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The server's figures of one order, as an order answer carries them. */
interface Figures {
  readonly total: number | string;
  readonly paid: number | string;
  readonly balance: number | string;
  readonly discount: number | string;
  readonly expenses: number | string;
  readonly profit: number | string;
}

function isMoney(value: unknown): value is number | string {
  return typeof value === 'number' || typeof value === 'string';
}

/** Reads the totals out of an order answer. */
function figuresOf(body: unknown): Figures {
  const totals =
    typeof body === 'object' && body !== null && 'totals' in body && typeof body.totals === 'object'
      ? body.totals
      : null;
  if (
    totals !== null &&
    'total' in totals &&
    isMoney(totals.total) &&
    'paid' in totals &&
    isMoney(totals.paid) &&
    'balance' in totals &&
    isMoney(totals.balance) &&
    'discount' in totals &&
    isMoney(totals.discount) &&
    'expenses' in totals &&
    isMoney(totals.expenses) &&
    'profit' in totals &&
    isMoney(totals.profit)
  ) {
    return {
      total: totals.total,
      paid: totals.paid,
      balance: totals.balance,
      discount: totals.discount,
      expenses: totals.expenses,
      profit: totals.profit,
    };
  }
  throw new Error('The order answer carried no totals.');
}

/** Runs a save and returns the server's figures from the write's answer, so the panel can be held against them (D-09). */
async function saveAndRead(page: Page, orderId: string, act: () => Promise<void>): Promise<Figures> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() !== 'GET' && new URL(response.url()).pathname.startsWith(`/api/v1/orders/${orderId}`),
  );
  await act();
  const response = await answered;
  expect(response.status(), `${response.request().method()} ${response.url()}`).toBeLessThan(300);
  return figuresOf(await response.json());
}

/** The Totals panel shows the server's total, paid, balance, discount, expenses and profit. */
async function expectPanel(totals: Locator, figures: Figures): Promise<void> {
  for (const value of [
    figures.total,
    figures.paid,
    figures.balance,
    figures.discount,
    figures.expenses,
    figures.profit,
  ]) {
    await expect(totals).toContainText(peso(value));
  }
}

/** A fresh access token from the signed-in page's refresh cookie, for calls made around the screen. */
async function accessToken(page: Page): Promise<string> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  return session.accessToken;
}

/** Opens the order from its card on the filtered Orders list, so the page knows the list address to return to. */
async function openFromList(page: Page, number: string): Promise<void> {
  await page.goto(`/admin/orders?q=${number}`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: `View order ${number}`, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
}

interface ListBody {
  readonly total: number;
  readonly items: readonly { readonly number: string }[];
}

/** Starts waiting for a list answer whose request passes the check (start it before the action that causes the request). */
function listAnswer(page: Page, matches: (url: URL) => boolean): Promise<ListBody> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/orders' &&
      matches(new URL(response.url())),
  );
  return answered.then(async (response) => (await response.json()) as ListBody);
}

test('@orders-journeys SC1 find: search by phone, filter, sort, page, keep the Table view, see Fully Paid and an overdue flag', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const run = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  const phone = `0917${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
  const numberOf = (index: number): string => `ORD-2086-${run}${index.toString(36).toUpperCase()}`;

  // Twelve orders for one phone. 0 is Delivered and unpaid (2,500.00 due in 20 days); 1 is Delivered and paid in full; 2 is
  // Delivered and unpaid (4,000.00); 3 is Pending and due 3 days ago; 4 to 11 are Pending and unpaid. Delivered orders carry no due flag.
  const seed = (index: number): Promise<string> =>
    createOrder(request, {
      number: numberOf(index),
      status: index <= 2 ? 'delivered' : 'pending',
      customerName: `E2E Find ${String(index)}`,
      teamName: 'E2E Find Team',
      contactNumber: phone,
      orderDate: manilaDate(-10),
      dueDate: index === 3 ? manilaDate(-3) : manilaDate(20),
      items: [
        {
          productTypeId: BASKETBALL_JERSEY_ID,
          description: 'E2E find jersey',
          quantity: index === 2 ? 8 : 5,
          unitPrice: 500,
        },
      ],
      ...(index === 1
        ? {
            payments: [
              {
                paymentDate: manilaDate(-1),
                amount: 2500,
                paymentMethodId: CASH_ID,
                receivedByUserId: manager.userId,
              },
            ],
          }
        : {}),
    });
  await Promise.all(Array.from({ length: 12 }, (_, index) => seed(index)));
  await signInAs(page, request, manager);

  const cards = page.getByRole('article');
  const pagination = page.getByRole('navigation', { name: 'Pagination' });

  const first = listAnswer(page, () => true);
  await page.goto('/admin/orders?size=10');
  await first;
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();

  // Search by the phone number: 12 orders, two pages.
  const searched = listAnswer(page, (url) => url.searchParams.get('q') === phone);
  await page.getByPlaceholder('Order no., customer, team or phone').fill(phone);
  expect((await searched).total).toBe(12);
  await expect(page.getByText(`Search: ${phone}`)).toBeVisible();
  await expect(cards).toHaveCount(10);
  await expect(pagination).toContainText('Page 1 of 2');
  // Soonest due comes first: the late Pending order carries its overdue flag.
  await expect(cards.first()).toContainText(numberOf(3));
  await expect(cards.first()).toContainText('Overdue by 3 days');
  await expectNoAxeViolations(page);

  // Page 2 holds the last two.
  const second = listAnswer(page, (url) => url.searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Next page' }).click();
  expect((await second).items).toHaveLength(2);
  await expect(pagination).toContainText('Page 2 of 2');
  await expect(cards).toHaveCount(2);

  // Delivered: three orders back on page 1; the paid one says Fully Paid and the late one names the days.
  const delivered = listAnswer(page, (url) => url.searchParams.get('status') === 'delivered');
  await page.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Delivered' });
  expect((await delivered).total).toBe(3);
  await expect(cards).toHaveCount(3);
  await expect(cards.filter({ hasText: numberOf(1) })).toContainText('Fully Paid');
  await expect(cards.filter({ hasText: numberOf(0) })).not.toContainText('Fully Paid');

  // Only orders with a balance, then the highest balance first: 4,000.00 before 2,500.00.
  const owing = listAnswer(page, (url) => url.searchParams.get('hasBalance') === 'true');
  await page.getByRole('checkbox', { name: 'Only orders with a balance' }).check();
  expect((await owing).total).toBe(2);
  const byBalance = listAnswer(page, (url) => url.searchParams.get('sort') === 'balance');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Balance (highest)' });
  expect((await byBalance).items.map((item) => item.number)).toEqual([numberOf(2), numberOf(0)]);
  await expect(page.getByText(/^Showing/)).toHaveText('Showing 2 orders · sorted by balance');
  await expect(cards.first()).toContainText(numberOf(2));
  await expect(cards.first()).toContainText(peso(4000));

  // Table: the choice shows in the address and survives a reload.
  const tableChoice = page.getByRole('radio', { name: 'Table view' });
  await tableChoice.click();
  await expect(tableChoice).toBeChecked();
  // The address is written a moment after the screen changes.
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('table');
  await expect(page.getByRole('row').filter({ hasText: numberOf(2) })).toContainText(peso(4000));
  // A phone card can sit right above the fixed tab bar, which axe reads as too little room round its link; centre it first.
  await page.evaluate(`(() => {
    const link = [...document.querySelectorAll('a')].find((anchor) => anchor.textContent.trim() === ${JSON.stringify(numberOf(2))});
    link.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  })()`);
  await expectNoAxeViolations(page);
  await page.reload();
  await expect(tableChoice).toBeChecked();
  await expect(page.getByRole('row').filter({ hasText: numberOf(2) })).toHaveCount(1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // The fully paid order reads Fully Paid in the table too.
  await page.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Delivered' });
  await page.getByRole('checkbox', { name: 'Only orders with a balance' }).uncheck();
  await expect(page.getByRole('row').filter({ hasText: numberOf(1) })).toContainText('Fully Paid');
});

test('@orders-journeys SC2 create: fill the New Order form, save, land on the order, and Discard changes guards a dirty form', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const customer = `E2E Journey ${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  await signInAs(page, request, manager);

  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Leaving a dirty form asks first; Keep Editing keeps what was typed.
  await page.getByLabel(/^Customer name/).fill(customer);
  const orders = page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders' }).first();
  await orders.click();
  const question = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(question).toBeVisible();
  await expect(question.getByRole('button', { name: 'Keep Editing' })).toBeFocused();
  await expectNoAxeViolations(page);
  await question.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(question).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/orders\/new$/);
  await expect(page.getByLabel(/^Customer name/)).toHaveValue(customer);

  // Finish the form and save: the order page opens with the toast and the server's total.
  await page.getByLabel(/^Team \/ organization/).fill('E2E Journey Team');
  await page.getByLabel(/^Contact number/).fill('0917 000 0000');
  await page.getByLabel(/^Due date/).fill(manilaDate(7));
  await page.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await page.getByLabel(/^Description/).fill('E2E journey jersey');
  await page.getByLabel(/^Qty/).fill('12');
  await page.getByLabel(/^Unit price/).fill('780');
  await page.getByRole('button', { name: 'Save Order' }).click();

  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: /^ORD-\d{4}-\d{4,}$/ })).toBeVisible();
  await expect(page.getByText('Order saved')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Totals' })).toContainText(peso(9360));
  await expect(page.getByRole('table', { name: 'Order items' })).toContainText('E2E journey jersey');
  await expectNoAxeViolations(page);

  // The saved order is in the list, found by its customer.
  await page.goto(`/admin/orders?q=${customer.replaceAll(' ', '+')}`);
  await expect(page.getByRole('article').filter({ hasText: customer })).toHaveCount(1);
});

test('@orders-journeys SC3 work: items, a payment, a discount and an expense each save to the server figures, and a stale edit keeps the typed values', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mira', lastName: `Rec${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Ana', lastName: `Got${token}` });
  const coworker = `Ana Got${token}`;
  const number = uniqueNumber(2085);
  // 12 x 780 = 9,360.00 with nothing paid, discounted or spent.
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Work Customer',
    teamName: 'E2E Work Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E base jersey', quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText(peso(9360));

  // Items: add, edit, then see who recorded and changed it.
  const itemDialog = page.getByRole('dialog', { name: 'Add Item' });
  await page.getByRole('button', { name: 'Add Item' }).click();
  await itemDialog.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await itemDialog.getByLabel(/^Description/).fill('E2E extra shorts');
  await itemDialog.getByLabel(/^Quantity/).fill('10');
  await itemDialog.getByLabel(/^Unit price/).fill('500');
  let figures = await saveAndRead(page, id, () => itemDialog.getByRole('button', { name: 'Save Item' }).click());
  await expect(itemDialog).toBeHidden();
  await expect(page.getByText('Item added')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.total)).toBe(14360);

  const editDialog = page.getByRole('dialog', { name: 'Edit Item' });
  await page.getByRole('button', { name: 'Edit item 2, E2E extra shorts' }).click();
  await expect(editDialog.getByText('Recorded by')).toBeVisible();
  await expect(editDialog.getByText('Last changed by')).toBeVisible();
  await editDialog.getByLabel(/^Quantity/).fill('8');
  figures = await saveAndRead(page, id, () => editDialog.getByRole('button', { name: 'Save Item' }).click());
  await expect(editDialog).toBeHidden();
  await expect(page.getByText('Item updated')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.total)).toBe(13360);

  // A stale edit: another person changes the first item while this window is open. The save is refused, the typed value stays,
  // and Load Latest brings the other person's change (SEC-07).
  guard.expectStatus(`/api/v1/orders/${id}/items/`, 409);
  await page.getByRole('button', { name: 'Edit item 1, E2E base jersey' }).click();
  await editDialog.getByLabel(/^Quantity/).fill('11');
  const bearer = { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${await accessToken(page)}` };
  const current = (await (await page.request.get(`/api/v1/orders/${id}`, { headers: bearer })).json()) as {
    version: string;
    items: { id: string; description: string }[];
  };
  const baseItem = current.items.find((item) => item.description === 'E2E base jersey');
  if (baseItem === undefined) {
    throw new Error('The base item is missing from the order.');
  }
  const changedBehind = await page.request.put(`/api/v1/orders/${id}/items/${baseItem.id}`, {
    headers: bearer,
    data: {
      productTypeId: BASKETBALL_JERSEY_ID,
      description: 'E2E base jersey v2',
      sizeVariant: null,
      quantity: 12,
      unitPrice: 780,
      version: current.version,
    },
  });
  expect(changedBehind.status(), 'PUT item through the API').toBe(200);
  await editDialog.getByRole('button', { name: 'Save Item' }).click();
  await expect(editDialog.getByText('This was changed by someone else.')).toBeVisible();
  await expect(editDialog.getByLabel(/^Quantity/)).toHaveValue('11');
  await expect(editDialog).toBeVisible();
  await expectNoAxeViolations(page);
  await editDialog.getByRole('button', { name: 'Load Latest' }).click();
  await expect(editDialog.getByLabel(/^Description/)).toHaveValue('E2E base jersey v2');
  await editDialog.getByLabel(/^Quantity/).fill('11');
  figures = await saveAndRead(page, id, () => editDialog.getByRole('button', { name: 'Save Item' }).click());
  await expect(editDialog).toBeHidden();
  await expectPanel(totals, figures);
  // 11 x 780 = 8,580.00 and 8 x 500 = 4,000.00.
  expect(Number(figures.total)).toBe(12580);

  // Items: delete the extra one.
  await page.getByRole('button', { name: 'Delete item 2, E2E extra shorts' }).click();
  const removeDialog = page.getByRole('dialog', { name: 'Delete item "E2E extra shorts"?' });
  figures = await saveAndRead(page, id, () => removeDialog.getByRole('button', { name: 'Delete Item' }).click());
  await expect(removeDialog).toBeHidden();
  await expect(page.getByText('Item deleted')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.total)).toBe(8580);

  // Payments: received by a coworker, recorded by the signed-in Manager.
  await page.getByRole('tab', { name: /^Payments/ }).click();
  await page.getByRole('button', { name: 'Add Payment' }).click();
  const payment = page.getByRole('dialog', { name: 'Add Payment' });
  await payment.getByLabel(/^Amount/).fill('3000');
  await payment.getByLabel(/^Method/).selectOption({ label: 'Cash' });
  await payment.getByLabel(/^Received by/).selectOption({ label: coworker });
  await payment.getByLabel(/^Reference no\./).fill('E2E journey receipt');
  figures = await saveAndRead(page, id, () => payment.getByRole('button', { name: 'Save Payment' }).click());
  await expect(payment).toBeHidden();
  await expect(page.getByText('Payment added')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.paid)).toBe(3000);
  const paymentRow = page
    .getByRole('table', { name: 'Payments' })
    .getByRole('row')
    .filter({ hasText: 'E2E journey receipt' });
  await expect(paymentRow).toContainText(coworker);
  await expect(paymentRow).toContainText('Mira Rec');
  await expectNoAxeViolations(page);

  // Discounts: 5% of 8,580.00 is 429.00.
  await page.getByRole('tab', { name: /^Discounts/ }).click();
  await page.getByRole('button', { name: 'Add Discount' }).click();
  const discount = page.getByRole('dialog', { name: 'Add Discount' });
  await discount.getByLabel(/^Reason/).fill('E2E journey discount');
  await discount.getByRole('radio', { name: 'Percent %' }).click();
  await discount.getByLabel(/^Value/).fill('5');
  await expect(discount.getByText('Computed amount: ₱429.00')).toBeVisible();
  figures = await saveAndRead(page, id, () => discount.getByRole('button', { name: 'Save Discount' }).click());
  await expect(discount).toBeHidden();
  await expect(page.getByText('Discount added')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.discount)).toBe(429);
  expect(Number(figures.total)).toBe(8151);

  // Expenses: paid by a coworker, recorded by the Manager; the profit is the server's.
  await page.getByRole('tab', { name: /^Expenses/ }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  const expense = page.getByRole('dialog', { name: 'Add Expense' });
  await expense.getByLabel(/^Amount/).fill('3825');
  await expense.getByLabel(/^Category/).selectOption({ label: 'Fabric' });
  await expense.getByLabel(/^Description/).fill('E2E journey mesh');
  await expense.getByLabel(/^Paid by/).selectOption({ label: coworker });
  figures = await saveAndRead(page, id, () => expense.getByRole('button', { name: 'Save Expense' }).click());
  await expect(expense).toBeHidden();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expectPanel(totals, figures);
  expect(Number(figures.expenses)).toBe(3825);
  expect(Number(figures.profit)).toBe(4326);
  const expenseRow = page
    .getByRole('table', { name: 'Expenses' })
    .getByRole('row')
    .filter({ hasText: 'E2E journey mesh' });
  await expect(expenseRow).toContainText(coworker);
  await expect(expenseRow).toContainText('Mira Rec');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@orders-journeys SC4 internal figures: Order Expenses and Estimated Profit show on the order page for a Manager and an Admin, and nowhere else', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const admin = await createStaff(request, 'Admin');
  const number = uniqueNumber(2084);
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Internal Customer',
    teamName: 'E2E Internal Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E internal jersey', quantity: 12, unitPrice: 780 }],
    expenses: [
      {
        expenseDate: manilaDate(-2),
        amount: 3825,
        orderExpenseCategoryId: '01a17fce-780b-75d1-89e0-5b3b9b185a2c',
        paidByUserId: manager.userId,
        description: 'E2E internal mesh',
      },
    ],
  });

  const checkAs = async (staff: TestStaff): Promise<void> => {
    await signInAs(page, request, staff);
    await page.goto(`/admin/orders/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
    const totals = page.getByRole('region', { name: 'Totals' });
    await expect(totals).toContainText('Order Expenses');
    await expect(totals).toContainText('Estimated Profit');
    await expect(totals).toContainText(peso(3825));
    await expect(totals).toContainText(peso(5535));
    await expectNoAxeViolations(page);

    // Not on the Orders list, in either view, and not on the public home page.
    await page.goto(`/admin/orders?q=${number}&view=grid`);
    await expect(page.getByRole('article').filter({ hasText: number })).toHaveCount(1);
    await expect(page.getByText(/Order Expenses|Estimated Profit/)).toHaveCount(0);
    await page.getByRole('radio', { name: 'Table view' }).click();
    await expect(page.getByRole('row').filter({ hasText: number })).toHaveCount(1);
    await expect(page.getByText(/Order Expenses|Estimated Profit/)).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Order Expenses|Estimated Profit/)).toHaveCount(0);
  };

  await checkAs(manager);
  // The same page for an Admin, who signs in on a clean browser.
  await page.context().clearCookies();
  await checkAs(admin);
});

test('@orders-journeys SC5 delete safely: a soft delete shows its counts, a Manager restores it, deletes it again and deletes it for good by typing the number', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = uniqueNumber(2083);
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: 'E2E Delete Customer',
    teamName: 'E2E Delete Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E delete jersey', quantity: 12, unitPrice: 780 },
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E delete shorts', quantity: 12, unitPrice: 300 },
    ],
    discounts: [{ kind: 'fixed', value: 360, reason: 'E2E delete discount' }],
    payments: [
      { paymentDate: manilaDate(-2), amount: 1000, paymentMethodId: CASH_ID, receivedByUserId: manager.userId },
    ],
  });
  await signInAs(page, request, manager);

  // The first delete reads what it hides.
  await openFromList(page, number);
  await page.getByRole('button', { name: 'Delete Order' }).click();
  const confirm = page.getByRole('dialog', { name: `Delete ${number}?` });
  await expect(
    confirm.getByText(
      'Its 2 items, 1 payment and 1 discount are hidden from every list and total. A Manager can restore it.',
    ),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Delete Order' }).click();
  await expect(page).toHaveURL(`/admin/orders?q=${number}`);
  await expect(page.getByText(`Order ${number} deleted`)).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: number })).toHaveCount(0);

  // A Manager finds it in Deleted Orders, reads it, and restores it.
  await page.getByRole('link', { name: 'Deleted Orders' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/deleted$/);
  const row = page.getByRole('table', { name: 'Deleted orders' }).getByRole('row').filter({ hasText: number });
  await row.getByRole('link', { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/deleted/${id}$`));
  await expect(page.getByText(/^This order was deleted on .+ by .+\.$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Restore Order' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${id}$`));
  await expect(page.getByText('Order restored')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change Status' })).toBeVisible();

  // Delete it again, then delete it for good: the button stays off until the exact number is typed.
  await page.getByRole('button', { name: 'Delete Order' }).click();
  await confirm.getByRole('button', { name: 'Delete Order' }).click();
  await expect(page.getByText(`Order ${number} deleted`).last()).toBeVisible();
  await page.getByRole('link', { name: 'Deleted Orders' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/deleted$/);
  await row.getByRole('link', { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/deleted/${id}$`));
  await page.getByRole('button', { name: 'Delete Order Permanently' }).click();
  const purge = page.getByRole('dialog', { name: `Delete ${number} permanently?` });
  await expect(purge).toContainText('This will also delete 2 items, 1 payment, and 1 discount.');
  const purgeButton = purge.getByRole('button', { name: 'Delete Order Permanently' });
  await expect(purgeButton).toBeDisabled();
  await purge.getByRole('textbox', { name: `Type ${number} to confirm` }).fill(number);
  await expect(purgeButton).toBeEnabled();
  await expectNoAxeViolations(page);
  await purgeButton.click();
  await expect(page).toHaveURL(/\/admin\/orders\/deleted$/);
  await expect(page.getByText('Order permanently deleted')).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Deleted orders' }).getByRole('row').filter({ hasText: number }),
  ).toHaveCount(0);
});
