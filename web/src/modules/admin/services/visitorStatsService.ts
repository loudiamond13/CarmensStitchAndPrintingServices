// Visitor stats calls (ANL-08, D-24, D-57, D-70; OR-5). Manager only: an Admin gets 403. Every count is the server's; the
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

/** One row of a ranked list: the name as the server stored it, its count and the server's whole-percent share. */
export interface RankedItem {
  name: string;
  count: number;
  share: number;
}

/** The answer once the browser has checked it: the range the server read, its page view total, the trend and the top pages. */
export interface VisitorStats {
  range: string;
  from: string;
  to: string;
  pageViews: number;
  /** The bar size the server chose: per day up to 62 days, else per month. */
  bucket: TrendBucketSize;
  /** One bar per day or month from the start of the range to its end, oldest first. */
  trend: TrendPoint[];
  /** Up to 10 pages by page views, highest first; each name is a page key. */
  topPages: RankedItem[];
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

function bucketSize(value: string): TrendBucketSize {
  if (value === 'day' || value === 'month') return value;
  throw new VisitorStatsContractError(`The bucket size "${value}" is not one the page knows.`);
}

function trendPoint(item: VisitorStatsResponse['trend'][number]): TrendPoint {
  return {
    start: item.start,
    pageViews: count(item.pageViews, 'trend page view count'),
  };
}

function rankedItem(item: VisitorStatsResponse['topPages'][number], what: string): RankedItem {
  return { name: item.name, count: count(item.count, `${what} count`), share: count(item.share, `${what} share`) };
}

/** Narrows a stats answer: a count that is not a plain number, or a bucket size it does not know, refuses the whole answer. */
export function parseVisitorStats(response: VisitorStatsResponse): VisitorStats {
  return {
    range: response.range,
    from: response.from,
    to: response.to,
    pageViews: count(response.totals.pageViews, 'page view count'),
    bucket: bucketSize(response.bucket),
    trend: response.trend.map(trendPoint),
    topPages: response.topPages.map((item) => rankedItem(item, 'page')),
  };
}

/** The CSV file of a range and the name to save it under. */
export interface VisitorStatsFile {
  text: string;
  fileName: string;
}

export interface VisitorStatsService {
  /** `GET /api/v1/visitor-stats`: the totals of a range. 400 field errors on `from` and `to` for a custom range. */
  get(query: VisitorStatsQuery, signal?: AbortSignal): Promise<VisitorStats>;
  /** `GET /api/v1/visitor-stats/export`: one CSV row per business day of the range (D-25). */
  exportCsv(query: VisitorStatsQuery, signal?: AbortSignal): Promise<VisitorStatsFile>;
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
    exportCsv: async (query, signal) => {
      const body = await client.get<string>('/visitor-stats/export', {
        params: { range: query.range, from: query.from, to: query.to },
        signal,
        responseType: 'text',
      });
      // fetch drops the byte-order mark; another transport may not, and downloadCsv adds it back.
      const text = body.replace(/^\uFEFF/, '');
      return { text, fileName: csvFileName(text) };
    },
  };
}

const CSV_HEADER = 'Date,Unique visitors,Visits,Page views';
const CSV_DAY = /^\d{4}-\d{2}-\d{2}(?=,)/;

/** The server's own name, from the file's first and last day: `visitor-stats-{from}-to-{to}.csv`. */
function csvFileName(text: string): string {
  const lines = text.split('\r\n').filter((line) => line !== '');
  const [header, first] = lines;
  const from = first === undefined ? undefined : CSV_DAY.exec(first)?.[0];
  const to = CSV_DAY.exec(lines.at(-1) ?? '')?.[0];
  if (header !== CSV_HEADER || from === undefined || to === undefined) {
    throw new VisitorStatsContractError('The CSV file is not one the page knows.');
  }
  return `visitor-stats-${from}-to-${to}.csv`;
}

export const visitorStatsService: VisitorStatsService = createVisitorStatsService(apiClient);
