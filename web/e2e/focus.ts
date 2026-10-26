// Shared helpers for the focus-not-obscured specs (WCAG 2.2 AA 2.4.11; quick 261026-ooe, D-70 to D-72).
// Page scripts are strings: the e2e TypeScript program has no DOM types.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, type Guard } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

/** The box of an element in viewport coordinates. */
export interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly height: number;
}

/** Where focus is and where the bars are, read once scrolling has settled. */
export interface Measure {
  readonly inMain: boolean;
  readonly id: string;
  readonly label: string;
  readonly box: Box;
  /** The sticky top bar (admin top bar or public header) bottom edge, or null when the page has none. */
  readonly topBarBottom: number | null;
  /** The phone tab bar's top edge and drawn height, or null when it is not drawn. */
  readonly tabBarTop: number | null;
  readonly tabBarHeight: number | null;
  readonly vvTop: number;
  readonly vvHeight: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly clientWidth: number;
  readonly scrollY: number;
}

/** Finds the bars in a page script: `bars()` gives { top, tab } as elements or null. */
const BARS = `const bars = () => {
  const main = document.querySelector('main#main');
  const shown = (element) => element !== null && element !== undefined && element.getClientRects().length > 0;
  const before = main === null ? null : main.previousElementSibling;
  const adminTop = before !== null && before.parentElement !== null && before.parentElement.getAttribute('data-ui') === 's-admin-main' ? before : null;
  const header = document.querySelector('header');
  const top = adminTop !== null ? adminTop : (shown(header) ? header : null);
  const tab = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside') && shown(nav));
  return { top: top === undefined ? null : top, tab: tab === undefined ? null : tab };
};`;

const MEASURE_BODY = `${BARS}
  const element = document.activeElement;
  const rect = element.getBoundingClientRect();
  const { top, tab } = bars();
  const main = document.querySelector('main#main');
  const name = element.labels !== undefined && element.labels !== null && element.labels.length > 0 ? element.labels[0].textContent : (element.getAttribute('aria-label') !== null ? element.getAttribute('aria-label') : element.textContent);
  const vv = window.visualViewport;
  return {
    inMain: main !== null && main.contains(element) && element !== main,
    id: element.id,
    label: String(name).trim(),
    box: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height },
    topBarBottom: top === null ? null : top.getBoundingClientRect().bottom,
    tabBarTop: tab === null ? null : tab.getBoundingClientRect().top,
    tabBarHeight: tab === null ? null : tab.getBoundingClientRect().height,
    vvTop: vv.offsetTop,
    vvHeight: vv.height,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollY: window.scrollY,
  };`;

/**
 * Waits until the page and the focused element stop moving (6 samples 50ms apart, at most 3s; WebKit scrolls a focused
 * control smoothly), then reads where focus is and where the bars are.
 */
export async function settleAndMeasure(page: Page): Promise<Measure> {
  return page.evaluate<Measure>(`(async () => {
    const read = () => { const r = document.activeElement.getBoundingClientRect(); return [window.scrollY, r.top]; };
    let last = read();
    let stable = 0;
    const start = performance.now();
    while (stable < 6 && performance.now() - start < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const now = read();
      if (now[0] === last[0] && now[1] === last[1]) {
        stable += 1;
      } else {
        stable = 0;
        last = now;
      }
    }
    ${MEASURE_BODY}
  })()`);
}

/** Reads the same measurement at once, with no wait. */
export async function measureNow(page: Page): Promise<Measure> {
  return page.evaluate<Measure>(`(() => {
    ${MEASURE_BODY}
  })()`);
}

/** What `placeUnderBar` reports: how far the control sits behind the bar after the scroll. */
export interface Placement {
  /** Pixels of the control behind the bar (the wanted gap); null when no such bar is drawn. */
  readonly behind: number | null;
  readonly scrollY: number;
}

/** Runs in the page: keeps the element so a page script can reach it (Playwright cannot pass it to a string script). */
function keepElement(element: unknown): void {
  (globalThis as unknown as { __e2eFocusTarget: unknown }).__e2eFocusTarget = element;
}

/** Focuses the control without scrolling, so a later Tab or Shift+Tab is the only thing that can scroll. */
export async function focusWithoutScroll(control: Locator): Promise<void> {
  await control.evaluate((element: { focus(options: { preventScroll: boolean }): void }) => {
    element.focus({ preventScroll: true });
  });
}

/**
 * Scrolls the page so the control sits `gap` px behind a bar: its bottom `gap` px under the tab bar's top, or its top
 * `gap` px above the top bar's bottom. Scrolling is instant.
 */
export async function placeUnderBar(control: Locator, bar: 'tab' | 'top', gap = 30): Promise<Placement> {
  await control.evaluate(keepElement);
  return control.page().evaluate<Placement>(`(() => {
    ${BARS}
    const element = window.__e2eFocusTarget;
    const { top, tab } = bars();
    const wantTab = ${JSON.stringify(bar === 'tab')};
    const gap = ${String(gap)};
    const barElement = wantTab ? tab : top;
    if (barElement === null) { return { behind: null, scrollY: window.scrollY }; }
    const rect = element.getBoundingClientRect();
    const edge = barElement.getBoundingClientRect();
    const delta = wantTab ? rect.bottom - (edge.top + gap) : rect.top - (edge.bottom - gap);
    window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
    const after = element.getBoundingClientRect();
    const now = barElement.getBoundingClientRect();
    return { behind: wantTab ? after.bottom - now.top : now.bottom - after.top, scrollY: window.scrollY };
  })()`);
}

