// SPEC-GAP: S4 Reset your password, /admin/forgot-password (UI-SPEC "S4 Reset your password"; AUTH-08, D-16, D-40; plan
// 04-28).
//   - Form state: one Email field and "Send Reset Link". The request carries one Idempotency-Key per submission, reused on
//     a retry of the same email (useSubmission).
//   - Sent state (the same route, the card swaps): shown whenever the server accepted the request, whatever the address, so
//     nothing says whether an account exists (CWE-204). Focus moves to its h1. "Use a Different Email" returns to the form
//     with the email cleared and the cursor in the field.
//   - 429, network and 5xx failures show the shared banner; a 400 on the email shows under the field.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { forgotSchema, type ForgotValues } from '@/modules/admin/authSchemas';
import { ForgotPasswordForm, ForgotPasswordSent, type AuthBanner } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { passwordService } from '@/modules/admin/services/passwordService';
import { describeHttpError } from '@/utils/describeHttpError';

export function ForgotPasswordRoute() {
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // True after "Use a Different Email", so the cursor goes to the emptied field when the form is back.
  const focusEmailRef = useRef(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [banner, setBanner] = useState<AuthBanner | null>(null);
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
