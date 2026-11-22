// Site Content, the Gallery tab, end to end (GAL-03, PUB-03, D-10, D-15, D-27; plan 11-32), in all five projects. A Manager adds a photo of older
// work, and it is the first row of the tab and the first tile of /gallery. The gallery is one set for every project, so a test that reads or
// changes it runs under the site content lock (and the photo host lock for an upload) and puts the demo content back at the end
// (seedDemoSiteContent also deletes every upload whose team starts with "E2E-"). Signing in takes the longest, so every test signs in before it
// takes the locks. Every test runs under the shared guard (console, page errors, CSP, failed responses). The demo gallery items have no file on
// the Testing image host, so their thumbs answer 404, which each test declares.
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { drawJpeg } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

// Each test waits its turn for the locks and signs in, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

const E2E_TEAM = 'E2E-Riders';

/** The number of a demo order item, as its link in the Source column reads it. */
const ORDER_NUMBER = /^DEMO-GALLERY-\d+$/;

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
  // Exact: a loose match also finds the placeholder "No photo chosen yet" and saves before the photo is ready.
  await expect(dialog.getByText('Photo chosen', { exact: true })).toBeVisible({ timeout: SAVE_WAIT_MS });
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

test('@site-content-gallery the line filter and the page size live in the URL, an order link and Back keep them, and at 320px the rows are cards', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      // The six demo items fit one page, so "Rows per page" is not drawn: a size in the link is read, kept and shown in the URL.
      await page.goto('/admin/site-content?tab=gallery&size=10');
      const table = page.getByRole('table', { name: 'Gallery items' });
      await expect(table).toBeVisible();
      await expect(table.locator('tbody tr')).toHaveCount(6);
      await expect(page).toHaveURL(/size=10/);

      // A line is in the URL too, and the list follows it.
      await page.getByLabel('Product line').selectOption({ label: 'Basketball Jerseys' });
      await expect(page).toHaveURL(/line=[0-9a-f-]{36}/);
      await expect(page).toHaveURL(/tab=gallery/);
      await expect(page).toHaveURL(/size=10/);
      await expect(page.getByText(/Showing\s+\d+\s+items?\s+·\s+in gallery order/)).toBeVisible();
      await expect(table.locator('tbody tr')).not.toHaveCount(6);
      const filtered = await table.locator('tbody tr').count();
      expect(filtered).toBeGreaterThan(0);
      const addressBefore = page.url();

      // An order item links to its order, and Back returns to the same list.
      await table.getByRole('link', { name: ORDER_NUMBER }).first().click();
      await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);
      await page.goBack();
      await expect(page.getByRole('table', { name: 'Gallery items' })).toBeVisible();
      expect(page.url()).toBe(addressBefore);
      await expect(page.getByLabel('Product line')).not.toHaveValue('');
      await expect(table.locator('tbody tr')).toHaveCount(filtered);

      // Phone: no header row, each cell on its own line with its label, no sideways scroll.
      await page.setViewportSize({ width: 320, height: 640 });
      await expect(page.locator('thead')).toBeHidden();
      await expect(page.locator('td[data-label="Status"]').first()).toHaveCSS('display', 'flex');
      expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
      await expectNoAxeViolations(page);
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

test('@site-content-gallery a Manager moves E2E-Riders below a shown order, hides it so it leaves /gallery, then deletes it', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openGalleryTab(page);
      const table = page.getByRole('table', { name: 'Gallery items' });
      await addE2ePhoto(page);
      await expect(table.locator('tbody tr')).toHaveCount(7);
      await expect(table.locator('tbody tr').first()).toContainText(E2E_TEAM);
      // The first row has no Move up; every order item has no Edit, Hide or Delete (an order is taken off the website from its order).
      await expect(page.getByRole('button', { name: `Move ${E2E_TEAM} up` })).toHaveAttribute('aria-disabled', 'true');
      const orderRow = table.locator('tbody tr', { has: page.getByRole('link', { name: ORDER_NUMBER }) }).first();
      await expect(orderRow.getByRole('link', { name: /^Change .* on order / })).toBeVisible();
      await expect(orderRow.getByRole('button', { name: /^(Edit|Hide|Show|Delete) / })).toHaveCount(0);

      // Move it down one place: below the next item, and /gallery shows the new order.
      await press(page, page.getByRole('button', { name: `Move ${E2E_TEAM} down` }));
      await expect(page.getByText(`${E2E_TEAM} moved to place 2 of 7.`)).toBeAttached({ timeout: SAVE_WAIT_MS });
      await expect(table.locator('tbody tr').nth(1)).toContainText(E2E_TEAM);
      await expect(page.getByRole('button', { name: `Move ${E2E_TEAM} down` })).toBeFocused();
      expect((await publicGalleryTeams(request)).indexOf(E2E_TEAM)).toBe(1);

      // Hide it: it stays in the list as Hidden and leaves the public Gallery.
      await press(page, page.getByRole('button', { name: `Hide ${E2E_TEAM}` }));
      await expect(page.getByText('Photo hidden')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText("It's off the Gallery. Nothing is deleted.")).toBeVisible();
      await expect(table.locator('tbody tr').nth(1)).toContainText('Hidden');
      await expect(page.getByRole('button', { name: `Show ${E2E_TEAM}` })).toBeFocused();
      expect(await publicGalleryTeams(request)).not.toContain(E2E_TEAM);

      // Delete it: the question names it, Cancel has focus, and the row goes.
      await press(page, page.getByRole('button', { name: `Delete ${E2E_TEAM}` }));
      const question = page.getByRole('dialog', { name: 'Delete this photo?' });
      await expect(question.getByText(`${E2E_TEAM}. It's removed from the Gallery for good.`)).toBeVisible();
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await press(page, question.getByRole('button', { name: 'Delete Photo' }));
      await expect(page.getByText('Photo deleted')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(table.locator('tbody tr')).toHaveCount(6);
      expect(await publicGalleryTeams(request)).not.toContain(E2E_TEAM);
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});
