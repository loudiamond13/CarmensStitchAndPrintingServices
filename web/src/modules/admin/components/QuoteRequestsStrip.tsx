// SPEC-GAP: quote requests strip (D-19, UI-SPEC R4). The dashboard row under the MoneyStrip, in its look: the inbox tile (hidden on
// phones), "New quote requests" over the server's New count (dimmed at 0, as KpiCard D-39) and Open Quote Requests. It reads the shared
// count query, so a failed read leaves the rest of the dashboard alone, and the link works whatever the state.
// A failed read shows its alert and Try Again in the figure's place, never an older count. The alert stays put while any read runs
// again (Try Again is busy meanwhile), so the 60-second refresh never reads it out a second time.
import clsx from 'clsx';
import { useId } from 'react';
import { Button, ButtonLink, hitAreaClasses } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import { LoadingRegion } from '@/components/states';
import {
  moneyStripActionsClasses,
  moneyStripBodyClasses,
  moneyStripClasses,
  moneyStripFailedClasses,
  moneyStripFailedTextClasses,
  moneyStripFigureClasses,
  moneyStripLabelClasses,
  moneyStripTileClasses,
  moneyStripToneClasses,
} from '@/modules/admin/components/money.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import type { NewQuoteCountQuery } from '@/modules/admin/hooks/useNewQuoteCountQuery';
import { formatCount } from '@/utils/format';

const COPY = DASHBOARD_COPY.quotes;
/** The inbox the strip links to. */
const INBOX_PATH = '/admin/quote-requests';

export interface QuoteRequestsStripProps {
  query: NewQuoteCountQuery;
}

export function QuoteRequestsStrip({ query }: QuoteRequestsStripProps) {
  const labelId = useId();
  const count = query.data;
  const loading = !query.isError && count === undefined;

  let figure;
  if (query.isError) {
    figure = (
      <div className={moneyStripFailedClasses}>
        <p role="alert" className={moneyStripFailedTextClasses}>
          {COPY.failed}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className={hitAreaClasses}
          pending={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          {COPY.retry}
        </Button>
      </div>
    );
  } else if (count === undefined) {
    figure = <Skeleton width={40} height={24} />;
  } else {
    const tone = count === 0 ? moneyStripToneClasses.zero : moneyStripToneClasses.plain;
    figure = <span className={clsx(moneyStripFigureClasses, tone)}>{formatCount(count)}</span>;
  }

  return (
    <section className={moneyStripClasses} aria-labelledby={labelId}>
      <span className={moneyStripTileClasses}>
        <Icon name="inbox" size={18} />
      </span>
      <LoadingRegion loading={loading} failed={query.isError} things={COPY.things} className={moneyStripBodyClasses}>
        <span id={labelId} className={moneyStripLabelClasses}>
          {COPY.label}
        </span>
        {figure}
      </LoadingRegion>
      <div className={moneyStripActionsClasses}>
        <ButtonLink variant="secondary" size="sm" to={INBOX_PATH} className={hitAreaClasses}>
          {COPY.open}
        </ButtonLink>
      </div>
    </section>
  );
}
