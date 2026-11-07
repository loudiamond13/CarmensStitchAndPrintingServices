import { describe, expect, it } from 'vitest';
import { toFiniteFigure } from './toFiniteFigure';

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
  ])('refuses %s', (_what, value) => {
    expect(toFiniteFigure(value)).toBeNull();
  });
});
