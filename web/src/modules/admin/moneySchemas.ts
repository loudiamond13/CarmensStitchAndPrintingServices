// The Transfer Money form rules (OR-3; plan 10-15): the browser checks the rules of CreateMoneyTransferRequestValidator.cs before a request
// is sent, with the server's own words. Every control is text; the amount stays text until the check has passed and only then becomes
// the body's amount. What needs the database (who the recipient is now, what the sender holds under lock) stays with the server.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { centavosToMoneyText, isMoneyText, moneyTextToCentavos } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = MONEY_COPY.transfer.errors;

/** What the schema needs from the window: the sender's balance read when it opened (null until known) and the business today. */
export interface TransferSchemaOptions {
  balance: number | null;
  today: string;
}

/** The message under Date for `date`, or null when it is a real day that is not after the business `today`. */
function dateError(date: string, today: string): string | null {
  const text = date.trim();
  if (text === '') return COPY.dateRequired;
  if (!isCalendarDate(text)) return COPY.dateInvalid;
  return text > today ? COPY.dateInFuture : null;
}

/** The message under Amount for the typed text, or null when it is acceptable (at least 0.01, at most 2 decimals). */
function amountError(text: string): string | null {
  if (text === '' || text === '.') return COPY.amountRequired;
  if (/^\d*\.\d{3,}$/.test(text)) return COPY.amountDecimals;
  if (!isMoneyText(text)) return moneyInputError(text);
  return moneyTextToCentavos(text) < 1 ? COPY.amountTooSmall : null;
}

export function transferFormSchema({ today }: TransferSchemaOptions) {
  return z.object({
    toUserId: z.string().min(1, COPY.toRequired),
    amount: z.string().superRefine((text, context) => {
      const message = amountError(text);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    transferDate: z.string().superRefine((text, context) => {
      const message = dateError(text, today);
      if (message !== null) {
        context.addIssue({ code: 'custom', message });
      }
    }),
    note: z
      .string()
      .trim()
      .transform((note) => (note === '' ? null : note)),
  });
}

/** What the form holds while it is edited: every control is text. */
export type TransferFormInput = z.input<ReturnType<typeof transferFormSchema>>;

/** What a valid form gives: the amount is still text, the note is null when empty. */
export type TransferFormOutput = z.output<ReturnType<typeof transferFormSchema>>;

/** The request body: the recipient, the amount, the day and the note, and nothing else. The server knows the sender from the token. */
export interface TransferBody {
  toUserId: string;
  amount: string;
  transferDate: string;
  note: string | null;
}

/** Builds the body from a valid form: the amount as exact money text with two decimals ("2000" becomes "2000.00"). */
export function toTransferBody(values: TransferFormOutput): TransferBody {
  return {
    toUserId: values.toUserId,
    amount: centavosToMoneyText(moneyTextToCentavos(values.amount)),
    transferDate: values.transferDate.trim(),
    note: values.note,
  };
}
