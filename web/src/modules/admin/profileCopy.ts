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
  toasts: {
    saved: { title: 'Changes saved', message: 'Your name is updated.' },
  },
  errors: {
    firstNameRequired: 'Enter a first name.',
    lastNameRequired: 'Enter a last name.',
    firstNameTooLong: `First name must be ${String(NAME_MAX_LENGTH)} characters or fewer.`,
    lastNameTooLong: `Last name must be ${String(NAME_MAX_LENGTH)} characters or fewer.`,
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
