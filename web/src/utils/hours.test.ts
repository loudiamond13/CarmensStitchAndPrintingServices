// Weekly hours text for the footer, the Contact card and the admin preview (D-21). No clock is read (D-22).
import { describe, expect, it } from 'vitest';
import { callButtonSummary, formatTime, groupWeek, summarizeOpenDays, type WeekDayHours } from './hours';

const OPEN_9_TO_6 = { opensAt: '09:00', closesAt: '18:00' } as const;
const OPEN_9_TO_5 = { opensAt: '09:00', closesAt: '17:00' } as const;
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

/** Monday to Friday 9 to 6, Saturday 9 to 5, Sunday closed. */
const MIXED_WEEK: readonly WeekDayHours[] = [
  { day: 1, ...OPEN_9_TO_6 },
  { day: 2, ...OPEN_9_TO_6 },
  { day: 3, ...OPEN_9_TO_6 },
  { day: 4, ...OPEN_9_TO_6 },
  { day: 5, ...OPEN_9_TO_6 },
  { day: 6, ...OPEN_9_TO_5 },
  { day: 7, ...CLOSED },
];

/** Open Monday, Wednesday and Friday only. */
const SPLIT_WEEK: readonly WeekDayHours[] = [
  { day: 1, ...OPEN_9_TO_6 },
  { day: 2, ...CLOSED },
  { day: 3, ...OPEN_9_TO_6 },
  { day: 4, ...CLOSED },
  { day: 5, ...OPEN_9_TO_6 },
  { day: 6, ...CLOSED },
  { day: 7, ...CLOSED },
];

const CLOSED_WEEK: readonly WeekDayHours[] = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({ day, ...CLOSED }));

describe('formatTime', () => {
  it('writes a morning time with AM', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('writes an evening time with PM', () => {
    expect(formatTime('18:00')).toBe('6:00 PM');
  });

  it('writes noon as 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('writes midnight as 12:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('keeps the minutes', () => {
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatTime('23:59')).toBe('11:59 PM');
  });

  it.for(['9am', '9:00', '24:00', '09:60', '', ' 09:00'])('gives null for the malformed time "%s"', (text) => {
    expect(formatTime(text)).toBeNull();
  });
});

describe('summarizeOpenDays', () => {
  it('gives one footer line for Monday to Saturday 9 to 6', () => {
    expect(summarizeOpenDays(COMMON_WEEK)).toEqual(['Mon-Sat · 9:00 AM - 6:00 PM']);
  });

  it('gives two lines when Saturday keeps different hours', () => {
    expect(summarizeOpenDays(MIXED_WEEK)).toEqual(['Mon-Fri · 9:00 AM - 6:00 PM', 'Sat · 9:00 AM - 5:00 PM']);
  });

  it('does not run across a closed day', () => {
    expect(summarizeOpenDays(SPLIT_WEEK)).toEqual([
      'Mon · 9:00 AM - 6:00 PM',
      'Wed · 9:00 AM - 6:00 PM',
      'Fri · 9:00 AM - 6:00 PM',
    ]);
  });

  it('gives an empty list when every day is closed', () => {
    expect(summarizeOpenDays(CLOSED_WEEK)).toEqual([]);
  });
});

describe('groupWeek', () => {
  it('gives a row per run for the mixed week, Sunday with null hours', () => {
    expect(groupWeek(MIXED_WEEK)).toEqual([
      { days: 'Monday to Friday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Saturday', hours: '9:00 AM - 5:00 PM' },
      { days: 'Sunday', hours: null },
    ]);
  });

  it('gives single-day rows for a week open Monday, Wednesday and Friday', () => {
    expect(groupWeek(SPLIT_WEEK)).toEqual([
      { days: 'Monday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Tuesday', hours: null },
      { days: 'Wednesday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Thursday', hours: null },
      { days: 'Friday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Saturday to Sunday', hours: null },
    ]);
  });

  it('gives one closed row for a week with no open day', () => {
    expect(groupWeek(CLOSED_WEEK)).toEqual([{ days: 'Monday to Sunday', hours: null }]);
  });

  it('reads the days Monday first whatever order they arrive in', () => {
    expect(groupWeek([...COMMON_WEEK].reverse())).toEqual([
      { days: 'Monday to Saturday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Sunday', hours: null },
    ]);
  });

  it('treats a day the server left out as closed', () => {
    expect(groupWeek(COMMON_WEEK.filter((entry) => entry.day !== 3))).toEqual([
      { days: 'Monday to Tuesday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Wednesday', hours: null },
      { days: 'Thursday to Saturday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Sunday', hours: null },
    ]);
  });

  it('treats a day with only one time, or a malformed one, as closed', () => {
    const week: readonly WeekDayHours[] = [
      { day: 1, opensAt: '09:00', closesAt: null },
      { day: 2, opensAt: '9am', closesAt: '18:00' },
      ...COMMON_WEEK.filter((entry) => entry.day >= 3),
    ];
    expect(groupWeek(week)).toEqual([
      { days: 'Monday to Tuesday', hours: null },
      { days: 'Wednesday to Saturday', hours: '9:00 AM - 6:00 PM' },
      { days: 'Sunday', hours: null },
    ]);
  });

  it('shows a late close as written, past noon and midnight', () => {
    const week: readonly WeekDayHours[] = [{ day: 1, opensAt: '00:00', closesAt: '12:00' }, ...CLOSED_WEEK.slice(1)];
    expect(groupWeek(week)[0]).toEqual({ days: 'Monday', hours: '12:00 AM - 12:00 PM' });
  });
});

describe('callButtonSummary', () => {
  it('writes the common week with a comma after the days', () => {
    expect(callButtonSummary(COMMON_WEEK)).toBe('Mon-Sat, 9:00 AM - 6:00 PM');
  });

  it('joins mixed hours with a semicolon', () => {
    expect(callButtonSummary(MIXED_WEEK)).toBe('Mon-Fri, 9:00 AM - 6:00 PM; Sat, 9:00 AM - 5:00 PM');
  });

  it('gives null when every day is closed', () => {
    expect(callButtonSummary(CLOSED_WEEK)).toBeNull();
  });
});

describe('long dashes (OR-4)', () => {
  it('never appear in any output', () => {
    const weeks = [COMMON_WEEK, MIXED_WEEK, SPLIT_WEEK, CLOSED_WEEK];
    const outputs = weeks.flatMap((week) => [
      ...groupWeek(week).flatMap((row) => [row.days, row.hours ?? '']),
      ...summarizeOpenDays(week),
      callButtonSummary(week) ?? '',
    ]);
    const longDash = new RegExp(`[${String.fromCharCode(0x2012)}-${String.fromCharCode(0x2015)}]`);
    expect(outputs.join('\n')).not.toMatch(longDash);
  });
});
