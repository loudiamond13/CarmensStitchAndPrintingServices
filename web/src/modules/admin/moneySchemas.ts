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

/**
 * Whitespace plus U+FEFF and U+0085 at either end. JavaScript's trim keeps U+0085 and .NET's keeps U+FEFF, so both are named here and
 * the browser measures the note as the server does (CreateMoneyTransferRequestValidator, MoneyTransfer).
 */
const NOTE_ENDS = /^[\s\uFEFF\u0085]+|[\s\uFEFF\u0085]+$/g;

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

/** The two sender-balance messages of an Amount: what to say with nothing on hand, and with more than is on hand. */
interface BalanceWords {
  nothing: string;
  above: (balance: number) => string;
}

const TRANSFER_WORDS: BalanceWords = {
  nothing: COPY.nothingOnHand,
  above: (balance) => COPY.aboveBalance(formatPeso(balance)),
};

function handoverWords(leaverName: string): BalanceWords {
  const words = MONEY_COPY.handover.errors;
  return {
    nothing: words.nothingOnHand(leaverName),
    above: (balance) => words.aboveBalance(leaverName, formatPeso(balance)),
  };
}

/**
 * The message under Amount for the typed text, or null when it is acceptable: at least 0.01, at most 2 decimals, and no more than the
 * `balance` the window read when it opened. With no balance known the cap is left to the server.
 */
function amountError(text: string, balance: number | null, words: BalanceWords): string | null {
  if (text === '' || text === '.') return COPY.amountRequired;
  // The server checks the minimum before the decimal places, so zero with extra decimals ("0.000") says "at least".
  if (/^\d*\.\d{3,}$/.test(text)) return /[1-9]/.test(text) ? COPY.amountDecimals : COPY.amountTooSmall;
  if (!isMoneyText(text)) return moneyInputError(text);
  const centavos = moneyTextToCentavos(text);
  if (centavos < 1) return COPY.amountTooSmall;
  if (balance === null) return null;
  if (round2(balance) <= 0) return words.nothing;
  return centavos > Math.round(balance * 100) ? words.above(balance) : null;
}

interface FormRules {
  /** What the sender holds (null until known), and the words for it. */
  balance: number | null;
  words: BalanceWords;
  today: string;
  owedByRecipient: ReadonlyMap<string, OwedLeaver> | undefined;
}

/** The four fields of a transfer or a hand-over; they differ only in the sender-balance words and the owed cap. */
function formSchema({ balance, words, today, owedByRecipient }: FormRules) {
  return z
    .object({
      toUserId: z.string().min(1, COPY.toRequired),
      amount: z.string().superRefine((text, context) => {
        const message = amountError(text, balance, words);
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
        .transform((note) => note.replace(NOTE_ENDS, ''))
        .refine((note) => note.length <= NOTE_MAX, COPY.noteTooLong)
        .transform((note) => (note === '' ? null : note)),
    })
    .superRefine((values, context) => {
      // D-49 (a Manager only): into a leaver who is owed money, no more than they are owed. The amount's own rules, and the sender's
      // balance, come first; the server decides everything the browser was not given.
      const leaver = owedByRecipient?.get(values.toUserId);
      if (leaver === undefined || amountError(values.amount, balance, words) !== null) return;
      if (moneyTextToCentavos(values.amount) > Math.round(leaver.owed * 100)) {
        context.addIssue({
          code: 'custom',
          path: ['amount'],
          message: COPY.owedOnly(leaver.name, formatPeso(leaver.owed)),
        });
      }
    });
}

export function transferFormSchema({ balance, today, owedByRecipient }: TransferSchemaOptions) {
  return formSchema({ balance, words: TRANSFER_WORDS, today, owedByRecipient });
}

/** The hand-over form: the same four fields, capped at what the leaver holds, in the server's words for a hand-over (D-18). */
export function handoverFormSchema({ leaverName, leaverBalance, today }: HandoverSchemaOptions) {
  return formSchema({ balance: leaverBalance, words: handoverWords(leaverName), today, owedByRecipient: undefined });
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
