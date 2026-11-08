// Staff money end to end (MONEY-04, MONEY-05, SEC-06; plan 10-15), in all five projects. A fresh staff member who holds money from a payment
// sends part of it to a coworker from the dashboard strip, sees the server's new balance, and the coworker holds the amount. Every test runs
// under the shared guard (console, page errors, CSP, failed responses), the second person's page included. The shared CSPS_E2E database
// holds what other specs made, so nothing here asserts a shop-wide figure: only the money of the two fresh people this test makes
// (RESEARCH Pitfall 11).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, guardContext, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
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
