// Visitor stats calls (ANL-08, D-24, D-27, D-33; OR-5). Manager only: an Admin gets 403. Every count is the server's; the
// browser only checks that each one is a number it can show.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
import { requireFigure } from '@/utils/toFiniteFigure';

export type VisitorStatsResponse = components['schemas']['VisitorStatsResponse'];

/** What `GET /api/v1/visitor-stats` is asked for: a preset name, or `custom` with both business days (`YYYY-MM-DD`). */
export interface VisitorStatsQuery {
  range: string;
  from: string | null;
  to: string | null;
}

/** The three totals with every count narrowed to a number; null where the server says the count is not available (D-27). */
export interface VisitorTotals {
  uniqueVisitors: number | null;
  visits: number | null;
  pageViews: number;
  /** The business day the counts start from when the range crosses the 13-month line; otherwise null. */
  countedFrom: string | null;
}

/** The answer once the browser has checked it: the range the server read and its totals. */
export interface VisitorStats {
  range: string;
  from: string;
  to: string;
  cutDate: string;
  totals: VisitorTotals;
}

/** A stats answer the browser cannot show, so the page shows its failure instead of a wrong figure. */
export class VisitorStatsContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisitorStatsContractError';
  }
}

function count(value: unknown, what: string): number {
  return requireFigure(value, what, (message) => new VisitorStatsContractError(message));
}

function optionalCount(value: unknown, what: string): number | null {
  return value === null ? null : count(value, what);
}

/** Narrows a stats answer: a count that is not a plain number refuses the whole answer. */
export function parseVisitorStats(response: VisitorStatsResponse): VisitorStats {
  const { totals } = response;
  return {
    range: response.range,
    from: response.from,
    to: response.to,
    cutDate: response.cutDate,
    totals: {
      uniqueVisitors: optionalCount(totals.uniqueVisitors, 'unique visitor count'),
      visits: optionalCount(totals.visits, 'visit count'),
      pageViews: count(totals.pageViews, 'page view count'),
      countedFrom: totals.countedFrom,
    },
  };
}

export interface VisitorStatsService {
  /** `GET /api/v1/visitor-stats`: the totals of a range. 400 field errors on `from` and `to` for a custom range. */
  get(query: VisitorStatsQuery, signal?: AbortSignal): Promise<VisitorStats>;
}

export function createVisitorStatsService(client: HttpClient): VisitorStatsService {
  return {
    get: async (query, signal) =>
      parseVisitorStats(
        await client.get<VisitorStatsResponse>('/visitor-stats', {
          params: { range: query.range, from: query.from, to: query.to },
          signal,
        }),
      ),
  };
}

export const visitorStatsService: VisitorStatsService = createVisitorStatsService(apiClient);
