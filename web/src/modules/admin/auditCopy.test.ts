import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_CODES,
  AUDIT_DETAIL_SENTENCES,
  AUDIT_GROUPS,
  auditActionLabel,
  describeAuditChange,
  describeAuditDetail,
  describeAuditSnapshot,
} from './auditCopy';

// The audit viewer's words (AUDIT-02, D-28, D-40): a label and a group for every action the API can send, and the
// "What changed" text built only from the fixed words the log stores.

/** AuditActions.All in the backend (Csps.Domain.Auditing), in its order. */
const API_ACTIONS = [
  'auth.sign-in-failed',
  'auth.lockout',
  'auth.2fa-issued',
  'auth.2fa-resent',
  'auth.2fa-verified',
  'auth.2fa-failed',
  'auth.2fa-exhausted',
  'auth.signed-in',
  'auth.refresh-reuse-detected',
  'auth.signed-out',
  'auth.sessions-revoked',
  'auth.session-revoked',
  'auth.password-reset-requested',
  'auth.password-reset-completed',
  'auth.password-reset-link-invalid',
  'auth.password-changed',
  'auth.password-breach-found',
  'auth.breach-check-unavailable',
  'auth.invite-accepted',
  'user.bootstrap-manager-created',
  'user.invited',
  'user.created-temporary',
  'user.deactivated',
  'user.activated',
  'user.locked',
  'user.unlocked',
  'user.deleted',
  'user.details-changed',
  'user.role-changed',
  'user.email-change-started',
  'user.invitation-resent',
  'user.reset-link-sent',
  'user.temporary-password-set',
  'profile.name-changed',
  'profile.email-change-requested',
  'profile.email-changed',
  'profile.email-change-canceled',
  'company-expense.added',
  'company-expense.changed',
  'company-expense.payer-changed',
  'company-expense.deleted',
  'company-expense.restored',
  'company-expense.permanently-deleted',
  'expense-category.added',
  'expense-category.renamed',
  'expense-category.recolored',
  'expense-category.retired',
  'expense-category.reactivated',
  'expense-category.deleted',
] as const;

