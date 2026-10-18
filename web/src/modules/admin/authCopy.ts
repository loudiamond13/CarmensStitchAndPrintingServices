// The words of every auth screen (UI-SPEC "Copywriting Contract", S1 to S7, plan 04-26): one module, no wording in JSX.
// App. E.5 strings are verbatim; the rest are SPEC-GAP wording for the owner's D-06 review. No long dash (OR-4).
import type { IconName } from '@/components/brand';
import type { SignInNotice } from '@/modules/admin/services/session';

/** A sentence with the person's email set in bold: render `before`, the email in a strong element, then `after`. */
export interface EmailSentence {
  readonly before: string;
  readonly after: string;
}

interface NoticeCopy {
  readonly icon: Extract<IconName, 'info' | 'circle-check'>;
  readonly text: string;
}

export const AUTH_COPY = {
  eyebrow: 'CSPS Admin',
  brand: {
    eyebrow: 'Staff area',
    quote: 'Orders, payments and expenses, all in one place.',
  },
  fallbackEmail: 'your email',

  /** S1 Sign in (App. E.5). */
  signIn: {
    title: 'Sign in',
    subline: 'Use the email and password your manager set up for you.',
    email: 'Email',
    password: 'Password',
    // SPEC-GAP: the checkbox name is App. E.5's; the unticked default is the owner's D-03.
    keepSignedIn: 'Keep me signed in',
    forgot: 'Forgot password?',
    cta: 'Sign In',
    pending: 'Signing in',
    staffNote: 'Staff only. Customer orders are placed through the public site or Messenger.',
    back: 'Back to the CSPS website',
    /** The one banner for every failed sign-in (D-02): never says which part was wrong or what state the account is in. */
    failed: {
      title: 'Email or password is incorrect.',
      body: 'Check for typos, or ask your manager to reset your password.',
    },
  },

  /** S2 Check your email (the code step, D-01). */
  verify: {
    title: 'Check your email',
    // SPEC-GAP: S2 wording.
    subline: { before: 'We emailed a 6-digit code to ', after: '. It works for 15 minutes.' } satisfies EmailSentence,
    sublineFallback: 'We emailed a 6-digit code to your email. It works for 15 minutes.',
    legend: 'Sign-in code',
    hint: "Didn't get it? Check your spam folder, or use Resend Code.",
    cta: 'Verify Code',
    pending: 'Verifying',
    resend: 'Resend Code',
    resendIn: (minutesAndSeconds: string): string => `Resend code in ${minutesAndSeconds}`,
    resendStarted: 'We sent a new code. You can ask for another in 60 seconds.',
    resendReady: 'You can ask for a new code now.',
    resent: 'We sent you a new code.',
    note: 'Never share this code. CSPS staff will never ask you for it.',
    back: 'Use a different account',
    errors: {
      incomplete: 'Enter all 6 digits.',
      wrong: "That code isn't right. Check the newest email and try again.",
      usedUp: "This code can't be used anymore. Use Resend Code to get a new one.",
      expired: 'This code has expired. Use Resend Code to get a new one.',
      resendCap: { title: "You've asked for too many codes.", body: 'Try again in a little while.' },
      locked: {
        title: 'Too many wrong codes.',
        body: 'For your safety, sign-in is paused for 15 minutes. We emailed you about it.',
      },
    },
  },

  /** S3 Set a new password (must-change gate), and the password fields of S5 and S6. */
  newPassword: {
    title: 'Set a new password',
    sublineTemporary: 'You signed in with a temporary password. Choose your own password to continue.',
    sublineBreach: 'Your password appeared in a data breach. Set a new one.',
    /** The pending sign-in is checked on every arrival, so the screen can apply the account rules (OR-3). */
    checking: 'Checking your sign-in…',
    checked: 'Sign-in checked.',
    /** The check could not be made (network, 429, 5xx): the screen offers it again. */
    checkFailed: 'We could not check your sign-in yet.',
    retry: 'Try Again',
    newLabel: 'New password',
    confirmLabel: 'Confirm new password',
    ruleHint: "Use 8 to 64 characters with at least one number and one symbol. Don't use your name or email.",
    cta: 'Save Password',
    pending: 'Saving',
    back: 'Use a different account',
    errors: {
      required: 'Enter a new password.',
      tooShort: 'Use at least 8 characters.',
      tooLong: 'Use 64 characters or fewer.',
      noNumber: 'Add at least one number.',
      noSymbol: 'Add at least one symbol, like ! or #.',
      containsIdentity: "Don't use your name or email in your password.",
      breached: 'This password has appeared in a data breach. Choose a different one.',
      common: 'This password is too common. Choose a different one.',
      confirmRequired: 'Enter the new password again.',
      mismatch: "Passwords don't match.",
      breachCheckDown: { title: "We couldn't check your password right now.", body: 'Wait a minute, then try again.' },
    },
  },

  /** S4 Reset your password. */
  forgot: {
    title: 'Reset your password',
    subline: "Enter the email you sign in with. We'll send you a link to set a new password.",
    cta: 'Send Reset Link',
    pending: 'Sending',
    sentTitle: 'Check your email',
    sent: {
      before: 'If an account exists for ',
      after: ', we sent a link to reset your password. It works for 30 minutes.',
    } satisfies EmailSentence,
    sentNote: "Didn't get it? Check your spam folder. The email can take a few minutes.",
    another: 'Use a Different Email',
    back: 'Back to sign in',
  },

  /** S5 Set a new password from the email link. */
  reset: {
    title: 'Set a new password',
    subline: {
      before: 'Choose a new password for ',
      after: ". You'll sign in again after this.",
    } satisfies EmailSentence,
    checking: 'Checking your link…',
    checked: 'Link checked.',
    invalidTitle: 'This link has expired',
    invalidBody: "Reset links work for 30 minutes and only once. Ask for a new one and we'll email it to you.",
    request: 'Request a New Link',
    /** The link could not be checked (network, 429, 5xx): the screen offers the check again. */
    checkFailed: 'We could not check your reset link yet.',
    retry: 'Try Again',
    back: 'Back to sign in',
  },

  /** S6 Set your password from an invite. */
  invite: {
    title: 'Set your password',
    subline: {
      before: 'Welcome to CSPS Admin. Choose a password for ',
      after: ' to finish setting up your account.',
    } satisfies EmailSentence,
    invalidTitle: 'This invite has expired',
    invalidBody: 'Invite links work for 7 days and only once. Ask a Manager to send you a new invite.',
    /** The invite could not be checked (network, 429, 5xx): the screen offers the check again. */
    checkFailed: 'We could not check your invite yet.',
    retry: 'Try Again',
    back: 'Back to sign in',
  },

  /** The one-shot notices above the S1 form (UI-SPEC "Sign-in notices"). */
  notices: {
    'session-ended': { icon: 'info', text: 'Your session ended. Sign in again.' },
    'signed-out': { icon: 'circle-check', text: "You've signed out." },
    'password-changed': { icon: 'circle-check', text: 'Your password was changed. Sign in with your new password.' },
    'password-set': { icon: 'circle-check', text: 'Your password is set. Sign in to continue.' },
    'timed-out': { icon: 'info', text: 'Your sign-in timed out. Sign in again.' },
  } satisfies Record<SignInNotice, NoticeCopy>,

  /** Client-side checks that mirror the server validators (OR-3). */
  errors: {
    emailRequired: 'Enter your email.',
    emailInvalid: 'Enter a valid email, like name@gmail.com',
    passwordRequired: 'Enter your password.',
  },

  /** The user menu items, the sign-out dialogs and the toasts. */
  menu: {
    devices: 'Signed-in Devices',
    signOutOthers: 'Sign Out Other Devices',
  },
  signOutOthersDialog: {
    title: 'Sign out of other devices?',
    body: "You'll stay signed in on this device. Any other phone, tablet or computer signed in to your account will be signed out. Use this if you signed in on a shared or lost device.",
    keep: 'Keep Others Signed In',
    confirm: 'Sign Out Other Devices',
    pending: 'Signing out',
  },
  toasts: {
    signedOutOthers: { title: 'Signed out of other devices', body: "You're still signed in on this device." },
    passwordSaved: { title: 'Password saved', body: "You're signed in. Use your new password next time." },
    sessionEnding: {
      title: 'Your session ends soon',
      body: (time: string): string => `You'll be signed out at ${time}. Save your work, then sign in again.`,
    },
    deviceSignedOut: {
      title: 'Device signed out',
      body: (device: string): string => `${device} will have to sign in again.`,
    },
    alreadySignedOut: { title: 'Already signed out', body: 'That device was no longer signed in.' },
  },

  /** S7 Signed-in devices. */
  sessions: {
    documentTitle: 'Signed-in Devices',
    title: 'Signed-in devices',
    subline:
      "Where your account is signed in right now. Sign out any device you don't recognize. Last active times are approximate.",
    headerAction: 'Sign Out Other Devices',
    caption: 'Signed-in devices',
    things: 'signed-in devices',
    columns: {
      device: 'Device',
      signedIn: 'Signed in',
      lastActive: 'Last active',
      session: 'Session',
      actions: 'Actions',
    },
    thisDevice: 'This device',
    keepBadge: 'Keep me signed in',
    untilClose: 'Until browser closes',
    unknownBrowser: 'Unknown browser',
    deviceLabel: (browser: string, device: string): string => `${browser} on ${device}`,
    activeNow: 'Active now',
    justNow: 'Just now',
    minutesAgo: (minutes: number): string => `${String(minutes)} min ago`,
    hoursAgo: (hours: number): string => `${String(hours)} hr ago`,
    rowAction: (device: string, signedIn: string | null): string =>
      signedIn === null ? `Sign out ${device}` : `Sign out ${device}, signed in ${signedIn}`,
    rowHint: 'Sign out',
    onlyThisDevice: 'No other devices are signed in. When you sign in somewhere else, it shows up here.',
    deviceDialog: {
      title: (device: string): string => `Sign out ${device}?`,
      body: (signedIn: string | null): string =>
        `${signedIn === null ? '' : `Signed in ${signedIn}. `}That device will have to sign in again with the password and an emailed code. If you don't recognize it, sign it out and tell a Manager.`,
      keep: 'Keep Signed In',
      confirm: 'Sign Out Device',
      pending: 'Signing out',
    },
  },
} as const;
