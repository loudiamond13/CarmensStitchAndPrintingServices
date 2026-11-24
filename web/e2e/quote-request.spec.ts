// Quote request page E2E (INQ-05, D-36; UI-SPEC R2). A request sent through the public form API opens from the inbox name link.
// The fixture guard fails a test on any console error, CSP violation or undeclared failed response. Each test makes its own
// request with a unique name, because the shared CSPS_E2E database keeps what other specs made.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL } from './helpers.ts';
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

test('@quote staff add a note, and it stays after a reload', async ({ page, request, guard }) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin', undefined, { firstName: 'Notes', lastName: 'Tester' });
  await signInAs(page, request, admin);
  const name = uniqueName();
  const id = await createQuoteRequest(request, { customerName: name, contactNumber: freshMobile() });

  await openFromInbox(page, name, id);
  const notes = page.getByRole('region', { name: 'Internal notes' });
  await expect(notes).toContainText('No notes yet.');
  const box = notes.getByRole('textbox', { name: 'Add a note' });
  await box.fill('Called back.\nWants 12 jerseys by Friday.');
  const added = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/quote-requests/${id}/notes` &&
      response.request().method() === 'POST',
  );
  await notes.getByRole('button', { name: 'Add Note' }).click();
  expect((await added).status()).toBe(200);

  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();
  const first = notes.getByRole('listitem').first();
  await expect(first).toContainText('Called back.');
  await expect(first).toContainText('Notes Tester');
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Internal notes' }).getByRole('listitem').first()).toContainText(
    'Wants 12 jerseys by Friday.',
  );
});

test('@quote at 320px the actions wrap under the title, 44px tall, and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  const name = uniqueName();
  // One photo declared and never sent: the missing-photo note shows.
  const id = await createQuoteRequest(request, {
    customerName: name,
    contactNumber: freshMobile(),
    message: 'A long message that must wrap. '.repeat(20),
    declaredPhotos: ['logo.png'],
  });

  await page.setViewportSize({ width: 320, height: 800 });
  await openFromInbox(page, name, id);
  await expect(page.getByRole('region', { name: 'Photos' })).toContainText(
    "1 photo didn't upload: logo.png. Ask the customer to send them on Messenger.",
  );
  const heading = await page.getByRole('heading', { level: 1, name }).boundingBox();
  const status = await page.getByRole('button', { name: 'Change Status' }).boundingBox();
  expect(status?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(status?.y ?? 0).toBeGreaterThan((heading?.y ?? 0) + (heading?.height ?? 0) - 1);
  const contact = await page.getByRole('region', { name: 'Request' }).getByRole('link').first().boundingBox();
  expect(contact?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@quote axe finds nothing on a New request, after Move to Spam, and the menu works by keyboard', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);
  const name = uniqueName();
  const id = await createQuoteRequest(request, { customerName: name, contactNumber: freshMobile() });

  await openFromInbox(page, name, id);
  await expect(page.getByRole('region', { name: 'Photos' })).toContainText('No photos were sent.');
  await expectNoAxeViolations(page);

  const changeStatus = page.getByRole('button', { name: 'Change Status' });
  await changeStatus.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Move to Spam' })).toBeFocused();
  const moved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/quote-requests/${id}/status` &&
      response.request().method() === 'POST',
  );
  await page.keyboard.press('Enter');
  expect((await moved).status()).toBe(200);

  await expect(page.getByText('This request is now Spam.')).toBeVisible();
  await expect(page.getByRole('main').getByText('Spam', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Spam ·');
  await expect(changeStatus).toBeFocused();
  await expectNoAxeViolations(page);
});
