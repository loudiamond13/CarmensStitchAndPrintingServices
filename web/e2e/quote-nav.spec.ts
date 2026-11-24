// Quote Requests nav count E2E (INQ-05, D-14, D-19; UI-SPEC R4). The shared CSPS_E2E database keeps what earlier runs made, and
// other specs may send requests at the same time, so each check compares the page with the count answer it just read.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { freshMobile, holdsItsContent, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { createQuoteRequest, createStaff } from './testing-api.ts';

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

test('@quote at 320px the five tabs share the bar, nothing scrolls sideways and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await createQuoteRequest(request, { customerName: uniqueName(), contactNumber: freshMobile() });

  await page.setViewportSize({ width: 320, height: 800 });
  const count = await openWithCount(page, '/admin');
  const bar = page.locator('[data-ui="s-admin-main"] nav[aria-label="Admin"]');
  const tabs = bar.getByRole('link');
  await expect(tabs).toHaveCount(5);
  expect(await tabs.allTextContents()).toEqual([
    'Dashboard',
    'Orders',
    expect.stringContaining('Quotes'),
    'Expenses',
    'Profile',
  ]);
  await expect(bar.getByRole('link', { name: `Quotes, ${chip(count)} new`, exact: true })).toBeVisible();

  const widths: number[] = [];
  for (const tab of await tabs.all()) {
    widths.push((await tab.boundingBox())?.width ?? 0);
    expect(await tab.evaluate(holdsItsContent), 'no tab label is cut off').toBe(true);
  }
  for (const width of widths) {
    expect(width, 'each tab is at least a 44px target').toBeGreaterThanOrEqual(44);
    expect(Math.abs(width - (widths[0] ?? 0)), 'the tabs share the bar equally').toBeLessThan(1);
  }
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@quote the dashboard strip shows the new count under the money strip and opens the inbox', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  await createQuoteRequest(request, { customerName: uniqueName(), contactNumber: freshMobile() });

  const count = await openWithCount(page, '/admin');
  const strip = page.getByRole('region', { name: 'New quote requests' });
  await expect(strip).toBeVisible();
  await expect(strip).toContainText(count.toLocaleString('en-PH'));
  // It sits directly under the money strip.
  const after = await page
    .getByRole('region', { name: 'Your money on hand' })
    .evaluate(
      (money: { nextElementSibling: { getAttribute(name: string): string | null } | null }) =>
        money.nextElementSibling?.getAttribute('aria-labelledby') ?? null,
    );
  expect(after).toBe(await strip.getAttribute('aria-labelledby'));
  await expectNoAxeViolations(page);

  await strip.getByRole('link', { name: 'Open Quote Requests' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Quote Requests' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/quote-requests$/);
});
