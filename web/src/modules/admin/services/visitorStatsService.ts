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

/** Google's rating of a speed figure (D-26), worked out on the server. */
export type VitalRatingName = 'good' | 'needs-work' | 'poor';

/** One Core Web Vital: the server's nearest-rank 75th percentile, its rating and the samples behind it. */
export interface Vital {
  /** Milliseconds for loading speed and tap response; a score for layout shifting. */
  p75: number;
  rating: VitalRatingName;
  samples: number;
}

/** Page speed of the range; a measure with no sample is null. */
export interface PageSpeed {
  lcp: Vital | null;
  cls: Vital | null;
  inp: Vital | null;
  /** The page views the figures come from. */
  pageViews: number;
  /** False when the whole range is older than 13 months, so no sample can exist (D-27). */
  available: boolean;
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
  speed: PageSpeed;
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

function vitalRating(value: string): VitalRatingName {
  if (value === 'good' || value === 'needs-work' || value === 'poor') return value;
  throw new VisitorStatsContractError(`The speed rating "${value}" is not one the page knows.`);
}

function vital(item: VisitorStatsResponse['speed']['lcp'], what: string): Vital | null {
  if (item === null) return null;
  return {
    p75: count(item.p75, `${what} figure`),
    rating: vitalRating(item.rating),
    samples: count(item.samples, `${what} sample count`),
  };
}

function pageSpeed(speed: VisitorStatsResponse['speed']): PageSpeed {
  return {
    lcp: vital(speed.lcp, 'loading speed'),
    cls: vital(speed.cls, 'layout shifting'),
    inp: vital(speed.inp, 'tap response'),
    pageViews: count(speed.pageViews, 'speed page view count'),
    available: speed.available,
  };
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
    speed: pageSpeed(response.speed),
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
