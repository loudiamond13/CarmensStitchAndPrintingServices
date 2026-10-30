// O2 order expense window: add (plan 08-18). Every rule is checked in the browser first with the server's own words (OR-3); a rule only
// the server can check comes back under its field. The window keeps the order it opened with and sends that order's version, so a
// focus refetch never changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). A save answers
// the whole order and the page shows the server's Order Expenses and Estimated Profit. Paid by is a required choice that starts on the
// signed-in person (ORD-23, D-11); Recorded by comes from the token on the server.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

const COPY = ORDER_EXPENSE_COPY;

const FIELD_ORDER = ['expenseDate', 'orderExpenseCategoryId', 'description', 'amount', 'paidByUserId'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

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

export type OrderExpenseModalProps = AddOrderExpenseModalProps;

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
  return <ExpenseForm key={opens} open={open} order={props.order} onClose={props.onClose} onSaved={props.onSaved} />;
}

interface ExpenseFormProps {
  open: boolean;
  order: OrderDetailResponse;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

function ExpenseForm({ open, order, onClose, onSaved }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  // The order the window was opened with; the version a save sends is this order's, whatever a later refetch brings.
  const [opened, setOpened] = useState<OrderDetailResponse>(order);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<OrderExpenseFormInput, unknown, OrderExpenseFormValues>({
    resolver: zodResolver(orderExpenseSchema(opened.today)),
    mode: 'onBlur',
    defaultValues: blankOrderExpense(opened.today, user?.id ?? ''),
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

  const save = useOrderChildSave<ExpenseSave>({
    orderId: opened.id,
    thing: 'expense',
    verb: 'added',
    send: (key, data) => orderExpensesService.add(opened.id, toRequest(data), key),
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
    onFieldErrors: putOnFields,
    // An add keeps what was typed and takes the latest version.
    onLatest: (latest) => {
      setOpened(latest);
      return true;
    },
  });

  const loadLatest = async (): Promise<void> => {
    if (await save.loadLatest()) {
      saveRef.current?.focus();
    }
  };

  const onValid = (values: OrderExpenseFormValues): void => {
    save.submit({ values, version: opened.version });
  };

  const onInvalid = (errors: Partial<Record<FieldName, unknown>>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const who = opened.teamName !== null && opened.teamName !== '' ? opened.teamName : opened.customerName;
  const you = user === null ? null : { id: user.id, name: user.name };

  return (
    <OrderWindow
      title={COPY.addTitle}
      description={ORDER_WINDOWS_COPY.description(opened.number, who)}
      open={open}
      isDirty={isDirty}
      pending={save.pending}
      banner={save.banner}
      loadingLatest={save.loadingLatest}
      onLoadLatest={() => {
        void loadLatest();
      }}
      status={save.status}
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
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
    </OrderWindow>
  );
}
