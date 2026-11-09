// Phase 10 money sweep (DASH-06, MONEY-02, WCAG 2.2 AA, strict CSP, responsive 320 to 1920; plan 10-21), in all five projects. A fresh Admin
// opens My Money; a fresh Manager opens My Money, All Staff, Transfers (also with Show deleted) and one person's page, at 320, 390, 820 and
// 1440 px in Blush and Espresso. At each width the page must not scroll sideways, the tab strip must fit, axe must find nothing (the
// target-size rule included), and the Transfer, Hand Over, Delete Transfer and Remove Permanently windows must open clean with their
// buttons reachable. Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database holds
// what other specs made, so nothing here asserts a shop-wide figure: only the money of the fresh people each test makes (RESEARCH Pitfall 11).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import {
  holdsItsContent,
  manilaDate,
  NO_SIDEWAYS_SCROLL,
  PAST_MONTH_DAYS,
  reachableWithoutScrolling,
  selectedTabInView,
} from './helpers.ts';
import { settle } from './sweep.ts';
import { BASKETBALL_JERSEY_ID, CASH_ID, createOrder, createStaff, type TestStaff } from './testing-api.ts';

const WIDTHS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
] as const;

const THEMES = ['light', 'dark'] as const;

/**
 * Seeds an order of 5,000.00 paid in full, with the payment received by `receiver`: that person now holds 5,000.00. The payment is dated
 * before the current business month, so it adds nothing to this month's shop totals (the money on hand counts every date).
 */
