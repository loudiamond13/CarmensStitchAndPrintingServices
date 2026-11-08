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
  // With the Manager tabs above it, Show deleted sits under the phone tab bar when the page is at the top; axe measures a target's size
  // against what covers it, so the page is scrolled down a little first, which brings the box clear of the bar.
  await page.evaluate<boolean>('(() => { window.scrollBy(0, 300); return true; })()');
  await expectNoAxeViolations(page);
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
