// The Add User and Set Temporary Password zod schemas (OR-3): they mirror CreateUserRequestValidator and SetTemporaryPasswordRequestValidator, so the browser checks every rule before a
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

/** Adds the basic-rule message under the temporary password field when the password breaks it (04 D-21: no name or breach check). */
function checkTemporaryPassword(password: string, context: z.RefinementCtx): void {
  const failure = checkPasswordComposition(password);
  if (failure !== null) {
    context.addIssue({
      code: 'custom',
      path: ['temporaryPassword'],
      message: failure === 'empty' ? COPY.temporaryPasswordRequired : PASSWORD_RULE_MESSAGES[failure],
    });
  }
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
    checkTemporaryPassword(values.temporaryPassword, context);
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;

/** The Set Temporary Password dialog (U5; mirrors SetTemporaryPasswordRequestValidator): the basic rule only. */
export const temporaryPasswordSchema = z.object({ temporaryPassword: z.string() }).superRefine((values, context) => {
  checkTemporaryPassword(values.temporaryPassword, context);
});

export type TemporaryPasswordValues = z.infer<typeof temporaryPasswordSchema>;

export const EMAIL_CHANGES = ['confirm', 'now'] as const;
export type EmailChange = (typeof EMAIL_CHANGES)[number];

/** True when `email` is a different address from `saved`: compared after trim, ignoring letter case, as the server does. */
export function emailChanged(email: string, saved: string): boolean {
  return email.trim().toLowerCase() !== saved.trim().toLowerCase();
}

const EDIT_COPY = USERS_COPY.edit;

/**
 * The Edit User form (UpdateUserRequestValidator and the D-45 choice). `savedEmail` rides in the values so the schema can
 * tell a changed email, which needs a choice (`confirm` or `now`), from an unchanged one, which ignores it.
 */
export const updateUserSchema = z
  .object({
    firstName: nameField(COPY.firstNameRequired, COPY.firstNameTooLong),
    lastName: nameField(COPY.lastNameRequired, COPY.lastNameTooLong),
    email: z
      .string()
      .trim()
      .min(1, COPY.emailRequired)
      .refine((email) => email === '' || isEmailShaped(email), AUTH_COPY.errors.emailInvalid),
    role: z.enum(USER_ROLES, { error: COPY.roleRequired }),
    emailChange: z.enum(['', ...EMAIL_CHANGES], { error: EDIT_COPY.emailChange.required }),
    savedEmail: z.string(),
  })
  .superRefine((values, context) => {
    if (isEmailShaped(values.email) && emailChanged(values.email, values.savedEmail) && values.emailChange === '') {
      context.addIssue({ code: 'custom', path: ['emailChange'], message: EDIT_COPY.emailChange.required });
    }
  });

export type UpdateUserValues = z.infer<typeof updateUserSchema>;
