// Visitor Stats group (UI-SPEC "Component Showcase additions"; ANL-08, D-57; plan 12-29). Every scenario here has group
// 'visitor-stats', is shown in both themes at rest, and is SPEC-GAP (parity false: the frozen design has none of these parts).
// The figures are made up and follow the server's answer shapes:
//   - VisitorTrendChart with 30 day bars and 12 month bars, page views only;
//   - StatBarList with no rows, one row and ten rows (count and share as the server sends them);
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
  return { start: dayAfter('2026-10-17', index), pageViews };
});

/** Twelve month bars, Dec 2025 to Nov 2026. */
const MONTHS_12: readonly ScenarioProps[] = Array.from({ length: 12 }, (_, index) => {
  const pageViews = demoViews(index, 900);
  return { start: monthAfter('2025-12-01', index), pageViews };
});

/** The made-up ranked rows, largest first, with the server's whole-number shares. */
const RANKED_ROWS: readonly ScenarioProps[] = [
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
  statsCase('stat-bar-list-empty', node('StatBarList', { items: [], emptyText: LIST_EMPTY })),
  statsCase(
    'stat-bar-list-one',
    node('StatBarList', { items: [{ name: 'facebook.com', count: 1, share: 100 }], emptyText: LIST_EMPTY }),
  ),
  statsCase('stat-bar-list-ten', node('StatBarList', { items: RANKED_ROWS, emptyText: LIST_EMPTY })),
  statsCase('visitor-stats-no-visits', node('StatsNoVisits')),
  statsCase(
    'visitor-stats-load-error',
    node('StatsLoadError', { traceId: '00-7d2a51c9e04b4f3a8b6c1e9f0a3d5b72-01' }),
    HANDLERS_RETRY,
  ),
  statsCase('visitor-stats-stale', node('StatsStaleLine', { time: '9:41 AM' }), HANDLERS_RETRY),
];
