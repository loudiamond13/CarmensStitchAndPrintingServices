// The Company Expenses zod schemas (OR-3): the browser checks every rule the server's validator has before a request is sent.
// This file holds the list's date range and the Add and Edit Expense form (plans 06-12, 06-14).
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { formatCalendarDate, isMoneyText, moneyTextToCentavos } from '@/utils/format';
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

// The Add Expense form (CEXP-02, D-19..D-21; plan 06-12): it mirrors ExpenseRules.cs and the expense validator, so every rule
// the server checks is checked here first, with the server's own words. Every control is text; the amount stays text until the
// check has passed and only then becomes a number for the request (T-06-39). The date limit counts from the server's business
// today, never from the device clock (D-20).
const DAYS_AHEAD = 30;
const DESCRIPTION_MAX = 200;
const NOTES_MAX = 1000;
/** The largest amount, in centavos (D-21). */
const AMOUNT_MAX_CENTAVOS = 100_000_000;
const CALENDAR_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day `days` after a `yyyy-MM-dd` day, as `yyyy-MM-dd`; null when the text is not a day. */
function addDays(ymd: string, days: number): string | null {
  const match = CALENDAR_PARTS.exec(ymd);
  if (match === null || !isCalendarDate(ymd)) {
    return null;
  }
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return shifted.toISOString().slice(0, 10);
}

/** The latest day an expense may be dated, given the server's business today (null when today is not a day). */
export function latestExpenseDate(today: string): string | null {
  return addDays(today, DAYS_AHEAD);
}

/** The message under Date for `date`, or null when it is acceptable. */
function dateError(date: string, today: string): string | null {
  if (date === '') {
    return COPY.dateRequired;
  }
  if (!isCalendarDate(date)) {
    return COPY.notReal;
  }
  const latest = latestExpenseDate(today);
  if (latest !== null && date > latest) {
    return COPY.dateTooFar(formatCalendarDate(latest) ?? latest);
  }
  return null;
}

/**
 * The saved values of the expense an Edit form opened with. On an edit the amount cap and the description and notes lengths
 * apply only to a value that differs from these, so an imported row over a limit stays editable (D-33; ExpenseFieldsValidator).
 */
export interface StoredExpenseFields {
  description: string;
  amount: number;
  notes: string | null;
}

/**
 * The message under Amount for the typed text, or null when it is acceptable (more than zero, 2 decimals, and at most the cap
 * unless it equals the stored amount).
 */
function amountError(text: string, storedCentavos: number | null): string | null {
  if (text === '' || text === '.') {
    return COPY.amountTooSmall;
  }
  if (/^\d*\.\d{3,}$/.test(text)) {
    return COPY.amountDecimals;
  }
  if (!isMoneyText(text)) {
    // Digits and one point that are too long are an amount that is too large; anything else is not an amount.
    return /^\d+(\.\d*)?$/.test(text) ? COPY.amountTooLarge : moneyInputError(text);
  }
  const centavos = moneyTextToCentavos(text);
  if (centavos <= 0) {
    return COPY.amountTooSmall;
  }
  return centavos > AMOUNT_MAX_CENTAVOS && centavos !== storedCentavos ? COPY.amountTooLarge : null;
}

/**
 * The expense form schema for the server's business `today`. Pass `stored` on an edit (see StoredExpenseFields); Add passes
 * nothing and every limit applies. The description and notes come out trimmed, empty notes as null.
 */
export function expenseFormSchema(today: string, stored?: StoredExpenseFields) {
  const storedCentavos = stored === undefined ? null : Math.round(stored.amount * 100);
  return z.object({
    date: z.string().superRefine((date, context) => {
      const message = dateError(date, today);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    categoryId: z.string().min(1, COPY.categoryRequired),
    description: z
      .string()
      .trim()
      .min(1, COPY.descriptionRequired)
      .refine((text) => text.length <= DESCRIPTION_MAX || text === stored?.description, COPY.descriptionTooLong),
    amount: z.string().superRefine((amount, context) => {
      const message = amountError(amount, storedCentavos);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    paidByUserId: z.string().min(1, COPY.paidByRequired),
    notes: z
      .string()
      .trim()
      .refine((text) => text.length <= NOTES_MAX || text === stored?.notes, COPY.notesTooLong)
      .transform((notes) => (notes === '' ? null : notes)),
  });
}

export type ExpenseFormValues = z.output<ReturnType<typeof expenseFormSchema>>;

/** What the form holds while it is edited: every control is text. */
export type ExpenseFormInput = z.input<ReturnType<typeof expenseFormSchema>>;
