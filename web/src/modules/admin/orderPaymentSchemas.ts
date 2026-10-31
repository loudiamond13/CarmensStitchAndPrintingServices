// The payment window rules (OR-3; plan 08-16): the browser checks every rule of OrderPaymentFieldsValidator.cs and OrderRules.cs before
// a request is sent, with the server's own words. Every control is text; the amount stays text until the check has passed and only
// then becomes a number (T-06-39). The balance cap and the payments-below-refunds check are previews from the server's figures; the
// server still decides.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { ORDER_PAYMENT_COPY } from '@/modules/admin/orderPaymentCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { centavosToMoneyText, isMoneyText, moneyTextToCentavos } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDER_PAYMENT_COPY.errors;

const REFERENCE_MAX = 100;
const NOTES_MAX = 500;
/** The largest payment, in centavos (OrderRules.PaymentAmountMax). */
const AMOUNT_MAX_CENTAVOS = 100_000_000;

/** An optional text: trimmed, at most `max`, and null when empty. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((text) => (text === '' ? null : text));
}

/** The message under Date for `date`, or null when it is a real day that is not after `today`. */
function dateError(date: string, today: string): string | null {
  const text = date.trim();
  if (text === '') return COPY.dateRequired;
  if (!isCalendarDate(text)) return COPY.dateInvalid;
  return text > today ? COPY.dateInFuture : null;
}

/** The message under Amount for `text`, or null when it is from 0.01 to 1,000,000.00, with 2 decimals, within `maxCentavos`. */
function amountError(text: string, maxCentavos: number): string | null {
  if (text === '' || text === '.') return COPY.amountRequired;
  if (/^\d*\.\d{3,}$/.test(text)) return COPY.moneyDecimals;
  if (!isMoneyText(text)) {
    // Digits and one point that are too long are an amount that is too large; anything else is not an amount.
    return /^\d+(\.\d*)?$/.test(text) ? COPY.amountOutOfRange : moneyInputError(text);
  }
  const centavos = moneyTextToCentavos(text);
  if (centavos < 1 || centavos > AMOUNT_MAX_CENTAVOS) return COPY.amountOutOfRange;
  if (centavos > maxCentavos) {
    return maxCentavos <= 0 ? COPY.nothingOwed : COPY.overBalance(centavosToMoneyText(maxCentavos));
  }
  return null;
}

/**
 * The payment form for `today` (the server's business day) and `maxAmount` (money text: the most that may be paid, from
 * `paymentCap`). A payment may be dated before the order date (07 D-41).
 */
export function orderPaymentSchema(today: string, maxAmount: string) {
  const maxCentavos = moneyTextToCentavos(maxAmount);
  return z.object({
    paymentDate: z.string().superRefine((text, context) => {
      const message = dateError(text, today);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    amount: z.string().superRefine((text, context) => {
      const message = amountError(text, maxCentavos);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    paymentMethodId: z.string().min(1, COPY.methodRequired),
    reference: optionalText(REFERENCE_MAX, COPY.referenceTooLong),
    notes: optionalText(NOTES_MAX, COPY.notesTooLong),
    receivedByUserId: z.string().min(1, COPY.receivedByRequired),
  });
}

/** True when `amountText` passes every amount rule except the cap and is above `maxAmount` (money text): the one failure a fresh read can cure. */
export function isOverPaymentCap(amountText: string, maxAmount: string): boolean {
  return (
    amountError(amountText, Number.POSITIVE_INFINITY) === null &&
    amountError(amountText, moneyTextToCentavos(maxAmount)) !== null
  );
}

export type OrderPaymentFormInput = z.input<ReturnType<typeof orderPaymentSchema>>;
export type OrderPaymentFormValues = z.output<ReturnType<typeof orderPaymentSchema>>;

/** A new payment: the server's today, no amount, no method chosen (D-29) and the signed-in person as the receiver (D-11). */
export function blankOrderPayment(today: string, receivedByUserId: string): OrderPaymentFormInput {
  return { paymentDate: today, amount: '', paymentMethodId: '', reference: '', notes: '', receivedByUserId };
}

/** Whole centavos of a server figure. The server sends two decimals, so the rounding only removes float noise. */
function centavosOf(value: number | string | null | undefined): number {
  return value === null || value === undefined ? 0 : Math.round(Number(value) * 100);
}

/**
 * The most a payment may be, as money text: the server balance on an add, and on an edit the balance plus the payment's
 * saved amount (`savedAmount`), which is already inside the paid figure. Never below zero (D-11, D-48).
 */
export function paymentCap(order: Pick<OrderDetailResponse, 'totals'>, savedAmount?: number | string | null): string {
  return centavosToMoneyText(Math.max(0, centavosOf(order.totals.balance) + centavosOf(savedAmount)));
}

/** True when taking this payment away would leave the payments below the refunds already recorded (D-09, D-49). */
export function wouldLeavePaymentsBelowRefunds(
  order: Pick<OrderDetailResponse, 'totals'>,
  payment: Pick<OrderDetailResponse['payments'][number], 'amount'>,
): boolean {
  return centavosOf(order.totals.paid) - centavosOf(payment.amount) < centavosOf(order.totals.refunded);
}
