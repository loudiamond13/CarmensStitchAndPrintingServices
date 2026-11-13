// Phase 11 Site Content sweep (CONT-01 to CONT-05, GAL-03; WCAG 2.2 AA; plan 11-37), in all five projects. A signed-in Manager opens every Site
// Content tab with the demo data in it, every window, the product line editor new and with three photos, and the order Public website card
// and window in each state, in Blush and Espresso. Each page is checked at the eight P2 widths (320 to 1920 px) for sideways scroll, and at
// 320, 768, 1280 and 1920 px for axe (the target-size and scrollable-region-focusable rules are in the rule set). The guard fails every test on
// a console, page or CSP finding. The pages read and change the shared site content, so each test seeds the demo shop under the site content
// lock (and signs in before taking it), and puts the demo shop back at the end.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { apiToken, deleteOrderThroughApi, drawJpeg, openOrder, seedOrder } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { settle } from './sweep.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

// Each test signs in and waits its turn for the site content lock, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

test.beforeEach(({ guard }) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
});

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;
const AXE_WIDTHS: ReadonlySet<number> = new Set([320, 768, 1280, 1920]);
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const SAVE_WAIT_MS = 30_000;

async function axeProblem(page: Page): Promise<string | null> {
  try {
    await expectNoAxeViolations(page);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Checks the open page at every width and returns what is wrong, one line each. */
async function sweepOpenPage(page: Page, label: string): Promise<string[]> {
  const failures: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 800 });
    await settle(page);
    if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
      failures.push(`${label} at ${String(width)} px: the page scrolls sideways`);
    }
    if (AXE_WIDTHS.has(width)) {
      const axe = await axeProblem(page);
      if (axe !== null) {
        failures.push(`${label} at ${String(width)} px: ${axe}`);
      }
    }
  }
  return failures;
}

/** Puts the theme in storage (the admin reads it on load) and opens `path` in it. */
async function openIn(page: Page, theme: Theme, path: string): Promise<void> {
  await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(path);
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
  await page.evaluate('document.fonts.ready.then(() => true)');
}

async function signInManager(page: Page, request: APIRequestContext): Promise<void> {
  await signInAs(page, request, await createStaff(request, 'Manager'));
}

interface TabCase {
  readonly name: string;
  readonly tab: string;
  /** The part of the tab that arrives last, so the sweep sees the whole tab. */
  readonly ready: (page: Page) => Locator;
}

const TABS: readonly TabCase[] = [
  { name: 'Business Info', tab: 'business', ready: (page) => page.getByRole('button', { name: 'Save Business Info' }) },
  { name: 'Hours & Closures', tab: 'hours', ready: (page) => page.getByRole('button', { name: 'Add Closure' }) },
  { name: 'Products', tab: 'products', ready: (page) => page.getByRole('table', { name: 'Product lines' }) },
  { name: 'Testimonials', tab: 'testimonials', ready: (page) => page.getByRole('button', { name: 'Add Testimonial' }) },
  { name: 'Gallery', tab: 'gallery', ready: (page) => page.getByRole('button', { name: 'Add Photo' }) },
];

for (const theme of THEMES) {
  test(`@site-content-sweep every Site Content tab with its demo data has no axe finding and does not scroll sideways from 320 to 1920 px in ${theme === 'light' ? 'Blush' : 'Espresso'}`, async ({
    page,
    request,
  }) => {
    await signInManager(page, request);
    await withSiteContentLock(async () => {
      try {
        await seedDemoSiteContent(request);
        const failures: string[] = [];
        for (const { name, tab, ready } of TABS) {
          await openIn(page, theme, `/admin/site-content?tab=${tab}`);
          await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
          await expect(ready(page)).toBeVisible({ timeout: SAVE_WAIT_MS });
          failures.push(...(await sweepOpenPage(page, `${name} (${theme})`)));
        }
        expect(failures).toEqual([]);
      } finally {
        await seedDemoSiteContent(request);
      }
    });
  });
}

interface WindowCase {
  readonly name: string;
  readonly tab: string;
  readonly trigger: (page: Page) => Locator;
  readonly dialog: string;
}

