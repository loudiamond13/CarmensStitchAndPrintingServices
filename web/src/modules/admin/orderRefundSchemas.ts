// The refund window rules (OR-3; plan 08-21): the browser checks every rule of OrderRefundFieldsValidator.cs and OrderRules.cs before
// a request is sent, with the server's own words. Every control is text; the amount stays text until the check has passed and only
// then becomes a number (T-06-39). The cap is a preview from the server's figures (`refundCap`); the server still decides.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { ORDER_REFUND_COPY } from '@/modules/admin/orderRefundCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { centavosToMoneyText, isMoneyText, moneyTextToCentavos } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDER_REFUND_COPY.errors;

const REASON_MAX = 200;
/** The largest refund, in centavos (OrderRules.PaymentAmountMax). */
const AMOUNT_MAX_CENTAVOS = 100_000_000;

/** Which cap the amount is held to: the customer credit, or what a Cancelled order was paid and has not handed back. */
export type RefundCapKind = 'credit' | 'cancelled';

/** The cap kind of an order: a Cancelled order is capped by what was paid, any other by its credit (07 D-09, D-35). */
export function refundCapKind(order: Pick<OrderDetailResponse, 'status'>): RefundCapKind {
  return order.status === 'cancelled' ? 'cancelled' : 'credit';
}

/** The message under Date for `date`, or null when it is a real day that is not after `today`. */
function dateError(date: string, today: string): string | null {
  const text = date.trim();
  if (text === '') return COPY.dateRequired;
  if (!isCalendarDate(text)) return COPY.dateInvalid;
  return text > today ? COPY.dateInFuture : null;
}

/** The message for an amount above the cap, in the server's words for the kind of order. */
function overCapMessage(maxCentavos: number, kind: RefundCapKind): string {
  if (kind === 'cancelled') {
    return maxCentavos <= 0 ? COPY.nothingToRefund : COPY.overKept(centavosToMoneyText(maxCentavos));
  }
  return COPY.overCredit(centavosToMoneyText(maxCentavos));
}

/** The message under Amount for `text`, or null when it is from 0.01 to 1,000,000.00, with 2 decimals, within `maxCentavos`. */
function amountError(text: string, maxCentavos: number, kind: RefundCapKind): string | null {
  if (text === '' || text === '.') return COPY.amountRequired;
  if (/^\d*\.\d{3,}$/.test(text)) return COPY.moneyDecimals;
  if (!isMoneyText(text)) {
    // Digits and one point that are too long are an amount that is too large; anything else is not an amount.
    return /^\d+(\.\d*)?$/.test(text) ? COPY.amountOutOfRange : moneyInputError(text);
  }
  const centavos = moneyTextToCentavos(text);
  if (centavos < 1 || centavos > AMOUNT_MAX_CENTAVOS) return COPY.amountOutOfRange;
  return centavos > maxCentavos ? overCapMessage(maxCentavos, kind) : null;
}

/**
 * The refund form for `today` (the server's business day), `maxAmount` (money text: the most that may be refunded, from
 * `refundCap`) and the kind of cap that applies.
 */
export function orderRefundSchema(today: string, maxAmount: string, capKind: RefundCapKind) {
  const maxCentavos = moneyTextToCentavos(maxAmount);
  return z.object({
    refundDate: z.string().superRefine((text, context) => {
      const message = dateError(text, today);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    amount: z.string().superRefine((text, context) => {
      const message = amountError(text, maxCentavos, capKind);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    reason: z.string().trim().min(1, COPY.reasonRequired).max(REASON_MAX, COPY.reasonTooLong),
    refundedByUserId: z.string().min(1, COPY.refundedByRequired),
  });
}

/** True when `amountText` passes every amount rule except the cap and is above `maxAmount` (money text): the one failure a fresh read can cure. */
export function isOverRefundCap(amountText: string, maxAmount: string): boolean {
  return (
    amountError(amountText, Number.POSITIVE_INFINITY, 'credit') === null &&
    amountError(amountText, moneyTextToCentavos(maxAmount), 'credit') !== null
  );
}

export type OrderRefundFormInput = z.input<ReturnType<typeof orderRefundSchema>>;
export type OrderRefundFormValues = z.output<ReturnType<typeof orderRefundSchema>>;

/** A new refund: the server's today, the signed-in person as the refunder (D-10, D-11), and `amount` when given (D-19). */
export function blankOrderRefund(today: string, refundedByUserId: string, amount = ''): OrderRefundFormInput {
  return { refundDate: today, amount, reason: '', refundedByUserId };
}
