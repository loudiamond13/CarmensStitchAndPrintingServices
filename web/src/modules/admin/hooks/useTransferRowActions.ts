// The Manager's row actions on transfers, shared by the Transfers card and the ledger (UI-SPEC T2, "Focus after list changes"; plan
// 10-20). It holds which confirm is open and for which transfer, and the focus rule after a change: once the list no longer shows the
// transfer as it was (a delete leaves it out, or turns it into a deleted row), focus goes to the next row's action, else the previous
// row's, else the table caption, else the fallback element (an empty list has no caption). Dialogs cannot sit inside a table (the
// table's paint containment would trap them), so the card draws them from `dialogs`.
import { useEffect, useRef, useState } from 'react';
import type { TransferActionDialogsProps } from '@/modules/admin/components/TransferActionDialogs';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { TransferTarget } from '@/modules/admin/services/moneyService';

/** One transfer row on screen, in the order drawn: its transfer id and whether it is shown as deleted. */
export interface ActionableRow {
  readonly id: string;
  readonly isDeleted: boolean;
  /** The row's current version, so an open delete follows a change the server made meanwhile. */
  readonly version: string | null;
}

/** A confirm that is open, or was last open (kept while its close plays). */
interface Pending {
  target: TransferTarget;
  open: boolean;
}

interface AfterChange {
  id: string;
  /** A delete is settled when the row is gone or shown as deleted; a remove, when the row is gone. */
  kind: 'delete' | 'remove';
  focusId: string | null;
}

export interface TransferRowActionsOptions {
  /** The transfer rows on screen in order; undefined while no data has arrived. */
  rows: readonly ActionableRow[] | undefined;
  /** The table caption's id. */
  captionId: string;
  /** Where focus goes when the caption is not drawn (the list became empty). */
  fallbackId: string;
}

export interface TransferRowActions {
  /** A ref callback target for each row's action button. */
  register: (id: string, button: HTMLButtonElement | null) => void;
  openDelete: (target: TransferTarget) => void;
  openRemove: (target: TransferTarget) => void;
  /** Props for the card's `<TransferActionDialogs>`. */
  dialogs: TransferActionDialogsProps;
}

export function useTransferRowActions({ rows, captionId, fallbackId }: TransferRowActionsOptions): TransferRowActions {
  const rowFocus = useRowFocus();
  const [deleting, setDeleting] = useState<Pending | null>(null);
  const [removing, setRemoving] = useState<Pending | null>(null);
  const after = useRef<AfterChange | null>(null);

  // Focus lands on the next row's action, else the previous row's.
  const chooseFocusAfter = (id: string): string | null => {
    const list = rows ?? [];
    const index = list.findIndex((row) => row.id === id);
    return list[index + 1]?.id ?? list[index - 1]?.id ?? null;
  };

  // Once the list no longer shows the transfer as it was, move focus (the dialog's own return to the trigger has run).
  useEffect(() => {
    const wanted = after.current;
    if (wanted === null || rows === undefined) return;
    const row = rows.find((candidate) => candidate.id === wanted.id);
    const settled = wanted.kind === 'delete' ? row === undefined || row.isDeleted : row === undefined;
    if (!settled) return;
    after.current = null;
    if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
      (document.getElementById(captionId) ?? document.getElementById(fallbackId))?.focus();
    }
  });

  // An open delete sends the version the list shows now, so a try after a 409 carries the fresh one.
  const freshVersion = rows?.find((row) => row.id === deleting?.target.id)?.version ?? null;
  const liveDeleting =
    deleting === null || freshVersion === null || freshVersion === deleting.target.version
      ? deleting
      : { ...deleting, target: { ...deleting.target, version: freshVersion } };

  return {
    register: rowFocus.register,
    openDelete: (target) => {
      setDeleting({ target, open: true });
    },
    openRemove: (target) => {
      setRemoving({ target, open: true });
    },
    dialogs: {
      deleting: liveDeleting,
      onCloseDelete: () => {
        setDeleting((current) => (current === null ? null : { ...current, open: false }));
      },
      onDeleteDone: (target) => {
        after.current = { id: target.id, kind: 'delete', focusId: chooseFocusAfter(target.id) };
      },
      removing,
      onCloseRemove: () => {
        setRemoving((current) => (current === null ? null : { ...current, open: false }));
      },
      onRemoveDone: (target) => {
        after.current = { id: target.id, kind: 'remove', focusId: chooseFocusAfter(target.id) };
      },
    },
  };
}
