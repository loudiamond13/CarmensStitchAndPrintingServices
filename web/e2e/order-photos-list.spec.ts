// The cover photo on the Orders list end to end (ORD-04 success criterion 2, IMG-04; plan 09-18). A signed-in Manager adds one
// photo to a seeded order on the order page, opens the Orders list, and the order's cover loads in the grid card and in the table
// thumb from the Testing image route, so Playwright never reaches Cloudinary (D-07). An order without a photo keeps its
// placeholder. The order is due long ago, so the default sort puts it on the first page whatever else the database holds. The
// upload runs under withPhotoHost, because the fail-next switch of the Testing host is shared by every project running together.
// Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

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

/** Seeds an active order with one item, due long ago, and returns its id and number. */
async function seedOrder(request: APIRequestContext, label: string): Promise<{ id: string; number: string }> {
  const number = `ORD-2096-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: `E2E ${label} Customer`,
    teamName: `E2E ${label} Team`,
    orderDate: '2000-01-01',
    dueDate: '2000-01-02',
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E cover jersey', quantity: 6, unitPrice: 700 }],
  });
  return { id, number };
}

/** The natural width of the first image in `scope`: 0 until the browser has decoded it (a broken image stays 0). */
function coverWidth(scope: Locator): Promise<number> {
  return scope
    .locator('img')
    .first()
    .evaluate((element) => {
      const image = element as unknown as { complete: boolean; naturalWidth: number };
      return image.complete ? image.naturalWidth : 0;
    });
}

/** Adds one drawn photo to the order on its page and waits until it shows as saved. */
async function addPhoto(page: Page, id: string, number: string): Promise<void> {
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const bytes = await page.evaluate<number[]>(drawScript(3000, 2000, 200));
  await withPhotoHost(async () => {
    await page
      .locator('input[type="file"][multiple]')
      .setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) });
    await expect(page.getByText(`1 photo added to ${number}.`)).toBeVisible();
  });
}

test('@order-photos-list an order with a photo shows its cover in the grid card and the table thumb', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, 'Cover');
  await signInAs(page, request, manager);
  await addPhoto(page, id, number);

  await page.goto('/admin/orders?view=grid');
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect.poll(() => coverWidth(card)).toBeGreaterThan(0);
  await expect(card.getByRole('button', { name: `View order ${number}, Pending` })).toBeVisible();
  await expect(card.getByText('No images yet')).toHaveCount(0);

  await page.goto('/admin/orders?view=table');
  const row = page.getByRole('row').filter({ hasText: number });
  await expect(row).toHaveCount(1);
  await expect.poll(() => coverWidth(row)).toBeGreaterThan(0);
});

test('@order-photos-list an order without a photo keeps the No images yet placeholder on its card', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { number } = await seedOrder(request, 'Plain');
  await signInAs(page, request, manager);

  await page.goto('/admin/orders?view=grid');
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('img', { name: /No images yet/ })).toBeVisible();
  await expect(card.locator('img')).toHaveCount(0);
});
