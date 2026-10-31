// Phase 8 responsive sweep (UI-SPEC UI Considerations backstops UIC-61 to UIC-70 and UIC-74; plan 08-24), in all five projects. A signed-in
// Manager opens every order screen with the longest text and the largest amounts the rules allow (100-character names with no
// break, 200-character descriptions and reasons, a 2,000-character note, ₱1,000,000.00 lines and a ₱99,999,999.99 total) and checks that
// none scrolls sideways at the eight widths in Blush and Espresso, that no text is cut short, and that axe finds nothing at three of
// the widths. Focused tests prove the toolbar chips, the tab strips, the payment window, the status menu, the 100-item create form,
// the Deleted Orders count words and the unknown admin address. The shared CSPS_E2E database keeps what earlier runs made, so every
// check finds its own orders by a unique word. Every test runs under the shared guard (console, page errors, CSP, failed responses).
// The sweep measures layout; the look in Blush and Espresso is for the owner's screenshot review (UIC-71).
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL, uniqueWord } from './helpers.ts';
import { ORDER_PAGES, settle, type OrderSweepIds } from './sweep.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;
const AXE_WIDTHS: ReadonlySet<number> = new Set([320, 768, 1280]);
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

/** The seeded Cash payment method and Fabric order expense category (the ids are the fixed migration seed literals). */
const CASH_ID = '01a17fce-7806-77e1-91b7-d3b852f2fd1d';
const FABRIC_ID = '01a17fce-780b-75d1-89e0-5b3b9b185a2c';

/** 100 characters with no space or hyphen to break at: the worst case for a name. */
const LONG_CUSTOMER = `${'Bartholomew'.repeat(9)}x`;
/** A 200-character text that wraps at spaces and ends in one long run with no break. */
const LONG_TEXT = `${'Sublimated jersey set with name and number '.repeat(3)}${'W'.repeat(100)}`.slice(0, 200);
/** A 2,000-character note: words, then one long run. */
const LONG_NOTES =
  `${'Pack each set in its own bag and label the bag with the player name. '.repeat(26)}${'N'.repeat(200)}`.slice(
    0,
    2000,
  );
const TOTAL_TEXT = '₱99,999,999.99';

/** What a page script reads: sideways scroll, and the elements whose text is cut short by hidden overflow. */
interface PageReading {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly htmlOverflowX: string;
  readonly bodyOverflowX: string;
  readonly clipped: readonly string[];
}

const READ_PAGE = `(() => {
  const clipped = [];
  for (const element of document.querySelectorAll('main *, [role="dialog"] *')) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) continue;
    const overflowX = getComputedStyle(element).overflowX;
    if (element.clientWidth > 1 && (overflowX === 'hidden' || overflowX === 'clip') && element.scrollWidth > element.clientWidth + 1) {
      const edge = element.getBoundingClientRect().right;
      const wide = [...element.querySelectorAll('*')].find((child) => (child.getBoundingClientRect().right > edge + 1 || child.scrollWidth > child.clientWidth + 1) && (child.textContent || '').trim() !== '');
      clipped.push(element.tagName.toLowerCase() + ' (' + element.scrollWidth + ' > ' + element.clientWidth + ') by ' + (wide ? wide.tagName.toLowerCase() + ' "' + String(wide.textContent).trim().slice(0, 40) + '" ' + String(wide.className).slice(0, 80) : 'no child'));
    }
  }
  const wide = [];
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
    for (const element of document.querySelectorAll('body *')) {
      if (element.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && element.children.length === 0) {
        wide.push(element.tagName.toLowerCase() + ' "' + String(element.textContent).trim().slice(0, 30) + '" ' + String(element.className).slice(0, 60) + ' right=' + Math.round(element.getBoundingClientRect().right));
      }
    }
  }
  clipped.push(...wide.slice(0, 4).map((line) => 'wide ' + line));
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    clipped: clipped.slice(0, 5),
  };
})()`;

/** True when the open dialog's panel holds its content without scrolling sideways. */
const PANEL_FITS = `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`;

/** The problems a reading shows, as lines for a failure message. */
function problemsOf(label: string, reading: PageReading, dialogOpen = false): string[] {
  const lines: string[] = [];
  if (reading.scrollWidth > reading.clientWidth) {
    lines.push(`${label}: scrollWidth ${String(reading.scrollWidth)} > ${String(reading.clientWidth)}`);
  }
  // An open dialog locks the page scroll on purpose.
  if (!dialogOpen && (reading.htmlOverflowX !== 'visible' || reading.bodyOverflowX !== 'visible')) {
    lines.push(`${label}: html ${reading.htmlOverflowX}, body ${reading.bodyOverflowX} hide overflow`);
  }
  for (const element of reading.clipped) {
    lines.push(`${label}: text cut short in ${element}`);
  }
  return lines;
}

