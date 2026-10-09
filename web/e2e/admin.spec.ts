// Admin shell E2E (WEB-05, A11Y-01, A11Y-02, D-20): the e2e bundle has the dev-only admin routes, and each admin path
// renders the shell on the real host in all five projects: its preview page h1, the matching current sidebar item, the
// document title, the skip link first in the document, and no console, page, CSP, response (the guard) or axe findings.
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

interface AdminPath {
  readonly path: string;
  /** The nav label: the h1, the current item and the first half of the document title. */
  readonly label: string;
}

const PATHS: readonly AdminPath[] = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/orders', label: 'Orders' },
  { path: '/admin/expenses', label: 'Company Expenses' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/profile', label: 'My Profile' },
];

/** The text of the first element in document order that Tab can reach (a page script: the node program has no DOM). */
const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

for (const { path, label } of PATHS) {
  test(`@admin ${path} renders the admin shell with ${label} current`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(label);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page).toHaveTitle(`${label} · CSPS Admin`);
    await expect(page.getByText('Development only. This screen is built in a later phase.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Component Showcase' })).toHaveAttribute(
      'href',
      '/dev/components',
    );

    // The current item: the sidebar's where the sidebar shows (768px and up), and in the DOM at every width.
    const current = page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(label);

    // A11Y-02: nothing focusable comes before the skip link (WebKit's Tab skips links, so the order is read here).
    expect(await page.evaluate(FIRST_FOCUSABLE_TEXT)).toBe('Skip to main content');

    await expectNoAxeViolations(page);
  });
}

// D-13: the theme choice survives a reload; the admin always starts in Blush with nothing saved.
test('@admin the theme toggle switches to Espresso, and the choice survives a reload', async ({ page }) => {
  await page.goto('/admin');
  const root = page.locator('[data-theme]').first();
  await expect(root).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(`localStorage.getItem('csps-theme')`)).toBe('dark');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await expectNoAxeViolations(page);
});

/** What the shell shows at one page width (read in the page). */
interface ShellAtWidth {
  readonly frame: number;
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly side: number;
  readonly tabBar: boolean;
  readonly navItem: number;
  readonly managerTags: number;
  readonly currentTabWeight: string | null;
}

const READ_SHELL = `(() => {
  const root = document.querySelector('[data-theme]');
  const side = document.querySelector('[data-ui="s-admin-side"]');
  const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
  const navItem = document.querySelector('aside nav a');
  const visible = (element) => element.getClientRects().length > 0;
  const currentTab = tabBar.querySelector('[aria-current="page"]');
  return {
    frame: root.getBoundingClientRect().width,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    side: visible(side) ? side.getBoundingClientRect().width : 0,
    tabBar: visible(tabBar),
    navItem: visible(navItem) ? navItem.getBoundingClientRect().width : 0,
    managerTags: [...document.querySelectorAll('aside *')].filter(
      (element) => element.childElementCount === 0 && element.textContent === 'Manager' && visible(element),
    ).length,
    currentTabWeight: currentTab && visible(currentTab) ? getComputedStyle(currentTab).fontWeight : null,
  };
})()`;

/**
 * Sets the viewport so the page root (the `pg` container) is exactly `width` wide: a classic scrollbar takes its width
 * from the viewport in some engines, so the viewport grows by whatever the root is short of.
 */
async function setFrameWidth(page: Page, width: number): Promise<ShellAtWidth> {
  await page.setViewportSize({ width, height: 800 });
  let shell = await page.evaluate<ShellAtWidth>(READ_SHELL);
  if (shell.frame !== width) {
    await page.setViewportSize({ width: width + (width - shell.frame), height: 800 });
    shell = await page.evaluate<ShellAtWidth>(READ_SHELL);
  }
  expect(shell.frame).toBe(width);
  return shell;
}

// WEB-05 boundary edge: the shell switches layout at exactly the approved page widths (App. C container rules).
test('@admin switches from the phone tab bar to the tablet rail at 768px and to the full sidebar at 1024px', async ({
  page,
}) => {
  await page.goto('/admin');
  await expect(page.locator('h1')).toHaveText('Dashboard');

  const phone = await setFrameWidth(page, 767);
  expect(phone.side).toBe(0);
  expect(phone.tabBar).toBe(true);
  expect(phone.currentTabWeight).toBe('700');

  for (const width of [768, 1023]) {
    const tablet = await setFrameWidth(page, width);
    expect(tablet.side, `${String(width)}px rail`).toBe(72);
    expect(tablet.navItem, `${String(width)}px rail item`).toBe(52);
    expect(tablet.managerTags, `${String(width)}px Manager tags`).toBe(0);
    expect(tablet.tabBar).toBe(false);
  }

  const desktop = await setFrameWidth(page, 1024);
  expect(desktop.side).toBe(248);
  expect(desktop.tabBar).toBe(false);
  expect(desktop.managerTags).toBeGreaterThan(0);

  for (const width of [320, 767, 768, 1023, 1024]) {
    const shell = await setFrameWidth(page, width);
    expect(shell.scrollWidth, `${String(width)}px horizontal scroll`).toBeLessThanOrEqual(shell.innerWidth);
  }
  await expectNoAxeViolations(page);
});
