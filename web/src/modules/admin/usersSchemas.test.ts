// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createUserSchema } from './usersSchemas';

// The Add User form's zod mirror (OR-3) of CreateUserRequestValidator: names required after trim and at most 100, the email
// required and shaped like one (at most 256), a role and a way to get access.

const VALID = {
  firstName: 'Ana',
  lastName: 'Reyes',
  email: 'ana@example.ph',
  role: 'Admin',
  access: 'invitation',
  temporaryPassword: '',
};

function messages(overrides: Record<string, string> = {}): Record<string, string> {
  const result = createUserSchema.safeParse({ ...VALID, ...overrides });
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('createUserSchema names', () => {
  it('accepts an ordinary invitation and trims the names and the email', () => {
    const result = createUserSchema.parse({
      ...VALID,
      firstName: '  Ana ',
      lastName: ' Reyes ',
      email: ' ana@example.ph ',
    });

    expect(result).toMatchObject({
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana@example.ph',
      access: 'invitation',
    });
  });

  it.each(['', '   ', '\t \n'])('refuses a blank first name %j', (firstName) => {
    expect(messages({ firstName })).toEqual({ firstName: 'Enter a first name.' });
  });

  it.each(['', '   '])('refuses a blank last name %j', (lastName) => {
    expect(messages({ lastName })).toEqual({ lastName: 'Enter a last name.' });
  });

  it('reports both names at once, each under its own field', () => {
    expect(messages({ firstName: '', lastName: ' ' })).toEqual({
      firstName: 'Enter a first name.',
      lastName: 'Enter a last name.',
    });
  });

  it('accepts exactly 100 characters and refuses 101, for each name', () => {
    expect(messages({ firstName: 'a'.repeat(100), lastName: 'b'.repeat(100) })).toEqual({});
    expect(messages({ firstName: 'a'.repeat(101) })).toEqual({
      firstName: 'First name must be 100 characters or fewer.',
    });
    expect(messages({ lastName: 'b'.repeat(101) })).toEqual({ lastName: 'Last name must be 100 characters or fewer.' });
  });

  it('counts the length after trimming', () => {
    expect(messages({ firstName: ` ${'a'.repeat(100)} ` })).toEqual({});
  });
});

describe('createUserSchema email', () => {
  it.each(['', '   '])('refuses a blank email %j', (email) => {
    expect(messages({ email })).toEqual({ email: 'Enter their email.' });
  });

  it.each(['ana', 'ana@', '@example.ph', 'ana@@example.ph', 'a@b@c'])(
    'refuses %j as not shaped like an email',
    (email) => {
      expect(messages({ email })).toEqual({ email: 'Enter a valid email, like name@gmail.com' });
    },
  );

  it('accepts 256 characters and refuses 257', () => {
    const at = (length: number) => `${'a'.repeat(length - '@e.ph'.length)}@e.ph`;
    expect(messages({ email: at(256) })).toEqual({});
    expect(messages({ email: at(257) })).toEqual({ email: 'Enter a valid email, like name@gmail.com' });
  });
});

describe('createUserSchema role and access', () => {
  it.each(['Admin', 'Manager'])('accepts the role %s', (role) => {
    expect(messages({ role })).toEqual({});
  });

  it.each(['', 'Owner', 'admin '])('refuses the role %j', (role) => {
    expect(messages({ role })).toEqual({ role: 'Choose a role.' });
  });

  it.each(['invitation', 'temporary-password'])(
    'accepts the access %s once a password is given for the temporary one',
    (access) => {
      expect(messages({ access, temporaryPassword: 'Tela-Sukat-7381' })).toEqual({});
    },
  );

  it.each(['', 'email', 'Invitation'])('refuses the access %j', (access) => {
    expect(messages({ access })).toEqual({ access: 'Choose how they get access.' });
  });
});
