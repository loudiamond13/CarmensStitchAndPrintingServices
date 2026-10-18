import { describe, expect, it } from 'vitest';
import { serverFieldMessage } from './serverFieldMessage';

describe('serverFieldMessage', () => {
  it('returns the first message for the field', () => {
    expect(serverFieldMessage({ newEmail: ['First.', 'Second.'] }, 'newEmail')).toBe('First.');
  });

  it.each(['NewEmail', 'newemail', 'NEWEMAIL'])('matches the server key %j in any letter case', (key) => {
    expect(serverFieldMessage({ [key]: ['Taken.'] }, 'newEmail')).toBe('Taken.');
  });

  it('returns undefined for a field the server did not name, or one with no messages', () => {
    expect(serverFieldMessage({ other: ['x'] }, 'newEmail')).toBeUndefined();
    expect(serverFieldMessage({ newEmail: [] }, 'newEmail')).toBeUndefined();
    expect(serverFieldMessage({}, 'newEmail')).toBeUndefined();
  });
});
