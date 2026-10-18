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
  /** The no-match sentence's filter part: "No users with role Manager and status Locked." */
  filterSummary: (role: string | null, status: string | null): string =>
    [role === null ? null : `role ${role}`, status === null ? null : `status ${status}`]
      .filter((part): part is string => part !== null)
      .join(' and '),
} as const;
