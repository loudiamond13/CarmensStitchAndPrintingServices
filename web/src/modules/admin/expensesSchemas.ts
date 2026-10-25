// The Company Expenses zod schemas (OR-3): the browser checks every rule the server's validator has before a request is sent.
// This file holds the list's date range; the Add and Edit form schema joins it in a later plan.
import { z } from 'zod';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { EXPENSES_COPY } from './expensesCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = EXPENSES_COPY.errors;

/** The message under each date of the range; null when that date is fine. */
export interface ExpenseRangeErrors {
  from: string | null;
  to: string | null;
}

const rangeSchema = z
  .object({
    from: z.string().refine(isCalendarDate, COPY.notReal),
    to: z.string().refine(isCalendarDate, COPY.notReal),
  })
  .superRefine((range, context) => {
    if (isCalendarDate(range.from) && isCalendarDate(range.to) && range.from > range.to) {
      context.addIssue({ code: 'custom', path: ['from'], message: COPY.rangeOrder });
    }
  });

/** What is wrong with the From and To inputs (an empty date counts as not real); both null when the range can apply. */
export function expenseRangeErrors(draft: { from: string; to: string }): ExpenseRangeErrors {
  const errors: ExpenseRangeErrors = { from: null, to: null };
  const result = rangeSchema.safeParse(draft);
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
