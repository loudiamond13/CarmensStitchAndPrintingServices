// S1 Sign in, /admin/login (App. E.5 with the owner's deviations; UI-SPEC "S1 Sign in"; plan 04-26).
//   - SignInForm is the presentational card (also used by the parity preview, plan 04-32); SignInRoute wires it to the
//     form state, the zod schema and the sign-in call.
//   - D-09: the email is never pre-filled or remembered (no default value, nothing written to any storage), while the
//     autocomplete values still let browsers and password managers fill both fields (A11Y-03).
//   - A correct sign-in keeps the typed email in memory only (the code step names it) and opens the code step with the
//     same return path.
//   - Every credential failure is one banner (D-02, CWE-204): any 401 reads "Email or password is incorrect.", whatever the
//     account's state, and focus moves to Password (OQ-1 default A). 429, network and 5xx failures show the shared
//     mapper banner and leave focus where it is. A one-shot notice (session ended, signed out, ...) shows once above the
//     form and goes at the next submit.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useRef, useState, type Ref, type SyntheticEvent } from 'react';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
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
import { isHttpError } from '@/core/api/errors';
import { useSubmission, type FieldErrors as ServerFieldErrors } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { signInSchema, type SignInValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { authService, type SignInResponse } from '@/modules/admin/services/authService';
import {
  setPendingEmail,
  setResendAvailableAt,
  takeSignInNotice,
  type SignInNotice,
} from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';

const VERIFY_PATH = '/admin/login/verify';

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

/** The sign-in fields in page order, for moving focus. */
const FIELD_ORDER = ['email', 'password'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

// SPEC-DEVIATION: D-02 spec §8.2 draws a "This account is deactivated." banner; it is not built. Every failure is this one.
const GENERIC_BANNER: SignInBanner = { title: AUTH_COPY.signIn.failed.title, message: AUTH_COPY.signIn.failed.body };

/** The server's field messages (keyed in its casing) for the fields this form has, first message each. */
function serverMessages(errors: ServerFieldErrors): Partial<Record<FieldName, string>> {
  const found: Partial<Record<FieldName, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const name = FIELD_ORDER.find((field) => field === key.toLowerCase());
    const message = messages[0];
    if (name !== undefined && message !== undefined) {
      found[name] = message;
    }
  }
  return found;
}

export function SignInRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const formRef = useRef<HTMLFormElement>(null);
  // Taken once: the session keeps it until a sign-in page reads it, then forgets it.
  const [notice, setNotice] = useState<SignInNotice | null>(takeSignInNotice);
  const [banner, setBanner] = useState<SignInBanner | null>(null);
  const { control, handleSubmit, setError } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', keepSignedIn: false },
  });
  const { submit, pending } = useSubmission<SignInValues, SignInResponse>(
    (_key, values) => authService.signIn(values),
    {
      onSuccess: (response, values) => {
        setPendingEmail(values.email);
        // The code step counts down from the wait the server named for the next code.
        setResendAvailableAt(Date.now() + Number(response.resendAfterSeconds) * 1000);
        const search = returnUrl === null ? '' : `?returnUrl=${encodeURIComponent(safeReturnUrl(returnUrl))}`;
        void navigate(`${VERIFY_PATH}${search}`);
      },
    },
  );
  useEffect(() => {
    document.title = `${AUTH_COPY.signIn.title}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const showFailure = (error: unknown): void => {
    // D-02: a 401 never says what was wrong or what state the account is in.
    if (isHttpError(error) && error.status === 401) {
      setBanner(GENERIC_BANNER);
      focusField('password');
      return;
    }
    const copy = describeHttpError(error);
    if (copy !== null) {
      setBanner({ title: copy.title, message: copy.body, error });
    }
    const messages = isHttpError(error) && error.status === 400 ? serverMessages(error.fieldErrors) : {};
    const first = FIELD_ORDER.find((name) => messages[name] !== undefined);
    for (const name of FIELD_ORDER) {
      const message = messages[name];
      if (message !== undefined) {
        setError(name, { type: 'server', message });
      }
    }
    if (first !== undefined) {
      focusField(first);
    }
  };

  const onValid = async (values: SignInValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      showFailure(outcome.error);
    }
  };

  const onInvalid = (errors: FieldErrors<SignInValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  return (
    <SignInForm
      formRef={formRef}
      control={control}
      pending={pending}
      notice={notice}
      banner={banner}
      onSubmit={(event) => {
        setNotice(null);
        setBanner(null);
        void handleSubmit(onValid, onInvalid)(event);
      }}
    />
  );
}
