// KpiCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4 and §8.3), converted to utilities (D-33) with the App. D.3
// props and markup: the card with the overline label and the 32px icon tile, the display value (formatPeso for money,
// as given otherwise), then the foot with the delta chip (trending-up green / trending-down red, the size of the change
// in %) and the delta label or hint. While `loading`, the card is busy and shows a 70% × 36 skeleton instead of the
// value and the foot. The looks are in money.recipe.ts. The figures come from the caller; KpiCard only formats.
//
// D-39 (owner ruling, 2026-10-08): a figure that reads as zero is dimmed by colour only. Its value takes `--ink-subtle`,
// as D-02 dims the `.is-zero` cascade tiles; the label, the icon tile and the foot keep their looks, and no opacity is
// used (D-02). Zero is a number the card shows as zero: a money figure that rounds to 0 centavos ("₱0.00", D-09) or a
// count of exactly 0. A text value is shown as given and never dimmed. App. D.3 has no zero state.
import clsx from 'clsx';
import { formatPeso, round2 } from '@/utils/csps';
import { Icon, type IconName } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import { EmptyValue } from '@/components/states';
import {
  deltaClasses,
  deltaToneClasses,
  kpiClasses,
  kpiFootClasses,
  kpiHeadClasses,
  kpiIconClasses,
  kpiLongValueClasses,
  kpiTextValueClasses,
  kpiValueClasses,
  kpiZeroValueClasses,
  overlineClasses,
  type DeltaDirection,
} from './money.recipe';

/** A money figure this long (₱100,000,000.00 and up) takes the smaller clamp so it stays inside the card. */
const LONG_FIGURE = 15;

export interface KpiCardProps {
  label: string;
  value: number | string;
  /** True (the default): a number value is written as pesos. False: a count, shown as it is. */
  money?: boolean | undefined;
  icon?: IconName | undefined;
  /** The change in percent; 0 or more is a rise. */
  delta?: number | undefined;
  deltaLabel?: string | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
  // SPEC-GAP: KpiCard empty. No figure to show (OR-4 replaces the mockup's long dash): the value slot is EmptyValue in the
  // dimmed zero look and `value` is ignored.
  empty?: boolean | undefined;
}

export function KpiCard({
  label,
  value,
  money = true,
  icon,
  delta,
  deltaLabel,
  hint,
  loading = false,
  empty = false,
}: KpiCardProps) {
  const up = delta !== undefined && delta >= 0;
  const direction: DeltaDirection = up ? 'up' : 'down';
  // As App. D.3's `deltaLabel || hint`: an empty delta label falls back to the hint.
  const footText = deltaLabel !== undefined && deltaLabel !== '' ? deltaLabel : hint;
  const hasFoot = delta !== undefined || (hint !== undefined && hint !== '');
  const zero = typeof value === 'number' && (money ? round2(value) === 0 : value === 0);
  const figure = money && typeof value === 'number' ? formatPeso(value) : value;
  const valueClasses =
    typeof value === 'string' && !empty
      ? kpiTextValueClasses
      : !empty && money && typeof figure === 'string' && figure.length >= LONG_FIGURE
        ? kpiLongValueClasses
        : kpiValueClasses;
  return (
    <div className={kpiClasses} aria-busy={loading || undefined}>
      <div className={kpiHeadClasses}>
        <span className={overlineClasses}>{label}</span>
        {icon !== undefined && (
          <span className={kpiIconClasses}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton width="70%" height={36} />
      ) : (
        <div className={clsx(valueClasses, (zero || empty) && kpiZeroValueClasses)}>
          {empty ? <EmptyValue /> : figure}
        </div>
      )}
      {hasFoot && !loading && (
        <div className={kpiFootClasses}>
          {delta !== undefined && (
            <span className={clsx(deltaClasses, deltaToneClasses[direction])}>
              {/* SPEC-DEVIATION: A11Y-01 (WCAG 1.1.1 and 1.4.1). App. D.3 shows the direction only by the icon and
                  the colour, and its icon is hidden, so a screen reader heard "12%" for a rise and a fall alike. The
                  icon is named "Up" or "Down" (role img, as for any named Icon); the look is unchanged. */}
              <Icon name={up ? 'trending-up' : 'trending-down'} size={14} label={up ? 'Up' : 'Down'} />
              {/* Two text nodes, the number and "%", as App. D.3 renders them: one joined string is shaped as one run
                  and comes out 0.02px narrower in Chromium (the first parity run showed it). */}
              {Math.abs(delta)}%
            </span>
          )}
          <span>{footText}</span>
        </div>
      )}
    </div>
  );
}
