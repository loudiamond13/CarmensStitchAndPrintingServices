// S2 Check your email, /admin/login/verify (UI-SPEC "S2 Check your email"; D-01, AUTH-02, A11Y-03; plan 04-27).
//   - The card looks like S1 and has its own route, so a refresh keeps working: the pending sign-in lives in the ticket
//     cookie, not in the page. The typed email is only in session memory, so after a refresh the subline says "your email".
//   - The six boxes never submit by themselves (WCAG 3.2.2): `onComplete` is not used. Verify Code sends the code.
//   - A correct code either issues the session (back to the validated return path, or /admin) or, for an account that
//     must change its password, keeps the reason in memory and opens the new-password step.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useRef, useState, type Ref, type SyntheticEvent } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { OtpInput } from '@/components/entry';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, Note } from '@/components/states';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { verifySchema, type VerifyValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { authService, type ResendCodeResponse, type VerifyCodeResponse } from '@/modules/admin/services/authService';
import {
  completeSignIn,
  getPendingEmail,
  setPasswordChangeReason,
  setResendAvailableAt,
} from '@/modules/admin/services/session';
import { describeHttpError, type ErrorCopy } from '@/utils/describeHttpError';

const NEW_PASSWORD_PATH = '/admin/login/new-password';

export interface VerifyCodeFormProps {
  control: Control<VerifyValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The verify request is in flight (WEB-09). */
  pending: boolean;
  /** The address the code went to, or null after a refresh. */
  email: string | null;
  banner?: ErrorCopy | null;
  onResend: () => void;
  resendPending: boolean;
  formRef?: Ref<HTMLFormElement>;
}

export function VerifyCodeForm({
  control,
  onSubmit,
  pending,
  email,
  banner = null,
  onResend,
  resendPending,
  formRef,
}: VerifyCodeFormProps) {
  const copy = AUTH_COPY.verify;
  const subline =
    email === null ? (
      copy.sublineFallback
    ) : (
      <>
        {copy.subline.before}
        <strong>{email}</strong>
        {copy.subline.after}
      </>
    );
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={subline} />
      {banner !== null && <ErrorState align="start" title={banner.title} message={banner.body} />}
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <OtpInput
            label={copy.legend}
            hint={copy.hint}
            required
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message ?? ''}
          />
        )}
      />
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <Button variant="secondary" size="md" block pending={resendPending} onClick={onResend}>
        {copy.resend}
      </Button>
      <Note icon="shield-check">{copy.note}</Note>
      <UiLink to="/admin/login" className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

export function VerifyCodeRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const formRef = useRef<HTMLFormElement>(null);
  const [email] = useState(getPendingEmail);
  const [banner, setBanner] = useState<ErrorCopy | null>(null);
  const { control, handleSubmit, setValue } = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' },
  });

  const focusFirstBox = (): void => {
    formRef.current?.querySelector<HTMLInputElement>('fieldset input')?.focus();
  };

  const { submit, pending } = useSubmission<VerifyValues, VerifyCodeResponse>(
    (_key, values) => authService.verifyCode({ code: values.code }),
    {
      onSuccess: (response) => {
        const search = returnUrl === null ? '' : `?returnUrl=${encodeURIComponent(safeReturnUrl(returnUrl))}`;
        if (response.next === 'set-new-password') {
          setPasswordChangeReason(response.reason);
          void navigate(`${NEW_PASSWORD_PATH}${search}`);
        } else if (response.session !== null) {
          completeSignIn(response.session);
          void navigate(safeReturnUrl(returnUrl));
        }
      },
    },
  );
  const { submit: resend, pending: resendPending } = useSubmission<undefined, ResendCodeResponse>(
    () => authService.resendCode(),
    {
      onSuccess: (response) => {
        setResendAvailableAt(Date.now() + Number(response.resendAfterSeconds) * 1000);
      },
    },
  );

  useEffect(() => {
    document.title = `${AUTH_COPY.verify.title}${ADMIN_COPY.titleSuffix}`;
    focusFirstBox();
  }, []);

  const onValid = async (values: VerifyValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      const copy = describeHttpError(outcome.error);
      if (copy !== null) {
        setBanner(copy);
      }
      setValue('code', '');
      focusFirstBox();
    }
  };

  return (
    <VerifyCodeForm
      formRef={formRef}
      control={control}
      pending={pending}
      email={email}
      banner={banner}
      resendPending={resendPending}
      onResend={() => {
        void resend();
      }}
      onSubmit={(event) => {
        setBanner(null);
        void handleSubmit(onValid, focusFirstBox)(event);
      }}
    />
  );
}
