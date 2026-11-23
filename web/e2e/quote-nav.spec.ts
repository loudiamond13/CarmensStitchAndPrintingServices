// Quote Requests nav count E2E (INQ-05, D-14, D-19; UI-SPEC R4). The shared CSPS_E2E database keeps what earlier runs made, and
// other specs may send requests at the same time, so each check compares the page with the count answer it just read.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { createQuoteRequest, createStaff } from './testing-api.ts';

/** A Philippine mobile number nobody used before in this run, so the per-sender limit never meets it. */
function freshMobile(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
  return `09${tail}`;
}

/** A fake visitor name no other run used. */
function uniqueName(): string {
  return `E2E Visitor ${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

/** The chip text for a count: the number, or "99+" above 99. */
function chip(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** Opens an admin path and returns the New count the shell read with it. */
async function openWithCount(page: Page, path: string): Promise<number> {
  const read = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/quote-requests/new-count' && response.request().method() === 'GET',
  );
  await page.goto(path);
  const response = await read;
  expect(response.status(), 'GET /api/v1/quote-requests/new-count').toBe(200);
  const body: unknown = await response.json();
  const count = typeof body === 'object' && body !== null && 'count' in body ? Number(body.count) : Number.NaN;
  if (!Number.isInteger(count)) {
    throw new Error('GET /api/v1/quote-requests/new-count returned an unexpected body.');
  }
  return count;
}

test('@quote the nav shows the new count', async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  const before = await openWithCount(page, '/admin');

  for (let n = 0; n < 2; n += 1) {
    await createQuoteRequest(request, { customerName: uniqueName(), contactNumber: freshMobile() });
  }
  const after = await openWithCount(page, '/admin');

  expect(after, 'the two new requests are counted').toBeGreaterThanOrEqual(before + 2);
  const side = page.locator('[data-ui="s-admin-side"]');
  const item = side.getByRole('link', { name: `Quote Requests, ${chip(after)} new`, exact: true });
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('href', '/admin/quote-requests');
  await expect(item).toContainText(chip(after));
  // It sits right after Orders.
  const names = await side.getByRole('navigation', { name: 'Admin' }).getByRole('link').allTextContents();
  expect(names.indexOf(names.find((name) => name.startsWith('Quote Requests')) ?? '')).toBe(
    names.indexOf('Orders') + 1,
  );

  // The inbox marks the item current. The count may have moved since, so the item is found by its address.
  await page.goto('/admin/quote-requests');
  await expect(side.locator('a[href="/admin/quote-requests"]')).toHaveAttribute('aria-current', 'page');
});
