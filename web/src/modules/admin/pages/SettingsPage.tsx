// SPEC-GAP: S1 SettingsPage. S1 Settings, /admin/settings (UI-SPEC "S1 Settings"; D-08..D-15, D-30, OQ-3..OQ-6; plan 06-17). The Manager-only
// page for lists the whole team uses; today one card, Expense Categories (Phase 11 may add more below it, D-14): the `.s-ph` header with
// the "Manager only" badge, then the card with a ResponsiveTable of every category in the server's order (A to Z, Others last, retired
// rows in place with the inactive look). Add Category and each row's Edit open the Category modal; a save toasts, reads every list that
// shows a category again (D-12) and leaves focus on the button that opened it (Add Category, or that row's Edit).
//   - Retire and Use again act at once with no confirmation (OQ-4, OQ-5): the status and the action flip in the cache, focus stays on the
//     flipped action, and the toast states the effect. A failure is a danger toast that stays until closed; a retry keeps its Idempotency-Key.
//   - Delete is offered only for a category with no expense, deleted ones included, and never for Others (D-10, D-30). It sits behind the
//     plain ConfirmDialog; if an expense started using the category meanwhile the server refuses (422), the dialog stays open with the
//     refusal and the list reads again so Delete disappears. A removed row hands focus to the next row's Edit, else the previous, else
//     the card heading.
//   - The route's loader (requireManager) sends an Admin to /admin; the API answers 403 for a role lost mid-session.
//   - The list is never empty (the seed ships ten categories and Others cannot be deleted), so it has no first-use state.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { Badge } from '@/components/status';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { CategoryModal, type SavedCategory } from '@/modules/admin/components/CategoryModal';
import { expensesCaptionClasses, expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardTitleClasses,
  profilePageClasses,
} from '@/modules/admin/components/profile.recipe';
import {
  settingsAddButtonClasses,
  settingsCategoryCellClasses,
  settingsHeadTextClasses,
  settingsSublineClasses,
} from '@/modules/admin/components/settings.recipe';
import { isHttpError } from '@/core/api/errors';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { expenseCategoriesKey, useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useRefreshCategories } from '@/modules/admin/hooks/useRefreshCategories';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import {
  expenseCategoriesService,
  type ExpenseCategoryListItem,
} from '@/modules/admin/services/expenseCategoriesService';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = SETTINGS_COPY;

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

const isRetired = (category: ExpenseCategoryListItem): boolean => category.status === 'retired';

/** The 422 the server answers when an expense uses the category (D-30). */
const IN_USE = 'expense-categories.in-use';

/** The focus registry key of a row's Retire / Use again button (the Edit button is registered under the plain id). */
const toggleKey = (id: string): string => `toggle:${id}`;

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  edit: (category: ExpenseCategoryListItem) => void;
  /** Retires an active category, or brings a retired one back. */
  toggle: (category: ExpenseCategoryListItem) => void;
  /** Opens the delete confirmation. */
  remove: (category: ExpenseCategoryListItem) => void;
  /** Remembers each row's buttons, so focus can return to them. */
  register: (id: string, button: HTMLButtonElement | null) => void;
}

