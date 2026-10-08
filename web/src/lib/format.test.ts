// Business-zone dates (ORD-09, Phase 1 locale decision: Asia/Manila, "Oct 6, 2026").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSINESS_ZONE, formatBusinessDate, formatCalendarDate } from './format';

const EM_DASH = '—';

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
  ])('shows an em dash for %j', (value) => {
    expect(formatBusinessDate(value)).toBe(EM_DASH);
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
  ])('shows an em dash for %j', (value) => {
    expect(formatCalendarDate(value)).toBe(EM_DASH);
  });
});
