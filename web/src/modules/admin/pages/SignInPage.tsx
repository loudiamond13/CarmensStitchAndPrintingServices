// S1 Sign in, /admin/login (App. E.5 with the owner's deviations; UI-SPEC "S1 Sign in"; plan 04-26).
//   - SignInForm is the presentational card (also used by the parity preview, plan 04-32); SignInRoute wires it to the
//     form state, the zod schema and the sign-in call.
//   - D-09: the email is never pre-filled or remembered (no default value, nothing written to any storage), while the
//     autocomplete values still let browsers and password managers fill both fields (A11Y-03).
//   - A correct sign-in keeps the typed email in memory only (the code step names it) and opens the code step with the
//     same return path.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type SyntheticEvent } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Checkbox } from '@/components/entry';
import { Field, PasswordField } from '@/components/forms';
import {
  loginBackClasses,
  loginCardClasses,
  loginLinkClasses,
  loginRowClasses,
} from '@/components/layout/layout.recipe';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { signInSchema, type SignInValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { authService, type SignInResponse } from '@/modules/admin/services/authService';
import { setPendingEmail } from '@/modules/admin/services/session';

const VERIFY_PATH = '/admin/login/verify';

export interface SignInFormProps {
  control: Control<SignInValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The sign-in request is in flight (WEB-09). */
  pending: boolean;
}

export function SignInForm({ control, onSubmit, pending }: SignInFormProps) {
  const copy = AUTH_COPY.signIn;
  return (
    <form aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={copy.subline} />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={copy.email}
            type="email"
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            label={copy.password}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            autoComplete="current-password"
            aria-required="true"
          />
        )}
      />
      <div className={loginRowClasses}>
        {/* SPEC-DEVIATION: D-03 App. E.5 draws "Keep me signed in" ticked; it starts unticked and is sent with the sign-in. */}
        <Controller
          control={control}
          name="keepSignedIn"
          render={({ field }) => (
            <Checkbox label={copy.keepSignedIn} checked={field.value} name={field.name} onChange={field.onChange} />
          )}
        />
        {/* SPEC-DEVIATION: D-16 App. E.5 shows a toast; this is a link to the forgot-password screen. */}
        <UiLink to="/admin/forgot-password" className={loginLinkClasses}>
          {copy.forgot}
        </UiLink>
      </div>
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <div className="flex items-start gap-2 rounded-sm bg-surface-2 p-3 text-[13px] leading-[18px] text-ink-muted">
        <Icon name="shield-check" size={18} />
        <span>{copy.staffNote}</span>
      </div>
      <UiLink to="/" className={loginBackClasses}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

export function SignInRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const { control, handleSubmit } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', keepSignedIn: false },
  });
  const { submit, pending } = useSubmission<SignInValues, SignInResponse>(
    (_key, values) => authService.signIn(values),
    {
      onSuccess: (_response, values) => {
        setPendingEmail(values.email);
        const search = returnUrl === null ? '' : `?returnUrl=${encodeURIComponent(safeReturnUrl(returnUrl))}`;
        void navigate(`${VERIFY_PATH}${search}`);
      },
    },
  );
  useEffect(() => {
    document.title = `${AUTH_COPY.signIn.title}${ADMIN_COPY.titleSuffix}`;
  }, []);
  return (
    <SignInForm
      control={control}
      pending={pending}
      onSubmit={(event) => {
        void handleSubmit((values) => submit(values))(event);
      }}
    />
  );
}
