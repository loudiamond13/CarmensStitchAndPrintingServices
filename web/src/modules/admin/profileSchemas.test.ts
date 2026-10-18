// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PasswordRuleFailure } from '@/utils/passwordRules';
import { changeEmailSchema, changePasswordSchema, profileNameSchema } from './profileSchemas';

// The name form's zod mirror (OR-3) of UpdateProfileNameRequestValidator: required after trim, at most 100 UTF-16 units.

function messages(firstName: string, lastName: string): Record<string, string> {
  const result = profileNameSchema.safeParse({ firstName, lastName });
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('profileNameSchema', () => {
  it('accepts two ordinary names and trims them', () => {
    const result = profileNameSchema.parse({ firstName: '  Ana ', lastName: ' Reyes  ' });

    expect(result).toEqual({ firstName: 'Ana', lastName: 'Reyes' });
  });

  it.each([
    ['', 'Enter a first name.'],
    ['   ', 'Enter a first name.'],
    ['\t \n', 'Enter a first name.'],
  ])('refuses a blank first name %j', (firstName, message) => {
    expect(messages(firstName, 'Reyes')).toEqual({ firstName: message });
  });

  it.each([
    ['', 'Enter a last name.'],
    ['   ', 'Enter a last name.'],
  ])('refuses a blank last name %j', (lastName, message) => {
    expect(messages('Ana', lastName)).toEqual({ lastName: message });
  });

  it('reports both names at once, each under its own field', () => {
    expect(messages('', ' ')).toEqual({ firstName: 'Enter a first name.', lastName: 'Enter a last name.' });
  });

  it('accepts exactly 100 characters and refuses 101, for each name', () => {
    expect(messages('a'.repeat(100), 'b'.repeat(100))).toEqual({});
    expect(messages('a'.repeat(101), 'Reyes')).toEqual({ firstName: 'First name must be 100 characters or fewer.' });
    expect(messages('Ana', 'b'.repeat(101))).toEqual({ lastName: 'Last name must be 100 characters or fewer.' });
  });

  it('counts the length after trimming, so 100 characters inside spaces is accepted', () => {
    expect(messages(`  ${'a'.repeat(100)}  `, `${'b'.repeat(100)} `)).toEqual({});
  });

  it('counts UTF-16 code units like the server: 50 emoji pass, 51 do not', () => {
    const fifty = '\u{1F600}'.repeat(50);
    expect(messages(fifty, 'Reyes')).toEqual({});
    expect(messages('\u{1F600}'.repeat(51), 'Reyes')).toEqual({
      firstName: 'First name must be 100 characters or fewer.',
    });
  });

  it('shows the required message, not the length message, for a blank name', () => {
    expect(messages(' '.repeat(150), 'Reyes')).toEqual({ firstName: 'Enter a first name.' });
  });
});

// changeEmailSchema mirrors RequestEmailChangeRequestValidator (PROF-02, OR-3): the new email is required, shaped like an
// address, at most 256 characters and not the current email in any letter case; the current password is required.
// Uniqueness and the password check stay on the server.
describe('changeEmailSchema', () => {
  const CURRENT = 'carmen@example.ph';

  function emailMessages(newEmail: string, currentPassword = 'Mabuhay#Tahi2026'): Record<string, string> {
    const result = changeEmailSchema(CURRENT).safeParse({ newEmail, currentPassword });
    if (result.success) {
      return {};
    }
    return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
  }

  it('accepts a different, well-shaped address and trims it', () => {
    const result = changeEmailSchema(CURRENT).parse({ newEmail: '  ana@example.ph ', currentPassword: 'x' });

    expect(result).toEqual({ newEmail: 'ana@example.ph', currentPassword: 'x' });
  });

  it.each(['', '   '])('refuses a blank new email %j', (value) => {
    expect(emailMessages(value)).toEqual({ newEmail: 'Enter your new email.' });
  });

  it.each(['ana', 'ana@', '@example.ph', 'a@b@c'])('refuses %j as not shaped like an email', (value) => {
    expect(emailMessages(value)).toEqual({ newEmail: 'Enter a valid email, like name@gmail.com' });
  });

  it('accepts exactly 256 characters and refuses 257', () => {
    const at256 = `${'a'.repeat(256 - '@example.ph'.length)}@example.ph`;

    expect(at256).toHaveLength(256);
    expect(emailMessages(at256)).toEqual({});
    expect(emailMessages(`a${at256}`)).toEqual({ newEmail: 'Enter a valid email, like name@gmail.com' });
  });

  it.each(['carmen@example.ph', 'CARMEN@Example.PH', '  Carmen@example.ph  '])(
    'refuses %j as already the current email, ignoring letter case',
    (value) => {
      expect(emailMessages(value)).toEqual({ newEmail: 'This is already your email.' });
    },
  );

  it('requires the current password', () => {
    expect(emailMessages('ana@example.ph', '')).toEqual({ currentPassword: 'Enter your current password.' });
  });

  it('reports both fields at once, each under its own name', () => {
    expect(emailMessages('', '')).toEqual({
      newEmail: 'Enter your new email.',
      currentPassword: 'Enter your current password.',
    });
  });
});

// changePasswordSchema mirrors ChangePasswordRequestValidator and the handler's browser-checkable rules (PROF-03, OR-3):
// the current password is required, the new one meets the shared password policy for this account, the confirmation
// matches, and the new password differs from the current one. The breach lookup and the password check stay on the server.
interface PasswordCase {
  id: string;
  password: string;
  personal: { email: string; firstName: string | null; lastName: string | null } | null;
  mode: 'composition' | 'full';
  expected: 'ok' | PasswordRuleFailure;
}

const shared = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/password-policy-cases.json', import.meta.url), 'utf8'),
) as { messages: Record<PasswordRuleFailure, string>; cases: PasswordCase[] };

