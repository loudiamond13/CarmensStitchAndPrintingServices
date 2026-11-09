// Dashboard calls (DASH-01, OR-5). Types come from the generated OpenAPI types, never from utils/csps.ts.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
import { requireFigure } from '@/utils/toFiniteFigure';

type Schemas = components['schemas'];

export type DashboardSummaryResponse = Schemas['DashboardSummaryResponse'];
export type DashboardChartResponse = Schemas['DashboardChartResponse'];

/** The only month counts the chart endpoint answers (the server says 400 for any other). */
export type DashboardChartMonths = 6 | 12;

const CHART_MONTHS: readonly number[] = [6, 12];

/** One chart month with every figure narrowed to a finite number. */
export interface DashboardChartMonthFigures {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

/** The chart answer once the browser has checked it can draw it. */
export interface DashboardChart {
  months: number;
  items: DashboardChartMonthFigures[];
}

/** A dashboard answer is not one the browser can show, so the card shows its failure instead of a broken figure. */
export class DashboardContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardContractError';
  }
}

/** A generated `number | string` figure as a finite number. Blank text, `null`, `NaN` and `Infinity` are refused. */
function finiteFigure(value: unknown, what: string): number {
  return requireFigure(value, `chart ${what}`, (message) => new DashboardContractError(message));
}

/**
 * Checks a chart answer against the window that was asked for and narrows every figure. The server's `months` must be the
 * requested 6 or 12, so an answer for another window is a failure, not a chart under the wrong heading.
 */
export function parseDashboardChart(response: DashboardChartResponse, requested: DashboardChartMonths): DashboardChart {
  const months = finiteFigure(response.months, 'months');
  if (months !== requested)
    throw new DashboardContractError('The chart answers another window than the one asked for.');
  return {
    months,
    items: response.items.map((item) => ({
      month: item.month,
      income: finiteFigure(item.income, 'income'),
      expenses: finiteFigure(item.expenses, 'expenses'),
      profit: finiteFigure(item.profit, 'profit'),
    })),
  };
}

/** A recent order with the money its card shows as plain numbers. */
export type DashboardRecentOrder = Schemas['OrderListEntry'] & {
  total: number;
  balance: number;
  customerCredit: number;
};

/** The summary answer once the browser has checked every figure: each money figure, count and percent is a finite number. */
export interface DashboardSummary {
  today: string;
  greeting: string;
  firstName: string;
  orders: { active: number; dueThisWeek: number; overdue: number; receivables: number };
  collected: { thisMonth: number; comparison: number; changePercent: number | null; comparisonThrough: string };
  expenses: { thisMonth: number; count: number; topCategory: string | null };
  statuses: { status: string; count: number }[];
  recentOrders: DashboardRecentOrder[];
}

function summaryFigure(value: unknown, what: string): number {
  return requireFigure(value, `summary ${what}`, (message) => new DashboardContractError(message));
}

/**
 * Narrows a summary answer. A figure the browser cannot read (text that is not a plain decimal, blank, null) refuses the whole
 * answer, so the cards show their failure instead of a wrong or NaN figure, as every other money answer does.
 */
export function parseDashboardSummary(response: DashboardSummaryResponse): DashboardSummary {
  const { orders, collected, expenses } = response;
  return {
    today: response.today,
    greeting: response.greeting,
    firstName: response.firstName,
    orders: {
      active: summaryFigure(orders.active, 'active orders'),
      dueThisWeek: summaryFigure(orders.dueThisWeek, 'due this week'),
      overdue: summaryFigure(orders.overdue, 'overdue'),
      receivables: summaryFigure(orders.receivables, 'receivables'),
    },
    collected: {
      thisMonth: summaryFigure(collected.thisMonth, 'collected'),
      comparison: summaryFigure(collected.comparison, 'comparison'),
      changePercent: collected.changePercent === null ? null : summaryFigure(collected.changePercent, 'percent'),
      comparisonThrough: collected.comparisonThrough,
    },
    expenses: {
      thisMonth: summaryFigure(expenses.thisMonth, 'expenses'),
      count: summaryFigure(expenses.count, 'expense count'),
      topCategory: expenses.topCategory,
    },
    statuses: response.statuses.map((entry) => ({
      status: entry.status,
      count: summaryFigure(entry.count, `${entry.status} count`),
    })),
    recentOrders: response.recentOrders.map((entry) => ({
      ...entry,
      total: summaryFigure(entry.total, 'order total'),
      balance: summaryFigure(entry.balance, 'order balance'),
      customerCredit: summaryFigure(entry.customerCredit, 'order credit'),
    })),
  };
}

export interface DashboardService {
  /**
   * `GET /api/v1/dashboard/summary`: the business today, the greeting part, the caller's first name, the four card figures, the
   * six status counts and the six newest orders in one live answer. It takes no parameters and the server never caches it.
   */
  summary(signal?: AbortSignal): Promise<DashboardSummaryResponse>;
  /**
   * `GET /api/v1/dashboard/chart?months=6|12`: income, expenses and profit for each business month, oldest first, the current
   * month last. Every figure is the server's; any other month count is refused here and answered 400 by the server.
   */
  chart(months: DashboardChartMonths, signal?: AbortSignal): Promise<DashboardChartResponse>;
}

export function createDashboardService(client: HttpClient): DashboardService {
  return {
    summary: (signal) => client.get<DashboardSummaryResponse>('/dashboard/summary', { signal }),
    chart: (months, signal) =>
      CHART_MONTHS.includes(months)
        ? client.get<DashboardChartResponse>('/dashboard/chart', { params: { months: String(months) }, signal })
        : Promise.reject(new RangeError('The chart shows 6 or 12 months.')),
  };
}

export const dashboardService: DashboardService = createDashboardService(apiClient);
