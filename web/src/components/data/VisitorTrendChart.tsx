// SPEC-GAP: VisitorTrendChart (UI-SPEC V1 item 4). Not built yet.

/** One bar of the trend, as the server sent it. */
export interface TrendPoint {
  /** The first business day of the bar, `YYYY-MM-DD`. */
  start: string;
  pageViews: number;
  /** Null where the server has no unique visitors for the bar (over 13 months ago). */
  uniqueVisitors: number | null;
}

/** The bar size the server chose. */
export type TrendBucketSize = 'day' | 'month';

export interface VisitorTrendChartProps {
  buckets: readonly TrendPoint[];
  bucket: TrendBucketSize;
  /** The range the server read, `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** The view box height (default 220). */
  height?: number | undefined;
}

export function VisitorTrendChart(props: VisitorTrendChartProps) {
  return <figure data-buckets={props.buckets.length} />;
}
