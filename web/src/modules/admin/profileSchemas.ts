// The My Profile forms' zod schemas (OR-3): each mirrors its server validator, so the browser checks every rule before a request
// is sent. The name form (UpdateProfileNameRequestValidator): both names are trimmed, required, and at most 100 UTF-16 code
// units (a JavaScript string length, the unit the server counts); the version is not typed by the person. The Change Email
// dialog (RequestEmailChangeRequestValidator) is below.
import { z } from 'zod';
import { AUTH_COPY } from './authCopy';
import { isEmailShaped } from './authSchemas';
import { NAME_MAX_LENGTH, PROFILE_COPY } from './profileCopy';

// The strict CSP has no 'unsafe-eval'. Zod probes for code generation with `new Function`, which the browser reports as
// a CSP violation even though the probe is caught, so every schema here runs in its plain (non-generated) mode.
z.config({ jitless: true });

const COPY = PROFILE_COPY.errors;

/**
 * A trimmed, required name. The length is the JavaScript string length (UTF-16 code units), not zod's `max`, which counts
 * code points: the server counts units, so an emoji must cost two here as well.
 */
function nameField(required: string, tooLong: string) {
  return z
    .string()
    .trim()
    .min(1, required)
    .refine((name) => name.length <= NAME_MAX_LENGTH, tooLong);
}

export const profileNameSchema = z.object({
  firstName: nameField(COPY.firstNameRequired, COPY.firstNameTooLong),
  lastName: nameField(COPY.lastNameRequired, COPY.lastNameTooLong),
});

export type ProfileNameValues = z.infer<typeof profileNameSchema>;

/**
 * The Change Email dialog (RequestEmailChangeRequestValidator, OR-3): the new address is required, shaped like an email,
 * at most 256 characters and not the current address in any letter case; the current password only has to be there.
 * Whether the address is taken and whether the password is right stay with the server.
 */
export function changeEmailSchema(currentEmail: string) {
  const current = currentEmail.trim().toLowerCase();
  return z.object({
    newEmail: z
      .string()
      .trim()
      .superRefine((email, context) => {
        const message =
          email === ''
            ? COPY.newEmailRequired
            : !isEmailShaped(email)
              ? AUTH_COPY.errors.emailInvalid
              : email.toLowerCase() === current
                ? COPY.sameEmail
                : null;
        if (message !== null) {
          context.addIssue({ code: 'custom', message });
        }
      }),
    currentPassword: z.string().min(1, COPY.currentPasswordRequired),
  });
}

export type ChangeEmailValues = z.infer<ReturnType<typeof changeEmailSchema>>;
