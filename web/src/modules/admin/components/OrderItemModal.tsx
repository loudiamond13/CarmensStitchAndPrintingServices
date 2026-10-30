// O2 item window: add (plan 08-14). Every rule is checked in the browser first with the server's own words (OR-3); a rule only the
// server can check comes back under its field. The window keeps the order version it opened with and sends that one, so a focus
// refetch never changes it (RESEARCH Pitfall 10). A save answers the whole order and the page shows the server's figures. The
// "Line total" under Unit price is a preview of what is typed; the server works out the saved figure.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { MoneyInput } from '@/components/entry';
import { Field } from '@/components/forms';
import type { FieldErrors } from '@/lib/forms/useSubmission';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { ListEntrySelect } from '@/modules/admin/components/ListEntrySelect';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useOrderChildSave } from '@/modules/admin/hooks/useOrderChildSave';
import { useProductTypesQuery } from '@/modules/admin/hooks/useProductTypesQuery';
import { lineTotalPreview } from '@/modules/admin/orderFormPreview';
import {
  blankOrderItem,
  orderItemSchema,
  type OrderItemFormInput,
  type OrderItemFormValues,
} from '@/modules/admin/orderFormSchemas';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderItemsService, type AddOrderItemRequest } from '@/modules/admin/services/orderItemsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

const COPY = ORDER_WINDOWS_COPY;
const ITEM = COPY.item;
const FORM_COPY = {
  sizeVariantPlaceholder: ITEM.sizeVariantPlaceholder,
  descriptionPlaceholder: ITEM.descriptionPlaceholder,
};

const FIELD_ORDER = ['productTypeId', 'sizeVariant', 'description', 'quantity', 'unitPrice'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export interface OrderItemModalProps {
  mode: 'add';
  /** The order as the page shows it: the window opens with its version and its number. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The item was saved and the page already holds the answer. */
  onSaved?: (order: OrderDetailResponse) => void;
}

/** What one submission carries: the checked values and the order version the window opened with. */
interface ItemSave {
  values: OrderItemFormValues;
  version: string;
}

/** The request body: the quantity and price text are checked by the schema first, and only then become numbers (T-06-39). */
function toRequest({ values, version }: ItemSave): AddOrderItemRequest {
  return {
    productTypeId: values.productTypeId,
    description: values.description,
    sizeVariant: values.sizeVariant,
    quantity: Number(values.quantity),
    unitPrice: Number(values.unitPrice),
    version,
  };
}

export function OrderItemModal({ open = true, ...props }: OrderItemModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <ItemForm key={opens} open={open} {...props} />;
}

function ItemForm({ open, order, onClose, onSaved }: OrderItemModalProps & { open: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  // The order the window was opened with; the version a save sends is this one's, whatever a later refetch brings.
  const [opened] = useState(order);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<OrderItemFormInput, unknown, OrderItemFormValues>({
    resolver: zodResolver(orderItemSchema),
    mode: 'onBlur',
    defaultValues: blankOrderItem(),
  });
  const typed = useWatch({ control });
  const productTypesLoaded = useProductTypesQuery().isSuccess;

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // The Product type box is disabled while its list loads, so it takes the cursor once the list is here (and nothing was typed).
  useEffect(() => {
    if (productTypesLoaded && !isDirty) {
      const element = formRef.current?.elements.namedItem('productTypeId');
      if (element instanceof HTMLElement) {
        element.focus();
      }
    }
  }, [productTypesLoaded, isDirty]);

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

  const save = useOrderChildSave<ItemSave>({
    orderId: opened.id,
    thing: 'item',
    verb: 'added',
    send: (key, data) => orderItemsService.add(opened.id, toRequest(data), key),
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
    onFieldErrors: putOnFields,
  });

  const onValid = (values: OrderItemFormValues): void => {
    save.submit({ values, version: opened.version });
  };

  const onInvalid = (errors: Partial<Record<FieldName, unknown>>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const who = opened.teamName !== null && opened.teamName !== '' ? opened.teamName : opened.customerName;

  return (
    <OrderWindow
      title={ITEM.addTitle}
      description={COPY.description(opened.number, who)}
      open={open}
      isDirty={isDirty}
      pending={save.pending}
      banner={save.banner}
      saveLabel={ITEM.save}
      saveBlocked={save.saveBlocked}
      formRef={formRef}
      onSave={() => {
        void handleSubmit(onValid, onInvalid)();
      }}
      onClose={onClose}
    >
      <div className={orderWindowGridClasses}>
        <Controller
          control={control}
          name="productTypeId"
          render={({ field, fieldState }) => (
            <ListEntrySelect
              mode="picker"
              list="product-types"
              label={ITEM.productType}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="sizeVariant"
          render={({ field, fieldState }) => (
            <Field
              label={ITEM.sizeVariant}
              placeholder={FORM_COPY.sizeVariantPlaceholder}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              autoComplete="off"
            />
          )}
        />
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field
                label={ITEM.description}
                placeholder={FORM_COPY.descriptionPlaceholder}
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
          name="quantity"
          render={({ field, fieldState }) => (
            <Field
              label={ITEM.quantity}
              inputMode="numeric"
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
        <Controller
          control={control}
          name="unitPrice"
          render={({ field, fieldState }) => (
            <MoneyInput
              label={ITEM.unitPrice}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={ITEM.lineTotal(
                formatPeso(lineTotalPreview({ quantity: typed.quantity ?? '', unitPrice: typed.unitPrice ?? '' })),
              )}
              required
            />
          )}
        />
      </div>
    </OrderWindow>
  );
}
