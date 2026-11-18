// Visitor stats calls (ANL-08, D-24, D-27, D-33; OR-5). Manager only: an Admin gets 403. Every count is the server's; the
// browser only checks that each one is a number it can show.
import type { TrendBucketSize, TrendPoint } from '@/components';
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

/** One row of a ranked list: the name as the server stored it, its count and the server's whole-percent share. */
export interface RankedItem {
  name: string;
  count: number;
  share: number;
}

/** The answer once the browser has checked it: the range the server read and its totals. */
export interface VisitorStats {
  range: string;
  from: string;
  to: string;
  cutDate: string;
  totals: VisitorTotals;
  /** The bar size the server chose: per day up to 62 days, else per month. */
  bucket: TrendBucketSize;
  /** One bar per day or month from the start of the range to its end, oldest first. */
  trend: TrendPoint[];
  /** Up to 10 pages by page views, highest first; each name is a page key. */
  topPages: RankedItem[];
  /** Up to 10 sources by visits, highest first, named as the server stored them (D-28). */
  referrers: RankedItem[];
  /** The device classes with visits, highest first. */
  devices: RankedItem[];
  /** The top 5 browsers, then "Other" for the rest. */
  browsers: RankedItem[];
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

function bucketSize(value: string): TrendBucketSize {
  if (value === 'day' || value === 'month') return value;
  throw new VisitorStatsContractError(`The bucket size "${value}" is not one the page knows.`);
}

function trendPoint(item: VisitorStatsResponse['trend'][number]): TrendPoint {
  return {
    start: item.start,
    pageViews: count(item.pageViews, 'trend page view count'),
    uniqueVisitors: optionalCount(item.uniqueVisitors, 'trend unique visitor count'),
  };
}

function rankedItem(item: VisitorStatsResponse['topPages'][number], what: string): RankedItem {
  return { name: item.name, count: count(item.count, `${what} count`), share: count(item.share, `${what} share`) };
}

/** Narrows a stats answer: a count that is not a plain number, or a bucket size it does not know, refuses the whole answer. */
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
    bucket: bucketSize(response.bucket),
    trend: response.trend.map(trendPoint),
    topPages: response.topPages.map((item) => rankedItem(item, 'page')),
    referrers: response.referrers.map((item) => rankedItem(item, 'source')),
    devices: response.devices.map((item) => rankedItem(item, 'device')),
    browsers: response.browsers.map((item) => rankedItem(item, 'browser')),
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
