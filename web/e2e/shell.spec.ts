// Shell geometry E2E (Phase 5 plan 01; D-01, D-02, D-03, D-04, D-05, D-36): the admin and public layouts fill the dynamic
// viewport, the phone tab bar sits at the viewport bottom, the sidebar and top bar stay pinned, and no shell page
// scrolls sideways. The short admin page is the dev preview /admin/orders and the long one is /dev/components: both
// render the real AdminLayout (the e2e bundle's dev routes use a placeholder user, so no sign-in is needed).
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

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

/** The pinned layers' geometry (a page script). */
interface Pinned {
  readonly innerHeight: number;
  readonly sideTop: number | null;
  readonly sideBottom: number | null;
  readonly topbarTop: number | null;
}

const READ_PINNED = `(() => {
  const visible = (element) => element !== null && element.getClientRects().length > 0;
  const side = document.querySelector('[data-ui="s-admin-side"] aside');
  const topbar = document.querySelector('[data-ui="s-admin-main"] > div');
  return {
    innerHeight: window.innerHeight,
    sideTop: visible(side) ? side.getBoundingClientRect().top : null,
    sideBottom: visible(side) ? side.getBoundingClientRect().bottom : null,
    topbarTop: visible(topbar) ? topbar.getBoundingClientRect().top : null,
  };
})()`;

// D-02, D-04: after scrolling a long page to the bottom, the sidebar column is still the full viewport tall and the top
// bar is still at the top; on phones the top bar stays pinned.
for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const) {
  test(`@shell sidebar and top bar stay pinned at ${String(width)}x${String(height)}`, async ({ page }) => {
    await openAt(page, LONG_ADMIN_PAGE, width, height);
    await scrollToFraction(page, 1);
    const pinned = await page.evaluate<Pinned>(READ_PINNED);
    expect(Math.abs(pinned.topbarTop ?? Infinity), 'top bar top').toBeLessThanOrEqual(1);
    if (pinned.sideTop !== null) {
      expect(Math.abs(pinned.sideTop), 'sidebar top').toBeLessThanOrEqual(1);
      expect(Math.abs((pinned.sideBottom ?? Infinity) - pinned.innerHeight), 'sidebar bottom').toBeLessThanOrEqual(1);
    } else {
      expect(width, 'only a phone has no side column').toBeLessThan(768);
    }
  });
}

/** What a short screen shows of the sidebar (a page script). */
interface ShortSidebar {
  readonly innerHeight: number;
  readonly navOverflowY: string;
  readonly navScrollHeight: number;
  readonly navClientHeight: number;
  readonly logoTop: number;
  readonly sideTop: number;
  readonly logoutTop: number;
  readonly logoutBottom: number;
}

const READ_SHORT_SIDEBAR = `(() => {
  const side = document.querySelector('[data-ui="s-admin-side"] aside');
  const nav = side.querySelector('nav');
  const logo = side.firstElementChild;
  const logout = [...side.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Logout');
  return {
    innerHeight: window.innerHeight,
    navOverflowY: getComputedStyle(nav).overflowY,
    navScrollHeight: nav.scrollHeight,
    navClientHeight: nav.clientHeight,
    logoTop: logo.getBoundingClientRect().top,
    sideTop: side.getBoundingClientRect().top,
    logoutTop: logout.getBoundingClientRect().top,
    logoutBottom: logout.getBoundingClientRect().bottom,
  };
})()`;

// D-03: on a short screen the nav list scrolls inside the pinned sidebar; the logo stays at the top and Logout stays in
// view and reachable by Tab. The five items need 241px, so a 450px screen just fits them and a 360px one must scroll the nav.
for (const { width, height, mustScroll } of [
  { width: 1280, height: 600, mustScroll: false },
  { width: 1024, height: 480, mustScroll: false },
  { width: 1440, height: 450, mustScroll: false },
  { width: 1280, height: 360, mustScroll: true },
] as const) {
  test(`@shell short screen ${String(width)}x${String(height)} keeps Logout in view`, async ({ page }) => {
    await openAt(page, SHORT_ADMIN_PAGE, width, height);
    const reading = await page.evaluate<ShortSidebar>(READ_SHORT_SIDEBAR);
    expect(reading.navOverflowY, 'the nav scrolls on its own').toBe('auto');
    if (mustScroll) {
      expect(reading.navScrollHeight, 'nav content is taller than its box').toBeGreaterThan(reading.navClientHeight);
    }
    expect(Math.abs(reading.logoTop - reading.sideTop), 'logo at the top of the sidebar').toBeLessThanOrEqual(1);
    expect(reading.logoutTop, 'Logout top is in the viewport').toBeGreaterThanOrEqual(0);
    expect(reading.logoutBottom, 'Logout bottom is in the viewport').toBeLessThanOrEqual(reading.innerHeight + 1);

    await page.locator('[data-ui="s-admin-side"] nav a').last().focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-ui="s-admin-side"]').getByRole('button', { name: 'Logout' })).toBeFocused();
  });
}

test('@shell the scrolling nav passes axe at 1280x600', async ({ page }) => {
  await openAt(page, SHORT_ADMIN_PAGE, 1280, 600);
  await expectNoAxeViolations(page);
});
