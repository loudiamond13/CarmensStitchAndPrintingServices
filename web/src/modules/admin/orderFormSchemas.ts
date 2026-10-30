// The order form schemas (OR-3; plan 08-13): the browser checks every rule of OrderRules.cs and the order validators before a
// request is sent, with the server's own words. Every control is text; the quantity and the unit price stay text until the check
// has passed and only then become numbers for the request (T-06-39). `orderDetailsSchema` holds the customer and date rules the
// edit form reuses; `orderItemSchema` is the item rule the item windows reuse.
import type { Control } from 'react-hook-form';
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { isMoneyText, moneyTextToCentavos } from '@/utils/format';
import type { CreateOrderRequest, UpdateOrderDetailsRequest } from '@/modules/admin/services/ordersService';
import { ORDER_FORM_COPY } from './orderFormCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDER_FORM_COPY.errors;

const CUSTOMER_NAME_MAX = 100;
const TEAM_NAME_MAX = 100;
const CONTACT_NUMBER_MAX = 30;
const EMAIL_MAX = 254;
const ADDRESS_MAX = 300;
const NOTES_MAX = 2000;
const DESCRIPTION_MAX = 200;
const SIZE_VARIANT_MAX = 100;
const QUANTITY_MAX = 10_000;
/** The most an order may have, and the largest unit price in centavos. */
export const MAX_ORDER_ITEMS = 100;
const UNIT_PRICE_MAX_CENTAVOS = 100_000_000;

/** The statuses a new order may start in (D-30): the active ones. */
export const CREATE_STATUSES = ['pending', 'mockup', 'production', 'ready', 'delivered'] as const;

/** Digits, spaces and + - ( ) only (OrderRules.IsValidContactNumber). */
const CONTACT_NUMBER = /^[0-9 +\-()]*$/;
/** A plain address with a dotted domain and no spaces (OrderRules.IsValidEmail); the server makes the final check. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** An optional text: trimmed, at most `max`, and null when empty. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((text) => (text === '' ? null : text));
}

/** The message under a date field for `text`, or null when it is a real date. */
function dateError(text: string, required: string): string | null {
  if (text.trim() === '') return required;
  return isCalendarDate(text.trim()) ? null : COPY.dateInvalid;
}

function dateField(required: string) {
  return z.string().superRefine((text, context) => {
    const message = dateError(text, required);
    if (message !== null) {
      context.addIssue({ code: 'custom', message });
    }
  });
}

/** The message under Qty for `text`, or null when it is a whole number from 1 to 10,000. */
function quantityError(text: string): string | null {
  const value = text.trim();
  return /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= QUANTITY_MAX
    ? null
    : COPY.quantityOutOfRange;
}

/** The message under Unit price for `text`, or null when it is from 0.00 to 1,000,000.00 with at most 2 decimals. */
function unitPriceError(text: string): string | null {
  if (text === '' || text === '.') return COPY.unitPriceRequired;
  if (/^\d*\.\d{3,}$/.test(text)) return COPY.moneyDecimals;
  if (!isMoneyText(text)) {
    // Digits and one point that are too long are a price that is too large; anything else is not a price.
    return /^\d+(\.\d*)?$/.test(text) ? COPY.unitPriceOutOfRange : moneyInputError(text);
  }
  return moneyTextToCentavos(text) > UNIT_PRICE_MAX_CENTAVOS ? COPY.unitPriceOutOfRange : null;
}

/** One order item (OrderItemFieldsValidator): the rule the New Order grid and the item windows share. */
export const orderItemSchema = z.object({
  productTypeId: z.string().min(1, COPY.productTypeRequired),
  description: z.string().trim().min(1, COPY.descriptionRequired).max(DESCRIPTION_MAX, COPY.descriptionTooLong),
  sizeVariant: optionalText(SIZE_VARIANT_MAX, COPY.sizeVariantTooLong),
  quantity: z.string().superRefine((text, context) => {
    const message = quantityError(text);
    if (message !== null) {
      context.addIssue({ code: 'custom', message });
    }
  }),
  unitPrice: z.string().superRefine((text, context) => {
    const message = unitPriceError(text);
    if (message !== null) {
      context.addIssue({ code: 'custom', message });
    }
  }),
});

