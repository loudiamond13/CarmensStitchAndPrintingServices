// The Ledger card (D-41, MONEY-02; UI-SPEC M1 "Ledger card"): the head, the result bar and the table of one person's money rows, newest
// first, each with the balance the server worked out after it. Built once for My Money and reused for one person's page (plan 10-19).
// Every figure is the server's; the card works out nothing.
import { useId } from 'react';
import { ResultBar } from '@/components/lists';
import {
  dashboardCardSubClasses,
  dashboardCardHeadClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { LedgerTable } from '@/modules/admin/components/LedgerTable';
import { ledgerBarClasses, ledgerCardClasses } from '@/modules/admin/components/money.recipe';
import { useLedgerQuery } from '@/modules/admin/hooks/useLedgerQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.ledger;

export interface LedgerCardProps {
  /** `me` for the signed-in person, or another person's id. */
  userId: string;
}

export function LedgerCard({ userId }: LedgerCardProps) {
  const headingId = useId();
  const query = useLedgerQuery(userId, { page: 1, pageSize: 20, deleted: false });
  const page = query.data;
  // One table stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
  const failed = query.isError && !query.isFetching;
  const loading = query.isFetching && (page === undefined || query.isError);

  return (
    <section className={ledgerCardClasses} aria-labelledby={headingId}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 id={headingId} className={dashboardCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={dashboardCardSubClasses}>{COPY.sub}</p>
        </div>
      </div>
      {page !== undefined && (
        <div className={ledgerBarClasses}>
          <ResultBar
            count={page.total}
            thing={COPY.result.thing}
            things={COPY.result.things}
            orderNote={COPY.result.orderNote}
          />
        </div>
      )}
      <LedgerTable
        page={page}
        pending={loading}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={failed}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    </section>
  );
}
