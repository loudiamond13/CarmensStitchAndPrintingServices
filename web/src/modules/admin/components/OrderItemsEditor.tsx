// OrderItemsEditor (UI-SPEC F1 card 4, §8.6 `.s-item`; ORD-13, D-49, UIC-10, UIC-51; plan 08-13): the item grid of the New Order form.
// It opens with the rows the form holds (one blank row, nothing chosen), adds and removes rows with their focus rules, stops at 100
// rows, and shows each line total and the footer as PREVIEWS from what is typed (D-09): the server works out the saved figures.
// Each row is a labelled group, so a screen reader hears which item a field belongs to.
import { useEffect, useId, useRef } from 'react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/actions';
import { MoneyInput } from '@/components/entry';
import { Field, messageClasses } from '@/components/forms';
import { Note } from '@/components/states';
import { ListEntrySelect } from '@/modules/admin/components/ListEntrySelect';
import {
  orderFormCardHeadClasses,
  orderFormCardHintClasses,
  orderFormCardTitleClasses,
  orderFormOverlineClasses,
  orderItemDescriptionCellClasses,
  orderItemHeadClasses,
  orderItemHeadRightClasses,
  orderItemPriceCellClasses,
  orderItemQuantityCellClasses,
  orderItemRemoveCellClasses,
  orderItemRowClasses,
  orderItemSizeCellClasses,
  orderItemsCardClasses,
  orderItemsClasses,
  orderItemsCountClasses,
  orderItemsFootClasses,
  orderItemsLimitClasses,
  orderItemsSubtotalClasses,
  orderItemsSubtotalFigureClasses,
  orderItemTotalCellClasses,
  orderItemTotalFigureClasses,
  orderItemTotalLabelClasses,
  orderItemTypeCellClasses,
} from '@/modules/admin/components/orderForm.recipe';
import { orderInlineEmptyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_FORM_COPY } from '@/modules/admin/orderFormCopy';
import { itemsPreview, lineTotalPreview } from '@/modules/admin/orderFormPreview';
import { blankOrderItem, MAX_ORDER_ITEMS, type CreateOrderControl } from '@/modules/admin/orderFormSchemas';
import { formatPeso } from '@/utils/csps';

const COPY = ORDER_FORM_COPY.items;

export interface OrderItemsEditorProps {
  control: CreateOrderControl;
  /** The message about the list itself ("Add at least one item.", "An order can have at most 100 items."), or none. */
  rootError?: string | undefined;
}

interface ItemRowProps {
  control: CreateOrderControl;
  index: number;
  onRemove: (index: number) => void;
}

