// Shared page list and helpers for the end-of-phase browser gates (plan 02-35): the responsive sweep (@responsive), the
// owner's WCAG rulings (@a11y-rulings), the font proof (@fonts) and the keyboard journeys (@keyboard). Every page the
// e2e bundle serves in Phase 2 is here: the public shell (Blush only, D-14), the dev-only admin preview pages (each
// an empty state, D-20) and the Component Showcase, the admin ones in both themes (D-13).
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { AXE_TAGS } from '../src/test/axeTags.ts';
import { expect } from './fixtures.ts';

export type Theme = 'light' | 'dark';

export interface PageCase {
  /** The name in test titles and failure lines, e.g. "/admin/orders (dark)". */
  readonly name: string;
  readonly path: string;
  readonly theme: Theme;
  /** The page's one h1. */
  readonly h1: string;
  /** True for pages inside the admin shell (Topbar, Sidebar, tab bar). */
  readonly admin: boolean;
}

// /admin/expenses is a signed-in page since plan 06-04 (no dev preview); its sweep joins the signed-in sweep in plan 06-18.
const ADMIN_PAGES = [
  { path: '/admin', h1: 'Dashboard' },
  { path: '/admin/orders', h1: 'Orders' },
  { path: '/dev/components', h1: 'Component Showcase' },
] as const;

const THEMES: readonly Theme[] = ['light', 'dark'];

/** `/` in Blush, then every admin page in Blush and in Espresso. */
export const PAGES: readonly PageCase[] = [
  { name: '/ (light)', path: '/', theme: 'light', h1: 'New website on the way.', admin: false },
  ...ADMIN_PAGES.flatMap(({ path, h1 }) =>
    THEMES.map((theme) => ({ name: `${path} (${theme})`, path, theme, h1, admin: true })),
  ),
];

/** The showcase renders about 190 cases, so whole-page checks there need more time than a plain page. */
export function isShowcase(pageCase: PageCase): boolean {
  return pageCase.path === '/dev/components';
}

/**
 * Opens a page in its theme and waits for its h1 and its fonts. The admin theme comes from `localStorage['csps-theme']`
 * (D-13), so a dark case stores it before the first script runs; a fresh context starts with nothing stored (Blush).
 */
export async function openPage(page: Page, pageCase: PageCase): Promise<void> {
  if (pageCase.theme === 'dark') {
    await page.addInitScript({ content: `try { localStorage.setItem('csps-theme', 'dark'); } catch {}` });
  }
  const response = await page.goto(pageCase.path);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText(pageCase.h1);
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', pageCase.theme);
  await page.evaluate('document.fonts.ready.then(() => true)');
  await settle(page);
}

/**
 * Waits for two frames and for every finite animation and transition to end (the sidebar animates its width when the
 * rail turns on or off). Infinite ones (the spinner, the skeleton shimmer) never end, so they are left running. A page
 * script string, as everywhere in these specs: the node TS program has no DOM types, and waitForFunction would need
 * eval, which the strict CSP blocks.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect ? animation.effect.getComputedTiming() : null;
      return timing !== null && Number.isFinite(timing.endTime);
    });
    Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))).then(() => resolve(true));
    // Never wait more than two seconds: WebKit can leave a finished-looking transition pending on a hidden element.
    setTimeout(() => resolve(true), 2000);
  })))`);
}

/**
 * Runs axe over the whole page with the A11Y-01 tags and returns one `<rule id>: <targets>` line per violation, sorted,
 * so a sweep can collect every finding instead of stopping at the first page that has one.
 */
export async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
  return results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).sort((a, b) => a.localeCompare(b));
      return `${violation.id}: ${targets.join(', ')}`;
    })
    .sort((a, b) => a.localeCompare(b));
}
