// SPEC-GAP: VisitorTrendChart (UI-SPEC V1 item 4; ANL-08). Hand-rolled SVG on the IncomeExpenseChart geometry and the
// data.recipe.ts looks: one page-view bar per bucket with 4px rounded tops, the unique-visitor line with its surface halo
// and points over the bars, three gridlines with count ticks, and a label under each bucket. Every figure is the
// server's; the chart only draws and formats it. The view box is as wide as the frame (fitWidth, D-51), 220 high.
import { useEffect, useRef, useState } from 'react';
import { formatCalendarDate, formatCount } from '@/utils/format';
import { VISITOR_TREND_COPY } from './copy';
import {
  chartBarClasses,
  chartClasses,
  chartGridClasses,
  chartKeyClasses,
  chartLegendClasses,
  chartProfitGroupClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTickClasses,
  chartVisitorHaloClasses,
  chartVisitorLineClasses,
  chartVisitorPointClasses,
  chartVisitorSwatchClasses,
} from './data.recipe';

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

const COPY = VISITOR_TREND_COPY;

/** The view box width until the frame is measured, and the plot's left, bottom and top margins (App. D.3). */
const FALLBACK_WIDTH = 640;
const L = 52;
const B = 28;
const T = 12;

/** The three gridline fractions of the axis top. */
const TICK_FRACTIONS = [0, 0.5, 1] as const;

const POINT_RADIUS = 3.5;

const YEAR_SUFFIX = /, \d{4}$/;

/** A bar with 4px rounded top corners as an SVG path (App. D.3 `bar`); no bar for a zero height. */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${String(x)},${String(y + h)}V${String(y + r)}Q${String(x)},${String(y)} ${String(x + r)},${String(y)}H${String(x + w - r)}Q${String(x + w)},${String(y)} ${String(x + w)},${String(y + r)}V${String(y + h)}Z`;
}

/**
 * The axis top: the largest figure rounded up to one significant digit. Counts are whole, so a top under 10 is even and the
 * middle tick stays a whole count.
 */
function axisTop(max: number): number {
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  return top < 10 && top % 2 === 1 ? top + 1 : top;
}

/** "Nov 3": the bucket's label under its bar. */
function shortLabel(start: string): string {
  return formatCalendarDate(start)?.replace(YEAR_SUFFIX, '') ?? start;
}

/** "Oct 17 to Nov 15, 2026": the first day drops its year when both days are in the same year. */
function rangeName(from: string, to: string): string {
  const first = formatCalendarDate(from) ?? from;
  const last = formatCalendarDate(to) ?? to;
  return COPY.groupName(from.slice(0, 4) === to.slice(0, 4) ? first.replace(YEAR_SUFFIX, '') : first, last);
}

export function VisitorTrendChart({ buckets, from, to, height = 220 }: VisitorTrendChartProps) {
  const [measured, setMeasured] = useState<number | null>(null);
  const frame = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = frame.current;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setMeasured(width);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  const W = measured ?? FALLBACK_WIDTH;
  const H = height;
  const top = axisTop(Math.max(1, ...buckets.map((b) => Math.max(b.pageViews, b.uniqueVisitors ?? 0))));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const gw = (W - L) / Math.max(1, buckets.length);
  const bw = Math.min(18, gw * 0.6);
  const cx = (i: number) => L + gw * i + gw / 2;
  const points = buckets.flatMap((b, i) =>
    b.uniqueVisitors === null ? [] : [{ key: b.start, x: cx(i), y: y(b.uniqueVisitors) }],
  );
  const linePath = points.length === 0 ? '' : `M${points.map((p) => `${String(p.x)},${String(p.y)}`).join('L')}`;
  return (
    <figure ref={frame} className={chartClasses}>
      <div className={chartLegendClasses}>
        <span className={chartKeyClasses}>
          <i className={chartSwatchClasses.income} />
          {COPY.pageViews}
        </span>
        <span className={chartKeyClasses}>
          <i className={chartVisitorSwatchClasses} />
          {COPY.uniqueVisitors}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className={chartSvgClasses}
        role="group"
        aria-label={rangeName(from, to)}
      >
        {TICK_FRACTIONS.map((f) => top * f).map((tv) => (
          <g key={tv}>
            <line x1={L} x2={W} y1={y(tv)} y2={y(tv)} className={chartGridClasses} />
            <text x={L - 8} y={y(tv) + 4} textAnchor="end" className={chartTickClasses}>
              {formatCount(tv)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <g key={b.start} data-bucket={b.start}>
            <path
              d={bar(cx(i) - bw / 2, y(b.pageViews), bw, y(0) - y(b.pageViews))}
              className={chartBarClasses.income}
            />
            <text x={cx(i)} y={H - 8} textAnchor="middle" className={chartTickClasses}>
              {shortLabel(b.start)}
            </text>
          </g>
        ))}
        <g aria-hidden="true" className={chartProfitGroupClasses}>
          <path d={linePath} className={chartVisitorHaloClasses} />
          <path d={linePath} className={chartVisitorLineClasses} />
          {points.map((p) => (
            <circle key={p.key} cx={p.x} cy={p.y} r={POINT_RADIUS} className={chartVisitorPointClasses} />
          ))}
        </g>
      </svg>
    </figure>
  );
}
