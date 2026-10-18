// The Add User form's zod schema (OR-3): it mirrors CreateUserRequestValidator, so the browser checks every rule before a
// request is sent. Both names are trimmed, required and at most 100 UTF-16 code units (the unit the server counts); the
// email is required and shaped like one; the role and the way to get access are one of their two values; on the temporary
// route the password meets the basic rule only (04 D-21: length, no control character, a number, a symbol; no name or
// breach check). Whether the address is already taken stays with the server.
import { z } from 'zod';
import { checkPasswordComposition, PASSWORD_RULE_MESSAGES } from '@/utils/passwordRules';
import { AUTH_COPY } from './authCopy';
import { isEmailShaped } from './authSchemas';
import { NAME_MAX_LENGTH } from './profileCopy';
import { USERS_COPY } from './usersCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = USERS_COPY.add.errors;

export const USER_ROLES = ['Admin', 'Manager'] as const;
export const USER_ACCESS = ['invitation', 'temporary-password'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type UserAccess = (typeof USER_ACCESS)[number];

/** A trimmed, required name; the length is the JavaScript string length, as the server counts it. */
function nameField(required: string, tooLong: string) {
  return z
    .string()
    .trim()
    .min(1, required)
    .refine((name) => name.length <= NAME_MAX_LENGTH, tooLong);
}

export const createUserSchema = z
  .object({
    firstName: nameField(COPY.firstNameRequired, COPY.firstNameTooLong),
    lastName: nameField(COPY.lastNameRequired, COPY.lastNameTooLong),
    email: z
      .string()
      .trim()
      .min(1, COPY.emailRequired)
      .refine((email) => email === '' || isEmailShaped(email), AUTH_COPY.errors.emailInvalid),
    role: z.enum(USER_ROLES, { error: COPY.roleRequired }),
    access: z.enum(USER_ACCESS, { error: COPY.accessRequired }),
    temporaryPassword: z.string(),
  })
  .superRefine((values, context) => {
    if (values.access !== 'temporary-password') {
      return;
    }
    const failure = checkPasswordComposition(values.temporaryPassword);
    if (failure !== null) {
      context.addIssue({
        code: 'custom',
        path: ['temporaryPassword'],
        message: failure === 'empty' ? COPY.temporaryPasswordRequired : PASSWORD_RULE_MESSAGES[failure],
      });
    }
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;
