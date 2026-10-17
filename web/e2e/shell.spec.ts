// Shell geometry E2E (Phase 5 plan 01; D-01, D-02, D-03, D-04, D-05, D-36): the admin and public layouts fill the dynamic
// viewport, the phone tab bar sits at the viewport bottom, the sidebar and top bar stay pinned, and no shell page
// scrolls sideways. The short admin page is the dev preview /admin/orders and the long one is /dev/components: both
// render the real AdminLayout (the e2e bundle's dev routes use a placeholder user, so no sign-in is needed).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

/** The geometry the tests read in the page (a page script: the node program has no DOM). */
interface Geometry {
  readonly innerHeight: number;
  readonly scrollY: number;
  readonly documentHeight: number;
  /** The page root's bottom edge in page coordinates, or null when the page has none. */
  readonly rootBottom: number | null;
  readonly sideHeight: number | null;
  readonly tabBarTop: number | null;
  readonly tabBarBottom: number | null;
  readonly mainLastBottom: number | null;
}

const READ_GEOMETRY = `(() => {
  const root = document.querySelector('[data-theme]');
  const side = document.querySelector('[data-ui="s-admin-side"]');
  const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
  const visible = (element) => element !== null && element !== undefined && element.getClientRects().length > 0;
  const mainLast = document.querySelector('main#main')?.lastElementChild;
  return {
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    documentHeight: document.documentElement.scrollHeight,
    rootBottom: root ? root.getBoundingClientRect().bottom + window.scrollY : null,
    sideHeight: visible(side) ? side.getBoundingClientRect().height : null,
    tabBarTop: visible(tabBar) ? tabBar.getBoundingClientRect().top : null,
    tabBarBottom: visible(tabBar) ? tabBar.getBoundingClientRect().bottom : null,
    mainLastBottom: mainLast ? mainLast.getBoundingClientRect().bottom : null,
  };
})()`;

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate<Geometry>(READ_GEOMETRY);
}

/** Scrolls the page to `fraction` of its scrollable height and waits one frame so sticky layers settle. */
async function scrollToFraction(page: Page, fraction: number): Promise<void> {
  await page.evaluate(
    `new Promise((resolve) => {
      window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * ${String(fraction)});
      requestAnimationFrame(() => resolve(true));
    })`,
  );
}

async function openAt(page: Page, path: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate('document.fonts.ready.then(() => true)');
}

const SHORT_ADMIN_PAGE = '/admin/orders';
const LONG_ADMIN_PAGE = '/dev/components';

const PHONES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
  { width: 767, height: 900 },
] as const;

// D-36: the phone tab bar's bottom edge is the viewport bottom on a short page and on a long page, and the end of main
// is never hidden behind it.
for (const { width, height } of PHONES) {
  test(`@shell tab bar sits at the viewport bottom at ${String(width)}x${String(height)}`, async ({ page }) => {
    await openAt(page, SHORT_ADMIN_PAGE, width, height);
    const short = await geometry(page);
    expect(short.tabBarBottom, 'short page: tab bar shows').not.toBeNull();
    expect(
      Math.abs((short.tabBarBottom ?? 0) - short.innerHeight),
      'short page: bar bottom to viewport bottom',
    ).toBeLessThanOrEqual(1);

    await openAt(page, LONG_ADMIN_PAGE, width, height);
    await scrollToFraction(page, 0.5);
    const middle = await geometry(page);
    expect(middle.documentHeight, 'long page really scrolls').toBeGreaterThan(middle.innerHeight * 2);
    expect(
      Math.abs((middle.tabBarBottom ?? 0) - middle.innerHeight),
      'long page, middle: bar bottom',
    ).toBeLessThanOrEqual(1);

    await scrollToFraction(page, 1);
    const end = await geometry(page);
    expect(Math.abs((end.tabBarBottom ?? 0) - end.innerHeight), 'long page, end: bar bottom').toBeLessThanOrEqual(1);
    expect(end.mainLastBottom ?? Infinity, 'last content clears the bar').toBeLessThanOrEqual((end.tabBarTop ?? 0) + 1);
  });
}

// D-01: the admin page root is at least the dynamic viewport tall on a short page, and on tablet and desktop the side
// column is as tall as the viewport, so no band of another colour shows under the shell.
for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`@shell full bleed admin at ${String(width)}x${String(height)}`, async ({ page }) => {
    await openAt(page, SHORT_ADMIN_PAGE, width, height);
    const reading = await geometry(page);
    expect(reading.documentHeight, 'a short page needs no scroll').toBeLessThanOrEqual(reading.innerHeight + 1);
    expect(reading.rootBottom ?? 0, 'page root reaches the viewport bottom').toBeGreaterThanOrEqual(
      reading.innerHeight - 1,
    );
    if (reading.sideHeight !== null) {
      expect(reading.sideHeight, 'side column spans the viewport').toBeGreaterThanOrEqual(reading.innerHeight - 1);
    }
  });
}
