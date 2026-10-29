// The words of the Audit Log (UI-SPEC Copywriting Contract, A1; AUDIT-02, D-26..D-29, D-40; plan 05-33): one module, no wording
// in JSX. The page strings and the action labels are SPEC-GAP wording that the owner reviews before approving it (D-48). The
// labels cover every action code the API can send, including the ones added after the UI-SPEC table (D-28). No long dash (OR-4).

import { RECORD_META_COPY } from '@/components/data';
import { CATEGORY_TONE_LABEL, isCategoryTone } from '@/components/status';
import type { components } from '@/types/api.generated';
import { formatPeso } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';

/** The groups of the Action select, in the order the UI-SPEC lists them (A1; the two expense groups are Phase 6, the two order groups Phase 7). */
export const AUDIT_GROUPS = [
  'Sign-in and security',
  'Staff accounts',
  'Profile changes',
  'Company expenses',
  'Expense categories',
  'Orders',
  'Order lists',
] as const;
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
const EXPENSES = AUDIT_GROUPS[3];
const CATEGORIES = AUDIT_GROUPS[4];
const ORDERS = AUDIT_GROUPS[5];
const ORDER_LISTS = AUDIT_GROUPS[6];

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
  { code: 'company-expense.added', label: 'Expense added', group: EXPENSES },
  { code: 'company-expense.changed', label: 'Expense changed', group: EXPENSES },
  { code: 'company-expense.payer-changed', label: 'Expense payer changed', group: EXPENSES },
  { code: 'company-expense.deleted', label: 'Expense deleted', group: EXPENSES },
  { code: 'company-expense.restored', label: 'Expense restored', group: EXPENSES },
  { code: 'company-expense.permanently-deleted', label: 'Expense permanently deleted', group: EXPENSES },
  { code: 'expense-category.added', label: 'Category added', group: CATEGORIES },
  { code: 'expense-category.renamed', label: 'Category renamed', group: CATEGORIES },
  { code: 'expense-category.recolored', label: 'Category color changed', group: CATEGORIES },
  { code: 'expense-category.retired', label: 'Category retired', group: CATEGORIES },
  { code: 'expense-category.reactivated', label: 'Category back in use', group: CATEGORIES },
  { code: 'expense-category.deleted', label: 'Category deleted', group: CATEGORIES },
  { code: 'order.created', label: 'Order created', group: ORDERS },
  { code: 'order.changed', label: 'Order changed', group: ORDERS },
  { code: 'order.status-changed', label: 'Order status changed', group: ORDERS },
  { code: 'order.reopened', label: 'Order reopened', group: ORDERS },
  { code: 'order.deleted', label: 'Order deleted', group: ORDERS },
  { code: 'order.restored', label: 'Order restored', group: ORDERS },
  { code: 'order.permanently-deleted', label: 'Order permanently deleted', group: ORDERS },
  { code: 'order-item.added', label: 'Item added', group: ORDERS },
  { code: 'order-item.changed', label: 'Item changed', group: ORDERS },
  { code: 'order-item.removed', label: 'Item removed', group: ORDERS },
  { code: 'order-payment.added', label: 'Payment added', group: ORDERS },
  { code: 'order-payment.changed', label: 'Payment changed', group: ORDERS },
  { code: 'order-payment.receiver-changed', label: 'Payment receiver changed', group: ORDERS },
  { code: 'order-payment.removed', label: 'Payment removed', group: ORDERS },
  { code: 'order-refund.added', label: 'Refund added', group: ORDERS },
  { code: 'order-refund.changed', label: 'Refund changed', group: ORDERS },
  { code: 'order-refund.refunder-changed', label: 'Refunder changed', group: ORDERS },
  { code: 'order-refund.removed', label: 'Refund removed', group: ORDERS },
  { code: 'order-discount.added', label: 'Discount added', group: ORDERS },
  { code: 'order-discount.changed', label: 'Discount changed', group: ORDERS },
  { code: 'order-discount.removed', label: 'Discount removed', group: ORDERS },
  { code: 'order-expense.added', label: 'Order expense added', group: ORDERS },
  { code: 'order-expense.changed', label: 'Order expense changed', group: ORDERS },
  { code: 'order-expense.payer-changed', label: 'Order expense payer changed', group: ORDERS },
  { code: 'order-expense.removed', label: 'Order expense removed', group: ORDERS },
  { code: 'product-type.added', label: 'Product type added', group: ORDER_LISTS },
  { code: 'product-type.renamed', label: 'Product type renamed', group: ORDER_LISTS },
  { code: 'product-type.recolored', label: 'Product type color changed', group: ORDER_LISTS },
  { code: 'product-type.retired', label: 'Product type retired', group: ORDER_LISTS },
  { code: 'product-type.reactivated', label: 'Product type back in use', group: ORDER_LISTS },
  { code: 'product-type.deleted', label: 'Product type deleted', group: ORDER_LISTS },
  { code: 'payment-method.added', label: 'Payment method added', group: ORDER_LISTS },
  { code: 'payment-method.renamed', label: 'Payment method renamed', group: ORDER_LISTS },
  { code: 'payment-method.recolored', label: 'Payment method color changed', group: ORDER_LISTS },
  { code: 'payment-method.retired', label: 'Payment method retired', group: ORDER_LISTS },
  { code: 'payment-method.reactivated', label: 'Payment method back in use', group: ORDER_LISTS },
  { code: 'payment-method.deleted', label: 'Payment method deleted', group: ORDER_LISTS },
  { code: 'order-expense-category.added', label: 'Order expense category added', group: ORDER_LISTS },
  { code: 'order-expense-category.renamed', label: 'Order expense category renamed', group: ORDER_LISTS },
  { code: 'order-expense-category.recolored', label: 'Order expense category color changed', group: ORDER_LISTS },
  { code: 'order-expense-category.retired', label: 'Order expense category retired', group: ORDER_LISTS },
  { code: 'order-expense-category.reactivated', label: 'Order expense category back in use', group: ORDER_LISTS },
  { code: 'order-expense-category.deleted', label: 'Order expense category deleted', group: ORDER_LISTS },
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

