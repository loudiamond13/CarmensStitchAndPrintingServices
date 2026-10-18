// The words of the Users roster (UI-SPEC Copywriting Contract, U1; plan 05-20): one module, no wording in JSX. App. E.12 and
// OQ-7 strings are verbatim; the rest are SPEC-GAP wording that the owner reviews before approving it (D-48). No long dash (OR-4).
export const USERS_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Users',
  /** The plural and singular nouns of the list: "Couldn't load users.", "Showing 1 user". */
  things: 'users',
  thing: 'user',
  /** The result bar's sort: "Showing 12 users · sorted by name". */
  sortLabel: 'name',
  title: 'Users',
  badge: 'Manager only',
  subline: 'Who can sign in to CSPS Admin. Admins manage orders and expenses; Managers can also manage users.',
  caption:
    "You can't lock, deactivate, demote or delete your own account. Locked and deactivated users can't sign in, but their records stay on orders and expenses.",
  search: { label: 'Search', placeholder: 'Name or email' },
  roleFilter: { label: 'Role', all: 'All roles', admin: 'Admin', manager: 'Manager' },
  // SPEC-GAP: Locked is new (OQ-1).
  statusFilter: { label: 'Status', all: 'All statuses', active: 'Active', inactive: 'Inactive', locked: 'Locked' },
  columns: { user: 'User', email: 'Email', role: 'Role', status: 'Status', created: 'Created', actions: 'Actions' },
  /** The sub line on the signed-in Manager's own row. */
  you: 'You',
  // SPEC-GAP: the invitation badges.
  invite: { pending: 'Invite pending', expired: 'Invite expired' },
  // SPEC-GAP: the own row's only action (D-19).
  ownRowEdit: 'Edit your details in My Profile',
  // U2 Add User (App. E.12; OQ-7 amended description; plan 05-22). Title Case for buttons, sentence case for the rest.
  add: {
    open: 'Add User',
    title: 'Add User',
    /** The panel description follows the access choice (OQ-7, App. E.12). */
    description: {
      invitation: "We'll email them a link to set their own password.",
      temporary: 'They can sign in right away with a temporary password.',
    },
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    emailHint: "They'll use this to sign in.",
    role: {
      label: 'Role',
      admin: 'Admin',
      manager: 'Manager',
      hint: {
        Admin: 'Admins manage orders and company expenses.',
        Manager: 'Managers can do everything Admins can, plus add, edit and remove users.',
      },
    },
    // SPEC-GAP: the access choice (OQ-10, D-12).
    access: {
      legend: 'How they get access',
      invitation: {
        label: 'Email an invitation',
        description: 'We email them a link to set their own password. It works for 7 days.',
      },
      temporary: {
        label: 'Set a temporary password',
        description: 'You give them a password to use once. They choose their own at first sign-in.',
      },
    },
    temporaryPassword: {
      label: 'Temporary password',
      hint: "Share it privately. They'll be asked to change it on first sign-in.",
      // SPEC-GAP: a fresh random suggestion.
      newSuggestion: 'New Suggestion',
    },
    cancel: 'Cancel',
    create: 'Create User',
    creating: 'Creating',
    // SPEC-GAP: the shown-once step (D-14).
    shownOnce: {
      title: 'User created',
      /** "{First Last} · {Role}" */
      description: (name: string, role: string): string => `${name} · ${role}`,
      fieldLabel: (first: string): string => `Temporary password for ${first}`,
      note: (first: string): string =>
        `This is the only time you'll see this password. Copy it now and give it to ${first} in person or by private message. If it gets lost, set a new one.`,
      done: 'Done',
    },
    toast: {
      title: 'User created',
      /** "{First Last} · {Role}. We emailed them an invitation that works for 7 days." */
      invitation: (name: string, role: string): string =>
        `${name} · ${role}. We emailed them an invitation that works for 7 days.`,
    },
    errors: {
      firstNameRequired: 'Enter a first name.',
      lastNameRequired: 'Enter a last name.',
      firstNameTooLong: 'First name must be 100 characters or fewer.',
      lastNameTooLong: 'Last name must be 100 characters or fewer.',
      emailRequired: 'Enter their email.',
      roleRequired: 'Choose a role.',
      accessRequired: 'Choose how they get access.',
      temporaryPasswordRequired: 'Enter a temporary password.',
    },
  },
  // U3 Edit User (App. E.12, the SEC-08 user detail; plan 05-25). Title Case for buttons, sentence case for the rest.
  edit: {
    title: 'Edit User',
    description: 'Update details or change their role.',
    /** The noun of the detail load: "Loading user details…", "User details loaded.", "Couldn't load user details." */
    things: 'user details',
    /** The roster's pencil: "Edit Paolo Garcia". */
    rowEdit: (name: string): string => `Edit ${name}`,
    cancel: 'Cancel',
    save: 'Save Changes',
    saving: 'Saving',
    /** USER-05: shown while Role differs from the saved role. */
    roleChangeNote: (first: string): string => `Changing the role signs ${first} out on every device.`,
    // SPEC-GAP: D-45 the Manager chooses how a changed email applies. The wording is built, not yet approved (D-48).
    emailChange: {
      legend: 'How this email change applies',
      confirm: {
        label: 'Confirm by link',
        description: 'The new address must confirm first, and the old address is told.',
      },
      now: {
        label: 'Save at once',
        description: 'The email changes now. The old address is told and they are signed out everywhere.',
      },
      required: 'Choose how the email change applies.',
    },
    /** The link to this person's audit entries (the page lands in plan 05-33). */
    activityLink: "See this user's activity in the audit log",
    /** Refusals and the deleted notice: a bold line over a muted line (UI-SPEC "Error and guard states"). */
    guards: {
      lastManager: {
        title: "You can't remove the last active Manager.",
        body: 'Make another user a Manager first, then try again.',
      },
      ownAccount: {
        title: "You can't do this to your own account.",
        body: 'Change your own details in My Profile.',
      },
      deleted: { title: 'This user was deleted.', body: 'Close this and refresh the list.' },
    },
    toast: {
      title: 'User updated',
      /** "{First Last} · {Role}" */
      message: (name: string, role: string): string => `${name} · ${role}`,
    },
  },
  // U4 row actions (App. E.12, OQ-1, OQ-3; plan 05-28). Title Case for buttons, sentence case for the rest.
  rowActions: {
    /** The status toggle: a pencil-sized icon button named for the person's first name, with the same title. */
    deactivate: (first: string): string => `Deactivate ${first}`,
    activate: (first: string): string => `Activate ${first}`,
  },
  // SPEC-GAP: the Deactivate confirm (OQ-3). The wording is built, not yet approved (D-48).
  deactivate: {
    title: (name: string): string => `Deactivate ${name}?`,
    body: "They'll be signed out on every device and can't sign in. Their records stay on orders and expenses. You can activate them again later.",
    keep: 'Keep Active',
    confirm: 'Deactivate User',
    pending: 'Deactivating',
    toast: {
      title: 'User deactivated',
      message: (name: string): string => `${name} can no longer sign in.`,
    },
  },
  // SPEC-GAP: Activate acts at once, so only its toasts need words (D-48).
  activate: {
    toast: {
      title: 'User activated',
      message: (name: string): string => `${name} can sign in again.`,
    },
    /** The danger toast's bold line; the mapper line follows. */
    failed: (name: string): string => `Couldn't activate ${name}`,
  },
  // Delete (App. E.12; OQ-7 amended message): the shared ConfirmDialog, Cancel focused, no type-to-confirm (D-07, D-09).
  remove: {
    /** The row's trash button: "Delete Paolo Garcia". */
    rowDelete: (name: string): string => `Delete ${name}`,
    title: (name: string): string => `Delete ${name}?`,
    // SPEC-DEVIATION: OQ-7 App. E.12's message is amended: it says what stays, points to deactivating, and ends with the final-action warning.
    message:
      "They won't be able to sign in. Orders and expenses they recorded stay, under their name. If they might come back, deactivate instead. This can't be undone.",
    confirm: 'Delete User',
    pending: 'Deleting',
    toast: {
      title: 'User deleted',
      message: (name: string): string => name,
    },
  },
  // SPEC-GAP: the CopyField beside a shown-once password (UI-SPEC "CopyField behaviour").
  copyField: {
    copy: 'Copy Password',
    copied: 'Copied',
    /** Read out politely once the copy worked. */
    announce: 'Password copied.',
    failed: "Copy didn't work. Select the password and copy it yourself.",
  },
  /** The no-match sentence's filter part: "No users with role Manager and status Locked." */
  filterSummary: (role: string | null, status: string | null): string =>
    [role === null ? null : `role ${role}`, status === null ? null : `status ${status}`]
      .filter((part): part is string => part !== null)
      .join(' and '),
} as const;
