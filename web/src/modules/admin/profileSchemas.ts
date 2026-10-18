// The My Profile name form's zod schema (OR-3): it mirrors UpdateProfileNameRequestValidator, so the browser checks every
// rule before a request is sent. Both names are trimmed, required, and at most 100 UTF-16 code units (a JavaScript string
// length, the unit the server counts). The version is not typed by the person and is not part of this schema.
import { z } from 'zod';
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
