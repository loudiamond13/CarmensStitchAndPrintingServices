// O2 payment window: add and edit (plan 08-16). Every rule is checked in the browser first with the server's own words (OR-3); a rule
// only the server can check comes back under its field. The window sends the version of the order it opened with, so a refresh never
// changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). The figures behind the cap follow the
// current order, and an amount the held figures refuse reads the order once more before it is refused (D-95). A save answers the whole
// order and the page shows the server's figures. "Balance due" under Amount is a preview of the most that may be paid: the server
// balance on an add, and on an edit the balance plus the payment's saved amount.
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
import { freshCapResolver, useOrderWindowFigures } from '@/modules/admin/hooks/useOrderWindowFigures';
import { useSession } from '@/modules/admin/hooks/useSession';
import { ORDER_PAYMENT_COPY } from '@/modules/admin/orderPaymentCopy';
import {
  blankOrderPayment,
  isOverPaymentCap,
  orderPaymentSchema,
  paymentCap,
  type OrderPaymentFormInput,
  type OrderPaymentFormValues,
} from '@/modules/admin/orderPaymentSchemas';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderPaymentsService, type AddOrderPaymentRequest } from '@/modules/admin/services/orderPaymentsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { centavosToMoneyText } from '@/utils/format';

const COPY = ORDER_PAYMENT_COPY;

const FIELD_ORDER = ['paymentDate', 'amount', 'paymentMethodId', 'reference', 'receivedByUserId', 'notes'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

type OrderPayment = OrderDetailResponse['payments'][number];

interface OrderPaymentModalCommon {
  /** The order as the page shows it: the window opens with its version, number, customer, balance and today. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The payment was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export interface AddOrderPaymentModalProps extends OrderPaymentModalCommon {
  mode: 'add';
}

export interface EditOrderPaymentModalProps extends OrderPaymentModalCommon {
  mode: 'edit';
  /** Which payment to edit. Null renders nothing (the window was never opened). */
  paymentId: string | null;
}

export type OrderPaymentModalProps = AddOrderPaymentModalProps | EditOrderPaymentModalProps;

/** What one submission carries: the checked values and the order version the window opened with. */
interface PaymentSave {
  values: OrderPaymentFormValues;
  version: string;
}

/** The request body: the amount text is checked by the schema first, and only then becomes a number (T-06-39). */
function toRequest({ values, version }: PaymentSave): AddOrderPaymentRequest {
  return {
    paymentDate: values.paymentDate,
    amount: Number(values.amount),
    paymentMethodId: values.paymentMethodId,
    reference: values.reference,
    notes: values.notes,
    receivedByUserId: values.receivedByUserId,
    version,
  };
}

/** What the edit form shows for a saved payment: every control is text. */
function valuesOf(payment: OrderPayment): OrderPaymentFormInput {
  return {
    paymentDate: payment.paymentDate,
    amount: centavosToMoneyText(Math.round(Number(payment.amount) * 100)),
    paymentMethodId: payment.method.id,
    reference: payment.reference ?? '',
    notes: payment.notes ?? '',
    receivedByUserId: payment.receivedBy.id,
  };
}

export function OrderPaymentModal({ open = true, ...props }: OrderPaymentModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  const paymentId = props.mode === 'edit' ? props.paymentId : null;
  if (props.mode === 'edit' && paymentId === null) {
    return null;
  }
  return (
    <PaymentForm
      key={opens}
      open={open}
      order={props.order}
      paymentId={paymentId}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface PaymentFormProps {
  open: boolean;
  order: OrderDetailResponse;
  /** The payment being edited; null in add mode. */
  paymentId: string | null;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

interface Opened {
  order: OrderDetailResponse;
  payment: OrderPayment | null;
}

function PaymentForm({ open, order, paymentId: editedId, onClose, onSaved }: PaymentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  // The order and payment the window was opened with; the version a save sends is this order's, whatever a later read brings.
  const [opened, setOpened] = useState<Opened>(() => ({
    order,
    payment: editedId === null ? null : (order.payments.find((candidate) => candidate.id === editedId) ?? null),
  }));
  const figures = useOrderWindowFigures(opened.order);
  const capFor = (current: OrderDetailResponse): string => paymentCap(current, opened.payment?.amount);
  const cap = capFor(figures.current);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = useForm<OrderPaymentFormInput, unknown, OrderPaymentFormValues>({
    resolver: freshCapResolver<OrderPaymentFormInput, OrderPaymentFormValues>({
      figures,
      resolverFor: (current) => zodResolver(orderPaymentSchema(opened.order.today, capFor(current))),
      overCap: (values, current) => isOverPaymentCap(values.amount, capFor(current)),
    }),
    mode: 'onBlur',
    defaultValues:
      opened.payment === null ? blankOrderPayment(opened.order.today, user?.id ?? '') : valuesOf(opened.payment),
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

  // Load Latest: an edit takes the latest payment's values and version; an add keeps what was typed and takes the version.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    if (editedId === null) {
      setOpened({ order: latest, payment: null });
      return true;
    }
    const latestPayment = latest.payments.find((candidate) => candidate.id === editedId);
    if (latestPayment === undefined) {
      return false;
    }
    setOpened({ order: latest, payment: latestPayment });
    reset(valuesOf(latestPayment));
    return true;
  };

  const save = useOrderChildSave<PaymentSave>({
    orderId: opened.order.id,
    thing: 'payment',
    verb: editedId === null ? 'added' : 'updated',
    send: (key, data) =>
      editedId === null
        ? orderPaymentsService.add(opened.order.id, toRequest(data), key)
        : orderPaymentsService.update(opened.order.id, editedId, toRequest(data)),
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
        focusField('paymentDate');
      }
    }
  };

  const onValid = (values: OrderPaymentFormValues): void => {
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
  const savedPayment = opened.payment;

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
        savedPayment === null ? undefined : (
          <RecordMeta
            recordedBy={savedPayment.recordedBy}
            recordedAt={savedPayment.recordedAt}
            lastChangedBy={savedPayment.lastChangedBy}
            lastChangedAt={savedPayment.lastChangedAt}
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
          name="paymentDate"
          render={({ field, fieldState }) => (
            <DateInput
              label={COPY.date}
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
          name="amount"
          render={({ field, fieldState }) => (
            <MoneyInput
              label={COPY.amount}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={COPY.balanceDue(cap)}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="paymentMethodId"
          render={({ field, fieldState }) => (
            <ListEntrySelect
              mode="picker"
              list="payment-methods"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              savedEntry={savedPayment?.method.id}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="reference"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.reference}
              placeholder={COPY.referencePlaceholder}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              autoComplete="off"
            />
          )}
        />
        <Controller
          control={control}
          name="receivedByUserId"
          render={({ field, fieldState }) => (
            <PaidBySelect
              label={COPY.receivedBy}
              name={field.name}
              hint={COPY.receivedByHint}
              value={field.value}
              onChange={field.onChange}
              currentUser={you}
              savedPayer={savedPayment?.receivedBy}
              error={fieldState.error?.message}
            />
          )}
        />
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field
                multiline
                rows={3}
                label={COPY.notes}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
              />
            )}
          />
        </div>
      </div>
    </OrderWindow>
  );
}
