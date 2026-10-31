// SPEC-GAP: S3 must-change (D-13, D-18, D-22), /admin/login/new-password (UI-SPEC "S3"; AUTH-09, AUTH-11, A11Y-03;
// plan 04-31).
//   - Reached from S2 only. The server sent "set a new password" instead of a session, so no session exists here: the only
//     thing held is the one-time ticket cookie.
//   - On every arrival, a reload included, the ticket is checked first. The check answers the email, both names and the
//     reason (breach, D-18, otherwise temporary), so the password rule runs in the browser (OR-3). Nothing is kept in a
//     URL or in storage. A 401 (ticket gone, or this page opened directly) sends the person back to S1 with the "timed
//     out" notice; any other failure offers the check again.
//   - A saved password issues the session: it is stored, a one-shot toast is left for the admin shell, and the person goes
//     to the validated return path or /admin.
//   - "Use a different account" drops what this tab holds for the pending sign-in and returns to S1.
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, LoadingRegion } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { NewPasswordValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { CheckingCard, NewPasswordForm } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { useSetPasswordForm } from '@/modules/admin/hooks/useSetPasswordForm';
import {
  passwordService,
  type SessionResponse,
  type SetNewPasswordContext,
} from '@/modules/admin/services/passwordService';
import { clearSession, completeSignIn, setSignedInToast, setSignInNotice } from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';

interface NewPasswordFormStateProps {
  context: SetNewPasswordContext;
}

/** The form state: the shared set-password form for this account, and the save. */
function NewPasswordFormState({ context }: NewPasswordFormStateProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const form = useSetPasswordForm(context);

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

  const showFailure = (error: unknown): void => {
    if (isHttpError(error) && error.status === 401) {
      // The ticket is gone (expired or used): start over.
      setSignInNotice('timed-out');
      void navigate(SIGN_IN_PATH);
      return;
    }
    if (!form.applyFieldErrors(error)) {
      form.showBanner(error);
    }
  };

  const onValid = async (values: NewPasswordValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      showFailure(outcome.error);
    }
  };

  return (
    <NewPasswordForm
      formRef={form.formRef}
      control={form.control}
      pending={pending}
      email={context.email}
      reason={context.reason === 'breach' ? 'breach' : 'temporary'}
      banner={form.banner}
      onBack={clearSession}
      onSubmit={form.submitHandler(onValid)}
    />
  );
}

type Phase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'form'; readonly context: SetNewPasswordContext }
  | { readonly kind: 'failed'; readonly error: unknown };

export function NewPasswordRoute() {
  const copy = AUTH_COPY.newPassword;
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  // Bumped by "Try Again" to run the check once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${copy.title}${ADMIN_COPY.titleSuffix}`;
  }, [copy.title]);

  useEffect(() => {
    const controller = new AbortController();
    passwordService.checkSetNewPassword(controller.signal).then(
      (context) => {
        setPhase({ kind: 'form', context });
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (isHttpError(error) && error.status === 401) {
          // No usable pending sign-in (expired, used, or this page was opened directly): start over.
          setSignInNotice('timed-out');
          void navigate(SIGN_IN_PATH);
          return;
        }
        setPhase({ kind: 'failed', error });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, navigate]);

  if (phase.kind === 'failed') {
    const failure = describeHttpError(phase.error);
    return (
      <div className={loginCardClasses}>
        <AuthHeader title={copy.title} subline={copy.checkFailed} />
        {failure !== null && (
          <ErrorState align="start" title={failure.title} message={failure.body} error={phase.error} />
        )}
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setPhase({ kind: 'checking' });
            setAttempt(attempt + 1);
          }}
        >
          {copy.retry}
        </Button>
        <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)} onClick={clearSession}>
          <Icon name="chevron-left" size={16} />
          {copy.back}
        </UiLink>
      </div>
    );
  }
  return (
    // The wrapper only carries the busy state and the status; it adds no box to the card layout.
    <LoadingRegion
      loading={phase.kind === 'checking'}
      things="sign-in"
      announce={{ loading: copy.checking, loaded: copy.checked }}
      className="contents"
    >
      {phase.kind === 'checking' ? (
        <CheckingCard title={copy.title} subline={copy.checking} />
      ) : (
        <NewPasswordFormState context={phase.context} />
      )}
    </LoadingRegion>
  );
}