/** A unique order number for one check. */
function uniqueNumber(year: number): string {
  return `ORD-${String(year)}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

/** A fresh access token from the signed-in page's refresh cookie. */
async function accessToken(page: Page): Promise<string> {
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSPS-CSRF': '1' } });
  expect(refreshed.status(), 'POST /api/v1/auth/refresh').toBe(200);
  const session = (await refreshed.json()) as { accessToken: string };
  return session.accessToken;
}

/** Soft-deletes an order through the API as the signed-in Manager of this page. */
async function deleteOrderThroughApi(page: Page, id: string): Promise<void> {
  const deleted = await page.request.delete(`/api/v1/orders/${id}`, {
    headers: { 'X-CSPS-CSRF': '1', Authorization: `Bearer ${await accessToken(page)}` },
  });
  expect(deleted.status(), `DELETE /api/v1/orders/${id}`).toBe(204);
}

/**
 * Two orders with the longest text and the largest amounts: 100-character customer and team names, a 300-character address, a
 * 2,000-character note, items of 1,000,000.00, 98,999,901.00 and 99.00 (100,000,000.00), a 0.01 discount (a total of 99,999,999.99),
 * a 1,000,000.00 payment and expense and a refund, all with 100 to 200 character text. The second is soft deleted once the page
 * is signed in. A payer with a 100-character name received, paid and refunded.
 */
async function seedOrders(request: Parameters<typeof createStaff>[0], word: string): Promise<Seeded> {
  const payer = await createStaff(request, 'Admin', undefined, {
    firstName: `${word}${'Mariacon'.repeat(8)}`.slice(0, 50),
    lastName: 'Villanueva'.repeat(5).slice(0, 49),
  });
  const team = `${word}${'Ballers'.repeat(13)}`.slice(0, 100);
  const make = (number: string): Promise<string> =>
    createOrder(request, {
      number,
      status: 'production',
      customerName: LONG_CUSTOMER,
      teamName: team,
      contactNumber: '0917 123 4567',
      email: `${'a'.repeat(60)}@${'b'.repeat(60)}.${'c'.repeat(60)}.example`,
      address: 'Purok 7 Barangay San Roque '.repeat(11).slice(0, 300),
      notes: LONG_NOTES,
      orderDate: manilaDate(-3),
      dueDate: manilaDate(5),
      items: [
        { productTypeId: BASKETBALL_JERSEY_ID, description: LONG_TEXT, quantity: 1, unitPrice: 1_000_000 },
        {
          productTypeId: BASKETBALL_JERSEY_ID,
          description: 'Bulk jersey order',
          sizeVariant: 'XXL-'.repeat(25),
          quantity: 9900,
          unitPrice: 9999.99,
        },
        { productTypeId: BASKETBALL_JERSEY_ID, description: 'Name tags', quantity: 1, unitPrice: 99 },
      ],
      discounts: [{ kind: 'fixed', value: 0.01, reason: 'D'.repeat(100) }],
      payments: [
        {
          paymentDate: manilaDate(-2),
          amount: 1_000_000,
          paymentMethodId: CASH_ID,
          receivedByUserId: payer.userId,
          reference: 'R'.repeat(100),
          notes: LONG_TEXT,
        },
      ],
      expenses: [
        {
          expenseDate: manilaDate(-2),
          amount: 1_000_000,
          orderExpenseCategoryId: FABRIC_ID,
          paidByUserId: payer.userId,
          description: LONG_TEXT,
        },
      ],
      refunds: [{ refundDate: manilaDate(-1), amount: 1000, reason: LONG_TEXT, refundedByUserId: payer.userId }],
    });
  const richNumber = uniqueNumber(2082);
  const deletedNumber = uniqueNumber(2081);
  const [rich, deleted] = await Promise.all([make(richNumber), make(deletedNumber)]);
  return { rich, richNumber, deleted, deletedNumber, word, team };
}

/** The seeded orders and the team name both share. */
interface Seeded extends OrderSweepIds {
  readonly team: string;
}

/** Seeds, signs in and soft deletes the second order. */
async function start(page: Page, request: Parameters<typeof createStaff>[0]): Promise<Seeded> {
  const manager = await createStaff(request, 'Manager');
  const seeded = await seedOrders(request, uniqueWord());
  await signInAs(page, request, manager);
  await deleteOrderThroughApi(page, seeded.deleted);
  return seeded;
}

/** The axe findings of the page as lines (with the fixed bar re-check of D-71), so a sweep collects them instead of stopping at the first. */
async function axeProblems(page: Page, label: string): Promise<string[]> {
  try {
    await expectNoAxeViolations(page);
    return [];
  } catch (error) {
    return [`${label}: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/** Opens a page and waits for its h1, its ready text, the network and the fonts. */
async function open(page: Page, path: string, h1: string, ready: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
  await expect(page.getByText(ready).first()).toBeVisible();
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
}

for (const pageCase of ORDER_PAGES) {
  test(`@orders-sweep ${pageCase.name} does not scroll sideways or cut text short at 8 widths in Blush and Espresso, and axe finds nothing`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(300_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const ids = await start(page, request);
    const failures: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, pageCase.path(ids), pageCase.h1(ids), pageCase.ready(ids));
      await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
      for (const width of WIDTHS) {
        const height = PORTRAIT_HEIGHTS.get(width) ?? 900;
        await page.setViewportSize({ width, height });
        // The tables switch between table and cards by container query: read after the layout has settled.
        await settle(page);
        const label = `${theme} ${String(width)}x${String(height)}`;
        failures.push(...problemsOf(label, await page.evaluate<PageReading>(READ_PAGE)));
        if (AXE_WIDTHS.has(width)) {
          failures.push(...(await axeProblems(page, label)));
        }
      }
    }
    expect(failures).toEqual([]);
  });
}

