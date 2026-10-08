import { describe, expect, it } from 'vitest';
import {
  businessToday,
  literalParser,
  normalizeSearch,
  pageSizeParser,
  parseAsBusinessDate,
  parseAsPage,
  parseAsRangePreset,
  parseAsSearch,
  resolveRangePreset,
  SEARCH_MAX_LENGTH,
} from './parsers';

describe('parseAsPage', () => {
  it.each(['1', '2', '999999'])('accepts the plain base-10 integer %j', (query) => {
    expect(parseAsPage.parse(query)).toBe(Number(query));
  });

  it.each(['0', '-1', '1.5', '2.5', '1e3', ' 2', '2 ', '0x10', '01', 'abc', '', '9007199254740993'])(
    'rejects %j',
    (query) => {
      expect(parseAsPage.parse(query)).toBeNull();
    },
  );

  it('defaults to page 1 and serializes as plain digits', () => {
    expect(parseAsPage.defaultValue).toBe(1);
    expect(parseAsPage.serialize(12)).toBe('12');
  });
});

describe('pageSizeParser', () => {
  it.each([10, 20, 50, 100])('accepts the offered size %i', (size) => {
    expect(pageSizeParser.parse(String(size))).toBe(size);
  });

  it.each(['9999', '20.0', '2e1', '020', ' 20', '0x14', '30', ''])('rejects %j', (query) => {
    expect(pageSizeParser.parse(query)).toBeNull();
  });

  it('defaults to 20', () => {
    expect(pageSizeParser.defaultValue).toBe(20);
    expect(pageSizeParser.serialize(50)).toBe('50');
  });
});

describe('literalParser', () => {
  const status = literalParser(['all', 'active', 'done'], 'all');

  it('accepts only the listed values and defaults to the given one', () => {
    expect(status.parse('done')).toBe('done');
    expect(status.parse('bogus')).toBeNull();
    expect(status.parse('DONE')).toBeNull();
    expect(status.defaultValue).toBe('all');
  });
});

describe('parseAsSearch', () => {
  it('trims the text', () => {
    expect(parseAsSearch.parse('  jersey  ')).toBe('jersey');
  });

  it.each(['', '   ', '\t \n'])('treats the blank text %j as no search', (query) => {
    expect(parseAsSearch.parse(query)).toBeNull();
  });

  it('keeps a search of exactly 100 UTF-16 code units', () => {
    const text = 'a'.repeat(SEARCH_MAX_LENGTH);
    expect(parseAsSearch.parse(text)).toBe(text);
  });

  it('cuts a 101-unit search to 100', () => {
    expect(parseAsSearch.parse('b'.repeat(101))).toBe('b'.repeat(100));
  });

  it('drops an emoji whole when its surrogate pair would straddle the limit', () => {
    // 99 units, then U+1F455 (a T-shirt, 2 units): the pair spans units 100-101.
    const text = `${'c'.repeat(99)}\u{1F455}`;
    expect(text.length).toBe(101);
    expect(parseAsSearch.parse(text)).toBe('c'.repeat(99));
  });

  it('keeps an emoji that ends exactly on the limit', () => {
    const text = `${'d'.repeat(98)}\u{1F455}`;
    expect(text.length).toBe(100);
    expect(parseAsSearch.parse(text)).toBe(text);
  });

  it('trims again after the cut so the result is stable when parsed again', () => {
    const cut = normalizeSearch(`${'e'.repeat(99)} f`);
    expect(cut).toBe('e'.repeat(99));
    expect(normalizeSearch(cut ?? '')).toBe(cut);
  });

  it('serializes the text unchanged', () => {
    expect(parseAsSearch.serialize('jersey')).toBe('jersey');
  });
});

describe('parseAsBusinessDate', () => {
  it.each(['2026-02-28', '2024-02-29', '2026-12-31', '2026-01-01'])(
    'accepts the calendar date %j as a string',
    (query) => {
      expect(parseAsBusinessDate.parse(query)).toBe(query);
    },
  );

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-01-00',
    '2026-2-1',
    '2026-02-30T00:00',
    '2026-02-28T00:00',
    '0000-01-01',
    ' 2026-02-28',
    'today',
  ])('rejects %j', (query) => {
    expect(parseAsBusinessDate.parse(query)).toBeNull();
  });

  it('serializes the same plain string (no UTC round trip)', () => {
    expect(parseAsBusinessDate.serialize('2026-10-07')).toBe('2026-10-07');
  });
});

describe('parseAsRangePreset and resolveRangePreset', () => {
  const preset = parseAsRangePreset(['last-30-days', 'this-month']);

  it('accepts only the listed preset names', () => {
    expect(preset.parse('last-30-days')).toBe('last-30-days');
    expect(preset.parse('this-month')).toBe('this-month');
    expect(preset.parse('this-year')).toBeNull();
    expect(preset.parse('custom')).toBeNull();
  });

  it.each([
    ['today', '2026-10-07', '2026-10-07', '2026-10-07'],
    ['last-7-days', '2026-10-07', '2026-10-01', '2026-10-07'],
    ['last-30-days', '2026-10-07', '2026-09-08', '2026-10-07'],
    ['last-30-days', '2026-03-01', '2026-01-31', '2026-03-01'],
    ['this-month', '2026-10-07', '2026-10-01', '2026-10-07'],
    ['last-month', '2026-10-07', '2026-09-01', '2026-09-30'],
    ['last-month', '2026-01-15', '2025-12-01', '2025-12-31'],
    ['last-month', '2024-03-31', '2024-02-01', '2024-02-29'],
    ['this-year', '2026-10-07', '2026-01-01', '2026-10-07'],
  ] as const)('resolves %s against business today %s to %s..%s', (name, today, from, to) => {
    expect(resolveRangePreset(name, today)).toEqual({ from, to });
  });

  it('refuses a business today that is not a calendar date', () => {
    expect(() => resolveRangePreset('today', '2026-02-30')).toThrow(RangeError);
  });
});

describe('businessToday', () => {
  it('gives the Asia/Manila calendar date of the injected instant', () => {
    expect(businessToday(new Date('2026-10-05T16:30:00Z'))).toBe('2026-10-06');
    expect(businessToday(new Date('2026-10-05T15:59:59Z'))).toBe('2026-10-05');
  });

  it('uses the given zone', () => {
    expect(businessToday(new Date('2026-10-05T16:30:00Z'), 'UTC')).toBe('2026-10-05');
  });
});
