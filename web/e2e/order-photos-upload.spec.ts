// Adding photos on the order page end to end (ORD-04, IMG-01, IMG-05; plan 09-16). A signed-in Manager picks photos, they are
// prepared in the browser, upload one at a time to the E2E host, and show as saved photos whose thumbs the Testing image route
// serves, so Playwright never reaches Cloudinary (D-07). Test images are drawn on a canvas at test time. Every test runs under the
// shared guard (console, page errors, CSP, failed responses). Each test seeds its own order by a unique number. The uploads run
// under withPhotoHost, because the fail-next switch of the Testing host is shared by every project running at the same time.
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg, savedName, seedOrder, type PhotoOrderSeed } from './photos.ts';
import { createStaff } from './testing-api.ts';

const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2097',
  label: 'Photos',
  itemDescription: 'E2E photo jersey',
};

/** The natural width of the nth saved photo's thumb: 0 until the browser has decoded it (a broken image stays 0). */
async function thumbWidth(page: Page, position: number): Promise<number> {
  const script = `(() => {
    const image = document.querySelectorAll('[aria-label^="Open photo ${String(position)} of "] img')[0];
    return image && image.complete ? image.naturalWidth : 0;
  })()`;
  return Number(await page.evaluate(script));
}

test('@order-photos-upload a Manager picks a photo and sees it saved with a thumb from the server', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, SEED);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
  const front = await drawJpeg(page, 'front.jpg', 200);

  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(front);

    await expect(page.getByRole('button', { name: savedName(number, 1, 1) })).toBeVisible();
    await expect.poll(() => thumbWidth(page, 1)).toBeGreaterThan(0);
    await expect(page.getByText('front.jpg')).toBeHidden();
    await expect(page.getByText('Photos added', { exact: true })).toBeVisible();
    await expect(page.getByText(`1 photo added to ${number}.`)).toBeVisible();
  });
});

test('@order-photos-upload three picked photos upload in order and show as three saved photos', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, SEED);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const files = [
    await drawJpeg(page, 'one.jpg', 10),
    await drawJpeg(page, 'two.jpg', 120),
    await drawJpeg(page, 'three.jpg', 240),
  ];

  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(files);

    await expect(page.getByText('Photos added', { exact: true })).toBeVisible();
    await expect(page.getByText(`3 photos added to ${number}.`)).toBeVisible();
    for (const position of [1, 2, 3]) {
      await expect(page.getByRole('button', { name: savedName(number, position, 3) })).toBeVisible();
      await expect.poll(() => thumbWidth(page, position)).toBeGreaterThan(0);
    }
    await expect(page.getByText('3/5').first()).toBeAttached();
    await expect(page.getByText(/Uploading photo/)).toBeHidden();
  });
});

test('@order-photos-upload a failed upload waits with a banner, and Try Again uploads it and clears the banner', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, SEED);
  guard.expectStatus(`/api/v1/orders/${id}/images`, 503);
  await signInAs(page, request, manager);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  const files = [await drawJpeg(page, 'one.jpg', 30), await drawJpeg(page, 'two.jpg', 150)];

  await withPhotoHost(async () => {
    // The next upload fails as if the photo store were down; the one after it works.
    const armed = await request.post('/api/testing/images/fail-next', { data: { count: 1 } });
    expect(armed.status()).toBe(204);
    try {
      await page.locator('input[type="file"][multiple]').setInputFiles(files);

      const banner = page.getByRole('alert');
      await expect(banner).toContainText("1 of 2 photos didn't upload.");
      await expect(banner).toContainText(
        "They're below. Try again or remove them. If you leave this page, they're lost.",
      );
      await expect(page.getByText("Didn't upload. The photo couldn't be saved. Try again.")).toBeVisible();
      await expect(page.getByRole('button', { name: savedName(number, 1, 1) })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove one.jpg' })).toBeVisible();

      await page.getByRole('button', { name: 'Try again, one.jpg' }).click();

      await expect(page.getByText(`2 photos added to ${number}.`)).toBeVisible();
      await expect(banner).toBeHidden();
      await expect(page.getByRole('button', { name: savedName(number, 2, 2) })).toBeVisible();
      await expect.poll(() => thumbWidth(page, 2)).toBeGreaterThan(0);
      await expect(page.getByText('one.jpg')).toBeHidden();
    } finally {
      // Leaves the host switch off whatever happened above.
      await request.post('/api/testing/images/fail-next', { data: { count: 0 } });
    }
  });
});
