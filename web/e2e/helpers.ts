// Small helpers shared by the Phase 6 specs and the owner-review script: the seeded category ids, the business date, a unique
// word, a keyboard press and the sideways-scroll check. One copy, so a fix reaches every caller.
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';

/** The seeded Rent category (the id is the fixed migration seed literal). */
export const RENT = '6869715c-a01f-4053-87d8-8fd39feebebc';

/** The seeded Supplies category (the id is the fixed migration seed literal). */
export const SUPPLIES = '447ad32e-1433-4b70-8786-72e3dc3f9937';

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
export const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

/** The business date (Asia/Manila) `offsetDays` from today, as yyyy-MM-dd. */
export function manilaDate(offsetDays: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

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
