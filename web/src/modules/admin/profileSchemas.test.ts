import { describe, expect, it } from 'vitest';
import { profileNameSchema } from './profileSchemas';

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
