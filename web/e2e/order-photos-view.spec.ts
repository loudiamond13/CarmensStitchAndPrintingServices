// Looking at order photos end to end (ORD-04, IMG-04; plan 09-23). A signed-in Manager adds five photos to a seeded order, opens
// photo 2 in the viewer, steps to photo 4 with the arrow key and closes it with Esc: focus is on photo 4's thumb. "Open Full
// Size" is a link to the full-size address in a new tab. A cancelled order and a deleted order show their photos read-only: no
// add area and no photo controls, while the thumbs still open the viewer; a reopen brings the controls back. The photos come
// from the Testing image route, so Playwright never reaches Cloudinary (D-07). The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by
// every project running together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
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
async function drawJpeg(page: Page, name: string, hue: number, width = 3000, height = 2000): Promise<PickedFile> {
  const bytes = await page.evaluate<number[]>(drawScript(width, height, hue));
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

/** Uploads the given files on the order page and waits until all of them show as saved. */
async function uploadPhotos(page: Page, number: string, files: readonly PickedFile[]): Promise<void> {
  // The photos upload one at a time, and the other projects wait their turn on the host lock, so the last one takes a while.
  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles([...files]);
    await expect(page.getByRole('button', { name: savedName(number, files.length, files.length) })).toBeVisible({
      timeout: 120_000,
    });
  });
}

