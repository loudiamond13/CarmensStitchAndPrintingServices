// The Orders view choice end to end (ORD-10, ORD-01, UIC-30; plan 08-11), in all five projects. A signed-in Manager picks Table, the
// choice survives a reload and a visit without a view, a shared ?view=grid link shows the grid without touching the stored
// choice, and the table scrolls inside its frame on a tablet and becomes row cards on a phone with no sideways page scroll.
// The shared CSPS_E2E database keeps what earlier runs made, so each check finds its own order by a unique number. Every test
// runs under the shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { BASKETBALL_JERSEY_ID, createOrder, createStaff } from './testing-api.ts';

/** The key the page keeps the view choice under. */
const VIEW_KEY = 'csps-orders-view';

/** The order is due long ago, so the default "soonest due first" puts it on the first page whatever else the database holds. */
async function seedOrder(request: Parameters<typeof createOrder>[0], prefix: string): Promise<string> {
  const number = `ORD-${prefix}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  await createOrder(request, {
    number,
    customerName: 'E2E View Customer',
    teamName: 'E2E View Team',
    orderDate: '2000-01-01',
    dueDate: '2000-01-02',
    items: [{ productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E jersey', quantity: 12, unitPrice: 780 }],
  });
  return number;
}

/** The stored view choice, or null when none is stored. */
async function storedView(page: Page): Promise<string | null> {
  const value: unknown = await page.evaluate(`window.localStorage.getItem(${JSON.stringify(VIEW_KEY)})`);
  return typeof value === 'string' ? value : null;
}

interface FrameReading {
  readonly overflowX: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly tableWidth: number;
}

/** The few members of the frame element the measurement reads (the e2e code has no DOM types). */
interface FrameElement {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly ownerDocument: {
    readonly defaultView: { getComputedStyle(element: unknown): { overflowX: string } } | null;
  };
  querySelector(selector: string): { getBoundingClientRect(): { width: number } } | null;
}

/** What the table frame measures: its own overflow, its widths and the table's width. */
function readFrame(frame: Locator): Promise<FrameReading> {
  return frame.evaluate((element: FrameElement): FrameReading => {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return {
      overflowX: style?.overflowX ?? '',
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      tableWidth: element.querySelector('table')?.getBoundingClientRect().width ?? 0,
    };
  });
}

test('@orders-view the Table choice survives a reload, and a shared Grid link leaves the stored choice alone', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = await seedOrder(request, '2094');
  await signInAs(page, request, manager);

  const grid = page.getByRole('radio', { name: 'Grid view' });
  const table = page.getByRole('radio', { name: 'Table view' });
  const cards = page.getByRole('article').filter({ hasText: number });
  const tableRow = page.getByRole('row').filter({ hasText: number });

  // A fresh browser has no choice: the grid, and nothing written.
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(grid).toBeChecked();
  await expect(cards).toHaveCount(1);
  expect(await storedView(page)).toBeNull();

  // The toggle writes the URL and the storage.
  await table.click();
  await expect(table).toBeChecked();
  await expect(tableRow).toHaveCount(1);
  await expect(cards).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('table');
  expect(await storedView(page)).toBe('table');

  // The table row holds the figures of the order and no internal ones.
  await expect(tableRow).toContainText('E2E View Team');
  await expect(tableRow).toContainText('₱9,360.00');
  await expect(tableRow).toContainText(/Overdue by [\d,]+ days/);
  await expect(page.getByText(/Order Expenses|Estimated Profit/)).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Discount' })).toHaveCount(0);
  await expect(tableRow.getByRole('button', { name: /delete/i })).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // A reload keeps the table.
  await page.reload();
  await expect(table).toBeChecked();
  await expect(tableRow).toHaveCount(1);

  // The address without a view takes the stored choice.
  await page.goto('/admin/orders');
  await expect(table).toBeChecked();
  await expect(tableRow).toHaveCount(1);

  // A shared ?view=grid link shows the grid and leaves the stored choice as it was.
  await page.goto('/admin/orders?view=grid');
  await expect(grid).toBeChecked();
  await expect(cards).toHaveCount(1);
  expect(await storedView(page)).toBe('table');

  // Back at the plain address, the table is still the choice.
  await page.goto('/admin/orders');
  await expect(table).toBeChecked();
  await expect(tableRow).toHaveCount(1);
  expect(await storedView(page)).toBe('table');

  // Switching back writes the grid, and pressing the grid again changes nothing.
  await grid.click();
  await expect(grid).toBeChecked();
  await expect(cards).toHaveCount(1);
  await expect.poll(() => storedView(page)).toBe('grid');
  await grid.click();
  await expect(grid).toBeChecked();
  expect(await storedView(page)).toBe('grid');
});

test('@orders-view the table scrolls inside its frame on a tablet and becomes row cards on a phone', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const number = await seedOrder(request, '2095');
  await signInAs(page, request, manager);

  const frame = page.getByRole('region', { name: 'Orders' });
  const row = page.getByRole('row').filter({ hasText: number });

  // Tablet: the nine columns keep their width and the frame scrolls sideways, never the page.
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/admin/orders?view=table');
  await expect(frame).toBeVisible();
  await expect(row).toHaveCount(1);
  await expect(page.getByRole('columnheader')).toHaveCount(9);
  const tablet = await readFrame(frame);
  expect(tablet.overflowX).toBe('auto');
  expect(tablet.tableWidth).toBeGreaterThanOrEqual(680);
  expect(tablet.scrollWidth).toBeGreaterThan(tablet.clientWidth);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // Phone: no header row; each order is a card whose cells carry their own labels; the page does not scroll sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('columnheader')).toHaveCount(0);
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('link', { name: number })).toBeVisible();
  await expect(row.locator('[data-label="Balance"]')).toBeVisible();
  await expect(row.locator('[data-label="Total"]')).toContainText('₱9,360.00');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});
