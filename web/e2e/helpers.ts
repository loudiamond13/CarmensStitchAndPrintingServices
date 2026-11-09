// Small helpers shared by the Phase 6 specs and the owner-review script: the seeded category ids, the business date, a unique
// word, a keyboard press and the sideways-scroll check. One copy, so a fix reaches every caller.
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';

/** The seeded Rent category (the id is the fixed migration seed literal). */
export const RENT = '6869715c-a01f-4053-87d8-8fd39feebebc';

/** The seeded Supplies category (the id is the fixed migration seed literal). */
export const SUPPLIES = '447ad32e-1433-4b70-8786-72e3dc3f9937';

/**
 * True when the page does not scroll sideways (a page script: the node program has no DOM). It measures against the width without a
 * classic vertical scrollbar (`clientWidth`), so an overflow narrower than the bar is still found.
 */
export const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= document.documentElement.clientWidth';

/** An element's box in the window, as the browser reports it. */
interface PageBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Page functions for `locator.evaluate`: each is self-contained (it is sent to the browser as source) and takes only the parts of the
 * element it reads, since the node program has no DOM types.
 */

/** True when the element holds its content without scrolling sideways. */
export const holdsItsContent = (element: { scrollWidth: number; clientWidth: number }): boolean =>
  element.scrollWidth <= element.clientWidth;

/**
 * True when a touch target is left to press: the part of the button that lies inside its dialog's box and inside the window as it
 * stands, with no scrolling, is at least 44 px wide and 44 px high (or the whole button, if it is smaller). A button below the fold or
 * outside the sheet fails; so does one cut down to a sliver.
 */
export const reachableWithoutScrolling = (button: {
  getBoundingClientRect(): PageBox;
  closest(selector: string): { getBoundingClientRect(): PageBox } | null;
  ownerDocument: { documentElement: { clientWidth: number; clientHeight: number } };
}): boolean => {
  const panel = button.closest('[role="dialog"]');
  if (panel === null) {
    return false;
  }
  const own = button.getBoundingClientRect();
  const sheet = panel.getBoundingClientRect();
  const viewport = button.ownerDocument.documentElement;
  const visibleWidth = Math.min(own.right, sheet.right, viewport.clientWidth) - Math.max(own.left, sheet.left, 0);
  const visibleHeight = Math.min(own.bottom, sheet.bottom, viewport.clientHeight) - Math.max(own.top, sheet.top, 0);
  return (
    visibleWidth >= Math.min(own.right - own.left, 44) - 1 && visibleHeight >= Math.min(own.bottom - own.top, 44) - 1
  );
};

/** True when the selected tab of a strip is inside the strip's visible box (the keep-in-view rule; the strip itself may scroll). */
export const selectedTabInView = (strip: {
  getBoundingClientRect(): PageBox;
  querySelector(selector: string): { getBoundingClientRect(): PageBox } | null;
}): boolean => {
  const tab = strip.querySelector('[role="tab"][aria-selected="true"]');
  if (tab === null) {
    return false;
  }
  const own = tab.getBoundingClientRect();
  const visible = strip.getBoundingClientRect();
  return own.left >= visible.left - 1 && own.right <= visible.right + 1;
};

/** The business date (Asia/Manila) `offsetDays` from today, as yyyy-MM-dd. */
export function manilaDate(offsetDays: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

/** Days back for money a sweep only needs on a person's hand: always before the current business month (a month is at most 31 days). */
export const PAST_MONTH_DAYS = -45;

/** What the dashboard sweep records today, in pesos: small, so this month's shop totals barely move on every run (wave 11 WR-02). */
export const DASHBOARD_SWEEP_FIGURES = { payment: 10, expense: 5 } as const;

/** A word no other run has used, letters only, so a search for it finds only this run's rows. */
export function uniqueWord(): string {
  const letters = Array.from(randomUUID().replaceAll('-', '').slice(0, 8), (digit) =>
    String.fromCharCode(97 + Number.parseInt(digit, 16)),
  );
  return `Zq${letters.join('')}`;
}

/** Presses a button from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved. */
export async function press(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}