/** Adds `count` drawn photos on the order page and waits until all of them show as saved. */
async function addPhotos(page: Page, number: string, count: number): Promise<void> {
  const files: PickedFile[] = [];
  for (let index = 0; index < count; index += 1) {
    files.push(await drawJpeg(page, `photo-${String(index + 1)}.jpg`, (index * 55) % 360));
  }
  await uploadPhotos(page, number, files);
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

/** True while the page offers any way to add or change a photo. */
async function writeControlCount(page: Page): Promise<number> {
  const names = [
    /^Make cover/i,
    /^Move photo/,
    /^Edit description/,
    /^Delete photo/,
    /^Choose Photos$/,
    /^Take Photo$/,
    /^browse$/,
  ];
  let total = 0;
  for (const name of names) {
    total += await page.getByRole('button', { name }).count();
  }
  return total;
}

/** Opens the photo at `position`, checks the counter and Open Full Size, closes with Esc and checks focus is back on the thumb. */
async function viewAndClose(page: Page, number: string, position: number, total: number): Promise<void> {
  await page.getByRole('button', { name: savedName(number, position, total) }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  await expect(viewer.getByText(`Photo ${String(position)} of ${String(total)}`, { exact: true })).toBeVisible();
  await expect(viewer.getByRole('link', { name: /Open Full Size/ })).toHaveAttribute('target', '_blank');
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page.getByRole('button', { name: savedName(number, position, total) })).toBeFocused();
}

test('@order-photos-view a cancelled order shows its photos read-only, and a reopen brings the controls back', async ({
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
  await addPhotos(page, number, 2);
  expect(await writeControlCount(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Change Status' }).click();
  await page.getByRole('menuitem', { name: 'Cancel Order' }).click();
  await page
    .getByRole('dialog', { name: `Cancel ${number}?` })
    .getByRole('button', { name: 'Cancel Order' })
    .click();
  await expect(page.getByText('This order is cancelled.')).toBeVisible();

  // Locked: the photos stay, nothing adds or changes one, and the viewer still opens.
  await expect(page.getByRole('button', { name: savedName(number, 2, 2) })).toBeVisible();
  expect(await writeControlCount(page)).toBe(0);
  await expectNoAxeViolations(page);
  await viewAndClose(page, number, 2, 2);

  // Reopen: the controls come back.
  await page.getByRole('button', { name: 'Reopen Order' }).click();
  await page
    .getByRole('dialog', { name: `Reopen ${number}` })
    .getByRole('button', { name: 'Reopen Order' })
    .click();
  await expect(page.getByText('This order is cancelled.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete photo 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make cover, photo 2' })).toBeVisible();
});

test('@order-photos-view a deleted order shows its photos read-only to a Manager, and they open in the viewer', async ({
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
  await addPhotos(page, number, 2);

  // A soft delete keeps the photos (08 D-24): delete through the API as this Manager, then open the deleted view.
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${session.accessToken}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);

  await page.goto(`/admin/orders/deleted/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
  await expect(page.getByText('Image uploads are coming soon.')).toBeHidden();
  await expect(page.getByRole('button', { name: savedName(number, 2, 2) })).toBeVisible();
  expect(await writeControlCount(page)).toBe(0);
  await expectNoAxeViolations(page);
  await viewAndClose(page, number, 2, 2);
});

/** True on the touch projects (the two phones), where the wide-window checks do not apply. */
function isTouch(testInfo: { project: { use: { hasTouch?: boolean | undefined } } }): boolean {
  return testInfo.project.use.hasTouch === true;
}

interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface ViewerGeometry {
  readonly box: Rect;
  readonly stage: Rect;
  readonly previous: Rect;
  readonly next: Rect;
  readonly image: Rect;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly boxBackground: string;
}

/** The rectangles of the viewer's image box, its stage and the Previous and Next buttons, with the picture's natural size. */
function readViewerGeometry(): string {
  return `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Order photos"]');
    const image = dialog.querySelector('img');
    const box = image.parentElement;
    const stage = box.parentElement;
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      box: rect(box),
      stage: rect(stage),
      previous: rect(dialog.querySelector('button[aria-label="Previous image"]')),
      next: rect(dialog.querySelector('button[aria-label="Next image"]')),
      image: rect(image),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      boxBackground: getComputedStyle(box).backgroundColor,
    };
  })()`;
}

/** Waits until the viewer's picture has loaded, then reads its geometry. */
async function viewerGeometry(page: Page): Promise<ViewerGeometry> {
  await expect
    .poll(() =>
      page
        .getByRole('dialog', { name: 'Order photos' })
        .getByRole('img')
        .evaluate((image) => (image as unknown as { naturalWidth: number }).naturalWidth),
    )
    .toBeGreaterThan(0);
  return page.evaluate<ViewerGeometry>(readViewerGeometry());
}

/** Seeds an order, signs a new Manager in on its page, uploads the files `draw` makes on that page and returns the order number. */
async function openOrderWithPhotos(
  page: Page,
  request: APIRequestContext,
  draw: () => Promise<PickedFile[]>,
): Promise<string> {
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  await uploadPhotos(page, number, await draw());
  return number;
}

const WIDE_WINDOW = { width: 1899, height: 951 };
const BOX_HEIGHT = 680;

test('@order-photos-view G-09-10 at 1899 x 951 a height-capped landscape photo is centred between Previous and Next', async ({
  page,
  request,
  guard,
  browserName,
}, testInfo) => {
  test.skip(isTouch(testInfo), 'The wide window is a desktop check.');
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await page.setViewportSize(WIDE_WINDOW);
  const number = await openOrderWithPhotos(page, request, async () => [
    await drawJpeg(page, 'five-by-four.jpg', 10, 1500, 1200),
    await drawJpeg(page, 'four-by-three.jpg', 200, 1600, 1200),
  ]);

  await page.getByRole('button', { name: savedName(number, 1, 2) }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  await expect(viewer).toBeVisible();
  for (const position of [1, 2]) {
    if (position === 2) {
      await page.keyboard.press('ArrowRight');
      await expect(viewer.getByText('Photo 2 of 2', { exact: true })).toBeVisible();
    }
    const read = await viewerGeometry(page);
    // WebKit's screenshot adds an inline style element, which the strict CSP blocks, so WebKit takes no picture here.
    if (browserName !== 'webkit') {
      await testInfo.attach(`viewer-wide-${String(position)}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    const left = read.box.left - read.previous.right;
    const right = read.next.left - read.box.right;
    const column = read.next.left - read.previous.right - 32;
    const numbers = `photo ${String(position)}: box ${String(read.box.width)} x ${String(read.box.height)}, left ${String(read.box.left)}, right ${String(read.box.right)}, space ${String(left)} / ${String(right)}, column ${String(column)}`;
    expect(Math.abs(read.box.height - BOX_HEIGHT), `the box is 680 px tall (${numbers})`).toBeLessThanOrEqual(0.5);
    expect(column - read.box.width, `the box is narrower than its column (${numbers})`).toBeGreaterThan(8);
    expect(left, `at least 16 px from Previous (${numbers})`).toBeGreaterThanOrEqual(15.5);
    expect(right, `at least 16 px from Next (${numbers})`).toBeGreaterThanOrEqual(15.5);
    expect(Math.abs(left - right), `equal space on both sides (${numbers})`).toBeLessThanOrEqual(1);
  }
});

test('@order-photos-view G-09-10 the phone layout is unchanged: the photo spans the stage and Previous and Next sit under it', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  if (!isTouch(testInfo)) {
    await page.setViewportSize({ width: 639, height: 951 });
  }
  const number = await openOrderWithPhotos(page, request, async () => [
    await drawJpeg(page, 'five-by-four.jpg', 10, 1500, 1200),
    await drawJpeg(page, 'second.jpg', 200),
  ]);

  await page.getByRole('button', { name: savedName(number, 1, 2) }).click();
  await expect(page.getByRole('dialog', { name: 'Order photos' })).toBeVisible();
  const read = await viewerGeometry(page);
  const numbers = `box ${String(read.box.width)} x ${String(read.box.height)} at ${String(read.box.left)}, stage ${String(read.stage.width)} at ${String(read.stage.left)}, previous top ${String(read.previous.top)}, next top ${String(read.next.top)}`;
  expect(
    Math.abs(read.box.left - read.stage.left),
    `the box starts at the stage's left edge (${numbers})`,
  ).toBeLessThanOrEqual(0.5);
  expect(Math.abs(read.box.width - read.stage.width), `the box spans the stage (${numbers})`).toBeLessThanOrEqual(0.5);
  for (const button of [read.previous, read.next]) {
    expect(Math.abs(button.width - 44), `a 44 px button (${numbers})`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(button.height - 44), `a 44 px button (${numbers})`).toBeLessThanOrEqual(0.5);
    expect(button.top - read.box.bottom, `under the box (${numbers})`).toBeGreaterThanOrEqual(15.5);
  }
  expect(Math.abs(read.previous.top - read.next.top), `one row (${numbers})`).toBeLessThanOrEqual(0.5);
});

