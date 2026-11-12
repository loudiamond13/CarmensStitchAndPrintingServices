// Weekly hours text for the footer, the Contact card and the admin preview (D-21). No clock is read (D-22).
import { describe, expect, it } from 'vitest';
import { formatTime, summarizeOpenDays, type WeekDayHours } from './hours';

const OPEN_9_TO_6 = { opensAt: '09:00', closesAt: '18:00' } as const;
const CLOSED = { opensAt: null, closesAt: null } as const;

/** Monday to Saturday 9 to 6, Sunday closed. */
const COMMON_WEEK: readonly WeekDayHours[] = [
  { day: 1, ...OPEN_9_TO_6 },
  { day: 2, ...OPEN_9_TO_6 },
  { day: 3, ...OPEN_9_TO_6 },
  { day: 4, ...OPEN_9_TO_6 },
  { day: 5, ...OPEN_9_TO_6 },
  { day: 6, ...OPEN_9_TO_6 },
  { day: 7, ...CLOSED },
];

describe('formatTime', () => {
  it('writes a morning time with AM', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('writes an evening time with PM', () => {
    expect(formatTime('18:00')).toBe('6:00 PM');
  });
});

describe('summarizeOpenDays', () => {
  it('gives one footer line for Monday to Saturday 9 to 6', () => {
    expect(summarizeOpenDays(COMMON_WEEK)).toEqual(['Mon-Sat · 9:00 AM - 6:00 PM']);
  });
});
