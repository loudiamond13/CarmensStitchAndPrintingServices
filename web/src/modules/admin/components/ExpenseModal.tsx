// E2 Expense modal: add, edit and view. Every rule is checked in the browser first; a rule only the server can check comes back
// under its field. Edit sends the row version it opened with, and a 409 keeps the typed values behind a banner. View is the
// read-only look an Admin gets for an expense they cannot edit.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field, labelClasses, messageClasses } from '@/components/forms';
import { Money } from '@/components/money';
import { Modal } from '@/components/overlays';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConflictBanner, EmptyValue, ErrorState, LoadingRegion, Note, SkeletonText } from '@/components/states';
import { ActorName, RecordMeta } from '@/components/data';
import { Avatar } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { ExpenseCategorySelect } from '@/modules/admin/components/ExpenseCategorySelect';
import { PaidBySelect } from '@/modules/admin/components/PaidBySelect';
import {
  expensesActorClasses,
  expensesAvatarClasses,
  expensesFieldStackClasses,
  expensesFormGridClasses,
  expensesFullRowClasses,
  expensesModalBodyClasses,
  expensesReadOnlyClasses,
  expensesReadOnlyFieldClasses,
  expensesViewNotesClasses,
  expensesViewValueClasses,
  expensesWrapClasses,
} from '@/modules/admin/components/expenses.recipe';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import {
  expenseFormSchema,
  type ExpenseFormInput,
  type ExpenseFormValues,
  type StoredExpenseFields,
} from '@/modules/admin/expensesSchemas';
import { useExpenseQuery } from '@/modules/admin/hooks/useExpenseQuery';
import { useSession } from '@/modules/admin/hooks/useSession';
import {
  expensesService,
  type CreateExpenseRequest,
  type ExpenseDetailResponse,
} from '@/modules/admin/services/expensesService';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { centavosToMoneyText, formatCalendarDate } from '@/utils/format';

const COPY = EXPENSES_COPY;
const ADD = COPY.add;
const EDIT = COPY.edit;
const VIEW = COPY.view;
const FORM = COPY.form;

const EDIT_STALE = 'edit.stale';
/** The 403 an Admin gets for an expense they neither recorded nor paid (D-26). */
const NOT_YOURS = 'company-expenses.not-yours';

const FIELD_ORDER = ['date', 'categoryId', 'description', 'amount', 'paidByUserId', 'notes'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

interface ExpenseModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** The server's business today (`yyyy-MM-dd`): the Date starts here and the 30-day limit counts from it (D-20). */
  today: string;
  /** Closes the modal: Cancel, Close, Esc and the scrim (never while a request runs), and after a save. */
  onClose: () => void;
  /** The expense was saved. */
  onSaved: (expense: ExpenseDetailResponse) => void;
}

export interface AddExpenseModalProps extends ExpenseModalCommon {
  mode: 'add';
}

export interface EditExpenseModalProps extends ExpenseModalCommon {
  mode: 'edit';
  /** Which expense to edit. Null renders nothing (the modal was never opened). */
  expenseId: string | null;
}

/** The read-only look: no date to count from and nothing to save. */
export interface ViewExpenseModalProps {
  mode: 'view';
  open?: boolean;
  /** Which expense to show. Null renders nothing (the modal was never opened). */
  expenseId: string | null;
  onClose: () => void;
}

export type ExpenseModalProps = AddExpenseModalProps | EditExpenseModalProps | ViewExpenseModalProps;

