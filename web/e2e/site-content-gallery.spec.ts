// Site Content, the Gallery tab, end to end (GAL-03, PUB-03, D-10, D-15, D-27; plan 11-32), in all five projects. A Manager adds a photo of older
// work, and it is the first row of the tab and the first tile of /gallery. The gallery is one set for every project, so a test that reads or
// changes it runs under the site content lock (and the photo host lock for an upload) and puts the demo content back at the end
// (seedDemoSiteContent also deletes every upload whose team starts with "E2E-"). Signing in takes the longest, so every test signs in before it
// takes the locks. Every test runs under the shared guard (console, page errors, CSP, failed responses). The demo gallery items have no file on
// the Testing image host, so their thumbs answer 404, which each test declares.
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { press } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

// Each test waits its turn for the locks and signs in, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

const E2E_TEAM = 'E2E-Riders';

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Gallery tab. */
async function openGalleryTab(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  const sidebarLink = page.locator('aside nav[aria-label="Admin"]').getByRole('link', { name: /^Site Content/ });
  // The shell may still be laying out: wait for whichever navigation this width shows before choosing.
  await expect(menu.or(sidebarLink)).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: /^Site Content/ })
      .click();
  } else {
    await sidebarLink.click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
  await page.getByRole('tab', { name: 'Gallery' }).click();
  await expect(page).toHaveURL(/tab=gallery/);
  await expect(page.getByRole('table', { name: 'Gallery items' })).toBeVisible();
}

/** The names of the items on the public Gallery, in order. */
async function publicGalleryTeams(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/v1/public/gallery');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { items: { team: string }[] }).items.map((item) => item.team);
}

/** Adds E2E-Riders for the Moto line with 12 pieces through the window. */
async function addE2ePhoto(page: Page): Promise<void> {
  const photo = await drawJpeg(page, 'e2e-riders.jpg', 30);
  await page.getByRole('button', { name: 'Add Photo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Photo' });
  await expect(dialog.getByText('Only add photos the customer said you may show.')).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Show on the website' })).toBeChecked();
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles(photo);
  await expect(dialog.getByText('Photo chosen')).toBeVisible({ timeout: SAVE_WAIT_MS });
  await dialog.getByLabel(/^Team or name/).fill(E2E_TEAM);
  await dialog.getByLabel(/^Product line/).selectOption({ label: 'Moto Riding Jerseys' });
  await dialog.getByLabel(/^Pieces/).fill('12');
  await withPhotoHost(async () => {
    await press(page, dialog.getByRole('button', { name: 'Save Photo' }));
    await expect(page.getByText('Photo added')).toBeVisible({ timeout: SAVE_WAIT_MS });
  });
  await expect(page.getByText("It's at the top of the Gallery.")).toBeVisible();
}

test('@site-content-gallery a Manager adds E2E-Riders for Moto with 12 pieces, and it is the first row and the first tile on /gallery', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  guard.expectStatus('/api/testing/images/', 404);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openGalleryTab(page);
      const table = page.getByRole('table', { name: 'Gallery items' });
      await expect(table.locator('tbody tr')).toHaveCount(6);

      await addE2ePhoto(page);

      await expect(table.locator('tbody tr')).toHaveCount(7);
      await expect(table.locator('tbody tr').first()).toContainText(E2E_TEAM);
      await expect(table.locator('tbody tr').first()).toContainText('Moto');
      await expect(table.locator('tbody tr').first()).toContainText('12 pcs');
      await expect(table.locator('tbody tr').first()).toContainText('Uploaded');
      expect((await publicGalleryTeams(request))[0]).toBe(E2E_TEAM);

      await page.goto('/gallery');
      await expect(page.getByRole('button', { name: /^Open / }).first()).toHaveAccessibleName(
        new RegExp(`^Open ${E2E_TEAM}, Moto`),
      );
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});
