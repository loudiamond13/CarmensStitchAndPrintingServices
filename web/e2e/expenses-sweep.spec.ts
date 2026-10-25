// Phase 6 responsive sweep (UI-SPEC UI Considerations backstops; plan 06-18), in all five projects. A signed-in Manager opens the
// three Phase 6 pages with the longest and largest values the rules allow (a 200-character description, a 1,000,000.00 amount, a
// 1,000-character note, a 100-character staff name) and checks that none scrolls sideways at the eight widths in Blush and Espresso,
// that axe finds nothing at each width, and that the Add Expense, Edit Expense and Add Category dialogs scroll inside their own
// sheet at 320 x 568 and at 200% zoom with the footer buttons reachable. The shared CSPS_E2E database keeps the rows earlier
// runs made, so each check finds its own rows by a unique word. Every test runs under the shared guard (console, page errors,
// CSP, failed responses). Cases the sweep cannot confirm are left for the owner's screenshot review (plan 06-19).
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { axeFindings, settle } from './sweep.ts';
import { createExpense, createStaff, type TestStaff } from './testing-api.ts';

/** The seeded Rent category (the id is the fixed migration seed literal). */
const RENT = '6869715c-a01f-4053-87d8-8fd39feebebc';

/** The business date (Asia/Manila) `offsetDays` from today, as yyyy-MM-dd. */
function manilaDate(offsetDays: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

/** A word no other run has used, letters only: it starts the payer's first name and the descriptions, so a search finds only this run's rows. */
function uniqueWord(): string {
  const letters = Array.from(randomUUID().replaceAll('-', '').slice(0, 8), (digit) =>
    String.fromCharCode(97 + Number.parseInt(digit, 16)),
  );
  return `Zq${letters.join('')}`;
}

/** Presses a button from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved. */
async function press(page: Page, button: Locator) {
  await button.focus();
  await page.keyboard.press('Enter');
}

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;
const PORTRAIT_HEIGHTS = new Map<number, number>([
  [320, 568],
  [375, 667],
  [414, 896],
  [768, 1024],
  [1024, 1366],
  [1280, 800],
  [1536, 864],
  [1920, 1080],
]);

/** What a page script reads about sideways scroll. */
interface Sideways {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly htmlOverflowX: string;
  readonly bodyOverflowX: string;
}

const READ_SIDEWAYS = `(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
  bodyOverflowX: getComputedStyle(document.body).overflowX,
}))()`;

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

/** True when the open dialog's panel holds its content without scrolling sideways. */
const PANEL_FITS = `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`;

/** True when the open dialog's Notes box holds more than it shows, so it scrolls inside itself. */
const NOTES_SCROLL = `(() => { const box = document.querySelector('[role="dialog"] textarea'); return box !== null && box.scrollHeight > box.clientHeight; })()`;

/** The long values the sweep seeds. */
interface Seeded {
  readonly manager: TestStaff;
  /** The unique word in the descriptions and in the payer's name. */
  readonly word: string;
  /** The Company Expenses address with a search, a category and a date range set: three chips. */
  readonly chipsPath: string;
}

/** A 200-character description that starts with the word, wraps at spaces and has one long run with no break. */
function longDescription(word: string): string {
  return `${word} ${'description '.repeat(8)}${'W'.repeat(120)}`.slice(0, 200);
}

/**
 * A Manager, a payer with a 100-character name, and two expenses by that payer: a live one (200-character description,
 * 1,000,000.00, a 1,000-character note without a break) and a deleted one.
 */
async function seed(request: Parameters<typeof createStaff>[0]): Promise<Seeded> {
  const word = uniqueWord();
  const manager = await createStaff(request, 'Manager');
  const first = `${word}${'Mariacon'.repeat(8)}`.slice(0, 50);
  const last = 'Villanueva'.repeat(5).slice(0, 49);
  const payer = await createStaff(request, 'Admin', undefined, { firstName: first, lastName: last });
  const description = longDescription(word);
  await createExpense(request, {
    paidByUserId: payer.userId,
    recordedByUserId: payer.userId,
    date: manilaDate(-1),
    categoryId: RENT,
    description,
    amount: 1000000,
    notes: 'N'.repeat(1000),
  });
  await createExpense(request, {
    paidByUserId: payer.userId,
    recordedByUserId: payer.userId,
    date: manilaDate(-2),
    categoryId: RENT,
    description,
    amount: 1000000,
    deleted: true,
  });
  const search = new URLSearchParams({ q: word, category: RENT, from: manilaDate(-10), to: manilaDate(0) });
  return { manager, word, chipsPath: `/admin/expenses?${search.toString()}` };
}

/** Opens a Phase 6 page and waits until its rows and (for the list) its month cards have arrived. */
async function openPage(page: Page, path: string, h1: string): Promise<void> {
  const isList = new URL(path, 'https://localhost').pathname === '/admin/expenses';
  const kpis = isList
    ? page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/company-expenses/kpis')
    : null;
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await kpis;
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
}

interface PageCase {
  readonly name: string;
  /** The address, given the seeded values. */
  readonly path: (seeded: Seeded) => string;
  readonly h1: string;
}

const PAGES: readonly PageCase[] = [
  { name: '/admin/expenses with three chips', path: (seeded) => seeded.chipsPath, h1: 'Company Expenses' },
  { name: '/admin/expenses/deleted', path: () => '/admin/expenses/deleted', h1: 'Deleted Expenses' },
  { name: '/admin/settings', path: () => '/admin/settings', h1: 'Settings' },
];

for (const { name, path, h1 } of PAGES) {
  test(`@expenses-sweep ${name} does not scroll sideways at 8 widths in Blush and Espresso, and axe finds nothing`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(300_000);
    // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const seeded = await seed(request);
    await signInAs(page, request, seeded.manager);
    const failures: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await openPage(page, path(seeded), h1);
      await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
      for (const width of WIDTHS) {
        const height = PORTRAIT_HEIGHTS.get(width) ?? 900;
        await page.setViewportSize({ width, height });
        // The tables switch between table and cards by container query: read after the layout has settled.
        await settle(page);
        const reading = await page.evaluate<Sideways>(READ_SIDEWAYS);
        const label = `${theme} ${String(width)}x${String(height)}`;
        if (reading.scrollWidth > reading.clientWidth) {
          failures.push(`${label}: scrollWidth ${String(reading.scrollWidth)} > ${String(reading.clientWidth)}`);
        }
        if (reading.htmlOverflowX !== 'visible' || reading.bodyOverflowX !== 'visible') {
          failures.push(`${label}: html ${reading.htmlOverflowX}, body ${reading.bodyOverflowX} hide overflow`);
        }
        for (const finding of await axeFindings(page)) {
          failures.push(`${label}: axe ${finding}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
}

/** Scrolls each footer button into view inside the sheet and checks it is in the window. */
async function expectFooterReachable(dialog: Locator, names: readonly string[]): Promise<void> {
  for (const name of names) {
    const button = dialog.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
}

/** The two windows the dialogs are proved in: a small phone, and a 1280 x 720 desktop at 200% zoom (640 x 360 CSS pixels). */
const DIALOG_WINDOWS = [
  { label: '320 x 568', width: 320, height: 568 },
  { label: '200% zoom', width: 640, height: 360 },
] as const;

test('@expenses-sweep the Add Expense, Edit Expense and Add Category dialogs scroll inside their sheet at 320 x 568 and at 200% zoom, with the footer buttons reachable', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const seeded = await seed(request);
  await signInAs(page, request, seeded.manager);

  for (const { label, width, height } of DIALOG_WINDOWS) {
    await page.setViewportSize({ width, height });
    await openPage(page, `/admin/expenses?q=${seeded.word}`, 'Company Expenses');

    // Add Expense.
    await press(page, page.getByRole('button', { name: 'Add Expense' }).first());
    const add = page.getByRole('dialog', { name: 'Add Expense' });
    await expect(add).toBeVisible();
    await settle(page);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${label}: Add Expense, page scroll`).toBe(true);
    expect(await page.evaluate(PANEL_FITS), `${label}: Add Expense, sheet`).toBe(true);
    await expectFooterReachable(add, ['Save Expense', 'Cancel']);
    await expectNoAxeViolations(page);
    await add.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(add).toBeHidden();

    // Edit Expense, with a 1,000-character note and Recorded by under it.
    const row = page.locator('tbody tr').first();
    await press(page, row.getByRole('button', { name: /^Edit / }));
    const edit = page.getByRole('dialog', { name: 'Edit Expense' });
    await expect(edit).toBeVisible();
    await expect(edit.getByRole('textbox', { name: /^Notes/ })).toHaveValue('N'.repeat(1000));
    await settle(page);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${label}: Edit Expense, page scroll`).toBe(true);
    expect(await page.evaluate(PANEL_FITS), `${label}: Edit Expense, sheet`).toBe(true);
    // The note scrolls inside its own box instead of growing the sheet.
    expect(await page.evaluate(NOTES_SCROLL), `${label}: the 1,000-character note scrolls in its box`).toBe(true);
    const recordedBy = edit.getByText('Recorded by', { exact: true });
    await recordedBy.scrollIntoViewIfNeeded();
    await expect(recordedBy).toBeVisible();
    await expectFooterReachable(edit, ['Save Changes', 'Cancel']);
    await expectNoAxeViolations(page);
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(edit).toBeHidden();

    // Add Category, with its six colour rows.
    await openPage(page, '/admin/settings', 'Settings');
    await press(page, page.getByRole('button', { name: 'Add Category' }));
    const category = page.getByRole('dialog', { name: 'Add Category' });
    await expect(category).toBeVisible();
    await category.getByRole('textbox', { name: /^Name/ }).fill('Long category name for the sweep run 40'.slice(0, 40));
    await settle(page);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${label}: Add Category, page scroll`).toBe(true);
    expect(await page.evaluate(PANEL_FITS), `${label}: Add Category, sheet`).toBe(true);
    await expect(category.getByRole('radio')).toHaveCount(6);
    await expectFooterReachable(category, ['Save Category', 'Cancel']);
    await expectNoAxeViolations(page);
    await category.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(category).toBeHidden();
  }
});
