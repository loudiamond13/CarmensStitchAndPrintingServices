// The words of the Audit Log (UI-SPEC Copywriting Contract, A1; AUDIT-02, D-26..D-29, D-40; plan 05-33): one module, no wording
// in JSX. The page strings and the action labels are SPEC-GAP wording that the owner reviews before approving it (D-48). The
// labels cover every action code the API can send, including the ones added after the UI-SPEC table (D-28). No long dash (OR-4).

import { RECORD_META_COPY } from '@/components/data';
import { CATEGORY_TONE_LABEL, isCategoryTone } from '@/components/status';
import type { components } from '@/types/api.generated';
import { formatPeso } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';

/** The groups of the Action select, in the order the UI-SPEC lists them (A1; the two expense groups are Phase 6, the two order groups Phase 7, Site content Phase 11). */
export const AUDIT_GROUPS = [
  'Sign-in and security',
  'Staff accounts',
  'Profile changes',
  'Company expenses',
  'Expense categories',
  'Orders',
  'Order lists',
  'Staff money',
  'Site content',
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
const STAFF_MONEY = AUDIT_GROUPS[7];
const SITE_CONTENT = AUDIT_GROUPS[8];

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
  { code: 'order-item.added', label: 'Order item added', group: ORDERS },
  { code: 'order-item.changed', label: 'Order item changed', group: ORDERS },
  { code: 'order-item.removed', label: 'Order item removed', group: ORDERS },
  { code: 'order-payment.added', label: 'Order payment added', group: ORDERS },
  { code: 'order-payment.changed', label: 'Order payment changed', group: ORDERS },
  { code: 'order-payment.receiver-changed', label: 'Order payment receiver changed', group: ORDERS },
  { code: 'order-payment.removed', label: 'Order payment removed', group: ORDERS },
  { code: 'order-refund.added', label: 'Order refund added', group: ORDERS },
  { code: 'order-refund.changed', label: 'Order refund changed', group: ORDERS },
  { code: 'order-refund.refunder-changed', label: 'Order refunder changed', group: ORDERS },
  { code: 'order-refund.removed', label: 'Order refund removed', group: ORDERS },
  { code: 'order-discount.added', label: 'Order discount added', group: ORDERS },
  { code: 'order-discount.changed', label: 'Order discount changed', group: ORDERS },
  { code: 'order-discount.removed', label: 'Order discount removed', group: ORDERS },
  { code: 'order-expense.added', label: 'Order expense added', group: ORDERS },
  { code: 'order-expense.changed', label: 'Order expense changed', group: ORDERS },
  { code: 'order-expense.payer-changed', label: 'Order expense payer changed', group: ORDERS },
  { code: 'order-expense.removed', label: 'Order expense removed', group: ORDERS },
  { code: 'order-image.added', label: 'Order photo added', group: ORDERS },
  { code: 'order-image.moved', label: 'Order photo moved', group: ORDERS },
  { code: 'order-image.cover-changed', label: 'Order cover photo changed', group: ORDERS },
  { code: 'order-image.description-changed', label: 'Order photo description changed', group: ORDERS },
  { code: 'order-image.deleted', label: 'Order photo deleted', group: ORDERS },
  { code: 'order.public-consent-recorded', label: 'Customer OK to show recorded', group: ORDERS },
  { code: 'order.public-consent-removed', label: 'Customer OK to show removed', group: ORDERS },
  { code: 'order.shown-on-website', label: 'Order shown on the website', group: ORDERS },
  { code: 'order.taken-off-website', label: 'Order taken off the website', group: ORDERS },
  { code: 'order.public-details-changed', label: 'Order public details changed', group: ORDERS },
  { code: 'quote-request.status-changed', label: 'Quote request status changed', group: ORDERS },
  { code: 'quote-request.note-added', label: 'Quote request note added', group: ORDERS },
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
  { code: 'money-transfer.added', label: 'Money transfer added', group: STAFF_MONEY },
  { code: 'money-transfer.deleted', label: 'Money transfer deleted', group: STAFF_MONEY },
  { code: 'money-transfer.permanently-deleted', label: 'Money transfer removed permanently', group: STAFF_MONEY },
  { code: 'money-transfer.handed-over', label: 'Money handed over', group: STAFF_MONEY },
  { code: 'site-settings.changed', label: 'Site settings changed', group: SITE_CONTENT },
  { code: 'site-settings.share-picture-changed', label: 'Link preview picture changed', group: SITE_CONTENT },
  { code: 'quote-alerts.test-sent', label: 'Quote alerts test email sent', group: SITE_CONTENT },
  { code: 'opening-hours.changed', label: 'Opening hours changed', group: SITE_CONTENT },
  { code: 'shop-closure.added', label: 'Closure added', group: SITE_CONTENT },
  { code: 'shop-closure.changed', label: 'Closure changed', group: SITE_CONTENT },
  { code: 'shop-closure.deleted', label: 'Closure deleted', group: SITE_CONTENT },
  { code: 'product-line.added', label: 'Product line added', group: SITE_CONTENT },
  { code: 'product-line.changed', label: 'Product line changed', group: SITE_CONTENT },
  { code: 'product-line.moved', label: 'Product line moved', group: SITE_CONTENT },
  { code: 'product-line.hidden', label: 'Product line hidden', group: SITE_CONTENT },
  { code: 'product-line.shown', label: 'Product line shown', group: SITE_CONTENT },
  { code: 'product-line.deleted', label: 'Product line deleted', group: SITE_CONTENT },
  { code: 'product-line.photo-changed', label: 'Product line photo changed', group: SITE_CONTENT },
  { code: 'product-type.line-linked', label: 'Order product type linked to a product line', group: SITE_CONTENT },
  { code: 'testimonial.added', label: 'Testimonial added', group: SITE_CONTENT },
  { code: 'testimonial.changed', label: 'Testimonial changed', group: SITE_CONTENT },
  { code: 'testimonial.moved', label: 'Testimonial moved', group: SITE_CONTENT },
  { code: 'testimonial.hidden', label: 'Testimonial hidden', group: SITE_CONTENT },
  { code: 'testimonial.shown', label: 'Testimonial shown', group: SITE_CONTENT },
  { code: 'testimonial.deleted', label: 'Testimonial deleted', group: SITE_CONTENT },
  { code: 'gallery-photo.added', label: 'Gallery photo added', group: SITE_CONTENT },
  { code: 'gallery-photo.changed', label: 'Gallery photo changed', group: SITE_CONTENT },
  { code: 'gallery-item.moved', label: 'Gallery item moved', group: SITE_CONTENT },
  { code: 'gallery-photo.hidden', label: 'Gallery photo hidden', group: SITE_CONTENT },
  { code: 'gallery-photo.shown', label: 'Gallery photo shown', group: SITE_CONTENT },
  { code: 'gallery-photo.deleted', label: 'Gallery photo deleted', group: SITE_CONTENT },
];