const WINDOWS: readonly WindowCase[] = [
  { name: 'Add Closure', tab: 'hours', trigger: (page) => page.getByRole('button', { name: 'Add Closure' }), dialog: 'Add Closure' },
  {
    name: 'Add Testimonial',
    tab: 'testimonials',
    trigger: (page) => page.getByRole('button', { name: 'Add Testimonial' }),
    dialog: 'Add Testimonial',
  },
  {
    name: 'Edit Testimonial',
    tab: 'testimonials',
    trigger: (page) => page.getByRole('button', { name: 'Edit testimonial from Juan Dela Cruz' }),
    dialog: 'Edit Testimonial',
  },
  { name: 'Add Photo', tab: 'gallery', trigger: (page) => page.getByRole('button', { name: 'Add Photo' }), dialog: 'Add Photo' },
];

for (const theme of THEMES) {
  test(`@site-content-sweep every Site Content window open has no axe finding and does not scroll sideways from 320 to 1920 px in ${theme === 'light' ? 'Blush' : 'Espresso'}`, async ({
    page,
    request,
  }) => {
    await signInManager(page, request);
    await withSiteContentLock(async () => {
      try {
        await seedDemoSiteContent(request);
        const failures: string[] = [];
        for (const { name, tab, trigger, dialog } of WINDOWS) {
          await openIn(page, theme, `/admin/site-content?tab=${tab}`);
          await expect(trigger(page)).toBeVisible({ timeout: SAVE_WAIT_MS });
          await press(page, trigger(page));
          const opened = page.getByRole('dialog', { name: dialog });
          await expect(opened).toBeVisible();
          failures.push(...(await sweepOpenPage(page, `${name} window (${theme})`)));
          await page.keyboard.press('Escape');
          await expect(opened).toBeHidden();
        }
        expect(failures).toEqual([]);
      } finally {
        await seedDemoSiteContent(request);
      }
    });
  });
}

/** The three slots of the line editor, by their labels. */
const SLOT_LABELS = ['Main photo', 'Back view', 'Fabric detail'] as const;

/** The line id at the end of an editor address (/admin/site-content/products/{id}). */
function lineIdOf(url: string): string {
  const id = /\/products\/([0-9a-f-]{36})$/.exec(new URL(url).pathname)?.[1];
  if (id === undefined) {
    throw new Error(`No line id in ${url}`);
  }
  return id;
}

/** Takes every photo off a line through the API (a slot that is already empty answers 404, which is fine). */
async function clearLinePhotos(page: Page, lineId: string): Promise<void> {
  const authorization = `Bearer ${await apiToken(page)}`;
  for (const slot of ['main', 'back', 'fabric']) {
    const removed = await page.request.delete(`/api/v1/product-lines/${lineId}/photos/${slot}`, {
      headers: { 'X-CSPS-CSRF': '1', Authorization: authorization },
    });
    expect([204, 404], `DELETE photos/${slot}`).toContain(removed.status());
  }
}

