// Quote request page E2E (INQ-05, D-36; UI-SPEC R2). A request sent through the public form API opens from the inbox name link.
// The fixture guard fails a test on any console error, CSP violation or undeclared failed response. Each test makes its own
// request with a unique name, because the shared CSPS_E2E database keeps what other specs made.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg } from './photos.ts';
import { createQuoteRequest, createStaff, type QuoteSeedInput } from './testing-api.ts';

/** A Philippine mobile number nobody used before in this run, so the per-sender limit never meets it. */
function freshMobile(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
  return `09${tail}`;
}

/** A fake visitor name no other run used. */
function uniqueName(): string {
  return `E2E Visitor ${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

/** Opens the inbox searched by the name, then the request from its name link. */
async function openFromInbox(page: Page, name: string, id: string): Promise<void> {
  await page.goto(`/admin/quote-requests?q=${encodeURIComponent(name)}`);
  const link = page.getByRole('link', { name });
  await expect(link).toHaveAttribute('href', `/admin/quote-requests/${id}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/admin/quote-requests/${id}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Sends a request with one stored photo, under the photo host lock. */
async function requestWithPhoto(page: Page, request: Parameters<typeof createQuoteRequest>[0], input: QuoteSeedInput) {
  const photo = await drawJpeg(page, 'front.jpg', 200, 1200, 800);
  return withPhotoHost(() => createQuoteRequest(request, { ...input, photos: [photo] }));
}

test('@quote staff open a request with a photo', async ({ page, request, guard }) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  const name = uniqueName();
  const id = await requestWithPhoto(page, request, {
    customerName: name,
    contactNumber: freshMobile(),
    teamName: 'E2E Riders',
    message: 'Twelve jerseys, numbers 1 to 12.',
  });

  await openFromInbox(page, name, id);
  await expect(page).toHaveTitle('Quote Request · CSPS Admin');
  await expect(page).not.toHaveTitle(new RegExp(name));
  const details = page.getByRole('region', { name: 'Request' });
  await expect(details).toContainText('E2E Riders');
  await expect(details).toContainText('Twelve jerseys, numbers 1 to 12.');
  const photos = page.getByRole('region', { name: 'Photos' });
  const tile = photos.getByRole('button', { name: 'Open photo 1 of 1: front.jpg' });
  await expect(tile).toBeVisible();
  await expect(tile.locator('img')).toHaveJSProperty('complete', true);
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Received from the website');
});
