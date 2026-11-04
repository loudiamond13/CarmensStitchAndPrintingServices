// Adding photos on the order page end to end (ORD-04, IMG-01, IMG-05; plan 09-16). A signed-in Manager picks photos, they are
// prepared in the browser, upload one at a time to the E2E host, and show as saved photos whose thumbs the Testing image route
// serves, so Playwright never reaches Cloudinary (D-07). Test images are drawn on a canvas at test time. Every test runs under the
// shared guard (console, page errors, CSP, failed responses). Each test seeds its own order by a unique number.
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

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

/** The natural width of the nth saved photo's thumb: 0 until the browser has decoded it (a broken image stays 0). */
async function thumbWidth(page: Page, position: number): Promise<number> {
  const script = `(() => {
    const image = document.querySelectorAll('[aria-label^="Open photo ${String(position)} of "] img')[0];
    return image && image.complete ? image.naturalWidth : 0;
  })()`;
  return Number(await page.evaluate(script));
}

/** Seeds an active order with one item and returns its id and number. */
async function seedOrder(request: APIRequestContext): Promise<{ id: string; number: string }> {
  const number = `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Photos Customer',
    teamName: 'E2E Photos Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E photo jersey', quantity: 6, unitPrice: 700 }],
  });
  return { id, number };
}

test('@order-photos-upload a Manager picks a photo and sees it saved with a thumb from the server', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();

  await page.locator('input[type="file"][multiple]').setInputFiles(await drawJpeg(page, 'front.jpg', 200));

  const saved = page.getByRole('button', { name: `Open photo 1 of 1: Order ${number} photo 1` });
  await expect(saved).toBeVisible();
  await expect.poll(() => thumbWidth(page, 1)).toBeGreaterThan(0);
  await expect(page.getByText('front.jpg')).toBeHidden();
  await expect(page.getByText('Photos added', { exact: true })).toBeVisible();
  await expect(page.getByText(`1 photo added to ${number}.`)).toBeVisible();
});

test('@order-photos-upload three picked photos upload in order and show as three saved photos', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();

  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles([
      await drawJpeg(page, 'one.jpg', 10),
      await drawJpeg(page, 'two.jpg', 120),
      await drawJpeg(page, 'three.jpg', 240),
    ]);

  await expect(page.getByText('Photos added', { exact: true })).toBeVisible();
  await expect(page.getByText(`3 photos added to ${number}.`)).toBeVisible();
  for (const position of [1, 2, 3]) {
    const name = `Open photo ${String(position)} of 3: Order ${number} photo ${String(position)}`;
    await expect(page.getByRole('button', { name })).toBeVisible();
    await expect.poll(() => thumbWidth(page, position)).toBeGreaterThan(0);
  }
  await expect(page.getByText('3/5').first()).toBeAttached();
  await expect(page.getByText(/Uploading photo/)).toBeHidden();
});
