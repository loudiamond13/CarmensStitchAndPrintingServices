// SPEC-GAP: VisitorTrendChart (UI-SPEC V1 item 4; ANL-08, D-68). Hand-rolled SVG on the IncomeExpenseChart geometry and the
// data.recipe.ts looks: one page-view bar per bucket with 4px rounded tops, three gridlines with count ticks, and a label
// under each bucket. Every figure is the server's; the chart only draws and formats it. The view box is as wide as the frame
// (fitWidth, D-51), 220 high.
// SPEC-DEVIATION: D-51 a group under 28px gets every other label, as IncomeExpenseChart; a day label ("Nov 15") is wider than
// a month, so day labels keep every nth one, counting back from the last, so that two labels are at least 44px apart. When month
// bars span two calendar years, the first drawn label and each drawn label that starts a new year carry the year ("Jan 2026"),
// and those month labels get 56px of room, the width of "Dec 2025" plus a gap.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { formatCalendarDate, formatCount, formatMonthShort, formatRangeText } from '@/utils/format';
import { VISITOR_TREND_COPY } from './copy';
import {
  chartBarClasses,
  chartClasses,
  chartGridClasses,
  chartHoverClasses,
  chartKeyClasses,
  chartLegendClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTickClasses,
  chartTipClasses,
} from './data.recipe';

/** One bar of the trend, as the server sent it. */
export interface TrendPoint {
  /** The first business day of the bar, `YYYY-MM-DD`. */
  start: string;
  pageViews: number;
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

/** A bucket narrower than this (px) gets every other label (D-51); a day label needs the wider room. */
const MIN_LABEL_GROUP = 28;
const MIN_DAY_LABEL_GROUP = 44;
const MIN_YEAR_LABEL_GROUP = 56;

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

/** "Nov 3", "Oct" or, with the year, "Jan 2026": the bucket's label under its bar. */
function shortLabel(start: string, bucket: TrendBucketSize, withYear: boolean): string {
  const label = bucket === 'day' ? formatCalendarDate(start)?.replace(YEAR_SUFFIX, '') : formatMonthShort(start);
  if (label === undefined || label === null) return start;
  return withYear ? `${label} ${start.slice(0, 4)}` : label;
}

/** Every how many buckets a label is drawn: every one when there is room, else enough that labels never overlap. */
function labelStep(gw: number, bucket: TrendBucketSize, wideLabels: boolean): number {
  const room = bucket === 'day' ? MIN_DAY_LABEL_GROUP : wideLabels ? MIN_YEAR_LABEL_GROUP : MIN_LABEL_GROUP;
  if (gw >= room) return 1;
  return Math.max(2, Math.ceil(room / gw));
}

/** The bars whose drawn label carries the year: the first drawn one and each that starts a new year. */
function yearMarks(buckets: readonly TrendPoint[], step: number, show: boolean): ReadonlySet<number> {
  const marks = new Set<number>();
  if (!show) return marks;
  let previous = '';
  buckets.forEach((b, i) => {
    if ((buckets.length - 1 - i) % step !== 0) return;
    const year = b.start.slice(0, 4);
    if (year !== previous) marks.add(i);
    previous = year;
  });
  return marks;
}

/** "Nov 3, 2026" or "Oct 2026": the bucket in full, for the tooltip and the announcement. */
function fullDate(start: string, bucket: TrendBucketSize): string {
  const label = bucket === 'day' ? formatCalendarDate(start) : formatMonthShort(start);
  if (label === null) return start;
  return bucket === 'day' ? label : `${label} ${start.slice(0, 4)}`;
}

/** The tooltip rows of a bucket; the announcement reads the same rows. */
function tipLines(point: TrendPoint, bucket: TrendBucketSize): [string, string] {
  return [fullDate(point.start, bucket), `${COPY.pageViews} ${formatCount(point.pageViews)}`];
}

/** Where the tooltip came from: none, the pointer, or focus and the keys (only the keys are announced). */
type TipSource = 'none' | 'pointer' | 'keys';

export function VisitorTrendChart({ buckets, bucket, from, to, height = 220 }: VisitorTrendChartProps) {
  const [active, setActive] = useState(0);
  const [tip, setTip] = useState<TipSource>('none');
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
  const top = axisTop(Math.max(1, ...buckets.map((b) => b.pageViews)));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const gw = (W - L) / Math.max(1, buckets.length);
  const bw = Math.min(18, gw * 0.6);
  const cx = (i: number) => L + gw * i + gw / 2;
  const showYear = bucket === 'month' && from.slice(0, 4) !== to.slice(0, 4);
  const step = labelStep(gw, bucket, showYear);
  const years = yearMarks(buckets, step, showYear);
  const last = buckets.length - 1;
  const current = Math.min(active, Math.max(0, last));
  const cur = tip === 'none' ? undefined : buckets[current];
  const lines = cur === undefined ? null : tipLines(cur, bucket);
  // SPEC-DEVIATION: A11Y-CHART (WCAG 2.1.1, 2.4.3) the plot is one tab stop: Left and Right move between buckets, Home and End
  // jump to the ends, the tooltip follows focus, Escape hides it, and a polite live text reads the tooltip rows.
  const onKeyDown = (event: KeyboardEvent) => {
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (event.key === 'Escape') {
      setTip('none');
    } else if (next !== null) {
      event.preventDefault();
      setActive(Math.min(Math.max(next, 0), Math.max(0, last)));
      setTip('keys');
    }
  };
  return (
    <figure ref={frame} className={chartClasses}>
      <div className={chartLegendClasses}>
        <span className={chartKeyClasses}>
          <i className={chartSwatchClasses.income} />
          {COPY.pageViews}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className={chartSvgClasses}
        role="group"
        aria-label={COPY.groupName(formatRangeText(from, to) ?? `${from} to ${to}`)}
        tabIndex={0}
        onFocus={() => {
          setTip('keys');
        }}
        onBlur={() => {
          setTip('none');
        }}
        onKeyDown={onKeyDown}
        onMouseLeave={() => {
          setTip((source) => (source === 'pointer' ? 'none' : source));
        }}
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
          <g
            key={b.start}
            data-bucket={b.start}
            onMouseEnter={() => {
              setActive(i);
              setTip((source) => (source === 'keys' ? 'keys' : 'pointer'));
            }}
          >
            <rect x={L + gw * i} y={T} width={gw} height={H - T - B} fill="transparent" />
            {cur !== undefined && current === i && (
              <rect
                x={L + gw * i + 1}
                y={T}
                width={Math.max(0, gw - 2)}
                height={H - T - B}
                className={chartHoverClasses}
                rx="6"
              />
            )}
            <path
              d={bar(cx(i) - bw / 2, y(b.pageViews), bw, y(0) - y(b.pageViews))}
              className={chartBarClasses.income}
            />
            {(buckets.length - 1 - i) % step === 0 && (
              <text x={cx(i)} y={H - 8} textAnchor="middle" className={chartTickClasses}>
                {shortLabel(b.start, bucket, years.has(i))}
              </text>
            )}
          </g>
        ))}
      </svg>
      {lines !== null && (
        <div
          className={chartTipClasses}
          aria-hidden="true"
          style={{ '--tip-x': `${String((cx(current) / W) * 100)}%` }}
        >
          <strong>{lines[0]}</strong>
          <span className={chartKeyClasses}>
            <i className={chartSwatchClasses.income} />
            {lines[1]}
          </span>
        </div>
      )}
      <p className={srOnlyClasses} aria-live="polite">
        {tip === 'keys' && lines !== null ? lines.join(', ') : ''}
      </p>
    </figure>
  );
}