/** Asserts the control was placed `gap` px behind the bar (within 1px), so a later scroll is the page's own doing. */
export function expectPlaced(placement: Placement, what: string, gap = 30): void {
  expect(placement.behind, `${what}: a bar is drawn and the page could scroll far enough`).not.toBeNull();
  expect(
    Math.abs((placement.behind ?? 0) - gap),
    `${what}: placed ${String(placement.behind)}px behind the bar`,
  ).toBeLessThanOrEqual(1);
}

/** The scroll spacing a page and one control carry, in px (`auto` counts as 0). */
export interface Spacing {
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly marginBottom: number;
}

/** Reads html `scroll-padding-top` and `scroll-padding-bottom`, and the control's `scroll-margin-bottom`. */
export async function readSpacing(control: Locator): Promise<Spacing> {
  await control.evaluate(keepElement);
  return control.page().evaluate<Spacing>(`(() => {
    const px = (value) => { const n = Number.parseFloat(value); return Number.isNaN(n) ? 0 : n; };
    const root = getComputedStyle(document.documentElement);
    return {
      paddingTop: px(root.scrollPaddingTop),
      paddingBottom: px(root.scrollPaddingBottom),
      marginBottom: px(getComputedStyle(window.__e2eFocusTarget).scrollMarginBottom),
    };
  })()`);
}

/**
 * Asserts the focused control's whole box lies between the bars and inside the visual viewport. The whole measurement
 * is in the message.
 */
export function expectClear(measure: Measure, what: string): void {
  const upper = Math.max(measure.topBarBottom ?? 0, measure.vvTop);
  const lower = Math.min(measure.tabBarTop ?? Number.POSITIVE_INFINITY, measure.vvTop + measure.vvHeight);
  const message = `${what}: ${JSON.stringify(measure)}`;
  expect(measure.box.top, `top of the box must be at or below ${String(upper)}; ${message}`).toBeGreaterThanOrEqual(
    upper - 0.5,
  );
  expect(measure.box.bottom, `bottom of the box must be at or above ${String(lower)}; ${message}`).toBeLessThanOrEqual(
    lower + 0.5,
  );
}

/** What the tab bar looks like at the moment: drawn height, or null when it is not drawn. */
export async function tabBarHeight(page: Page): Promise<number | null> {
  return page.evaluate<number | null>(`(() => {
    ${BARS}
    const { tab } = bars();
    return tab === null ? null : tab.getBoundingClientRect().height;
  })()`);
}

/** The top bar's drawn height, or null when the page has none. */
export async function topBarHeight(page: Page): Promise<number | null> {
  return page.evaluate<number | null>(`(() => {
    ${BARS}
    const { top } = bars();
    return top === null ? null : top.getBoundingClientRect().height;
  })()`);
}

/** Signs in a Manager and opens My Profile on the Security tab. */
export async function openSecurity(page: Page, request: APIRequestContext, guard: Guard): Promise<void> {
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.goto('/admin/profile?tab=security');
  await expect(page.getByRole('heading', { level: 2, name: 'Change Password' })).toBeVisible();
}

export const newPassword = (page: Page): Locator => page.getByLabel('New password', { exact: true });
export const confirmPassword = (page: Page): Locator => page.getByLabel('Confirm new password', { exact: true });
/** The Show password button that follows a password box. */
export const showButton = (box: Locator): Locator => box.locator('xpath=following-sibling::button');
export const updateButton = (page: Page): Locator => page.getByRole('button', { name: 'Update Password' });

/** Waits two frames so container queries and sticky layers have settled after a resize. */
export async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))',
  );
}

/** One reading of the bottom spacing rule at the current window size. */
export interface SpacingRow {
  readonly drawn: boolean;
  /** Why the rule does not hold, or null when it does. */
  readonly problem: string | null;
}

/**
 * The bottom spacing is on exactly where the tab bar is drawn: with the bar, exactly one of html scroll-padding-bottom
 * and the Confirm field's scroll-margin-bottom is set and is at least the bar's height + 18px; without it, both are 0.
 */
export async function readSpacingRow(page: Page, at: string): Promise<SpacingRow> {
  await nextFrames(page);
  const bar = await tabBarHeight(page);
  const spacing = await readSpacing(confirmPassword(page));
  if (bar === null) {
    const clean = spacing.paddingBottom === 0 && spacing.marginBottom === 0;
    return { drawn: false, problem: clean ? null : `${at}: no tab bar but ${JSON.stringify(spacing)}` };
  }
  const set = [spacing.paddingBottom, spacing.marginBottom].filter((value) => value > 0);
  const fine = set.length === 1 && (set[0] ?? 0) >= bar + 18;
  return {
    drawn: true,
    problem: fine ? null : `${at}: tab bar ${String(bar)}px drawn but ${JSON.stringify(spacing)}`,
  };
}