test('@orders-sweep UIC-62 the Orders toolbar with six controls and five chips wraps at 320 px', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const ids = await start(page, request);
  await page.setViewportSize({ width: 320, height: 568 });
  const chips = ORDER_PAGES.find((candidate) => candidate.name === '/admin/orders with five chips');
  if (chips === undefined) {
    throw new Error('The five chips page is missing from ORDER_PAGES.');
  }
  await open(page, chips.path(ids), 'Orders', ids.richNumber);
  // Search, Status, Dates, Product and the balance box: five chips.
  await expect(page.getByText(`Search: ${ids.word}`)).toBeVisible();
  await expect(page.getByText('Status: In Production')).toBeVisible();
  await expect(page.getByText('Dates: Last 90 days')).toBeVisible();
  await expect(page.getByText('Product: Basketball Jersey')).toBeVisible();
  await expect(page.getByText('Has a balance', { exact: true })).toBeVisible();
  for (const control of ['Status', 'Order date', 'Sort by']) {
    await expect(page.getByRole('combobox', { name: control })).toBeVisible();
  }
  expect(problemsOf('320', await page.evaluate<PageReading>(READ_PAGE))).toEqual([]);
  await expectNoAxeViolations(page);
});

/** The selected tab sits inside the strip and inside the window (the strip may still be scrolling when it is clicked), and the page does not scroll sideways. */
async function expectTabInView(page: Page, strip: Locator, tab: Locator): Promise<void> {
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const width = page.viewportSize()?.width ?? 0;
  await expect
    .poll(async () => {
      const stripBox = await strip.boundingBox();
      const tabBox = await tab.boundingBox();
      if (stripBox === null || tabBox === null) {
        return false;
      }
      return (
        tabBox.x >= stripBox.x - 1 &&
        tabBox.x + tabBox.width <= stripBox.x + stripBox.width + 1 &&
        tabBox.x + tabBox.width <= width + 1
      );
    })
    .toBe(true);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
}

test('@orders-sweep UIC-63 the five order tabs and four Settings tabs scroll inside their strip at 320 px with the selected tab in view', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const ids = await start(page, request);
  await page.setViewportSize({ width: 320, height: 568 });

  await open(page, `/admin/orders/${ids.rich}`, ids.richNumber, 'Estimated Profit');
  const orderStrip = page.getByRole('tablist').first();
  for (const name of [/^Refunds/, /^Expenses/, /^Payments/]) {
    const tab = page.getByRole('tab', { name });
    await tab.click();
    await expectTabInView(page, orderStrip, tab);
  }
  await expectNoAxeViolations(page);

  await open(page, '/admin/settings', 'Settings', 'Add');
  const settingsStrip = page.getByRole('tablist').first();
  for (const name of ['Company Expense Categories', 'Order Expense Categories']) {
    const tab = page.getByRole('tab', { name });
    await tab.click();
    await expectTabInView(page, settingsStrip, tab);
  }
  await expectNoAxeViolations(page);
});

