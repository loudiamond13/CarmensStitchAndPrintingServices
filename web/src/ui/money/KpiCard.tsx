// KpiCard (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4 and §8.3), converted to utilities (D-33) with the App. D.3
// props and markup: the card with the overline label and the 32px icon tile, the display value (formatPeso for money,
// as given otherwise), then the foot with the delta chip (trending-up green / trending-down red, the size of the change
// in %) and the delta label or hint. While `loading`, the card is busy and shows a 70% × 36 skeleton instead of the
// value and the foot. The looks are in money.recipe.ts. The figures come from the caller; KpiCard only formats.
//
// A zero figure keeps the normal value look: App. D.3 has no zero state, and D-02 allows no opacity on text.
import clsx from 'clsx';
import { formatPeso } from '@/lib/csps';
import { Icon, type IconName } from '@/ui/brand';
import { Skeleton } from '@/ui/feedback';
import {
  deltaClasses,
  deltaToneClasses,
  kpiClasses,
  kpiFootClasses,
  kpiHeadClasses,
  kpiIconClasses,
  kpiValueClasses,
  overlineClasses,
  type DeltaDirection,
} from './money.recipe';

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
}

export function KpiCard({ label, value, money = true, icon, delta, deltaLabel, hint, loading = false }: KpiCardProps) {
  const up = delta !== undefined && delta >= 0;
  const direction: DeltaDirection = up ? 'up' : 'down';
  // As App. D.3's `deltaLabel || hint`: an empty delta label falls back to the hint.
  const footText = deltaLabel !== undefined && deltaLabel !== '' ? deltaLabel : hint;
  const hasFoot = delta !== undefined || (hint !== undefined && hint !== '');
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
        <div className={kpiValueClasses}>{money && typeof value === 'number' ? formatPeso(value) : value}</div>
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
