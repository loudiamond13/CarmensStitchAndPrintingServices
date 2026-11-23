// Quote Requests inbox E2E (INQ-05, D-13, D-18; UI-SPEC R1). A request sent through the public form API shows in the staff
// inbox. The shared CSPS_E2E database keeps what earlier runs made, and other specs may send requests at the same time, so each
// check finds its own request by a unique name and compares the page with the list answer it just read.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { createQuoteRequest, createStaff } from './testing-api.ts';

interface InboxRow {
  readonly id: string;
  readonly customerName: string;
  readonly receivedAtUtc: string;
}

function isInboxRow(value: unknown): value is InboxRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'customerName' in value &&
    typeof value.customerName === 'string' &&
    'receivedAtUtc' in value &&
    typeof value.receivedAtUtc === 'string'
  );
}

/** A Philippine mobile number nobody used before in this run, so the per-sender limit never meets it. */
function freshMobile(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
  return `09${tail}`;
}

/** A fake visitor name no other run used. */
function uniqueName(): string {
  return `E2E Visitor ${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

/** Opens an inbox URL and returns the rows the list call answered. */
async function openInbox(page: Page, path: string): Promise<InboxRow[]> {
  const listed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/quote-requests' && response.request().method() === 'GET',
  );
  await page.goto(path);
  const body: unknown = await (await listed).json();
  const items = typeof body === 'object' && body !== null && 'items' in body ? body.items : null;
  if (!Array.isArray(items) || !items.every(isInboxRow)) {
    throw new Error('GET /api/v1/quote-requests returned an unexpected body.');
  }
  return items;
}

test('@quote staff see a new request in Quote Requests', async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  const name = uniqueName();
  const id = await createQuoteRequest(request, { customerName: name, contactNumber: freshMobile(), teamName: 'E2E Riders' });

  const rows = await openInbox(page, '/admin/quote-requests');
  await expect(page.getByRole('heading', { level: 1, name: 'Quote Requests' })).toBeVisible();
  await expect(page).toHaveTitle('Quote Requests · CSPS Admin');

  // Newest first: the new request is on the first page, and only requests received at the same time or later sit above it.
  const index = rows.findIndex((row) => row.id === id);
  expect(index, 'the new request is on the first page').toBeGreaterThanOrEqual(0);
  const received = rows[index]?.receivedAtUtc ?? '';
  for (const above of rows.slice(0, index)) {
    expect(Date.parse(above.receivedAtUtc)).toBeGreaterThanOrEqual(Date.parse(received));
  }
  const link = page.getByRole('link', { name });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/admin/quote-requests/${id}`);
  await expect(page.getByRole('row').filter({ has: link })).toContainText('E2E Riders');
  await expect(page.getByRole('row').filter({ has: link })).toContainText('New');
  // The name is personal data: it never reaches the document title (T-13-44).
  await expect(page).not.toHaveTitle(new RegExp(name));
});
