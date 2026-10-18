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
  // SPEC-GAP: the Signed-in Devices card on the Security tab (D-23).
  devices: {
    title: 'Signed-in Devices',
    hint: "See where your account is signed in, and sign out devices you don't recognize.",
    cta: 'View Signed-in Devices',
    path: '/admin/sessions',
  },
} as const;
