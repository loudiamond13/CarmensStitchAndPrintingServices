// Gallery page E2E (GAL-01, D-03, D-30 to D-32, WEB-10): the filter bar, the masonry, Show More and the keyboard, against the
// four demo shown orders the Testing seeder puts in the E2E database (two basketball, one volleyball, one moto; the first has four
// photos). Every test resets the demo content and runs under the site content lock, because the gallery is one set shared by
// all five projects. The demo photo ids have no stored file, so each photo address answers 404 and the tile shows its placeholder.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

// Each test waits its turn for the site content lock, so the 30 second default is not enough (see the site content specs).
test.describe.configure({ timeout: 480_000 });

const TEST_IMAGES = '/api/testing/images/';

test('@gallery /gallery?category=basketball shows only basketball tiles, the pill count matches them and a reload keeps the filter', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus(TEST_IMAGES, 404);
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery?category=basketball');

    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const names: string[] = [];
    for (let index = 0; index < (await tiles.count()); index += 1) {
      names.push((await tiles.nth(index).getAttribute('aria-label')) ?? '');
    }
    expect(names).toContain('Open Brgy. Sample Ballers, Basketball');
    expect(names).toContain('Open Tondo Sample Hoopers, Basketball');
    for (const name of names) {
      expect(name).toMatch(/, Basketball$/);
    }

    const toolbar = page.getByRole('toolbar', { name: 'Filter by category' });
    const pill = toolbar.getByRole('button', { name: /^Basketball \d+ items$/ });
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    const count = Number(/\d+/.exec((await pill.textContent()) ?? '')?.[0]);
    expect(count).toBe(names.length);

    await page.reload();

    await expect(page).toHaveURL(/\?category=basketball$/);
    await expect(toolbar.getByRole('button', { name: /^Basketball \d+ items$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(tiles).toHaveCount(names.length);
  });
});

const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';
const BAR_OVERFLOW =
  '(() => { const bar = document.querySelector(\'[role="toolbar"]\'); return bar === null ? -1 : bar.scrollWidth - bar.clientWidth; })()';
// Where the focused element sits against the sticky header and the sticky filter bar, in viewport pixels.
const FOCUS_AGAINST_BARS =
  "(() => { const active = document.activeElement; const box = active.getBoundingClientRect(); const header = document.querySelector('header'); const bar = document.querySelector('[data-gallery-bar]'); return { label: active.getAttribute('aria-label'), top: box.top, header: header === null ? 0 : header.getBoundingClientRect().bottom, bar: bar === null ? 0 : bar.getBoundingClientRect().bottom }; })()";

interface FocusAgainstBars {
  readonly label: string | null;
  readonly top: number;
  readonly header: number;
  readonly bar: number;
}

test('@gallery at 320px the pill bar scrolls inside itself and the page has no sideways scroll', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus(TEST_IMAGES, 404);
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/gallery');
    await expect(page.getByRole('toolbar', { name: 'Filter by category' })).toBeVisible();
    await expect(
      page
        .getByRole('main')
        .getByRole('button', { name: /^Open / })
        .first(),
    ).toBeVisible();

    expect(await page.evaluate<number>(BAR_OVERFLOW), 'the pills are wider than the bar').toBeGreaterThan(0);
    expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  });
});

for (const width of [390, 1440]) {
  test(`@gallery at ${String(width)}px a focused tile is never under the header or the filter bar`, async ({
    page,
    request,
    guard,
  }) => {
    guard.expectStatus(TEST_IMAGES, 404);
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/gallery');
      const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
      await expect(tiles.first()).toBeVisible();
      const count = await tiles.count();

      await tiles.first().focus();
      for (let seen = 0; seen < count; seen += 1) {
        const at = await page.evaluate<FocusAgainstBars>(FOCUS_AGAINST_BARS);
        expect(at.label, 'a tile is focused').toMatch(/^Open /);
        expect(at.top, `${at.label ?? ''} starts below the header and the bar`).toBeGreaterThanOrEqual(
          Math.max(at.header, at.bar) - 1,
        );
        await page.keyboard.press('Tab');
      }
    });
  });
}

// The guard fixture fails each test on any console, page, CSP or response finding, so these also prove a clean console.
for (const width of [390, 1440]) {
  test(`@gallery at ${String(width)}px there are no axe, console or CSP findings and no sideways scroll`, async ({
    page,
    request,
    guard,
  }) => {
    guard.expectStatus(TEST_IMAGES, 404);
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/gallery');
      await expect(
        page
          .getByRole('main')
          .getByRole('button', { name: /^Open / })
          .first(),
      ).toBeVisible();

      expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    });
  });
}
