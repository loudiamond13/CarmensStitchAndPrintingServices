// O2 order expense window: add and edit (plan 08-18). Every rule is checked in the browser first with the server's own words (OR-3); a rule
// only the server can check comes back under its field. The window keeps the order it opened with and sends that order's version, so a
// focus refetch never changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). A save answers
// the whole order and the page shows the server's Order Expenses and Estimated Profit. Paid by is a required choice that starts on the
// signed-in person (ORD-23, D-11); Recorded by comes from the token on the server. An edit keeps a payer who left, and a category that
// was retired, selected so the form can be saved without changing them.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RecordMeta } from '@/components/data';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field } from '@/components/forms';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { ListEntrySelect } from '@/modules/admin/components/ListEntrySelect';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { PaidBySelect } from '@/modules/admin/components/PaidBySelect';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { useSession } from '@/modules/admin/hooks/useSession';
import { ORDER_EXPENSE_COPY } from '@/modules/admin/orderExpenseCopy';
import {
  blankOrderExpense,
  orderExpenseSchema,
  type OrderExpenseFormInput,
  type OrderExpenseFormValues,
} from '@/modules/admin/orderExpenseSchemas';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderExpensesService, type AddOrderExpenseRequest } from '@/modules/admin/services/orderExpensesService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { centavosToMoneyText } from '@/utils/format';

const COPY = ORDER_EXPENSE_COPY;