for (const theme of THEMES) {
  test(`@site-content-sweep the product line editor, new and with three photos, has no axe finding and does not scroll sideways from 320 to 1920 px in ${theme === 'light' ? 'Blush' : 'Espresso'}`, async ({
    page,
    request,
  }) => {
    await signInManager(page, request);
    const photos = await Promise.all(
      SLOT_LABELS.map((_, index) => drawJpeg(page, `sweep-${String(index + 1)}.jpg`, index * 90 + 30, 1600, 1200)),
    );
    await withSiteContentLock(async () => {
      let lineId: string | null = null;
      try {
        await seedDemoSiteContent(request);
        const failures: string[] = [];

        await openIn(page, theme, '/admin/site-content?tab=products');
        await page.getByRole('link', { name: 'Add Product Line' }).click();
        await expect(page.getByRole('button', { name: 'Save Product Line' })).toBeVisible({ timeout: SAVE_WAIT_MS });
        failures.push(...(await sweepOpenPage(page, `New product line (${theme})`)));

        await openIn(page, theme, '/admin/site-content?tab=products');
        await page.getByRole('link', { name: 'Edit Polo Shirts' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Polo Shirts' })).toBeVisible({ timeout: SAVE_WAIT_MS });
        lineId = lineIdOf(page.url());
        await withPhotoHost(async () => {
          for (const [index, label] of SLOT_LABELS.entries()) {
            const slot = page.getByRole('group', { name: label });
            const file = photos[index];
            if (file === undefined) {
              throw new Error(`No drawn photo for ${label}.`);
            }
            await slot.locator('input[type="file"]:not([capture])').setInputFiles(file);
            await expect(slot.getByRole('button', { name: 'Replace Photo' })).toBeVisible({ timeout: SAVE_WAIT_MS });
          }
        });
        failures.push(...(await sweepOpenPage(page, `Polo Shirts editor with photos (${theme})`)));
        expect(failures).toEqual([]);
      } finally {
        try {
          if (lineId !== null) {
            await page.goto('/admin');
            await clearLinePhotos(page, lineId);
          }
        } finally {
          await seedDemoSiteContent(request);
        }
      }
    });
  });
}

/** The Public website card of the order page. */
function card(page: Page): Locator {
  return page.getByRole('region', { name: 'Public website' });
}

/** Opens the window from the card, checks it, and closes it with Cancel. */
async function sweepWindow(page: Page, label: string): Promise<string[]> {
  await press(page, card(page).getByRole('button', { name: 'Edit public website settings' }));
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  const failures = await sweepOpenPage(page, label);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  return failures;
}

for (const theme of THEMES) {
  test(`@site-content-sweep the order Public website card and window, not shown, shown and Cancelled, have no axe finding and do not scroll sideways from 320 to 1920 px in ${theme === 'light' ? 'Blush' : 'Espresso'}`, async ({
    page,
    request,
  }) => {
    const manager = await createStaff(request, 'Manager');
    const plain = await seedOrder(request, { prefix: 'ORD-2087', label: 'Sweep Plain', itemDescription: 'E2E sweep jersey' });
    const cancelled = await seedOrder(request, {
      prefix: 'ORD-2087',
      label: 'Sweep Cancelled',
      itemDescription: 'E2E sweep jersey',
      status: 'cancelled',
    });
    await openOrder(page, request, manager, plain.id, plain.number);
    await withSiteContentLock(async () => {
      try {
        await seedDemoSiteContent(request);
        const failures: string[] = [];

        await openIn(page, theme, `/admin/orders/${plain.id}`);
        await expect(card(page)).toContainText('Not shown', { timeout: SAVE_WAIT_MS });
        failures.push(...(await sweepOpenPage(page, `Public website card, not shown (${theme})`)));
        failures.push(...(await sweepWindow(page, `Public website window, not shown (${theme})`)));

        // Show it from the window: the OK, Show on the website and a line.
        await page.setViewportSize({ width: 1280, height: 900 });
        await press(page, card(page).getByRole('button', { name: 'Edit public website settings' }));
        const dialog = page.getByRole('dialog', { name: 'Public Website' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('checkbox', { name: 'Customer said OK to show' }).check();
        await dialog.getByRole('checkbox', { name: 'Show on the website' }).check();
        const line = dialog.getByRole('combobox', { name: /^Show under/ });
        if ((await line.inputValue()) === '') {
          await line.selectOption({ index: 1 });
        }
        await dialog.getByRole('button', { name: 'Save Changes' }).click();
        await expect(dialog).toBeHidden();
        await expect(card(page)).toContainText('Shown', { timeout: SAVE_WAIT_MS });
        failures.push(...(await sweepOpenPage(page, `Public website card, shown (${theme})`)));
        failures.push(...(await sweepWindow(page, `Public website window, shown (${theme})`)));

        await openIn(page, theme, `/admin/orders/${cancelled.id}`);
        await expect(card(page)).toContainText("Cancelled orders can't be shown on the website.", { timeout: SAVE_WAIT_MS });
        failures.push(...(await sweepOpenPage(page, `Public website card, Cancelled (${theme})`)));

        expect(failures).toEqual([]);
      } finally {
        // A deleted order leaves the public gallery whatever its flags are (11-23), so no shown demo is left behind.
        // The demo reset runs even when a delete throws.
        try {
          await deleteOrderThroughApi(page, plain.id);
          await deleteOrderThroughApi(page, cancelled.id);
        } finally {
          await seedDemoSiteContent(request);
        }
      }
    });
  });
}
