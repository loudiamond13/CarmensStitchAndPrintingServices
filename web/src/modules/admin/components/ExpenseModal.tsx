// E2 Expense modal, add and edit modes (UI-SPEC "E2 Expense modal"; App. E.11; CEXP-02, CEXP-04, D-17..D-21, D-32, OQ-9, OR-3;
// plans 06-12, 06-14). Date (the server's business today), Category, Description, Amount, Paid by (the signed-in user to start),
// Notes and the read-only Recorded by, then Save Expense. Every rule is checked in the browser first (expenseFormSchema); a rule
// only the server can check (an inactive payer, a retired category) comes back under its field. A failure that belongs to no
// field shows one alert line above the fields and keeps the typed values. While the request runs, Esc, the scrim, Close and
// Cancel do nothing (WEB-09) and the one Idempotency-Key is kept for a retry. Each open starts clean: the form lives in a part
// that is mounted again on every open.
//   - Edit reads the expense fresh on every open (SkeletonText in a LoadingRegion, then focus on Date). The form keeps the row
//     version it opened with and sends it with Save Changes; a refetch never replaces it (05 D-13, D-20).
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RecordMeta } from '@/components/data';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field, labelClasses, messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { LoadingRegion, SkeletonText } from '@/components/states';
import { Avatar } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { ExpenseCategorySelect } from '@/modules/admin/components/ExpenseCategorySelect';
import { PaidBySelect } from '@/modules/admin/components/PaidBySelect';
import {
  expensesFormGridClasses,
  expensesFullRowClasses,
  expensesModalBodyClasses,
  expensesReadOnlyClasses,
  expensesReadOnlyFieldClasses,
} from '@/modules/admin/components/expenses.recipe';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormValues } from '@/modules/admin/expensesSchemas';
import { useExpenseQuery } from '@/modules/admin/hooks/useExpenseQuery';
import { useSession } from '@/modules/admin/hooks/useSession';
import {
  expensesService,
  type CreateExpenseRequest,
  type ExpenseDetailResponse,
} from '@/modules/admin/services/expensesService';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { centavosToMoneyText } from '@/utils/format';

const COPY = EXPENSES_COPY;
const ADD = COPY.add;
const EDIT = COPY.edit;
const FORM = COPY.form;

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

export type ExpenseModalProps = AddExpenseModalProps | EditExpenseModalProps;

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
  const { control, handleSubmit, setError } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema(today)),
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

  const loaded = !isEdit || opened !== null;
  const loadFailed = isEdit && query.isError && opened === null;

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
        <Controller
          control={control}
          name="paidByUserId"
          render={({ field, fieldState }) => (
            <PaidBySelect
              value={field.value}
              onChange={field.onChange}
              currentUser={you}
              error={fieldState.error?.message}
            />
          )}
        />
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

  const body = loaded ? form : <SkeletonText />;

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
            aria-disabled={!loaded}
            ref={saveRef}
          >
            {pending ? words.saving : words.save}
          </Button>
        </>
      }
    >
      {isEdit ? (
        <LoadingRegion loading={!loaded && !loadFailed} failed={loadFailed} things={EDIT.things}>
          {body}
        </LoadingRegion>
      ) : (
        body
      )}
    </Modal>
  );
}
