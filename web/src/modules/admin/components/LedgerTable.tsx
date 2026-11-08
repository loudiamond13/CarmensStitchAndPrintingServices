// The running-balance ledger table (D-41, MONEY-02; UI-SPEC M1 "Ledger card" and Copywriting "Ledger rows"). It draws the server's rows
// as they come: the date, a title over a sub line, Money in or Money out and the balance after the row. It adds, subtracts and signs
// nothing; the amounts and balances are the server's. The server sends the kind and the facts, and this file builds the words. The
// card around it (LedgerCard) owns the paging and the Show deleted filter; this table owns the rows and their states. A person's own
// ledger (My Money) and another person's (plan 10-19) share it.
import { Fragment, type ReactNode } from 'react';
import { UiLink } from '@/components/actions';
import { ActorName } from '@/components/data';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { Money } from '@/components/money';
import { Badge } from '@/components/status';
import {
  ledgerDetailsClasses,
  ledgerNotCountedClasses,
  ledgerOrderLinkClasses,
  ledgerStruckClasses,
  ledgerSubClasses,
  ledgerTitleClasses,
} from '@/modules/admin/components/money.recipe';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { LedgerPage, LedgerRow, TransferTarget } from '@/modules/admin/services/moneyService';
import { isNegativeMoney } from '@/utils/csps';
import { formatBusinessDateTime, formatCalendarDate } from '@/utils/format';

const COPY = MONEY_COPY.ledger;