/** One item row: the seven cells of the grid. */
function ItemRow({ control, index, onRemove }: ItemRowProps) {
  const item = useWatch({ control, name: `items.${String(index)}` as `items.${number}` });
  const base = `items.${String(index)}` as `items.${number}`;
  return (
    <div role="group" aria-label={COPY.group(index + 1)} data-ui="s-item" className={orderItemRowClasses}>
      <div className={orderItemTypeCellClasses}>
        <Controller
          control={control}
          name={`${base}.productTypeId`}
          render={({ field, fieldState }) => (
            <ListEntrySelect
              mode="picker"
              list="product-types"
              label={COPY.productType}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
      <div className={orderItemDescriptionCellClasses}>
        <Controller
          control={control}
          name={`${base}.description`}
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
              required
            />
          )}
        />
      </div>
      <div className={orderItemSizeCellClasses}>
        <Controller
          control={control}
          name={`${base}.sizeVariant`}
          render={({ field, fieldState }) => (
            <Field
              label={COPY.sizeVariant}
              placeholder={COPY.sizeVariantPlaceholder}
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
      <div className={orderItemQuantityCellClasses}>
        <Controller
          control={control}
          name={`${base}.quantity`}
          render={({ field, fieldState }) => (
            <Field
              label={COPY.quantity}
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
      </div>
      <div className={orderItemPriceCellClasses}>
        <Controller
          control={control}
          name={`${base}.unitPrice`}
          render={({ field, fieldState }) => (
            <MoneyInput
              label={COPY.unitPrice}
              align="right"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              required
            />
          )}
        />
      </div>
      <div className={orderItemTotalCellClasses}>
        <span className={orderItemTotalLabelClasses}>{COPY.lineTotal}</span>
        <strong className={orderItemTotalFigureClasses}>{formatPeso(lineTotalPreview(item))}</strong>
      </div>
      <div className={orderItemRemoveCellClasses}>
        <Button
          variant="ghost-danger"
          icon="trash-2"
          aria-label={COPY.remove(index + 1)}
          title={COPY.remove(index + 1)}
          onClick={() => {
            onRemove(index);
          }}
        />
      </div>
    </div>
  );
}

export function OrderItemsEditor({ control, rootError }: OrderItemsEditorProps) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const emptyAddRef = useRef<HTMLButtonElement>(null);
  // Where focus goes once the rows have changed: a row's Product type, or the Add Item button of the empty line.
  const pendingFocus = useRef<number | 'add' | null>(null);
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const rows = useWatch({ control, name: 'items' });
  const preview = itemsPreview(rows);
  const atLimit = fields.length >= MAX_ORDER_ITEMS;

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === 'add') {
      emptyAddRef.current?.focus();
      return;
    }
    sectionRef.current?.querySelector<HTMLElement>(`[name="items.${String(target)}.productTypeId"]`)?.focus();
  }, [fields.length]);

  const add = (): void => {
    if (atLimit) return;
    pendingFocus.current = fields.length;
    append(blankOrderItem(), { shouldFocus: false });
  };

  const removeRow = (index: number): void => {
    // The next row slides into this place; else the previous row; else the empty line's Add Item.
    if (index < fields.length - 1) {
      pendingFocus.current = index;
    } else {
      pendingFocus.current = index > 0 ? index - 1 : 'add';
    }
    remove(index);
  };

  return (
    <section ref={sectionRef} className={orderItemsCardClasses} aria-labelledby={headingId}>
      <div className={orderFormCardHeadClasses}>
        <div>
          <h2 id={headingId} className={orderFormCardTitleClasses}>
            {COPY.title}
          </h2>
          <p className={orderFormCardHintClasses}>{COPY.hint}</p>
        </div>
        <Button variant="secondary" size="sm" icon="plus" aria-disabled={atLimit} onClick={add}>
          {COPY.addItem}
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className={orderInlineEmptyClasses}>
          <p>{COPY.empty}</p>
          {rootError !== undefined && rootError !== '' && <p className={messageClasses({ error: true })}>{rootError}</p>}
          <Button variant="ghost" icon="plus" onClick={add} ref={emptyAddRef}>
            {COPY.addItem}
          </Button>
        </div>
      ) : (
        <div className={orderItemsClasses}>
          <div className={orderItemHeadClasses} aria-hidden="true">
            <span>{COPY.productType}</span>
            <span>{COPY.description}</span>
            <span>{COPY.sizeVariant}</span>
            <span className={orderItemHeadRightClasses}>{COPY.quantity}</span>
            <span className={orderItemHeadRightClasses}>{COPY.unitPrice}</span>
            <span className={orderItemHeadRightClasses}>{COPY.lineTotal}</span>
            <span />
          </div>
          {fields.map((field, index) => (
            <ItemRow key={field.id} control={control} index={index} onRemove={removeRow} />
          ))}
        </div>
      )}
      {atLimit && (
        <div className={orderItemsLimitClasses}>
          <Note icon="info">{COPY.limit}</Note>
        </div>
      )}
      {fields.length > 0 && rootError !== undefined && rootError !== '' && (
        <div className={orderItemsLimitClasses}>
          <p className={messageClasses({ error: true })}>{rootError}</p>
        </div>
      )}
      <div className={orderItemsFootClasses}>
        <p className={orderItemsCountClasses}>{COPY.footer(preview.pieces, preview.lines)}</p>
        <div className={orderItemsSubtotalClasses}>
          <span className={orderFormOverlineClasses}>{COPY.subtotalOverline}</span>
          <strong className={orderItemsSubtotalFigureClasses}>{formatPeso(preview.subtotal)}</strong>
        </div>
      </div>
    </section>
  );
}
