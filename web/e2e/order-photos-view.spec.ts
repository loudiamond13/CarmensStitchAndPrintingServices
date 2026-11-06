// Looking at order photos end to end (ORD-04, IMG-04; plan 09-23). A signed-in Manager adds five photos to a seeded order, opens
// photo 2 in the viewer, steps to photo 4 with the arrow key and closes it with Esc: focus is on photo 4's thumb. "Open Full
// Size" is a link to the full-size address in a new tab. A cancelled order and a deleted order show their photos read-only: no
// add area and no photo controls, while the thumbs still open the viewer; a reopen brings the controls back. The photos come
// from the Testing image route, so Playwright never reaches Cloudinary (D-07). The uploads run under withPhotoHost, because the fail-next switch of the Testing host is shared by
// every project running together. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { addPhotos, savedName, seedOrder, type PhotoOrderSeed } from './photos.ts';
import { createStaff } from './testing-api.ts';

const SEED: PhotoOrderSeed = {
  prefix: 'ORD-2095',
  label: 'View',
  itemDescription: 'E2E view jersey',
};

test('@order-photos-view photo 2 opens in the viewer, ArrowRight reaches photo 4, Esc puts focus on photo 4', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(request, SEED);
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
  const { id, number } = await seedOrder(request, SEED);
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
  const { id, number } = await seedOrder(request, SEED);
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
