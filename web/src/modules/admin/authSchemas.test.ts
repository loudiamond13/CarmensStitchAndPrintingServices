import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { isEmailShaped, signInSchema, verifySchema } from './authSchemas';

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
