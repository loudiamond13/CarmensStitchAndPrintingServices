// SPEC-GAP: new-password fields (UI-SPEC S3, S5 and S6; plan 04-28). The pair every set-a-password screen shares: an
// optional hidden username input so password managers save the new password against the right account, "New password"
// with the strength meter and the rule hint, and "Confirm new password". Paste works and both fields have Show/Hide.
import { Controller, type Control } from 'react-hook-form';
import { PasswordField } from '@/components/forms';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { NewPasswordValues } from '@/modules/admin/authSchemas';

export interface NewPasswordFieldsProps<TValues extends NewPasswordValues> {
  /** The form's control. The form may hold more fields than the pair (the profile form also has Current password). */
  control: Control<TValues>;
  /** The account's email for the hidden username input, or null when it is not known (the input is left out). */
  email: string | null;
}

export function NewPasswordFields<TValues extends NewPasswordValues>({
  control: formControl,
  email,
}: NewPasswordFieldsProps<TValues>) {
  const copy = AUTH_COPY.newPassword;
  // Safe: TValues has both fields of the pair. React Hook Form's Control is invariant in its values, so a form with
  // extra fields would not be accepted as a Control of just the pair.
  const control = formControl as unknown as Control<NewPasswordValues>;
  return (
    <>
      {email !== null && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          // OQ-2 default A: the App. D.1 strength meter stays, and the rule is always written in the hint line.
          <PasswordField
            label={copy.newLabel}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            hint={copy.ruleHint}
            showStrength
            autoComplete="new-password"
            aria-required="true"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <PasswordField
            label={copy.confirmLabel}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            autoComplete="new-password"
            aria-required="true"
          />
        )}
      />
    </>
  );
}
