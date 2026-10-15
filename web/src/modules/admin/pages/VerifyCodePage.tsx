// S2 Check your email, /admin/login/verify (UI-SPEC "S2 Check your email"; D-01, D-10, AUTH-02 to AUTH-04, A11Y-03,
// OQ-6; plan 04-27).
//   - The card looks like S1 and has its own route, so a refresh keeps working: the pending sign-in lives in the ticket
//     cookie, not in the page. The typed email is only in session memory, so after a refresh the subline says "your email".
//   - The six boxes never submit by themselves (WCAG 3.2.2): `onComplete` is not used. Verify Code sends the code.
//   - A correct code either issues the session (back to the validated return path, or /admin) or, for an account that
//     must change its password, keeps the reason in memory and opens the new-password step.
//   - A code error (wrong, used up, expired) shows under the boxes in the server's words, clears the boxes and puts the
//     cursor in box 1. The lock and the resend cap are banners. A gone ticket (401) goes back to S1 with the "timed
//     out" notice.
//   - Resend counts down from the wait the server gave (kept in session memory, so a refresh starts with Resend
//     available). The button is aria-disabled, not disabled, and its label ticks in m:ss without being announced. One
//     polite status speaks only when a send starts the cooldown and when it ends (OQ-6). The hourly cap names no wait
//     (D-10).
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { verifySchema, type VerifyValues } from '@/modules/admin/authSchemas';
import { VerifyCodeForm } from '@/modules/admin/components/AuthCards';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { authService, type ResendCodeResponse, type VerifyCodeResponse } from '@/modules/admin/services/authService';
import {
  completeSignIn,
  getPendingEmail,
  getResendAvailableAt,
  setPasswordChangeReason,
  setResendAvailableAt,
  setSignInNotice,
} from '@/modules/admin/services/session';
import { describeHttpError, type ErrorCopy } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';
const NEW_PASSWORD_PATH = '/admin/login/new-password';
const TICK_MS = 1000;

/** The server's codes for the sign-in code step (AuthErrors). */
const CODE_LOCKOUT = 'auth.code-lockout';
const RESEND_CAP = 'auth.resend-cap';

/** The screen's own words for a code error, used only when the server sent no message on the code field. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  'auth.code-wrong': AUTH_COPY.verify.errors.wrong,
  'auth.code-used-up': AUTH_COPY.verify.errors.usedUp,
  'auth.code-expired': AUTH_COPY.verify.errors.expired,
};

const LOCKED_BANNER: ErrorCopy = AUTH_COPY.verify.errors.locked;
const CAP_BANNER: ErrorCopy = AUTH_COPY.verify.errors.resendCap;

/** Whole seconds left until `at`, never below 0. */
function secondsLeft(at: number | null, now: number): number {
  return at === null ? 0 : Math.max(0, Math.ceil((at - now) / 1000));
}

/** "1:00", "0:42". */
function formatCountdown(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VerifyCodeRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const formRef = useRef<HTMLFormElement>(null);
  const [email] = useState(getPendingEmail);
  const [banner, setBanner] = useState<ErrorCopy | null>(null);
  const [resent, setResent] = useState(false);
  // The cooldown: when the next code may be asked for, and the clock the countdown reads (ticked once a second).
  const [resendAt, setResendAt] = useState(getResendAvailableAt);
  const [now, setNow] = useState(Date.now);
  // True once a cooldown has run on this screen, so the end of it is announced (and a quiet start is not).
  const [cooled, setCooled] = useState(() => secondsLeft(getResendAvailableAt(), Date.now()) > 0);
  const [announce, setAnnounce] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const { control, handleSubmit, setError, setValue } = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' },
  });

  const remaining = secondsLeft(resendAt, now);
  const resendWaiting = remaining > 0 || capReached;
  let status = '';
  if (announce) {
    if (remaining > 0) {
      status = AUTH_COPY.verify.resendStarted;
    } else if (cooled) {
      status = AUTH_COPY.verify.resendReady;
    }
  }

  const focusFirstBox = (): void => {
    formRef.current?.querySelector<HTMLInputElement>('fieldset input')?.focus();
  };

  /** The pending sign-in is gone (expired or never there): back to S1 with the one-shot notice. */
  const returnToSignIn = (): void => {
    setSignInNotice('timed-out');
    void navigate(SIGN_IN_PATH);
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
        } else {
          // A signed-in answer without a session is the server's fault, not the person's.
          setBanner(describeHttpError(undefined));
        }
      },
    },
  );
  const { submit: resend, pending: resendPending } = useSubmission<undefined, ResendCodeResponse>(() =>
    authService.resendCode(),
  );

  useEffect(() => {
    document.title = `${AUTH_COPY.verify.title}${ADMIN_COPY.titleSuffix}`;
    focusFirstBox();
    // The status node is filled after the first paint, so its text is a change a screen reader can speak.
    const timer = setTimeout(() => {
      setAnnounce(true);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (resendAt === null || resendAt <= Date.now()) {
      return undefined;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= resendAt) {
        clearInterval(timer);
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [resendAt]);

  const showCodeError = (message: string): void => {
    setValue('code', '');
    setError('code', { type: 'server', message });
    focusFirstBox();
  };

  const showVerifyFailure = (error: unknown): void => {
    if (isHttpError(error)) {
      if (error.status === 401) {
        returnToSignIn();
        return;
      }
      if (error.status === 429 && error.code === CODE_LOCKOUT) {
        setBanner(LOCKED_BANNER);
        return;
      }
      if (error.status === 400) {
        const message = Object.entries(error.fieldErrors).find(([key]) => key.toLowerCase() === 'code')?.[1][0];
        const known = message ?? (error.code === undefined ? undefined : CODE_MESSAGES[error.code]);
        if (known !== undefined) {
          showCodeError(known);
          return;
        }
      }
    }
    setBanner(describeHttpError(error));
  };

  const onValid = async (values: VerifyValues): Promise<void> => {
    const outcome = await submit(values);
    if (!outcome.ok) {
      showVerifyFailure(outcome.error);
    }
  };

  const onResend = async (): Promise<void> => {
    if (resendWaiting) {
      return;
    }
    setBanner(null);
    setResent(false);
    const outcome = await resend();
    if (outcome.ok) {
      const current = Date.now();
      const at = current + Number(outcome.value.resendAfterSeconds) * 1000;
      setResendAvailableAt(at);
      setNow(current);
      setResendAt(at);
      setCooled(true);
      setResent(true);
      return;
    }
    const { error } = outcome;
    if (isHttpError(error) && error.status === 401) {
      returnToSignIn();
    } else if (isHttpError(error) && error.status === 429 && error.code === RESEND_CAP) {
      setCapReached(true);
      setBanner(CAP_BANNER);
    } else {
      setBanner(describeHttpError(error));
    }
  };

  return (
    <VerifyCodeForm
      formRef={formRef}
      control={control}
      pending={pending}
      email={email}
      banner={banner}
      resent={resent}
      resendLabel={remaining > 0 ? AUTH_COPY.verify.resendIn(formatCountdown(remaining)) : AUTH_COPY.verify.resend}
      resendWaiting={resendWaiting}
      resendPending={resendPending}
      onResend={() => {
        void onResend();
      }}
      status={status}
      onSubmit={(event) => {
        setBanner(null);
        setResent(false);
        void handleSubmit(onValid, focusFirstBox)(event);
      }}
    />
  );
}
