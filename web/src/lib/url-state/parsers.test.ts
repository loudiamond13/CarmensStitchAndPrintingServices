import { describe, expect, it } from 'vitest';
import {
  businessToday,
  clampPage,
  dateRangeParsers,
  dateRangeValues,
  literalParser,
  normalizeSearch,
  PAGE_SIZES,
  pageParser,
  pageSizeParser,
  parseAsBusinessDate,
  resolveDateRange,
  resolveRangePreset,
  SEARCH_MAX_LENGTH,
  searchParser,
} from './parsers';

describe('pageParser', () => {
  it.each(['1', '2', '999999'])('accepts the plain base-10 integer %j', (query) => {
    expect(pageParser.parse(query)).toBe(Number(query));
  });

  it.each(['0', '-3', '-1', '1.5', '2.5', '1e3', ' 2', '2 ', '0x10', '01', 'abc', '', '9007199254740993'])(
    'rejects %j',
    (query) => {
      expect(pageParser.parse(query)).toBeNull();
    },
  );

  it('defaults to page 1 and serializes as plain digits', () => {
    expect(pageParser.defaultValue).toBe(1);
    expect(pageParser.serialize(12)).toBe('12');
  });
});

describe('pageSizeParser', () => {
  it('offers exactly 10, 20, 50 and 100', () => {
    expect(PAGE_SIZES).toEqual([10, 20, 50, 100]);
  });

  it.each([10, 20, 50, 100])('accepts the offered size %i', (size) => {
    expect(pageSizeParser.parse(String(size))).toBe(size);
  });

  it.each(['9999', '20.0', '2e1', '020', ' 20', '0x14', '30', '0', '-20', ''])('rejects %j', (query) => {
    expect(pageSizeParser.parse(query)).toBeNull();
  });

  it('defaults to 20', () => {
    expect(pageSizeParser.defaultValue).toBe(20);
    expect(pageSizeParser.serialize(50)).toBe('50');
  });
});

describe('literalParser', () => {
  const status = literalParser(['all', 'ready', 'done'], 'all');

  it('accepts only the listed values and defaults to the given one', () => {
    expect(status.parse('ready')).toBe('ready');
    expect(status.parse('bogus')).toBeNull();
    expect(status.parse('READY')).toBeNull();
    expect(status.defaultValue).toBe('all');
  });
});

describe('searchParser', () => {
  it('trims the text', () => {
    expect(searchParser.parse('  jersey ')).toBe('jersey');
  });

  it.each(['', '   ', '\t \n'])('treats the blank text %j as no search', (query) => {
    expect(searchParser.parse(query)).toBeNull();
  });

  it('keeps a search of exactly 100 UTF-16 code units', () => {
    const text = 'a'.repeat(SEARCH_MAX_LENGTH);
    expect(SEARCH_MAX_LENGTH).toBe(100);
    expect(searchParser.parse(text)).toBe(text);
  });

  it('cuts a 101-unit search to 100', () => {
    expect(searchParser.parse('b'.repeat(101))).toBe('b'.repeat(100));
  });

  it('drops an emoji whole when its surrogate pair would straddle the limit', () => {
    // 99 units, then U+1F455 (a T-shirt, 2 units): the pair spans units 100-101.
    const text = `${'c'.repeat(99)}\u{1F455}`;
    expect(text.length).toBe(101);
    expect(searchParser.parse(text)).toBe('c'.repeat(99));
  });

  it('keeps an emoji that ends exactly on the limit', () => {
    const text = `${'d'.repeat(98)}\u{1F455}`;
    expect(text.length).toBe(100);
    expect(searchParser.parse(text)).toBe(text);
  });

  it('trims again after the cut, so normalizing a second time changes nothing', () => {
    const cut = normalizeSearch(`${'e'.repeat(99)} f`);
    expect(cut).toBe('e'.repeat(99));
    expect(normalizeSearch(cut ?? '')).toBe(cut);
  });

  it('serializes the text unchanged', () => {
    expect(searchParser.serialize('jersey')).toBe('jersey');
  });
});