function columns(wiring: RowWiring): readonly ResponsiveTableColumn<ExpenseCategoryListItem>[] {
  return [
    {
      key: 'category',
      header: COPY.columns.category,
      lead: true,
      cell: (item) => (
        <span className={settingsCategoryCellClasses}>
          <CategoryBadge category={item} />
          {item.isOthers && <span className={settingsSublineClasses}>{COPY.othersSubline}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: COPY.columns.status,
      cell: (item) =>
        isRetired(item) ? (
          <Badge tone="neutral" dot>
            {COPY.status.retired}
          </Badge>
        ) : (
          <Badge tone="success" dot>
            {COPY.status.active}
          </Badge>
        ),
    },
    {
      key: 'expenses',
      header: COPY.columns.expenses,
      money: true,
      cell: (item) => String(toNumber(item.expenseCount)),
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const editLabel = COPY.rowActions.edit(item.name);
        const retired = isRetired(item);
        const toggleLabel = retired ? COPY.rowActions.useAgain(item.name) : COPY.rowActions.retire(item.name);
        const removeLabel = COPY.rowActions.remove(item.name);
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
            {!item.isOthers && (
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
            {/* Only a category no expense has ever used, deleted ones included, can be deleted (D-10, D-30). */}
            {!item.isOthers && toNumber(item.expenseCount) === 0 && (
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
            )}
          </RowActions>
        );
      },
    },
  ];
}

export function SettingsRoute() {
  const cardHeadingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const categories = useExpenseCategoriesQuery();
  const refresh = useRefreshCategories();
  const rowFocus = useRowFocus();
  // Where focus goes once the deleted row has left the list.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  // The category the Delete confirmation is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ category: ExpenseCategoryListItem; open: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  // The category the Edit modal is open for, or was last open for (kept while it animates out).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  // The trigger takes focus back when the modal closes; the lists then read again (a rename shows everywhere, D-12).
  const added = (category: SavedCategory): void => {
    toast.show({
      tone: 'success',
      title: COPY.modal.add.toast.title,
      message: COPY.modal.add.toast.message(category.name),
    });
    void refresh();
  };

  const updated = (category: SavedCategory): void => {
    toast.show({
      tone: 'success',
      title: COPY.modal.edit.toast.title,
      message: COPY.modal.edit.toast.message(category.name),
    });
    void refresh();
  };

  // Retire and Use again show the new status at once (the cache is flipped), then the lists read again to confirm it.
  const flip = (id: string, status: 'active' | 'retired'): void => {
    queryClient.setQueryData<ExpenseCategoryListItem[]>(expenseCategoriesKey, (current) =>
      current?.map((category) => (category.id === id ? { ...category, status } : category)),
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

  const retirement = useExpenseAction<ExpenseCategoryListItem>(
    (key, category) => expenseCategoriesService.retire(category.id, key),
    (category) => {
      flip(category.id, 'retired');
      toast.show({
        tone: 'success',
        title: COPY.retire.toast.title,
        message: COPY.retire.toast.message(category.name),
      });
      return refresh().then(() => {
        keepFocusOn(category.id);
      });
    },
  );

  const reactivation = useExpenseAction<ExpenseCategoryListItem>(
    (key, category) => expenseCategoriesService.reactivate(category.id, key),
    (category) => {
      flip(category.id, 'active');
      toast.show({
        tone: 'success',
        title: COPY.reactivate.toast.title,
        message: COPY.reactivate.toast.message(category.name),
      });
      return refresh().then(() => {
        keepFocusOn(category.id);
      });
    },
  );

  const toggle = async (category: ExpenseCategoryListItem): Promise<void> => {
    const retiring = !isRetired(category);
    const outcome = await (retiring ? retirement : reactivation).submit(category);
    if (!outcome.ok) {
      // A 404 means the category was deleted meanwhile, so the lists read again.
      if (isHttpError(outcome.error) && outcome.error.status === 404) {
        void refresh();
      }
      failureToast(retiring ? COPY.retire.failed(category.name) : COPY.reactivate.failed(category.name), outcome.error);
    }
  };

  // Focus lands on the Edit button of the next row, else the previous one, else the card heading.
  const chooseFocusAfter = (category: ExpenseCategoryListItem): string | null => {
    const items = categories.data ?? [];
    const index = items.findIndex((item) => item.id === category.id);
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useExpenseAction<ExpenseCategoryListItem>(
    (_key, category) => expenseCategoriesService.remove(category.id),
    (category) => {
      afterRemoval.current = { removedId: category.id, focusId: chooseFocusAfter(category) };
      closeDelete();
      toast.show({
        tone: 'success',
        title: COPY.remove.toast.title,
        message: COPY.remove.toast.message(category.name),
      });
      return refresh();
    },
  );

  // Once the list no longer holds the deleted row, move focus (the dialog's own return to the gone button has run).
  useEffect(() => {
    const wanted = afterRemoval.current;
    const items = categories.data;
    if (wanted === null || items === undefined || items.some((item) => item.id === wanted.removedId)) {
      return;
    }
    afterRemoval.current = null;
    if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
      cardHeadingRef.current?.focus();
    }
  });

  // The dialog's own failure line: an expense that started using the category meanwhile gets the refusal, and the list reads again.
  const describeDeleteFailure = (error: unknown): ErrorCopy | undefined =>
    deleting !== null && isHttpError(error) && error.status === 422 && error.code === IN_USE
      ? { title: COPY.remove.inUse.title(deleting.category.name), body: COPY.remove.inUse.body }
      : undefined;

  const confirmDelete = async () => {
    if (deleting === null) {
      return undefined;
    }
    const outcome = await removal.submit(deleting.category);
    if (!outcome.ok && isHttpError(outcome.error) && (outcome.error.status === 422 || outcome.error.status === 404)) {
      void refresh();
    }
    return outcome;
  };

  const wiring: RowWiring = {
    edit: (category) => {
      setEditingId(category.id);
      setEditing(true);
    },
    toggle: (category) => {
      void toggle(category);
    },
    remove: (category) => {
      setDeleting({ category, open: true });
    },
    register: rowFocus.register,
  };

  return (
    <div className={profilePageClasses}>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={expensesTitleRowClasses}>
            <h1 className={pageTitleClasses}>{COPY.title}</h1>
            <Badge tone="accent" icon="shield-check">
              {COPY.badge}
            </Badge>
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <section className={profileCardClasses} aria-labelledby="settings-categories-title">
        <div className={profileCardHeadClasses}>
          <div className={settingsHeadTextClasses}>
            <h2 id="settings-categories-title" ref={cardHeadingRef} tabIndex={-1} className={profileCardTitleClasses}>
              {COPY.card.title}
            </h2>
            <p className={profileCardHintClasses}>{COPY.card.hint}</p>
          </div>
          <Button
            variant="primary"
            icon="plus"
            className={settingsAddButtonClasses}
            onClick={() => {
              setAdding(true);
            }}
          >
            {COPY.card.add}
          </Button>
        </div>
        <div className={profileCardBodyClasses}>
          <ResponsiveTable<ExpenseCategoryListItem>
            caption={COPY.tableCaption}
            columns={columns(wiring)}
            rows={categories.data}
            rowKey={(item) => item.id}
            isInactive={isRetired}
            things={COPY.things}
            pending={categories.isPending}
            failed={categories.isError}
            error={categories.error}
            onRetry={() => {
              void categories.refetch();
            }}
          />
          <p className={expensesCaptionClasses}>{COPY.caption}</p>
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
          title={COPY.remove.title(deleting.category.name)}
          message={COPY.remove.message}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
          describeFailure={describeDeleteFailure}
        />
      )}
    </div>
  );
}