async function seedPaymentTo(request: APIRequestContext, receiver: TestStaff): Promise<void> {
  await createOrder(request, {
    number: `ORD-2097-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
    customerName: 'E2E Money Sweep Customer',
    orderDate: manilaDate(PAST_MONTH_DAYS),
    items: [
      { productTypeId: BASKETBALL_JERSEY_ID, description: 'E2E money sweep jersey', quantity: 1, unitPrice: 5000 },
    ],
    payments: [
      {
        paymentDate: manilaDate(PAST_MONTH_DAYS),
        amount: 5000,
        paymentMethodId: CASH_ID,
        receivedByUserId: receiver.userId,
      },
    ],
  });
}

/** Records a transfer of `amount` from the signed-in person to `receiverName` through the dashboard strip, and waits for the window to close. */
async function recordTransfer(page: Page, receiverName: string, amount: string): Promise<void> {
  const strip = page.getByRole('region', { name: 'Your money on hand' });
  await strip.getByRole('button', { name: 'Transfer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer Money' });
  await expect(dialog).toBeVisible();
  const to = dialog.getByLabel(/^To/);
  await expect(to).toBeEnabled();
  await to.selectOption({ label: receiverName });
  await dialog.getByLabel(/^Amount/).fill(amount);
  await dialog.getByRole('button', { name: 'Record Transfer' }).click();
  await expect(dialog).toBeHidden();
  // A second transfer raises its toast while the first one is still up.
  await expect(page.getByText('Transfer recorded').last()).toBeVisible();
}

/** Axe's findings for the page as one message, or null when it finds nothing (the same run every e2e check uses). */
async function axeProblem(page: Page): Promise<string | null> {
  try {
    await expectNoAxeViolations(page);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Measures the page as it stands and returns what is wrong, one line each. */
async function measure(page: Page, label: string): Promise<string[]> {
  const failures: string[] = [];
  await settle(page);
  if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
    failures.push(`${label}: the page scrolls sideways`);
  }
  // The strip may scroll sideways (UI-SPEC: "Tab strip scrolls sideways; page never does"); the selected tab must stay in view.
  for (const strip of await page.getByRole('tablist').all()) {
    if (!(await strip.evaluate(selectedTabInView))) {
      failures.push(`${label}: the selected tab is out of sight in its strip`);
    }
  }
  const axe = await axeProblem(page);
  if (axe !== null) {
    failures.push(`${label}: ${axe}`);
  }
  return failures;
}

/** True when the whole button lies between the left and right edges of its window (0.5px of rounding allowed). */
const insideWindowSideways = (button: {
  getBoundingClientRect(): { left: number; right: number };
  closest(selector: string): { getBoundingClientRect(): { left: number; right: number } } | null;
}): boolean => {
  const sheet = button.closest('[role="dialog"]')?.getBoundingClientRect();
  const own = button.getBoundingClientRect();
  return sheet !== undefined && own.left >= sheet.left - 0.5 && own.right <= sheet.right + 0.5;
};

/** Checks each footer button is inside the window and the dialog as it opens, with no scrolling, and fully inside it sideways. */
async function footerReachable(dialog: Locator, names: readonly string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const name of names) {
    const button = dialog.getByRole('button', { name, exact: true });
    if (!(await button.evaluate(reachableWithoutScrolling))) {
      failures.push(`the ${name} button is out of reach`);
    }
    if (!(await button.evaluate(insideWindowSideways))) {
      failures.push(`the ${name} button sticks out past the window edge`);
    }
  }
  return failures;
}

/** Opens a window with `open`, measures it (no sideways scroll, the sheet fits, buttons reachable, axe), and closes it with Esc. */
async function checkWindow(
  page: Page,
  label: string,
  title: string,
  buttons: readonly string[],
  open: () => Promise<void>,
): Promise<string[]> {
  const failures: string[] = [];
  await open();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await settle(page);
  if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
    failures.push(`${label}: the page scrolls sideways`);
  }
  if (!(await dialog.evaluate(holdsItsContent))) {
    failures.push(`${label}: the window scrolls sideways`);
  }
  failures.push(...(await footerReachable(dialog, buttons)).map((line) => `${label}: ${line}`));
  const axe = await axeProblem(page);
  if (axe !== null) {
    failures.push(`${label}: ${axe}`);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  return failures;
}

/** Opens an address, waits for `ready`, then for the fonts and animations. */
async function openPage(page: Page, path: string, ready: () => Promise<void>): Promise<void> {
  await page.goto(path);
  await ready();
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
}

// --- An Admin: My Money only ---

for (const { width, height } of WIDTHS) {
  test(`@money-sweep an Admin's My Money fits at ${String(width)} px in Blush and Espresso, has no axe finding, and opens Transfer clean`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(240_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const admin = await createStaff(request, 'Admin');
    await seedPaymentTo(request, admin);
    await signInAs(page, request, admin);
    const failures: string[] = [];
    for (const theme of THEMES) {
      await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
      await page.setViewportSize({ width, height });
      const label = `${theme} ${String(width)}x${String(height)}`;
      await openPage(page, '/admin/money', async () => {
        await expect(page.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Money on hand' })).toContainText('₱5,000.00');
        await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
      });
      // An Admin has no tab strip: My Money is the whole page.
      await expect(page.getByRole('tablist')).toHaveCount(0);
      failures.push(...(await measure(page, `${label} /admin/money`)));
      failures.push(
        ...(await checkWindow(
          page,
          `${label} Transfer window`,
          'Transfer Money',
          ['Record Transfer', 'Cancel'],
          async () => {
            await page.getByRole('button', { name: 'Transfer', exact: true }).first().click();
          },
        )),
      );
    }
    expect(failures).toEqual([]);
  });
}

test('@money-sweep an Admin who opens the All Staff address ends with no tab in the URL and no tab strip', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Admin'));

  await page.goto('/admin/money?tab=staff');

  await expect(page.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('tab')).toBe(false);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Staff money on hand' })).toHaveCount(0);
});

// --- A Manager: My Money, All Staff, Transfers, Show deleted and one person's page ---

/** The made-up people one Manager test works with. */
interface Cast {
  readonly manager: TestStaff;
  readonly leaver: TestStaff;
  readonly leaverId: string;
  readonly leaverName: string;
  readonly receiverName: string;
}

/**
 * A Manager who holds 5,000.00, a deactivated person who holds 5,000.00, and a coworker. The Manager records a transfer of 100.00 and one of
 * 200.00 to the coworker, then deletes the second, so the Transfers tab has a counted row and (with Show deleted) a deleted one.
 */