const NOBODY = { email: 'nobody@example.test', firstName: null, lastName: null };
const CURRENT_PASSWORD = 'Mabuhay#Tahi2026';
const NEW_PASSWORD = 'Bagong#Landas2027';

function passwordMessages(
  personal: { email: string; firstName: string | null; lastName: string | null },
  values: { currentPassword?: string; newPassword?: string; confirmPassword?: string },
): Record<string, string> {
  const input = {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: values.newPassword ?? NEW_PASSWORD,
    ...values,
  };
  const result = changePasswordSchema(personal).safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('changePasswordSchema', () => {
  it('accepts a good change and returns the three values as typed', () => {
    const values = { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };

    expect(changePasswordSchema(NOBODY).parse(values)).toEqual(values);
  });

  it.each(shared.cases.filter((c) => c.mode === 'full'))(
    'gives the verdict of the shared case $id for this account (password-policy-cases.json)',
    (c) => {
      const found = passwordMessages(c.personal ?? NOBODY, {
        newPassword: c.password,
        currentPassword: 'x-Current-1!',
      });

      expect(found.newPassword).toBe(c.expected === 'ok' ? undefined : shared.messages[c.expected]);
    },
  );

  it.each(shared.cases.filter((c) => c.mode === 'composition'))(
    'gives the verdict of the composition case $id with no personal details',
    (c) => {
      const found = passwordMessages(NOBODY, { newPassword: c.password, currentPassword: 'x-Current-1!' });

      expect(found.newPassword).toBe(c.expected === 'ok' ? undefined : shared.messages[c.expected]);
    },
  );

  it('requires the current password', () => {
    expect(passwordMessages(NOBODY, { currentPassword: '' })).toEqual({
      currentPassword: 'Enter your current password.',
    });
  });

  it('keeps the account name and email out of the new password', () => {
    const personal = { email: 'carmen@example.ph', firstName: 'Carmen', lastName: 'Reyes' };

    expect(passwordMessages(personal, { newPassword: 'Reyes#2027!' })).toEqual({
      newPassword: "Don't use your name or email in your password.",
    });
  });

  it('asks for the new password again when the confirmation is empty', () => {
    expect(passwordMessages(NOBODY, { confirmPassword: '' })).toEqual({
      confirmPassword: 'Enter the new password again.',
    });
  });

  it("says the passwords don't match when the confirmation differs", () => {
    expect(passwordMessages(NOBODY, { confirmPassword: `${NEW_PASSWORD}!` })).toEqual({
      confirmPassword: "Passwords don't match.",
    });
  });

  it('refuses a new password equal to the current one', () => {
    expect(passwordMessages(NOBODY, { newPassword: CURRENT_PASSWORD })).toEqual({
      newPassword: 'Choose a different password from your current one.',
    });
  });

  it('counts a composed and a decomposed letter as the same character when comparing with the current password', () => {
    const composed = 'Piñata#2026';
    const decomposed = 'Piñata#2026';

    expect(passwordMessages(NOBODY, { currentPassword: composed, newPassword: decomposed })).toEqual({
      newPassword: 'Choose a different password from your current one.',
    });
  });

  it('shows the rule failure, not the same-password message, when the new password breaks a rule', () => {
    expect(passwordMessages(NOBODY, { currentPassword: 'short', newPassword: 'short' })).toEqual({
      newPassword: 'Use at least 8 characters.',
    });
  });

  it('reports the required messages together, each under its own field', () => {
    expect(passwordMessages(NOBODY, { currentPassword: '', newPassword: '', confirmPassword: '' })).toEqual({
      currentPassword: 'Enter your current password.',
      newPassword: 'Enter a new password.',
      confirmPassword: 'Enter the new password again.',
    });
  });
});
