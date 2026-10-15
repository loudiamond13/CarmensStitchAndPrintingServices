// SPEC-GAP: S6 invite acceptance (D-29), /admin/accept-invite#token=... (UI-SPEC "S6"; AUTH-12, AUTH-11, A11Y-03; plan 04-31).
//   - Same fragment handling as S5: the token is read once, removed from the address bar at once and sent only in POST
//     bodies (CWE-598, T-04-104).
//   - Checking: a skeleton and one polite status. Then the form, or one invalid state for any bad, used or expired invite,
//     with only the back link (a Manager or the CLI re-sends an invite, so there is no self-service button).
//   - A check that never got an answer (network, 429, 5xx) is not "expired": the screen says so and offers the check again.
//   - Saving signs nobody in (D-29): S1 shows the "password is set" notice and the person signs in with the emailed code.
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { loginBackClasses, loginCardClasses } from '@/components/layout/layout.recipe';
import { ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { newPasswordSchema, type NewPasswordValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { NewPasswordFields } from '@/modules/admin/components/NewPasswordFields';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { removeFragment, tokenFromHash, type ResetBanner } from '@/modules/admin/pages/ResetPasswordPage';
import { inviteService, type InviteLinkResponse } from '@/modules/admin/services/inviteService';
import { setSignInNotice } from '@/modules/admin/services/session';
import { describeHttpError } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';
const FIELD_ORDER = ['newPassword', 'confirmPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

interface InviteFormProps {
  token: string;
  invite: InviteLinkResponse;
  /** The invite stopped working between the check and the save. */
  onInviteGone: () => void;
}

/** The form state: owns the form, the schema for this account and the save. */
function InviteForm({ token, invite, onInviteGone }: InviteFormProps) {
  const copy = AUTH_COPY.invite;
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [banner, setBanner] = useState<ResetBanner | null>(null);
  // D-15: the checked invite names the account, so the password can be kept free of its email and first name.
  const schema = useMemo(
    () => newPasswordSchema({ email: invite.email, firstName: invite.firstName, lastName: null }),
    [invite.email, invite.firstName],
  );
  const { control, handleSubmit, setError } = useForm<NewPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
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

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  useEffect(() => {
    focusField('newPassword');
  }, []);

  const showFailure = (error: unknown): void => {
    if (isHttpError(error)) {
      if (error.status === 404) {
        onInviteGone();
        return;
      }
      if (error.status === 400) {
        const entries = Object.entries(error.fieldErrors);
        if (entries.some(([key]) => key.toLowerCase() === 'token')) {
          onInviteGone();
          return;
        }
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
    <form
      ref={formRef}
      aria-label={copy.title}
      noValidate
      className={loginCardClasses}
      onSubmit={(event) => {
        setBanner(null);
        void handleSubmit(onValid, onInvalid)(event);
      }}
    >
      <AuthHeader
        title={copy.title}
        subline={
          <>
            {copy.subline.before}
            <strong>{invite.email}</strong>
            {copy.subline.after}
          </>
        }
      />
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <NewPasswordFields control={control} email={invite.email} />
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? AUTH_COPY.newPassword.pending : AUTH_COPY.newPassword.cta}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

/** The one state for every invite that does not work. Focus moves to its h1. */
function InvalidInvite() {
  const copy = AUTH_COPY.invite;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className={loginCardClasses}>
      <AuthHeader title={copy.invalidTitle} subline={copy.invalidBody} headingRef={headingRef} />
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </div>
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
    return <InvalidInvite />;
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
        <div className={loginCardClasses}>
          <AuthHeader title={copy.title} subline={AUTH_COPY.reset.checking} />
          <SkeletonText />
        </div>
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