/** The text of a note, description or name once trimmed, or null when there is none (the part is left out of the sub line). */
function present(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The title of a row: the kind's words, and for a transfer the other person's name with the former-staff mark. */
function titleOf(row: LedgerRow): ReactNode {
  switch (row.kind) {
    case 'payment-received':
      return COPY.titles.payment;
    case 'refund-handed-back':
      return COPY.titles.refund;
    case 'transfer-in':
      return (
        <>
          {COPY.titles.transferFrom} <ActorName actor={row.counterpart} />
        </>
      );
    case 'transfer-out':
      return (
        <>
          {COPY.titles.transferTo} <ActorName actor={row.counterpart} />
        </>
      );
    case 'company-expense':
      return COPY.titles.companyExpense;
    case 'order-expense':
      return COPY.titles.orderExpense;
  }
}

/** The order number as a link to the order, or as plain text when the row names no order id. */
function orderPart(row: LedgerRow): ReactNode {
  if (row.orderNumber === null) return null;
  return row.orderId === null ? (
    row.orderNumber
  ) : (
    <UiLink to={`/admin/orders/${row.orderId}`} className={ledgerOrderLinkClasses}>
      {row.orderNumber}
    </UiLink>
  );
}

/** The parts of a row's sub line that its kind names, in the UI-SPEC order; a part the row does not have is null. */
function partsOf(row: LedgerRow): ReactNode[] {
  switch (row.kind) {
    case 'payment-received':
      return [orderPart(row), present(row.team) ?? present(row.customer), present(row.paymentMethod)];
    case 'refund-handed-back':
      return [orderPart(row), present(row.team) ?? present(row.customer)];
    case 'transfer-in':
    case 'transfer-out':
      return [
        present(row.note),
        row.isHandover ? (
          <>
            {COPY.handedOverBy} <ActorName actor={row.recordedBy} />
          </>
        ) : null,
      ];
    case 'company-expense':
      return [present(row.category), present(row.description)];
    case 'order-expense':
      return [orderPart(row), present(row.category), present(row.description)];
  }
}

/** A deleted transfer's sub line ends with who deleted it and when. */
function deletedParts(row: LedgerRow): ReactNode[] {
  if (!row.isDeleted) return [];
  const when = row.deletedAtUtc === null ? null : formatBusinessDateTime(row.deletedAtUtc);
  return [
    <>
      {COPY.deletedBy} <ActorName actor={row.deletedBy} />
    </>,
    when,
  ];
}

/** The parts that are there, joined by " · ". Nothing is drawn when none is. */
function SubLine({ parts }: { parts: readonly ReactNode[] }) {
  const shown = parts.filter((part) => part !== null && part !== undefined && part !== false && part !== '');
  if (shown.length === 0) return null;
  return (
    <span className={ledgerSubClasses}>
      {shown.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && COPY.joiner}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

function DetailsCell({ row }: { row: LedgerRow }) {
  return (
    <div className={ledgerDetailsClasses}>
      <span className={ledgerTitleClasses}>
        <span>{titleOf(row)}</span>
        {row.isDeleted && <Badge tone="danger">{COPY.deleted}</Badge>}
      </span>
      <SubLine parts={[...partsOf(row), ...deletedParts(row)]} />
    </div>
  );
}

/** An amount in Money in or Money out; the empty side is null (the table draws the empty marker). A deleted row's is muted and struck. */
function amountCell(row: LedgerRow, amount: number | null): ReactNode {
  if (amount === null) return null;
  return row.isDeleted ? (
    <span className={ledgerStruckClasses}>
      <Money amount={amount} />
    </span>
  ) : (
    <Money amount={amount} />
  );
}

/** The server's balance after the row, danger below zero; a deleted transfer counts toward no balance. */
function balanceCell(row: LedgerRow): ReactNode {
  if (row.isDeleted) return <span className={ledgerNotCountedClasses}>{COPY.notCounted}</span>;
  if (row.balanceAfter === null) return null;
  return <Money amount={row.balanceAfter} tone={isNegativeMoney(row.balanceAfter) ? 'danger' : undefined} />;
}

const COLUMNS: readonly ResponsiveTableColumn<LedgerRow>[] = [
  {
    key: 'date',
    header: COPY.columns.date,
    lead: true,
    cell: (row) => {
      const text = formatCalendarDate(row.date);
      return text === null ? null : <time dateTime={row.date}>{text}</time>;
    },
  },
  { key: 'details', header: COPY.columns.details, cell: (row) => <DetailsCell row={row} /> },
  { key: 'moneyIn', header: COPY.columns.moneyIn, money: true, cell: (row) => amountCell(row, row.moneyIn) },
  { key: 'moneyOut', header: COPY.columns.moneyOut, money: true, cell: (row) => amountCell(row, row.moneyOut) },
  { key: 'balance', header: COPY.columns.balance, money: true, cell: balanceCell },
];

export interface LedgerTableProps {
  /** The server page on screen; undefined while no data has arrived yet. */
  page: LedgerPage | undefined;
  /** The Manager's row actions (plan 10-20): Delete on a counted transfer, Remove on a deleted one. The ledger never offers an edit (D-22). */
  canSeeActions?: boolean | undefined;
  /** Whose ledger this is, so a transfer row's action can name both people. */
  owner?: { id: string; name: string } | undefined;
  onDelete?: ((target: TransferTarget) => void) | undefined;
  onRemove?: ((target: TransferTarget) => void) | undefined;
  register?: ((id: string, button: HTMLButtonElement | null) => void) | undefined;
  /** The first read is running. */
  pending?: boolean | undefined;
  /** The rows are the previous page's while the next one loads. */
  refetching?: boolean | undefined;
  /** The read failed; the table shows "Couldn't load the ledger." with Try Again. */
  failed?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  /** Makes the caption a focus target for Pagination. */
  captionId?: string | undefined;
  /**
   * The ledger is the signed-in person's own (the default). The empty state's line speaks to "you"; another person's ledger shows the
   * title alone (wave 8 IN-08).
   */
  ownLedger?: boolean | undefined;
}

export function LedgerTable({
  page,
  pending,
  refetching,
  failed,
  error,
  onRetry,
  captionId,
  ownLedger = true,
}: LedgerTableProps) {
  return (
    <ResponsiveTable<LedgerRow>
      caption={COPY.title}
      captionId={captionId}
      columns={COLUMNS}
      rows={page?.rows}
      rowKey={(row) => row.key}
      things={COPY.things}
      pending={pending}
      refetching={refetching}
      failed={failed}
      error={error}
      onRetry={onRetry}
      emptyIcon="wallet"
      emptyTitle={COPY.empty.title}
      emptyMessage={ownLedger ? COPY.empty.message : undefined}
      emptyLevel={3}
      embedded
    />
  );
}
