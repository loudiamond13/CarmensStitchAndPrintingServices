import { describe, expect, it } from 'vitest';
import { requireFigure, toFiniteFigure } from './toFiniteFigure';

// The one place a generated `number | string` figure becomes a number (wave 5 IN-01): a figure the browser cannot trust is null,
// so its caller can refuse the whole answer instead of drawing NaN.

describe('toFiniteFigure', () => {
  it.each([
    [8450, 8450],
    [-500.5, -500.5],
    [0, 0],
    ['8450.00', 8450],
    ['-500.50', -500.5],
    [' 12.5 ', 12.5],
  ])('reads %j as %j', (value, expected) => {
    expect(toFiniteFigure(value)).toBe(expected);
  });

  it.each([
    ['blank text', ''],
    ['spaces', '   '],
    ['words', 'lots'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['minus Infinity', Number.NEGATIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
    ['a boolean', true],
    ['an object', {}],
    ['a list', [12]],
    ['hex text', '0x1F'],
    ['binary text', '0b101'],
    ['octal text', '0o17'],
    ['exponent text', '1e3'],
    ['a plus sign', '+12'],
    ['two points', '1.2.3'],
    ['a trailing point', '12.'],
    ['a leading point', '.5'],
    ['a comma', '1,000.00'],
  ])('refuses %s', (_what, value) => {
    expect(toFiniteFigure(value)).toBeNull();
  });
});

describe('requireFigure', () => {
  class PartError extends Error {}
  const makeError = (message: string): Error => new PartError(message);

  it('returns a figure the browser can read', () => {
    expect(requireFigure('8450.00', 'ledger balance', makeError)).toBe(8450);
    expect(requireFigure(-12.5, 'ledger balance', makeError)).toBe(-12.5);
  });

  it.each([
    ['blank text', ''],
    ['words', 'abc'],
    ['null', null],
    ['NaN', Number.NaN],
  ])('throws the error the caller made, naming what was wrong, for %s', (_name, value) => {
    expect(() => requireFigure(value, 'ledger balance', makeError)).toThrow(PartError);
    expect(() => requireFigure(value, 'ledger balance', makeError)).toThrow(
      'The ledger balance is not a finite number.',
    );
  });
});
