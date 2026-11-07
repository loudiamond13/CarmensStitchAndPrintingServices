// Dashboard summary fixtures for component, service and route tests (plan 10-07): the answer typed from the generated contract
// with the UI-SPEC 12.4 demo values and made-up people, and an MSW handler that records every request.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import {
  buildOrderListEntry,
  cancelledOrderWithRefunds,
  creditOrder,
  deliveredOrder,
  listEntryOf,
  order0148,
  order0151,
  order0153,
} from '@/test/orderFixtures';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type DashboardSummaryFixture = Schemas['DashboardSummaryResponse'];

/** The business today of the demo values: a Tuesday, as in the UI-SPEC example. */
export const DASHBOARD_TODAY = '2026-10-06';

/** The 12.4 demo values: 18 active orders, 4 due this week, 84,260.00 owed, 126,450.00 collected (up 12%), 38,226.95 spent. */
export function dashboardSummaryFixture(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return {
    today: DASHBOARD_TODAY,
    greeting: 'morning',
    firstName: 'Carmen',
    orders: { active: 18, dueThisWeek: 4, overdue: 2, receivables: 84260 },
    collected: { thisMonth: 126450, comparison: 112900, changePercent: 12, comparisonThrough: '2026-09-06' },
    expenses: { thisMonth: 38226.95, count: 9, topCategory: 'Rent' },
    statuses: [
      { status: 'pending', count: 3 },
      { status: 'mockup', count: 4 },
      { status: 'production', count: 7 },
      { status: 'ready', count: 4 },
      { status: 'delivered', count: 0 },
      { status: 'completed', count: 11 },
    ],
    recentOrders: [buildOrderListEntry()],
    ...overrides,
  };
}

/** The UI-SPEC 12.4 values for a November day: 18 active orders (5 due this week, 2 overdue), up 12% on October. */
export function dashboardNovemberSummary(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardSummaryFixture({
    today: '2026-11-04',
    orders: { active: 18, dueThisWeek: 5, overdue: 2, receivables: 84300 },
    collected: { thisMonth: 126450, comparison: 112900, changePercent: 12, comparisonThrough: '2026-10-04' },
    expenses: { thisMonth: 58320, count: 23, topCategory: 'Rent' },
    statuses: [
      { status: 'pending', count: 4 },
      { status: 'mockup', count: 2 },
      { status: 'production', count: 7 },
      { status: 'ready', count: 3 },
      { status: 'delivered', count: 2 },
      { status: 'completed', count: 11 },
    ],
    ...overrides,
  });
}

/** A shop with no orders, no money and no expenses: every figure is zero and nothing is listed. */
export function dashboardNewShopSummary(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardSummaryFixture({
    orders: { active: 0, dueThisWeek: 0, overdue: 0, receivables: 0 },
    collected: { thisMonth: 0, comparison: 0, changePercent: null, comparisonThrough: '2026-09-06' },
    expenses: { thisMonth: 0, count: 0, topCategory: null },
    statuses: [
      { status: 'pending', count: 0 },
      { status: 'mockup', count: 0 },
      { status: 'production', count: 0 },
      { status: 'ready', count: 0 },
      { status: 'delivered', count: 0 },
      { status: 'completed', count: 0 },
    ],
    recentOrders: [],
    ...overrides,
  });
}

/** Mar 31 (Manila): the server clamps the comparison to Feb 28, so the labels say Mar and Feb. */
export function dashboardMarch31Summary(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardSummaryFixture({
    today: '2026-03-31',
    collected: { thisMonth: 40500, comparison: 38000, changePercent: 7, comparisonThrough: '2026-02-28' },
    ...overrides,
  });
}

/** A Monday (Nov 2): the week has just begun, so six orders are due this week and none are overdue. */
export function dashboardMondaySummary(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardSummaryFixture({
    today: '2026-11-02',
    orders: { active: 9, dueThisWeek: 6, overdue: 0, receivables: 15250.5 },
    collected: { thisMonth: 1200, comparison: 900, changePercent: 33, comparisonThrough: '2026-10-02' },
    ...overrides,
  });
}

/** A Sunday (Nov 8): the last day of the week, with one order due and one overdue. */
export function dashboardSundaySummary(overrides: Partial<DashboardSummaryFixture> = {}): DashboardSummaryFixture {
  return dashboardSummaryFixture({
    today: '2026-11-08',
    orders: { active: 12, dueThisWeek: 1, overdue: 1, receivables: 22000 },
    collected: { thisMonth: 54000, comparison: 61000, changePercent: -11, comparisonThrough: '2026-10-08' },
    ...overrides,
  });
}

/** The business today of the recent orders below: ORD-2026-0153 (due Oct 5) is overdue by 3 days. */
export const RECENT_ORDERS_TODAY = '2026-10-08';

/**
 * Six recent orders, newest first, one for each Balance and Due state: a balance due, Fully Paid, a walk-in Mockup order that is
 * overdue, a customer credit, a Delivered order past its due date (no overdue flag) and a Cancelled order with money unpaid.
 */
export function dashboardRecentOrders(): DashboardSummaryFixture['recentOrders'] {
  return [order0148, order0151, order0153, creditOrder, deliveredOrder, cancelledOrderWithRefunds].map(listEntryOf);
}

/** What `GET /api/v1/dashboard/summary` was asked for. */
export interface DashboardCalls {
  readonly calls: URL[];
}

type DashboardResponder = (
  url: URL,
) => Response | DashboardSummaryFixture | Promise<Response | DashboardSummaryFixture>;

/** Answers the summary with a fixture, or with a function that decides per call (a failure is a Response). */
export function dashboardBackend(
  answer: DashboardSummaryFixture | DashboardResponder = dashboardSummaryFixture(),
): DashboardCalls {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/dashboard/summary', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof answer === 'function' ? await answer(url) : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}
