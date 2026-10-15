// SPEC-GAP: S4 Reset your password, /admin/forgot-password (UI-SPEC "S4 Reset your password"; AUTH-08, D-16, D-40; plan
// 04-28).
//   - Form state: one Email field and "Send Reset Link". The request carries one Idempotency-Key per submission, reused on
//     a retry of the same email (useSubmission).
//   - Sent state (the same route, the card swaps): shown whenever the server accepted the request, whatever the address, so
//     nothing says whether an account exists (CWE-204). Focus moves to its h1. "Use a Different Email" returns to the form
//     with the email cleared and the cursor in the field.
//   - 429, network and 5xx failures show the shared banner; a 400 on the email shows under the field.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useRef, useState, type Ref, type SyntheticEvent } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Field } from '@/components/forms';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, Note } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { forgotSchema, type ForgotValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { passwordService } from '@/modules/admin/services/passwordService';
import { describeHttpError } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';

/** The banner above the field: the words, and the failure when its reference should show. */
export interface ForgotBanner {
  readonly title: string;
  readonly message: string;
  readonly error?: unknown;
}

export interface ForgotPasswordFormProps {
  control: Control<ForgotValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The request is in flight (WEB-09). */
  pending: boolean;
  banner?: ForgotBanner | null;
  formRef?: Ref<HTMLFormElement>;
}

export function ForgotPasswordForm({ control, onSubmit, pending, banner = null, formRef }: ForgotPasswordFormProps) {
  const copy = AUTH_COPY.forgot;
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={copy.subline} />
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={AUTH_COPY.signIn.email}
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
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

export interface ForgotPasswordSentProps {
  /** The address the person typed. */
  email: string;
  onAnother: () => void;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}

export function ForgotPasswordSent({ email, onAnother, headingRef }: ForgotPasswordSentProps) {
  const copy = AUTH_COPY.forgot;
  return (
    <div className={loginCardClasses}>
      <AuthHeader
        title={copy.sentTitle}
        headingRef={headingRef}
        subline={
          <>
            {copy.sent.before}
            <strong>{email}</strong>
            {copy.sent.after}
          </>
        }
      />
      <Note icon="info">{copy.sentNote}</Note>
      <Button variant="secondary" size="md" block onClick={onAnother}>
        {copy.another}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </div>
  );
}

export function ForgotPasswordRoute() {
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // True after "Use a Different Email", so the cursor goes to the emptied field when the form is back.
  const focusEmailRef = useRef(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [banner, setBanner] = useState<ForgotBanner | null>(null);
  const { control, handleSubmit, setError, reset } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const {
    submit,
    pending,
    reset: resetSubmission,
  } = useSubmission<ForgotValues, undefined>(
    async (key, values) => {
      await passwordService.forgot({ email: values.email }, { idempotencyKey: key });
      return undefined;
    },
    {
      onSuccess: (_result, values) => {
        setSentTo(values.email);
      },
    },
  );

  useEffect(() => {
    document.title = `${sentTo === null ? AUTH_COPY.forgot.title : AUTH_COPY.forgot.sentTitle}${ADMIN_COPY.titleSuffix}`;
    if (sentTo !== null) {
      headingRef.current?.focus();
    } else if (focusEmailRef.current) {
      focusEmailRef.current = false;
      formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
    }
  }, [sentTo]);

  const focusEmail = (): void => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  };

  const showFailure = (error: unknown): void => {
    if (isHttpError(error) && error.status === 400) {
      const message = Object.entries(error.fieldErrors).find(([key]) => key.toLowerCase() === 'email')?.[1][0];
      if (message !== undefined) {
        setError('email', { type: 'server', message });
        focusEmail();
        return;
      }
    }
    const copy = describeHttpError(error);
    if (copy !== null) {
      setBanner({ title: copy.title, message: copy.body, error });
    }
  };

  const onValid = async (values: ForgotValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      showFailure(outcome.error);
    }
  };

  if (sentTo !== null) {
    return (
      <ForgotPasswordSent
        email={sentTo}
        headingRef={headingRef}
        onAnother={() => {
          // A new submission with a new key, and an empty form.
          resetSubmission();
          reset({ email: '' });
          focusEmailRef.current = true;
          setSentTo(null);
        }}
      />
    );
  }
  return (
    <ForgotPasswordForm
      formRef={formRef}
      control={control}
      pending={pending}
      banner={banner}
      onSubmit={(event) => {
        setBanner(null);
        void handleSubmit(onValid, focusEmail)(event);
      }}
    />
  );
}
