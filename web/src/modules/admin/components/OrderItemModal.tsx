// O2 item window: add and edit (plan 08-14). Every rule is checked in the browser first with the server's own words (OR-3); a rule only
// the server can check comes back under its field. The window keeps the order it opened with and sends that order's version, so a
// focus refetch never changes it (RESEARCH Pitfall 10); a stale save keeps the typed values behind a banner (05 D-20). A save answers
// the whole order and the page shows the server's figures. The "Line total" under Unit price is a preview of what is typed.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { RecordMeta } from '@/components/data';
import { MoneyInput } from '@/components/entry';
import { Field } from '@/components/forms';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import type { FieldErrors } from '@/lib/forms/useSubmission';
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
import { centavosToMoneyText } from '@/utils/format';

const COPY = ORDER_WINDOWS_COPY;
const ITEM = COPY.item;

const FIELD_ORDER = ['productTypeId', 'sizeVariant', 'description', 'quantity', 'unitPrice'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

type OrderItem = OrderDetailResponse['items'][number];

interface OrderItemModalCommon {
  /** The order as the page shows it: the window opens with its version, number and customer. */
  order: OrderDetailResponse;
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The item was saved and the page already holds the answer. */
  onSaved?: ((order: OrderDetailResponse) => void) | undefined;
}

export interface AddOrderItemModalProps extends OrderItemModalCommon {
  mode: 'add';
}

export interface EditOrderItemModalProps extends OrderItemModalCommon {
  mode: 'edit';
  /** Which item to edit. Null renders nothing (the window was never opened). */
  itemId: string | null;
}

export type OrderItemModalProps = AddOrderItemModalProps | EditOrderItemModalProps;

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

/** What the edit form shows for a saved item: every control is text. */
function valuesOf(item: OrderItem): OrderItemFormInput {
  return {
    productTypeId: item.productType.id,
    description: item.description,
    sizeVariant: item.sizeVariant ?? '',
    quantity: String(Number(item.quantity)),
    unitPrice: centavosToMoneyText(Math.round(Number(item.unitPrice) * 100)),
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
  const itemId = props.mode === 'edit' ? props.itemId : null;
  if (props.mode === 'edit' && itemId === null) {
    return null;
  }
  return (
    <ItemForm
      key={opens}
      open={open}
      order={props.order}
      itemId={itemId}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface ItemFormProps {
  open: boolean;
  order: OrderDetailResponse;
  /** The item being edited; null in add mode. */
  itemId: string | null;
  onClose: () => void;
  onSaved: ((order: OrderDetailResponse) => void) | undefined;
}

interface Opened {
  order: OrderDetailResponse;
  item: OrderItem | null;
}

function ItemForm({ open, order, itemId: editedId, onClose, onSaved }: ItemFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  // The order and item the window was opened with; the version a save sends is this order's, whatever a later refetch brings.
  const [opened, setOpened] = useState<Opened>(() => ({
    order,
    item: editedId === null ? null : (order.items.find((candidate) => candidate.id === editedId) ?? null),
  }));
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = useForm<OrderItemFormInput, unknown, OrderItemFormValues>({
    resolver: zodResolver(orderItemSchema),
    mode: 'onBlur',
    defaultValues: opened.item === null ? blankOrderItem() : valuesOf(opened.item),
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

  // Load Latest: an edit takes the latest item's values and version; an add keeps what was typed and takes the version.
  const takeLatest = (latest: OrderDetailResponse): boolean => {
    if (editedId === null) {
      setOpened({ order: latest, item: null });
      return true;
    }
    const latestItem = latest.items.find((candidate) => candidate.id === editedId);
    if (latestItem === undefined) {
      return false;
    }
    setOpened({ order: latest, item: latestItem });
    reset(valuesOf(latestItem));
    return true;
  };

  const save = useOrderChildSave<ItemSave>({
    orderId: opened.order.id,
    thing: 'item',
    verb: editedId === null ? 'added' : 'updated',
    send: (key, data) =>
      editedId === null
        ? orderItemsService.add(opened.order.id, toRequest(data), key)
        : orderItemsService.update(opened.order.id, editedId, toRequest(data)),
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
        focusField('productTypeId');
      }
    }
  };

  const onValid = (values: OrderItemFormValues): void => {
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
  const savedItem = opened.item;

  return (
    <OrderWindow
      title={editedId === null ? ITEM.addTitle : ITEM.editTitle}
      description={COPY.description(opened.order.number, who)}
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
        savedItem === null ? undefined : (
          <RecordMeta
            recordedBy={savedItem.recordedBy}
            recordedAt={savedItem.recordedAt}
            lastChangedBy={savedItem.lastChangedBy}
            lastChangedAt={savedItem.lastChangedAt}
          />
        )
      }
      saveLabel={ITEM.save}
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
          name="productTypeId"
          render={({ field, fieldState }) => (
            <ListEntrySelect
              mode="picker"
              list="product-types"
              label={ITEM.productType}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              savedEntry={savedItem?.productType.id}
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
              placeholder={ITEM.sizeVariantPlaceholder}
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
                placeholder={ITEM.descriptionPlaceholder}
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
