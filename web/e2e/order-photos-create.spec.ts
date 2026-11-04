// Adding photos while creating an order, end to end (ORD-04, IMG-05; plan 09-21). A signed-in Manager fills the New Order form,
// picks photos into the Images card (they are drafts in the browser), saves, and lands on the new order's page, where the photos
// wait and then upload one at a time to the E2E host. Test images are drawn on a canvas at test time. Every test runs under the
// shared guard (console, page errors, CSP, failed responses). The save and the uploads run under withPhotoHost, because the
// Testing host's photo switches are shared by every project running at the same time.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { createStaff } from './testing-api.ts';

interface PickedFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/** The page-side script that draws a hue gradient on a canvas and returns the JPEG bytes. Strings, because e2e has no DOM types. */
function drawScript(width: number, height: number, hue: number): string {
  return `(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = ${String(width)};
    canvas.height = ${String(height)};
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, ${String(width)}, ${String(height)});
    gradient.addColorStop(0, 'hsl(${String(hue)} 70% 45%)');
    gradient.addColorStop(1, 'hsl(${String((hue + 90) % 360)} 70% 60%)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, ${String(width)}, ${String(height)});
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  })()`;
}

/** A JPEG drawn on a canvas in the page, so every file differs and compresses small. */
async function drawJpeg(page: Page, name: string, hue: number, width = 3000, height = 2000): Promise<PickedFile> {
  const bytes = await page.evaluate<number[]>(drawScript(width, height, hue));
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

/** Fills every required field of the New Order form with good values. */
async function fillOrder(page: Page, customer: string): Promise<void> {
  await page.getByLabel(/^Customer name/).fill(customer);
  await page.getByLabel(/^Team \/ organization/).fill('E2E Photos Team');
  await page.getByLabel(/^Contact number/).fill('0917 000 0000');
  await page.getByLabel(/^Due date/).fill(manilaDate(5));
  await page.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await page.getByLabel(/^Description/).fill('E2E photo jersey');
  await page.getByLabel(/^Qty/).fill('6');
  await page.getByLabel(/^Unit price/).fill('700');
}

test('@order-photos-create a Manager creates an order with two photos, which upload on the order page with the first as cover', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const customer = `E2E Photos ${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  await signInAs(page, request, manager);
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await expect(page.getByText('Image uploads are coming soon.')).toBeHidden();
  await fillOrder(page, customer);
  const files = [await drawJpeg(page, 'front.jpg', 200), await drawJpeg(page, 'back.jpg', 20)];

  await page.locator('input[type="file"][multiple]').setInputFiles(files);

  const drafts = page.getByRole('list', { name: 'Order photos' }).getByRole('listitem');
  await expect(drafts).toHaveCount(2);
  await expect(drafts.nth(0)).toContainText('New order photo 1');
  await expect(drafts.nth(1)).toContainText('New order photo 2');
  await expect(page.getByText('2/5').first()).toBeAttached();

  await withPhotoHost(async () => {
    await page.getByRole('button', { name: 'Save Order' }).click();

    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: /^ORD-\d{4}-\d{4,}$/ })).toBeVisible();
    await expect(page.getByText('Order saved')).toBeVisible();
    const first = page.getByRole('button', { name: /^Open photo 1 of 2: Order ORD-\d{4}-\d{4,} photo 1$/ });
    const second = page.getByRole('button', { name: /^Open photo 2 of 2: Order ORD-\d{4}-\d{4,} photo 2$/ });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(page.getByText('Photos added', { exact: true })).toBeVisible();
    await expect(page.getByText('front.jpg')).toBeHidden();
    await expect(page.getByText('back.jpg')).toBeHidden();
    // The first draft became the cover.
    await expect(page.getByText('Cover', { exact: true })).toHaveCount(1);
  });
});
