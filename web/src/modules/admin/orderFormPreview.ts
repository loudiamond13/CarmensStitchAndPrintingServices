// The live figures of the New Order form: line totals, pieces, line items and the items subtotal. They are PREVIEWS from what is
// typed (D-09): the server works out the saved figures, and the order page shows its answer after the save. The browser's order
// math (csps.ts orderTotals) does the sums, in exact centavos.
import { useWatch, type Control } from 'react-hook-form';
import { isMoneyText } from '@/utils/format';
import { orderTotals } from '@/utils/csps';
import type { CreateOrderFormInput, OrderItemFormInput } from '@/modules/admin/orderFormSchemas';

/** The typed quantity as a whole number; 0 until it is one. */
function quantityOf(text: string): number {
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : 0;
}

/** The typed unit price as a number; 0 until it is money text. */
function unitPriceOf(text: string): number {
  return text !== '' && text !== '.' && isMoneyText(text) ? Number(text) : 0;
}

/** One row's line total preview (quantity times unit price, to the centavo). */
export function lineTotalPreview(item: Pick<OrderItemFormInput, 'quantity' | 'unitPrice'>): number {
  return orderTotals({ items: [{ quantity: quantityOf(item.quantity), unitPrice: unitPriceOf(item.unitPrice) }] }).subtotal;
}

export interface ItemsPreview {
  /** How many rows. */
  lines: number;
  /** The sum of the typed quantities. */
  pieces: number;
  /** The items subtotal, which is also the order total preview (no discounts at creation). */
  subtotal: number;
}

export function itemsPreview(items: readonly Pick<OrderItemFormInput, 'quantity' | 'unitPrice'>[]): ItemsPreview {
  return {
    lines: items.length,
    pieces: items.reduce((sum, item) => sum + quantityOf(item.quantity), 0),
    subtotal: orderTotals({
      items: items.map((item) => ({ quantity: quantityOf(item.quantity), unitPrice: unitPriceOf(item.unitPrice) })),
    }).subtotal,
  };
}

/** The preview of the rows being typed. */
export function useItemsPreview(control: Control<CreateOrderFormInput>): ItemsPreview {
  const items = useWatch({ control, name: 'items' });
  return itemsPreview(items);
}
