// Site Content, the Products tab and the product line editor, end to end (CONT-02, PUB-03, D-04, D-08; plan 11-20), in all five projects. A
// Manager opens the Products tab, edits Polo with a price, saves, and the public Products page carries it. The product lines are one set
// for every project, so a test that reads or changes them runs under the site content lock and puts the demo lines back at the end
// (seedDemoSiteContent also deletes every line whose short name starts with "E2E-"). Signing in takes the longest, so every test signs in
// before it takes the lock. Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { apiToken, drawJpeg, type PickedFile } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

// Each test waits its turn for the site content lock and signs in, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Products tab. */
async function openProductsTab(page: Page): Promise<void> {
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
  await page.getByRole('tab', { name: 'Products' }).click();
  await expect(page).toHaveURL(/tab=products/);
  await expect(page.getByRole('table', { name: 'Product lines' })).toBeVisible();
}

test('@site-content-products a Manager edits Polo with the price 450.00, saves, and the public Products page shows it', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);

      await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();
      await page.getByLabel(/^Starts at, per piece/).fill('450.00');
      await expect(page.getByText('Visitors see: Starts at ₱450.00 / pc')).toBeVisible();
      await press(page, page.getByRole('button', { name: 'Save Changes' }));

      await expect(page.getByText('Product line saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('The website shows the changes now.')).toBeVisible();

      await page.goto('/products');
      const polo = page.getByRole('article', { name: 'Polo Shirts' });
      await expect(polo.getByText('Starts at')).toBeVisible();
      await expect(polo.getByText('₱450.00')).toBeVisible();
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

/** Fills every required text of a new line with fake words, under the names of the fields. */
async function fillRequiredTexts(page: Page, name: string): Promise<void> {
  await page.getByLabel(/^Title/).fill(name);
  await page.getByLabel(/^Short name/).fill(name);
  await page.getByLabel(/^Card text/).fill('A line made by an end-to-end test.');
  await page.getByLabel(/^Description/).fill('This line only exists while the test runs.');
  await page.getByLabel(/^Fabric/).fill('Test fabric.');
  await page.getByLabel(/^Collar style/).fill('Test collar.');
  await page.getByLabel(/^Cut & fit/).fill('Test cut.');
  await page.getByLabel(/^Names & numbers/).fill('Test names.');
  await page.getByLabel(/^Logos & sponsors/).fill('Test logos.');
}

test('@site-content-products a Manager adds E2E-Shorts, lands on its editor, and the line stays off /products until it is shown', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);

      await page.getByRole('link', { name: 'Add Product Line' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'New Product Line' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
      await expect(page.getByText('Save the product line first, then add photos.')).toBeVisible();
      await fillRequiredTexts(page, 'E2E-Shorts');
      await press(page, page.getByRole('button', { name: 'Save Product Line' }));

      await expect(page.getByText('Product line added')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText("It's hidden until you tick Show on the website.")).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/site-content\/products\/[0-9a-f-]{36}$/);
      await expect(page.getByRole('heading', { level: 1, name: 'E2E-Shorts' })).toBeVisible();
      await expect(page.getByText('Hidden', { exact: true })).toBeVisible();

      // Hidden: the public Products page still has its six articles and none is the new line.
      await page.goto('/products');
      await expect(page.getByRole('article')).toHaveCount(6);
      await expect(page.getByRole('article', { name: 'E2E-Shorts' })).toHaveCount(0);
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

/** The short names of the lines the public site shows. */
async function publicShortNames(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/v1/public/product-lines');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { lines: { shortName: string }[] }).lines.map((line) => line.shortName);
}

// This one only looks at the layout, which any lines give, so it does not take the lock.
test('@site-content-products at 390px the list is row cards, at 768px it scrolls inside its frame, and at 320px the page has no sideways scroll and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 390, height: 844 });
  await openProductsTab(page);

  // Phone: no header row, each cell on its own line with its label.
  await expect(page.locator('thead')).toBeHidden();
  await expect(page.locator('td[data-label="Starts at"]').first()).toHaveCSS('display', 'flex');
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);

  // Tablet: the columns stay and the frame scrolls on its own, a named region a keyboard can reach.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator('thead')).toBeVisible();
  const frame = page.locator('div[role="region"][aria-label="Product lines"]');
  await expect(frame).toHaveAttribute('tabindex', '0');
  // The frame may be wider inside than it shows (that is the scrolling), but the page itself never scrolls sideways.
  expect(
    await frame.evaluate(
      (element: { scrollWidth: number; clientWidth: number }) => element.scrollWidth >= element.clientWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole('table', { name: 'Product lines' })).toBeAttached();
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@site-content-products a Manager hides E2E-Shorts, shows it again and deletes it, and the public site follows each step', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);
      await page.getByRole('link', { name: 'Add Product Line' }).click();
      await fillRequiredTexts(page, 'E2E-Shorts');
      await page.getByRole('checkbox', { name: 'Show on the website' }).check();
      await press(page, page.getByRole('button', { name: 'Save Product Line' }));
      await expect(page.getByText("It's on the website now.")).toBeVisible({ timeout: SAVE_WAIT_MS });
      expect(await publicShortNames(request)).toContain('E2E-Shorts');

      await page.locator('a[href="/admin/site-content?tab=products"]').click();
      await expect(page.getByRole('table', { name: 'Product lines' })).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: 'E2E-Shorts' });
      await expect(row.getByText('Shown', { exact: true })).toBeVisible();

      // The row actions are pressed from the keyboard (press): on a phone the toasts of the earlier steps can sit over the last card, and a
      // pointer click would wait for them to go. This is also how the focus rules below are proved.
      // Hide: no question, the toast, the badge, and focus stays on the toggle, now Show.
      await press(page, page.getByRole('button', { name: 'Hide E2E-Shorts' }));
      await expect(page.getByText('E2E-Shorts hidden')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(row.getByText('Hidden', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Show E2E-Shorts' })).toBeFocused();
      expect(await publicShortNames(request)).not.toContain('E2E-Shorts');

      await press(page, page.getByRole('button', { name: 'Show E2E-Shorts' }));
      await expect(page.getByText('E2E-Shorts shown')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(row.getByText('Shown', { exact: true })).toBeVisible();
      expect(await publicShortNames(request)).toContain('E2E-Shorts');

      // Move: the new line is last; Move up puts it one place higher and focus stays on Move up.
      await press(page, page.getByRole('button', { name: 'Move E2E-Shorts up' }));
      await expect(page.getByText('E2E-Shorts moved to position 6 of 7.')).toBeAttached({ timeout: SAVE_WAIT_MS });
      await expect(page.getByRole('button', { name: 'Move E2E-Shorts up' })).toBeFocused();

      // Delete: the question focuses Cancel first, and the line is gone for good.
      await press(page, page.getByRole('button', { name: 'Delete E2E-Shorts' }));
      const question = page.getByRole('dialog', { name: 'Delete E2E-Shorts?' });
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await press(page, question.getByRole('button', { name: 'Delete Product Line' }));
      await expect(page.getByText('Product line deleted')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('E2E-Shorts was removed.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Edit E2E-Shorts' })).toHaveCount(0);
      expect(await publicShortNames(request)).not.toContain('E2E-Shorts');
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

/** The slots of a line photo. */
const PHOTO_SLOTS = ['main', 'back', 'fabric'] as const;

/** The line id at the end of an editor address (/admin/site-content/products/{id}). */
function lineIdOf(url: string): string {
  const id = /\/products\/([0-9a-f-]{36})$/.exec(new URL(url).pathname)?.[1];
  if (id === undefined) {
    throw new Error(`No line id in ${url}`);
  }
  return id;
}

/**
 * Takes every photo off a line through the API as the signed-in Manager of this page. The demo reset does not touch the photos of the six
 * demo lines, so a test that adds one removes it here whatever happened. A slot that is already empty answers 404, which is fine.
 */
async function clearLinePhotos(page: Page, lineId: string): Promise<void> {
  const authorization = `Bearer ${await apiToken(page)}`;
  for (const slot of PHOTO_SLOTS) {
    const removed = await page.request.delete(`/api/v1/product-lines/${lineId}/photos/${slot}`, {
      headers: { 'X-CSPS-CSRF': '1', Authorization: authorization },
    });
    expect([204, 404], `DELETE photos/${slot}`).toContain(removed.status());
  }
}

/** The photo of a slot on the Polo editor: its group, by the slot's label. */
function slotOf(page: Page, label: 'Main photo' | 'Back view' | 'Fabric detail'): Locator {
  return page.getByRole('group', { name: label });
}

/** Picks a file in a slot (the hidden input of the group; a phone's camera input is the other one). */
async function pickIn(slot: Locator, file: PickedFile): Promise<void> {
  await slot.locator('input[type="file"]:not([capture])').setInputFiles(file);
}

/** The position and size of a slot on the page. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The box of a slot; the slot must be on the page. */
async function boxOf(page: Page, label: 'Main photo' | 'Back view' | 'Fabric detail'): Promise<Box> {
  const box = await slotOf(page, label).boundingBox();
  if (box === null) {
    throw new Error(` is not on the page`);
  }
  return box;
}

/** The natural width of an image once the browser has decoded it; 0 while it has not (a broken image stays 0). */
const decodedWidth = (image: { complete: boolean; naturalWidth: number }): number =>
  image.complete ? image.naturalWidth : 0;

test('@site-content-photos a Manager picks a main photo for Polo, it uploads, and /products shows it', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const front = await drawJpeg(page, 'polo-front.jpg', 30);
  await withSiteContentLock(async () => {
    let lineId: string | null = null;
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);
      await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();
      lineId = lineIdOf(page.url());

      const main = slotOf(page, 'Main photo');
      await expect(main.getByRole('img', { name: 'Drawn jersey (no photo yet)' })).toBeVisible();
      await withPhotoHost(async () => {
        await pickIn(main, front);
        await expect(page.getByText('Photo saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
        await expect(page.getByText('It shows on the website now.')).toBeVisible();
      });
      await expect(main.getByRole('status')).toContainText('Saved');
      await expect(main.getByRole('button', { name: 'Replace Photo' })).toBeVisible();
      await expect(main.getByRole('img', { name: 'Main photo of Polo Shirts' })).toBeVisible();

      await page.goto('/products');
      const polo = page.getByRole('article', { name: 'Polo Shirts' });
      const image = polo.getByRole('img', { name: 'Polo Shirts, front' });
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(decodedWidth)).toBeGreaterThan(0);
    } finally {
      if (lineId !== null) {
        await page.goto('/admin');
        await clearLinePhotos(page, lineId);
      }
      await seedDemoSiteContent(request);
    }
  });
});

test('@site-content-photos a Manager replaces then removes Polo main photo, and /products shows the drawn jersey again', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const first = await drawJpeg(page, 'polo-one.jpg', 60);
  const second = await drawJpeg(page, 'polo-two.jpg', 200);
  await withSiteContentLock(async () => {
    let lineId: string | null = null;
    try {
      await seedDemoSiteContent(request);
      await openProductsTab(page);
      await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();
      lineId = lineIdOf(page.url());

      const main = slotOf(page, 'Main photo');
      const preview = main.getByRole('img', { name: 'Main photo of Polo Shirts' });
      await withPhotoHost(async () => {
        await pickIn(main, first);
        await expect(preview).toBeVisible({ timeout: SAVE_WAIT_MS });
        const before = await preview.getAttribute('src');

        // Replace: the same slot takes the second file and the preview moves to the new photo.
        await pickIn(main, second);
        await expect.poll(() => preview.getAttribute('src'), { timeout: SAVE_WAIT_MS }).not.toBe(before);
        await expect(main.getByRole('status')).toContainText('Saved');
      });

      // Remove asks first, with Cancel focused, and the drawing comes back.
      await press(page, main.getByRole('button', { name: 'Remove Photo' }));
      const question = page.getByRole('dialog', { name: 'Remove the main photo?' });
      await expect(question.getByText('The drawn jersey shows instead.')).toBeVisible();
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await press(page, question.getByRole('button', { name: 'Remove Photo' }));
      await expect(page.getByText('Photo removed')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByText('The drawing shows instead.')).toBeVisible();
      await expect(main.getByRole('img', { name: 'Drawn jersey (no photo yet)' })).toBeVisible();
      await expect(main.getByRole('button', { name: 'Choose Photo' })).toBeFocused();

      await page.goto('/products');
      const polo = page.getByRole('article', { name: 'Polo Shirts' });
      await expect(polo).toBeVisible();
      await expect(polo.getByRole('img', { name: 'Polo Shirts, front' })).toHaveCount(0);
    } finally {
      if (lineId !== null) {
        await page.goto('/admin');
        await clearLinePhotos(page, lineId);
      }
      await seedDemoSiteContent(request);
    }
  });
});

// This one only looks at the layout, which any line gives, so it takes no lock and uploads nothing.
test('@site-content-photos the three photo slots sit in a row on a tablet and stack at 390px, with no sideways scroll and no axe finding', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 1024, height: 900 });
  await openProductsTab(page);
  await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible();

  /** The boxes of the three slots, in order. */
  const boxes = async (): Promise<[Box, Box, Box]> => [
    await boxOf(page, 'Main photo'),
    await boxOf(page, 'Back view'),
    await boxOf(page, 'Fabric detail'),
  ];

  const [mainRow, backRow, fabricRow] = await boxes();
  expect(Math.abs(backRow.y - mainRow.y)).toBeLessThan(2);
  expect(Math.abs(fabricRow.y - mainRow.y)).toBeLessThan(2);
  expect(backRow.x).toBeGreaterThan(mainRow.x);
  expect(fabricRow.x).toBeGreaterThan(backRow.x);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(slotOf(page, 'Fabric detail')).toBeVisible();
  const [mainColumn, backColumn, fabricColumn] = await boxes();
  expect(Math.abs(backColumn.x - mainColumn.x)).toBeLessThan(2);
  expect(Math.abs(fabricColumn.x - mainColumn.x)).toBeLessThan(2);
  expect(backColumn.y).toBeGreaterThan(mainColumn.y + mainColumn.height - 2);
  expect(fabricColumn.y).toBeGreaterThan(backColumn.y + backColumn.height - 2);
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(slotOf(page, 'Main photo')).toBeVisible();
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
