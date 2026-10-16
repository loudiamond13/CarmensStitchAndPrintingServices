// The sign-in screens' cards (S2 to S6; plan 04-27, 04-28 and 04-31, collected here by plan 04-32). Each card is the
// presentational part of its screen: the route owns the form state, the schema and the requests, and the parity previews
// (web/src/dev/previews/AuthScreens.tsx) draw the same cards with fixed values. This file imports no schema or service,
// so the look-equality page does not pull the form libraries' route chunk into its bundle.
import clsx from 'clsx';
import { useEffect, useRef, type Ref, type SyntheticEvent } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Button, ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { OtpInput } from '@/components/entry';
import { Field } from '@/components/forms';
import { loginBackClasses, loginCardClasses, srOnlyClasses } from '@/components/layout/layout.recipe';
import { ErrorState, Note, SkeletonText } from '@/components/states';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { ForgotValues, NewPasswordValues, VerifyValues } from '@/modules/admin/authSchemas';
import { AuthHeader } from '@/modules/admin/components/AuthHeader';
import { NewPasswordFields } from '@/modules/admin/components/NewPasswordFields';
import type { ErrorCopy } from '@/utils/describeHttpError';

const SIGN_IN_PATH = '/admin/login';
const FORGOT_PATH = '/admin/forgot-password';

/** The banner above the fields: the words, and the failure when its reference should show. */
export interface AuthBanner {
  readonly title: string;
  readonly message: string;
  readonly error?: unknown;
}

// ── S2 Check your email ──

export interface VerifyCodeFormProps {
  control: Control<VerifyValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The verify request is in flight (WEB-09). */
  pending: boolean;
  /** The address the code went to, or null after a refresh. */
  email: string | null;
  banner?: ErrorCopy | null;
  /** Shows the "new code sent" note (a resend just worked). */
  resent?: boolean;
  /** The Resend button: its label and whether it is waiting (aria-disabled). */
  resendLabel: string;
  resendWaiting: boolean;
  resendPending: boolean;
  onResend: () => void;
  /** The text of the one polite status ('' says nothing). */
  status: string;
  formRef?: Ref<HTMLFormElement>;
}

export function VerifyCodeForm({
  control,
  onSubmit,
  pending,
  email,
  banner = null,
  resent = false,
  resendLabel,
  resendWaiting,
  resendPending,
  onResend,
  status,
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
      {resent && <Note icon="circle-check">{copy.resent}</Note>}
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
      <Button
        variant="secondary"
        size="md"
        block
        aria-disabled={resendWaiting}
        pending={resendPending}
        onClick={onResend}
      >
        {resendLabel}
      </Button>
      {/* The only live region of the screen (OQ-6): it changes only when a cooldown starts and when it ends. */}
      <p role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </p>
      <Note icon="shield-check">{copy.note}</Note>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

// ── S4 Reset your password ──

export interface ForgotPasswordFormProps {
  control: Control<ForgotValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The request is in flight (WEB-09). */
  pending: boolean;
  banner?: AuthBanner | null;
  formRef?: Ref<HTMLFormElement>;
}

export function ForgotPasswordForm({ control, onSubmit, pending, banner = null, formRef }: ForgotPasswordFormProps) {
  const copy = AUTH_COPY.forgot;
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={copy.subline} />
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={AUTH_COPY.signIn.email}
            type="email"
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
          />
        )}
      />
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}

export interface ForgotPasswordSentProps {
  /** The address the person typed. */
  email: string;
  onAnother: () => void;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}

export function ForgotPasswordSent({ email, onAnother, headingRef }: ForgotPasswordSentProps) {
  const copy = AUTH_COPY.forgot;
  return (
    <div className={loginCardClasses}>
      <AuthHeader
        title={copy.sentTitle}
        headingRef={headingRef}
        subline={
          <>
            {copy.sent.before}
            <strong>{email}</strong>
            {copy.sent.after}
          </>
        }
      />
      <Note icon="info">{copy.sentNote}</Note>
      <Button variant="secondary" size="md" block onClick={onAnother}>
        {copy.another}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </div>
  );
}

// ── S5 Set a new password from the email link ──

export interface ResetPasswordFormProps {
  control: Control<NewPasswordValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The save is in flight (WEB-09). */
  pending: boolean;
  /** The account the link is for, named in the subline and in the hidden username input. */
  email: string | null;
  banner?: AuthBanner | null | undefined;
  formRef?: Ref<HTMLFormElement>;
}

