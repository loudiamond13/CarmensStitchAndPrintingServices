// The words of My Profile (UI-SPEC Copywriting Contract, P1; plan 05-13): one module, no wording in JSX. App. E.13 strings
// are verbatim; the rest are SPEC-GAP wording that the owner reviews before approving it (D-48). No long dash (OR-4).
/** The longest name, in UTF-16 code units after trimming: the server's UpdateProfileNameRequestValidator.NameMaxLength. */
export const NAME_MAX_LENGTH = 100;

export const PROFILE_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'My Profile',
  /** The noun the load failure and the loading announcements use: "Couldn't load your profile." */
  things: 'your profile',
  loading: { loading: 'Loading your profile…', loaded: 'Profile loaded.' },
  header: {
    /** "{email} · Member since {Oct 6, 2026}". */
    meta: (email: string, memberSince: string): string => `${email} · Member since ${memberSince}`,
  },
  // SPEC-GAP: the tab names (D-23).
  tabs: { details: 'Details', security: 'Security', appearance: 'Appearance' },
  personal: {
    title: 'Personal Information',
    hint: 'Shown on orders and expenses you record.',
    firstName: 'First name',
    lastName: 'Last name',
    save: 'Save Changes',
    saving: 'Saving',
  },
  // SPEC-GAP: the Sign-in Email card on the Details tab (D-24). The pending note reads
  // "{before}{new email in bold}{middle}{current email}{after}".
  signInEmail: {
    title: 'Sign-in Email',
    hint: 'You sign in with this email.',
    change: 'Change Email',
    pending: {
      before: 'Waiting for confirmation at ',
      middle: '. Until then, you sign in with ',
      after: '.',
    },
    resend: 'Resend Link',
    resending: 'Sending',
    cancel: 'Cancel Change',
    canceling: 'Canceling',
  },
  // App. E.13 Change Password card on the Security tab (PROF-03); the new-password pair and its rule hint are the P4 ones.
  password: {
    title: 'Change Password',
    hint: 'Use 8+ characters with a number and a symbol.',
    currentPassword: 'Current password',
    update: 'Update Password',
    updating: 'Updating',
  },
  // SPEC-GAP: P2 Change Email dialog (PROF-02, C-9, D-24, D-25).
  changeEmail: {
    title: 'Change your email',
    description:
      "We'll send a confirmation link to the new address and a notice to your current one. Your email changes only after you open the link. The link works for 24 hours.",
    newEmail: 'New email',
    currentPassword: 'Current password',
    cancel: 'Cancel',
    send: 'Send Confirmation Link',
    sending: 'Sending',
  },
  toasts: {
    saved: { title: 'Changes saved', message: 'Your name is updated.' },
    /** OQ-7: the amended App. E.13 wording; the other devices are named because they are signed out. */
    passwordUpdated: {
      title: 'Password updated',
      message: 'Use your new password next time you sign in. Your other devices were signed out.',
    },
    // SPEC-GAP: the email-change toasts. Each message names an address.
    emailSent: {
      title: 'Confirmation link sent',
      message: (newEmail: string): string => `Open the link we sent to ${newEmail}. Your email changes after that.`,
    },
    linkResent: {
      title: 'Link sent again',
      message: (newEmail: string): string => `Check ${newEmail}. The new link works for 24 hours.`,
    },
    emailCanceled: {
      title: 'Email change canceled',
      message: (currentEmail: string): string => `You still sign in with ${currentEmail}.`,
    },
    /** A resend found nothing waiting (canceled or finished in another tab). */
    nothingWaiting: {
      title: 'No email change is waiting',
      message: 'It may have been canceled or finished in another tab.',
    },
  },
  errors: {
    firstNameRequired: 'Enter a first name.',
    lastNameRequired: 'Enter a last name.',
    firstNameTooLong: `First name must be ${String(NAME_MAX_LENGTH)} characters or fewer.`,
    lastNameTooLong: `Last name must be ${String(NAME_MAX_LENGTH)} characters or fewer.`,
    newEmailRequired: 'Enter your new email.',
    sameEmail: 'This is already your email.',
    currentPasswordRequired: 'Enter your current password.',
    /** The same words as the server's, shown when the new password is the current one. */
    samePassword: 'Choose a different password from your current one.',
    /** The server's own line is shown for the lock; this one covers a reply that carries none. */
    passwordLocked: 'Too many wrong passwords. Try again in 15 minutes.',
  },
  // SPEC-GAP: the Theme card on the Appearance tab (D-22).
  appearance: {
    title: 'Theme',
    hint: 'Choose how CSPS Admin looks on this browser.',
    label: 'Theme',
    light: 'Blush (light)',
    dark: 'Espresso (dark)',
    note: 'Saved on this browser only. The public website always stays light.',
    changed: { light: 'Theme changed to Blush (light).', dark: 'Theme changed to Espresso (dark).' },
  },
  // SPEC-GAP: the Signed-in Devices card on the Security tab (D-23).
  devices: {
    title: 'Signed-in Devices',
    hint: "See where your account is signed in, and sign out devices you don't recognize.",
    cta: 'View Signed-in Devices',
    path: '/admin/sessions',
  },
  // SPEC-GAP: P3 Confirm your email, opened from the link sent to the new address (C-17, PROF-02).
  confirmEmail: {
    title: 'Confirm your email',
    checking: 'Checking your link…',
    checked: 'Link checked.',
    /** The link could not be checked (network, 429, 5xx): the screen offers the check again. */
    checkFailed: 'We could not check your link yet.',
    retry: 'Try Again',
    /** "Change your CSPS sign-in email to {new email}?" */
    ready: { before: 'Change your CSPS sign-in email to ', after: '?' },
    confirm: 'Confirm New Email',
    confirming: 'Confirming',
    back: 'Back to sign in',
    done: {
      title: 'Your email is changed',
      /** "From now on, sign in with {new email}." */
      body: { before: 'From now on, sign in with ', after: '.' },
      continue: 'Continue to CSPS Admin',
      path: '/admin',
    },
    invalid: {
      title: 'This link has expired',
      body: 'Email change links work for 24 hours and only once. Start the change again from My Profile.',
    },
    taken: {
      title: "This email can't be used",
      /** "Another account now uses {new email}. Start the change again from My Profile with a different email." */
      body: {
        before: 'Another account now uses ',
        after: '. Start the change again from My Profile with a different email.',
      },
      /** The check's 409 does not name the address, so a taken link opened later says "this email". */
      bodyNoAddress:
        'Another account now uses this email. Start the change again from My Profile with a different email.',
    },
  },
} as const;
