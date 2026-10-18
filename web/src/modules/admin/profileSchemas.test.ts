import { describe, expect, it } from 'vitest';
import { changeEmailSchema, profileNameSchema } from './profileSchemas';

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