async function seedCast(page: Page, request: APIRequestContext): Promise<Cast> {
  const token = randomUUID().replaceAll('-', '').slice(0, 8);
  const manager = await createStaff(request, 'Manager', undefined, { firstName: 'Mara', lastName: `Boss${token}` });
  const leaver = await createStaff(request, 'Admin', 'deactivated', { firstName: 'Joel', lastName: `Gone${token}` });
  await createStaff(request, 'Admin', undefined, { firstName: 'Rina', lastName: `Recv${token}` });
  const cast: Cast = {
    manager,
    leaver,
    leaverId: leaver.userId,
    leaverName: `Joel Gone${token}`,
    receiverName: `Rina Recv${token}`,
  };
  await seedPaymentTo(request, manager);
  await seedPaymentTo(request, leaver);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInAs(page, request, manager);
  await recordTransfer(page, cast.receiverName, '100');
  await recordTransfer(page, cast.receiverName, '200');
  await page.goto('/admin/money?tab=transfers&size=100');
  const row = page
    .getByRole('table', { name: 'Transfers' })
    .getByRole('row')
    .filter({ hasText: cast.receiverName })
    .filter({ hasText: '₱200.00' });
  await row.getByRole('button', { name: /^Delete transfer of ₱200\.00 from / }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this transfer?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete Transfer' }).click();
  await expect(page.getByText('Transfer deleted')).toBeVisible();
  return cast;
}

for (const { width, height } of WIDTHS) {
  test(`@money-sweep a Manager's money pages and windows fit at ${String(width)} px in Blush and Espresso, and axe finds nothing`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(420_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const cast = await seedCast(page, request);
    const transfers = (): Locator =>
      page.getByRole('table', { name: 'Transfers' }).getByRole('row').filter({ hasText: cast.receiverName });
    const failures: string[] = [];

    for (const theme of THEMES) {
      await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
      await page.setViewportSize({ width, height });
      const label = `${theme} ${String(width)}x${String(height)}`;

      // My Money (Mine): the three-tab strip, the balance card and the ledger.
      await openPage(page, '/admin/money', async () => {
        await expect(page.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Money on hand' })).toContainText('₱');
        await expect(page.getByRole('tab')).toHaveCount(3);
        await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
      });
      failures.push(...(await measure(page, `${label} /admin/money`)));
      failures.push(
        ...(await checkWindow(
          page,
          `${label} Transfer window`,
          'Transfer Money',
          ['Record Transfer', 'Cancel'],
          async () => {
            await page.getByRole('button', { name: 'Transfer', exact: true }).first().click();
          },
        )),
      );

      // All Staff: the cards on phones, with a leaver who holds money.
      await openPage(page, '/admin/money?tab=staff', async () => {
        await expect(page.getByRole('tab', { name: 'All Staff' })).toHaveAttribute('aria-selected', 'true');
        await expect(
          page
            .getByRole('table', { name: 'Staff money on hand' })
            .getByRole('row')
            .filter({ hasText: cast.leaverName }),
        ).toBeVisible();
      });
      failures.push(...(await measure(page, `${label} /admin/money?tab=staff`)));
      failures.push(
        ...(await checkWindow(
          page,
          `${label} Hand Over window`,
          'Hand Over Money',
          ['Record Handover', 'Cancel'],
          async () => {
            await page.getByRole('button', { name: `Hand over money from ${cast.leaverName}` }).click();
          },
        )),
      );

      // Transfers: the counted transfer, and with Show deleted the deleted one.
      await openPage(page, '/admin/money?tab=transfers&size=100', async () => {
        await expect(page.getByRole('tab', { name: 'Transfers' })).toHaveAttribute('aria-selected', 'true');
        await expect(transfers()).toHaveCount(1);
      });
      failures.push(...(await measure(page, `${label} /admin/money?tab=transfers`)));
      failures.push(
        ...(await checkWindow(
          page,
          `${label} Delete Transfer window`,
          'Delete this transfer?',
          ['Delete Transfer', 'Cancel'],
          async () => {
            await transfers()
              .getByRole('button', { name: /^Delete transfer of ₱100\.00 from / })
              .click();
          },
        )),
      );
      await openPage(page, '/admin/money?tab=transfers&size=100&deleted=true', async () => {
        await expect(transfers()).toHaveCount(2);
      });
      failures.push(...(await measure(page, `${label} /admin/money?tab=transfers&deleted=true`)));
      failures.push(
        ...(await checkWindow(
          page,
          `${label} Remove Permanently window`,
          'Permanently remove this transfer?',
          ['Remove Permanently', 'Cancel'],
          async () => {
            await transfers()
              .getByRole('button', { name: /^Remove transfer of ₱200\.00 from .* permanently$/ })
              .click();
          },
        )),
      );

      // One person's page: the header, the balance card and the ledger of the leaver.
      await openPage(page, `/admin/money/staff/${cast.leaverId}`, async () => {
        await expect(page.getByRole('heading', { level: 1, name: cast.leaverName })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Money on hand' })).toContainText('₱5,000.00');
      });
      failures.push(...(await measure(page, `${label} /admin/money/staff/{leaver}`)));
    }
    expect(failures).toEqual([]);
  });
}
