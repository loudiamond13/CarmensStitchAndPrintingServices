// The auth forms' zod schemas (OR-3): each mirrors its server validator, so the browser checks every rule before a
// request is sent. Checks only the server can make (the account, uniqueness, the breach lookup) stay server-side.
import { z } from 'zod';
import { AUTH_COPY } from './authCopy';

/** The longest accepted email address (SignInRequestValidator.EmailMaxLength). */
export const EMAIL_MAX_LENGTH = 256;

/** One '@' with text on both sides, within the length cap: the server's check, with no regular expression. */
export function isEmailShaped(email: string): boolean {
  if (email.length > EMAIL_MAX_LENGTH) {
    return false;
  }
  const at = email.indexOf('@');
  return at > 0 && at < email.length - 1 && !email.slice(at + 1).includes('@');
}

/** SignInRequestValidator: the email is required and shaped like one; the password only has to be there. */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, AUTH_COPY.errors.emailRequired)
    .refine((email) => email === '' || isEmailShaped(email), AUTH_COPY.errors.emailInvalid),
  password: z.string().min(1, AUTH_COPY.errors.passwordRequired),
  keepSignedIn: z.boolean(),
});

export type SignInValues = z.infer<typeof signInSchema>;
