// S2 Hours & Closures, card B "Holidays and closures" (CONT-04, PUB-03, D-22; plan 11-16): the upcoming closures by first day, Add Closure in the
// head, and per row Edit and Delete named by their date.
//   - The list is every closure whose last day is today or later; it has its own loading, error and empty states, so it never blanks the hours.
//   - A saved or deleted closure shows its toast, reads the list again and clears the public data held in this browser (the hooks do the last two).
//   - Focus: after an add or an edit it goes to that row's Edit; after a delete, to the next row's Edit, else the previous row's, else Add Closure.
//   - Delete asks first with Cancel focused; a 404 (someone deleted it already) closes the question, says so and reads the list again.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { EmptyValue } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { ClosureModal } from '@/modules/admin/components/ClosureModal';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { useDeleteShopClosure, useShopClosuresQuery } from '@/modules/admin/hooks/useShopClosuresQuery';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { ShopClosure } from '@/modules/admin/services/shopClosuresService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { formatCalendarDate } from '@/utils/format';

const COPY = SITE_CONTENT_COPY.closures;

/** "Dec 25, 2026", or "Dec 30, 2026 to Jan 1, 2027" for a closure of several days. */
function dateLabel(closure: ShopClosure): string {
  const first = formatCalendarDate(closure.firstDay) ?? closure.firstDay;
  if (closure.lastDay === closure.firstDay) {
    return first;
  }
  return COPY.range(first, formatCalendarDate(closure.lastDay) ?? closure.lastDay);
}

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  edit: (closure: ShopClosure) => void;
  remove: (closure: ShopClosure) => void;
  /** Remembers each row's Edit button, so focus can go back to it. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

function columns(wiring: RowWiring): readonly ResponsiveTableColumn<ShopClosure>[] {
  return [
    { key: 'date', header: COPY.table.date, lead: true, cell: (item) => dateLabel(item) },
    {
      key: 'note',
      header: COPY.table.note,
      cell: (item) => (item.note === null || item.note === '' ? <EmptyValue /> : item.note),
    },
    {
      key: 'actions',
      header: COPY.table.actions,
      actions: true,
      cell: (item) => {
        const when = dateLabel(item);
        const editLabel = COPY.rowActions.edit(when);
        const removeLabel = COPY.rowActions.remove(when);
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editLabel}
              title={editLabel}
              onClick={() => {
                wiring.edit(item);
              }}
              ref={(button) => {
                wiring.register(item.id, button);
              }}
            />
            <RowAction
              icon="trash-2"
              label={removeLabel}
              title={removeLabel}
              danger
              onClick={() => {
                wiring.remove(item);
              }}
            />
          </RowActions>
        );
      },
    },
  ];
}

export function ClosuresCard() {
  const toast = useToast();
  const query = useShopClosuresQuery();
  const rowFocus = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  // The closure the Edit window is open for, or was last open for (kept while it animates out).
  const [editing, setEditing] = useState<{ closure: ShopClosure; open: boolean } | null>(null);
  // The closure the Delete question is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ closure: ShopClosure; open: boolean } | null>(null);
  // The row whose Edit takes focus once the list shows it after a save.
  const focusAfterSave = useRef<string | null>(null);
  // Where focus goes once the deleted row has left the list: the Edit of another row, or Add Closure when it is null.
  const focusAfterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  // Runs after every render: moves focus once the list holds what the last action expects.
  useEffect(() => {
    const saved = focusAfterSave.current;
    const rows = query.data;
    if (saved !== null && rows?.some((row) => row.id === saved) === true && !query.isFetching) {
      focusAfterSave.current = null;
      rowFocus.focusRow(saved);
    }
    const removal = focusAfterRemoval.current;
    if (removal !== null && rows !== undefined && !rows.some((row) => row.id === removal.removedId)) {
      focusAfterRemoval.current = null;
      if (removal.focusId === null || !rowFocus.focusRow(removal.focusId)) {
        addRef.current?.focus();
      }
    }
  });

  /** The row after this one, else the one before it, else null: where focus goes when this row is deleted. */
  const neighbourOf = (closure: ShopClosure): string | null => {
    const rows = query.data ?? [];
    const index = rows.findIndex((row) => row.id === closure.id);
    return rows[index + 1]?.id ?? rows[index - 1]?.id ?? null;
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useDeleteShopClosure({
    onSuccess: (_result, id) => {
      const closure = deleting?.closure;
      if (closure?.id === id) {
        focusAfterRemoval.current = { removedId: id, focusId: neighbourOf(closure) };
        toast.show({ title: COPY.toast.deleted.title, message: COPY.toast.deleted.message(dateLabel(closure)) });
      }
      closeDelete();
    },
  });

  const confirmDelete = async () => {
    if (deleting === null) {
      return undefined;
    }
    const { closure } = deleting;
    const outcome = await removal.submit(closure.id);
    // Someone deleted it first: the question closes, says so, and the list is read again.
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      focusAfterRemoval.current = { removedId: closure.id, focusId: neighbourOf(closure) };
      closeDelete();
      toast.show({ tone: 'info', title: COPY.toast.alreadyDeleted });
      void query.refetch();
      return undefined;
    }
    return outcome;
  };

  const wiring: RowWiring = {
    edit: (closure) => {
      setEditing({ closure, open: true });
    },
    remove: (closure) => {
      setDeleting({ closure, open: true });
    },
    register: rowFocus.register,
  };

  return (
    <>
      <SiteContentCard
        title={COPY.card.title}
        hint={COPY.card.hint}
        action={
          <Button
            variant="secondary"
            icon="plus"
            ref={addRef}
            onClick={() => {
              setAdding(true);
            }}
          >
            {COPY.add}
          </Button>
        }
      >
        <ResponsiveTable<ShopClosure>
          caption={COPY.table.caption}
          columns={columns(wiring)}
          rows={query.data}
          rowKey={(item) => item.id}
          fitTablet
          things={COPY.things}
          pending={query.isPending}
          failed={query.isError}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
          emptyIcon="calendar"
          emptyTitle={COPY.empty.title}
          emptyMessage={COPY.empty.message}
          emptyLevel={3}
          skeletonRows={3}
        />
      </SiteContentCard>
      <ClosureModal
        mode="add"
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSaved={(saved) => {
          focusAfterSave.current = saved.id;
          toast.show({ title: COPY.toast.added.title, message: COPY.toast.added.message(dateLabel(saved)) });
        }}
      />
      <ClosureModal
        mode="edit"
        open={editing?.open ?? false}
        closure={editing?.closure ?? null}
        onClose={() => {
          setEditing((current) => (current === null ? null : { ...current, open: false }));
        }}
        onSaved={(saved) => {
          focusAfterSave.current = saved.id;
          toast.show({ title: COPY.toast.saved.title, message: COPY.toast.saved.message });
        }}
      />
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={COPY.remove.title}
          message={COPY.remove.message(dateLabel(deleting.closure))}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}
