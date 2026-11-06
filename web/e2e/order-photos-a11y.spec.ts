// Phase 9 closing journeys (ORD-04, IMG-01 to IMG-05; plan 09-30). One test per screen state: a phone-sized touch browser that
// picks a big photo with Choose Photos and sees it stored at the browser-shrunk size and upright; axe (target size included) on
// F1 with drafts, O1 with 0, 1, 3 and 5 photos, waiting and failed tiles, the viewer, the description window with a 409 banner,
// the delete dialog, a Completed order, the deleted view, and the Orders grid and table with covers; the CSP record on F1, O1
// and the open viewer; a 320 px phone with one photo column and no sideways scroll; whole-photo viewer shots of a 1:4 and a 4:1
// photo; and the name and size of every photo control at 390, 820 and 1440 px. Photos come from the Testing image route, so
// Playwright never reaches Cloudinary (D-07). Uploads run under withPhotoHost, because the fail-next switch of the Testing host
// is shared by every project running together. Every test runs under the shared guard (console, page errors, CSP, responses).
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test, type Guard } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { gradientScript } from './photo-scripts.ts';
import {
  apiToken,
  drawJpegs as drawSizedJpegs,
  openOrder,
  orderWithPhotos as orderWithSeededPhotos,
  savedName,
  seedOrder as seedPhotoOrder,
  tiles,
  uploadAndWait,
  type PhotoOrderSeed,
} from './photos.ts';
import { createStaff } from './testing-api.ts';

// Far out, so these orders never crowd the first page of the soonest-due Orders list that other specs read.
const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2094',
  label: 'A11y',
  itemDescription: 'E2E a11y jersey',
  dueDate: manilaDate(400),
};

/** The photos of this spec are 800 x 600, small enough to upload fast. */
const PHOTO_SIZE = { width: 800, height: 600 };

/** The optional parts of a seeded order. */
type SeedOptions = Pick<PhotoOrderSeed, 'status' | 'payment'>;

/** Draws `count` photos of different hues. */
function drawJpegs(page: Page, count: number) {
  return drawSizedJpegs(page, count, PHOTO_SIZE.width, PHOTO_SIZE.height);
}

/** Seeds an order with one item (6 x 700 = 4,200.00) and returns its id and number. */
function seedOrder(request: APIRequestContext, options: SeedOptions = {}, receivedByUserId = '') {
  return seedPhotoOrder(request, { ...SEED, ...options }, receivedByUserId);
}

/** Signs a new Manager in, opens a seeded order and adds `count` drawn photos, waiting until all of them show as saved. */
function orderWithPhotos(page: Page, request: APIRequestContext, count: number, options: SeedOptions = {}) {
  return orderWithSeededPhotos(page, request, count, { ...SEED, ...options }, PHOTO_SIZE);
}

/** A photo with a red top half and a blue bottom half, so an upside-down or sideways result can be told from an upright one. */
function bandsScript(width: number, height: number): string {
  return `(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = ${String(width)};
    canvas.height = ${String(height)};
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgb(255, 0, 0)';
    context.fillRect(0, 0, ${String(width)}, ${String(height / 2)});
    context.fillStyle = 'rgb(0, 0, 255)';
    context.fillRect(0, ${String(height / 2)}, ${String(width)}, ${String(height / 2)});
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  })()`;
}

/** The CSP record so far must hold no violation (UIC-46). */
async function expectNoCspViolations(guard: Guard): Promise<void> {
  expect((await guard.peek()).cspViolations).toEqual([]);
}

/** True on the touch projects, where the add area is Take Photo and Choose Photos and the drop zone is not drawn. */
function isTouch(testInfo: { project: { use: { hasTouch?: boolean | undefined } } }): boolean {
  return testInfo.project.use.hasTouch === true;
}

