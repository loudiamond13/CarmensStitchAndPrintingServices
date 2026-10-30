// O2 discount window: add (plan 08-17). Every rule is checked in the browser first with the server's own words (OR-3); a rule only
// the server can check comes back under its field. The window keeps the order it opened with and sends that order's version, so a
// focus refetch never changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). A save answers
// the whole order and the page shows the server's figures. "Computed amount" under Value is a preview from the server's items total.
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Icon } from '@/components/brand';
import { SegmentedControl, type SegmentOption } from '@/components/choice';
import { MoneyInput } from '@/components/entry';
import { Field, labelClasses, messageClasses } from '@/components/forms';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { ORDER_DISCOUNT_COPY } from '@/modules/admin/orderDiscountCopy';
import {
  blankOrderDiscount,
  discountPreview,
  orderDiscountSchema,
  otherDiscountsTotal,
  type DiscountKindKey,
  type OrderDiscountFormInput,
  type OrderDiscountFormValues,
} from '@/modules/admin/orderDiscountSchemas';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderDiscountsService, type AddOrderDiscountRequest } from '@/modules/admin/services/orderDiscountsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const COPY = ORDER_DISCOUNT_COPY;

const FIELD_ORDER = ['reason', 'value'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

const KIND_OPTIONS: readonly SegmentOption<DiscountKindKey>[] = [
  { value: 'fixed', label: COPY.fixedOption },
  { value: 'percentage', label: COPY.percentOption },
];

/** A percent Value takes digits and one point only; the schema judges the rest. */
const PERCENT_TEXT = /^\d{0,3}(\.\d*)?$/;

export interface AddOrderDiscountModalProps {
  /** The order as the page shows it: the window opens with its version, number, customer and items total. */
  order: OrderDetailResponse;
  mode: 'add';
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The discount was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export type OrderDiscountModalProps = AddOrderDiscountModalProps;

/** What one submission carries: the checked values and the order version the window opened with. */
interface DiscountSave {
  values: OrderDiscountFormValues;
  version: string;
}

/** The request body: the value text is checked by the schema first, and only then becomes a number (T-06-39). */
function toRequest({ values, version }: DiscountSave): AddOrderDiscountRequest {
  return { kind: values.kind, value: Number(values.value), reason: values.reason, version };
}

export function OrderDiscountModal({ open = true, ...props }: OrderDiscountModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <DiscountForm key={opens} open={open} order={props.order} onClose={props.onClose} onSaved={props.onSaved} />;
}

interface DiscountFormProps {
  open: boolean;
  order: OrderDetailResponse;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

function DiscountForm({ open, order, onClose, onSaved }: DiscountFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  // The order the window was opened with; the version a save sends is this order's, whatever a later refetch brings.
  const [opened, setOpened] = useState(order);
  const subtotal = opened.totals.subtotal;
  const others = otherDiscountsTotal(opened, undefined);
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isDirty },
  } = useForm<OrderDiscountFormInput, unknown, OrderDiscountFormValues>({
    resolver: zodResolver(orderDiscountSchema(subtotal, others)),
    mode: 'onBlur',
    defaultValues: blankOrderDiscount(),
  });
  const typed = useWatch({ control });

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

  // Load Latest on an add keeps what was typed and takes the latest order, so the cap and the version are current.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    setOpened(latest);
    return true;
  };

  const save = useOrderChildSave<DiscountSave>({
    orderId: opened.id,
    thing: 'discount',
    verb: 'added',
    send: (key, data) => orderDiscountsService.add(opened.id, toRequest(data), key),
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

  const onValid = (values: OrderDiscountFormValues): void => {
    save.submit({ values, version: opened.version });
  };

  const onInvalid = (errors: Partial<Record<FieldName, unknown>>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const who = opened.teamName !== null && opened.teamName !== '' ? opened.teamName : opened.customerName;
  const kind: DiscountKindKey = typed.kind === 'percentage' ? 'percentage' : 'fixed';
  const computed = COPY.computedAmount(discountPreview(kind, typed.value ?? '', subtotal));

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
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.reason}
                placeholder={COPY.reasonPlaceholder}
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
          name="kind"
          render={({ field, fieldState }) => (
            <div className="flex flex-col items-start gap-1.5">
              <span className={labelClasses}>{COPY.type}</span>
              <SegmentedControl<DiscountKindKey>
                label={COPY.type}
                options={KIND_OPTIONS}
                value={kind}
                onChange={(next) => {
                  field.onChange(next);
                  setValue('value', '', { shouldDirty: true });
                }}
              />
              {fieldState.error?.message !== undefined && (
                <p className={messageClasses({ error: true })}>
                  <Icon name="triangle-alert" size={14} />
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
        <Controller
          key={kind}
          control={control}
          name="value"
          render={({ field, fieldState }) =>
            kind === 'fixed' ? (
              <MoneyInput
                label={COPY.value}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={computed}
                required
              />
            ) : (
              <Field
                label={COPY.value}
                prefix="%"
                inputMode="decimal"
                name={field.name}
                value={field.value}
                onChange={(event) => {
                  if (PERCENT_TEXT.test(event.target.value)) {
                    field.onChange(event.target.value);
                  }
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={computed}
                autoComplete="off"
                required
              />
            )
          }
        />
      </div>
    </OrderWindow>
  );
}
