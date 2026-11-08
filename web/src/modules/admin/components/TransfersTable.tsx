// SPEC-GAP: The Transfers table (D-48, MONEY-03; UI-SPEC M1 "Transfers panel"; plan 10-20): every transfer between staff as the server
// sent it, newest first. Date, From and To (an avatar and the name), Amount, Note, Recorded by and the Manager's row actions. It draws
// the server's figures and works out nothing. It offers no edit and no restore (D-22, D-28, MONEY-07). Only a Manager is ever given this
// table: the card that holds it is not mounted for an Admin.
import { ActorName } from '@/components/data';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Money } from '@/components/money';
import { Avatar } from '@/components/status';
import { ledgerSubClasses, staffNameClasses, staffPersonClasses } from '@/modules/admin/components/money.recipe';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import {
  toTransferTarget,
  type TransferItem,
  type TransferPage,
  type TransferTarget,
} from '@/modules/admin/services/moneyService';
import { formatCalendarDate } from '@/utils/format';
import { formatPeso } from '@/utils/csps';

const COPY = MONEY_COPY.transfers;

type Actor = TransferItem['from'];

/** A person: a 24px avatar and the name, with the former-staff mark when the account was deleted. The name may wrap. */
function PersonCell({ actor }: { actor: Actor }) {
  return (
    <span className={staffPersonClasses}>
      <span aria-hidden="true">
        <Avatar name={actor.name} size={24} />
      </span>
      <span className={staffNameClasses}>
        <ActorName actor={actor} />
      </span>
    </span>
  );
}

/** The note once trimmed, or null when there is none (the table draws the empty marker). */
function noteOf(row: TransferItem): string | null {
  const trimmed = row.note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export interface TransfersTableProps {
  /** The server page on screen; undefined while no data has arrived yet. */
  page: TransferPage | undefined;
  /** The first read is running. */
  pending?: boolean | undefined;
  /** The rows are the previous page's while the next one loads. */
  refetching?: boolean | undefined;
  /** The read failed; the table shows "Couldn't load transfers." with Try Again. */
  failed?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  /** Makes the caption a focus target for Pagination and for the focus rule after a delete. */
  captionId?: string | undefined;
  /** Delete was pressed on a counted transfer. */
  onDelete: (target: TransferTarget) => void;
  /** Remove was pressed on a deleted transfer (the permanent remove, task 3). */
  onRemove?: ((target: TransferTarget) => void) | undefined;
  /** Remembers each row's action button, so focus can go to a neighbour after a row changes. */
  register?: ((id: string, button: HTMLButtonElement | null) => void) | undefined;
}

export function TransfersTable({
  page,
  pending,
  refetching,
  failed,
  error,
  onRetry,
  captionId,
  onDelete,
  register,
}: TransfersTableProps) {
  const columns: readonly ResponsiveTableColumn<TransferItem>[] = [
    {
      key: 'date',
      header: COPY.columns.date,
      lead: true,
      cell: (row) => {
        const text = formatCalendarDate(row.date);
        return text === null ? null : <time dateTime={row.date}>{text}</time>;
      },
    },
    { key: 'from', header: COPY.columns.from, cell: (row) => <PersonCell actor={row.from} /> },
    { key: 'to', header: COPY.columns.to, cell: (row) => <PersonCell actor={row.to} /> },
    { key: 'amount', header: COPY.columns.amount, money: true, cell: (row) => <Money amount={row.amount} /> },
    {
      key: 'note',
      header: COPY.columns.note,
      cell: (row) => {
        const note = noteOf(row);
        return note === null ? null : <span className={ledgerSubClasses}>{note}</span>;
      },
    },
    { key: 'recordedBy', header: COPY.columns.recordedBy, cell: (row) => <ActorName actor={row.recordedBy} /> },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (row) => {
        const name = COPY.deleteName(
          formatPeso(row.amount),
          row.from.name,
          row.to.name,
          formatCalendarDate(row.date) ?? row.date,
        );
        return (
          <RowActions>
            <RowAction
              icon="trash-2"
              label={name}
              title={name}
              danger
              ref={(button) => {
                register?.(row.id, button);
              }}
              onClick={() => {
                onDelete(toTransferTarget(row));
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <ResponsiveTable<TransferItem>
      caption={COPY.caption}
      captionId={captionId}
      columns={columns}
      rows={page?.rows}
      rowKey={(row) => row.id}
      things={COPY.things}
      pending={pending}
      refetching={refetching}
      failed={failed}
      error={error}
      onRetry={onRetry}
      emptyIcon="arrow-right"
      emptyTitle={COPY.empty.title}
      emptyMessage={COPY.empty.message}
      emptyLevel={3}
      embedded
    />
  );
}