/** Reads a stored photo back through the Testing image route: its size and the colour a quarter in from the top and bottom. */
function readStoredPhoto(source: string): string {
  return `(async () => {
    const response = await fetch(${JSON.stringify(source)});
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const at = (y) => Array.from(context.getImageData(Math.floor(bitmap.width / 2), Math.floor(y), 1, 1).data);
    return { status: response.status, width: bitmap.width, height: bitmap.height, top: at(bitmap.height / 4), bottom: at(bitmap.height * 0.75) };
  })()`;
}

interface StoredPhoto {
  readonly status: number;
  readonly width: number;
  readonly height: number;
  readonly top: readonly number[];
  readonly bottom: readonly number[];
}

test('@order-photos-a11y IMG-05 on a phone, Choose Photos takes a 4000 x 3000 photo that is stored at 2000 x 1500 and shows upright', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isTouch(testInfo), 'The touch add area shows on the phone projects only.');
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await openOrder(page, request, manager, id, number);

  // Touch shows the two buttons and no drop zone (D-17).
  const takePhoto = page.getByRole('button', { name: 'Take Photo', exact: true });
  const choosePhotos = page.getByRole('button', { name: 'Choose Photos', exact: true });
  await expect(takePhoto).toBeVisible();
  await expect(choosePhotos).toBeVisible();
  await expect(page.getByText('Drag images here or')).toBeHidden();
  await expect(page.locator('input[type="file"][capture="environment"]')).toHaveAttribute('accept', 'image/*');

  // Take Photo opens the camera picker; this test cancels it with no file.
  const [camera] = await Promise.all([page.waitForEvent('filechooser'), takePhoto.click()]);
  await camera.setFiles([]);

  const big = Buffer.from(await page.evaluate<number[]>(bandsScript(4000, 3000)));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), choosePhotos.click()]);
  await withPhotoHost(async () => {
    await chooser.setFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
    await expect(page.getByRole('button', { name: savedName(number, 1, 1) })).toBeVisible({ timeout: 120_000 });
  });

  const thumb = tiles(page).first().locator('img').first();
  await expect
    .poll(() => thumb.evaluate((image) => (image as unknown as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);
  const source = await thumb.getAttribute('src');
  expect(source).not.toBeNull();
  const stored = await page.evaluate<StoredPhoto>(readStoredPhoto(source ?? ''));
  expect(stored.status).toBe(200);
  expect(stored.width).toBe(2000);
  expect(stored.height).toBe(1500);
  // Upright: the red half is still on top and the blue half still below.
  expect(stored.top[0]).toBeGreaterThan(200);
  expect(stored.top[2]).toBeLessThan(80);
  expect(stored.bottom[2]).toBeGreaterThan(200);
  expect(stored.bottom[0]).toBeLessThan(80);
  await expectNoAxeViolations(page);
});

test('@order-photos-a11y F1 with three drafts has no axe violation and no CSP violation', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.locator('input[type="file"][multiple]').setInputFiles(await drawJpegs(page, 3));
  const drafts = page.getByRole('list', { name: 'Order photos' }).getByRole('listitem');
  await expect(drafts).toHaveCount(3);
  await expect(drafts.nth(0)).toContainText('New order photo 1');
  expect(
    isTouch(testInfo)
      ? await page.getByText('Drag images here or').isHidden()
      : await page.getByText('Drag images here or').isVisible(),
  ).toBe(true);

  await expectNoAxeViolations(page);
  await expectNoCspViolations(guard);
});

test('@order-photos-a11y O1 with 0 photos has no axe violation', async ({ page, request, guard }, testInfo) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await orderWithPhotos(page, request, 0);
  await expect(tiles(page)).toHaveCount(0);
  if (isTouch(testInfo)) {
    await expect(page.getByRole('button', { name: 'Take Photo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose Photos', exact: true })).toBeVisible();
  } else {
    await expect(page.getByText('Drag images here or')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take Photo', exact: true })).toBeHidden();
  }
  await expectNoAxeViolations(page);
});

