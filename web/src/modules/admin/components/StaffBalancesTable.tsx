// SPEC-GAP: D-42 The All Staff card (UI-SPEC M1 "All Staff panel", D-42 to D-45, MONEY-03): every person's money on hand and the total held
// by staff, for a Manager. It draws the server's figures as they come and works out nothing, the total included.
//   - Rows are in the order the server sent: active people by name, then former staff whose balance is not 0.00 (D-43). Every row is in
//     one load, so there is no paging.
//   - The name links to the person's page; the signed-in Manager's own row links to My Money and adds " (you)". Every row has an eye link
//     to the same place.
//   - SPEC-GAP: D-45 a deactivated or deleted person who holds money (balance above 0.00) also has "Hand Over". A leaver who is owed
//     money (below zero) has none: there is nothing to hand over.
//   - One table stays mounted through loading, failure, Try Again and loaded, so its status node can say each step.
import clsx from 'clsx';
import { useId } from 'react';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Money } from '@/components/money';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Avatar, Badge, type BadgeTone } from '@/components/status';
import {
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import {
  staffCardClasses,
  staffNameClasses,
  staffPersonClasses,
  staffPersonHandOverClasses,
  staffPersonLinkClasses,
  staffYouClasses,
  staffZeroClasses,
} from '@/modules/admin/components/money.recipe';
import { RoleBadge } from '@/modules/admin/components/UserBadges';
import type { StaffBalancesTableQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { RecipientStatus, StaffBalance } from '@/modules/admin/services/moneyService';
import { isNegativeMoney, round2 } from '@/utils/csps';

const COPY = MONEY_COPY.staff;

const STATUS_TONE: Record<RecipientStatus, BadgeTone> = {
  active: 'success',
  deactivated: 'neutral',
  deleted: 'neutral',
};

/** A person's page, or My Money for the signed-in Manager's own row. */
function pageOf(row: StaffBalance): string {
  return row.isYou ? '/admin/money' : `/admin/money/staff/${row.userId}`;
}

/** Only a leaver who holds money has anything to hand over. */
function canHandOver(row: StaffBalance): boolean {
  return row.status !== 'active' && round2(row.balance) > 0;
}

function PersonCell({ row }: { row: StaffBalance }) {
  return (
    <span className={clsx(staffPersonClasses, canHandOver(row) && staffPersonHandOverClasses)}>
      <span aria-hidden="true">
        <Avatar name={row.name} size={24} />
      </span>
      <span className={staffNameClasses}>
        <UiLink to={pageOf(row)} className={staffPersonLinkClasses}>
          {row.name}
        </UiLink>
        {row.isYou && <span className={staffYouClasses}>{COPY.you}</span>}
      </span>
    </span>
  );
}

function BalanceFigure({ amount }: { amount: number }) {
  return (
    <Money
      amount={amount}
      tone={isNegativeMoney(amount) ? 'danger' : undefined}
      className={round2(amount) === 0 ? staffZeroClasses : undefined}
    />
  );
}

export interface StaffBalancesTableProps {
  query: StaffBalancesTableQuery;
  /** Hand Over was pressed on a leaver's row; `trigger` is that button, so focus can go back to it. */
  onHandOver: (row: StaffBalance, trigger: HTMLElement) => void;
  /** Makes the table caption a focus target, for the screen that moves focus there when the row's button is gone. */
  captionId?: string | undefined;
}

export function StaffBalancesTable({ query, onHandOver, captionId }: StaffBalancesTableProps) {
  const headingId = useId();
  const staff = query.data;
  const failed = query.isError && !query.isFetching;
  const pending = query.isFetching && (staff === undefined || query.isError);

  const columns: readonly ResponsiveTableColumn<StaffBalance>[] = [
    { key: 'person', header: COPY.columns.person, lead: true, cell: (row) => <PersonCell row={row} /> },
    { key: 'role', header: COPY.columns.role, cell: (row) => <RoleBadge role={row.role} /> },
    {
      key: 'status',
      header: COPY.columns.status,
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]} dot>
          {COPY.status[row.status]}
        </Badge>
      ),
    },
    {
      key: 'balance',
      header: COPY.columns.balance,
      money: true,
      cell: (row) => <BalanceFigure amount={row.balance} />,
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (row) => (
        <RowActions>
          <RowAction to={pageOf(row)} icon="eye" label={COPY.viewLedgerName(row.name)} />
          {canHandOver(row) && (
            <Button
              variant="secondary"
              size="sm"
              icon="arrow-right"
              aria-label={COPY.handOverName(row.name)}
              className={hitAreaClasses}
              onClick={(event) => {
                onHandOver(row, event.currentTarget);
              }}
            >
              {COPY.handOver}
            </Button>
          )}
        </RowActions>
      ),
    },
  ];

  return (
    <section className={staffCardClasses} aria-labelledby={headingId}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 id={headingId} className={dashboardCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={dashboardCardSubClasses}>{COPY.sub}</p>
        </div>
      </div>
      <ResponsiveTable<StaffBalance>
        caption={COPY.caption}
        captionId={captionId}
        columns={columns}
        rows={staff?.rows}
        rowKey={(row) => row.userId}
        things={COPY.things}
        pending={pending}
        failed={failed}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
        emptyIcon="wallet"
        emptyLevel={3}
        footer={
          staff === undefined ? undefined : { person: COPY.total, balance: <BalanceFigure amount={staff.total} /> }
        }
        footerLayout={{ person: { span: 3 } }}
        embedded
      />
    </section>
  );
}
