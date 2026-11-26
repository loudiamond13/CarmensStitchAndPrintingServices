// The quote form's zod schema (OR-3, INQ-01): it mirrors QuoteRequestRules, rule for rule and word for word, so the browser checks
// everything the server checks before a request is sent. Lengths are UTF-16 code units after trimming, the same measure as the
// server's string length. What only the server can know (the ticket, the bot guards, the limits, whether a line is still shown)
// stays server-side.
import { config, minLength, object, refine, string, trim, type output } from 'zod/mini';
import { isPlainEmail } from '@/utils/email';
import { isMobileE164, phoneE164 } from '@/utils/phone';
import { PUBLIC_COPY } from './copy';
import { isLineKey } from './lineKey';
import type { CreateQuoteBody } from './services/quoteService';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see authSchemas.ts).
// The form uses zod/mini, the same package with each check imported on its own, so the form's own piece stays inside its budget (D-35).
config({ jitless: true });

const ERRORS = PUBLIC_COPY.contact.form.errors;

/** QuoteRequestRules.CustomerNameMaxLength. */
export const CUSTOMER_NAME_MAX = 100;
/** QuoteRequestRules.TeamNameMaxLength. */
export const TEAM_NAME_MAX = 100;
/** QuoteRequestRules.ContactNumberMaxLength: counted on the trimmed text, before it is read as a number. */
export const CONTACT_NUMBER_MAX = 30;
/** QuoteRequestRules.EmailMaxLength. */
export const EMAIL_MAX = 254;
/** QuoteRequestRules.MessageMaxLength. */
export const MESSAGE_MAX = 2000;
/** The longest line key (ProductLine key length). */
export const LINE_KEY_MAX = 40;

/** The Select value of a product line: `line:` and its key; the fixed choices are `custom` and `not-sure`. */
const LINE_PREFIX = 'line:';

/** The five quantity ranges, with the labels the Select shows (QuoteQuantityRange). */
export const QUOTE_QUANTITIES = PUBLIC_COPY.contact.form.quantity.options;

const QUANTITY_VALUES: readonly string[] = QUOTE_QUANTITIES.map((option) => option.value);

/**
 * At most `max` UTF-16 code units, the server's string length (an emoji counts as 2). zod's own maximum counts code points, so
 * the limit is a refinement: zod's would let through text the server refuses.
 */
function atMost(max: number, message: string) {
  return refine<string>((text) => text.length <= max, message);
}

/** QuoteRequestRules.TryParseMobile: within the length cap and a Philippine mobile number (never a landline). */
function isMobileNumber(text: string): boolean {
  if (text.length > CONTACT_NUMBER_MAX) {
    return false;
  }
  const e164 = phoneE164(text);
  return e164 !== null && isMobileE164(e164);
}

/** Nothing, a fixed choice, or a line whose key looks like a line key (the server also checks the line is shown). */
function isProductChoice(value: string): boolean {
  if (value === '' || value === 'custom' || value === 'not-sure') {
    return true;
  }
  if (!value.startsWith(LINE_PREFIX)) {
    return false;
  }
  const key = value.slice(LINE_PREFIX.length);
  return key.length <= LINE_KEY_MAX && isLineKey(key);
}

export const quoteFormSchema = object({
  customerName: string().check(
    trim(),
    minLength(1, ERRORS.nameRequired),
    atMost(CUSTOMER_NAME_MAX, ERRORS.nameTooLong),
  ),
  teamName: string().check(trim(), atMost(TEAM_NAME_MAX, ERRORS.teamTooLong)),
  contactNumber: string().check(trim(), refine(isMobileNumber, ERRORS.numberInvalid)),
  email: string().check(
    trim(),
    atMost(EMAIL_MAX, ERRORS.emailTooLong),
    refine((text) => text === '' || isPlainEmail(text), ERRORS.emailInvalid),
  ),
  product: string().check(refine(isProductChoice, ERRORS.productInvalid)),
  quantity: string().check(refine((text) => text === '' || QUANTITY_VALUES.includes(text), ERRORS.quantityInvalid)),
  message: string().check(trim(), atMost(MESSAGE_MAX, ERRORS.messageTooLong)),
  // The honeypot (INQ-03): no rule, the server decides what a filled one means.
  subjectLine: string(),
});

export type QuoteFormValues = output<typeof quoteFormSchema>;

/** A blank form. */
/** The visible fields in page order: the first one with an error takes focus. */
export const QUOTE_FIELD_ORDER = [
  'customerName',
  'teamName',
  'contactNumber',
  'email',
  'product',
  'quantity',
  'message',
] as const satisfies readonly (keyof QuoteFormValues)[];

export type QuoteField = (typeof QUOTE_FIELD_ORDER)[number];

export const EMPTY_QUOTE_FORM: QuoteFormValues = {
  customerName: '',
  teamName: '',
  contactNumber: '',
  email: '',
  product: '',
  quantity: '',
  message: '',
  subjectLine: '',
};

/**
 * The create body for the checked values, without the ticket (the form adds it when it sends). A line choice goes as
 * productChoice `line` with its key; a fixed choice goes as itself with no key. Optional text goes as empty text, the way the
 * server reads "nothing"; `subjectLine` is the honeypot and goes as typed, which is empty for a real visitor.
 */
export function toCreateQuoteRequest(values: QuoteFormValues): Omit<CreateQuoteBody, 'ticket'> {
  const line = values.product.startsWith(LINE_PREFIX);
  return {
    customerName: values.customerName,
    teamName: values.teamName,
    contactNumber: values.contactNumber,
    email: values.email,
    productChoice: line ? 'line' : values.product,
    productLineKey: line ? values.product.slice(LINE_PREFIX.length) : '',
    quantity: values.quantity,
    message: values.message,
    subjectLine: values.subjectLine,
  };
}

/** The upload key of one send: 32 random bytes as base64url text, 43 characters (the server keeps only its SHA-256). */
export function newUploadKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
