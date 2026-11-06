// Deleting order photos end to end (ORD-04, D-15, D-20; plan 09-29). A signed-in Manager adds three photos to a seeded order and
// deletes the cover: the dialog asks first with Cancel focused, the next photo becomes the cover on the page and on the Orders
// list, focus lands on the next photo's thumb and "Saved" shows. The photos come from the Testing image route, so Playwright never
// reaches Cloudinary (D-07). The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by
// every project running together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { expect, test } from './fixtures.ts';
import {
  deleteOrderThroughApi,
  orderWithPhotos,
  photoKey,
  thumbSources,
  tiles,
  type PhotoOrderSeed,
} from './photos.ts';

const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2092',
  label: 'Delete',
  itemDescription: 'E2E delete jersey',
};

test('@order-photos-delete deleting the cover asks first, makes the next photo the cover here and on the Orders list, and focus lands on the next thumb', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3, SEED);
  const before = await thumbSources(page);
  expect(new Set(before).size).toBe(3);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete photo 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete photo 1?' });
  await expect(dialog.getByText(`It's removed from ${number} right away. This can't be undone.`)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete Photo' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => thumbSources(page)).toEqual([before[1], before[2]]);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Open photo 1 of 2: Order ${number} photo 1` })).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(page.getByText('Photo deleted. 2 photos left.')).toBeAttached();

  await page.goto(`/admin/orders?q=${number}&view=grid`);
  const card = page.getByRole('article').filter({ hasText: number });
  await expect(card).toHaveCount(1);
  await expect(card.locator('img').first()).toHaveAttribute('src', new RegExp(photoKey(before[1])));
});

test("@order-photos-delete a Manager's permanent-delete dialog counts the order's 2 photos", async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { id, number } = await orderWithPhotos(page, request, 2, SEED);
  await deleteOrderThroughApi(page, id);

  await page.goto(`/admin/orders/deleted/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Order Permanently' }).click();

  const dialog = page.getByRole('dialog', { name: `Delete ${number} permanently?` });
  const box = dialog.getByRole('alert');
  await expect(box).toContainText('and 2 images.');
  await expect(box.getByRole('listitem').filter({ hasText: 'images' })).toHaveText('2images');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});
