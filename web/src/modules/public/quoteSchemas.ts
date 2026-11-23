// The quote form's zod schema (OR-3, INQ-01): it mirrors QuoteRequestRules, rule for rule and word for word, so the browser checks
// everything the server checks before a request is sent. Lengths are UTF-16 code units after trimming, the same measure as the
// server's string length. What only the server can know (the ticket, the bot guards, the limits) stays server-side.
import { config, maxLength, minLength, object, refine, string, trim, type output } from 'zod/mini';
import { isMobileE164, phoneE164 } from '@/utils/phone';
import { PUBLIC_COPY } from './copy';
import type { CreateQuoteBody } from './services/quoteService';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see authSchemas.ts).
// The form uses zod/mini, the same package with each check imported on its own, so the form's own piece stays inside its budget (D-35).
config({ jitless: true });

const ERRORS = PUBLIC_COPY.contact.form.errors;

/** QuoteRequestRules.CustomerNameMaxLength. */
export const CUSTOMER_NAME_MAX = 100;
/** QuoteRequestRules.ContactNumberMaxLength: counted on the trimmed text, before it is read as a number. */
export const CONTACT_NUMBER_MAX = 30;

/** QuoteRequestRules.TryParseMobile: within the length cap and a Philippine mobile number (never a landline). */
function isMobileNumber(text: string): boolean {
  if (text.length > CONTACT_NUMBER_MAX) {
    return false;
  }
  const e164 = phoneE164(text);
  return e164 !== null && isMobileE164(e164);
}

export const quoteFormSchema = object({
  customerName: string().check(
    trim(),
    minLength(1, ERRORS.nameRequired),
    maxLength(CUSTOMER_NAME_MAX, ERRORS.nameTooLong),
  ),
  contactNumber: string().check(trim(), refine(isMobileNumber, ERRORS.numberInvalid)),
});

export type QuoteFormValues = output<typeof quoteFormSchema>;

/** A blank form. */
export const EMPTY_QUOTE_FORM: QuoteFormValues = { customerName: '', contactNumber: '' };

/**
 * The create body for the checked values, without the ticket (the form adds it when it sends). Optional text goes as empty text,
 * the way the server reads "nothing"; `subjectLine` is the honeypot and goes as typed, which is empty for a real visitor.
 */
export function toCreateQuoteRequest(values: QuoteFormValues): Omit<CreateQuoteBody, 'ticket'> {
  return {
    customerName: values.customerName,
    teamName: '',
    contactNumber: values.contactNumber,
    email: '',
    productChoice: '',
    productLineKey: '',
    quantity: '',
    message: '',
    subjectLine: '',
  };
}
