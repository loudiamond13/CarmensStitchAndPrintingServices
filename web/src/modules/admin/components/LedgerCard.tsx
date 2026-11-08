// The Ledger card (D-41, MONEY-02; UI-SPEC M1 "Ledger card"): the head, the Manager's Show deleted, the result bar, the table and
// the paging of one person's money rows, newest first, each with the balance the server worked out after it. Built once for My Money
// and reused for one person's page (plan 10-19). Every figure is the server's; the card works out nothing.
//   - The page, the rows per page and Show deleted live in the URL through useMoneyListParams and nowhere else (WEB-10), so a reload, a
//     shared link and Back restore them. A page past the last becomes the last page once fresh data says so.
//   - Deleted transfers are a Manager-only view (D-30, D-31): an Admin gets no checkbox, and `deleted` is never sent for an Admin.
import { useEffect, useId } from 'react';
import { Checkbox } from '@/components/entry';
import { Pagination, ResultBar } from '@/components/lists';
import {
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { LedgerTable } from '@/modules/admin/components/LedgerTable';
import {
  ledgerBarClasses,
  ledgerCardClasses,
  ledgerPagerClasses,
  ledgerToolsClasses,
} from '@/modules/admin/components/money.recipe';
import { useLedgerQuery } from '@/modules/admin/hooks/useLedgerQuery';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';
import { useSession } from '@/modules/admin/hooks/useSession';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.ledger;

export interface LedgerCardProps {
  /** `me` for the signed-in person, or another person's id. */
  userId: string;
}

export function LedgerCard({ userId }: LedgerCardProps) {
  const headingId = useId();
  const captionId = useId();
  const { user } = useSession();
  const isManager = user?.role === 'manager';
  const [values, set] = useMoneyListParams();
  // Only a Manager can ask for deleted transfers; for anyone else the parameter is never sent.
  const showDeleted = isManager && values.deleted === 'true';
  const query = useLedgerQuery(userId, { page: values.page, pageSize: values.size, deleted: showDeleted });
  const page = query.data;
  // One table stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
  const failed = query.isError && !query.isFetching;
  // A page past the last comes back with no rows but the real total: it is not an empty ledger, it is about to be replaced.
  const pastTheEnd = page !== undefined && page.rows.length === 0 && page.total > 0;
  const loading = (query.isFetching && (page === undefined || query.isError)) || pastTheEnd;

  const total = page?.total ?? 0;
  const pageCount = Math.ceil(total / values.size);
  // A page past the last one (a stale link, or rows removed meanwhile) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  const result = showDeleted ? COPY.resultWithDeleted : COPY.result;

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
      {isManager && (
        <div className={ledgerToolsClasses}>
          <Checkbox
            label={COPY.showDeleted}
            checked={showDeleted}
            onChange={(checked) => {
              set.setFilter('deleted', checked ? 'true' : null);
            }}
          />
        </div>
      )}
      {page !== undefined && !pastTheEnd && (
        <div className={ledgerBarClasses}>
          <ResultBar count={total} thing={result.thing} things={result.things} orderNote={result.orderNote} />
        </div>
      )}
      <LedgerTable
        page={page}
        captionId={captionId}
        pending={loading}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={failed}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
      {pageCount > 1 && !pastTheEnd && (
        <div className={ledgerPagerClasses}>
          <Pagination
            page={values.page}
            pageCount={pageCount}
            onPageChange={set.setPage}
            focusTargetId={captionId}
            pageSize={values.size}
            onPageSizeChange={set.setPageSize}
          />
        </div>
      )}
    </section>
  );
}
