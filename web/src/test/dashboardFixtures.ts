// Dashboard summary fixtures for component, service and route tests (plan 10-07): the answer typed from the generated contract
// with the UI-SPEC 12.4 demo values and made-up people, and an MSW handler that records every request.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { buildOrderListEntry } from '@/test/orderFixtures';
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
