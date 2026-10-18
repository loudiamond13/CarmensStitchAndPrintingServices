// The words of the Audit Log (UI-SPEC Copywriting Contract, A1; AUDIT-02, D-26..D-29, D-40; plan 05-33): one module, no wording
// in JSX. The page strings and the action labels are SPEC-GAP wording that the owner reviews before approving it (D-48). The
// labels cover every action code the API can send, including the ones added after the UI-SPEC table (D-28). No long dash (OR-4).

/** The three groups of the Action select, in the order the UI-SPEC lists them. */
export const AUDIT_GROUPS = ['Sign-in and security', 'Staff accounts', 'Profile changes'] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export interface AuditActionLabel {
  /** The code the API sends, like `user.deactivated`. */
  code: string;
  label: string;
  group: AuditGroup;
}

const SIGN_IN = AUDIT_GROUPS[0];
const STAFF = AUDIT_GROUPS[1];
const PROFILE = AUDIT_GROUPS[2];

/** Every action code with its plain-English label and group, in the order the select lists them. */
export const AUDIT_ACTIONS: readonly AuditActionLabel[] = [
  { code: 'auth.signed-in', label: 'Signed in', group: SIGN_IN },
  { code: 'auth.sign-in-failed', label: 'Sign-in failed', group: SIGN_IN },
  { code: 'auth.lockout', label: 'Sign-in paused after too many tries', group: SIGN_IN },
  { code: 'auth.2fa-issued', label: 'Sign-in code sent', group: SIGN_IN },
  { code: 'auth.2fa-resent', label: 'Sign-in code sent again', group: SIGN_IN },
  { code: 'auth.2fa-verified', label: 'Sign-in code accepted', group: SIGN_IN },
  { code: 'auth.2fa-failed', label: 'Wrong sign-in code', group: SIGN_IN },
  { code: 'auth.2fa-exhausted', label: 'Sign-in code used up', group: SIGN_IN },
  { code: 'auth.refresh-reuse-detected', label: 'Reused sign-in blocked', group: SIGN_IN },
  { code: 'auth.signed-out', label: 'Signed out', group: SIGN_IN },
  { code: 'auth.sessions-revoked', label: 'Signed out of devices', group: SIGN_IN },
  { code: 'auth.session-revoked', label: 'Signed out a device', group: SIGN_IN },
  { code: 'auth.password-reset-requested', label: 'Password reset requested', group: SIGN_IN },
  { code: 'auth.password-reset-completed', label: 'Password reset', group: SIGN_IN },
  { code: 'auth.password-reset-link-invalid', label: 'Expired or used reset link', group: SIGN_IN },
  { code: 'auth.password-changed', label: 'Password changed', group: SIGN_IN },
  { code: 'auth.password-breach-found', label: 'Breached password found', group: SIGN_IN },
  { code: 'auth.breach-check-unavailable', label: 'Breach check unavailable', group: SIGN_IN },
  { code: 'auth.invite-accepted', label: 'Invitation accepted', group: SIGN_IN },
  { code: 'user.bootstrap-manager-created', label: 'First Manager created', group: STAFF },
  { code: 'user.invited', label: 'User invited', group: STAFF },
  { code: 'user.created-temporary', label: 'User created with a temporary password', group: STAFF },
  { code: 'user.invitation-resent', label: 'Invitation sent again', group: STAFF },
  { code: 'user.reset-link-sent', label: 'Reset link sent', group: STAFF },
  { code: 'user.temporary-password-set', label: 'Temporary password set', group: STAFF },
  { code: 'user.details-changed', label: 'User details changed', group: STAFF },
  { code: 'user.role-changed', label: 'Role changed', group: STAFF },
  { code: 'user.email-change-started', label: 'Email change started', group: STAFF },
  { code: 'user.locked', label: 'User locked', group: STAFF },
  { code: 'user.unlocked', label: 'User unlocked', group: STAFF },
  { code: 'user.deactivated', label: 'User deactivated', group: STAFF },
  { code: 'user.activated', label: 'User activated', group: STAFF },
  { code: 'user.deleted', label: 'User deleted', group: STAFF },
  { code: 'profile.name-changed', label: 'Name changed', group: PROFILE },
  { code: 'profile.email-change-requested', label: 'Email change requested', group: PROFILE },
  { code: 'profile.email-changed', label: 'Email changed', group: PROFILE },
  { code: 'profile.email-change-canceled', label: 'Email change canceled', group: PROFILE },
];

/** The codes the Action filter accepts in the URL. */
export const AUDIT_ACTION_CODES: readonly string[] = AUDIT_ACTIONS.map((action) => action.code);

const LABELS: ReadonlyMap<string, string> = new Map(AUDIT_ACTIONS.map((action) => [action.code, action.label]));

/** The plain-English label of an action, or the key itself when the viewer does not know it (a newer server). */
export function auditActionLabel(code: string): string {
  return LABELS.get(code) ?? code;
}

const ROLE_WORDS: ReadonlyMap<string, string> = new Map([
  ['admin', 'Admin'],
  ['manager', 'Manager'],
]);

/** The fields a details-changed or name-changed entry lists, each read as one fixed sentence. */
const FIELD_SENTENCES: ReadonlyMap<string, string> = new Map([
  ['first-name', 'Name changed'],
  ['last-name', 'Name changed'],
  ['email', 'Email changed'],
]);

