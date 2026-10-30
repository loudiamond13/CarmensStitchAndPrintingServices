import { describe, expect, it } from 'vitest';
import { buildOrderDetail, orderDiscount } from '@/test/orderFixtures';
import {
  blankOrderDiscount,
  discountPreview,
  orderDiscountSchema,
  otherDiscountsTotal,
  type OrderDiscountFormInput,
} from './orderDiscountSchemas';

// The discount window rules (OR-3; OrderDiscountFieldsValidator.cs, OrderRules.cs; plan 08-17): the browser says what the server would,
// in the server's words, before a request is sent.

const SUBTOTAL = 22450;

function valid(overrides: Partial<OrderDiscountFormInput> = {}): OrderDiscountFormInput {
  return { kind: 'percentage', value: '5', reason: 'Barangay league discount', ...overrides };
}

/** The first message the schema gives for the field, or null when the field passes. */
function messageFor(
  field: keyof OrderDiscountFormInput,
  overrides: Partial<OrderDiscountFormInput>,
  others = 0,
  subtotal = SUBTOTAL,
) {
  const result = orderDiscountSchema(subtotal, others).safeParse(valid(overrides));
  if (result.success) {
    return null;
  }
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe('orderDiscountSchema accepts', () => {
  it('a percent discount, trimming the reason', () => {
    const result = orderDiscountSchema(SUBTOTAL, 0).safeParse(valid({ reason: '  Barangay league discount ' }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ kind: 'percentage', value: '5', reason: 'Barangay league discount' });
  });

  it('a fixed discount from 0.01 up to the items total', () => {
    expect(messageFor('value', { kind: 'fixed', value: '0.01' })).toBeNull();
    expect(messageFor('value', { kind: 'fixed', value: '22450.00' })).toBeNull();
  });

  it('a percent above 0 and up to 100, with 2 decimals', () => {
    expect(messageFor('value', { value: '0.01' })).toBeNull();
    expect(messageFor('value', { value: '7.5' })).toBeNull();
    expect(messageFor('value', { value: '100' })).toBeNull();
  });

  it('a reason of exactly 100 characters', () => {
    expect(messageFor('reason', { reason: 'a'.repeat(100) })).toBeNull();
  });
});

describe('orderDiscountSchema value, percent', () => {
  it.each(['0', '0.00', '101', '100.01', '1000'])('refuses %s with the percentage words', (value) => {
    expect(messageFor('value', { value })).toBe('Enter a percentage above 0 and up to 100.');
  });

  it('asks for a value when it is empty', () => {
    expect(messageFor('value', { value: '' })).toBe('Enter a discount value.');
    expect(messageFor('value', { value: '   ' })).toBe('Enter a discount value.');
  });

  it('refuses a third decimal place', () => {
    expect(messageFor('value', { value: '5.555' })).toBe('Use at most 2 decimal places.');
  });

  it('refuses text that is not a number with the percentage words', () => {
    expect(messageFor('value', { value: 'abc' })).toBe('Enter a percentage above 0 and up to 100.');
  });

  it('does not apply the items-total cap to a percent of 100 on its own', () => {
    expect(messageFor('value', { value: '100' }, 0)).toBeNull();
  });

  it('refuses a percent that, with the other discounts, passes the items total', () => {
    expect(messageFor('value', { value: '60' }, 11225)).toBe(
      'The discounts would be more than the items total. Lower or remove a discount first.',
    );
    expect(messageFor('value', { value: '50' }, 11225)).toBeNull();
  });
});

describe('orderDiscountSchema value, fixed', () => {
  it.each(['0', '0.00', '1000000.01', '1000001'])('refuses %s with the fixed words', (value) => {
    expect(messageFor('value', { kind: 'fixed', value })).toBe('Enter a discount from ₱0.01 to ₱1,000,000.00.');
  });

  it('asks for a value when it is empty', () => {
    expect(messageFor('value', { kind: 'fixed', value: '' })).toBe('Enter a discount value.');
  });

  it('refuses a third decimal place', () => {
    expect(messageFor('value', { kind: 'fixed', value: '10.555' })).toBe('Use at most 2 decimal places.');
  });

  it('refuses a fixed value above the items total with the cap words', () => {
    expect(messageFor('value', { kind: 'fixed', value: '22450.01' })).toBe(
      'The discounts would be more than the items total. Lower or remove a discount first.',
    );
  });

  it('counts the other discounts against the items total, to the centavo', () => {
    expect(messageFor('value', { kind: 'fixed', value: '21327.50' }, 1122.5)).toBeNull();
    expect(messageFor('value', { kind: 'fixed', value: '21327.51' }, 1122.5)).toBe(
      'The discounts would be more than the items total. Lower or remove a discount first.',
    );
  });
});

describe('orderDiscountSchema kind and reason', () => {
  it('refuses a kind that is not fixed or percentage', () => {
    expect(messageFor('kind', { kind: 'other' })).toBe('Choose fixed or percentage.');
  });

  it('asks for a reason, also when it is only spaces', () => {
    expect(messageFor('reason', { reason: '' })).toBe('Enter a reason for the discount.');
    expect(messageFor('reason', { reason: '   ' })).toBe('Enter a reason for the discount.');
  });

  it('refuses a reason of 101 characters after trimming', () => {
    expect(messageFor('reason', { reason: 'a'.repeat(101) })).toBe('Keep the reason to 100 characters or fewer.');
    expect(messageFor('reason', { reason: ` ${'a'.repeat(100)} ` })).toBeNull();
  });
});

describe('blankOrderDiscount', () => {
  it('starts Fixed with nothing typed', () => {
    expect(blankOrderDiscount()).toEqual({ kind: 'fixed', value: '', reason: '' });
  });
});

describe('discountPreview', () => {
  it('works out a percent of the server subtotal, half away from zero', () => {
    expect(discountPreview('percentage', '5', SUBTOTAL)).toBe('1122.50');
    expect(discountPreview('percentage', '7.5', 17)).toBe('1.28');
  });

  it('shows a fixed value as typed', () => {
    expect(discountPreview('fixed', '500', SUBTOTAL)).toBe('500.00');
  });

  it('is 0.00 while the value is empty or not a number', () => {
    expect(discountPreview('percentage', '', SUBTOTAL)).toBe('0.00');
    expect(discountPreview('fixed', '.', SUBTOTAL)).toBe('0.00');
    expect(discountPreview('percentage', 'abc', SUBTOTAL)).toBe('0.00');
  });
});

describe('otherDiscountsTotal', () => {
  it('adds the amounts of the other discounts over the server subtotal', () => {
    const order = buildOrderDetail({
      discounts: [
        orderDiscount('percentage', 5, 'League', 1122.5, { id: 'a' }),
        orderDiscount('fixed', 500, 'Club', 500, { id: 'b' }),
      ],
    });

    expect(otherDiscountsTotal(order, undefined)).toBe(1622.5);
    expect(otherDiscountsTotal(order, 'a')).toBe(500);
    expect(otherDiscountsTotal(order, 'b')).toBe(1122.5);
  });

  it('is 0 for an order with no discounts', () => {
    expect(otherDiscountsTotal(buildOrderDetail({ discounts: [] }), undefined)).toBe(0);
  });
});
