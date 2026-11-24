// Turn into Order E2E (INQ-06, D-20, D-21; UI-SPEC R2, R3). A request sent through the public form API becomes a saved order from
// its page: the New Order form opens filled in, staff add one item with a price and save, and the request turns Converted.
// The fixture guard fails a test on any console error, CSP violation or undeclared failed response. Each test makes its own request
// with a unique name, because the shared CSPS_E2E database keeps what other specs made.
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { createQuoteRequest, createStaff } from './testing-api.ts';

/** A Philippine mobile number nobody used before in this run, so the per-sender limit never meets it. */
function freshMobile(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
  return `09${tail}`;
}

test('@quote staff turn a request into an order', async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  const name = `E2E Convert ${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  const id = await createQuoteRequest(request, {
    customerName: name,
    contactNumber: freshMobile(),
    teamName: 'E2E Convert Riders',
    message: 'Twelve jerseys, numbers 1 to 12.',
  });

  await page.goto(`/admin/quote-requests/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('link', { name: 'Turn into Order' }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/orders/new\\?fromRequest=${id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await expect(page.getByLabel(/^Customer name/)).toHaveValue(name);
  await expect(page.getByLabel(/^Team \/ organization/)).toHaveValue('E2E Convert Riders');
  await expect(page.getByLabel(/^Notes/)).toHaveValue('Twelve jerseys, numbers 1 to 12.');
  await expect(page.getByText(/^Filled in from the quote request from /)).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  await page.getByLabel(/^Due date/).fill(manilaDate(5));
  await page.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await page.getByLabel(/^Description/).fill('E2E convert jersey');
  await page.getByLabel(/^Qty/).fill('12');
  await page.getByLabel(/^Unit price/).fill('780');
  await page.getByRole('button', { name: 'Save Order' }).click();

  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
  const orderUrl = page.url();
  const heading = page.getByRole('heading', { level: 1, name: /^ORD-\d{4}-\d{4,}$/ });
  await expect(heading).toBeVisible();
  const number = (await heading.textContent()) ?? '';
  await expect(page.getByText('The quote request is now Converted.')).toBeVisible();

  // D-21: the order points at its request, and the request at its order.
  const customer = page.getByRole('region', { name: 'Customer' });
  await expect(customer.getByText('From quote request')).toBeVisible();
  await customer.getByRole('link', { name: 'View Request' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/quote-requests/${id}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  const open = page.getByRole('link', { name: `Open Order ${number}` });
  await expect(open).toHaveAttribute('href', new URL(orderUrl).pathname);
  await expect(page.getByRole('link', { name: 'Turn into Order' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change Status' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'History' })).toContainText(`Converted to order ${number}`);
  await expectNoAxeViolations(page);
});
