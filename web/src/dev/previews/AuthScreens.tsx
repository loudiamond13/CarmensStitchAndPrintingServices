// Dev-only scenario wrapper (plan 04-32; never shipped, D-20): the sign-in cards of S1 to S6 in the states the owner
// reviews, drawn with the real cards (web/src/modules/admin/components) and fixed values, with no requests. They are
// SPEC-GAP surfaces, so there is no reference side (parity: false); the parity suite runs axe and the CSP listener on
// them, and the Component Showcase and the owner review show them. A card is the card look at its own width; the brand
// panel is the same on every screen and is proven with S1 (layouts-auth). Several cards share one page, so each title is
// an h2 here (AuthHeadingLevelContext).
import { useForm } from 'react-hook-form';
import { LoadingRegion } from '@/components/states';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { ForgotValues, NewPasswordValues, SignInValues, VerifyValues } from '@/modules/admin/authSchemas';
import {
  CheckingCard,
  ForgotPasswordForm,
  ForgotPasswordSent,
  InviteFormCard,
  InviteInvalidCard,
  NewPasswordForm,
  ResetInvalidCard,
  ResetPasswordForm,
  VerifyCodeForm,
  type AuthBanner,
} from '@/modules/admin/components/AuthCards';
import { AuthHeadingLevelContext } from '@/modules/admin/components/authHeadingLevel';
import { SignInForm } from '@/modules/admin/components/SignInForm';
import { describeHttpError } from '@/utils/describeHttpError';
import { serverError } from './serverError';

export type AuthCardName =
  | 'signin-notice'
  | 'signin-banner'
  | 'verify'
  | 'verify-error'
  | 'verify-waiting'
  | 'verify-cap'
  | 'new-password-temporary'
  | 'new-password-breach'
  | 'forgot-form'
  | 'forgot-sent'
  | 'reset-checking'
  | 'reset-form'
  | 'reset-invalid'
  | 'invite-checking'
  | 'invite-form'
  | 'invite-invalid'
  | 'invite-fail-closed';

export interface AuthCardProps {
  card: AuthCardName;
  /** The address the card names (the App. E.5 e-mail by default); the long-text cases pass 64 characters. */
  email?: string;
  /** Makes the card's banner a 500 with this reference. */
  traceId?: string;
}

const DEFAULT_EMAIL = 'paolo.garcia@gmail.com';
const DEFAULT_TRACE_ID = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';
/** A password that shows the strength meter and the rule hint without an error. */
const SAMPLE_PASSWORD = 'Sampaguita#2026';

function noop(): undefined {
  return undefined;
}

/** The banner of a 500 with a reference, in the shared mapper's words. */
function failureBanner(traceId: string): AuthBanner {
  const error = serverError(traceId);
  const copy = describeHttpError(error);
  return { title: copy?.title ?? '', message: copy?.body ?? '', error };
}

function SignInCard({ card, traceId }: { card: 'signin-notice' | 'signin-banner'; traceId: string }) {
  const { control } = useForm<SignInValues>({ defaultValues: { email: '', password: '', keepSignedIn: false } });
  return (
    <SignInForm
      control={control}
      onSubmit={noop}
      pending={false}
      notice={card === 'signin-notice' ? 'session-ended' : null}
      banner={card === 'signin-banner' ? failureBanner(traceId) : null}
    />
  );
}

function VerifyCard({
  card,
  email,
}: {
  card: 'verify' | 'verify-error' | 'verify-waiting' | 'verify-cap';
  email: string;
}) {
  const copy = AUTH_COPY.verify;
  const { control } = useForm<VerifyValues>({
    defaultValues: { code: card === 'verify-error' ? '482' : '' },
    errors: card === 'verify-error' ? { code: { type: 'server', message: copy.errors.wrong } } : {},
  });
  const waiting = card === 'verify-waiting';
  return (
    <VerifyCodeForm
      control={control}
      onSubmit={noop}
      pending={false}
      email={email}
      banner={card === 'verify-cap' ? copy.errors.resendCap : null}
      resent={waiting}
      resendLabel={waiting ? copy.resendIn('0:42') : copy.resend}
      resendWaiting={waiting || card === 'verify-cap'}
      resendPending={false}
      onResend={noop}
      status=""
    />
  );
}

