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
  /** Up to 5 pages by page views, highest first; each name is a page key. */
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
    pageViews: count(response.pageViews, 'page view count'),
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
  /** `GET /api/v1/visitor-stats/export`: one CSV row per day and page with views, saved under the server's file name (D-69). */
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
      // The server names the file from the dates it resolved, which the page cannot know for a preset.
      const seen: { name: string | undefined } = { name: undefined };
      const eject = client.interceptors.response.use((response) => {
        seen.name ??= serverFileName(response.headers.get('Content-Disposition'));
        return response;
      });
      let body: string;
      try {
        body = await client.get<string>('/visitor-stats/export', {
          params: { range: query.range, from: query.from, to: query.to },
          signal,
          responseType: 'text',
        });
      } finally {
        eject();
      }
      // fetch drops the byte-order mark; another transport may not, and downloadCsv adds it back.
      const text = body.replace(/^\uFEFF/, '');
      return { text: checkedCsv(text), fileName: requireFileName(seen.name) };
    },
  };
}

const CSV_HEADER = 'Date,Page,Page views';
const CSV_ROW = /^\d{4}-\d{2}-\d{2},[^,"\r\n]+,\d+$/;
const MONTH_DAY = '(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
const CSV_NAME = new RegExp(`filename="(visitor-stats-\\d{4}-${MONTH_DAY}-to-\\d{4}-${MONTH_DAY}\\.csv)"`);

/** The file name in a Content-Disposition header, only when it is the server's own `visitor-stats-{from}-to-{to}.csv`. */
function serverFileName(disposition: string | null): string | undefined {
  return disposition === null ? undefined : CSV_NAME.exec(disposition)?.[1];
}

function requireFileName(name: string | undefined): string {
  if (name === undefined) throw new VisitorStatsContractError('The CSV file has no name the page knows.');
  return name;
}

/** The text when it is the three column header and day rows, or the header alone for a range with no views. */
function checkedCsv(text: string): string {
  const [header, ...rows] = text.split('\r\n').filter((line) => line !== '');
  if (header !== CSV_HEADER || !rows.every((row) => CSV_ROW.test(row))) {
    throw new VisitorStatsContractError('The CSV file is not one the page knows.');
  }
  return text;
}

export const visitorStatsService: VisitorStatsService = createVisitorStatsService(apiClient);
