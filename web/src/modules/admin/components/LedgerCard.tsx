// The Ledger card (D-41, MONEY-02; UI-SPEC M1 "Ledger card"): the head, the Manager's Show deleted, the result bar, the table and
// the paging of one person's money rows, newest first, each with the balance the server worked out after it. Built once for My Money
// and reused for one person's page (plan 10-19). Every figure is the server's; the card works out nothing.
//   - The page, the rows per page and Show deleted live in the URL through useMoneyListParams and nowhere else (WEB-10), so a reload, a
//     shared link and Back restore them. A page past the last becomes the last page once fresh data says so.
//   - Deleted transfers are a Manager-only view (D-30, D-31): an Admin gets no checkbox, and `deleted` is never sent for an Admin.
import { useEffect, useId } from 'react';
import { Checkbox } from '@/components/entry';
import { Pagination, ResultBar } from '@/components/lists';
import { PAGE_SIZES } from '@/lib/url-state/parsers';
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
import { TransferActionDialogs } from '@/modules/admin/components/TransferActionDialogs';
import { useLedgerQuery } from '@/modules/admin/hooks/useLedgerQuery';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useTransferRowActions } from '@/modules/admin/hooks/useTransferRowActions';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.ledger;

export interface LedgerCardProps {
  /** `me` for the signed-in person, or another person's id. */
  userId: string;
  /** The person's name on another person's page, so a transfer row's action can name both people. My Money uses the session. */
  ownerName?: string | undefined;
}

export function LedgerCard({ userId, ownerName }: LedgerCardProps) {
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
  const pastTheEnd = page?.rows.length === 0 && page.total > 0;
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

  // Whose ledger this is, so a transfer row's action can name both people: the session for My Money, the page's name for a person.
  const owner =
    userId === 'me'
      ? user === null
        ? undefined
        : { id: user.id, name: user.name }
      : ownerName === undefined
        ? undefined
        : { id: userId, name: ownerName };
  // Delete and Remove on transfer rows are a Manager's alone (D-31, D-32); an Admin's ledger has no Actions column.
  const actions = useTransferRowActions({
    rows: page?.rows.flatMap((row) =>
      row.transferId === null ? [] : [{ id: row.transferId, isDeleted: row.isDeleted, version: row.version }],
    ),
    captionId,
    fallbackId: headingId,
  });

  // The wording follows the answer on screen, not the checkbox, which can be ahead of the rows while the next answer loads.
  const result = page?.includesDeleted === true ? COPY.resultWithDeleted : COPY.result;

  return (
    <section className={ledgerCardClasses} aria-labelledby={headingId}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 id={headingId} tabIndex={-1} className={dashboardCardTitleClasses}>
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
        canSeeActions={isManager}
        owner={owner}
        onDelete={actions.openDelete}
        onRemove={actions.openRemove}
        register={actions.register}
        ownLedger={userId === 'me'}
        pending={loading}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={failed}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
      {total > PAGE_SIZES[0] && !pastTheEnd && (
        <div className={ledgerPagerClasses}>
          <Pagination
            page={values.page}
            pageCount={pageCount}
            onPageChange={set.setPage}
            focusTargetId={captionId}
            pageSize={values.size}
            onPageSizeChange={set.setPageSize}
            sizeOnlyWhenSinglePage
          />
        </div>
      )}
      <TransferActionDialogs {...actions.dialogs} />
    </section>
  );
}