export type OrderItemFormInput = z.input<typeof orderItemSchema>;
export type OrderItemFormValues = z.output<typeof orderItemSchema>;

/** A new, blank item row: nothing chosen (D-49). */
export function blankOrderItem(): OrderItemFormInput {
  return { productTypeId: '', description: '', sizeVariant: '', quantity: '', unitPrice: '' };
}

/** The customer and date fields (OrderDetailsFieldsValidator), without the date order check. */
const detailsShape = {
  customerName: z.string().trim().min(1, COPY.customerNameRequired).max(CUSTOMER_NAME_MAX, COPY.customerNameTooLong),
  teamName: optionalText(TEAM_NAME_MAX, COPY.teamNameTooLong),
  contactNumber: z
    .string()
    .trim()
    .min(1, COPY.contactNumberRequired)
    .max(CONTACT_NUMBER_MAX, COPY.contactNumberTooLong)
    .refine((text) => CONTACT_NUMBER.test(text), COPY.contactNumberInvalid),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX, COPY.emailTooLong)
    .refine((text) => text === '' || EMAIL.test(text), COPY.emailInvalid)
    .transform((text) => (text === '' ? null : text)),
  address: optionalText(ADDRESS_MAX, COPY.addressTooLong),
  orderDate: dateField(COPY.orderDateRequired),
  dueDate: dateField(COPY.dueDateRequired),
  notes: optionalText(NOTES_MAX, COPY.notesTooLong),
};

/** The due date may not be before the order date; compared only when both are real dates. */
function checkDateOrder(values: { orderDate: string; dueDate: string }, context: z.RefinementCtx): void {
  const order = values.orderDate.trim();
  const due = values.dueDate.trim();
  if (isCalendarDate(order) && isCalendarDate(due) && due < order) {
    context.addIssue({ code: 'custom', path: ['dueDate'], message: COPY.dueDateBeforeOrderDate });
  }
}

/** The customer and date rules alone, for the Edit Order form to reuse. */
export const orderDetailsSchema = z.object(detailsShape).superRefine(checkDateOrder);

export type OrderDetailsFormInput = z.input<typeof orderDetailsSchema>;
export type OrderDetailsFormValues = z.output<typeof orderDetailsSchema>;

/** The New Order form (CreateOrderRequestValidator): the details, a starting status, and 1 to 100 items. */
export const createOrderSchema = z
  .object({
    ...detailsShape,
    status: z.string().refine((text) => (CREATE_STATUSES as readonly string[]).includes(text), COPY.statusInvalid),
    items: z.array(orderItemSchema).min(1, COPY.itemsRequired).max(MAX_ORDER_ITEMS, COPY.itemsTooMany),
  })
  .superRefine(checkDateOrder);

export type CreateOrderFormInput = z.input<typeof createOrderSchema>;
export type CreateOrderFormValues = z.output<typeof createOrderSchema>;

/** The form control of the New Order form, for the parts that read or write its rows. */
export type CreateOrderControl = Control<CreateOrderFormInput, unknown, CreateOrderFormValues>;

/** The request body for a checked form. It carries no attribution field: who recorded the order comes from the token (SEC-08). */
export function toCreateOrderRequest(values: CreateOrderFormValues): CreateOrderRequest {
  return {
    customerName: values.customerName,
    teamName: values.teamName,
    contactNumber: values.contactNumber,
    email: values.email,
    address: values.address,
    orderDate: values.orderDate.trim(),
    dueDate: values.dueDate.trim(),
    status: values.status,
    notes: values.notes,
    items: values.items.map((item) => ({
      productTypeId: item.productTypeId,
      description: item.description,
      sizeVariant: item.sizeVariant,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  };
}

/** The Edit Order form (UpdateOrderDetailsRequestValidator): the same customer and date rules, with the due date required. */
export const updateOrderDetailsSchema = orderDetailsSchema;

export type UpdateOrderDetailsFormInput = z.input<typeof updateOrderDetailsSchema>;
export type UpdateOrderDetailsFormValues = z.output<typeof updateOrderDetailsSchema>;

// RED stub: replaced by the real request builder in the GREEN commit.
export function toUpdateOrderDetailsRequest(
  values: UpdateOrderDetailsFormValues,
  _version: string,
): UpdateOrderDetailsRequest {
  return { ...values, version: null };
}
