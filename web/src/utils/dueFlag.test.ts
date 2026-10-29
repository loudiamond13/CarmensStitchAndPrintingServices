import { describe, expect, it } from 'vitest';
import { dueDays } from './dueFlag';

// dueDays (ORD-11, D-59): whole calendar days from the server's business today to the due date, with no time zone.

describe('dueDays', () => {
  it.each([
    ['2026-10-29', '2026-10-26', -3],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-02-28', '2026-03-01', 1],
  ])('from %s to %s is %i', (today, dueDate, expected) => {
    expect(dueDays(today, dueDate)).toBe(expected);
  });
});
