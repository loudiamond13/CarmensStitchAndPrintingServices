// Visitor Stats group (UI-SPEC "Component Showcase additions"; ANL-08; plan 12-29). Every scenario here has group
// 'visitor-stats', is shown in both themes at rest, and is SPEC-GAP (parity false: the frozen design has none of these parts).
// The figures are made up and follow the server's answer shapes (12-25 trend, 12-26 lists, 12-27 speed):
//   - VisitorTrendChart with 30 day bars, 12 month bars, and 18 month bars whose unique visitor line stops before the
//     13-month cut (Oct 15, 2025): no point and no zero where the server sends null;
//   - the 13-month Note and the two KPI states of an old range: a count "Counted from" the cut, and "Not available";
//   - StatBarList with no rows, one row and ten rows (count and share as the server sends them);
//   - PageSpeedCard with Good, Needs work and Poor, with no layout shift score (iPhones send none: "Not measured"), with
//     no samples at all, and for a range wholly over 13 months ago;
//   - the page states: no visits, a failed first read and a failed later refresh.
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

function node(component: string, props: ScenarioProps = {}): ScenarioNode {
  return { kind: 'node', component, props };
}

function statsCase(id: string, caseNode: ScenarioNode, handlers?: readonly string[]): Scenario {
  return {
    id,
    group: 'visitor-stats',
    node: caseNode,
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: false,
    ...(handlers === undefined ? {} : { handlers }),
  };
}

/** `YYYY-MM-DD` of the day `offset` days after `start`. */
function dayAfter(start: string, offset: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-01` of the month `offset` months after the month of `start`. */
function monthAfter(start: string, offset: number): string {
  const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

/** A made-up count that rises and falls so the bars differ. */
function demoViews(index: number, base: number): number {
  return base + ((index * 37) % 23) * Math.round(base / 20);
}

/** Thirty day bars, Oct 17 to Nov 15, 2026. */
const DAYS_30: readonly ScenarioProps[] = Array.from({ length: 30 }, (_, index) => {
  const pageViews = demoViews(index, 40);
  return { start: dayAfter('2026-10-17', index), pageViews, uniqueVisitors: Math.round(pageViews * 0.45) };
});

/** Twelve month bars, Dec 2025 to Nov 2026. */
const MONTHS_12: readonly ScenarioProps[] = Array.from({ length: 12 }, (_, index) => {
  const pageViews = demoViews(index, 900);
  return { start: monthAfter('2025-12-01', index), pageViews, uniqueVisitors: Math.round(pageViews * 0.4) };
});

/** The 13-month cut of the demo ranges. */
const CUT_DATE = '2025-10-15';

/** Eighteen month bars, Jun 2025 to Nov 2026: the months before the cut have page views but no unique visitors. */
const MONTHS_18: readonly ScenarioProps[] = Array.from({ length: 18 }, (_, index) => {
  const start = monthAfter('2025-06-01', index);
  const pageViews = demoViews(index, 800);
  return { start, pageViews, uniqueVisitors: start < '2025-10-01' ? null : Math.round(pageViews * 0.4) };
});

/** The made-up referrers, largest first, with the server's whole-number shares. */
const REFERRERS: readonly ScenarioProps[] = [
  { name: 'facebook.com', count: 412, share: 38 },
  { name: 'google.com', count: 236, share: 22 },
  { name: 'Direct', count: 151, share: 14 },
  { name: 'm.facebook.com', count: 97, share: 9 },
  { name: 'messenger.com', count: 54, share: 5 },
  { name: 'instagram.com', count: 43, share: 4 },
  { name: 'bing.com', count: 22, share: 2 },
  { name: 'tiktok.com', count: 21, share: 2 },
  { name: 'youtube.com', count: 11, share: 1 },
  { name: 'duckduckgo.com', count: 9, share: 1 },
];

const LIST_EMPTY = 'No visitors allowed visitor stats in these dates.';

/** One measure as the server sends it. */
function vital(p75: number, rating: 'good' | 'needs-work' | 'poor', samples: number): ScenarioProps {
  return { p75, rating, samples };
}

const HANDLERS_RETRY = ['onRetry'] as const;

export const scenarios: readonly Scenario[] = [
  statsCase(
    'visitor-trend-30-days',
    node('VisitorTrendChart', { buckets: DAYS_30, bucket: 'day', from: '2026-10-17', to: '2026-11-15' }),
  ),
  statsCase(
    'visitor-trend-12-months',
    node('VisitorTrendChart', { buckets: MONTHS_12, bucket: 'month', from: '2025-12-01', to: '2026-11-15' }),
  ),
  statsCase(
    'visitor-trend-13-month-gap',
    node('VisitorTrendChart', { buckets: MONTHS_18, bucket: 'month', from: '2025-06-01', to: '2026-11-15' }),
  ),
  statsCase('visitor-stats-cut-note', node('StatsCutNote', { cutDate: CUT_DATE })),
  statsCase(
    'kpi-visitors-counted-from',
    node('KpiCard', {
      label: 'Unique visitors',
      value: 1284,
      money: false,
      icon: 'users',
      hint: 'Counted from Oct 15, 2025 only',
    }),
  ),
  statsCase(
    'kpi-visitors-not-available',
    node('KpiCard', {
      label: 'Unique visitors',
      value: 0,
      money: false,
      icon: 'users',
      empty: true,
      emptyLabel: 'Not available',
      hint: 'Not available for dates over 13 months ago',
    }),
  ),
  statsCase('stat-bar-list-empty', node('StatBarList', { items: [], emptyText: LIST_EMPTY })),
  statsCase(
    'stat-bar-list-one',
    node('StatBarList', { items: [{ name: 'facebook.com', count: 1, share: 100 }], emptyText: LIST_EMPTY }),
  ),
  statsCase('stat-bar-list-ten', node('StatBarList', { items: REFERRERS, emptyText: LIST_EMPTY })),
  statsCase(
    'page-speed-ratings',
    node('PageSpeedCard', {
      speed: {
        lcp: vital(2100, 'good', 412),
        cls: vital(0.18, 'needs-work', 388),
        inp: vital(620, 'poor', 301),
        pageViews: 412,
        available: true,
      },
    }),
  ),
  statsCase(
    'page-speed-no-layout-shift',
    node('PageSpeedCard', {
      speed: { lcp: vital(2400, 'good', 96), cls: null, inp: vital(180, 'good', 74), pageViews: 96, available: true },
    }),
  ),
  statsCase(
    'page-speed-no-data',
    node('PageSpeedCard', { speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: true } }),
  ),
  statsCase(
    'page-speed-over-13-months',
    node('PageSpeedCard', { speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: false } }),
  ),
  statsCase('visitor-stats-no-visits', node('StatsNoVisits')),
  statsCase(
    'visitor-stats-load-error',
    node('StatsLoadError', { traceId: '00-7d2a51c9e04b4f3a8b6c1e9f0a3d5b72-01' }),
    HANDLERS_RETRY,
  ),
  statsCase('visitor-stats-stale', node('StatsStaleLine', { time: '9:41 AM' }), HANDLERS_RETRY),
];
