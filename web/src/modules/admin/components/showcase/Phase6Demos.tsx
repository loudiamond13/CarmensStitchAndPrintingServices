// The Phase 6 demos of the Component Showcase (UI-SPEC Component Inventory; D-32, D-33; plan 06-18): the Company Expenses and Settings
// pieces on made-up people and values, in the "Expenses and settings" section, with the longest and largest values the rules allow
// (a 200-character description, a 100-character staff name, a 40-character category name, 1,000 characters of notes, an expense at
// the amount limit and a period total at the largest figure). The tables, cards, badges and dialogs are the real shared parts
// wired to local state: nothing here reads or writes a record, so the demos are safe in the public chunk (T-05-105, T-06-57).
// The static cases sit in page-root frames; a live demo that opens a fixed layer sits in a frame that is no page root.
import clsx from 'clsx';
import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  ActorName,
  Avatar,
  Badge,
  Button,
  CATEGORY_TONE_LABEL,
  CATEGORY_TONES,
  ConfirmDialog,
  ConflictBanner,
  DateInput,
  EmptyValue,
  Field,
  KpiCard,
  labelClasses,
  Modal,
  Money,
  MoneyInput,
  Note,
  RadioGroup,
  RecordMeta,
  ResponsiveTable,
  RowAction,
  RowActions,
  Select,
  type RadioOption,
  type ResponsiveTableColumn,
  type SelectOption,
} from '@/components';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { ExpenseActorCell } from '@/modules/admin/components/ExpenseActorCell';
import {
  expensesActorClasses,
  expensesAvatarClasses,
  expensesDateCellClasses,
  expensesDateClasses,
  expensesFieldStackClasses,
  expensesFormGridClasses,
  expensesFullRowClasses,
  expensesKpiRowClasses,
  expensesModalBodyClasses,
  expensesReadOnlyClasses,
  expensesReadOnlyFieldClasses,
  expensesViewNotesClasses,
  expensesViewValueClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import { settingsCategoryCellClasses, settingsSublineClasses } from '@/modules/admin/components/settings.recipe';
import { staffStackClasses } from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';
import type {
  ActorRef,
  DeletedExpenseListItem,
  ExpenseCategoryRef,
  ExpenseListItem,
} from '@/modules/admin/services/expensesService';
import type { ExpenseCategoryListItem } from '@/modules/admin/services/expenseCategoriesService';
import { formatPeso } from '@/utils/csps';
import { formatBusinessDateTime, formatCalendarDate, formatMonthShort } from '@/utils/format';

const COPY = EXPENSES_COPY;
const DEMO = SHOWCASE_COPY.expenses;
const SETTINGS = SETTINGS_COPY;

/** The demo's business today (spec section 12 dates): an expense dated after it is Upcoming. */
const DEMO_TODAY = '2026-10-12';

/** Exactly 200 characters, the description limit. */
const LONG_DESCRIPTION = `${'Meralco bill '.repeat(16)}end`.slice(0, 200);
/** Exactly 100 characters, the staff name limit. */
const LONG_NAME = `Maria ${'Santos'.repeat(16)}`.slice(0, 100);
/** Exactly 40 characters, the category name limit. */
const LONG_CATEGORY_NAME = 'Equipment, repairs and maintenance works';
/** Exactly 1,000 characters, the notes limit. */
const LONG_NOTES = 'Paid cash at the counter, receipt kept in the folder. '.repeat(19).slice(0, 1000);
/** The largest amount one expense may have, and the largest figure a total shows. */
const MAX_AMOUNT = 1_000_000;
const HUGE_PERIOD_TOTAL = 999_999_999.99;

const CARMEN: ActorRef = { id: '11111111-1111-4111-8111-111111111111', name: 'Carmen Reyes', formerStaff: false };
const PAOLO: ActorRef = { id: '22222222-2222-4222-8222-222222222222', name: 'Paolo Garcia', formerStaff: false };
const FORMER: ActorRef = { id: '44444444-4444-4444-8444-444444444444', name: LONG_NAME, formerStaff: true };

const RENT: ExpenseCategoryRef = {
  id: 'c0000000-0000-4000-8000-000000000001',
  name: 'Rent',
  tone: 'accent',
  retired: false,
};
const SUPPLIES: ExpenseCategoryRef = {
  id: 'c0000000-0000-4000-8000-000000000002',
  name: 'Supplies',
  tone: 'warning',
  retired: false,
};
const SALARIES: ExpenseCategoryRef = {
  id: 'c0000000-0000-4000-8000-000000000003',
  name: 'Salaries',
  tone: 'mockup',
  retired: false,
};
const RETIRED_LONG: ExpenseCategoryRef = {
  id: 'c0000000-0000-4000-8000-000000000004',
  name: LONG_CATEGORY_NAME,
  tone: 'info',
  retired: true,
};

/** E1 rows: an Upcoming one, one at every limit (long description, former staff payer, retired long category, the largest amount), two plain ones and one the system recorded. */
const EXPENSE_ROWS: readonly ExpenseListItem[] = [
  {
    id: 'x1',
    date: '2026-10-20',
    category: RENT,
    description: 'Shop rent for November, paid early',
    amount: 12450,
    paidBy: CARMEN,
    recordedBy: CARMEN,
    canEdit: true,
  },
  {
    id: 'x2',
    date: '2026-10-11',
    category: RETIRED_LONG,
    description: LONG_DESCRIPTION,
    amount: MAX_AMOUNT,
    paidBy: FORMER,
    recordedBy: PAOLO,
    canEdit: true,
  },
  {
    id: 'x3',
    date: '2026-10-09',
    category: SUPPLIES,
    description: 'Thread and needles',
    amount: 640,
    paidBy: PAOLO,
    recordedBy: CARMEN,
    canEdit: true,
  },
  {
    id: 'x4',
    date: '2026-10-06',
    category: SALARIES,
    description: 'October payroll',
    amount: 48500,
    paidBy: CARMEN,
    recordedBy: null,
    canEdit: true,
  },
];

/** E4 rows: one deleted by a former staff member with every limit, one plain. */
const DELETED_ROWS: readonly DeletedExpenseListItem[] = [
  {
    id: 'd1',
    deletedAt: '2026-10-12T07:42:00Z',
    deletedBy: FORMER,
    date: '2026-10-06',
    category: RENT,
    description: LONG_DESCRIPTION,
    amount: MAX_AMOUNT,
    paidBy: CARMEN,
  },
  {
    id: 'd2',
    deletedAt: '2026-10-11T02:15:00Z',
    deletedBy: CARMEN,
    date: '2026-10-05',
    category: SUPPLIES,
    description: 'Duplicate courier fee',
    amount: 350,
    paidBy: PAOLO,
  },
];

/** S1 rows: active and used, retired and used, never used with a 40-character name, and Others. */
const CATEGORY_ROWS: readonly ExpenseCategoryListItem[] = [
  { id: RENT.id, name: RENT.name, tone: RENT.tone, status: 'active', isOthers: false, expenseCount: 12 },
  {
    id: 'c0000000-0000-4000-8000-000000000005',
    name: 'Old subscriptions',
    tone: 'neutral',
    status: 'retired',
    isOthers: false,
    expenseCount: 3,
  },
  {
    id: RETIRED_LONG.id,
    name: LONG_CATEGORY_NAME,
    tone: 'info',
    status: 'active',
    isOthers: false,
    expenseCount: 0,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000006',
    name: 'Others',
    tone: 'neutral',
    status: 'active',
    isOthers: true,
    expenseCount: 4,
  },
];

/** The generated types allow a number or text for a number; the demos hold numbers. */
function toNumber(value: number | string): number {
  return Number(value);
}

function expenseColumns(): readonly ResponsiveTableColumn<ExpenseListItem>[] {
  return [
    {
      key: 'date',
      header: COPY.columns.date,
      lead: true,
      cell: (item) => (
        <span className={expensesDateCellClasses}>
          <strong className={expensesDateClasses}>{formatCalendarDate(item.date) ?? <EmptyValue />}</strong>
          {item.date > DEMO_TODAY && (
            <Badge tone="info" icon="clock">
              {COPY.upcoming}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'category', header: COPY.columns.category, cell: (item) => <CategoryBadge category={item.category} /> },
    {
      key: 'description',
      header: COPY.columns.description,
      cell: (item) => <span className={expensesWrapClasses}>{item.description}</span>,
    },
    {
      key: 'amount',
      header: COPY.columns.amount,
      money: true,
      cell: (item) => <Money amount={toNumber(item.amount)} />,
    },
    { key: 'paidBy', header: COPY.columns.paidBy, cell: (item) => <ExpenseActorCell actor={item.paidBy} /> },
    {
      key: 'recordedBy',
      header: COPY.columns.recordedBy,
      cell: (item) => <ExpenseActorCell actor={item.recordedBy} />,
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const date = formatCalendarDate(item.date) ?? item.date;
        const edit = COPY.rowActions.edit(item.description, date);
        const remove = COPY.remove.rowDelete(item.description, date);
        const purge = COPY.purge.rowLabel(item.description, date);
        return (
          <RowActions>
            <RowAction icon="pencil" label={edit} title={edit} />
            <RowAction icon="trash-2" label={remove} title={remove} danger />
            <RowAction icon="eraser" label={purge} title={purge} danger />
          </RowActions>
        );
      },
    },
  ];
}

function ExpenseTableDemo() {
  const total = 45;
  const from = formatCalendarDate('2026-09-12');
  const to = formatCalendarDate('2026-11-11');
  return (
    <ResponsiveTable<ExpenseListItem>
      caption={COPY.tableCaption}
      columns={expenseColumns()}
      rows={EXPENSE_ROWS}
      rowKey={(item) => item.id}
      things={COPY.things}
      footer={{
        date: from !== null && to !== null ? COPY.footer.summary(total, COPY.thing, COPY.things, from, to) : null,
        amount: <Money amount={HUGE_PERIOD_TOTAL} />,
      }}
      footerLayout={{ date: { span: 3 }, amount: { label: COPY.footer.totalLabel } }}
    />
  );
}

function deletedColumns(): readonly ResponsiveTableColumn<DeletedExpenseListItem>[] {
  const words = COPY.deleted;
  return [
    {
      key: 'deleted',
      header: words.columns.deleted,
      lead: true,
      cell: (item) => {
        const text = formatBusinessDateTime(item.deletedAt);
        return text === null ? null : <time dateTime={item.deletedAt}>{text}</time>;
      },
    },
    { key: 'date', header: words.columns.date, cell: (item) => formatCalendarDate(item.date) },
    { key: 'category', header: words.columns.category, cell: (item) => <CategoryBadge category={item.category} /> },
    {
      key: 'description',
      header: words.columns.description,
      cell: (item) => <span className={expensesWrapClasses}>{item.description}</span>,
    },
    {
      key: 'amount',
      header: words.columns.amount,
      money: true,
      cell: (item) => <Money amount={toNumber(item.amount)} />,
    },
    { key: 'paidBy', header: words.columns.paidBy, cell: (item) => <ExpenseActorCell actor={item.paidBy} /> },
    { key: 'deletedBy', header: words.columns.deletedBy, cell: (item) => <ExpenseActorCell actor={item.deletedBy} /> },
    {
      key: 'actions',
      header: words.columns.actions,
      actions: true,
      cell: (item) => {
        const date = formatCalendarDate(item.date) ?? item.date;
        const restore = words.restore.label(item.description, date);
        const purge = COPY.purge.rowLabel(item.description, date);
        return (
          <RowActions>
            <RowAction icon="rotate-ccw" label={restore} title={restore} />
            <RowAction icon="eraser" label={purge} title={purge} danger />
          </RowActions>
        );
      },
    },
  ];
}

function DeletedRowsDemo() {
  return (
    <ResponsiveTable<DeletedExpenseListItem>
      caption={COPY.deleted.tableCaption}
      columns={deletedColumns()}
      rows={DELETED_ROWS}
      rowKey={(item) => item.id}
      things={COPY.deleted.things}
    />
  );
}

function categoryColumns(): readonly ResponsiveTableColumn<ExpenseCategoryListItem>[] {
  return [
    {
      key: 'category',
      header: SETTINGS.columns.category,
      lead: true,
      cell: (item) => (
        <span className={settingsCategoryCellClasses}>
          <CategoryBadge category={item} />
          {item.isOthers && <span className={settingsSublineClasses}>{SETTINGS.othersSubline}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: SETTINGS.columns.status,
      cell: (item) =>
        item.status === 'retired' ? (
          <Badge tone="neutral" dot>
            {SETTINGS.status.retired}
          </Badge>
        ) : (
          <Badge tone="success" dot>
            {SETTINGS.status.active}
          </Badge>
        ),
    },
    {
      key: 'expenses',
      header: SETTINGS.columns.expenses,
      money: true,
      cell: (item) => String(toNumber(item.expenseCount)),
    },
    {
      key: 'actions',
      header: SETTINGS.columns.actions,
      actions: true,
      cell: (item) => {
        const retired = item.status === 'retired';
        const edit = SETTINGS.rowActions.edit(item.name);
        const toggle = retired ? SETTINGS.rowActions.useAgain(item.name) : SETTINGS.rowActions.retire(item.name);
        const remove = SETTINGS.rowActions.remove(item.name);
        return (
          <RowActions>
            <RowAction icon="pencil" label={edit} title={edit} />
            {!item.isOthers && (
              <RowAction icon={retired ? 'archive-restore' : 'archive'} label={toggle} title={toggle} />
            )}
            {!item.isOthers && toNumber(item.expenseCount) === 0 && (
              <RowAction icon="trash-2" label={remove} title={remove} danger />
            )}
          </RowActions>
        );
      },
    },
  ];
}

function CategoryRowsDemo() {
  return (
    <ResponsiveTable<ExpenseCategoryListItem>
      caption={SETTINGS.tableCaption}
      columns={categoryColumns()}
      rows={CATEGORY_ROWS}
      rowKey={(item) => item.id}
      isInactive={(item) => item.status === 'retired'}
      things={SETTINGS.things}
    />
  );
}

interface KpiRowDemoProps {
  /** True for a month with no expenses: the Top category card shows the empty value. */
  empty?: boolean;
}

/** The three month cards of the E1 page on the largest figures, or with the empty Top category. */
function KpiRowDemo({ empty = false }: KpiRowDemoProps) {
  const month = formatMonthShort('2026-10-01');
  const last = formatMonthShort('2026-09-01');
  const kpis = COPY.kpis;
  return (
    <div className={expensesKpiRowClasses}>
      <KpiCard
        label={kpis.thisMonth(month)}
        value={empty ? 0 : HUGE_PERIOD_TOTAL}
        icon="receipt"
        hint={kpis.entries(empty ? 0 : 1234)}
      />
      <KpiCard label={kpis.lastMonth(last)} value={empty ? 0 : MAX_AMOUNT} icon="calendar" hint={kpis.fullMonth} />
      <KpiCard
        label={kpis.topCategory(month)}
        value={empty ? '' : LONG_CATEGORY_NAME}
        money={false}
        icon="trending-up"
        hint={empty ? kpis.noExpenses : kpis.topFoot(formatPeso(400_000), 47)}
        empty={empty}
      />
    </div>
  );
}

type ExpenseKind = 'add' | 'edit' | 'view';

/** How long Load Latest reads "Loading" before the banner leaves. */
const LOAD_MS = 300;

const PAID_BY_OPTIONS: readonly SelectOption[] = [
  { value: CARMEN.id, label: COPY.form.paidBy.you(CARMEN.name) },
  { value: PAOLO.id, label: PAOLO.name },
  { value: FORMER.id, label: COPY.form.paidBy.formerStaff(FORMER.name) },
];

const CATEGORY_OPTIONS: readonly SelectOption[] = [
  { value: RENT.id, label: RENT.name },
  { value: SUPPLIES.id, label: SUPPLIES.name },
  { value: SALARIES.id, label: SALARIES.name },
  { value: RETIRED_LONG.id, label: COPY.category.retired(RETIRED_LONG.name) },
];

interface ExpenseValues {
  date: string;
  categoryId: string;
  description: string;
  amount: string;
  paidById: string;
  notes: string;
}

const BLANK_EXPENSE: ExpenseValues = {
  date: DEMO_TODAY,
  categoryId: '',
  description: '',
  amount: '',
  paidById: CARMEN.id,
  notes: '',
};

/** The saved expense of the edit and view demos: every limit at once. */
const SAVED_EXPENSE: ExpenseValues = {
  date: '2026-10-11',
  categoryId: RETIRED_LONG.id,
  description: LONG_DESCRIPTION,
  amount: '1000000.00',
  paidById: FORMER.id,
  notes: LONG_NOTES,
};

/** One label and its read-only value in the view grid. */
function ViewRow({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={clsx(expensesReadOnlyFieldClasses, full && expensesFullRowClasses)}>
      <dt className={labelClasses}>{label}</dt>
      <dd className={expensesViewValueClasses}>{children}</dd>
    </div>
  );
}

const SAVED_RECORD = {
  recordedBy: FORMER,
  recordedAt: '2026-10-06T01:00:00Z',
  lastChangedBy: PAOLO,
  lastChangedAt: '2026-10-12T07:42:00Z',
} as const;

interface ExpenseModalDemoProps {
  kind: ExpenseKind;
  open: boolean;
  onClose: () => void;
}

/**
 * The E2 modal in add, edit and view mode on local state: the same parts the real modal is made of, with nothing saved. Edit opens
 * with the stale-save banner (Load Latest clears it after a moment) and the note an Admin sees when Paid by moves away (D-26).
 */
function ExpenseModalDemo({ kind, open, onClose }: ExpenseModalDemoProps) {
  const [values, setValues] = useState<ExpenseValues>(kind === 'add' ? BLANK_EXPENSE : SAVED_EXPENSE);
  const [stale, setStale] = useState(kind === 'edit');
  const [loadingLatest, setLoadingLatest] = useState(false);
  useEffect(() => {
    if (!loadingLatest) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setLoadingLatest(false);
      setStale(false);
    }, LOAD_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadingLatest]);
  const set = <K extends keyof ExpenseValues>(key: K, value: ExpenseValues[K]): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const words = kind === 'edit' ? COPY.edit : COPY.add;
  const category = [RENT, SUPPLIES, SALARIES, RETIRED_LONG].find((item) => item.id === values.categoryId) ?? null;

  if (kind === 'view') {
    return (
      <Modal
        open={open}
        title={COPY.view.title}
        description={COPY.add.description}
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            {COPY.view.close}
          </Button>
        }
      >
        {/* The body scrolls on a small screen and holds nothing to press, so it is a named region a keyboard can focus (WCAG 2.1.1). */}
        <div
          className={expensesModalBodyClasses}
          role="region"
          aria-label={COPY.view.title}
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scrolling read-only body must take keyboard focus (WCAG 2.1.1)
          tabIndex={0}
        >
          <dl className={expensesFormGridClasses}>
            <ViewRow label={COPY.form.date.label}>{formatCalendarDate(values.date) ?? <EmptyValue />}</ViewRow>
            <ViewRow label={COPY.category.label}>
              {category === null ? <EmptyValue /> : <CategoryBadge category={category} />}
            </ViewRow>
            <ViewRow label={COPY.form.description.label} full>
              {values.description}
            </ViewRow>
            <ViewRow label={COPY.form.amount.label}>
              <Money amount={MAX_AMOUNT} />
            </ViewRow>
            <ViewRow label={COPY.form.paidBy.label}>
              <span className={expensesActorClasses}>
                <span aria-hidden="true" className={expensesAvatarClasses}>
                  <Avatar name={FORMER.name} size={24} />
                </span>
                <span className={expensesWrapClasses}>
                  <ActorName actor={FORMER} />
                </span>
              </span>
            </ViewRow>
            <ViewRow label={COPY.form.notes.label} full>
              <span className={expensesViewNotesClasses}>{values.notes}</span>
            </ViewRow>
          </dl>
          <RecordMeta {...SAVED_RECORD} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={words.title}
      description={COPY.add.description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {words.cancel}
          </Button>
          <Button variant="primary" icon="check" onClick={onClose}>
            {words.save}
          </Button>
        </>
      }
    >
      <div className={expensesModalBodyClasses}>
        {stale && (
          <ConflictBanner
            pending={loadingLatest}
            onLoadLatest={() => {
              setLoadingLatest(true);
            }}
          />
        )}
        <div className={expensesFormGridClasses}>
          <DateInput
            label={COPY.form.date.label}
            value={values.date}
            hint={COPY.form.date.hint}
            required
            onChange={(value) => {
              set('date', value);
            }}
          />
          <Select
            label={COPY.category.label}
            required
            placeholder={COPY.form.category.placeholder}
            options={CATEGORY_OPTIONS}
            value={values.categoryId}
            onChange={(event) => {
              set('categoryId', event.target.value);
            }}
          />
          <div className={expensesFullRowClasses}>
            <Field
              label={COPY.form.description.label}
              value={values.description}
              placeholder={COPY.form.description.placeholder}
              maxLength={200}
              autoComplete="off"
              required
              onChange={(event) => {
                set('description', event.currentTarget.value);
              }}
            />
          </div>
          <MoneyInput
            label={COPY.form.amount.label}
            value={values.amount}
            required
            onChange={(value) => {
              set('amount', value);
            }}
          />
          <div className={expensesFieldStackClasses}>
            <Select
              label={COPY.form.paidBy.label}
              hint={COPY.form.paidBy.hint}
              options={PAID_BY_OPTIONS}
              value={values.paidById}
              onChange={(event) => {
                set('paidById', event.target.value);
              }}
            />
            {kind === 'edit' && values.paidById !== CARMEN.id && (
              <Note icon="info" live>
                {COPY.edit.accessNote}
              </Note>
            )}
          </div>
          <div className={expensesFullRowClasses}>
            <Field
              multiline
              rows={4}
              label={COPY.form.notes.label}
              value={values.notes}
              hint={COPY.form.notes.hint}
              maxLength={1000}
              onChange={(event) => {
                set('notes', event.currentTarget.value);
              }}
            />
          </div>
          <div className={clsx(expensesFullRowClasses, expensesReadOnlyFieldClasses)}>
            {kind === 'edit' ? (
              <RecordMeta {...SAVED_RECORD} />
            ) : (
              <>
                <span className={labelClasses}>{COPY.form.recordedBy.label}</span>
                <span className={expensesReadOnlyClasses}>
                  <span aria-hidden="true">
                    <Avatar name={CARMEN.name} size={24} />
                  </span>
                  <span>{COPY.form.paidBy.you(CARMEN.name)}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** The three E2 triggers; the modal stays mounted so it can play its exit, and each open mounts it fresh. */
function ExpenseModalsDemo() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ExpenseKind>('add');
  const [opens, setOpens] = useState(0);
  const show = (next: ExpenseKind): void => {
    setKind(next);
    setOpens((count) => count + 1);
    setOpen(true);
  };
  const triggers: readonly (readonly [ExpenseKind, string])[] = [
    ['add', DEMO.openAdd],
    ['edit', DEMO.openEdit],
    ['view', DEMO.openView],
  ];
  return (
    <>
      {triggers.map(([next, label]) => (
        <Button
          key={next}
          variant="secondary"
          size="sm"
          onClick={() => {
            show(next);
          }}
        >
          {label}
        </Button>
      ))}
      <ExpenseModalDemo
        key={opens}
        kind={kind}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

type DeleteKind = 'delete' | 'purge';

/** Both E3 dialogs on the 200-character description at the amount limit. Confirming only closes them. */
function DeleteDialogsDemo() {
  const [openKind, setOpenKind] = useState<DeleteKind | null>(null);
  const close = (): void => {
    setOpenKind(null);
  };
  const amount = formatPeso(MAX_AMOUNT);
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpenKind('delete');
        }}
      >
        {DEMO.openDelete}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpenKind('purge');
        }}
      >
        {DEMO.openPurge}
      </Button>
      <ConfirmDialog
        open={openKind === 'delete'}
        title={COPY.remove.title(LONG_DESCRIPTION, amount)}
        message={COPY.remove.message}
        confirmLabel={COPY.remove.confirm}
        pendingLabel={COPY.remove.pending}
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmDialog
        open={openKind === 'purge'}
        title={COPY.purge.title(LONG_DESCRIPTION, amount)}
        message={COPY.purge.message}
        confirmLabel={COPY.purge.confirm}
        pendingLabel={COPY.purge.pending}
        onConfirm={close}
        onCancel={close}
      />
    </>
  );
}

interface CategoryModalDemoProps {
  edit: boolean;
  open: boolean;
  onClose: () => void;
}

/** S2 on local state: the name and six color radios, each described by a live badge of the typed name. Edit starts on a 40-character name. */
function CategoryModalDemo({ edit, open, onClose }: CategoryModalDemoProps) {
  const [name, setName] = useState(edit ? LONG_CATEGORY_NAME : '');
  const [tone, setTone] = useState<string>(edit ? 'mockup' : 'neutral');
  const groupName = useId();
  const words = edit ? SETTINGS.modal.edit : SETTINGS.modal.add;
  const preview = name.trim() === '' ? SETTINGS.modal.color.sample : name.trim();
  const options: readonly RadioOption[] = CATEGORY_TONES.map((value) => ({
    value,
    label: CATEGORY_TONE_LABEL[value],
    description: <CategoryBadge category={{ name: preview, tone: value }} />,
  }));
  return (
    <Modal
      open={open}
      title={words.title}
      description={words.description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {words.cancel}
          </Button>
          <Button variant="primary" icon="check" onClick={onClose}>
            {words.save}
          </Button>
        </>
      }
    >
      <div className={expensesModalBodyClasses}>
        <Field
          label={SETTINGS.modal.name.label}
          value={name}
          maxLength={40}
          autoComplete="off"
          required
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        <RadioGroup
          legend={SETTINGS.modal.color.legend}
          name={groupName}
          value={tone}
          options={options}
          onChange={setTone}
        />
        {edit && (
          <RecordMeta
            recordedBy={null}
            recordedAt="2026-10-07T02:00:00Z"
            lastChangedBy={PAOLO}
            lastChangedAt="2026-10-12T07:42:00Z"
          />
        )}
      </div>
    </Modal>
  );
}

/** The two S2 triggers; the modal stays mounted so it can play its exit, and each open mounts it fresh. */
function CategoryModalsDemo() {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [opens, setOpens] = useState(0);
  const show = (next: boolean): void => {
    setEdit(next);
    setOpens((count) => count + 1);
    setOpen(true);
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          show(false);
        }}
      >
        {DEMO.openAddCategory}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          show(true);
        }}
      >
        {DEMO.openEditCategory}
      </Button>
      <CategoryModalDemo
        key={opens}
        edit={edit}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/** Every Phase 6 demo, one case under another. */
export function Phase6Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="expenses-table">
        <ExpenseTableDemo />
      </DemoCase>
      <DemoCase id="expenses-kpis">
        <KpiRowDemo />
      </DemoCase>
      <DemoCase id="expenses-kpis-empty">
        <KpiRowDemo empty />
      </DemoCase>
      <DemoCase id="expenses-modal" live>
        <ExpenseModalsDemo />
      </DemoCase>
      <DemoCase id="expenses-delete-dialogs" live>
        <DeleteDialogsDemo />
      </DemoCase>
      <DemoCase id="expenses-deleted-rows">
        <DeletedRowsDemo />
      </DemoCase>
      <DemoCase id="settings-category-rows">
        <CategoryRowsDemo />
      </DemoCase>
      <DemoCase id="settings-category-modal" live>
        <CategoryModalsDemo />
      </DemoCase>
    </div>
  );
}
