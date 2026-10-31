// The Orders schemas (OR-3): the browser checks every rule the server's list validator has before a request is sent. This
// file holds the custom order date range of the Orders toolbar (ORD-02, UIC-45; plan 08-09).
import { z } from 'zod';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { ORDERS_COPY } from './ordersCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDERS_COPY.list.dates.errors;

export const orderDateRangeSchema = z
  .object({
    from: z.string().refine(isCalendarDate, COPY.notReal),
    to: z.string().refine(isCalendarDate, COPY.notReal),
  })
  .superRefine((range, context) => {
    if (isCalendarDate(range.from) && isCalendarDate(range.to) && range.from > range.to) {
      context.addIssue({ code: 'custom', path: ['to'], message: COPY.rangeOrder });
    }
  });

/** The message under each date of the range; null when that date is fine. */
export interface OrderRangeErrors {
  from: string | null;
  to: string | null;
}

/** What is wrong with the From and To inputs (an empty date counts as not real); both null when the range can apply. */
export function orderRangeErrors(draft: { from: string; to: string }): OrderRangeErrors {
  const errors: OrderRangeErrors = { from: null, to: null };
  const result = orderDateRangeSchema.safeParse(draft);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if ((field === 'from' || field === 'to') && errors[field] === null) {
        errors[field] = issue.message;
      }
    }
  }
  return errors;
}