export function ExpenseModal({ open = true, ...props }: ExpenseModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  if (props.mode === 'view') {
    return props.expenseId === null ? null : (
      <ExpenseView key={`view-${String(opens)}`} expenseId={props.expenseId} open={open} onClose={props.onClose} />
    );
  }
  const expenseId = props.mode === 'edit' ? props.expenseId : null;
  if (props.mode === 'edit' && expenseId === null) {
    return null;
  }
  return (
    <ExpenseForm
      key={`${props.mode}-${String(opens)}`}
      mode={props.mode}
      expenseId={expenseId}
      open={open}
      today={props.today}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

/** The request body: the amount text is checked by the schema first, and only then becomes a number (T-06-39). */
function toRequest(values: ExpenseFormValues): CreateExpenseRequest {
  return {
    date: values.date,
    categoryId: values.categoryId,
    description: values.description,
    amount: Number(values.amount),
    paidByUserId: values.paidByUserId,
    notes: values.notes,
  };
}

/** What the edit form shows for a saved expense: every control is text. */
function valuesOf(expense: ExpenseDetailResponse): ExpenseFormInput {
  return {
    date: expense.date,
    categoryId: expense.category.id,
    description: expense.description,
    amount: centavosToMoneyText(Math.round(Number(expense.amount) * 100)),
    paidByUserId: expense.paidBy.id,
    notes: expense.notes ?? '',
  };
}

/** The saved values an edit compares against, so a legacy value over a limit can stay unchanged (D-33). */
function storedOf(expense: ExpenseDetailResponse): StoredExpenseFields {
  return { description: expense.description, amount: Number(expense.amount), notes: expense.notes ?? null };
}

interface ExpenseFormProps {
  mode: 'add' | 'edit';
  /** The expense being edited; null in add mode. */
  expenseId: string | null;
  open: boolean;
  today: string;
  onClose: () => void;
  onSaved: (expense: ExpenseDetailResponse) => void;
}

function ExpenseForm({ mode, expenseId, open, today, onClose, onSaved }: ExpenseFormProps) {
  const isEdit = mode === 'edit';
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  const query = useExpenseQuery(expenseId, open && isEdit);
  // The expense the form was filled from; the version a save sends is this one's, whatever a later refetch brings.
  const [opened, setOpened] = useState<ExpenseDetailResponse | null>(null);
  const fresh = isEdit && query.isSuccess && query.isFetchedAfterMount ? query.data : null;
  if (opened === null && fresh !== null) {
    setOpened(fresh);
  }
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // The Admin lost the right to edit it (403), and the expense was deleted meanwhile (404).
  const [forbidden, setForbidden] = useState(false);
  const [deleted, setDeleted] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  const { control, handleSubmit, setError, reset } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    // On an edit, a limit applies only to a value changed from the opened expense (D-33).
    resolver: zodResolver(expenseFormSchema(today, opened === null ? undefined : storedOf(opened))),
    mode: 'onBlur',
    defaultValues: {
      date: today,
      categoryId: '',
      description: '',
      amount: '',
      paidByUserId: user?.id ?? '',
      notes: '',
    },
    ...(opened === null ? {} : { values: valuesOf(opened) }),
  });

  const paidByUserId = useWatch({ control, name: 'paidByUserId' });

  const loaded = !isEdit || opened !== null;
  const loadFailed = isEdit && query.isError && opened === null;
  const gone = deleted || (loadFailed && isHttpError(query.error) && query.error.status === 404);
  // D-26: an Admin who did not record the expense loses edit access by moving Paid by away from themselves.
  const losesAccess =
    opened !== null && user?.role === 'admin' && opened.recordedBy?.id !== user.id && paidByUserId !== user.id;

  // The expense has arrived: the cursor goes to Date.
  useEffect(() => {
    if (isEdit && opened !== null) {
      const date = formRef.current?.elements.namedItem('date');
      if (date instanceof HTMLElement) {
        date.focus();
      }
    }
  }, [isEdit, opened]);

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const showLine = (text: string): void => {
    setFailure(text);
    saveRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    // 05 D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    // The deleted and not-yours banners exist only in Edit; in Add these fall through to the mapped line.
    if (isEdit && isHttpError(error) && error.status === 403 && error.code === NOT_YOURS) {
      setForbidden(true);
      return;
    }
    if (isEdit && isHttpError(error) && error.status === 404) {
      setDeleted(true);
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let first: FieldName | null = null;
      for (const name of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, name);
        if (message !== undefined) {
          setError(name, { type: 'server', message });
          first ??= name;
        }
      }
      if (first !== null) {
        focusField(first);
        return;
      }
      // No rendered field matches: say what the server said.
      showLine(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      return;
    }
    showLine(errorLine(copy));
  };

  const submission = useSubmission<ExpenseFormValues, ExpenseDetailResponse>(
    (key, values) => {
      if (!isEdit) {
        return expensesService.create(toRequest(values), key);
      }
      if (opened === null || expenseId === null) {
        return Promise.reject(new Error('The expense is not loaded.'));
      }
      return expensesService.update(expenseId, { ...toRequest(values), version: opened.version });
    },
    {
      onSuccess: (saved) => {
        onSaved(saved);
        onClose();
      },
      onFailure: showFailure,
    },
  );
  const { submit, pending } = submission;

  const onValid = async (values: ExpenseFormValues): Promise<void> => {
    setFailure(null);
    await submit(values);
  };

  const onInvalid = (errors: FieldErrors<ExpenseFormInput>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  /** Reads the expense again; the typed values are replaced only once the latest version has arrived. Null when it did not. */
  const readLatest = async (): Promise<ExpenseDetailResponse | null> => {
    const result = await query.refetch();
    if (result.isError) {
      if (isHttpError(result.error) && result.error.status === 404) {
        setDeleted(true);
        return null;
      }
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        setFailure(errorLine(copy));
      }
      return null;
    }
    const latest = result.data;
    if (latest === undefined) {
      return null;
    }
    setOpened(latest);
    reset(valuesOf(latest));
    setConflicts(0);
    setFailure(null);
    return latest;
  };

  /** Load Latest: after a stale save, the banner's button. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const latest = await readLatest();
    setLoadingLatest(false);
    if (latest !== null) {
      setStatus(EDIT.latestLoaded);
      focusField('date');
    }
  };

  const close = (): void => {
    if (!pending) {
      onClose();
    }
  };

  const you = user === null ? null : { id: user.id, name: user.name };
  const words = isEdit ? EDIT : ADD;

  const form = (
    <form
      id={formId}
      ref={formRef}
      noValidate
      className={expensesModalBodyClasses}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(onValid, onInvalid)(event);
      }}
    >
      {failure !== null && (
        <p className={messageClasses({ error: true })} role="alert">
          <Icon name="triangle-alert" size={14} />
          {failure}
        </p>
      )}
      <div className={expensesFormGridClasses}>
        <Controller
          control={control}
          name="date"
          render={({ field, fieldState }) => (
            <DateInput
              label={FORM.date.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={FORM.date.hint}
              readableDate
              required
            />
          )}
        />
        {/* SPEC-DEVIATION: OQ-9 no category is preselected, so the person chooses on purpose. */}
        <Controller
          control={control}
          name="categoryId"
          render={({ field, fieldState }) => (
            <ExpenseCategorySelect
              mode="picker"
              value={field.value}
              onChange={field.onChange}
              savedCategoryId={opened?.category.id}
              error={fieldState.error?.message}
            />
          )}
        />
        <div className={expensesFullRowClasses}>
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field
                label={FORM.description.label}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                placeholder={FORM.description.placeholder}
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <MoneyInput
              label={FORM.amount.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              required
            />
          )}
        />
        <div className={expensesFieldStackClasses}>
          <Controller
            control={control}
            name="paidByUserId"
            render={({ field, fieldState }) => (
              <PaidBySelect
                value={field.value}
                onChange={field.onChange}
                currentUser={you}
                savedPayer={opened?.paidBy}
                error={fieldState.error?.message}
              />
            )}
          />
          {losesAccess && (
            <Note icon="info" live>
              {EDIT.accessNote}
            </Note>
          )}
        </div>
        <div className={expensesFullRowClasses}>
          {/* SPEC-DEVIATION: D-19 Notes is new to App. E.11: optional, 1,000 characters, shown only here. */}
          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field
                multiline
                rows={4}
                label={FORM.notes.label}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={FORM.notes.hint}
                maxLength={1000}
              />
            )}
          />
        </div>
        {opened === null ? (
          /* SPEC-GAP: Recorded by in Add comes from App. E.11: a read-only dashed control, a span with a span label, never an input (CEXP-04). */
          <div className={clsx(expensesFullRowClasses, expensesReadOnlyFieldClasses)}>
            <span className={labelClasses}>{FORM.recordedBy.label}</span>
            <span className={expensesReadOnlyClasses}>
              {user !== null && (
                <>
                  <span aria-hidden="true">
                    <Avatar name={user.name} size={24} />
                  </span>
                  <span>{FORM.paidBy.you(user.name)}</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className={expensesFullRowClasses}>
            {/* SPEC-DEVIATION: CEXP-04 Edit shows Recorded by (the original recorder, never the editor) and Last changed by in RecordMeta. */}
            <RecordMeta
              recordedBy={opened.recordedBy}
              recordedAt={opened.recordedAt}
              lastChangedBy={opened.lastChangedBy}
              lastChangedAt={opened.lastChangedAt}
            />
          </div>
        )}
      </div>
    </form>
  );

  let waiting = <SkeletonText />;
  if (loadFailed) {
    waiting = gone ? (
      <></>
    ) : (
      <ErrorState
        things={EDIT.loadFailedThing}
        error={query.error}
        align="start"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  // The banners sit at the top of the body: the deleted notice, else the stale-save banner, then the not-yours notice.
  const editBody = (
    <div className={expensesModalBodyClasses}>
      {gone && <ErrorState title={EDIT.deleted.title} message={EDIT.deleted.body} align="start" />}
      {!gone && conflicts > 0 && (
        <ConflictBanner
          key={conflicts}
          pending={loadingLatest}
          onLoadLatest={() => {
            void loadLatest();
          }}
        />
      )}
      {forbidden && !gone && <ErrorState title={EDIT.forbidden.title} message={EDIT.forbidden.body} align="start" />}
      {loaded ? form : waiting}
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      title={words.title}
      description={ADD.description}
      onClose={close}
      loading={pending}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {words.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            icon="check"
            pending={pending}
            aria-disabled={!loaded || gone || forbidden}
            ref={saveRef}
          >
            {pending ? words.saving : words.save}
          </Button>
        </>
      }
    >
      {isEdit ? (
        <LoadingRegion loading={!loaded && !loadFailed} failed={loadFailed} things={EDIT.things}>
          {editBody}
        </LoadingRegion>
      ) : (
        form
      )}
    </Modal>
  );
}

/** One label and its read-only value in the view grid. */
function ViewRow({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={clsx(expensesReadOnlyFieldClasses, full && expensesFullRowClasses)}>
      <dt className={labelClasses}>{label}</dt>
      <dd className={expensesViewValueClasses}>{children}</dd>
    </div>
  );
}

// SPEC-GAP: OQ-8 View is the read-only E2 an Admin opens for an expense they cannot edit (D-25 lets every Admin read every
// expense, D-26 limits editing). It reads the expense fresh like Edit, shows the same fields as text, and has Close only;
// focus starts on Close.
function ExpenseView({ expenseId, open, onClose }: { expenseId: string; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const query = useExpenseQuery(expenseId, open);
  const expense = query.isSuccess && query.isFetchedAfterMount ? query.data : null;
  const loadFailed = query.isError && expense === null;
  const gone = loadFailed && isHttpError(query.error) && query.error.status === 404;

  let body: ReactNode = <SkeletonText />;
  if (expense !== null) {
    body = (
      <>
        <dl className={expensesFormGridClasses}>
          <ViewRow label={FORM.date.label}>{formatCalendarDate(expense.date) ?? <EmptyValue />}</ViewRow>
          <ViewRow label={COPY.category.label}>
            <CategoryBadge category={expense.category} />
          </ViewRow>
          <ViewRow label={FORM.description.label} full>
            {expense.description}
          </ViewRow>
          <ViewRow label={FORM.amount.label}>
            <Money amount={Number(expense.amount)} />
          </ViewRow>
          <ViewRow label={FORM.paidBy.label}>
            <span className={expensesActorClasses}>
              <span aria-hidden="true" className={expensesAvatarClasses}>
                <Avatar name={expense.paidBy.name} size={24} />
              </span>
              <span className={expensesWrapClasses}>
                <ActorName actor={expense.paidBy} />
              </span>
            </span>
          </ViewRow>
          <ViewRow label={FORM.notes.label} full>
            {expense.notes === null || expense.notes === '' ? (
              <EmptyValue />
            ) : (
              <span className={expensesViewNotesClasses}>{expense.notes}</span>
            )}
          </ViewRow>
        </dl>
        <RecordMeta
          recordedBy={expense.recordedBy}
          recordedAt={expense.recordedAt}
          lastChangedBy={expense.lastChangedBy}
          lastChangedAt={expense.lastChangedAt}
        />
      </>
    );
  } else if (gone) {
    body = <ErrorState title={EDIT.deleted.title} message={EDIT.deleted.body} align="start" />;
  } else if (loadFailed) {
    body = (
      <ErrorState
        things={EDIT.loadFailedThing}
        error={query.error}
        align="start"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  return (
    <Modal
      open={open}
      title={VIEW.title}
      description={ADD.description}
      onClose={onClose}
      initialFocus={closeRef}
      footer={
        <Button variant="secondary" onClick={onClose} ref={closeRef}>
          {VIEW.close}
        </Button>
      }
    >
      <LoadingRegion loading={expense === null && !loadFailed} failed={loadFailed} things={EDIT.things}>
        {/* The body scrolls on a small screen and holds nothing to press, so it is a named region a keyboard can focus (WCAG 2.1.1). */}
        <div
          className={expensesModalBodyClasses}
          role="region"
          aria-label={VIEW.title}
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scrolling read-only body must take keyboard focus (WCAG 2.1.1)
          tabIndex={0}
        >
          {body}
        </div>
      </LoadingRegion>
    </Modal>
  );
}
