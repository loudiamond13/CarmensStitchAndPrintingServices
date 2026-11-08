// The Transfer Money form rules (OR-3; plan 10-15): the browser checks the rules of CreateMoneyTransferRequestValidator.cs before a request
// is sent, with the server's own words. Every control is text; the amount stays text until the check has passed and only then becomes
// the body's amount. What needs the database (who the recipient is now, what the sender holds under lock) stays with the server.
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { formatPeso, round2 } from '@/utils/csps';
import { centavosToMoneyText, isMoneyText, moneyTextToCentavos } from '@/utils/format';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = MONEY_COPY.transfer.errors;

/** The longest note, after trimming (MoneyRules.NoteMaxLength). */
const NOTE_MAX = 200;

/** A leaver who is owed money: their name and what they are owed (positive), for the Manager's cap (D-49). */
export interface OwedLeaver {
  name: string;
  owed: number;
}

/** What the schema needs from the window: the sender's balance read when it opened (null until known) and the business today. */
export interface TransferSchemaOptions {
  balance: number | null;
  today: string;
  /** A Manager only: what each leaver is owed, by id, from the staff balances read when the window opened. An Admin is never given it. */
  owedByRecipient?: ReadonlyMap<string, OwedLeaver> | undefined;
}

/** What the hand-over schema needs: the leaver (the sender), what they hold (null until known) and the business today. */
export interface HandoverSchemaOptions {
  leaverName: string;
  leaverBalance: number | null;
  today: string;
}

/**
 * The message under Date for `date`, or null when it is a real day that is not after the business `today`. The words are the
 * server's (MoneyRules.cs), kept in moneyCopy.ts: "The transfer date can't be in the future." for a day after `today`.
 */
function dateError(date: string, today: string): string | null {
  const text = date.trim();
  if (text === '') return COPY.dateRequired;
  if (!isCalendarDate(text)) return COPY.dateInvalid;
  return text > today ? COPY.dateInFuture : null;
}

/**
 * The message under Amount for the typed text, or null when it is acceptable: at least 0.01, at most 2 decimals, and no more than the
 * `balance` the window read when it opened. With no balance known the cap is left to the server.
 */
function amountError(text: string, balance: number | null): string | null {
  if (text === '' || text === '.') return COPY.amountRequired;
  // The server checks the minimum before the decimal places, so zero with extra decimals ("0.000") says "at least".
  if (/^\d*\.\d{3,}$/.test(text)) return /[1-9]/.test(text) ? COPY.amountDecimals : COPY.amountTooSmall;
  if (!isMoneyText(text)) return moneyInputError(text);
  const centavos = moneyTextToCentavos(text);
  if (centavos < 1) return COPY.amountTooSmall;
  if (balance === null) return null;
  if (round2(balance) <= 0) return COPY.nothingOnHand;
  return centavos > Math.round(balance * 100) ? COPY.aboveBalance(formatPeso(balance)) : null;
}

export function transferFormSchema({ balance, today }: TransferSchemaOptions) {
  return z.object({
    toUserId: z.string().min(1, COPY.toRequired),
    amount: z.string().superRefine((text, context) => {
      const message = amountError(text, balance);
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
      .refine((note) => note.length <= NOTE_MAX, COPY.noteTooLong)
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

export function handoverFormSchema({ today }: HandoverSchemaOptions) {
  return transferFormSchema({ balance: null, today });
}

/** The hand-over request body: the leaver as the sender, then the same four fields. */
export interface HandoverBody extends TransferBody {
  fromUserId: string;
}

export function toHandoverBody(values: TransferFormOutput, fromUserId: string): HandoverBody {
  return { ...toTransferBody(values), fromUserId };
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
