// SPEC-GAP: The Transfers card (D-48, MONEY-03, WEB-10; UI-SPEC M1 "Transfers panel"; plan 10-20): a Manager's list of every transfer
// between staff, newest first: the head, the result bar, the table and the paging, with the Delete confirm behind each row. Every figure
// is the server's; the card works out nothing.
//   - The page, the rows per page and the Manager's Show deleted live in the URL through useMoneyListParams and nowhere else (WEB-10), so a reload, a shared link
//     and Back restore them. A page past the last counts as loading, then becomes the last page once fresh data says so.
//   - It asks only as a Manager: the Transfers tab is not drawn for an Admin, and `enabled` is the role check as well. The API answers
//     403 to an Admin anyway (T-10-45).
import { useId } from 'react';
import { Checkbox } from '@/components/entry';
import { Pagination, ResultBar } from '@/components/lists';
import { usePagedList } from '@/lib/url-state/usePagedList';
import {
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import {
  ledgerBarClasses,
  ledgerCardClasses,
  ledgerPagerClasses,
  ledgerToolsClasses,
} from '@/modules/admin/components/money.recipe';
import { TransferActionDialogs } from '@/modules/admin/components/TransferActionDialogs';
import { TransfersTable } from '@/modules/admin/components/TransfersTable';
import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useTransferRowActions } from '@/modules/admin/hooks/useTransferRowActions';
import { useTransfersQuery } from '@/modules/admin/hooks/useTransfersQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.transfers;

export function TransfersCard() {
  const headingId = useId();
  const captionId = useId();
  const { user } = useSession();
  const isManager = user?.role === 'manager';
  const [values, set] = useMoneyListParams();
  // Only a Manager can ask for deleted transfers; for anyone else the parameter is never sent.
  const showDeleted = isManager && values.deleted === 'true';
  const query = useTransfersQuery({ page: values.page, pageSize: values.size, deleted: showDeleted }, isManager);
  const page = query.data;
  const total = page?.total ?? 0;
  // One table stays mounted through loading, failure, Try Again and loaded, so its status node can say each step. A page past the
  // last comes back with no rows but the real total: it is not an empty list, it is about to be replaced.
  const { pastTheEnd, loading, failed, pageCount, showPager } = usePagedList(query, total, values.size, set.clampPage);

  const actions = useTransferRowActions({
    rows: page?.rows,
    captionId,
    failed,
    fallbackId: headingId,
  });

  // The Transfers tab is not drawn for an Admin; if the card is ever mounted for one, it draws nothing and has asked for nothing (T-10-45).
  if (!isManager) return null;

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
      <div className={ledgerToolsClasses}>
        <Checkbox
          label={MONEY_COPY.ledger.showDeleted}
          checked={showDeleted}
          onChange={(checked) => {
            set.setFilter('deleted', checked ? 'true' : null);
          }}
        />
      </div>
      {page !== undefined && !pastTheEnd && (
        <div className={ledgerBarClasses}>
          <ResultBar
            count={total}
            thing={COPY.result.thing}
            things={COPY.result.things}
            orderNote={COPY.result.orderNote}
          />
        </div>
      )}
      <TransfersTable
        page={page}
        captionId={captionId}
        pending={loading}
        refetching={query.isPlaceholderData && query.isFetching}
        failed={failed}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
        onDelete={actions.openDelete}
        onRemove={actions.openRemove}
        register={actions.register}
      />
      {showPager && (
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
