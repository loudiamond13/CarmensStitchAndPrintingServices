// SPEC-GAP: S6 invite acceptance (D-29), /admin/accept-invite#token=... (UI-SPEC "S6"; AUTH-12, AUTH-11, A11Y-03; plan 04-31).
//   - Same fragment handling as S5: the token is read once, removed from the address bar at once and sent only in POST
//     bodies (CWE-598, T-04-104).
//   - Checking: a skeleton and one polite status. Then the form, or one invalid state for any bad, used or expired invite,
//     with only the back link (a Manager or the CLI re-sends an invite, so there is no self-service button).
//   - A check that never got an answer (network, 429, 5xx) is not "expired": the screen says so and offers the check again.
//   - Saving signs nobody in (D-29): S1 shows the "password is set" notice and the person signs in with the emailed code.
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
import { CheckingCard, InviteFormCard, InviteInvalidCard } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSetPasswordForm } from '@/modules/admin/hooks/useSetPasswordForm';
import { inviteService, type InviteLinkResponse } from '@/modules/admin/services/inviteService';
import { setSignInNotice } from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';
import { removeFragment, tokenFromHash } from '@/utils/urlFragment';

const SIGN_IN_PATH = '/admin/login';
/** The code of the 422 the server sends when the breach list cannot be reached: the invite is not accepted (D-14). */
const BREACH_CHECK_UNAVAILABLE = 'auth.breach-check-unavailable';

interface InviteFormProps {
  token: string;
  invite: InviteLinkResponse;
  /** The invite stopped working between the check and the save. */
  onInviteGone: () => void;
}

/** The form state: the shared set-password form for this account, and the save. */
function InviteForm({ token, invite, onInviteGone }: InviteFormProps) {
  const navigate = useNavigate();
  const form = useSetPasswordForm(invite);
  const { submit, pending } = useSubmission<NewPasswordValues, undefined>(
    async (key, values) => {
      await inviteService.accept({ token, newPassword: values.newPassword }, { idempotencyKey: key });
      return undefined;
    },
    {
      onSuccess: () => {
        setSignInNotice('password-set');
        void navigate(SIGN_IN_PATH);
      },
    },
  );

  const showFailure = (error: unknown): void => {
    if (isHttpError(error)) {
      if (error.status === 404) {
        onInviteGone();
        return;
      }
      if (error.status === 422 && error.code === BREACH_CHECK_UNAVAILABLE) {
        // D-14: fail closed. Nothing was saved and the invite still works; the typed values stay and the next try is new.
        const down = AUTH_COPY.newPassword.errors.breachCheckDown;
        form.setBanner({ title: down.title, message: down.body, error });
        form.formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
        return;
      }
      if (error.status === 400 && Object.keys(error.fieldErrors).some((key) => key.toLowerCase() === 'token')) {
        onInviteGone();
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
    <InviteFormCard
      formRef={form.formRef}
      control={form.control}
      pending={pending}
      email={invite.email}
      banner={form.banner}
      onSubmit={form.submitHandler(onValid)}
    />
  );
}

type Phase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'form'; readonly invite: InviteLinkResponse }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'failed'; readonly error: unknown };

export function AcceptInviteRoute() {
  const copy = AUTH_COPY.invite;
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
    inviteService.check({ token }, controller.signal).then(
      (invite) => {
        setPhase({ kind: 'form', invite });
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        // Only an invite the server refuses is "expired"; a check that never got an answer is not.
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
    return <InviteInvalidCard />;
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
      things="invite"
      announce={{ loading: AUTH_COPY.reset.checking, loaded: AUTH_COPY.reset.checked }}
      className="contents"
    >
      {phase.kind === 'checking' ? (
        <CheckingCard title={copy.title} />
      ) : (
        <InviteForm
          token={token}
          invite={phase.invite}
          onInviteGone={() => {
            setPhase({ kind: 'invalid' });
          }}
        />
      )}
    </LoadingRegion>
  );
}
