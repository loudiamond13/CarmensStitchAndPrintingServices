// SPEC-GAP: PageSpeedCard. The Page speed card of Visitor Stats (UI-SPEC V1 item 8; ANL-08, D-26): each Core Web Vital in plain
// words with the server's 75th percentile and rating. The rating shows as a word and an icon, never by colour alone. The browser
// only formats; the visible value is hidden from assistive technology, which reads the spoken form instead.
import { Badge, EmptyValue, SkeletonText, type BadgeTone, type IconName } from '@/components';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import {
  pageSpeedBodyClasses,
  pageSpeedHeadClasses,
  pageSpeedListClasses,
  pageSpeedMutedClasses,
  pageSpeedNameClasses,
  pageSpeedRowClasses,
  pageSpeedValueClasses,
} from '@/modules/admin/components/visitorStats.recipe';
import type { PageSpeed, Vital, VitalRatingName } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { formatCount } from '@/utils/format';

const COPY = VISITOR_STATS_COPY.speed;

const ONE_DECIMAL = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO_DECIMALS = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Rounds up to a step. The server rates the exact value (at or under a limit is the better rating), so a value over a limit must
 * never show as the limit. The small allowance keeps a value that is exact in decimal, such as 0.3, from being pushed up a step.
 */
function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}

const RATING_LOOK: Readonly<Record<VitalRatingName, { tone: BadgeTone; icon: IconName }>> = {
  good: { tone: 'success', icon: 'circle-check' },
  'needs-work': { tone: 'warning', icon: 'triangle-alert' },
  poor: { tone: 'danger', icon: 'circle-x' },
};

interface Measure {
  key: 'lcp' | 'cls' | 'inp';
  name: string;
  meaning: string;
  /** The shown value and its spoken form. */
  format: (p75: number) => { shown: string; spoken: string };
}

const MEASURES: readonly Measure[] = [
  {
    key: 'lcp',
    name: COPY.lcp,
    meaning: COPY.lcpMeaning,
    format: (p75) => {
      const value = ONE_DECIMAL.format(ceilTo(p75, 100) / 1000);
      return { shown: COPY.seconds(value), spoken: COPY.secondsSpoken(value) };
    },
  },
  {
    key: 'cls',
    name: COPY.cls,
    meaning: COPY.clsMeaning,
    format: (p75) => {
      const value = TWO_DECIMALS.format(ceilTo(p75, 0.01));
      return { shown: value, spoken: COPY.scoreSpoken(value) };
    },
  },
  {
    key: 'inp',
    name: COPY.inp,
    meaning: COPY.inpMeaning,
    format: (p75) => {
      const value = formatCount(ceilTo(p75, 1));
      return { shown: COPY.milliseconds(value), spoken: COPY.millisecondsSpoken(value) };
    },
  },
];

function Row({ measure, vital, emptyLabel }: { measure: Measure; vital: Vital | null; emptyLabel: string }) {
  const value = vital === null ? null : measure.format(vital.p75);
  return (
    <li className={pageSpeedRowClasses}>
      <div className={pageSpeedHeadClasses}>
        <span className={pageSpeedNameClasses} data-speed-name="">
          {measure.name}
        </span>
        {vital !== null && (
          <Badge tone={RATING_LOOK[vital.rating].tone} icon={RATING_LOOK[vital.rating].icon}>
            {COPY.ratings[vital.rating]}
          </Badge>
        )}
      </div>
      <p className={pageSpeedMutedClasses}>{measure.meaning}</p>
      <p className={pageSpeedValueClasses}>
        {value === null ? (
          <EmptyValue label={emptyLabel} />
        ) : (
          <>
            <span aria-hidden="true">{value.shown}</span>
            <span className={srOnlyClasses}>{value.spoken}</span>
          </>
        )}
      </p>
    </li>
  );
}

/** The line under the rows: where the figures come from, or why there are none. */
function footLine(speed: PageSpeed): string {
  if (!speed.available) return COPY.notAvailableLine;
  if (speed.lcp === null && speed.cls === null && speed.inp === null) return COPY.empty;
  return COPY.from(speed.pageViews, formatCount(speed.pageViews));
}

export interface PageSpeedCardProps {
  /** Undefined while the first read runs. */
  speed: PageSpeed | undefined;
}

export function PageSpeedCard({ speed }: PageSpeedCardProps) {
  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          <p className={dashboardCardSubClasses}>{COPY.sub}</p>
        </div>
      </div>
      <div className={pageSpeedBodyClasses}>
        {speed === undefined ? (
          <SkeletonText lines={3} />
        ) : (
          <>
            <ul className={pageSpeedListClasses}>
              {MEASURES.map((measure) => (
                <Row
                  key={measure.key}
                  measure={measure}
                  vital={speed[measure.key]}
                  emptyLabel={speed.available ? COPY.notMeasured : COPY.notAvailable}
                />
              ))}
            </ul>
            <p className={pageSpeedMutedClasses}>{footLine(speed)}</p>
          </>
        )}
      </div>
    </section>
  );
}
