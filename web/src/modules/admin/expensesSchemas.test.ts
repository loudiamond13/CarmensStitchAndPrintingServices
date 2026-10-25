import { describe, expect, it } from 'vitest';
import { expenseRangeErrors } from './expensesSchemas';

// The Company Expenses date range (OR-3; plan 06-07): the rules the list shows before any request is sent.

const NOT_REAL = 'Enter a real date.';
const ORDER = 'The start date must be on or before the end date.';

describe('expenseRangeErrors', () => {
  it('passes a valid pair, including one day', () => {
    expect(expenseRangeErrors({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: null, to: null });
    expect(expenseRangeErrors({ from: '2026-10-05', to: '2026-10-05' })).toEqual({ from: null, to: null });
  });

  it('says "Enter a real date." under a date that does not exist', () => {
    expect(expenseRangeErrors({ from: '2026-02-30', to: '2026-03-01' })).toEqual({ from: NOT_REAL, to: null });
    expect(expenseRangeErrors({ from: '2026-03-01', to: '2026-13-01' })).toEqual({ from: null, to: NOT_REAL });
  });

  it('says "Enter a real date." under an empty date', () => {
    expect(expenseRangeErrors({ from: '', to: '2026-03-01' })).toEqual({ from: NOT_REAL, to: null });
    expect(expenseRangeErrors({ from: '2026-03-01', to: '' })).toEqual({ from: null, to: NOT_REAL });
    expect(expenseRangeErrors({ from: '', to: '' })).toEqual({ from: NOT_REAL, to: NOT_REAL });
  });

  it('says the start date must be on or before the end date for a reversed pair, under From', () => {
    expect(expenseRangeErrors({ from: '2026-10-31', to: '2026-10-01' })).toEqual({ from: ORDER, to: null });
  });

  it('reports a real-date problem first and does not also report the order', () => {
    expect(expenseRangeErrors({ from: '2026-02-30', to: '2026-01-01' })).toEqual({ from: NOT_REAL, to: null });
  });
});