export function ResetPasswordForm({
  control,
  onSubmit,
  pending,
  email,
  banner = null,
  formRef,
}: ResetPasswordFormProps) {
  const copy = AUTH_COPY.reset;
  const subline =
    email === null ? (
      AUTH_COPY.newPassword.sublineTemporary
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
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <NewPasswordFields control={control} email={email} />
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

export interface InvalidCardProps {
  /** Moves focus to the h1 when the card shows (the screens do; a page of previews must not take focus). Default true. */
  focusHeading?: boolean;
}

/** The one state for every link that does not work. Focus moves to its h1. */
export function ResetInvalidCard({ focusHeading = true }: InvalidCardProps) {
  const copy = AUTH_COPY.reset;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) {
      headingRef.current?.focus();
    }
  }, [focusHeading]);
  return (
    <div className={loginCardClasses}>
      <AuthHeader title={copy.invalidTitle} subline={copy.invalidBody} headingRef={headingRef} />
      <ButtonLink to={FORGOT_PATH} variant="primary" size="lg" block>
        {copy.request}
      </ButtonLink>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </div>
  );
}

// ── S6 Set your password from an invite ──

/** The one state for every invite that does not work. Focus moves to its h1. */
export function InviteInvalidCard({ focusHeading = true }: InvalidCardProps) {
  const copy = AUTH_COPY.invite;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) {
      headingRef.current?.focus();
    }
  }, [focusHeading]);
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

/** S3, S5 and S6 while the sign-in, link or invite is being checked: the header and a skeleton (the route wraps it in a LoadingRegion). */
export interface CheckingCardProps {
  /** The screen's title: "Set a new password" (S5) or "Set your password" (S6). */
  title: string;
  /** What is being checked; defaults to the emailed link. */
  subline?: string;
}

export function CheckingCard({ title, subline = AUTH_COPY.reset.checking }: CheckingCardProps) {
  return (
    <div className={loginCardClasses}>
      <AuthHeader title={title} subline={subline} />
      <SkeletonText />
    </div>
  );
}

export interface InviteFormCardProps {
  control: Control<NewPasswordValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The save is in flight (WEB-09). */
  pending: boolean;
  /** The account the invite is for, named in the subline and in the hidden username input. */
  email: string;
  banner?: AuthBanner | null | undefined;
  formRef?: Ref<HTMLFormElement>;
}

export function InviteFormCard({ control, onSubmit, pending, email, banner = null, formRef }: InviteFormCardProps) {
  const copy = AUTH_COPY.invite;
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader
        title={copy.title}
        subline={
          <>
            {copy.subline.before}
            <strong>{email}</strong>
            {copy.subline.after}
          </>
        }
      />
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <NewPasswordFields control={control} email={email} />
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

// ── S3 Set a new password (the must-change step) ──

export interface NewPasswordFormProps {
  control: Control<NewPasswordValues>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  /** The save is in flight (WEB-09). */
  pending: boolean;
  /** The pending sign-in's email for the hidden username input, or null when it is not known. */
  email: string | null;
  /** Why the change is needed: a breached password (D-18) or a temporary one (D-21, D-22). */
  reason: 'breach' | 'temporary';
  banner?: AuthBanner | null | undefined;
  /** "Use a different account": drops what this tab holds for the pending sign-in. */
  onBack: () => void;
  formRef?: Ref<HTMLFormElement>;
}

export function NewPasswordForm({
  control,
  onSubmit,
  pending,
  email,
  reason,
  banner = null,
  onBack,
  formRef,
}: NewPasswordFormProps) {
  const copy = AUTH_COPY.newPassword;
  return (
    <form ref={formRef} aria-label={copy.title} noValidate className={loginCardClasses} onSubmit={onSubmit}>
      <AuthHeader title={copy.title} subline={reason === 'breach' ? copy.sublineBreach : copy.sublineTemporary} />
      {banner !== null && (
        <ErrorState align="start" title={banner.title} message={banner.message} error={banner.error} />
      )}
      <NewPasswordFields control={control} email={email} />
      <Button type="submit" variant="primary" size="lg" block iconRight="arrow-right" pending={pending}>
        {pending ? copy.pending : copy.cta}
      </Button>
      <UiLink to={SIGN_IN_PATH} className={clsx(loginBackClasses, hitAreaClasses)} onClick={onBack}>
        <Icon name="chevron-left" size={16} />
        {copy.back}
      </UiLink>
    </form>
  );
}
