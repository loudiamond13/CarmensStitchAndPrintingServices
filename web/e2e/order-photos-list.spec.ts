// The cover photo on the Orders list end to end (ORD-04 success criterion 2, IMG-04; plan 09-18). A signed-in Manager adds one
// photo to a seeded order on the order page, opens the Orders list, and the order's cover loads in the grid card and in the table
// thumb from the Testing image route, so Playwright never reaches Cloudinary (D-07). An order without a photo keeps its
// placeholder. The order is due long ago, so the default sort puts it on the first page whatever else the database holds. The
// upload runs under withPhotoHost, because the fail-next switch of the Testing host is shared by every project running together.
// Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg, seedOrder, type PhotoOrderSeed } from './photos.ts';
import { createStaff } from './testing-api.ts';

// Due long ago, so the default sort puts the order on the first page whatever else the database holds.
const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2096',
  label: 'Cover',
  itemDescription: 'E2E cover jersey',
  orderDate: '2000-01-01',
  dueDate: '2000-01-02',
};

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
  const photo = await drawJpeg(page, 'cover.jpg', 200);
  await withPhotoHost(async () => {
    await page.locator('input[type="file"][multiple]').setInputFiles(photo);
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
  const { id, number } = await seedOrder(request, { ...SEED, label: 'Cover' });
  await signInAs(page, request, manager);
  await addPhoto(page, id, number);

  await page.goto(`/admin/orders?q=${number}&view=grid`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  // A cover loads lazily, so it is brought into view first.
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => coverWidth(card)).toBeGreaterThan(0);
  await expect(card.getByRole('button', { name: `View order ${number}, Pending` })).toBeVisible();
  await expect(card.getByText('No images yet')).toHaveCount(0);

  await page.goto(`/admin/orders?q=${number}&view=table`);
  const row = page.getByRole('row').filter({ hasText: number });
  await expect(row).toHaveCount(1);
  await row.scrollIntoViewIfNeeded();
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
  const { number } = await seedOrder(request, { ...SEED, label: 'Plain' });
  await signInAs(page, request, manager);

  await page.goto(`/admin/orders?q=${number}&view=grid`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('img', { name: /No images yet/ })).toBeVisible();
  await expect(card.locator('img')).toHaveCount(0);
});
