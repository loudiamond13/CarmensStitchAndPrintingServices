import { describe, expect, it } from 'vitest';
import {
  clampPage,
  literalParser,
  normalizeSearch,
  PAGE_SIZES,
  pageParser,
  pageSizeParser,
  parseAsBusinessDate,
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
