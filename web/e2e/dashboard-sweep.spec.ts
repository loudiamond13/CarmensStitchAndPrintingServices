// Phase 10 dashboard sweep (DASH-06, WCAG 2.2 AA, strict CSP, responsive 320 to 1920; plan 10-21), in all five projects. A fresh signed-in
// staff member opens /admin and /admin?range=12m at 320, 390, 820 and 1440 px in Blush and Espresso and checks that axe finds nothing (the
// target-size rule included), that the page does not scroll sideways, and that the 12M chart at 320 px draws every other month label.
// Every test runs under the shared guard (console, page errors, CSP, failed responses), so a console finding or a CSP violation on any
// swept page fails the test. The shared CSPS_E2E database holds what other specs made, so nothing here asserts a shop-wide figure
// (RESEARCH Pitfall 11): the staff member's own payment and expense only make sure the cards and the chart have something to draw.
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { dashboardHeading, signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test, type Guard } from './fixtures.ts';
import { DASHBOARD_SWEEP_FIGURES, manilaDate, NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { settle } from './sweep.ts';
import {
  BASKETBALL_JERSEY_ID,
  CASH_ID,
  createExpense,
  createOrder,
  createStaff,
  type StaffRole,
  type TestStaff,
} from './testing-api.ts';

const WIDTHS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
] as const;

const THEMES = ['light', 'dark'] as const;

/** The status lines that say each dashboard card has its answer. */
const LOADED = [
  'The shop figures loaded.',
  'The chart loaded.',
  'Order counts loaded.',
  'Recent orders loaded.',
] as const;

/** The seeded Rent category (the id is the fixed migration seed literal). */
const RENT = '6869715c-a01f-4053-87d8-8fd39feebebc';

/** The short month names under the chart's bars (the y-axis ticks read "₱…k"). */
const READ_MONTH_LABELS = `(() => Array.from(document.querySelectorAll('svg text'))
  .map((text) => (text.textContent ?? '').trim())
  .filter((text) => /^[A-Z][a-z]{2}$/.test(text)).length)()`;

/** A fresh person of a role who received a small payment today and paid a small expense today, so the cards and the chart have figures. */
async function seedStaff(request: APIRequestContext, role: StaffRole): Promise<TestStaff> {
  const staff = await createStaff(request, role);
  const today = manilaDate(0);
  await createOrder(request, {
    number: `ORD-2096-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
    customerName: 'E2E Sweep Customer',
    orderDate: today,
    items: [
      {
        productTypeId: BASKETBALL_JERSEY_ID,
        description: 'E2E sweep jersey',
        quantity: 1,
        unitPrice: DASHBOARD_SWEEP_FIGURES.payment,
      },
    ],
    payments: [
      {
        paymentDate: today,
        amount: DASHBOARD_SWEEP_FIGURES.payment,
        paymentMethodId: CASH_ID,
        receivedByUserId: staff.userId,
      },
    ],
  });
  await createExpense(request, {
    paidByUserId: staff.userId,
    recordedByUserId: staff.userId,
    date: today,
    categoryId: RENT,
    description: 'E2E sweep expense',
    amount: DASHBOARD_SWEEP_FIGURES.expense,
  });
  return staff;
}

/** Opens a dashboard address and waits until every card has its answer and the fonts and animations have settled. */
async function openDashboard(page: Page, path: string, firstName: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText(dashboardHeading({ firstName }));
  for (const text of LOADED) {
    await expect(page.getByRole('status').filter({ hasText: text })).toBeAttached();
  }
  await expect(page.getByRole('region', { name: 'Your money on hand' })).toContainText('₱');
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
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

/** Measures one page at one width and returns what is wrong, one line each. */
async function measure(page: Page, label: string): Promise<string[]> {
  const failures: string[] = [];
  await settle(page);
  if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
    failures.push(`${label}: the page scrolls sideways`);
  }
  const axe = await axeProblem(page);
  if (axe !== null) {
    failures.push(`${label}: ${axe}`);
  }
  return failures;
}

interface DashboardCase {
  readonly name: string;
  readonly role: StaffRole;
  readonly path: string;
}

const CASES: readonly DashboardCase[] = [
  { name: '/admin as a Manager', role: 'Manager', path: '/admin' },
  { name: '/admin as an Admin', role: 'Admin', path: '/admin' },
  { name: '/admin?range=12m as a Manager', role: 'Manager', path: '/admin?range=12m' },
];

/** Signs a fresh person in and sweeps one address at the widths in both themes. */
async function sweep(
  page: Page,
  request: APIRequestContext,
  guard: Guard,
  { role, path }: DashboardCase,
  widths: readonly { width: number; height: number }[],
): Promise<string[]> {
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await seedStaff(request, role);
  const user = await signInAs(page, request, staff);
  const failures: string[] = [];
  for (const theme of THEMES) {
    await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openDashboard(page, path, user.firstName);
    await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
    for (const { width, height } of widths) {
      await page.setViewportSize({ width, height });
      failures.push(...(await measure(page, `${theme} ${String(width)}x${String(height)}`)));
    }
  }
  return failures;
}

for (const sweepCase of CASES) {
  test(`@dashboard-sweep ${sweepCase.name} has no axe finding and does not scroll sideways at 390, 820 and 1440 px in Blush and Espresso`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(300_000);
    const failures = await sweep(page, request, guard, sweepCase, WIDTHS.slice(1));
    expect(failures).toEqual([]);
  });

  // OWNER DECISION P10-BL-06 (open): at 320 px a six-digit KPI figure can be wider than its card, so this case can fail with "the page
  // scrolls sideways". It stays in the sweep and is left failing on purpose until the owner rules. No fixme.
  test(`@dashboard-sweep ${sweepCase.name} has no axe finding and does not scroll sideways at 320 px in Blush and Espresso`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(300_000);
    const failures = await sweep(page, request, guard, sweepCase, WIDTHS.slice(0, 1));
    expect(failures).toEqual([]);
  });
}

for (const { width, height } of [WIDTHS[0], WIDTHS[3]]) {
  test(`@dashboard-sweep the 12M chart at ${String(width)} px draws ${width === 320 ? 'every other' : 'every'} month label`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(180_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const user = await signInAs(page, request, await seedStaff(request, 'Manager'));
    await page.setViewportSize({ width, height });
    await openDashboard(page, '/admin?range=12m', user.firstName);
    await expect(page.getByRole('radio', { name: '12M' })).toBeChecked();
    // Twelve months: all twelve names when each group is wide enough, else every other one (D-51).
    await expect.poll(() => page.evaluate<number>(READ_MONTH_LABELS)).toBe(width === 320 ? 6 : 12);
  });
}
