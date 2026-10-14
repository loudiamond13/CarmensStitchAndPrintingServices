// Business-zone dates and exact money entry text (ORD-09, Phase 1 locale decision: Asia/Manila, "Oct 6, 2026").
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUSINESS_ZONE,
  centavosToMoneyText,
  formatBusinessDate,
  formatCalendarDate,
  isMoneyText,
  MONEY_TEXT,
  moneyTextToCentavos,
  normalizePastedMoney,
  padMoneyOnBlur,
} from './format';

// Machine zones on both sides of the business zone: the output must not move with the machine.
const MACHINE_ZONES = ['America/Chicago', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;

/** Sets the process zone and proves the change took effect, so a test cannot pass by never leaving UTC. */
function useMachineZone(zone: string): void {
  vi.stubEnv('TZ', zone);
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('BUSINESS_ZONE', () => {
  it('is the Phase 1 business zone', () => {
    expect(BUSINESS_ZONE).toBe('Asia/Manila');
  });
});

describe('formatBusinessDate', () => {
  it.for(MACHINE_ZONES)('shows 2026-10-05T16:30:00Z as "Oct 6, 2026" on a machine in %s', (zone) => {
    useMachineZone(zone);
    expect(formatBusinessDate('2026-10-05T16:30:00Z')).toBe('Oct 6, 2026');
  });

  it.for(MACHINE_ZONES)('crosses the year boundary in the business zone on a machine in %s', (zone) => {
    useMachineZone(zone);
    expect(formatBusinessDate('2026-12-31T16:00:00Z')).toBe('Jan 1, 2027');
  });

  it('keeps the previous day one second before business midnight', () => {
    expect(formatBusinessDate('2026-10-05T15:59:59Z')).toBe('Oct 5, 2026');
  });

  it('formats in another zone when one is given', () => {
    expect(formatBusinessDate('2026-10-05T16:30:00Z', 'UTC')).toBe('Oct 5, 2026');
  });

  it('reads an explicit offset', () => {
    expect(formatBusinessDate('2026-10-06T00:30:00+08:00')).toBe('Oct 6, 2026');
    expect(formatBusinessDate('2026-10-05T11:30:00-05:00')).toBe('Oct 6, 2026');
  });

  it('reads the seven fractional digits the .NET serializer writes', () => {
    expect(formatBusinessDate('2026-10-05T16:30:00.1234567Z')).toBe('Oct 6, 2026');
  });

  it.for([
    'not a date',
    '',
    // No zone designator: the browser would read it in the machine zone.
    '2026-10-05T16:30:00',
    // A calendar date is not an instant; formatCalendarDate shows it.
    '2026-10-05',
    // Impossible parts the browser would otherwise roll over (Feb 30 → Mar 2, 24:00 → next day).
    '2026-02-30T00:00:00Z',
    '2026-10-05T24:00:00Z',
    '2026-10-05T16:60:00Z',
    'Oct 5, 2026 16:30 UTC',
  ])('gives null for %j', (value) => {
    expect(formatBusinessDate(value)).toBeNull();
  });

  it('throws a RangeError for an unknown zone', () => {
    expect(() => formatBusinessDate('2026-10-05T16:30:00Z', 'Not/AZone')).toThrow(RangeError);
  });
});

describe('formatCalendarDate', () => {
  it.for(MACHINE_ZONES)('shows 2026-10-06 as "Oct 6, 2026" with no zone shift on a machine in %s', (zone) => {
    useMachineZone(zone);
    expect(formatCalendarDate('2026-10-06')).toBe('Oct 6, 2026');
  });

  it('shows a leap day in a leap year', () => {
    expect(formatCalendarDate('2028-02-29')).toBe('Feb 29, 2028');
  });

  it('shows the first and last day of the year', () => {
    expect(formatCalendarDate('2027-01-01')).toBe('Jan 1, 2027');
    expect(formatCalendarDate('2026-12-31')).toBe('Dec 31, 2026');
  });

  it.for([
    '2026-02-30',
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-6',
    '2026-10-06T00:00:00Z',
    ' 2026-10-06',
    '',
    'not a date',
  ])('gives null for %j', (value) => {
    expect(formatCalendarDate(value)).toBeNull();
  });
});

describe('MONEY_TEXT', () => {
  it('is the MoneyInput pattern, with no flags (a g flag would make test() stateful)', () => {
    expect(MONEY_TEXT.source).toBe(String.raw`^\d{0,9}(\.\d{0,2})?$`);
    expect(MONEY_TEXT.flags).toBe('');
  });
});

describe('isMoneyText', () => {
  it.for([
    '1250.50',
    '1250.5',
    '0',
    '0.07',
    '999999999.99',
    // Partial states while typing: an empty field, a lone dot, a trailing dot.
    '',
    '.',
    '.5',
    '5.',
  ])('accepts %j', (text) => {
    expect(isMoneyText(text)).toBe(true);
  });

  it.for([
    ['a third decimal', '1.234'],
    ['a tenth integer digit', '1234567890'],
    ['a minus sign', '-5'],
    ['a U+2212 minus sign', '−5'],
    ['a plus sign', '+5'],
    ['a letter', '12a'],
    ['an exponent', '5e3'],
    ['a grouping comma', '1,250'],
    ['a space', ' 5'],
    ['two dots', '1.2.3'],
    ['the peso sign', '₱5'],
    ['non-ASCII digits', '١٢'],
  ] as const)('rejects %s', ([, text]) => {
    expect(isMoneyText(text)).toBe(false);
  });

  it('gives the same answer when asked twice', () => {
    expect([isMoneyText('5'), isMoneyText('5')]).toEqual([true, true]);
  });
});

describe('normalizePastedMoney', () => {
  it.for([
    [' 12,450.00 ', '12450.00'],
    ['12,450.5', '12450.5'],
    ['1 250.50', '1250.50'],
    ['\t5000\n', '5000'],
    ['5000', '5000'],
    ['.5', '.5'],
    ['1,234,567.89', '1234567.89'],
    ['999,999,999.99', '999999999.99'],
    ['1\u00A0250.50', '1250.50'],
    ['1\u202F250', '1250'],
  ] as const)('turns %j into %j', ([pasted, expected]) => {
    expect(normalizePastedMoney(pasted)).toBe(expected);
  });

  it.for(['-5', '−5', '-1,250.00', '1.234', '1,234,567,890', 'abc', '₱1,250.00', '1.2.3'])(
    'returns an empty string for %j',
    (pasted) => {
      expect(normalizePastedMoney(pasted)).toBe('');
    },
  );

  // A comma or space counts only as a thousands separator between groups of three digits. Anything else is refused
  // rather than read as a different amount: "1,50" must never become ₱150.00 (LIB-WR-06).
  it.for([
    '1,50',
    '12,5',
    '1,2,3',
    '12 50',
    '1 2 3',
    '1,2500',
    ',250',
    '1,250,',
    '1,250 000',
    '1\t250',
    '1\n250',
    '12,50.00',
  ])('refuses %j instead of reading it as another amount', (pasted) => {
    expect(normalizePastedMoney(pasted)).toBe('');
  });
});

describe('padMoneyOnBlur', () => {
  it.for([
    ['5000', '5000.00'],
    ['1250.5', '1250.50'],
    ['1250.50', '1250.50'],
    ['.5', '0.50'],
    ['5.', '5.00'],
    ['0', '0.00'],
  ] as const)('pads %j to %j', ([text, expected]) => {
    expect(padMoneyOnBlur(text)).toBe(expected);
  });

  it.for(['', '.'])('leaves %j empty', (text) => {
    expect(padMoneyOnBlur(text)).toBe('');
  });

  it('leaves text that is not an amount unchanged, so the field can show its error', () => {
    expect(padMoneyOnBlur('12a')).toBe('12a');
  });
});

describe('moneyTextToCentavos', () => {
  it.for([
    ['0.07', 7],
    ['999999999.99', 99_999_999_999],
    ['1250.50', 125_050],
    ['1250.5', 125_050],
    ['.5', 50],
    ['5.', 500],
    ['5', 500],
    ['0', 0],
    ['007', 700],
    // Float traps: parseFloat(text) * 100 gives 28.999999999999996 and 114.99999999999999.
    ['0.29', 29],
    ['1.15', 115],
  ] as const)('reads %j as %d centavos', ([text, expected]) => {
    const centavos = moneyTextToCentavos(text);
    expect(centavos).toBe(expected);
    expect(Number.isSafeInteger(centavos)).toBe(true);
  });

  it.for(['', '.'])('throws a TypeError for the empty amount %j, so callers validate first', (text) => {
    expect(() => moneyTextToCentavos(text)).toThrow(new TypeError('empty amount'));
  });

  it.for(['-5', '1.234', '1234567890', 'abc'])('throws a TypeError for %j', (text) => {
    expect(() => moneyTextToCentavos(text)).toThrow(new TypeError('not an amount'));
  });
});

describe('centavosToMoneyText', () => {
  it.for([
    [125_050, '1250.50'],
    [7, '0.07'],
    [0, '0.00'],
    [-0, '0.00'],
    [500, '5.00'],
    [99_999_999_999, '999999999.99'],
  ] as const)('writes %d centavos as %j', ([centavos, expected]) => {
    expect(centavosToMoneyText(centavos)).toBe(expected);
  });

  it.for([
    ['a negative amount', -5],
    ['a fraction of a centavo', 0.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['more than nine integer digits', 100_000_000_000],
  ] as const)('throws a RangeError for %s', ([, centavos]) => {
    expect(() => centavosToMoneyText(centavos)).toThrow(RangeError);
  });

  it('round-trips every centavo amount up to ₱100.00 and the largest amount', () => {
    const amounts = [...Array.from({ length: 10_001 }, (_, i) => i), 99_999_999_999, 12_345_678_901];
    const mismatches = amounts.filter((c) => moneyTextToCentavos(centavosToMoneyText(c)) !== c);
    expect(mismatches).toEqual([]);
  });

  it('round-trips typed text after blur padding', () => {
    for (const typed of ['1250.5', '.07', '5', '999999999.99']) {
      const padded = padMoneyOnBlur(typed);
      expect(centavosToMoneyText(moneyTextToCentavos(padded))).toBe(padded);
    }
  });
});
