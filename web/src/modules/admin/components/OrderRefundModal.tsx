// O2 refund window: add and edit (plan 08-21). Every rule is checked in the browser first with the server's own words (OR-3); a rule only
// the server can check comes back under its field. The window sends the version of the order it opened with, so a refresh never changes
// it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). The figures behind the cap follow the current
// order, and an amount the held figures refuse reads the order once more before it is refused (D-95). A save answers the whole order and
// the page shows the server's figures. "You can refund up to" under Amount is a preview of the most that may be handed back, from the
// server's figures (`refundCap`): on an edit it adds back the refund's own saved amount.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RecordMeta } from '@/components/data';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field } from '@/components/forms';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { PaidBySelect } from '@/modules/admin/components/PaidBySelect';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { freshCapResolver, useOrderWindowFigures } from '@/modules/admin/hooks/useOrderWindowFigures';
import { useSession } from '@/modules/admin/hooks/useSession';
import { ORDER_REFUND_COPY } from '@/modules/admin/orderRefundCopy';
import {
  blankOrderRefund,
  isOverRefundCap,
  orderRefundSchema,
  refundCapKind,
  type OrderRefundFormInput,
  type OrderRefundFormValues,
  type RefundCapKind,
} from '@/modules/admin/orderRefundSchemas';
import { refundCap } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderRefundsService, type AddOrderRefundRequest } from '@/modules/admin/services/orderRefundsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { centavosToMoneyText } from '@/utils/format';

const COPY = ORDER_REFUND_COPY;

const FIELD_ORDER = ['refundDate', 'amount', 'reason', 'refundedByUserId'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

type OrderRefund = OrderDetailResponse['refunds'][number];

interface OrderRefundModalCommon {
  /** The order as the page shows it: the window opens with its version, number, customer, figures and today. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The refund was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export interface AddOrderRefundModalProps extends OrderRefundModalCommon {
  mode: 'add';
  /** The amount the window starts with, as money text: Record Refund passes the customer credit (D-19). */
  prefillAmount?: string | undefined;
}

export interface EditOrderRefundModalProps extends OrderRefundModalCommon {
  mode: 'edit';
  /** Which refund to edit. Null renders nothing (the window was never opened). */
  refundId: string | null;
}

export type OrderRefundModalProps = AddOrderRefundModalProps | EditOrderRefundModalProps;

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

/** What the edit form shows for a saved refund: every control is text. */
function valuesOf(refund: OrderRefund): OrderRefundFormInput {
  return {
    refundDate: refund.refundDate,
    amount: centavosToMoneyText(Math.round(Number(refund.amount) * 100)),
    reason: refund.reason,
    refundedByUserId: refund.refundedBy.id,
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
  const refundId = props.mode === 'edit' ? props.refundId : null;
  if (props.mode === 'edit' && refundId === null) {
    return null;
  }
  return (
    <RefundForm
      key={opens}
      open={open}
      order={props.order}
      refundId={refundId}
      prefillAmount={props.mode === 'add' ? props.prefillAmount : undefined}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface RefundFormProps {
  open: boolean;
  order: OrderDetailResponse;
  /** The refund being edited; null in add mode. */
  refundId: string | null;
  prefillAmount: string | undefined;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

interface Opened {
  order: OrderDetailResponse;
  refund: OrderRefund | null;
}

function RefundForm({ open, order, refundId: editedId, prefillAmount, onClose, onSaved }: RefundFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  // The order and refund the window was opened with; the version a save sends is this order's, whatever a later read brings.
  const [opened, setOpened] = useState<Opened>(() => ({
    order,
    refund: editedId === null ? null : (order.refunds.find((candidate) => candidate.id === editedId) ?? null),
  }));
  const figures = useOrderWindowFigures(opened.order);
  // The most that may be refunded, and its kind, by `current`'s figures. An edit adds that order's copy of the refund; when it no
  // longer holds the refund, the opened figures stand and a save answers 404.
  const capFor = (current: OrderDetailResponse): { cap: string; kind: RefundCapKind } => {
    if (opened.refund === null) {
      return { cap: refundCap(current), kind: refundCapKind(current) };
    }
    const savedId = opened.refund.id;
    const copy = current.refunds.find((candidate) => candidate.id === savedId);
    return copy === undefined
      ? { cap: refundCap(opened.order, opened.refund.amount), kind: refundCapKind(opened.order) }
      : { cap: refundCap(current, copy.amount), kind: refundCapKind(current) };
  };
  const { cap } = capFor(figures.current);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = useForm<OrderRefundFormInput, unknown, OrderRefundFormValues>({
    resolver: freshCapResolver<OrderRefundFormInput, OrderRefundFormValues>({
      figures,
      resolverFor: (current) => {
        const { cap: maxAmount, kind } = capFor(current);
        return zodResolver(orderRefundSchema(opened.order.today, maxAmount, kind));
      },
      overCap: (values, current) => isOverRefundCap(values.amount, capFor(current).cap),
    }),
    mode: 'onBlur',
    defaultValues:
      opened.refund === null
        ? blankOrderRefund(opened.order.today, user?.id ?? '', prefillAmount)
        : valuesOf(opened.refund),
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

  // Load Latest: an edit takes the latest refund's values and version; an add keeps what was typed and takes the version.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    if (editedId === null) {
      setOpened({ order: latest, refund: null });
      return true;
    }
    const latestRefund = latest.refunds.find((candidate) => candidate.id === editedId);
    if (latestRefund === undefined) {
      return false;
    }
    setOpened({ order: latest, refund: latestRefund });
    reset(valuesOf(latestRefund));
    return true;
  };

  const save = useOrderChildSave<RefundSave>({
    orderId: opened.order.id,
    thing: 'refund',
    verb: editedId === null ? 'added' : 'updated',
    send: (key, data) =>
      editedId === null
        ? orderRefundsService.add(opened.order.id, toRequest(data), key)
        : orderRefundsService.update(opened.order.id, editedId, toRequest(data)),
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
        focusField('refundDate');
      }
    }
  };

  const onValid = (values: OrderRefundFormValues): void => {
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
  const savedRefund = opened.refund;

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
        savedRefund === null ? undefined : (
          <RecordMeta
            recordedBy={savedRefund.recordedBy}
            recordedAt={savedRefund.recordedAt}
            lastChangedBy={savedRefund.lastChangedBy}
            lastChangedAt={savedRefund.lastChangedAt}
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
              savedPayer={savedRefund?.refundedBy}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
    </OrderWindow>
  );
}
