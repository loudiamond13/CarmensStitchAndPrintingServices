// O2 refund window: add (plan 08-21). Every rule is checked in the browser first with the server's own words (OR-3); a rule only the
// server can check comes back under its field. The window keeps the order it opened with and sends that order's version, so a focus
// refetch never changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). A save answers the
// whole order and the page shows the server's figures. "You can refund up to" under Amount is a preview of the most that may be
// handed back, from the server's figures (`refundCap`).
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field } from '@/components/forms';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { PaidBySelect } from '@/modules/admin/components/PaidBySelect';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { useSession } from '@/modules/admin/hooks/useSession';
import { ORDER_REFUND_COPY } from '@/modules/admin/orderRefundCopy';
import {
  blankOrderRefund,
  orderRefundSchema,
  refundCapKind,
  type OrderRefundFormInput,
  type OrderRefundFormValues,
} from '@/modules/admin/orderRefundSchemas';
import { refundCap } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderRefundsService, type AddOrderRefundRequest } from '@/modules/admin/services/orderRefundsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = ORDER_REFUND_COPY;

const FIELD_ORDER = ['refundDate', 'amount', 'reason', 'refundedByUserId'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export interface OrderRefundModalProps {
  mode: 'add';
  /** The order as the page shows it: the window opens with its version, number, customer, figures and today. */
  order: OrderDetailResponse;
  /** The amount the window starts with, as money text: Record Refund passes the customer credit (D-19). */
  prefillAmount?: string | undefined;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The refund was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

/** What one submission carries: the checked values and the order version the window opened with. */
interface RefundSave {
  values: OrderRefundFormValues;
  version: string;
}

/** The request body: the amount text is checked by the schema first, and only then becomes a number (T-06-39). */
function toRequest({ values, version }: RefundSave): AddOrderRefundRequest {
  return {
    refundDate: values.refundDate,
    amount: Number(values.amount),
    reason: values.reason,
    refundedByUserId: values.refundedByUserId,
    version,
  };
}

export function OrderRefundModal({ open = true, ...props }: OrderRefundModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return (
    <RefundForm
      key={opens}
      open={open}
      order={props.order}
      prefillAmount={props.prefillAmount}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface RefundFormProps {
  open: boolean;
  order: OrderDetailResponse;
  prefillAmount: string | undefined;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

function RefundForm({ open, order, prefillAmount, onClose, onSaved }: RefundFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  // The order the window was opened with; the version a save sends is this order's, whatever a later refetch brings.
  const [opened, setOpened] = useState<OrderDetailResponse>(order);
  const cap = refundCap(opened);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<OrderRefundFormInput, unknown, OrderRefundFormValues>({
    resolver: zodResolver(orderRefundSchema(opened.today, cap, refundCapKind(opened))),
    mode: 'onBlur',
    defaultValues: blankOrderRefund(opened.today, user?.id ?? '', prefillAmount),
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

  // Load Latest: an add keeps what was typed and takes the latest order, its version and its cap.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    setOpened(latest);
    return true;
  };

  const save = useOrderChildSave<RefundSave>({
    orderId: opened.id,
    thing: 'refund',
    verb: 'added',
    send: (key, data) => orderRefundsService.add(opened.id, toRequest(data), key),
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
    onFieldErrors: putOnFields,
    onLatest: takeLatest,
  });

  const loadLatest = async (): Promise<void> => {
    if (await save.loadLatest()) {
      saveRef.current?.focus();
    }
  };

  const onValid = (values: OrderRefundFormValues): void => {
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
          name="refundDate"
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
              hint={COPY.canRefund(cap)}
              required
            />
          )}
        />
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.reason}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="off"
                required
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="refundedByUserId"
          render={({ field, fieldState }) => (
            <PaidBySelect
              label={COPY.refundedBy}
              name={field.name}
              hint={COPY.refundedByHint}
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
