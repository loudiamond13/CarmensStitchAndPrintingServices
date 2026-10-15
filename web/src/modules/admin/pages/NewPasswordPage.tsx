// SPEC-GAP: S3 must-change (D-13, D-18, D-22), /admin/login/new-password (UI-SPEC "S3"; AUTH-09, AUTH-11, A11Y-03;
// plan 04-31).
//   - Reached from S2 only. The server sent "set a new password" instead of a session, so no session exists here: the only
//     thing held is the one-time ticket cookie, and the first save fails with a 401 when it is gone or this page was opened
//     directly. That sends the person back to S1 with the "timed out" notice.
//   - The subline follows the reason S2 kept in memory: breach (D-18), otherwise temporary (also the answer when the page
//     was reloaded and the reason is gone).
//   - A saved password issues the session: it is stored, a one-shot toast is left for the admin shell, and the person goes
//     to the validated return path or /admin.
//   - "Use a different account" drops what this tab holds for the pending sign-in and returns to S1.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { newPasswordSchema, type NewPasswordValues } from '@/modules/admin/authSchemas';
import { NewPasswordForm, type AuthBanner } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { passwordService, type SessionResponse } from '@/modules/admin/services/passwordService';
import {
  clearSession,
  completeSignIn,
  getPasswordChangeReason,
  getPendingEmail,
  setSignedInToast,
  setSignInNotice,
} from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';
const FIELD_ORDER = ['newPassword', 'confirmPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export function NewPasswordRoute() {
  const copy = AUTH_COPY.newPassword;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const formRef = useRef<HTMLFormElement>(null);
  // Read once: the pending sign-in's email (for the hidden username input) and why the change is needed.
  const [email] = useState(getPendingEmail);
  const [reason] = useState(getPasswordChangeReason);
  const [banner, setBanner] = useState<AuthBanner | null>(null);
  // D-15: the pending email, when known, is kept out of the password; the server also checks the names.
  const schema = useMemo(() => newPasswordSchema({ email: email ?? '', firstName: null, lastName: null }), [email]);
  const { control, handleSubmit, setError } = useForm<NewPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const { submit, pending } = useSubmission<NewPasswordValues, SessionResponse>(
    (_key, values) => passwordService.setNewPassword({ newPassword: values.newPassword }),
    {
      onSuccess: (response) => {
        completeSignIn(response);
        setSignedInToast('password-saved');
        void navigate(safeReturnUrl(returnUrl));
      },
    },
  );

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  useEffect(() => {
    document.title = `${copy.title}${ADMIN_COPY.titleSuffix}`;
    focusField('newPassword');
  }, [copy.title]);

  const showFailure = (error: unknown): void => {
    if (isHttpError(error)) {
      if (error.status === 401) {
        // The ticket is gone (expired, used, or this page was opened directly): start over.
        setSignInNotice('timed-out');
        void navigate(SIGN_IN_PATH);
        return;
      }
      if (error.status === 400) {
        const entries = Object.entries(error.fieldErrors);
        // The server's words win over the screen's own.
        for (const name of FIELD_ORDER) {
          const message = entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1][0];
          if (message !== undefined) {
            setError(name, { type: 'server', message });
            focusField(name);
            return;
          }
        }
      }
    }
    const described = describeHttpError(error);
    if (described !== null) {
      setBanner({ title: described.title, message: described.body, error });
    }
  };

  const onValid = async (values: NewPasswordValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      showFailure(outcome.error);
    }
  };

  const onInvalid = (errors: FieldErrors<NewPasswordValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  return (
    <NewPasswordForm
      formRef={formRef}
      control={control}
      pending={pending}
      email={email}
      reason={reason === 'breach' ? 'breach' : 'temporary'}
      banner={banner}
      onBack={clearSession}
      onSubmit={(event) => {
        setBanner(null);
        void handleSubmit(onValid, onInvalid)(event);
      }}
    />
  );
}