for (const count of [1, 3, 5]) {
  test(`@order-photos-a11y O1 with ${String(count)} photo${count === 1 ? '' : 's'} has no axe violation${count === 3 ? ' and no CSP violation' : ''}`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(300_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await orderWithPhotos(page, request, count);
    await expect(tiles(page)).toHaveCount(count);
    await expect(tiles(page).first().getByText('Cover', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    if (count === 3) {
      await expectNoCspViolations(guard);
    }
  });
}

test('@order-photos-a11y O1 with waiting and uploading tiles has no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 0);
  const files = await drawJpegs(page, 3);

  // The first upload is held, so the first tile is "Uploading" and the other two stay "Waiting to upload".
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/v1\/orders\/[^/]+\/images$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await gate;
    await route.continue();
  });
  await withPhotoHost(async () => {
    try {
      await page.locator('input[type="file"][multiple]').setInputFiles(files);
      await expect(page.getByText('Uploading', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Waiting to upload')).toHaveCount(2);
      await expectNoAxeViolations(page);
    } finally {
      release();
    }
    await expect(page.getByRole('button', { name: savedName(number, 3, 3) })).toBeVisible({ timeout: 120_000 });
  });
  await page.unroute(/\/api\/v1\/orders\/[^/]+\/images$/);
});

test('@order-photos-a11y O1 with a failed tile and its banner has no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  guard.expectStatus(`/api/v1/orders/${id}/images`, 503);
  await openOrder(page, request, manager, id, number);
  const files = await drawJpegs(page, 2);

  await withPhotoHost(async () => {
    // The next upload fails as if the photo store were down; the one after it works.
    const armed = await request.post('/api/testing/images/fail-next', { data: { count: 1 } });
    expect(armed.status()).toBe(204);
    try {
      await page.locator('input[type="file"][multiple]').setInputFiles(files);
      await expect(page.getByRole('alert')).toContainText("1 of 2 photos didn't upload.");
      await expect(page.getByText("Didn't upload. The photo couldn't be saved. Try again.")).toBeVisible();
      await expect(page.getByRole('button', { name: 'Try again, photo-1.jpg' })).toBeVisible();
      await expectNoAxeViolations(page);
    } finally {
      await request.post('/api/testing/images/fail-next', { data: { count: 0 } });
    }
  });
});

