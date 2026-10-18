// SPEC-GAP: confirm email. P3 Confirm your email, /admin/confirm-email#token=... (UI-SPEC "P3"; PROF-02, C-17; plan 05-16).
//   - Same fragment handling as S5: the token is read once, removed from the address bar at once (history.replaceState)
//     and sent only in POST bodies (CWE-598, T-05-43).
//   - Opening the link changes nothing: the check is read-only, and only the Confirm New Email press applies the change, so
//     a mail scanner that opens the link does not confirm it (T-05-44).
//   - The page works signed in or not. The address is shown as text only (T-05-45).
//   - A check that never got an answer (network, 429, 5xx) is not "expired": the screen says so and offers the check again.
import clsx from 'clsx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, LoadingRegion } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { CheckingCard } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { removeFragment, tokenFromHash } from '@/modules/admin/pages/ResetPasswordPage';
import { PROFILE_COPY } from '@/modules/admin/profileCopy';
import { profileService } from '@/modules/admin/services/profileService';
import { describeHttpError } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';
/** The code of the 409 the server sends when another account took the new address first. */
const TAKEN_CODE = 'email-change.taken';

function isTaken(error: unknown): boolean {
  return isHttpError(error) && error.status === 409 && error.code === TAKEN_CODE;
}

function BackLink() {
  return (
    <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
      <Icon name="chevron-left" size={16} />
      {PROFILE_COPY.confirmEmail.back}
    </UiLink>
  );
}

interface ResultCardProps {
  title: string;
  subline: ReactNode;
  children: ReactNode;
}

/** An end state: its h1 takes focus when it shows. */
function ResultCard({ title, subline, children }: ResultCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className={loginCardClasses}>
      <AuthHeader title={title} subline={subline} headingRef={headingRef} />
      {children}
    </div>
  );
}

interface ReadyCardProps {
  token: string;
  newEmail: string;
  onDone: (newEmail: string) => void;
  onInvalid: () => void;
  onTaken: () => void;
}

/** The question: the one press that applies the change. */
function ReadyCard({ token, newEmail, onDone, onInvalid, onTaken }: ReadyCardProps) {
  const copy = PROFILE_COPY.confirmEmail;
  const [failure, setFailure] = useState<unknown>(null);
  const { submit, pending } = useSubmission<undefined, string>(
    async (key) => (await profileService.confirmEmailChange(token, key)).newEmail,
    {
      onSuccess: onDone,
    },
  );

  const confirm = async (): Promise<void> => {
    setFailure(null);
    const outcome = await submit();
    if (outcome.ok) {
      return;
    }
    if (isTaken(outcome.error)) {
      onTaken();
    } else if (isHttpError(outcome.error) && outcome.error.status === 404) {
      onInvalid();
    } else {
      setFailure(outcome.error);
    }
  };

  const described = failure === null ? null : describeHttpError(failure);
  return (
    <div className={loginCardClasses}>
      <AuthHeader
        title={copy.title}
        subline={
          <>
            {copy.ready.before}
            <strong>{newEmail}</strong>
            {copy.ready.after}
          </>
        }
      />
      {described !== null && (
        <ErrorState align="start" title={described.title} message={described.body} error={failure} />
      )}
      <Button
        variant="primary"
        size="lg"
        block
        icon="check"
        pending={pending}
        onClick={() => {
          void confirm();
        }}
      >
        {pending ? copy.confirming : copy.confirm}
      </Button>
      <BackLink />
    </div>
  );
}

type Phase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly newEmail: string }
  | { readonly kind: 'done'; readonly newEmail: string }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'taken'; readonly newEmail: string | null }
  | { readonly kind: 'failed'; readonly error: unknown };

export function ConfirmEmailRoute() {
  const copy = PROFILE_COPY.confirmEmail;
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
    profileService.checkEmailChange(token, controller.signal).then(
      (response) => {
        setPhase({ kind: 'ready', newEmail: response.newEmail });
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        // Only a link the server refuses is "expired"; a check that never got an answer is not.
        if (isTaken(error)) {
          setPhase({ kind: 'taken', newEmail: null });
        } else if (isHttpError(error) && error.status === 404) {
          setPhase({ kind: 'invalid' });
        } else {
          setPhase({ kind: 'failed', error });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [token, attempt]);

  if (token === null || phase.kind === 'invalid') {
    return (
      <ResultCard title={copy.invalid.title} subline={copy.invalid.body}>
        <BackLink />
      </ResultCard>
    );
  }
  if (phase.kind === 'taken') {
    return (
      <ResultCard
        title={copy.taken.title}
        subline={
          phase.newEmail === null ? (
            copy.taken.bodyNoAddress
          ) : (
            <>
              {copy.taken.body.before}
              <strong>{phase.newEmail}</strong>
              {copy.taken.body.after}
            </>
          )
        }
      >
        <BackLink />
      </ResultCard>
    );
  }
  if (phase.kind === 'done') {
    return (
      <ResultCard
        title={copy.done.title}
        subline={
          <>
            {copy.done.body.before}
            <strong>{phase.newEmail}</strong>
            {copy.done.body.after}
          </>
        }
      >
        <ButtonLink to={copy.done.path} variant="primary" size="lg" block>
          {copy.done.continue}
        </ButtonLink>
      </ResultCard>
    );
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
        <BackLink />
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
        <CheckingCard title={copy.title} subline={copy.checking} />
      ) : (
        <ReadyCard
          token={token}
          newEmail={phase.newEmail}
          onDone={(newEmail) => {
            setPhase({ kind: 'done', newEmail });
          }}
          onInvalid={() => {
            setPhase({ kind: 'invalid' });
          }}
          onTaken={() => {
            setPhase({ kind: 'taken', newEmail: phase.newEmail });
          }}
        />
      )}
    </LoadingRegion>
  );
}
