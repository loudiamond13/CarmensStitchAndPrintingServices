// Arranging order photos end to end (ORD-04, D-13 to D-15; plan 09-27). A signed-in Manager adds three photos to a seeded order,
// then moves one with the keyboard only: the tiles reorder after the server answers, the Cover tag follows, focus stays on the
// pressed control and "Saved" shows. The photos come from the Testing image route, so Playwright never reaches Cloudinary (D-07).
// The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by every project running
// together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { manilaDate } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
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
async function drawJpeg(page: Page, name: string, hue: number): Promise<PickedFile> {
  const bytes = await page.evaluate<number[]>(drawScript(3000, 2000, hue));
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

/** Seeds an active order with one item and returns its id and number. */
async function seedOrder(request: APIRequestContext): Promise<{ id: string; number: string }> {
  const number = `ORD-2094-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E Arrange Customer',
    teamName: 'E2E Arrange Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E arrange jersey', quantity: 6, unitPrice: 700 }],
  });
  return { id, number };
}

/** The name of the saved photo thumb at `position` of `total`, with the default description. */
function savedName(number: string, position: number, total: number): string {
  return `Open photo ${String(position)} of ${String(total)}: Order ${number} photo ${String(position)}`;
}

/** Signs a new Manager in, opens a seeded order and adds `count` drawn photos, waiting until all of them show as saved. */
async function orderWithPhotos(
  page: Page,
  request: APIRequestContext,
  count: number,
): Promise<{ id: string; number: string }> {
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  const files: PickedFile[] = [];
  for (let index = 0; index < count; index += 1) {
    files.push(await drawJpeg(page, `photo-${String(index + 1)}.jpg`, (index * 55) % 360));
  }
  // The photos upload one at a time, and the other projects wait their turn on the host lock, so the last one takes a while.
  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(files);
    await expect(page.getByRole('button', { name: savedName(number, count, count) })).toBeVisible({ timeout: 120_000 });
  });
  return { id, number };
}

/** The photo tiles, in the order they show. */
function tiles(page: Page): Locator {
  return page.getByRole('list', { name: 'Order photos' }).getByRole('listitem');
}

/** The address of each tile's thumb picture, which tells the photos apart whatever their text says. */
async function thumbSources(page: Page): Promise<(string | null)[]> {
  const sources: (string | null)[] = [];
  const count = await tiles(page).count();
  for (let index = 0; index < count; index += 1) {
    sources.push(await tiles(page).nth(index).locator('img').first().getAttribute('src'));
  }
  return sources;
}

test('@order-photos-arrange with the keyboard only, Move photo 1 right swaps the first two photos and the Cover tag follows', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3);
  const before = await thumbSources(page);
  expect(new Set(before).size).toBe(3);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();

  // Tab from photo 1's thumb: Move photo 1 left, then Move photo 1 right.
  await page.getByRole('button', { name: savedName(number, 1, 3) }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Move photo 1 right' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => thumbSources(page)).toEqual([before[1], before[0], before[2]]);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();
  await expect(tiles(page).nth(1).getByText('Cover', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Move photo 2 right' })).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});

/** The photo's key in a Testing image address: the part that names the photo, whatever the size. */
function photoKey(source: string | null | undefined): string {
  const key = /\/api\/testing\/images\/([^?]+)/.exec(source ?? '')?.[1];
  if (key === undefined) throw new Error(`No photo key in ${source ?? 'a missing address'}`);
  return key;
}

test('@order-photos-arrange Make Cover on photo 3 makes it the cover here and on the Orders list, and focus goes to its Edit description', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3);
  const before = await thumbSources(page);
  const key = photoKey(before[2]);

  await page.getByRole('button', { name: 'Make cover, photo 3' }).click();

  await expect.poll(() => thumbSources(page)).toEqual([before[2], before[0], before[1]]);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit description of photo 1' })).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.goto('/admin/orders?view=grid');
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect(card.locator('img').first()).toHaveAttribute('src', new RegExp(key));
});

test('@order-photos-arrange describing photo 1 saves at once, focus returns to its Edit description, and the viewer shows the text as the picture description', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 2);

  await page.getByRole('button', { name: 'Edit description of photo 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Description' });
  const box = dialog.getByLabel('Photo description');
  await expect(dialog.getByText(`${number} · Photo 1 of 2`)).toBeVisible();
  await expect(box).toHaveValue(`Order ${number} photo 1`);
  await box.fill('Front mockup');
  await dialog.getByRole('button', { name: 'Save Description' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Edit description of photo 1' })).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open photo 1 of 2: Front mockup' }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  await expect(viewer.getByRole('img', { name: 'Front mockup' })).toBeVisible();
  // The other photo keeps the default text, which follows its place.
  await page.keyboard.press('ArrowRight');
  await expect(viewer.getByRole('img', { name: `Order ${number} photo 2` })).toBeVisible();
});
