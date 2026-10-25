// SPEC-GAP: S1 SettingsPage. S1 Settings, /admin/settings (UI-SPEC "S1 Settings"; D-08..D-15, D-30, OQ-3..OQ-6; plan 06-17). The Manager-only
// page for lists the whole team uses; today one card, Expense Categories (Phase 11 may add more below it, D-14): the `.s-ph` header with
// the "Manager only" badge, then the card with a ResponsiveTable of every category in the server's order (A to Z, Others last, retired
// rows in place with the inactive look). Add Category and each row's Edit open the Category modal; a save toasts, reads every list that
// shows a category again (D-12) and leaves focus on the button that opened it (Add Category, or that row's Edit).
//   - The route's loader (requireManager) sends an Admin to /admin; the API answers 403 for a role lost mid-session.
//   - The list is never empty (the seed ships ten categories and Others cannot be deleted), so it has no first-use state.
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
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useRefreshCategories } from '@/modules/admin/hooks/useRefreshCategories';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { ExpenseCategoryListItem } from '@/modules/admin/services/expenseCategoriesService';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';

const COPY = SETTINGS_COPY;

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

const isRetired = (category: ExpenseCategoryListItem): boolean => category.status === 'retired';

/** What the table needs to wire a row's buttons. */
interface RowWiring {
  edit: (category: ExpenseCategoryListItem) => void;
  /** Remembers each row's Edit button, so focus can return to it. */
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
          </RowActions>
        );
      },
    },
  ];
}

export function SettingsRoute() {
  const cardHeadingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const categories = useExpenseCategoriesQuery();
  const refresh = useRefreshCategories();
  const rowFocus = useRowFocus();
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

  const wiring: RowWiring = {
    edit: (category) => {
      setEditingId(category.id);
      setEditing(true);
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
    </div>
  );
}
