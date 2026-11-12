// The line key allow-list (T-11-44, CWE-601): a key reaches an href or an element id only when it is made of lower case
// letters and digits joined by single hyphens, the same rule the server's LineKey.IsValid applies.
import { describe, expect, it } from 'vitest';
import { isLineKey } from './lineKey';

describe('isLineKey', () => {
  it.each(['basketball', 'long-sleeves', 'polo-2', 'a', '2x'])('accepts %s', (key) => {
    expect(isLineKey(key)).toBe(true);
  });

  it.each([
    '',
    'Bad Key',
    'Basketball',
    '../x',
    'javascript:x',
    '-lead',
    'trail-',
    'double--dash',
    'a/b',
    'a?b',
    'a#b',
    'a%20b',
  ])('refuses %j', (key) => {
    expect(isLineKey(key)).toBe(false);
  });
});