test('@order-photos-a11y the open viewer has no axe violation and no CSP violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3);

  await page.getByRole('button', { name: savedName(number, 2, 3) }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  await expect(viewer.getByText('Photo 2 of 3', { exact: true })).toBeVisible();
  const shown = viewer.getByRole('img', { name: `Order ${number} photo 2` });
  await expect
    .poll(() => shown.evaluate((image) => (image as unknown as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);

  await expectNoAxeViolations(page);
  await expectNoCspViolations(guard);
});

test('@order-photos-a11y the description window with a 409 banner has no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { id, number } = await orderWithPhotos(page, request, 2);
  guard.expectStatus(`/api/v1/orders/${id}/images/`, 409);

  await page.getByRole('button', { name: 'Edit description of photo 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Description' });
  await expect(dialog.getByText(`${number} · Photo 1 of 2`)).toBeVisible();

  // A coworker describes photo 2 while the window is open, so the order has a newer version than the window holds.
  const headers = { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${await apiToken(page)}` };
  const read = await page.request.get(`/api/v1/orders/${id}`, { headers });
  expect(read.status(), `GET /api/v1/orders/${id}`).toBe(200);
  const order = (await read.json()) as { version: string; images: { id: string; position: number }[] };
  const second = [...order.images].sort((a, b) => a.position - b.position)[1];
  expect(second).toBeDefined();
  const changed = await page.request.put(`/api/v1/orders/${id}/images/${second?.id ?? ''}`, {
    headers,
    data: { description: 'Changed by a coworker', version: order.version },
  });
  expect(changed.status(), 'PUT description by a coworker').toBe(200);

  await dialog.getByLabel('Photo description').fill('Front mockup');
  await dialog.getByRole('button', { name: 'Save Description' }).click();
  await expect(dialog.getByRole('button', { name: 'Load Latest' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('@order-photos-a11y the delete photo dialog has no axe violation', async ({ page, request, guard }) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 2);

  await page.getByRole('button', { name: 'Delete photo 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete photo 1?' });
  await expect(dialog.getByText(`It's removed from ${number} right away. This can't be undone.`)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('@order-photos-a11y a Completed order shows its photos read-only with no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // 6 x 700 = 4,200.00, paid in full and delivered, so Mark Completed is open.
  const { number } = await orderWithPhotos(page, request, 2, {
    status: 'delivered',
    payment: { amount: 4200 },
  });

  await page.getByRole('button', { name: 'Change Status' }).click();
  await page.getByRole('menuitem', { name: 'Mark Completed' }).click();
  await expect(page.getByText('This order is completed.')).toBeVisible();
  await expect(page.getByRole('button', { name: savedName(number, 2, 2) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete photo 1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose Photos', exact: true })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('@order-photos-a11y the deleted order view shows its photos read-only with no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { id, number } = await orderWithPhotos(page, request, 2);
  const removed = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${await apiToken(page)}` },
  });
  expect(removed.status(), `DELETE /api/v1/orders/${id}`).toBe(204);

  await page.goto(`/admin/orders/deleted/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: savedName(number, 2, 2) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete photo 1' })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

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

test('@order-photos-a11y the Orders grid and table with a cover have no axe violation', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 1);

  await page.goto(`/admin/orders?q=${number}&view=grid`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  // A cover loads lazily, so it is brought into view first.
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => coverWidth(card), { timeout: 20_000 }).toBeGreaterThan(0);
  await expectNoAxeViolations(page);

  await page.goto(`/admin/orders?q=${number}&view=table`);
  const row = page.getByRole('row').filter({ hasText: number });
  await expect(row).toHaveCount(1);
  await row.scrollIntoViewIfNeeded();
  await expect.poll(() => coverWidth(row), { timeout: 20_000 }).toBeGreaterThan(0);
  await expectNoAxeViolations(page);
});

/** How many distinct left edges the photo tiles have: one means a single column. */
function columnCount(page: Page): Promise<number> {
  return page.evaluate<number>(`(() => {
    const items = document.querySelectorAll('ul[aria-label="Order photos"] > li');
    return new Set(Array.from(items, (item) => Math.round(item.getBoundingClientRect().left))).size;
  })()`);
}

test('@order-photos-a11y UIC-31 at 320 px the photo list is one column and the page has no sideways scroll', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3);

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole('button', { name: savedName(number, 3, 3) })).toBeVisible();
  expect(await columnCount(page)).toBe(1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate<boolean>('document.scrollingElement.scrollWidth === document.scrollingElement.clientWidth'),
  ).toBe(true);

  // The New Order form with drafts stays inside 320 px too.
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await page.locator('input[type="file"][multiple]').setInputFiles(await drawJpegs(page, 3));
  await expect(tiles(page)).toHaveCount(3);
  expect(await columnCount(page)).toBe(1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
});

/** What the viewer's picture shows: its size, its fit and whether its whole box is inside the window. */
function readViewerPicture(): string {
  return `(() => {
    const image = document.querySelector('[role="dialog"][aria-label="Order photos"] img');
    const box = image.getBoundingClientRect();
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      fit: getComputedStyle(image).objectFit,
      width: box.width,
      height: box.height,
      inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
    };
  })()`;
}

interface ViewerPicture {
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly fit: string;
  readonly width: number;
  readonly height: number;
  readonly inside: boolean;
}

test('@order-photos-a11y UIC-33 the viewer shows a 1:4 and a 4:1 photo whole, never cropped', async ({
  page,
  request,
  guard,
  browserName,
}, testInfo) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request);
  await openOrder(page, request, manager, id, number);
  // Shrunk by the browser to a long edge of 2000: 500 x 2000 and 2000 x 500.
  const tall = {
    name: 'tall.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(await page.evaluate<number[]>(gradientScript(1000, 4000, 20))),
  };
  const wide = {
    name: 'wide.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(await page.evaluate<number[]>(gradientScript(4000, 1000, 200))),
  };
  await uploadAndWait(page, number, [tall, wide], 2);

  await page.getByRole('button', { name: savedName(number, 1, 2) }).click();
  const viewer = page.getByRole('dialog', { name: 'Order photos' });
  const picture = viewer.getByRole('img', { name: `Order ${number} photo 1` });
  await expect
    .poll(() => picture.evaluate((image) => (image as unknown as { naturalWidth: number }).naturalWidth))
    .toBeGreaterThan(0);
  const shapes: [string, number][] = [
    ['1x4', 0.25],
    ['4x1', 4],
  ];
  for (const [label, ratio] of shapes) {
    // WebKit's screenshot adds an inline style element, which the strict CSP blocks, so WebKit takes no picture here.
    if (browserName !== 'webkit') {
      await testInfo.attach(`viewer-${label}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    const read = await page.evaluate<ViewerPicture>(readViewerPicture());
    expect(read.naturalWidth / read.naturalHeight).toBeCloseTo(ratio, 1);
    expect(read.fit).toBe('contain');
    expect(read.inside, `the ${label} picture box sits inside the window`).toBe(true);
    expect(read.width).toBeGreaterThan(0);
    expect(read.height).toBeGreaterThan(0);
    if (label === '1x4') {
      await page.keyboard.press('ArrowRight');
      await expect(viewer.getByText('Photo 2 of 2', { exact: true })).toBeVisible();
      const next = viewer.getByRole('img', { name: `Order ${number} photo 2` });
      await expect
        .poll(() => next.evaluate((image) => (image as unknown as { naturalWidth: number }).naturalWidth))
        .toBeGreaterThan(0);
    }
  }
});

