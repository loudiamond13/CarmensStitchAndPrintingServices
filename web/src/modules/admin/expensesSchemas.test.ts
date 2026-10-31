import { describe, expect, it } from 'vitest';
import { expenseFormSchema, expenseRangeErrors } from './expensesSchemas';

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

// The Add Expense form (OR-3, D-19, D-20, D-21; plan 06-12): every rule the server validates, with the server's own words.

const TODAY = '2026-10-25';
const CATEGORY = '447ad32e-1433-4b70-8786-72e3dc3f9937';
const PAYER = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';

const VALID = {
  date: TODAY,
  categoryId: CATEGORY,
  description: 'Thread and needles',
  amount: '640.00',
  paidByUserId: PAYER,
  notes: '',
};

/** The message under each field the form fails on; empty when it passes. */
function messages(overrides: Partial<typeof VALID>): Record<string, string> {
  const result = expenseFormSchema(TODAY).safeParse({ ...VALID, ...overrides });
  const found: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      found[field] ??= issue.message;
    }
  }
  return found;
}

describe('expenseFormSchema', () => {
  it('passes a complete form and gives null for empty notes', () => {
    const result = expenseFormSchema(TODAY).safeParse(VALID);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ...VALID, notes: null });
  });

  it('trims the description and the notes', () => {
    const result = expenseFormSchema(TODAY).safeParse({ ...VALID, description: '  Rent  ', notes: '  paid in cash  ' });

    expect(result.data).toMatchObject({ description: 'Rent', notes: 'paid in cash' });
  });

  describe('date', () => {
    it('asks for the date when it is empty', () => {
      expect(messages({ date: '' })).toEqual({ date: 'Enter the date.' });
    });

    it('says "Enter a real date." for a day that does not exist or text that is not a date', () => {
      expect(messages({ date: '2026-02-30' })).toEqual({ date: 'Enter a real date.' });
      expect(messages({ date: 'tomorrow' })).toEqual({ date: 'Enter a real date.' });
    });

    it('names the 30-day limit from the server today when the date is later', () => {
      expect(messages({ date: '2026-11-25' })).toEqual({
        date: 'Choose a date up to 30 days from today, Nov 24, 2026 at the latest.',
      });
    });

    it('counts the limit across a month and a year end from the server today', () => {
      const result = expenseFormSchema('2026-12-15').safeParse({ ...VALID, date: '2027-01-14' });
      expect(result.success).toBe(true);
      const late = expenseFormSchema('2026-12-15').safeParse({ ...VALID, date: '2027-01-15' });
      expect(late.error?.issues[0]?.message).toBe(
        'Choose a date up to 30 days from today, Jan 14, 2027 at the latest.',
      );
    });

    it('accepts today, any past date and exactly today plus 30 days', () => {
      expect(messages({ date: TODAY })).toEqual({});
      expect(messages({ date: '2020-01-01' })).toEqual({});
      expect(messages({ date: '2026-11-24' })).toEqual({});
    });
  });

  describe('category', () => {
    it('asks for a category when none is chosen', () => {
      expect(messages({ categoryId: '' })).toEqual({ categoryId: 'Choose a category.' });
    });
  });

  describe('description', () => {
    it('asks for a description when it is only spaces', () => {
      expect(messages({ description: '   ' })).toEqual({
        description: 'Add a short description so others know what this was for.',
      });
    });

    it('refuses 201 characters and accepts 200', () => {
      expect(messages({ description: 'a'.repeat(201) })).toEqual({
        description: 'Keep the description to 200 characters or fewer.',
      });
      expect(messages({ description: 'a'.repeat(200) })).toEqual({});
    });
  });

  describe('amount', () => {
    it.each(['', '.', '0', '0.00', '0.'])('says the amount must be more than zero for "%s"', (amount) => {
      expect(messages({ amount })).toEqual({ amount: 'Enter an amount greater than ₱0.00.' });
    });

    it('refuses an amount over the cap and accepts the cap', () => {
      expect(messages({ amount: '1000000.01' })).toEqual({ amount: 'Enter an amount of ₱1,000,000.00 or less.' });
      expect(messages({ amount: '9999999' })).toEqual({ amount: 'Enter an amount of ₱1,000,000.00 or less.' });
      expect(messages({ amount: '1000000.00' })).toEqual({});
    });

    it('refuses more than 2 decimal places', () => {
      expect(messages({ amount: '12.345' })).toEqual({ amount: 'Use at most 2 decimal places.' });
    });

    it('accepts the smallest amount, 0.01', () => {
      expect(messages({ amount: '0.01' })).toEqual({});
    });

    it('refuses text that is not an amount', () => {
      expect(messages({ amount: 'abc' })).toEqual({
        amount: 'Enter an amount like 1250.50 (numbers only, up to 2 decimals).',
      });
    });
  });

  describe('paid by', () => {
    it('asks who paid when nobody is chosen', () => {
      expect(messages({ paidByUserId: '' })).toEqual({ paidByUserId: 'Choose who paid.' });
    });
  });

  describe('editing a saved expense (OQ-7, D-11)', () => {
    it('accepts the saved payer and category ids whatever their state: the server decides if they are active', () => {
      expect(
        messages({
          paidByUserId: '00000000-0000-4000-8000-0000000000b1',
          categoryId: '0b1d6f6e-3c3a-4d6e-9b7a-5c1f0e2a7d11',
        }),
      ).toEqual({});
    });

    it('accepts a saved date in the past and keeps the 30-day limit from the business today', () => {
      expect(messages({ date: '2025-01-31' })).toEqual({});
      expect(messages({ date: '2026-11-25' })).toEqual({
        date: 'Choose a date up to 30 days from today, Nov 24, 2026 at the latest.',
      });
    });
  });

  describe('notes', () => {
    it('refuses 1,001 characters and accepts 1,000', () => {
      expect(messages({ notes: 'n'.repeat(1001) })).toEqual({ notes: 'Keep notes to 1,000 characters or fewer.' });
      expect(messages({ notes: 'n'.repeat(1000) })).toEqual({});
    });
  });
});

