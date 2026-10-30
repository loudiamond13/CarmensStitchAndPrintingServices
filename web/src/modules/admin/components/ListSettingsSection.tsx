// SPEC-GAP: S1 Settings list card (UI-SPEC "S1 Settings"; D-31, D-32, D-08..D-15, OQ-3..OQ-6; plans 06-17 and 08-08). One card for any of
// the four Settings lists, driven by a ListSettingsConfig: the head with the hint and "Add {Entry}", the table with the name badge, Status,
// the count column and the row actions, and the line that explains retire versus delete. Per row: Edit, Retire or Use again (at once, no
// confirmation) and Delete. Delete is offered only for an entry nothing has used, never for Others. Every saved change reads the lists
// that show an entry again.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { Badge } from '@/components/status';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { CategoryModal, type SavedCategory } from '@/modules/admin/components/CategoryModal';
import { expensesCaptionClasses } from '@/modules/admin/components/expenses.recipe';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardTitleClasses,
} from '@/modules/admin/components/profile.recipe';
import {
  settingsActionSlotClasses,
  settingsAddButtonClasses,
  settingsCategoryCellClasses,
  settingsHeadTextClasses,
  settingsSublineClasses,
} from '@/modules/admin/components/settings.recipe';
import { isHttpError } from '@/core/api/errors';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { useRefreshList } from '@/modules/admin/hooks/useRefreshList';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { ListSettingsConfig, SettingsListRow } from '@/modules/admin/listSettingsConfigs';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { formatCount } from '@/utils/format';

export type { ListSettingsConfig } from '@/modules/admin/listSettingsConfigs';

/** An empty 36px action slot, so a row with fewer actions still lines up with the others. */
function ActionSlot() {
  return <span aria-hidden="true" className={settingsActionSlotClasses} />;
}

const isRetired = (row: SettingsListRow): boolean => row.status === 'retired';

/** The focus registry key of a row's Retire / Use again button (the Edit button is registered under the plain id). */
const toggleKey = (id: string): string => `toggle:${id}`;

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  edit: (row: SettingsListRow) => void;
  /** Retires an active entry, or brings a retired one back. */
  toggle: (row: SettingsListRow) => void;
  /** Opens the delete confirmation. */
  remove: (row: SettingsListRow) => void;
  /** Remembers each row's buttons, so focus can return to them. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

function columns(config: ListSettingsConfig, wiring: RowWiring): readonly ResponsiveTableColumn<SettingsListRow>[] {
  const words = config.words;
  return [
    {
      key: 'name',
      header: words.columns.name,
      lead: true,
      cell: (item) => (
        <span className={settingsCategoryCellClasses}>
          <CategoryBadge category={item} />
          {item.isOthers && <span className={settingsSublineClasses}>{words.othersSubline}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: words.columns.status,
      cell: (item) =>
        isRetired(item) ? (
          <Badge tone="neutral" dot>
            {words.status.retired}
          </Badge>
        ) : (
          <Badge tone="success" dot>
            {words.status.active}
          </Badge>
        ),
    },
    {
      key: 'count',
      header: words.columns.count,
      money: true,
      cell: (item) => formatCount(config.countOf(item)),
    },
    {
      key: 'actions',
      header: words.columns.actions,
      actions: true,
      cell: (item) => {
        const editLabel = words.rowActions.edit(item.name);
        const retired = isRetired(item);
        const toggleLabel = retired ? words.rowActions.useAgain(item.name) : words.rowActions.retire(item.name);
        const removeLabel = words.rowActions.remove(item.name);
        return (
          <RowActions>
            <RowAction
              key="edit"
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
            {/* SPEC-GAP: OQ-4 Others is never retired, so it offers Edit only (OQ-6). One element for both states keeps focus on it. */}
            {item.isOthers ? (
              <ActionSlot />
            ) : (
              <RowAction
                key="toggle"
                icon={retired ? 'archive-restore' : 'archive'}
                label={toggleLabel}
                title={toggleLabel}
                onClick={() => {
                  wiring.toggle(item);
                }}
                ref={(button) => {
                  wiring.register(toggleKey(item.id), button);
                }}
              />
            )}
            {/* Only an entry nothing has ever used, deleted records included, can be deleted (D-10, D-30). */}
            {!item.isOthers && config.countOf(item) === 0 ? (
              <RowAction
                key="delete"
                icon="trash-2"
                label={removeLabel}
                title={removeLabel}
                danger
                onClick={() => {
                  wiring.remove(item);
                }}
              />
            ) : (
              <ActionSlot />
            )}
          </RowActions>
        );
      },
    },
  ];
}

export interface ListSettingsSectionProps {
  config: ListSettingsConfig;
}

