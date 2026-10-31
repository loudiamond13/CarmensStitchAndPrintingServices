// The order expense window rules (OR-3; plan 08-18): the browser checks every rule of OrderExpenseFieldsValidator.cs before a request is
// sent, with the server's own words. Every control is text; the amount stays text until the check has passed and only then becomes a
// number (T-06-39). The date limit counts from the server's business today, never from the device clock (D-30). Whether the category
// and the payer may be chosen needs the database, so the server still decides.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { latestExpenseDate } from '@/modules/admin/expensesSchemas';
import { ORDER_EXPENSE_COPY } from '@/modules/admin/orderExpenseCopy';
import { formatCalendarDate, isMoneyText, moneyTextToCentavos } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = ORDER_EXPENSE_COPY.errors;

const DESCRIPTION_MAX = 200;
/** The largest expense, in centavos (OrderRules.ExpenseAmountMax). */
const AMOUNT_MAX_CENTAVOS = 100_000_000;

/** The message under Date for `date`, or null when it is a real day that is not more than 30 days after `today`. */
function dateError(date: string, today: string): string | null {
  const text = date.trim();
  if (text === '') return COPY.dateRequired;
  if (!isCalendarDate(text)) return COPY.dateInvalid;
  const latest = latestExpenseDate(today);
  return latest !== null && text > latest ? COPY.dateTooFar(formatCalendarDate(latest) ?? latest) : null;
}

/** The message under Amount for `text`, or null when it is from 0.01 to 1,000,000.00 with 2 decimals. */
function amountError(text: string): string | null {
  if (text === '' || text === '.') return COPY.amountTooSmall;
  if (/^\d*\.\d{3,}$/.test(text)) return COPY.moneyDecimals;
  if (!isMoneyText(text)) {
    // Digits and one point that are too long are an amount that is too large; anything else is not an amount.
    return /^\d+(\.\d*)?$/.test(text) ? COPY.amountTooLarge : moneyInputError(text);
  }
  const centavos = moneyTextToCentavos(text);
  if (centavos < 1) return COPY.amountTooSmall;
  return centavos > AMOUNT_MAX_CENTAVOS ? COPY.amountTooLarge : null;
}

/** The order expense form for `today` (the server's business day). The description comes out trimmed, and empty as null. */
export function orderExpenseSchema(today: string) {
  return z.object({
    expenseDate: z.string().superRefine((text, context) => {
      const message = dateError(text, today);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    orderExpenseCategoryId: z.string().min(1, COPY.categoryRequired),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX, COPY.descriptionTooLong)
      .transform((text) => (text === '' ? null : text)),
    amount: z.string().superRefine((text, context) => {
      const message = amountError(text);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    paidByUserId: z.string().min(1, COPY.paidByRequired),
  });
}

export type OrderExpenseFormInput = z.input<ReturnType<typeof orderExpenseSchema>>;
export type OrderExpenseFormValues = z.output<ReturnType<typeof orderExpenseSchema>>;

/** A new expense: the server's today, no category or amount, and the signed-in person as the payer (D-11). */
export function blankOrderExpense(today: string, paidByUserId: string): OrderExpenseFormInput {
  return { expenseDate: today, orderExpenseCategoryId: '', description: '', amount: '', paidByUserId };
}
