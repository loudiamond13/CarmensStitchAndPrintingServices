// Helpers shared by the order photo specs (plans 09-16 to 09-30): drawing test photos, seeding an order, signing in on its page,
// uploading under the host lock, and reading the tiles back. One copy, so a fix reaches every spec.
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { gradientScript } from './photo-scripts.ts';
import { BASKETBALL_JERSEY_ID, CASH_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

export interface PickedFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/** A JPEG drawn on a canvas in the page, so every file differs and compresses small. */
export async function drawJpeg(
  page: Page,
  name: string,
  hue: number,
  width = 3000,
  height = 2000,
): Promise<PickedFile> {
  const bytes = await page.evaluate<number[]>(gradientScript(width, height, hue));
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

/** Draws `count` photos of different hues. */
export async function drawJpegs(page: Page, count: number, width = 3000, height = 2000): Promise<PickedFile[]> {
  const files: PickedFile[] = [];
  for (let index = 0; index < count; index += 1) {
    files.push(await drawJpeg(page, `photo-${String(index + 1)}.jpg`, (index * 55) % 360, width, height));
  }
  return files;
}

/** What one spec chooses for the order it seeds: the number prefix, the names, and the optional dates, status and payment. */
export interface PhotoOrderSeed {
  /** The start of the order number, such as ORD-2094; a random tail makes each number unique. */
  readonly prefix: string;
  /** Used in the customer and team names. */
  readonly label: string;
  readonly itemDescription: string;
  readonly orderDate?: string;
  readonly dueDate?: string;
  readonly status?: string;
  /** A cash payment of this amount, received by the signed-in Manager. */
  readonly payment?: { readonly amount: number };
}

/** Seeds an order with one item (6 x 700 = 4,200.00) and returns its id and number. */
export async function seedOrder(
  request: APIRequestContext,
  seed: PhotoOrderSeed,
  receivedByUserId = '',
): Promise<{ id: string; number: string }> {
  const number = `${seed.prefix}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    ...(seed.status === undefined ? {} : { status: seed.status }),
    customerName: `E2E ${seed.label} Customer`,
    teamName: `E2E ${seed.label} Team`,
    orderDate: seed.orderDate ?? manilaDate(-3),
    dueDate: seed.dueDate ?? manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: seed.itemDescription, quantity: 6, unitPrice: 700 }],
    ...(seed.payment === undefined
      ? {}
      : {
          payments: [
            {
              paymentDate: manilaDate(-2),
              amount: seed.payment.amount,
              paymentMethodId: CASH_ID,
              receivedByUserId,
            },
          ],
        }),
  });
  return { id, number };
}

/** The name of the saved photo tile at `position` of `total`, with the default description. */
export function savedName(number: string, position: number, total: number): string {
  return `Open photo ${String(position)} of ${String(total)}: Order ${number} photo ${String(position)}`;
}

/** The photo tiles, in the order they show. */
export function tiles(page: Page): Locator {
  return page.getByRole('list', { name: 'Order photos' }).getByRole('listitem');
}

/** The address of each tile's thumb picture, which tells the photos apart whatever their text says. */
export async function thumbSources(page: Page): Promise<(string | null)[]> {
  const sources: (string | null)[] = [];
  const count = await tiles(page).count();
  for (let index = 0; index < count; index += 1) {
    sources.push(await tiles(page).nth(index).locator('img').first().getAttribute('src'));
  }
  return sources;
}

/** The photo's key in a Testing image address: the part that names the photo, whatever the size. */
export function photoKey(source: string | null | undefined): string {
  const key = /\/api\/testing\/images\/([^?]+)/.exec(source ?? '')?.[1];
  if (key === undefined) throw new Error(`No photo key in ${source ?? 'a missing address'}`);
  return key;
}

/** Opens a seeded order's page as a signed-in Manager. */
export async function openOrder(
  page: Page,
  request: APIRequestContext,
  manager: TestStaff,
  id: string,
  number: string,
): Promise<void> {
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
}

/** Picks `files` on the order page and waits until `total` photos show as saved. */
export async function uploadAndWait(page: Page, number: string, files: PickedFile[], total: number): Promise<void> {
  // The photos upload one at a time, and the other projects wait their turn on the host lock, so the last one takes a while.
  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(files);
    await expect(page.getByRole('button', { name: savedName(number, total, total) })).toBeVisible({ timeout: 120_000 });
  });
}

/** Adds `count` drawn photos on the order page and waits until all of them show as saved. */
export async function addPhotos(page: Page, number: string, count: number): Promise<void> {
  await uploadAndWait(page, number, await drawJpegs(page, count), count);
}

/** Signs a new Manager in, opens a seeded order and adds `count` drawn photos, waiting until all of them show as saved. */
export async function orderWithPhotos(
  page: Page,
  request: APIRequestContext,
  count: number,
  seed: PhotoOrderSeed,
  size: { readonly width: number; readonly height: number } = { width: 3000, height: 2000 },
): Promise<{ id: string; number: string; manager: TestStaff }> {
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, seed, manager.userId);
  await openOrder(page, request, manager, id, number);
  if (count > 0) {
    await uploadAndWait(page, number, await drawJpegs(page, count, size.width, size.height), count);
  }
  return { id, number, manager };
}

/** A fresh access token for API calls made as the signed-in person of this page. */
export async function apiToken(page: Page): Promise<string> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  return ((await refreshed.json()) as { accessToken: string }).accessToken;
}

/** Soft-deletes an order through the API as the signed-in Manager of this page. */
export async function deleteOrderThroughApi(page: Page, id: string): Promise<void> {
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${await apiToken(page)}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);
}
