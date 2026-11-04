// Looking at order photos end to end (ORD-04, IMG-04; plan 09-23). A signed-in Manager adds five photos to a seeded order, opens
// photo 2 in the viewer, steps to photo 4 with the arrow key and closes it with Esc: focus is on photo 4's thumb. "Open Full
// Size" is a link to the full-size address in a new tab. The photos come from the Testing image route, so Playwright never
// reaches Cloudinary (D-07). The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by
// every project running together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
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
  const number = `ORD-2095-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  const id = await createOrder(request, {
    number,
    customerName: 'E2E View Customer',
    teamName: 'E2E View Team',
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E view jersey', quantity: 6, unitPrice: 700 }],
  });
  return { id, number };
}

/** The name of the saved photo tile at `position` of `total`. */
function savedName(number: string, position: number, total: number): string {
  return `Open photo ${String(position)} of ${String(total)}: Order ${number} photo ${String(position)}`;
}

/** Adds `count` drawn photos on the order page and waits until all of them show as saved. */
async function addPhotos(page: Page, number: string, count: number): Promise<void> {
  const files: PickedFile[] = [];
  for (let index = 0; index < count; index += 1) {
    files.push(await drawJpeg(page, `photo-${String(index + 1)}.jpg`, (index * 55) % 360));
  }
  // The photos upload one at a time, and the other projects wait their turn on the host lock, so the last one takes a while.
  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(files);
    await expect(page.getByRole('button', { name: savedName(number, count, count) })).toBeVisible({ timeout: 120_000 });
  });
}

test('@order-photos-view photo 2 opens in the viewer, ArrowRight reaches photo 4, Esc puts focus on photo 4', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  await addPhotos(page, number, 5);

  await page.getByRole('button', { name: savedName(number, 2, 5) }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('Photo 2 of 5', { exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Close viewer' })).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(viewer.getByText('Photo 4 of 5', { exact: true })).toBeVisible();
  const shown = viewer.getByRole('img', { name: `Order ${number} photo 4` });
  await expect(shown).toBeVisible();
  await expect
    .poll(() => shown.evaluate((element) => (element as unknown as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);

  // Open Full Size is a link to the full-size address in a new tab; the test does not follow it.
  const fullSize = viewer.getByRole('link', { name: /Open Full Size/ });
  await expect(fullSize).toHaveAttribute('target', '_blank');
  await expect(fullSize).toHaveAttribute('href', /size=csps_full_2000/);
  await expect(fullSize).toHaveAttribute('rel', /noopener/);

  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page.getByRole('button', { name: savedName(number, 4, 5) })).toBeFocused();
});