/** The codes the Action filter accepts in the URL. */
export const AUDIT_ACTION_CODES: readonly string[] = AUDIT_ACTIONS.map((action) => action.code);

const LABELS: ReadonlyMap<string, string> = new Map(AUDIT_ACTIONS.map((action) => [action.code, action.label]));

const GROUP_OF: ReadonlyMap<string, AuditGroup> = new Map(AUDIT_ACTIONS.map((action) => [action.code, action.group]));

/** The group an action belongs to, or null for a code the viewer does not know. */
export function auditActionGroup(code: string): AuditGroup | null {
  return GROUP_OF.get(code) ?? null;
}

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
  const siteContent = SITE_CONTENT_DETAIL.get(action);
  if (siteContent !== undefined) {
    const sentences = siteContent(parseDetailParts(detail));
    return sentences.length === 0 ? null : sentences.join('. ');
  }
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

/** What a change to a field the viewer does not know reads as. Its name and values are never shown (D-84). */
const OTHER_DETAIL_CHANGED = 'Other detail changed';

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

/** The line for a value that cannot be read: it says the field changed and never shows the stored value. */
function changedOnly(label: string): string {
  return `${label} changed`;
}

/**
 * A line with a value on each side. A stated value (an added or removed entry) needs only the new side; a change needs both. A
 * value the formatter cannot read gives "<Label> changed".
 */
