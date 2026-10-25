// The Company Expenses zod schemas (OR-3): the browser checks every rule the server's validator has before a request is sent.
// This file holds the list's date range and the Add Expense form (plan 06-12); the Edit form joins it in plan 06-14.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
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

// The Add Expense form (CEXP-02, D-19..D-21; plan 06-12). Task 1 holds the required-field checks; every other rule the server
// validates joins them in the next task.
export const expenseFormSchema = z.object({
  date: z.string().min(1, COPY.dateRequired),
  categoryId: z.string().min(1, COPY.categoryRequired),
  description: z.string().trim().min(1, COPY.descriptionRequired),
  amount: z.string().refine((amount) => moneyInputError(amount, { required: true }) === null, COPY.amountTooSmall),
  paidByUserId: z.string().min(1, COPY.paidByRequired),
  notes: z.string(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

/** What the form holds while it is edited: every control is text. */
export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