describe('the action labels (D-28)', () => {
  it('has a label and a group for every code the API can send, and no other', () => {
    expect([...AUDIT_ACTION_CODES].sort()).toEqual([...API_ACTIONS].sort());
    for (const code of API_ACTIONS) {
      const entry = AUDIT_ACTIONS.find((action) => action.code === code);
      expect(entry?.label, code).toBeTruthy();
      expect(AUDIT_GROUPS, code).toContain(entry?.group);
    }
  });

  it('uses the UI-SPEC labels', () => {
    expect(auditActionLabel('auth.signed-in')).toBe('Signed in');
    expect(auditActionLabel('auth.lockout')).toBe('Sign-in paused after too many tries');
    expect(auditActionLabel('user.deactivated')).toBe('User deactivated');
    expect(auditActionLabel('user.created-temporary')).toBe('User created with a temporary password');
    expect(auditActionLabel('user.invitation-resent')).toBe('Invitation sent again');
    expect(auditActionLabel('profile.email-changed')).toBe('Email changed');
    expect(auditActionLabel('profile.email-change-canceled')).toBe('Email change canceled');
  });

  it('names the five groups from the UI-SPEC', () => {
    expect(AUDIT_GROUPS).toEqual([
      'Sign-in and security',
      'Staff accounts',
      'Profile changes',
      'Company expenses',
      'Expense categories',
    ]);
  });

  it('uses the UI-SPEC labels of the expense and category events', () => {
    expect(auditActionLabel('company-expense.changed')).toBe('Expense changed');
    expect(auditActionLabel('company-expense.payer-changed')).toBe('Expense payer changed');
  });

  it('shows the key itself when the action is unknown', () => {
    expect(auditActionLabel('orders.archived')).toBe('orders.archived');
  });

  it('never repeats a label, so two actions cannot read the same', () => {
    const labels = AUDIT_ACTIONS.map((action) => action.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('describeAuditDetail (D-40)', () => {
  it('reads changed name fields as "Name changed"', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=first-name')).toBe('Name changed');
    expect(describeAuditDetail('user.details-changed', 'fields=first-name,last-name')).toBe('Name changed');
    expect(describeAuditDetail('profile.name-changed', 'fields=last-name')).toBe('Name changed');
  });

  it('reads a changed email as "Email changed"', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=email')).toBe('Email changed');
  });

  it('reads name and email together, each once', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=first-name,email')).toBe('Name changed. Email changed');
  });

  it('reads a role change as "Role: Admin to Manager"', () => {
    expect(describeAuditDetail('user.role-changed', 'role=admin>manager')).toBe('Role: Admin to Manager');
    expect(describeAuditDetail('user.role-changed', 'role=manager>admin')).toBe('Role: Manager to Admin');
  });

  it('reads the words of a resent link and a taken address', () => {
    expect(describeAuditDetail('profile.email-change-requested', 'resent')).toBe('Link sent again');
    expect(describeAuditDetail('profile.email-change-canceled', 'taken')).toBe('That address was taken');
  });

  it('reads the stored reasons of sign-in, lockout, reset and revoked sessions', () => {
    expect(describeAuditDetail('auth.sign-in-failed', 'bad-password')).toBe('Wrong password');
    expect(describeAuditDetail('auth.sign-in-failed', 'unknown-account')).toBe('No account with that email');
    expect(describeAuditDetail('auth.lockout', 'code')).toBe('Too many wrong sign-in codes');
    expect(describeAuditDetail('auth.password-reset-requested', 'capped')).toBe('Too many requests this hour');
    expect(describeAuditDetail('auth.sessions-revoked', 'account-changed')).toBe('The account was changed');
    expect(describeAuditDetail('user.invited', 'manager')).toBe('Invited by a Manager');
  });

  it('gives null when there is no detail or the words are not known', () => {
    expect(describeAuditDetail('user.deactivated', null)).toBeNull();
    expect(describeAuditDetail('user.deactivated', '')).toBeNull();
    expect(describeAuditDetail('user.details-changed', 'fields=shoe-size')).toBeNull();
    expect(describeAuditDetail('user.role-changed', 'role=owner>manager')).toBeNull();
    expect(describeAuditDetail('user.role-changed', 'Role: Carmen to Paolo')).toBeNull();
    expect(describeAuditDetail('orders.archived', 'anything')).toBeNull();
  });

  it('never returns text with an @, even from a stored value that holds an email', () => {
    const stored = ['fields=carmen@example.ph', 'role=carmen@example.ph>manager', 'carmen@example.ph', 'taken@x.y'];
    for (const detail of stored) {
      for (const action of API_ACTIONS) {
        expect(describeAuditDetail(action, detail) ?? '').not.toContain('@');
      }
    }
  });
});

const NO_PEOPLE = { fromPerson: null, toPerson: null } as const;

describe('describeAuditChange (D-27)', () => {
  it('reads an amount change in pesos', () => {
    expect(describeAuditChange({ field: 'amount', from: '1200.00', to: '1250.00', ...NO_PEOPLE })).toBe(
      'Amount: ₱1,200.00 to ₱1,250.00',
    );
  });

  it('reads a changed description as the fixed sentence, never as text', () => {
    expect(describeAuditChange({ field: 'description', from: null, to: null, ...NO_PEOPLE })).toBe(
      'Description changed',
    );
  });
});

describe('describeAuditChange for every field (D-27, UI-SPEC A1)', () => {
  const change = (field: string, from: string | null, to: string | null) => ({ field, from, to, ...NO_PEOPLE });

  it('reads dates, categories, notes, names and colors', () => {
    expect(describeAuditChange(change('date', '2026-10-05', '2026-10-06'))).toBe('Date: Oct 5, 2026 to Oct 6, 2026');
    expect(describeAuditChange(change('category', 'Supplies', 'Equipment'))).toBe('Category: Supplies to Equipment');
    expect(describeAuditChange(change('notes', null, null))).toBe('Notes changed');
    expect(describeAuditChange(change('name', 'Supplies', 'Office supplies'))).toBe(
      'Name: Supplies to Office supplies',
    );
    expect(describeAuditChange(change('tone', 'warning', 'success'))).toBe('Color: Amber to Green');
  });

  it('names a category that is gone as "a deleted category"', () => {
    expect(describeAuditChange(change('category', null, 'Equipment'))).toBe(
      'Category: a deleted category to Equipment',
    );
    expect(describeAuditChange(change('category', 'Supplies', null))).toBe('Category: Supplies to a deleted category');
  });

  it('reads a payer change by name and marks former staff', () => {
    const ana = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Reyes', formerStaff: false };
    const bea = { id: '22222222-2222-4222-8222-222222222222', name: 'Bea Navarro', formerStaff: true };

    expect(describeAuditChange({ field: 'payer', from: null, to: null, fromPerson: ana, toPerson: bea })).toBe(
      'Paid by: Ana Reyes to Bea Navarro (former staff)',
    );
  });

  it('reads a single name or color of an added or retired category', () => {
    expect(describeAuditChange(change('name', null, 'Fuel'))).toBe('Name: Fuel');
    expect(describeAuditChange(change('tone', null, 'info'))).toBe('Color: Blue');
  });

  it('leaves out a line it cannot read', () => {
    expect(describeAuditChange(change('tone', 'warning', 'purple'))).toBeNull();
    expect(describeAuditChange(change('date', 'soon', 'later'))).toBeNull();
    expect(describeAuditChange(change('amount', null, '5.00'))).toBeNull();
    expect(describeAuditChange(change('shoe-size', 'a', 'b'))).toBeNull();
  });

  it('never returns text from a description or notes line, even if the server sent some', () => {
    expect(describeAuditChange(change('description', 'Private order 7731', 'Another'))).toBe('Description changed');
    expect(describeAuditChange(change('notes', 'Call him', 'Call her'))).toBe('Notes changed');
  });
});

describe('describeAuditSnapshot (D-27)', () => {
  it('names a gone category and leaves out a payer nobody can name', () => {
    expect(describeAuditSnapshot({ date: '2026-10-05', category: null, amount: '12.50', payer: null })).toBe(
      'Oct 5, 2026 · a deleted category · ₱12.50',
    );
  });

  it('reads the facts of an added expense on one line', () => {
    expect(
      describeAuditSnapshot({
        date: '2026-10-05',
        category: 'Utilities',
        amount: 8642.35,
        payer: { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Ana Reyes', formerStaff: false },
      }),
    ).toBe('Oct 5, 2026 · Utilities · ₱8,642.35 · Paid by Ana Reyes');
  });
});

describe('AUDIT_DETAIL_SENTENCES (the list the owner reviews the "What changed" words from, plan 05-37)', () => {
  it('holds every sentence describeAuditDetail can say for a stored word, and says it the same way', () => {
    expect(AUDIT_DETAIL_SENTENCES.length).toBeGreaterThan(20);
    for (const { action, word, sentence } of AUDIT_DETAIL_SENTENCES) {
      expect(describeAuditDetail(action, word), `${action} ${word}`).toBe(sentence);
    }
  });

  it('includes the field, role and reason sentences, each action known to the viewer', () => {
    const sentences = AUDIT_DETAIL_SENTENCES.map((entry) => entry.sentence);

    expect(sentences).toEqual(
      expect.arrayContaining([
        'Name changed',
        'Email changed',
        'Role: Admin to Manager',
        'Wrong password',
        'Link sent again',
      ]),
    );
    for (const { action } of AUDIT_DETAIL_SENTENCES) {
      expect(AUDIT_ACTION_CODES).toContain(action);
    }
  });
});
