// SPEC-GAP: S5 Set a new password from the email link, /admin/reset-password#token=... (UI-SPEC "S5"; AUTH-08, AUTH-09,
// AUTH-11, D-17, D-19; plan 04-28).
//   - The token arrives in the URL fragment, so it is never sent as part of an address or a Referer. It is read once when
//     the page opens and removed from the address bar at once (history.replaceState), before any request (CWE-598,
//     T-04-98). From then on it lives in this component's memory and in the POST bodies only.
//   - Checking: a skeleton and one polite status ("Checking your link..." then "Link checked."). Then either the form, or
//     one invalid state for a missing, malformed, used, revoked or expired link (no detail, so nothing leaks).
//   - A check that could not be made at all (network, 429, 5xx) is not "expired": the screen says so and offers the check
//     again.
//   - Saving ends every session of the account on the server (D-19) and signs nobody in (D-17): this tab drops its own
//     session too, and S1 shows the "password changed" notice.
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, LoadingRegion } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { NewPasswordValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { CheckingCard, ResetInvalidCard, ResetPasswordForm } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSetPasswordForm } from '@/modules/admin/hooks/useSetPasswordForm';
import { passwordService } from '@/modules/admin/services/passwordService';
import { clearSession, setSignInNotice } from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';
import { removeFragment, tokenFromHash } from '@/utils/urlFragment';

const SIGN_IN_PATH = '/admin/login';

interface ResetFormProps {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  /** The link stopped working between the check and the save. */
  onLinkGone: () => void;
}

/** The form state: the shared set-password form for this account, and the save. */
function ResetForm({ token, email, firstName, lastName, onLinkGone }: ResetFormProps) {
  const navigate = useNavigate();
  const form = useSetPasswordForm({ email, firstName, lastName });
  const { submit, pending } = useSubmission<NewPasswordValues, undefined>(
    async (key, values) => {
      await passwordService.resetPassword({ token, newPassword: values.newPassword }, { idempotencyKey: key });
      return undefined;
    },
    {
      onSuccess: () => {
        // D-19: every session of the account ended on the server; this tab must not keep a stale one.
        clearSession();
        setSignInNotice('password-changed');
        void navigate(SIGN_IN_PATH);
      },
    },
  );

  const showFailure = (error: unknown): void => {
    if (isHttpError(error)) {
      if (error.status === 404) {
        onLinkGone();
        return;
      }
      if (error.status === 400 && Object.keys(error.fieldErrors).some((key) => key.toLowerCase() === 'token')) {
        onLinkGone();
        return;
      }
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
    <ResetPasswordForm
      formRef={form.formRef}
      control={form.control}
      pending={pending}
      email={email}
      banner={form.banner}
      onSubmit={form.submitHandler(onValid)}
    />
  );
}

type Phase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'form'; readonly email: string; readonly firstName: string; readonly lastName: string }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'failed'; readonly error: unknown };

export function ResetPasswordRoute() {
  const copy = AUTH_COPY.reset;
  // A pure read, so a repeated render (StrictMode) finds the same token; the address bar is cleaned in the effect below.
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [phase, setPhase] = useState<Phase>(token === null ? { kind: 'invalid' } : { kind: 'checking' });
  // Bumped by "Try Again" to run the check once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${copy.title}${ADMIN_COPY.titleSuffix}`;
    removeFragment();
  }, [copy.title]);

  useEffect(() => {
    if (token === null) {
      return undefined;
    }
    const controller = new AbortController();
    passwordService.checkResetLink({ token }, controller.signal).then(
      (response) => {
        setPhase({ kind: 'form', email: response.email, firstName: response.firstName, lastName: response.lastName });
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        // Only a link the server refuses is "expired"; a check that never got an answer is not.
        setPhase(
          isHttpError(error) && (error.status === 404 || error.status === 400)
            ? { kind: 'invalid' }
            : { kind: 'failed', error },
        );
      },
    );
    return () => {
      controller.abort();
    };
  }, [token, attempt]);

  if (token === null || phase.kind === 'invalid') {
    return <ResetInvalidCard />;
  }
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
        <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
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
      things="link"
      announce={{ loading: copy.checking, loaded: copy.checked }}
      className="contents"
    >
      {phase.kind === 'checking' ? (
        <CheckingCard title={copy.title} />
      ) : (
        <ResetForm
          token={token}
          email={phase.email}
          firstName={phase.firstName}
          lastName={phase.lastName}
          onLinkGone={() => {
            setPhase({ kind: 'invalid' });
          }}
        />
      )}
    </LoadingRegion>
  );
}