export function ListSettingsSection({ config }: ListSettingsSectionProps) {
  const words = config.words;
  const headingId = `settings-${config.list}-title`;
  const cardHeadingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const entries = config.useEntries();
  const refresh = useRefreshList(config.list);
  const rowFocus = useRowFocus();
  // Where focus goes once the deleted row has left the list.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  // The entry the Delete confirmation is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ row: SettingsListRow; open: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  // The entry the Edit modal is open for, or was last open for (kept while it animates out).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // The trigger takes focus back when the modal closes; the lists then read again (a rename shows everywhere, D-12).
  const added = (saved: SavedCategory): void => {
    toast.show({
      tone: 'success',
      title: words.modal.add.toast.title,
      message: words.modal.add.toast.message(saved.name),
    });
    void refresh();
  };

  const updated = (saved: SavedCategory): void => {
    toast.show({
      tone: 'success',
      title: words.modal.edit.toast.title,
      message: words.modal.edit.toast.message(saved.name),
    });
    void refresh();
  };

  // Retire and Use again show the new status at once (the cache is flipped), then the lists read again to confirm it.
  const flip = (id: string, status: 'active' | 'retired'): void => {
    queryClient.setQueryData<SettingsListRow[]>(config.entriesKey, (current) =>
      current?.map((row) => (row.id === id ? { ...row, status } : row)),
    );
  };

  // After the flip is confirmed, focus is on the flipped action; if the lists replaced it and focus fell to the page, put it back.
  const keepFocusOn = (id: string): void => {
    const active = document.activeElement;
    if (active === null || active === document.body) {
      rowFocus.focusRow(toggleKey(id));
    }
  };

  const failureToast = (title: string, error: unknown): void => {
    const copy = describeHttpError(error);
    if (copy !== null) {
      toast.show({ tone: 'danger', title, message: errorLine(copy) });
    }
  };

  const retirement = useExpenseAction<SettingsListRow>(
    (key, row) => config.service.retire(row.id, key),
    (row) => {
      flip(row.id, 'retired');
      toast.show({
        tone: 'success',
        title: words.retire.toast.title,
        message: words.retire.toast.message(row.name),
      });
      return refresh().then(() => {
        keepFocusOn(row.id);
      });
    },
  );

  const reactivation = useExpenseAction<SettingsListRow>(
    (key, row) => config.service.reactivate(row.id, key),
    (row) => {
      flip(row.id, 'active');
      toast.show({
        tone: 'success',
        title: words.reactivate.toast.title,
        message: words.reactivate.toast.message(row.name),
      });
      return refresh().then(() => {
        keepFocusOn(row.id);
      });
    },
  );

  const toggle = async (row: SettingsListRow): Promise<void> => {
    const retiring = !isRetired(row);
    const outcome = await (retiring ? retirement : reactivation).submit(row);
    if (!outcome.ok) {
      // A 404 means the entry was deleted meanwhile, so the lists read again.
      if (isHttpError(outcome.error) && outcome.error.status === 404) {
        void refresh();
      }
      failureToast(retiring ? words.retire.failed(row.name) : words.reactivate.failed(row.name), outcome.error);
    }
  };

  // Focus lands on the Edit button of the next row, else the previous one, else the card heading.
  const chooseFocusAfter = (row: SettingsListRow): string | null => {
    const items = entries.data ?? [];
    const index = items.findIndex((item) => item.id === row.id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useExpenseAction<SettingsListRow>(
    (_key, row) => config.service.remove(row.id),
    (row) => {
      afterRemoval.current = { removedId: row.id, focusId: chooseFocusAfter(row) };
      closeDelete();
      toast.show({
        tone: 'success',
        title: words.remove.toast.title,
        message: words.remove.toast.message(row.name),
      });
      return refresh();
    },
  );

  // Once the list no longer holds the deleted row, move focus (the dialog's own return to the gone button has run).
  useEffect(() => {
    const wanted = afterRemoval.current;
    const items = entries.data;
    if (wanted === null || items === undefined || items.some((item) => item.id === wanted.removedId)) {
      return;
    }
    afterRemoval.current = null;
    if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
      cardHeadingRef.current?.focus();
    }
  });

  // The dialog's own failure line: a record that started using the entry meanwhile gets the refusal, and the list reads again.
  const describeDeleteFailure = (error: unknown): ErrorCopy | undefined =>
    deleting !== null && isHttpError(error) && error.status === 422 && error.code === config.inUseCode
      ? { title: words.remove.inUse.title(deleting.row.name), body: words.remove.inUse.body }
      : undefined;

  const confirmDelete = async () => {
    if (deleting === null) {
      return undefined;
    }
    const outcome = await removal.submit(deleting.row);
    if (!outcome.ok && isHttpError(outcome.error) && (outcome.error.status === 422 || outcome.error.status === 404)) {
      void refresh();
    }
    return outcome;
  };

  const wiring: RowWiring = {
    edit: (row) => {
      setEditingId(row.id);
      setEditing(true);
    },
    toggle: (row) => {
      void toggle(row);
    },
    remove: (row) => {
      setDeleting({ row, open: true });
    },
    register: rowFocus.register,
  };

  return (
    <>
      <section className={profileCardClasses} aria-labelledby={headingId}>
        <div className={profileCardHeadClasses}>
          <div className={settingsHeadTextClasses}>
            <h2 id={headingId} ref={cardHeadingRef} tabIndex={-1} className={profileCardTitleClasses}>
              {words.card.title}
            </h2>
            <p className={profileCardHintClasses}>{words.card.hint}</p>
          </div>
          <Button
            variant="primary"
            icon="plus"
            className={settingsAddButtonClasses}
            onClick={() => {
              setAdding(true);
            }}
          >
            {words.card.add}
          </Button>
        </div>
        <div className={profileCardBodyClasses}>
          <ResponsiveTable<SettingsListRow>
            caption={words.tableCaption}
            columns={columns(config, wiring)}
            rows={entries.data}
            rowKey={(item) => item.id}
            isInactive={isRetired}
            fitTablet
            things={words.things}
            pending={entries.isPending}
            failed={entries.isError}
            error={entries.error}
            onRetry={() => {
              void entries.refetch();
            }}
          />
          <p className={expensesCaptionClasses}>{words.caption}</p>
        </div>
      </section>
      <CategoryModal
        mode="add"
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSaved={added}
      />
      <CategoryModal
        mode="edit"
        open={editing}
        categoryId={editingId}
        onClose={() => {
          setEditing(false);
        }}
        onSaved={updated}
      />
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={words.remove.title(deleting.row.name)}
          message={words.remove.message}
          confirmLabel={words.remove.confirm}
          pendingLabel={words.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
          describeFailure={describeDeleteFailure}
        />
      )}
    </>
  );
}