/** The page-side script that draws a PNG like a jersey mockup on a white sheet: the upper 60% one colour, the lower 40% white. */
function drawMockupScript(width: number, height: number): string {
  return `(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = ${String(width)};
    canvas.height = ${String(height)};
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, ${String(width)}, ${String(height)});
    context.fillStyle = 'hsl(10 70% 45%)';
    context.fillRect(0, 0, ${String(width)}, ${String(Math.round(height * 0.6))});
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  })()`;
}

/** Reads the delivered file behind the viewer's picture back: its colour at 30% and 80% of the height, in the middle. */
function readDeliveredPixels(): string {
  return `(async () => {
    const image = document.querySelector('[role="dialog"][aria-label="Order photos"] img');
    const response = await fetch(image.currentSrc);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const at = (y) => Array.from(context.getImageData(Math.floor(bitmap.width / 2), Math.floor(y), 1, 1).data);
    return { status: response.status, upper: at(bitmap.height * 0.3), lower: at(bitmap.height * 0.8) };
  })()`;
}

interface DeliveredPixels {
  readonly status: number;
  readonly upper: readonly number[];
  readonly lower: readonly number[];
}

test("@order-photos-view G-09-10 the white band under a mockup is the photo's own pixels, and the box is fitted to the photo", async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(isTouch(testInfo), 'The wide window is a desktop check.');
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await page.setViewportSize(WIDE_WINDOW);
  const number = await openOrderWithPhotos(page, request, async () => [
    {
      name: 'mockup.png',
      mimeType: 'image/png',
      buffer: Buffer.from(await page.evaluate<number[]>(drawMockupScript(1500, 1200))),
    },
    await drawJpeg(page, 'second.jpg', 200),
  ]);

  await page.getByRole('button', { name: savedName(number, 1, 2) }).click();
  await expect(page.getByRole('dialog', { name: 'Order photos' })).toBeVisible();
  const read = await viewerGeometry(page);
  const delivered = await page.evaluate<DeliveredPixels>(readDeliveredPixels());
  const boxRatio = read.box.width / read.box.height;
  const naturalRatio = read.naturalWidth / read.naturalHeight;
  const numbers = `box ${String(read.box.width)} x ${String(read.box.height)} (ratio ${String(boxRatio)}), natural ${String(read.naturalWidth)} x ${String(read.naturalHeight)} (ratio ${String(naturalRatio)}), ground ${read.boxBackground}, picture at ${String(read.image.left - read.box.left)} / ${String(read.image.top - read.box.top)} / ${String(read.box.right - read.image.right)} / ${String(read.box.bottom - read.image.bottom)}, upper ${delivered.upper.join(',')}, lower ${delivered.lower.join(',')}`;
  expect(Math.abs(boxRatio / naturalRatio - 1), `the box has the photo's ratio (${numbers})`).toBeLessThanOrEqual(0.01);
  expect(Math.abs(read.image.left - read.box.left), `the picture fills the box (${numbers})`).toBeLessThanOrEqual(1);
  expect(Math.abs(read.image.top - read.box.top), `the picture fills the box (${numbers})`).toBeLessThanOrEqual(1);
  expect(Math.abs(read.image.right - read.box.right), `the picture fills the box (${numbers})`).toBeLessThanOrEqual(1);
  expect(Math.abs(read.image.bottom - read.box.bottom), `the picture fills the box (${numbers})`).toBeLessThanOrEqual(
    1,
  );
  expect(read.boxBackground, `the box ground is the dark surface (${numbers})`).toBe('rgb(47, 30, 27)');
  expect(delivered.status, 'the delivered file loads').toBe(200);
  expect([...delivered.lower.slice(0, 3)], `the delivered file is white at 80% of its height (${numbers})`).toEqual([
    255, 255, 255,
  ]);
  expect(
    [...delivered.upper.slice(0, 3)],
    `the delivered file is not white at 30% of its height (${numbers})`,
  ).not.toEqual([255, 255, 255]);
});
