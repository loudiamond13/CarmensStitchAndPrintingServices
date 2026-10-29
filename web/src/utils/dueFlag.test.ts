import { describe, expect, it } from 'vitest';
import { dueDays, dueFlagState } from './dueFlag';

// dueDays and dueFlagState (ORD-11, D-36 to D-38, D-59): whole calendar days from the server's business today, no time zone.

describe('dueDays', () => {
  it.each([
    ['2026-10-29', '2026-10-26', -3],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-02-28', '2026-03-01', 1],
    ['2028-02-28', '2028-03-01', 2],
    ['2026-10-29', '2026-10-29', 0],
    ['2026-01-01', '2026-12-31', 364],
  ])('from %s to %s is %i', (today, dueDate, expected) => {
    expect(dueDays(today, dueDate)).toBe(expected);
  });

  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-10-29', 'soon'],
    ['', '2026-10-29'],
    ['2026-10-29T00:00:00Z', '2026-10-30'],
  ])('refuses %j and %j', (today, dueDate) => {
    expect(() => dueDays(today, dueDate)).toThrow(RangeError);
  });
});

describe('dueFlagState', () => {
  const today = '2026-10-29';

  it.each([
    ['2026-11-03', 'days-left', 5],
    ['2026-10-31', 'days-left', 2],
    ['2026-10-30', 'tomorrow', 1],
    ['2026-10-29', 'today', 0],
    ['2026-10-28', 'overdue', 1],
    ['2026-10-26', 'overdue', 3],
  ])('an open order due %s is %s (%i)', (dueDate, kind, days) => {
    for (const status of ['pending', 'mockup', 'production', 'ready']) {
      expect(dueFlagState(today, dueDate, status)).toEqual({ kind, days });
    }
  });

  it.each(['delivered', 'completed', 'cancelled'])('a %s order shows the date only, even when past due', (status) => {
    expect(dueFlagState(today, '2026-10-01', status)).toEqual({ kind: 'date-only', days: 0 });
    expect(dueFlagState(today, '2026-12-01', status)).toEqual({ kind: 'date-only', days: 0 });
  });

  it('shows the date only for a status the types do not know', () => {
    expect(dueFlagState(today, '2026-10-01', 'archived')).toEqual({ kind: 'date-only', days: 0 });
  });

  it.each([null, '', 'soon', '2026-02-30'])('has no flag for the due date %j', (dueDate) => {
    expect(dueFlagState(today, dueDate, 'pending')).toEqual({ kind: 'none', days: 0 });
  });

  it('keeps the date and drops the flag when today is unreadable', () => {
    expect(dueFlagState('', '2026-10-01', 'pending')).toEqual({ kind: 'date-only', days: 0 });
  });
});