/** Scrolls each footer button into view inside the window and checks it is in the viewport. */
async function expectFooterReachable(dialog: Locator, names: readonly string[]): Promise<void> {
  for (const name of names) {
    const button = dialog.locator('footer').getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
}

test('@orders-sweep UIC-64 the payment window with six fields and the record block fits a 320 x 568 phone and 200% zoom with its footer reachable', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const ids = await start(page, request);
  for (const { label, width, height } of [
    { label: '320 x 568', width: 320, height: 568 },
    { label: '200% zoom', width: 640, height: 360 },
  ]) {
    await page.setViewportSize({ width, height });
    await open(page, `/admin/orders/${ids.rich}?tab=payments`, ids.richNumber, 'Estimated Profit');
    await page.getByRole('button', { name: /^Edit payment of ₱1,000,000\.00, / }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Payment' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Recorded by')).toBeVisible();
    await settle(page);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${label}: page scroll`).toBe(true);
    expect(await page.evaluate(PANEL_FITS), `${label}: window`).toBe(true);
    await expectFooterReachable(dialog, ['Save Payment', 'Cancel']);
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
});

test('@orders-sweep UIC-65 to UIC-68 long names, descriptions, reasons and notes wrap, and 1,000,000.00 lines and a 99,999,999.99 total fit at 320 and 1440 px', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const ids = await start(page, request);
  const failures: string[] = [];
  for (const [width, height] of [
    [320, 568],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    const label = String(width);

    // L1 grid: the card title, its customer line and the total.
    await open(page, `/admin/orders?q=${ids.word}&view=grid`, 'Orders', ids.richNumber);
    const card = page.getByRole('article').filter({ hasText: ids.richNumber });
    await expect(card).toContainText(ids.team);
    await expect(card).toContainText(LONG_CUSTOMER);
    await expect(card).toContainText(TOTAL_TEXT);
    failures.push(...problemsOf(`${label} grid`, await page.evaluate<PageReading>(READ_PAGE)));

    // L1 table: the team and customer cells and the total.
    await open(page, `/admin/orders?q=${ids.word}&view=table`, 'Orders', ids.richNumber);
    const row = page.getByRole('row').filter({ hasText: ids.richNumber });
    await expect(row).toContainText(ids.team);
    await expect(row).toContainText(LONG_CUSTOMER);
    await expect(row).toContainText(TOTAL_TEXT);
    failures.push(...problemsOf(`${label} table`, await page.evaluate<PageReading>(READ_PAGE)));

    // O1: the subline, the customer card with the note, the item cells with the 200-character text, the totals and the dialog title.
    await open(page, `/admin/orders/${ids.rich}`, ids.richNumber, 'Estimated Profit');
    await expect(page.getByRole('region', { name: 'Totals' })).toContainText(TOTAL_TEXT);
    await expect(page.getByText(LONG_NOTES.slice(0, 120)).first()).toBeVisible();
    const items = page.getByRole('table', { name: 'Order items' });
    await expect(items).toContainText(LONG_TEXT);
    await expect(items).toContainText('₱1,000,000.00');
    failures.push(...problemsOf(`${label} order`, await page.evaluate<PageReading>(READ_PAGE)));
    await page.getByRole('button', { name: /^Delete item 1, / }).click();
    const confirm = page.getByRole('dialog', { name: `Delete item "${LONG_TEXT}"?` });
    await expect(confirm).toBeVisible();
    await settle(page);
    expect(await page.evaluate(PANEL_FITS), `${label}: delete dialog`).toBe(true);
    failures.push(...problemsOf(`${label} delete dialog`, await page.evaluate<PageReading>(READ_PAGE), true));
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();

    // The refund reason and the payment and expense rows.
    for (const [tab, table] of [
      ['refunds', 'Refunds'],
      ['expenses', 'Expenses'],
      ['payments', 'Payments'],
    ] as const) {
      await open(page, `/admin/orders/${ids.rich}?tab=${tab}`, ids.richNumber, 'Estimated Profit');
      await expect(page.getByRole('table', { name: table })).toContainText(LONG_TEXT);
      failures.push(...problemsOf(`${label} ${tab}`, await page.evaluate<PageReading>(READ_PAGE)));
    }

    // X1 and X2: the 100-character names in the table and the header.
    await open(page, '/admin/orders/deleted', 'Deleted Orders', ids.deletedNumber);
    await expect(page.getByRole('row').filter({ hasText: ids.deletedNumber })).toContainText(LONG_CUSTOMER);
    failures.push(...problemsOf(`${label} deleted list`, await page.evaluate<PageReading>(READ_PAGE)));
    await open(page, `/admin/orders/deleted/${ids.deleted}`, ids.deletedNumber, 'Estimated Profit');
    await expect(page.getByText(LONG_CUSTOMER).first()).toBeVisible();
    failures.push(...problemsOf(`${label} deleted order`, await page.evaluate<PageReading>(READ_PAGE)));

    // F2: the note box holds all 2,000 characters and scrolls inside itself.
    await open(page, `/admin/orders/${ids.rich}/edit`, 'Edit Order', 'Save Changes');
    const notes = page.getByLabel(/^Notes/);
    await expect(notes).toHaveValue(LONG_NOTES);
    const scrolls = await page.evaluate<boolean>(
      "(() => { const box = document.querySelector('textarea'); return box !== null && box.scrollHeight > box.clientHeight; })()",
    );
    expect(scrolls, `${label}: the note box scrolls inside itself`).toBe(true);
    failures.push(...problemsOf(`${label} edit`, await page.evaluate<PageReading>(READ_PAGE)));
  }
  expect(failures).toEqual([]);
});

test('@orders-sweep UIC-69 the status menu stays inside the viewport at 320 px and its Completed reason wraps', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The order owes money, so Mark Completed is unavailable and shows its reason.
  const manager = await createStaff(request, 'Manager');
  const word = uniqueWord();
  const number = uniqueNumber(2080);
  const id = await createOrder(request, {
    number,
    status: 'production',
    customerName: LONG_CUSTOMER,
    teamName: `${word}${'Ballers'.repeat(13)}`.slice(0, 100),
    orderDate: manilaDate(-3),
    dueDate: manilaDate(5),
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: LONG_TEXT, quantity: 12, unitPrice: 780 }],
  });
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, `/admin/orders/${id}`, number, 'Estimated Profit');
  await page.getByRole('button', { name: 'Change Status' }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await settle(page);
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  if (box !== null) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await expect(menu.getByRole('menuitem', { name: /^Mark Completed/ })).toHaveAttribute('aria-disabled', 'true');
  expect(problemsOf('320 menu', await page.evaluate<PageReading>(READ_PAGE))).toEqual([]);
  await expectNoAxeViolations(page);
});

test('@orders-sweep UIC-70 the create form with 100 items keeps the grid and the save bar usable', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await open(page, '/admin/orders/new', 'New Order', 'Save Order');
    const add = page.getByRole('button', { name: 'Add Item' }).first();
    const rows = page.getByRole('group', { name: /^Item \d+$/ });
    for (let count = 1; count < 100; count += 1) {
      await add.click();
    }
    await expect(rows).toHaveCount(100);
    await expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

    // The last row can be reached, and its focused field is never hidden under the save bar.
    const save = page.getByRole('button', { name: 'Save Order' });
    const bar = save.locator('xpath=..');
    const description = rows.last().getByLabel(/^Description/);
    await description.focus();
    const field = await description.boundingBox();
    const barBox = await bar.boundingBox();
    expect(field).not.toBeNull();
    expect(barBox).not.toBeNull();
    if (field !== null && barBox !== null) {
      expect(field.y + field.height).toBeLessThanOrEqual(barBox.y + 1);
    }
    await expect(save).toBeInViewport();
    expect(problemsOf(`${String(width)} 100 items`, await page.evaluate<PageReading>(READ_PAGE))).toEqual([]);
  }
});

test('@orders-sweep UIC-74 Deleted Orders reads the count in words, and an unknown admin address shows Page not found', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await start(page, request);

  // The count follows the server's total; the singular for one is held by DeletedOrdersPage.test.tsx (the shared database cannot be made to hold exactly one).
  const answered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/orders/deleted' && response.request().method() === 'GET',
  );
  await page.goto('/admin/orders/deleted');
  const body = (await (await answered).json()) as { total: number };
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted Orders' })).toBeVisible();
  const words = `Showing ${body.total.toLocaleString('en-US')} deleted ${body.total === 1 ? 'order' : 'orders'} · most recently deleted first`;
  await expect(page.getByText(/^Showing/)).toHaveText(words);
  await expectNoAxeViolations(page);

  // An unknown address under /admin shows the in-shell Page not found screen (D-89).
  await page.goto('/admin/no-such-page');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' }).first()).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
