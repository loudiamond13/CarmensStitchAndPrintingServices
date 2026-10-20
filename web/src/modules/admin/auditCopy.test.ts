import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_CODES,
  AUDIT_DETAIL_SENTENCES,
  AUDIT_GROUPS,
  auditActionLabel,
  describeAuditDetail,
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

  it('names the three groups from the UI-SPEC', () => {
    expect(AUDIT_GROUPS).toEqual(['Sign-in and security', 'Staff accounts', 'Profile changes']);
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
