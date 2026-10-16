// S1 Sign in card (App. E.5 with the owner's deviations; plan 04-26, split out of SignInPage by plan 04-32). The
// presentational form: SignInRoute wires it to the form state, the zod schema and the sign-in call, and the parity
// preview (web/src/dev/previews/LoginScreen.tsx) draws it with fixed values. It imports no schema or service, so the
// look-equality page does not pull the form libraries' route chunk into its bundle.
import clsx from 'clsx';
import type { Ref, SyntheticEvent } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Checkbox } from '@/components/entry';
import { Field, PasswordField } from '@/components/forms';
import { ErrorState, Note } from '@/components/states';
import {
  loginBackClasses,
  loginCardClasses,
  loginLinkClasses,
  loginRowClasses,
} from '@/components/layout/layout.recipe';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { SignInValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import type { SignInNotice } from '@/modules/admin/services/session';

/** The banner above the fields: the words, and the failure when its reference should show. */
export interface SignInBanner {
  readonly title: string;
  readonly message: string;
  readonly error?: unknown;
}

export interface SignInFormProps {
  control: Control<SignInValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The sign-in request is in flight (WEB-09). */
  pending: boolean;
  /** The one-shot notice above the form, if any. */
  notice?: SignInNotice | null;
  banner?: SignInBanner | null;
  formRef?: Ref<HTMLFormElement>;
}

export function SignInForm({ control, onSubmit, pending, notice = null, banner = null, formRef }: SignInFormProps) {
  const copy = AUTH_COPY.signIn;
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={copy.subline} />
      {notice !== null && (
        <Note live icon={AUTH_COPY.notices[notice].icon}>
          {AUTH_COPY.notices[notice].text}
        </Note>
      )}
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
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
            <Checkbox
              label={copy.keepSignedIn}
              checked={field.value}
              name={field.name}
              onChange={field.onChange}
              className={hitAreaClasses}
            />
          )}
        />
        {/* SPEC-DEVIATION: D-16 App. E.5 shows a toast; this is a link to the forgot-password screen. */}
        <UiLink to="/admin/forgot-password" className={clsx(loginLinkClasses, hitAreaClasses)}>
          {copy.forgot}
        </UiLink>
      </div>
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <Note icon="shield-check">{copy.staffNote}</Note>
      <UiLink to="/" className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}
