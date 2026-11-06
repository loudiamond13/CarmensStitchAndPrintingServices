// Arranging order photos end to end (ORD-04, D-13 to D-15; plan 09-27). A signed-in Manager adds three photos to a seeded order,
// then moves one with the keyboard only: the tiles reorder after the server answers, the Cover tag follows, focus stays on the
// pressed control and "Saved" shows. The photos come from the Testing image route, so Playwright never reaches Cloudinary (D-07).
// The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by every project running
// together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import { expect, test } from './fixtures.ts';
import { orderWithPhotos, photoKey, savedName, thumbSources, tiles, type PhotoOrderSeed } from './photos.ts';

const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2094',
  label: 'Arrange',
  itemDescription: 'E2E arrange jersey',
};

test('@order-photos-arrange with the keyboard only, Move photo 1 right swaps the first two photos and the Cover tag follows', async ({
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

test('@order-photos-arrange Make Cover on photo 3 makes it the cover here and on the Orders list, and focus goes to its Edit description', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const { number } = await orderWithPhotos(page, request, 3, SEED);
  const before = await thumbSources(page);
  const key = photoKey(before[2]);

  await page.getByRole('button', { name: 'Make cover, photo 3' }).click();

  await expect.poll(() => thumbSources(page)).toEqual([before[2], before[0], before[1]]);
  await expect(tiles(page).nth(0).getByText('Cover', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit description of photo 1' })).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.goto(`/admin/orders?q=${number}&view=grid`);
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
  const { number } = await orderWithPhotos(page, request, 2, SEED);

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
