// Money and date formatting in the approved en-PH / Asia/Manila formats (ORD-09).
import { describe, expect, it } from 'vitest';
import { formatBusinessDate, formatDate, formatPeso } from './format';

const MINUS = '−';

describe('formatPeso', () => {
  it('shows two decimals with en-PH grouping', () => {
    expect(formatPeso(12450)).toBe('₱12,450.00');
  });

  it('writes negatives with the U+2212 minus sign', () => {
    const text = formatPeso(-732.5);
    expect(text).toBe('−₱732.50');
    expect(text.startsWith(MINUS)).toBe(true);
    expect(text.includes('-')).toBe(false);
  });

  it.for([
    ['-0', -0],
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ] as const)('shows %s as ₱0.00 with no minus sign', ([, value]) => {
    expect(formatPeso(value)).toBe('₱0.00');
  });

  it('accepts a money string', () => {
    expect(formatPeso('1234.5')).toBe('₱1,234.50');
  });
});

describe('formatDate', () => {
  it('formats a plain business date', () => {
    expect(formatDate('2026-10-06')).toBe('Oct 6, 2026');
  });

  it('shows an em dash for an empty date', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatBusinessDate', () => {
  it('formats a UTC instant as its Asia/Manila date', () => {
    expect(formatBusinessDate('2026-10-05T16:30:00Z')).toBe('Oct 6, 2026');
  });

  it('keeps the previous day one second before Manila midnight', () => {
    expect(formatBusinessDate('2026-10-05T15:59:59Z')).toBe('Oct 5, 2026');
  });

  it('formats in another zone when one is given', () => {
    expect(formatBusinessDate('2026-10-05T16:30:00Z', 'UTC')).toBe('Oct 5, 2026');
  });

  it.for(['not a date', ''])('shows an em dash for %j', (value) => {
    expect(formatBusinessDate(value)).toBe('—');
  });
});
