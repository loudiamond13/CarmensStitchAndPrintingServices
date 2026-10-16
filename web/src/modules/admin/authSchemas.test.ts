// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import type { PasswordRuleFailure } from '@/utils/passwordRules';
import { forgotSchema, isEmailShaped, newPasswordSchema, signInSchema, verifySchema } from './authSchemas';

// signInSchema mirrors SignInRequestValidator (OR-3): the same rules and the same words.

function messages(input: { email: string; password: string }): Record<string, string> {
  const result = signInSchema.safeParse({ ...input, keepSignedIn: false });
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('signInSchema', () => {
  it('accepts a normal sign-in and trims the email', () => {
    const result = signInSchema.safeParse({
      email: '  paolo.garcia@gmail.com ',
      password: 'tahi2026',
      keepSignedIn: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'paolo.garcia@gmail.com', password: 'tahi2026', keepSignedIn: true });
  });

  it.each(['', '   '])('asks for the email when it is empty (%j)', (email) => {
    expect(messages({ email, password: 'x' })).toEqual({ email: 'Enter your email.' });
  });

  it.each(['paolo', 'paolo@', '@gmail.com', 'a@b@c', 'paolo gmail'])(
    'rejects %j as not shaped like an email',
    (email) => {
      expect(messages({ email, password: 'x' })).toEqual({ email: 'Enter a valid email, like name@gmail.com' });
    },
  );

  it('rejects an email of 257 characters and accepts one of 256', () => {
    const tail = '@gmail.com';
    const long = `${'a'.repeat(257 - tail.length)}${tail}`;
    const edge = `${'a'.repeat(256 - tail.length)}${tail}`;

    expect(long).toHaveLength(257);
    expect(messages({ email: long, password: 'x' })).toEqual({ email: 'Enter a valid email, like name@gmail.com' });
    expect(messages({ email: edge, password: 'x' })).toEqual({});
  });

  it('asks for the password when it is empty, and puts no length rule on it', () => {
    expect(messages({ email: 'paolo.garcia@gmail.com', password: '' })).toEqual({ password: 'Enter your password.' });
    expect(messages({ email: 'paolo.garcia@gmail.com', password: 'p'.repeat(200) })).toEqual({});
    expect(messages({ email: 'paolo.garcia@gmail.com', password: ' ' })).toEqual({});
  });

  it('reports both fields at once', () => {
    expect(messages({ email: '', password: '' })).toEqual({
      email: 'Enter your email.',
      password: 'Enter your password.',
    });
  });
});

describe('isEmailShaped', () => {
  it('needs exactly one at sign with text on both sides', () => {
    expect(isEmailShaped('a@b')).toBe(true);
    expect(isEmailShaped('@b')).toBe(false);
    expect(isEmailShaped('a@')).toBe(false);
    expect(isEmailShaped('a@b@c')).toBe(false);
  });
});

describe('verifySchema', () => {
  const message = (code: string): string | undefined => {
    const result = verifySchema.safeParse({ code });
    return result.success ? undefined : result.error.issues[0]?.message;
  };

  it('accepts exactly six ASCII digits, leading zeros included', () => {
    expect(verifySchema.safeParse({ code: '000123' }).success).toBe(true);
    expect(verifySchema.safeParse({ code: '048213' }).data).toEqual({ code: '048213' });
  });

  it.each([
    ['empty', ''],
    ['five digits', '12345'],
    ['five digits and a gap', '12 45'],
    ['seven digits', '1234567'],
    ['a letter', '12a456'],
    ['spaces around', ' 123456'],
    ['full-width digits', '１２３４５６'],
  ])('rejects %s with "Enter all 6 digits."', (_name, code) => {
    expect(message(code)).toBe('Enter all 6 digits.');
  });
});

describe('zod and the strict CSP', () => {
  it('runs without code generation, so no script-src eval violation is reported', () => {
    expect(z.config().jitless).toBe(true);
  });
});

describe('forgotSchema', () => {
  it('accepts a shaped email and trims it', () => {
    const result = forgotSchema.safeParse({ email: '  paolo.garcia@gmail.com ' });

    expect(result.data).toEqual({ email: 'paolo.garcia@gmail.com' });
  });

  it.each([
    ['', 'Enter your email.'],
    ['   ', 'Enter your email.'],
    ['paolo', 'Enter a valid email, like name@gmail.com'],
    ['paolo@', 'Enter a valid email, like name@gmail.com'],
    ['a@b@c', 'Enter a valid email, like name@gmail.com'],
  ])('rejects %j with the sign-in wording', (email, message) => {
    const result = forgotSchema.safeParse({ email });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([message]);
  });
});

// newPasswordSchema mirrors the server's new-password rule through the shared golden cases (D-11, D-15).
interface PasswordCase {
  id: string;
  password: string;
  personal: { email: string; firstName: string | null; lastName: string | null } | null;
  mode: 'composition' | 'full';
  expected: 'ok' | PasswordRuleFailure;
}

const shared = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/password-policy-cases.json', import.meta.url), 'utf8'),
) as {
  messages: Record<PasswordRuleFailure, string>;
  cases: PasswordCase[];
};

const NOBODY = { email: 'nobody@example.test', firstName: null, lastName: null };

function newPasswordMessages(
  schema: ReturnType<typeof newPasswordSchema>,
  newPassword: string,
  confirmPassword: string,
): Record<string, string> {
  const result = schema.safeParse({ newPassword, confirmPassword });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('newPasswordSchema', () => {
  it.each(shared.cases.filter((c) => c.mode === 'full'))(
    'gives the verdict of the shared case $id (password-policy-cases.json)',
    (c) => {
      const found = newPasswordMessages(newPasswordSchema(c.personal ?? NOBODY), c.password, c.password);

      expect(found.newPassword).toBe(c.expected === 'ok' ? undefined : shared.messages[c.expected]);
    },
  );

  it.each(shared.cases.filter((c) => c.mode === 'composition'))(
    'gives the verdict of the composition case $id with no personal details',
    (c) => {
      const found = newPasswordMessages(newPasswordSchema(NOBODY), c.password, c.password);

      expect(found.newPassword).toBe(c.expected === 'ok' ? undefined : shared.messages[c.expected]);
    },
  );

  it('asks for the new password again when the confirmation is empty', () => {
    expect(newPasswordMessages(newPasswordSchema(NOBODY), 'Mabuhay#Tahi2026', '')).toEqual({
      confirmPassword: 'Enter the new password again.',
    });
  });

  it("says the passwords don't match when the confirmation differs", () => {
    expect(newPasswordMessages(newPasswordSchema(NOBODY), 'Mabuhay#Tahi2026', 'Mabuhay#Tahi2027')).toEqual({
      confirmPassword: "Passwords don't match.",
    });
  });

  it('reports a rule failure and a mismatch together, each under its own field', () => {
    expect(newPasswordMessages(newPasswordSchema(NOBODY), 'Pass1234', 'Pass12345')).toEqual({
      newPassword: 'Add at least one symbol, like ! or #.',
      confirmPassword: "Passwords don't match.",
    });
  });

  it('keeps the account email out of the password', () => {
    const schema = newPasswordSchema({ email: 'paolo@gmail.com', firstName: null, lastName: null });

    expect(newPasswordMessages(schema, 'Paolo#2026!', 'Paolo#2026!')).toEqual({
      newPassword: "Don't use your name or email in your password.",
    });
  });
});