function NewPasswordCard({ reason }: { reason: 'breach' | 'temporary' }) {
  const { control } = useForm<NewPasswordValues>({
    defaultValues: { newPassword: SAMPLE_PASSWORD, confirmPassword: '' },
  });
  return (
    <NewPasswordForm
      control={control}
      onSubmit={noop}
      pending={false}
      email={DEFAULT_EMAIL}
      reason={reason}
      onBack={noop}
    />
  );
}

function ForgotCard({ sent, email }: { sent: boolean; email: string }) {
  const { control } = useForm<ForgotValues>({ defaultValues: { email: '' } });
  return sent ? (
    <ForgotPasswordSent email={email} onAnother={noop} />
  ) : (
    <ForgotPasswordForm control={control} onSubmit={noop} pending={false} />
  );
}

function ResetCard({ email }: { email: string }) {
  const { control } = useForm<NewPasswordValues>({
    defaultValues: { newPassword: SAMPLE_PASSWORD, confirmPassword: '' },
  });
  return <ResetPasswordForm control={control} onSubmit={noop} pending={false} email={email} />;
}

function InviteCard({ email, banner }: { email: string; banner: AuthBanner | null }) {
  const { control } = useForm<NewPasswordValues>({
    defaultValues: { newPassword: SAMPLE_PASSWORD, confirmPassword: SAMPLE_PASSWORD },
  });
  return <InviteFormCard control={control} onSubmit={noop} pending={false} email={email} banner={banner} />;
}

/** The card behind a checking state, announced like the route does ("Checking your link…"). */
function Checking({ title, things }: { title: string; things: string }) {
  return (
    <LoadingRegion
      loading
      things={things}
      announce={{ loading: AUTH_COPY.reset.checking, loaded: AUTH_COPY.reset.checked }}
      className="contents"
    >
      <CheckingCard title={title} />
    </LoadingRegion>
  );
}

function Card({ card, email, traceId }: Required<AuthCardProps>) {
  switch (card) {
    case 'signin-notice':
    case 'signin-banner':
      return <SignInCard card={card} traceId={traceId} />;
    case 'verify':
    case 'verify-error':
    case 'verify-waiting':
    case 'verify-cap':
      return <VerifyCard card={card} email={email} />;
    case 'new-password-temporary':
      return <NewPasswordCard reason="temporary" />;
    case 'new-password-breach':
      return <NewPasswordCard reason="breach" />;
    case 'forgot-form':
      return <ForgotCard sent={false} email={email} />;
    case 'forgot-sent':
      return <ForgotCard sent email={email} />;
    case 'reset-checking':
      return <Checking title={AUTH_COPY.reset.title} things="link" />;
    case 'reset-form':
      return <ResetCard email={email} />;
    case 'reset-invalid':
      return <ResetInvalidCard focusHeading={false} />;
    case 'invite-checking':
      return <Checking title={AUTH_COPY.invite.title} things="invite" />;
    case 'invite-form':
      return <InviteCard email={email} banner={null} />;
    case 'invite-invalid':
      return <InviteInvalidCard focusHeading={false} />;
    case 'invite-fail-closed': {
      const down = AUTH_COPY.newPassword.errors.breachCheckDown;
      return <InviteCard email={email} banner={{ title: down.title, message: down.body }} />;
    }
  }
}

export function AuthCard({ card, email = DEFAULT_EMAIL, traceId = DEFAULT_TRACE_ID }: AuthCardProps) {
  return (
    <AuthHeadingLevelContext.Provider value="h2">
      <Card card={card} email={email} traceId={traceId} />
    </AuthHeadingLevelContext.Provider>
  );
}