// An edit applies the amount cap and the description and notes lengths only to a value it changes, so an imported row over a
// limit stays editable (D-33, A-WR-01). It mirrors ExpenseFieldsValidator with the stored values.
describe('expenseFormSchema on an edit with stored values over a limit (D-33)', () => {
  const STORED = { description: 'd'.repeat(250), amount: 1_500_000, notes: 'n'.repeat(1200) };
  const LEGACY = { ...VALID, description: STORED.description, amount: '1500000.00', notes: STORED.notes };

  function editMessages(overrides: Partial<typeof VALID>, stored = STORED): Record<string, string> {
    const result = expenseFormSchema(TODAY, stored).safeParse({ ...LEGACY, ...overrides });
    const found: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        found[String(issue.path[0])] ??= issue.message;
      }
    }
    return found;
  }

  it('passes the legacy over-cap amount, description and notes when they are unchanged', () => {
    expect(editMessages({})).toEqual({});
    expect(editMessages({ categoryId: '0b1d6f6e-3c3a-4d6e-9b7a-5c1f0e2a7d11' })).toEqual({});
  });

  it('compares after the trim, as the server does', () => {
    expect(editMessages({ description: `  ${STORED.description}  `, notes: ` ${STORED.notes} ` })).toEqual({});
  });

  it('blocks a change to another amount over the cap', () => {
    expect(editMessages({ amount: '1500000.01' })).toEqual({ amount: 'Enter an amount of ₱1,000,000.00 or less.' });
    expect(editMessages({ amount: '2000000' })).toEqual({ amount: 'Enter an amount of ₱1,000,000.00 or less.' });
  });

  it('passes a change to an amount at or under the cap', () => {
    expect(editMessages({ amount: '1000000.00' })).toEqual({});
  });

  it('blocks a changed description or notes over its limit', () => {
    expect(editMessages({ description: 'e'.repeat(201) })).toEqual({
      description: 'Keep the description to 200 characters or fewer.',
    });
    expect(editMessages({ notes: 'm'.repeat(1001) })).toEqual({ notes: 'Keep notes to 1,000 characters or fewer.' });
  });

  it('keeps the other rules for an unchanged amount: it still needs at most 2 decimals and more than zero', () => {
    expect(editMessages({ amount: '12.345' })).toEqual({ amount: 'Use at most 2 decimal places.' });
    expect(editMessages({ amount: '0' })).toEqual({ amount: 'Enter an amount greater than ₱0.00.' });
  });

  it('keeps every limit on Add, where nothing is stored', () => {
    expect(messages({ amount: '1500000.00' })).toEqual({ amount: 'Enter an amount of ₱1,000,000.00 or less.' });
    expect(messages({ description: STORED.description })).toEqual({
      description: 'Keep the description to 200 characters or fewer.',
    });
    expect(messages({ notes: STORED.notes })).toEqual({ notes: 'Keep notes to 1,000 characters or fewer.' });
  });
});
