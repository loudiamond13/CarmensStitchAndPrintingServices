import { describe, expect, it } from 'vitest';
import {
  blankOrderRefund,
  orderRefundSchema,
  refundCapKind,
  type OrderRefundFormInput,
  type RefundCapKind,
} from './orderRefundSchemas';

// The refund window rules (OR-3; OrderRefundFieldsValidator.cs, OrderRules.cs; plan 08-21): the browser says what the server would,
// in the server's words, before a request is sent. The cap is a preview from the server's figures.

const TODAY = '2026-10-08';
const PERSON_ID = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';

function valid(overrides: Partial<OrderRefundFormInput> = {}): OrderRefundFormInput {
  return {
    refundDate: TODAY,
    amount: '500.00',
    reason: 'Customer changed the order',
    refundedByUserId: PERSON_ID,
    ...overrides,
  };
}

/** The first message the schema gives for the field, or null when the field passes. */
function messageFor(
  field: keyof OrderRefundFormInput,
  overrides: Partial<OrderRefundFormInput>,
  cap = '1000.00',
  kind: RefundCapKind = 'credit',
) {
  const result = orderRefundSchema(TODAY, cap, kind).safeParse(valid(overrides));
  if (result.success) {
    return null;
  }
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe('orderRefundSchema accepts', () => {
  it('a full refund and trims the reason', () => {
    const result = orderRefundSchema(TODAY, '1000.00', 'credit').safeParse(valid({ reason: '  Wrong size  ' }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      refundDate: TODAY,
      amount: '500.00',
      reason: 'Wrong size',
      refundedByUserId: PERSON_ID,
    });
  });

  it('a refund dated before today and one dated today', () => {
    expect(messageFor('refundDate', { refundDate: '2020-01-01' })).toBeNull();
    expect(messageFor('refundDate', { refundDate: TODAY })).toBeNull();
  });

  it('exactly the cap, to the centavo', () => {
    expect(messageFor('amount', { amount: '1000.00' })).toBeNull();
  });

  it('a reason of exactly 200 characters after trimming', () => {
    expect(messageFor('reason', { reason: ` ${'a'.repeat(200)} ` })).toBeNull();
  });
});

describe('orderRefundSchema date', () => {
  it('asks for a date when empty', () => {
    expect(messageFor('refundDate', { refundDate: '' })).toBe('Enter the refund date.');
  });

  it('refuses a day that is not real', () => {
    expect(messageFor('refundDate', { refundDate: '2026-02-30' })).toBe('Enter a real date.');
  });

  it('refuses a date after the server today', () => {
    expect(messageFor('refundDate', { refundDate: '2026-10-09' })).toBe("The refund date can't be in the future.");
  });
});

describe('orderRefundSchema amount', () => {
  it('asks for an amount when empty', () => {
    expect(messageFor('amount', { amount: '' })).toBe('Enter the amount.');
  });

  it('refuses zero and an amount above 1,000,000.00', () => {
    expect(messageFor('amount', { amount: '0.00' })).toBe('Enter an amount from ₱0.01 to ₱1,000,000.00.');
    expect(messageFor('amount', { amount: '1000000.01' }, '2000000.00')).toBe(
      'Enter an amount from ₱0.01 to ₱1,000,000.00.',
    );
  });

  it('refuses more than 2 decimal places', () => {
    expect(messageFor('amount', { amount: '10.005' })).toBe('Use at most 2 decimal places.');
  });

  it('refuses more than the customer credit, in the server words', () => {
    expect(messageFor('amount', { amount: '1000.01' })).toBe(
      'This is more than the customer credit. Enter ₱1,000.00 or less.',
    );
  });

  it('refuses more than was paid and not yet refunded on a cancelled order, in the server words', () => {
    expect(messageFor('amount', { amount: '11500.01' }, '11500.00', 'cancelled')).toBe(
      'This is more than was paid and not yet refunded. Enter ₱11,500.00 or less.',
    );
  });

  it('says everything paid was already refunded when the cancelled cap is zero', () => {
    expect(messageFor('amount', { amount: '1.00' }, '0.00', 'cancelled')).toBe(
      'Everything that was paid has already been refunded.',
    );
  });

  it('keeps the credit sentence when the credit cap is zero', () => {
    expect(messageFor('amount', { amount: '1.00' }, '0.00', 'credit')).toBe(
      'This is more than the customer credit. Enter ₱0.00 or less.',
    );
  });
});

describe('orderRefundSchema reason and refunder', () => {
  it('asks for a reason when empty or blank', () => {
    expect(messageFor('reason', { reason: '' })).toBe('Add a short reason for the refund.');
    expect(messageFor('reason', { reason: '   ' })).toBe('Add a short reason for the refund.');
  });

  it('refuses a reason longer than 200 characters after trimming', () => {
    expect(messageFor('reason', { reason: 'a'.repeat(201) })).toBe('Keep the reason to 200 characters or fewer.');
  });

  it('asks who handed the money back', () => {
    expect(messageFor('refundedByUserId', { refundedByUserId: '' })).toBe('Choose who handed the money back.');
  });
});

describe('blankOrderRefund', () => {
  it('starts on the server today and the signed-in person, with no amount or reason', () => {
    expect(blankOrderRefund(TODAY, PERSON_ID)).toEqual({
      refundDate: TODAY,
      amount: '',
      reason: '',
      refundedByUserId: PERSON_ID,
    });
  });

  it('can start with an amount filled in (Record Refund, D-19)', () => {
    expect(blankOrderRefund(TODAY, PERSON_ID, '1000.00').amount).toBe('1000.00');
  });
});

describe('refundCapKind', () => {
  it('is cancelled for a Cancelled order and credit for any other', () => {
    expect(refundCapKind({ status: 'cancelled' })).toBe('cancelled');
    expect(refundCapKind({ status: 'ready' })).toBe('credit');
  });
});
