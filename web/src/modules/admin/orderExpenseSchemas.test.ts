import { describe, expect, it } from 'vitest';
import {
  blankOrderExpense,
  orderExpenseSchema,
  type OrderExpenseFormInput,
} from './orderExpenseSchemas';

// The order expense window rules (OR-3; OrderExpenseFieldsValidator.cs; plan 08-18): the browser says what the server would, in the
// server's words, before a request is sent.

const TODAY = '2026-10-08';
const CATEGORY_ID = '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0001';
const PERSON_ID = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';

function valid(overrides: Partial<OrderExpenseFormInput> = {}): OrderExpenseFormInput {
  return {
    expenseDate: TODAY,
    orderExpenseCategoryId: CATEGORY_ID,
    description: 'Dri-fit mesh, 45 yds',
    amount: '3825.00',
    paidByUserId: PERSON_ID,
    ...overrides,
  };
}

/** The first message the schema gives for the field, or null when the field passes. */
function messageFor(field: keyof OrderExpenseFormInput, overrides: Partial<OrderExpenseFormInput>) {
  const result = orderExpenseSchema(TODAY).safeParse(valid(overrides));
  if (result.success) {
    return null;
  }
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe('orderExpenseSchema accepts', () => {
  it('a full expense, trimming the description', () => {
    const result = orderExpenseSchema(TODAY).safeParse(valid({ description: '  Dri-fit mesh  ' }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      expenseDate: TODAY,
      orderExpenseCategoryId: CATEGORY_ID,
      description: 'Dri-fit mesh',
      amount: '3825.00',
      paidByUserId: PERSON_ID,
    });
  });

  it('an empty description as null (the description is optional)', () => {
    const result = orderExpenseSchema(TODAY).safeParse(valid({ description: '   ' }));

    expect(result.success).toBe(true);
    expect(result.data?.description).toBeNull();
  });

  it('a past day, today, and the last day 30 days ahead', () => {
    expect(messageFor('expenseDate', { expenseDate: '2020-01-01' })).toBeNull();
    expect(messageFor('expenseDate', { expenseDate: TODAY })).toBeNull();
    expect(messageFor('expenseDate', { expenseDate: '2026-11-07' })).toBeNull();
  });

  it('the smallest and the largest amount', () => {
    expect(messageFor('amount', { amount: '0.01' })).toBeNull();
    expect(messageFor('amount', { amount: '1000000.00' })).toBeNull();
    expect(messageFor('amount', { amount: '1000000' })).toBeNull();
  });

  it('a description of exactly 200 characters', () => {
    expect(messageFor('description', { description: 'x'.repeat(200) })).toBeNull();
  });
});

describe('orderExpenseSchema date', () => {
  it('asks for the date when it is empty', () => {
    expect(messageFor('expenseDate', { expenseDate: '' })).toBe('Enter the date.');
  });

  it('refuses text that is not a real day', () => {
    expect(messageFor('expenseDate', { expenseDate: '2026-02-30' })).toBe('Enter a real date.');
    expect(messageFor('expenseDate', { expenseDate: 'soon' })).toBe('Enter a real date.');
  });

  it('refuses a day 31 days after today, naming the latest day', () => {
    expect(messageFor('expenseDate', { expenseDate: '2026-11-08' })).toBe(
      'Choose a date up to 30 days from today, Nov 7, 2026 at the latest.',
    );
  });
});

describe('orderExpenseSchema category and payer', () => {
  it('asks for a category', () => {
    expect(messageFor('orderExpenseCategoryId', { orderExpenseCategoryId: '' })).toBe('Choose a category.');
  });

  it('asks for who paid', () => {
    expect(messageFor('paidByUserId', { paidByUserId: '' })).toBe('Choose who paid.');
  });
});

describe('orderExpenseSchema description', () => {
  it('refuses a description over 200 characters', () => {
    expect(messageFor('description', { description: 'x'.repeat(201) })).toBe(
      'Keep the description to 200 characters or fewer.',
    );
  });

  it('counts the trimmed text', () => {
    expect(messageFor('description', { description: ` ${'x'.repeat(200)} ` })).toBeNull();
  });
});

describe('orderExpenseSchema amount', () => {
  it.each(['', '.', '0', '0.00', '0.0'])('refuses %j with the greater-than-zero words', (amount) => {
    expect(messageFor('amount', { amount })).toBe('Enter an amount greater than ₱0.00.');
  });

  it.each(['1000000.01', '1000001', '99999999999999'])('refuses %s with the too-large words', (amount) => {
    expect(messageFor('amount', { amount })).toBe('Enter an amount of ₱1,000,000.00 or less.');
  });

  it('refuses a third decimal place', () => {
    expect(messageFor('amount', { amount: '10.555' })).toBe('Use at most 2 decimal places.');
  });
});

describe('blankOrderExpense', () => {
  it('starts on the server today with the signed-in person as the payer and nothing else chosen', () => {
    expect(blankOrderExpense(TODAY, PERSON_ID)).toEqual({
      expenseDate: TODAY,
      orderExpenseCategoryId: '',
      description: '',
      amount: '',
      paidByUserId: PERSON_ID,
    });
  });
});