const FIELD_ORDER = ['expenseDate', 'orderExpenseCategoryId', 'description', 'amount', 'paidByUserId'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

type OrderExpense = OrderDetailResponse['expenses'][number];

interface OrderExpenseModalCommon {
  /** The order as the page shows it: the window opens with its version, number, customer and today. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The expense was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export interface AddOrderExpenseModalProps extends OrderExpenseModalCommon {
  mode: 'add';
}

export interface EditOrderExpenseModalProps extends OrderExpenseModalCommon {
  mode: 'edit';
  /** Which expense to edit. Null renders nothing (the window was never opened). */
  expenseId: string | null;
}

export type OrderExpenseModalProps = AddOrderExpenseModalProps | EditOrderExpenseModalProps;

/** What one submission carries: the checked values and the order version the window opened with. */
interface ExpenseSave {
  values: OrderExpenseFormValues;
  version: string;
}

/** The request body: the amount text is checked by the schema first, and only then becomes a number (T-06-39). */
function toRequest({ values, version }: ExpenseSave): AddOrderExpenseRequest {
  return {
    expenseDate: values.expenseDate,
    orderExpenseCategoryId: values.orderExpenseCategoryId,
    description: values.description,
    amount: Number(values.amount),
    paidByUserId: values.paidByUserId,
    version,
  };
}

/** What the edit form shows for a saved expense: every control is text. */
function valuesOf(expense: OrderExpense): OrderExpenseFormInput {
  return {
    expenseDate: expense.expenseDate,
    orderExpenseCategoryId: expense.category.id,
    description: expense.description ?? '',
    amount: centavosToMoneyText(Math.round(Number(expense.amount) * 100)),
    paidByUserId: expense.paidBy.id,
  };
}

export function OrderExpenseModal({ open = true, ...props }: OrderExpenseModalProps) {
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
      key={opens}
      open={open}
      order={props.order}
      expenseId={expenseId}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface ExpenseFormProps {
  open: boolean;
  order: OrderDetailResponse;
  /** The expense being edited; null in add mode. */
  expenseId: string | null;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

interface Opened {
  order: OrderDetailResponse;
  expense: OrderExpense | null;
}

function ExpenseForm({ open, order, expenseId: editedId, onClose, onSaved }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  // The order and expense the window was opened with; the version a save sends is this order's, whatever a later refetch brings.
  const [opened, setOpened] = useState<Opened>(() => ({
    order,
    expense: editedId === null ? null : (order.expenses.find((candidate) => candidate.id === editedId) ?? null),
  }));
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = useForm<OrderExpenseFormInput, unknown, OrderExpenseFormValues>({
    resolver: zodResolver(orderExpenseSchema(opened.order.today)),
    mode: 'onBlur',
    defaultValues:
      opened.expense === null ? blankOrderExpense(opened.order.today, user?.id ?? '') : valuesOf(opened.expense),
  });

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const putOnFields = (errors: FieldErrors): boolean => {
    let first: FieldName | null = null;
    for (const name of FIELD_ORDER) {
      const message = serverFieldMessage(errors, name);
      if (message !== undefined) {
        setError(name, { type: 'server', message });
        first ??= name;
      }
    }
    if (first === null) {
      return false;
    }
    focusField(first);
    return true;
  };

  // Load Latest: an edit takes the latest expense's values and version; an add keeps what was typed and takes the version.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    if (editedId === null) {
      setOpened({ order: latest, expense: null });
      return true;
    }
    const latestExpense = latest.expenses.find((candidate) => candidate.id === editedId);
    if (latestExpense === undefined) {
      return false;
    }
    setOpened({ order: latest, expense: latestExpense });
    reset(valuesOf(latestExpense));
    return true;
  };

  const save = useOrderChildSave<ExpenseSave>({
    orderId: opened.order.id,
    thing: 'expense',
    verb: editedId === null ? 'added' : 'updated',
    send: (key, data) =>
      editedId === null
        ? orderExpensesService.add(opened.order.id, toRequest(data), key)
        : orderExpensesService.update(opened.order.id, editedId, toRequest(data)),
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
    onFieldErrors: putOnFields,
    onLatest: takeLatest,
  });

  const loadLatest = async (): Promise<void> => {
    if (await save.loadLatest()) {
      if (editedId === null) {
        saveRef.current?.focus();
      } else {
        focusField('expenseDate');
      }
    }
  };

  const onValid = (values: OrderExpenseFormValues): void => {
    save.submit({ values, version: opened.order.version });
  };

  const onInvalid = (errors: Partial<Record<FieldName, unknown>>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const who =
    opened.order.teamName !== null && opened.order.teamName !== '' ? opened.order.teamName : opened.order.customerName;
  const you = user === null ? null : { id: user.id, name: user.name };
  const savedExpense = opened.expense;

  return (
    <OrderWindow
      title={editedId === null ? COPY.addTitle : COPY.editTitle}
      description={ORDER_WINDOWS_COPY.description(opened.order.number, who)}
      open={open}
      isDirty={isDirty}
      pending={save.pending}
      banner={save.banner}
      loadingLatest={save.loadingLatest}
      onLoadLatest={() => {
        void loadLatest();
      }}
      status={save.status}
      recordMeta={
        savedExpense === null ? undefined : (
          <RecordMeta
            recordedBy={savedExpense.recordedBy}
            recordedAt={savedExpense.recordedAt}
            lastChangedBy={savedExpense.lastChangedBy}
            lastChangedAt={savedExpense.lastChangedAt}
          />
        )
      }
      saveLabel={COPY.save}
      saveBlocked={save.saveBlocked}
      formRef={formRef}
      saveRef={saveRef}
      onSave={() => {
        void handleSubmit(onValid, onInvalid)();
      }}
      onClose={onClose}
    >
      <div className={orderWindowGridClasses}>
        <Controller
          control={control}
          name="expenseDate"
          render={({ field, fieldState }) => (
            <DateInput
              label={COPY.date}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={COPY.dateHint}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="orderExpenseCategoryId"
          render={({ field, fieldState }) => (
            <ListEntrySelect
              mode="picker"
              list="order-expense-categories"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              savedEntry={savedExpense?.category.id}
              error={fieldState.error?.message}
            />
          )}
        />
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.description}
                placeholder={COPY.descriptionPlaceholder}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="off"
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <MoneyInput
              label={COPY.amount}
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
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              currentUser={you}
              savedPayer={savedExpense?.paidBy}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
    </OrderWindow>
  );
}