function valuePair(
  label: string,
  line: AuditChangeLine,
  stated: boolean,
  format: (value: string) => string | null,
): string {
  const to = line.to === null ? null : format(line.to);
  if (to === null) return changedOnly(label);
  if (stated) return pair(label, null, to);
  const from = line.from === null ? null : format(line.from);
  return from === null ? changedOnly(label) : pair(label, from, to);
}

/** A line whose sides are list entry names; a side with no name is an entry that has been deleted. */
function namePair(label: string, deleted: string, line: AuditChangeLine, stated: boolean): string {
  const to = line.to ?? deleted;
  return stated ? pair(label, null, to) : pair(label, line.from ?? deleted, to);
}

/** A line whose sides are people. A stated value needs only the new person; a change needs both, else `fallback` is the line. */
function personPair(label: string, fallback: string, line: AuditChangeLine, stated: boolean): string {
  if (line.toPerson === null) return fallback;
  if (stated) return pair(label, null, personText(line.toPerson));
  return line.fromPerson === null ? fallback : pair(label, personText(line.fromPerson), personText(line.toPerson));
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
 * gives "<Field> changed", and a field the viewer does not know gives "Other detail changed" (D-84).
 */
export function describeAuditChange(line: AuditChangeLine, stated = false): string {
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
        return to === null ? changedOnly('Due date') : pair('Due date', NOT_SET, to);
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
      return personPair('Paid by', 'Payer changed', line, stated);
    case 'receiver':
      return personPair('Received by', 'Receiver changed', line, stated);
    case 'refunder':
      return personPair('Refunded by', 'Refunder changed', line, stated);
    case 'name':
      return line.to === null ? changedOnly('Name') : pair('Name', line.from, line.to);
    case 'tone': {
      const to = toneText(line.to);
      const from = line.from === null ? null : toneText(line.from);
      return to === null || (line.from !== null && from === null) ? changedOnly('Color') : pair('Color', from, to);
    }
    default:
      return TEXT_FIELD_SENTENCES.get(line.field) ?? OTHER_DETAIL_CHANGED;
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

/** One `key=value` or `key=old>new` pair of a stored site content detail, with its percent escapes undone (AUDIT-01). */
interface DetailPart {
  readonly key: string;
  /** The old value of a change; null for a single value. */
  readonly from: string | null;
  readonly to: string;
}

const DETAIL_ESCAPES: ReadonlyMap<string, string> = new Map([
  ['%25', '%'],
  ['%3B', ';'],
  ['%3D', '='],
  ['%3E', '>'],
]);

function decodeDetailText(text: string): string {
  return text.replace(/%(?:25|3B|3D|3E)/gu, (escape) => DETAIL_ESCAPES.get(escape) ?? escape);
}

/** Reads a stored detail into its pairs. A part with no "=" is skipped. */
function parseDetailParts(detail: string): DetailPart[] {
  const parts: DetailPart[] = [];
  for (const part of detail.split(';')) {
    const equals = part.indexOf('=');
    if (equals <= 0) continue;
    const value = part.slice(equals + 1);
    const arrow = value.indexOf('>');
    parts.push({
      key: part.slice(0, equals),
      from: arrow < 0 ? null : decodeDetailText(value.slice(0, arrow)),
      to: decodeDetailText(arrow < 0 ? value : value.slice(arrow + 1)),
    });
  }
  return parts;
}

/** Reads one stored value as text; null when it cannot be shown. A value that is an email address is never shown (D-25). */
type ValueFormat = (value: string) => string | null;

const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.]+/u;
const PRICE_TEXT = /^\d+(?:\.\d+)?$/u;
const HOURS_TEXT = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/u;

const asText: ValueFormat = (value) => (EMAIL_LIKE.test(value) ? null : value);
const asPeso: ValueFormat = (value) => (PRICE_TEXT.test(value) ? formatPeso(value) : null);
const asNumber: ValueFormat = (value) => (NUMBER_TEXT.test(value) ? value : null);

function clockText(hours: string, minutes: string): string {
  const hour = Number(hours);
  return `${String(hour % 12 === 0 ? 12 : hour % 12)}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "closed" as "Closed", "09:00-18:00" as "9:00 AM - 6:00 PM". */
const asHours: ValueFormat = (value) => {
  if (value === 'closed') return 'Closed';
  const match = HOURS_TEXT.exec(value);
  return match === null
    ? null
    : `${clockText(match[1] ?? '', match[2] ?? '')} - ${clockText(match[3] ?? '', match[4] ?? '')}`;
};

/** "Label: old to new" for a change pair; an empty side reads "Not set". A side that cannot be read gives "<Label> changed". */
function changeSentence(label: string, part: DetailPart, format: ValueFormat): string {
  const side = (value: string): string | null => (value === '' ? NOT_SET : format(value));
  const from = part.from === null ? null : side(part.from);
  const to = side(part.to);
  return from === null || to === null ? changedOnly(label) : pair(label, from, to);
}

/** "Label: value" for a single value, as a list of one; empty when the value is empty or cannot be shown. */
function valueSentence(label: string, part: DetailPart | undefined, format: ValueFormat): string[] {
  if (part?.from !== null || part.to === '') return [];
  const text = format(part.to);
  return text === null ? [] : [`${label}: ${text}`];
}

function findPart(parts: readonly DetailPart[], key: string): DetailPart | undefined {
  return parts.find((part) => part.key === key);
}

/** A change pair as one sentence; empty when the entry holds no pair under that key. */
function changeOf(parts: readonly DetailPart[], key: string, label: string, format: ValueFormat): string[] {
  const part = findPart(parts, key);
  if (part === undefined) return [];
  return part.from === null ? [] : [changeSentence(label, part, format)];
}

/** How one named field reads: "<Label> changed", or the old and new value when the log stores them under `pair`. */
interface FieldRule {
  readonly label: string;
  readonly pair?: string | undefined;
  readonly format?: ValueFormat | undefined;
  /** The sentence when the log names the field with no values; "<Label> changed" when left out. */
  readonly changed?: string | undefined;
}

/** A field the log names and never copies (a long text, an email, phone numbers). */
const named = (label: string): FieldRule => ({ label });

/** A short value the log stores as old and new under the key `pairKey`. */
const shown = (label: string, pairKey: string, format: ValueFormat = asText): FieldRule => ({
  label,
  pair: pairKey,
  format,
});

const SITE_SETTINGS_FIELDS: ReadonlyMap<string, FieldRule> = new Map([
  ['businessName', shown('Business name', 'businessName')],
  ['tagline', named('Tagline')],
  ['aboutText', named('About text')],
  ['turnaroundLine', named('Turnaround line')],
  ['street', named('Street')],
  ['townOrCity', named('Town or city')],
  ['province', named('Province')],
  ['postalCode', named('Postal code')],
  ['directionsUrl', shown('Directions link', 'directionsUrl')],
  ['mapEmbedUrl', shown('Map link', 'mapEmbedUrl')],
  ['messengerUrl', shown('Messenger link', 'messengerUrl')],
  ['facebookUrl', shown('Facebook link', 'facebookUrl')],
  ['instagramUrl', shown('Instagram link', 'instagramUrl')],
  ['tiktokUrl', shown('TikTok link', 'tiktokUrl')],
  ['contactEmail', named('Shop email')],
  ['quoteAlertsEmail', named('Quote alerts email')],
  ['phones', named('Phone numbers')],
]);

const PRODUCT_LINE_FIELDS: ReadonlyMap<string, FieldRule> = new Map([
  ['title', shown('Title', 'title')],
  ['shortName', shown('Short name', 'shortName')],
  ['number', named('Number')],
  ['cardText', named('Card text')],
  ['description', named('Description')],
  ['fabricText', named('Fabric text')],
  ['collarText', named('Collar text')],
  ['cutText', named('Cut text')],
  ['namesText', named('Names text')],
  ['logosText', named('Logos text')],
  ['startsAtPrice', shown('Starts-at price', 'price', asPeso)],
  ['minimumQuantity', shown('Minimum quantity', 'minimum', asNumber)],
]);

const TESTIMONIAL_FIELDS: ReadonlyMap<string, FieldRule> = new Map([
  ['quote', named('Quote')],
  ['name', shown('Name', 'name')],
  ['teamOrRole', named('Team or role')],
  ['stars', shown('Stars', 'stars', asNumber)],
]);

const GALLERY_FIELDS: ReadonlyMap<string, FieldRule> = new Map([
  ['team', shown('Team', 'team')],
  ['line', shown('Product line', 'line')],
  ['pieces', named('Pieces')],
  ['note', named('Note')],
  ['photo', { label: 'Photo', changed: 'Photo replaced' }],
]);

const CLOSURE_FIELDS: ReadonlyMap<string, FieldRule> = new Map([['note', named('Note')]]);

const ORDER_PUBLIC_FIELDS: ReadonlyMap<string, FieldRule> = new Map([
  ['line', named('Product line')],
  ['name', named('Name shown')],
]);

/** The sentences of a `fields=` pair: each named field reads by its rule, a field with no rule as "Other detail changed". */
function fieldSentences(parts: readonly DetailPart[], rules: ReadonlyMap<string, FieldRule>): string[] {
  const list = parts.find((part) => part.key === 'fields' && part.from === null);
  if (list === undefined) return [];
  const sentences: string[] = [];
  for (const field of list.to.split(',')) {
    const rule = rules.get(field);
    const change =
      rule?.pair === undefined ? undefined : parts.find((part) => part.key === rule.pair && part.from !== null);
    const sentence =
      rule === undefined
        ? OTHER_DETAIL_CHANGED
        : change === undefined
          ? (rule.changed ?? changedOnly(rule.label))
          : changeSentence(rule.label, change, rule.format ?? asText);
    if (!sentences.includes(sentence)) sentences.push(sentence);
  }
  return sentences;
}

const DAY_NAMES: ReadonlyMap<string, string> = new Map([
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
]);

const SHARE_PICTURE_SENTENCES: ReadonlyMap<string, string> = new Map([
  ['added', 'Picture added'],
  ['replaced', 'Picture replaced'],
  ['removed', 'Picture removed'],
]);

const PHOTO_SLOT_LABELS: ReadonlyMap<string, string> = new Map([
  ['main', 'Main photo'],
  ['back', 'Back photo'],
  ['fabric', 'Fabric photo'],
]);

const PHOTO_CHANGE_WORDS: ReadonlySet<string> = new Set(['added', 'replaced', 'removed']);

/** "Closed on Dec 25, 2026" or "Closed Dec 24, 2026 to Dec 26, 2026"; empty when the entry holds no days. */
function closureRange(parts: readonly DetailPart[]): string[] {
  const first = findPart(parts, 'first');
  const last = findPart(parts, 'last');
  if (first === undefined || last === undefined) return [];
  const from = dateText(first.to);
  const to = dateText(last.to);
  if (from === null || to === null) return [];
  return [from === to ? `Closed on ${from}` : `Closed ${from} to ${to}`];
}

const placeOf = (parts: readonly DetailPart[]): string[] => changeOf(parts, 'position', 'Place', asNumber);

type DetailReader = (parts: readonly DetailPart[]) => string[];

const lineNamed: DetailReader = (parts) => valueSentence('Product line', findPart(parts, 'title'), asText);

/**
 * How each Phase 11 entry's stored detail reads (UI-SPEC Audit log; 06 D-27). Each reader says what the item is and what changed,
 * with old and new values for short public values (names, prices, hours, places) and only the fact of a change for a quote, a note,
 * a long text, the shop email or the phone numbers.
 */
const SITE_CONTENT_DETAIL: ReadonlyMap<string, DetailReader> = new Map<string, DetailReader>([
  ['site-settings.changed', (parts) => fieldSentences(parts, SITE_SETTINGS_FIELDS)],
  [
    'site-settings.share-picture-changed',
    (parts) => {
      const sentence = SHARE_PICTURE_SENTENCES.get(findPart(parts, 'change')?.to ?? '');
      return sentence === undefined ? [] : [sentence];
    },
  ],
  ['opening-hours.changed', (parts) => [...DAY_NAMES].flatMap(([key, label]) => changeOf(parts, key, label, asHours))],
  ...['shop-closure.added', 'shop-closure.changed', 'shop-closure.deleted'].map((action): [string, DetailReader] => [
    action,
    (parts) => [
      ...closureRange(parts),
      ...changeOf(parts, 'first', 'First day', dateText),
      ...changeOf(parts, 'last', 'Last day', dateText),
      ...fieldSentences(parts, CLOSURE_FIELDS),
    ],
  ]),
  ...['product-line.added', 'product-line.hidden', 'product-line.shown', 'product-line.deleted'].map(
    (action): [string, DetailReader] => [action, lineNamed],
  ),
  ['product-line.changed', (parts) => fieldSentences(parts, PRODUCT_LINE_FIELDS)],
  ['product-line.moved', (parts) => [...lineNamed(parts), ...placeOf(parts)]],
  [
    'product-line.photo-changed',
    (parts) => {
      const slot = PHOTO_SLOT_LABELS.get(findPart(parts, 'slot')?.to ?? '') ?? 'Photo';
      const change = findPart(parts, 'change')?.to ?? '';
      return [...lineNamed(parts), ...(PHOTO_CHANGE_WORDS.has(change) ? [`${slot} ${change}`] : [])];
    },
  ],
  ['product-type.line-linked', (parts) => changeOf(parts, 'line', 'Product line', asText)],
  ...['testimonial.added', 'testimonial.hidden', 'testimonial.shown', 'testimonial.deleted'].map(
    (action): [string, DetailReader] => [
      action,
      (parts) => valueSentence('Testimonial', findPart(parts, 'name'), asText),
    ],
  ),
  ['testimonial.changed', (parts) => fieldSentences(parts, TESTIMONIAL_FIELDS)],
  [
    'testimonial.moved',
    (parts) => [...valueSentence('Testimonial', findPart(parts, 'name'), asText), ...placeOf(parts)],
  ],
  ...['gallery-photo.added', 'gallery-photo.hidden', 'gallery-photo.shown', 'gallery-photo.deleted'].map(
    (action): [string, DetailReader] => [
      action,
      (parts) => [
        ...valueSentence('Team', findPart(parts, 'team'), asText),
        ...valueSentence('Product line', findPart(parts, 'line'), asText),
      ],
    ],
  ),
  ['gallery-photo.changed', (parts) => fieldSentences(parts, GALLERY_FIELDS)],
  [
    'gallery-item.moved',
    (parts) => [...valueSentence('Gallery item', findPart(parts, 'name'), asText), ...placeOf(parts)],
  ],
  ['order.public-details-changed', (parts) => fieldSentences(parts, ORDER_PUBLIC_FIELDS)],
  // The order number is already the Order line of the entry, so these four have no What changed line.
  ['order.public-consent-recorded', () => []],
  ['order.public-consent-removed', () => []],
  ['order.shown-on-website', () => []],
  ['order.taken-off-website', () => []],
]);

/** The actions whose `fields=` words are fixed, with the rules that read them. */
const FIELD_RULES_BY_ACTION: readonly (readonly [string, ReadonlyMap<string, FieldRule>])[] = [
  ['site-settings.changed', SITE_SETTINGS_FIELDS],
  ['product-line.changed', PRODUCT_LINE_FIELDS],
  ['testimonial.changed', TESTIMONIAL_FIELDS],
  ['gallery-photo.changed', GALLERY_FIELDS],
  ['shop-closure.added', CLOSURE_FIELDS],
  ['shop-closure.changed', CLOSURE_FIELDS],
  ['order.public-details-changed', ORDER_PUBLIC_FIELDS],
];

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
  ...FIELD_RULES_BY_ACTION.flatMap(([action, rules]) =>
    [...rules.entries()].map(([field, rule]) => ({
      action,
      word: `${FIELDS_PREFIX}${field}`,
      sentence: rule.changed ?? changedOnly(rule.label),
    })),
  ),
  ...[...SHARE_PICTURE_SENTENCES.entries()].map(([change, sentence]) => ({
    action: 'site-settings.share-picture-changed',
    word: `change=${change}`,
    sentence,
  })),
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
  columns: { when: 'When', doneBy: 'Done by', action: 'Action', doneTo: 'Done to', order: 'Order', actions: 'Actions' },
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
    group: 'Group',
    allGroups: 'All groups',
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
