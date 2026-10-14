// IncomeExpenseChart (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4 and §8.3), converted to utilities (D-33) with the
// App. D.3 props, geometry and copy: hand-rolled SVG (no chart package), a 640-wide view box, grouped income and expense
// bars per month with 4px rounded tops, three gridlines with "₱{n}k" ticks up to the largest figure rounded up to one
// significant digit, the legend, and a tooltip (month, income, expenses, net) over the hovered month. The looks are in
// data.recipe.ts. Figures are only formatted (formatPeso); the net is App. D.3's income − expenses for display.
// SPEC-DEVIATION: D-33 strict CSP: the tooltip's position goes through the `--tip-x` custom property, read by
// `left-(--tip-x)`, instead of an inline `left` (UI-SPEC "Inline style rule"); the value is the same percentage.
// SPEC-DEVIATION: A11Y-01 (WCAG 2.1.1, 1.1.1, 1.4.13) every month group is keyboard-reachable: it takes focus
// (tabIndex 0), is an image named "{month}: income ₱…, expenses ₱…", shows the tooltip on focus as on hover, hides it on
// blur, and Escape dismisses it. The drawing is therefore a named group, not one image (an image's children are hidden
// from assistive technology). `ChartDatum.label` (an added prop, spec §0 rule 3) names the month in full, for example
// "Oct 2026"; without it the short month is used. Attributes and handlers only; the look at rest is unchanged.
import { useState, type KeyboardEvent } from 'react';
import { formatPeso } from '@/lib/csps';
import {
  chartAxisClasses,
  chartBarClasses,
  chartClasses,
  chartGridClasses,
  chartHoverClasses,
  chartKeyClasses,
  chartLegendClasses,
  chartNetClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTickClasses,
  chartTipClasses,
} from './data.recipe';

/** Monthly income vs expenses: one bar group per month. */
export interface ChartDatum {
  /** The short month under the bars, for example "Oct". */
  month: string;
  income: number;
  expenses: number;
  /** The month in full for assistive technology, for example "Oct 2026" (defaults to `month`). */
  label?: string | undefined;
}

export interface IncomeExpenseChartProps {
  data: ChartDatum[];
  /** The view box height (default 220). */
  height?: number | undefined;
}

/** The view box width and the plot's left, bottom and top margins (App. D.3). */
const W = 640;
const L = 52;
const B = 28;
const T = 12;

/** The three gridline fractions of the axis top. */
const TICK_FRACTIONS = [0, 0.5, 1] as const;

/** A tick label: "₱{n}k" from ₱1,000, else the plain figure (App. D.3). */
function tick(value: number): string {
  return value >= 1000 ? `₱${String(Math.round(value / 1000))}k` : `₱${String(value)}`;
}

/** A bar with 4px rounded top corners as an SVG path (App. D.3 `bar`); no bar for a zero or negative height. */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${String(x)},${String(y + h)}V${String(y + r)}Q${String(x)},${String(y)} ${String(x + r)},${String(y)}H${String(x + w - r)}Q${String(x + w)},${String(y)} ${String(x + w)},${String(y + r)}V${String(y + h)}Z`;
}

/** The accessible name of one month group. */
function monthName(datum: ChartDatum): string {
  return `${datum.label ?? datum.month}: income ${formatPeso(datum.income)}, expenses ${formatPeso(datum.expenses)}`;
}

export function IncomeExpenseChart({ data, height = 220 }: IncomeExpenseChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const H = height;
  const gw = (W - L) / Math.max(1, data.length);
  const bw = Math.min(18, gw / 3.2);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = TICK_FRACTIONS.map((f) => top * f);
  const cur = hover === null ? undefined : data[hover];
  const dismiss = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setHover(null);
  };
  return (
    <figure className={chartClasses}>
      <div className={chartLegendClasses}>
        <span className={chartKeyClasses}>
          <i className={chartSwatchClasses.income} />
          Income (payments)
        </span>
        <span className={chartKeyClasses}>
          <i className={chartSwatchClasses.expense} />
          Expenses (company + orders)
        </span>
      </div>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className={chartSvgClasses}
        role="group"
        aria-label="Monthly income versus expenses"
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={L} x2={W} y1={y(tv)} y2={y(tv)} className={chartGridClasses} />
            <text x={L - 8} y={y(tv) + 4} textAnchor="end" className={chartTickClasses}>
              {tick(tv)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx0 = L + gw * i + gw / 2;
          return (
            <g
              // SPEC-DEVIATION: UI-WR-13 App. D.3 keys on the short month ("Oct"), which repeats in a series longer
              // than 12 months or one that crosses a year; the bars are positional, so the key is the position.
              key={`${String(i)}-${d.label ?? d.month}`}
              role="img"
              aria-label={monthName(d)}
              tabIndex={0}
              onMouseEnter={() => {
                setHover(i);
              }}
              onFocus={() => {
                setHover(i);
              }}
              onBlur={() => {
                setHover(null);
              }}
              onKeyDown={dismiss}
            >
              <rect x={L + gw * i} y={T} width={gw} height={H - T - B} fill="transparent" />
              {hover === i && (
                <rect x={L + gw * i + 4} y={T} width={gw - 8} height={H - T - B} className={chartHoverClasses} rx="6" />
              )}
              <path d={bar(cx0 - bw - 1, y(d.income), bw, H - B - y(d.income))} className={chartBarClasses.income} />
              <path d={bar(cx0 + 1, y(d.expenses), bw, H - B - y(d.expenses))} className={chartBarClasses.expense} />
              <text x={cx0} y={H - 8} textAnchor="middle" className={chartTickClasses}>
                {d.month}
              </text>
            </g>
          );
        })}
        <line x1={L} x2={W} y1={H - B} y2={H - B} className={chartAxisClasses} />
      </svg>
      {cur !== undefined && hover !== null && (
        <div className={chartTipClasses} style={{ '--tip-x': `${String(((L + gw * hover + gw / 2) / W) * 100)}%` }}>
          <strong>{cur.month}</strong>
          <span className={chartKeyClasses}>
            <i className={chartSwatchClasses.income} />
            Income {formatPeso(cur.income)}
          </span>
          <span className={chartKeyClasses}>
            <i className={chartSwatchClasses.expense} />
            Expenses {formatPeso(cur.expenses)}
          </span>
          <span className={chartNetClasses}>Net {formatPeso(cur.income - cur.expenses)}</span>
        </div>
      )}
    </figure>
  );
}