describe('parseAsBusinessDate', () => {
  it.each(['2026-02-28', '2024-02-29', '2000-02-29', '2026-12-31', '2026-01-01', '2026-04-30'])(
    'accepts the calendar date %j and keeps it a plain string',
    (query) => {
      expect(parseAsBusinessDate.parse(query)).toBe(query);
    },
  );

  it.each([
    '2026-02-30',
    '2026-02-29',
    '1900-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-01-00',
    '2026-01-32',
    '2026-2-1',
    '2026-02-28T00:00',
    '2026-02-28Z',
    '0000-01-01',
    ' 2026-02-28',
    'today',
    '',
  ])('rejects %j', (query) => {
    expect(parseAsBusinessDate.parse(query)).toBeNull();
  });

  it('serializes the same plain string (no UTC round trip)', () => {
    expect(parseAsBusinessDate.serialize('2026-10-07')).toBe('2026-10-07');
  });
});

describe('clampPage', () => {
  it.each([
    [9, 4, 4],
    [4, 4, 4],
    [2, 4, 2],
    [1, 4, 1],
    [9, 0, 1],
    [1, 0, 1],
    [3, -1, 1],
  ])('clampPage(%i, %i) is %i', (page, totalPages, expected) => {
    expect(clampPage(page, totalPages)).toBe(expected);
  });
});

describe('dateRangeParsers', () => {
  const parsers = dateRangeParsers(['last-30-days', 'this-month'], 'last-30-days');

  it('accepts the listed preset names and custom, and defaults to the given preset', () => {
    expect(parsers.range.parse('last-30-days')).toBe('last-30-days');
    expect(parsers.range.parse('this-month')).toBe('this-month');
    expect(parsers.range.parse('custom')).toBe('custom');
    expect(parsers.range.parse('this-year')).toBeNull();
    expect(parsers.range.parse('bogus')).toBeNull();
    expect(parsers.range.defaultValue).toBe('last-30-days');
  });

  it('stores a preset by its name, so range=last-30-days keeps no dates in the URL', () => {
    expect(parsers.range.serialize('last-30-days')).toBe('last-30-days');
    expect(dateRangeValues({ range: 'last-30-days' })).toEqual({ range: 'last-30-days', from: null, to: null });
  });

  it('stores from and to only for range=custom', () => {
    expect(dateRangeValues({ range: 'custom', from: '2026-09-01', to: '2026-09-30' })).toEqual({
      range: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(parsers.from.parse('2026-02-30')).toBeNull();
    expect(parsers.to.parse('2026-09-30')).toBe('2026-09-30');
  });
});

describe('resolveDateRange', () => {
  it('resolves range=last-30-days against the injected business today on every visit', () => {
    expect(resolveDateRange({ range: 'last-30-days', from: null, to: null }, '2026-10-07')).toEqual({
      from: '2026-09-08',
      to: '2026-10-07',
    });
    expect(resolveDateRange({ range: 'last-30-days', from: null, to: null }, '2026-10-08')).toEqual({
      from: '2026-09-09',
      to: '2026-10-08',
    });
  });

  it('ignores stray from and to for a preset', () => {
    expect(resolveDateRange({ range: 'this-month', from: '2020-01-01', to: '2020-01-31' }, '2026-10-07')).toEqual({
      from: '2026-10-01',
      to: '2026-10-07',
    });
  });

  it('returns a custom range as stored, open-ended where a bound is missing', () => {
    expect(resolveDateRange({ range: 'custom', from: '2026-09-01', to: '2026-09-30' }, '2026-10-07')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolveDateRange({ range: 'custom', from: '2026-09-01', to: null }, '2026-10-07')).toEqual({
      from: '2026-09-01',
      to: null,
    });
  });

  it('swaps a custom range whose from is after its to', () => {
    expect(resolveDateRange({ range: 'custom', from: '2026-09-30', to: '2026-09-01' }, '2026-10-07')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});

describe('resolveRangePreset', () => {
  it.each([
    ['today', '2026-10-07', '2026-10-07', '2026-10-07'],
    ['last-7-days', '2026-10-07', '2026-10-01', '2026-10-07'],
    ['last-30-days', '2026-10-07', '2026-09-08', '2026-10-07'],
    ['last-30-days', '2026-03-01', '2026-01-31', '2026-03-01'],
    ['last-30-days', '2025-01-15', '2024-12-17', '2025-01-15'],
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