type AuditChangeLine = components['schemas']['AuditChangeLine'];
type AuditExpenseSnapshot = components['schemas']['AuditExpenseSnapshot'];
type AuditOrderSnapshot = components['schemas']['AuditOrderSnapshot'];
type AuditPerson = components['schemas']['ActorRef'];

/** What a category reads as once it has been deleted. */
const DELETED_CATEGORY = 'a deleted category';

/** The seven order statuses the API sends as keys (D-01). */
const ORDER_STATUS_LABEL: ReadonlyMap<string, string> = new Map([
  ['pending', 'Pending'],
  ['mockup', 'Mockup'],
  ['production', 'In Production'],
  ['ready', 'Ready'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);

const DISCOUNT_KIND_LABEL: ReadonlyMap<string, string> = new Map([
  ['fixed', 'Fixed amount'],
  ['percentage', 'Percentage'],
]);

/** The text fields a line can name. Only the fact that one changed is ever said, never its text (05 D-40). */
const TEXT_FIELD_SENTENCES: ReadonlyMap<string, string> = new Map([
  ['customerName', 'Customer name changed'],
  ['teamName', 'Team name changed'],
  ['contactNumber', 'Contact number changed'],
  ['email', 'Email changed'],
  ['address', 'Address changed'],
  ['notes', 'Notes changed'],
  ['description', 'Description changed'],
  ['sizeVariant', 'Size or variant changed'],
  ['reference', 'Reference changed'],
  ['reason', 'Reason changed'],
]);

/** The entries whose lines state each value as it was added or removed, so they have no old value. */
const STATED_VALUE_ACTION = /^(?:order\.created|order-(?:item|payment|refund|discount|expense)\.(?:added|removed))$/u;

/** True when the lines of an action state each value as it is, instead of old and new. */
export function isStatedValueAction(action: string): boolean {
  return STATED_VALUE_ACTION.test(action);
}

/** A person's name, then " (former staff)" for an account that was deleted. */
function personText(person: AuditPerson): string {
  return `${person.name}${person.formerStaff ? RECORD_META_COPY.formerStaff : ''}`;
}

function categoryText(name: string | null): string {
  return name ?? DELETED_CATEGORY;
}

/** "Blue" for a stored tone word; null for a word this viewer does not know. */
function toneText(tone: string | null): string | null {
  return tone !== null && isCategoryTone(tone) ? CATEGORY_TONE_LABEL[tone] : null;
}

/** "Label: old to new", or "Label: new" when there was no old value. */
function pair(label: string, from: string | null, to: string): string {
  return from === null ? `${label}: ${to}` : `${label}: ${from} to ${to}`;
}

/**
 * A line with a value on each side. A stated value (an added or removed entry) needs only the new side; a change needs both, and a
 * value the formatter cannot read leaves the line out.
 */
function valuePair(
  label: string,
  line: AuditChangeLine,
  stated: boolean,
  format: (value: string) => string | null,
): string | null {
  const to = line.to === null ? null : format(line.to);
  if (to === null) return null;
  if (stated) return pair(label, null, to);
  const from = line.from === null ? null : format(line.from);
  return from === null ? null : pair(label, from, to);
}

/** A line whose sides are list entry names; a side with no name is an entry that has been deleted. */
function namePair(label: string, deleted: string, line: AuditChangeLine, stated: boolean): string {
  const to = line.to ?? deleted;
  return stated ? pair(label, null, to) : pair(label, line.from ?? deleted, to);
}

/** A line whose sides are people. A stated value needs only the new person; a change needs both. */
function personPair(label: string, line: AuditChangeLine, stated: boolean): string | null {
  if (line.toPerson === null) return null;
  if (stated) return pair(label, null, personText(line.toPerson));
  return line.fromPerson === null ? null : pair(label, personText(line.fromPerson), personText(line.toPerson));
}

/** What the empty side of a change reads as (the same words as the hidden text of EmptyValue). */
const NOT_SET = 'Not set';

const NUMBER_TEXT = /^\d+$/u;
const DISCOUNT_VALUE_TEXT = /^-?\d+(?:\.\d+)?%?$/u;

function dateText(value: string): string | null {
  return formatCalendarDate(value);
}

/** A discount value: "5%" for a percentage (the server ends it with a percent sign), pesos otherwise. */
function discountValueText(value: string): string | null {
  if (!DISCOUNT_VALUE_TEXT.test(value)) return null;
  return value.endsWith('%') ? `${String(Number(value.slice(0, -1)))}%` : formatPeso(value);
}

/**
 * One typed change line as a fixed sentence (D-27, D-31, UI-SPEC A1): amounts in pesos, dates in the Manila style, list entries and
 * people by name. A text field says only that it changed, because its text is never stored in the log (05 D-40). With `stated`, the
 * line gives a value as it was added or removed (see isStatedValueAction), so it has no old value. A value the viewer cannot read
 * gives null and the line is left out.
 */
export function describeAuditChange(line: AuditChangeLine, stated = false): string | null {
  switch (line.field) {
    case 'amount':
      return valuePair('Amount', line, stated, formatPeso);
    case 'unitPrice':
      return valuePair('Unit price', line, stated, formatPeso);
    case 'date':
      return valuePair('Date', line, stated, dateText);
    case 'orderDate':
      return valuePair('Order date', line, stated, dateText);
    case 'dueDate': {
      // An imported order may have had no due date, so the first one is a change from nothing (D-49d).
      if (!stated && line.from === null && line.to !== null) {
        const to = dateText(line.to);
        return to === null ? null : pair('Due date', NOT_SET, to);
      }
      return valuePair('Due date', line, stated, dateText);
    }
    case 'quantity':
      return valuePair('Quantity', line, stated, (value) => (NUMBER_TEXT.test(value) ? value : null));
    case 'status':
      return valuePair('Status', line, stated, (value) => ORDER_STATUS_LABEL.get(value) ?? null);
    case 'kind':
      return valuePair('Discount type', line, stated, (value) => DISCOUNT_KIND_LABEL.get(value) ?? null);
    case 'value':
      return valuePair('Discount value', line, stated, discountValueText);
    case 'category':
      return namePair('Category', DELETED_CATEGORY, line, stated);
    case 'method':
      return namePair('Payment method', 'a deleted payment method', line, stated);
    case 'productType':
      return namePair('Product type', 'a deleted product type', line, stated);
    case 'payer':
      return personPair('Paid by', line, stated);
    case 'receiver':
      return personPair('Received by', line, stated);
    case 'refunder':
      return personPair('Refunded by', line, stated);
    case 'name':
      return line.to === null ? null : pair('Name', line.from, line.to);
    case 'tone': {
      const to = toneText(line.to);
      const from = line.from === null ? null : toneText(line.from);
      return to === null || (line.from !== null && from === null) ? null : pair('Color', from, to);
    }
    default:
      return TEXT_FIELD_SENTENCES.get(line.field) ?? null;
  }
}

/** "Oct 5, 2026 · Utilities · ₱8,642.35 · Paid by Ana Reyes": the facts of an expense an entry names (D-27). */
export function describeAuditSnapshot(snapshot: AuditExpenseSnapshot): string {
  return [
    formatCalendarDate(snapshot.date) ?? snapshot.date,
    categoryText(snapshot.category),
    formatPeso(snapshot.amount),
    snapshot.payer === null ? null : `Paid by ${personText(snapshot.payer)}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** "ORD-2026-0148, Cancelled, total ₱21,327.50, paid ₱12,000.00, balance ₱9,327.50": the facts of an order an entry names (ORD-16). */
export function describeAuditOrderSnapshot(snapshot: AuditOrderSnapshot): string {
  return [
    snapshot.number,
    ORDER_STATUS_LABEL.get(snapshot.status) ?? snapshot.status,
    `total ${formatPeso(snapshot.total)}`,
    `paid ${formatPeso(snapshot.paid)}`,
    `balance ${formatPeso(snapshot.balance)}`,
  ].join(', ');
}

/** One "What changed" sentence: the action and the stored word that give it. */
export interface AuditDetailSentence {
  readonly action: string;
  readonly word: string;
  readonly sentence: string;
}

/**
 * Every "What changed" sentence the viewer can say, read from the same tables as describeAuditDetail, so the owner's wording
 * review (the owner review pack) lists exactly what a screen can show: the field sentences, both role changes and each reason.
 */
export const AUDIT_DETAIL_SENTENCES: readonly AuditDetailSentence[] = [
  ...[...FIELD_SENTENCES.entries()].map(([field, sentence]) => ({
    action: 'user.details-changed',
    word: `${FIELDS_PREFIX}${field}`,
    sentence,
  })),
  ...[
    ['admin', 'manager'],
    ['manager', 'admin'],
  ].map(([from = '', to = '']) => ({
    action: 'user.role-changed',
    word: `role=${from}>${to}`,
    sentence: `Role: ${ROLE_WORDS.get(from) ?? ''} to ${ROLE_WORDS.get(to) ?? ''}`,
  })),
  ...[...REASONS.entries()].flatMap(([action, reasons]) =>
    [...reasons.entries()].map(([word, sentence]) => ({ action, word, sentence })),
  ),
];

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
    'Every sign-in, security, staff account, order and expense change, newest first. Times are Manila time. Entries are kept for 8 months.',
  columns: { when: 'When', doneBy: 'Done by', action: 'Action', doneTo: 'Done to', actions: 'Actions' },
  /** Done by for a failed sign-in with no matching account. */
  unknownAccount: 'Unknown account',
  toggle: {
    show: (action: string, when: string): string => `Show details for ${action}, ${when}`,
    hide: (action: string, when: string): string => `Hide details for ${action}, ${when}`,
  },
  detail: {
    whatChanged: 'What changed',
    order: 'Order',
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
  toolbar: {
    dateRange: 'Date range',
    from: 'From',
    to: 'To',
    doneBy: 'Done by',
    anyone: 'Anyone',
    action: 'Action',
    allActions: 'All actions',
    doneTo: 'Done to',
    loadingStaff: 'Loading staff…',
    system: 'System',
  },
  /** The chips: "Range: Last 30 days", "Done by: Paolo Garcia". */
  chips: { range: 'Range', doneBy: 'Done by', action: 'Action', doneTo: 'Done to' },
  /** The chip value of a person the staff list does not name (a stale link). */
  unknownPerson: 'Unknown person',
  /** The custom range's messages (OR-3): the same rules and words as the server's validator. */
  errors: {
    startRequired: 'Enter a start date.',
    endRequired: 'Enter an end date.',
    notReal: 'Enter a real date.',
    order: 'The start date must be on or before the end date.',
    outsideWindow: (floor: string): string => `Choose a date from ${floor} to today.`,
  },
  /** The no-match sentence's filter part: "range Last 30 days and done by Paolo Garcia". */
  filterSummary: (parts: readonly string[]): string => parts.join(' and '),
  empty: {
    title: 'No entries in the last 7 days',
    message: 'Choose a wider date range to see older entries.',
    showAll: 'Show Everything Kept',
  },
} as const;