/** The stored one-word reasons, by action. Only these words are ever shown; anything else shows nothing. */
const REASONS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'auth.sign-in-failed',
    new Map([
      ['unknown-account', 'No account with that email'],
      ['bad-password', 'Wrong password'],
      ['locked', 'The account was locked'],
      ['deactivated', 'The account is deactivated'],
      ['unconfirmed', 'The account is not confirmed yet'],
      ['no-password', 'No password set yet'],
      ['manager-locked', 'A Manager locked the account'],
      ['deleted', 'The account was deleted'],
    ]),
  ],
  [
    'auth.lockout',
    new Map([
      ['password', 'Too many wrong passwords'],
      ['code', 'Too many wrong sign-in codes'],
    ]),
  ],
  [
    'auth.sessions-revoked',
    new Map([
      ['sign-out-others', 'Signed out of other devices'],
      ['password-reset', 'After a password reset'],
      ['password-changed', 'After a password change'],
      ['account-changed', 'The account was changed'],
      ['temporary-password', 'After a temporary password was set'],
    ]),
  ],
  [
    'auth.password-reset-requested',
    new Map([
      ['sent', 'Reset link emailed'],
      ['deactivated', 'Notice emailed, the account is deactivated'],
      ['manager-locked', 'Nothing sent, a Manager locked the account'],
      ['unknown-account', 'Nothing sent, no account with that email'],
      ['capped', 'Too many requests this hour'],
    ]),
  ],
  ['auth.password-changed', new Map([['profile', 'Changed in My Profile']])],
  [
    'user.invited',
    new Map([
      ['bootstrap', 'First Manager setup'],
      ['manager', 'Invited by a Manager'],
    ]),
  ],
  ['profile.email-change-requested', new Map([['resent', 'Link sent again']])],
  ['profile.email-change-canceled', new Map([['taken', 'That address was taken']])],
]);

const FIELDS_PREFIX = 'fields=';
const ROLE_CHANGE = /^role=(admin|manager)>(admin|manager)$/;

/** "fields=first-name,email" as "Name changed. Email changed"; null if any field is not one of the three. */
function describeFields(list: string): string | null {
  const sentences: string[] = [];
  for (const field of list.split(',')) {
    const sentence = FIELD_SENTENCES.get(field);
    if (sentence === undefined) return null;
    if (!sentences.includes(sentence)) sentences.push(sentence);
  }
  return sentences.join('. ');
}

// SPEC-DEVIATION: D-40 the UI-SPEC lines "Name: {old} to {new}", "Email: {old} to {new}" and "New email: {email}, waiting for
// confirmation" are not built. The log keeps field names and role values only, so the text says what kind of change it was.
/**
 * The "What changed" text for an entry (D-27), built only from the fixed words the log stores: field names, role values and a
 * short reason. It never shows a stored value as it is, so a name or an email cannot appear, and an unknown word gives null
 * (the row then has no What changed line).
 */
export function describeAuditDetail(action: string, detail: string | null): string | null {
  if (detail === null || detail === '') return null;
  if (detail.startsWith(FIELDS_PREFIX)) {
    return action === 'user.details-changed' || action === 'profile.name-changed'
      ? describeFields(detail.slice(FIELDS_PREFIX.length))
      : null;
  }
  const role = ROLE_CHANGE.exec(detail);
  if (role !== null) {
    return action === 'user.role-changed'
      ? `Role: ${ROLE_WORDS.get(role[1] ?? '') ?? ''} to ${ROLE_WORDS.get(role[2] ?? '') ?? ''}`
      : null;
  }
  return REASONS.get(action)?.get(detail) ?? null;
}

/** The copy of the Audit Log page (A1). */
export const AUDIT_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Audit Log',
  /** The result bar: "Showing 12 entries · newest first". */
  thing: 'entry',
  things: 'entries',
  orderNote: 'newest first',
  /** The table's noun for its states: "Loading audit entries…", "Couldn't load audit entries.". */
  tableThings: 'audit entries',
  caption: 'Audit log',
  title: 'Audit Log',
  badge: 'Manager only',
  subline:
    'Every sign-in, security and staff account change, newest first. Times are Manila time. Entries are kept for 8 months.',
  columns: { when: 'When', doneBy: 'Done by', action: 'Action', doneTo: 'Done to', actions: 'Actions' },
  /** Done by for a failed sign-in with no matching account. */
  unknownAccount: 'Unknown account',
  toggle: {
    show: (action: string, when: string): string => `Show details for ${action}, ${when}`,
    hide: (action: string, when: string): string => `Hide details for ${action}, ${when}`,
  },
  detail: {
    whatChanged: 'What changed',
    ipAddress: 'IP address',
    device: 'Device',
    reference: 'Reference',
    unknownBrowser: 'Unknown browser',
  },
  /** The Date range select's options, and the chip's value. */
  ranges: {
    'last-7-days': 'Last 7 days',
    'last-30-days': 'Last 30 days',
    'this-month': 'This month',
    'last-month': 'Last month',
    all: 'Everything kept (8 months)',
    custom: 'Custom range',
  },
  empty: {
    title: 'No entries in the last 7 days',
    message: 'Choose a wider date range to see older entries.',
    showAll: 'Show Everything Kept',
  },
} as const;