/** The controls inside the Images card that have no name, and the per-photo buttons drawn smaller than 44 px. */
function readPhotoControls(): string {
  return `(() => {
    const card = document.querySelector('section[aria-labelledby="order-images"]');
    const unnamed = [];
    const small = [];
    for (const control of card.querySelectorAll('button, a')) {
      const shown = control.getClientRects().length > 0;
      if (!shown) { continue; }
      const name = (control.getAttribute('aria-label') || control.textContent || '').trim();
      if (name === '') { unnamed.push(control.outerHTML.slice(0, 80)); }
      const label = control.getAttribute('aria-label') || '';
      if (/^(Move photo|Make cover|Edit description|Delete photo)/.test(label)) {
        // A small control may reach 44 px with an invisible ::before tap area (hitAreaClasses): the larger of the two counts.
        const box = control.getBoundingClientRect();
        const before = getComputedStyle(control, '::before');
        const reach = before.content === 'none' ? 0 : parseFloat(before.height) || 0;
        const height = Math.max(box.height, reach);
        if (box.width < 44 || height < 44) { small.push(label + ' ' + Math.round(box.width) + 'x' + Math.round(height)); }
      }
    }
    return { unnamed, small };
  })()`;
}

test('@order-photos-a11y UIC-42 every photo control has a name, a big enough target and passes axe at 390, 820 and 1440 px', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3);

  for (const size of [
    { width: 390, height: 844 },
    { width: 820, height: 1100 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: savedName(number, 3, 3) })).toBeVisible();
    const controls = await page.evaluate<{ unnamed: string[]; small: string[] }>(readPhotoControls());
    expect(controls.unnamed, `unnamed controls at ${String(size.width)} px`).toEqual([]);
    expect(controls.small, `controls under 44 px at ${String(size.width)} px`).toEqual([]);
    await expectNoAxeViolations(page);
  }
});

test('@order-photos-a11y the Order photos showcase cases show on request and have no axe violation', async ({
  page,
}) => {
  // About 200 cases plus the Order photos cases: the first load is slow in WebKit, so the waits here are long.
  test.setTimeout(240_000);
  const response = await page.goto('/dev/components');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Component Showcase', { timeout: 60_000 });
  await expect(page.locator('[data-case="photos-list-three"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show the Order photos cases' }).click();

  await expect(page.locator('[data-case="photos-list-three"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-case="photos-viewer"]')).toBeVisible();
  await expectNoAxeViolations(page);
});
