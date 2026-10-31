// The discount window rules (OR-3; plan 08-17): the browser checks every rule of OrderDiscountFieldsValidator.cs before a request is sent,
// with the server's own words, in the server's order (value present, then its range, then its decimals). Every control is text; the
// value stays text until the check has passed and only then becomes a number (T-06-39). The items-total cap is a preview from the
// server's figures; the server still decides.
import { z } from 'zod';
import { ORDER_DISCOUNT_COPY } from '@/modules/admin/orderDiscountCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { discountAmount, type MoneyValue } from '@/utils/csps';
import { centavosToMoneyText } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDER_DISCOUNT_COPY.errors;

export type DiscountKindKey = 'fixed' | 'percentage';

const REASON_MAX = 100;
/** The largest fixed discount and the largest percent (OrderRules.FixedDiscountMax and PercentMax). */
const FIXED_MAX = 1_000_000;
const PERCENT_MAX = 100;
/** The most centavos money text can hold (utils/format.ts). */
const MAX_CENTAVOS = 99_999_999_999;

/** The kind the text names, or null when it names neither. */
function kindOf(text: string): DiscountKindKey | null {
  return text === 'fixed' || text === 'percentage' ? text : null;
}

/** True when the text is a number made of digits and at most one point, with at least one digit. */
const isNumberText = (text: string): boolean => /^(\d+\.?\d*|\.\d+)$/.test(text);

/** Whole centavos of what a discount of this kind and value comes to over the subtotal (half away from zero, as the server). */
function centavosOf(kind: DiscountKindKey, value: number, subtotal: number): number {
  const amount = discountAmount({ type: kind, value }, subtotal);
  return Math.min(MAX_CENTAVOS, Math.max(0, Math.round(amount * 100)));
}

/** The message under Value for `text`, or null when it passes every rule, including the items-total cap unless `checkCap` is false. */
function valueError(
  kind: DiscountKindKey,
  raw: string,
  subtotal: number,
  otherCentavos: number,
  checkCap = true,
): string | null {
  const text = raw.trim();
  if (text === '' || text === '.') return COPY.valueRequired;
  const rangeMessage = kind === 'fixed' ? COPY.fixedOutOfRange : COPY.percentOutOfRange;
  if (!isNumberText(text)) return rangeMessage;
  const value = Number(text);
  if (value <= 0 || value > (kind === 'fixed' ? FIXED_MAX : PERCENT_MAX)) return rangeMessage;
  const fraction = text.split('.')[1] ?? '';
  // Trailing zeros are not a decimal place: the request sends the number, so "5.500" is 5.5.
  if (fraction.replace(/0+$/, '').length > 2) return COPY.moneyDecimals;
  if (!checkCap) return null;
  const subtotalCentavos = Math.round(subtotal * 100);
  return centavosOf(kind, value, subtotal) + otherCentavos > subtotalCentavos ? COPY.aboveSubtotal : null;
}

/**
 * The discount form for the server `subtotal` (the items total) and `otherDiscounts` (the pesos the order's other discounts come
 * to, from `otherDiscountsTotal`). All the discounts together may not pass the items total.
 */
export function orderDiscountSchema(subtotal: MoneyValue, otherDiscounts: number) {
  const subtotalPesos = Number(subtotal);
  const otherCentavos = Math.round(otherDiscounts * 100);
  return z
    .object({
      kind: z.string().refine((text) => kindOf(text) !== null, COPY.kindInvalid),
      value: z.string(),
      reason: z.string().trim().min(1, COPY.reasonRequired).max(REASON_MAX, COPY.reasonTooLong),
    })
    .superRefine((data, context) => {
      const kind = kindOf(data.kind);
      if (kind === null) {
        return;
      }
      const message = valueError(kind, data.value, subtotalPesos, otherCentavos);
      if (message !== null) {
        context.addIssue({ code: 'custom', message, path: ['value'] });
      }
    });
}

/**
 * True when `valueText` passes every value rule except the items-total cap and the discounts would pass the items total
 * (`subtotal`, with `otherDiscounts` as in `orderDiscountSchema`): the one failure a fresh read can cure.
 */
export function isAboveItemsTotal(
  kind: DiscountKindKey,
  valueText: string,
  subtotal: MoneyValue,
  otherDiscounts: number,
): boolean {
  const subtotalPesos = Number(subtotal);
  const otherCentavos = Math.round(otherDiscounts * 100);
  return (
    valueError(kind, valueText, subtotalPesos, otherCentavos, false) === null &&
    valueError(kind, valueText, subtotalPesos, otherCentavos) !== null
  );
}

export type OrderDiscountFormInput = z.input<ReturnType<typeof orderDiscountSchema>>;
export type OrderDiscountFormValues = z.output<ReturnType<typeof orderDiscountSchema>>;

/** A new discount: Fixed (the default type) with nothing typed. */
export function blankOrderDiscount(): OrderDiscountFormInput {
  return { kind: 'fixed', value: '', reason: '' };
}

/**
 * The "Computed amount" helper as money text: a percent of the server subtotal rounded half away from zero, or the fixed value as
 * typed. 0.00 while the value is empty or not a number.
 */
export function discountPreview(kind: DiscountKindKey, valueText: string, subtotal: MoneyValue): string {
  const text = valueText.trim();
  if (!isNumberText(text)) {
    return centavosToMoneyText(0);
  }
  return centavosToMoneyText(centavosOf(kind, Number(text), Number(subtotal)));
}

/** The pesos the order's discounts come to, leaving out the one being edited (`excludeId`) so its own saved amount is not counted. */
export function otherDiscountsTotal(
  order: Pick<OrderDetailResponse, 'discounts' | 'totals'>,
  excludeId: string | undefined,
): number {
  const subtotal = Number(order.totals.subtotal);
  let centavos = 0;
  for (const discount of order.discounts) {
    if (discount.id !== excludeId) {
      centavos += centavosOf(discount.kind === 'percentage' ? 'percentage' : 'fixed', Number(discount.value), subtotal);
    }
  }
  return centavos / 100;
}
