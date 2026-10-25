// SPEC-GAP: S1 SettingsPage. S1 Settings, /admin/settings (UI-SPEC "S1 Settings"; D-08..D-15, D-30, OQ-3..OQ-6; plan 06-17). The Manager-only
// page for lists the whole team uses; today one card, Expense Categories (Phase 11 may add more below it, D-14): the `.s-ph` header with
// the "Manager only" badge, then the card with a ResponsiveTable of every category in the server's order (A to Z, Others last, retired
// rows in place with the inactive look).
//   - The route's loader (requireManager) sends an Admin to /admin; the API answers 403 for a role lost mid-session.
//   - The list is never empty (the seed ships ten categories and Others cannot be deleted), so it has no first-use state.
import { useEffect, useRef } from 'react';
import { Button } from '@/components/actions';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
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
import type { ExpenseCategoryListItem } from '@/modules/admin/services/expenseCategoriesService';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';

const COPY = SETTINGS_COPY;

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

const isRetired = (category: ExpenseCategoryListItem): boolean => category.status === 'retired';

function columns(): readonly ResponsiveTableColumn<ExpenseCategoryListItem>[] {
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
      cell: () => <RowActions />,
    },
  ];
}

export function SettingsRoute() {
  const cardHeadingRef = useRef<HTMLHeadingElement>(null);
  const categories = useExpenseCategoriesQuery();

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

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
          <Button variant="primary" icon="plus" className={settingsAddButtonClasses}>
            {COPY.card.add}
          </Button>
        </div>
        <div className={profileCardBodyClasses}>
          <ResponsiveTable<ExpenseCategoryListItem>
            caption={COPY.tableCaption}
            columns={columns()}
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
    </div>
  );
}
