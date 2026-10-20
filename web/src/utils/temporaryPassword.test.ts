import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPasswordComposition } from './passwordRules';
import { newTemporaryPassword, TEMPORARY_PASSWORD_WORDS, type RandomFill } from './temporaryPassword';

// The readable temporary password of Add User (C-4, 04 D-21, D-14, T-05-64): Word-Word-NNNN from an in-house list, drawn
// with crypto.getRandomValues and rejection sampling.

const FORM = /^([A-Z][a-z]+)-([A-Z][a-z]+)-(\d{4})$/;

/** A random source that hands out the given numbers one after the other. */
function sequence(...numbers: number[]): RandomFill {
  let next = 0;
  return (buffer) => {
    for (let index = 0; index < buffer.length; index += 1) {
      buffer[index] = numbers[next] ?? 0;
      next += 1;
    }
    return buffer;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the word list', () => {
  it('has at least 32 short, distinct, plain-letter words', () => {
    expect(TEMPORARY_PASSWORD_WORDS.length).toBeGreaterThanOrEqual(32);
    expect(new Set(TEMPORARY_PASSWORD_WORDS).size).toBe(TEMPORARY_PASSWORD_WORDS.length);
    for (const word of TEMPORARY_PASSWORD_WORDS) {
      expect(word).toMatch(/^[A-Z][a-z]{2,9}$/);
    }
  });

  it('starts with the words of the UI-SPEC example', () => {
    expect(TEMPORARY_PASSWORD_WORDS.slice(0, 2)).toEqual(['Tela', 'Sukat']);
  });
});

describe('newTemporaryPassword', () => {
  it('makes two words and four digits from the source: Tela-Sukat-7381', () => {
    expect(newTemporaryPassword(undefined, sequence(0, 1, 7381))).toBe('Tela-Sukat-7381');
  });

  it('pads the digits to four places', () => {
    expect(newTemporaryPassword(undefined, sequence(2, 3, 42))).toMatch(/-0042$/);
  });

  it('draws each index without bias: a number from the unfair tail of the range is thrown away', () => {
    // The largest 32-bit number lies in the unfair tail whenever the list length does not divide 2^32 evenly.
    expect(2 ** 32 % TEMPORARY_PASSWORD_WORDS.length).not.toBe(0);
    const fair = newTemporaryPassword(undefined, sequence(4, 5, 123));

    expect(newTemporaryPassword(undefined, sequence(0xffffffff, 4, 5, 123))).toBe(fair);
  });

  it('throws away an unfair digit draw too', () => {
    expect(newTemporaryPassword(undefined, sequence(0, 1, 4_294_967_295, 7381))).toBe('Tela-Sukat-7381');
  });

  it('never returns the value it was given: the next draw is used', () => {
    expect(newTemporaryPassword('Tela-Sukat-7381', sequence(0, 1, 7381, 0, 1, 7382))).toBe('Tela-Sukat-7382');
  });

  it('makes a value in the Word-Word-NNNN form from the list, and 1,000 real draws all pass the basic rule', () => {
    for (let draw = 0; draw < 1000; draw += 1) {
      const value = newTemporaryPassword();
      const match = FORM.exec(value);
      expect(match).not.toBeNull();
      expect(TEMPORARY_PASSWORD_WORDS).toContain(match?.[1]);
      expect(TEMPORARY_PASSWORD_WORDS).toContain(match?.[2]);
      expect(checkPasswordComposition(value)).toBeNull();
    }
  });

  it('gives a different value each time in a long run', () => {
    const values = new Set(Array.from({ length: 200 }, () => newTemporaryPassword()));

    expect(values.size).toBeGreaterThan(190);
  });

  it('uses crypto.getRandomValues and never Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const fill = vi.spyOn(globalThis.crypto, 'getRandomValues');

    newTemporaryPassword();

    expect(random).not.toHaveBeenCalled();
    expect(fill).toHaveBeenCalled();
  });
});
