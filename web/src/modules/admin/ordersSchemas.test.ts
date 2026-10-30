import { describe, expect, it } from 'vitest';
import { orderDateRangeSchema, orderRangeErrors } from './ordersSchemas';

// The Orders list's custom date range (ORD-02, OR-3, UIC-45; plan 08-09): the rules the toolbar shows before any request is sent.

const NOT_REAL = 'Enter a real date.';
const ORDER = "The end date can't be before the start date.";

describe('orderRangeErrors', () => {
  it('passes a valid pair, including a range of one day (From equal to To)', () => {
    expect(orderRangeErrors({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: null, to: null });
    expect(orderRangeErrors({ from: '2026-10-05', to: '2026-10-05' })).toEqual({ from: null, to: null });
  });

  it('says "Enter a real date." under a date that does not exist', () => {
    expect(orderRangeErrors({ from: '2026-02-30', to: '2026-03-01' })).toEqual({ from: NOT_REAL, to: null });
    expect(orderRangeErrors({ from: '2026-03-01', to: '2026-13-01' })).toEqual({ from: null, to: NOT_REAL });
  });

  it('says "Enter a real date." under an empty date, so a half-filled range is not applied', () => {
    expect(orderRangeErrors({ from: '', to: '2026-03-01' })).toEqual({ from: NOT_REAL, to: null });
    expect(orderRangeErrors({ from: '2026-03-01', to: '' })).toEqual({ from: null, to: NOT_REAL });
    expect(orderRangeErrors({ from: '', to: '' })).toEqual({ from: NOT_REAL, to: NOT_REAL });
  });

  it("says the end date can't be before the start date for a reversed pair, under To", () => {
    expect(orderRangeErrors({ from: '2026-10-31', to: '2026-10-01' })).toEqual({ from: null, to: ORDER });
  });

  it('reports a real-date problem first and does not also report the order', () => {
    expect(orderRangeErrors({ from: '2026-02-30', to: '2026-01-01' })).toEqual({ from: NOT_REAL, to: null });
  });
});

describe('orderDateRangeSchema', () => {
  it('accepts a real pair in order and refuses a reversed one', () => {
    expect(orderDateRangeSchema.safeParse({ from: '2026-10-01', to: '2026-10-01' }).success).toBe(true);
    expect(orderDateRangeSchema.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(false);
  });
});
