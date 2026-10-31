import { describe, expect, it } from 'vitest';
import { buildOrderDetail, CASH, order0148, orderPayment } from '@/test/orderFixtures';
import {
  blankOrderPayment,
  isOverPaymentCap,
  orderPaymentSchema,
  paymentCap,
  wouldLeavePaymentsBelowRefunds,
  type OrderPaymentFormInput,
} from './orderPaymentSchemas';

// The payment window rules (OR-3; OrderPaymentFieldsValidator.cs, OrderRules.cs; plan 08-16): the browser says what the server would,
// in the server's words, before a request is sent.

const TODAY = '2026-10-08';
const CAP = '9327.50';
const METHOD_ID = '7a2b9e10-3c55-4a1d-8e7f-4c0d2e5a0002';
const PERSON_ID = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';

function valid(overrides: Partial<OrderPaymentFormInput> = {}): OrderPaymentFormInput {
  return {
    paymentDate: TODAY,
    amount: '2000.00',
    paymentMethodId: METHOD_ID,
    reference: '',
    notes: '',
    receivedByUserId: PERSON_ID,
    ...overrides,
  };
}

/** The first message the schema gives for the field, or null when the field passes. */
function messageFor(field: keyof OrderPaymentFormInput, overrides: Partial<OrderPaymentFormInput>, cap = CAP) {
  const result = orderPaymentSchema(TODAY, cap).safeParse(valid(overrides));
  if (result.success) {
    return null;
  }
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe('orderPaymentSchema accepts', () => {
  it('a full payment and trims the text, with an empty reference and notes as null', () => {
    const result = orderPaymentSchema(TODAY, CAP).safeParse(valid({ reference: '  9012 345  ', notes: '   ' }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      paymentDate: TODAY,
      amount: '2000.00',
      paymentMethodId: METHOD_ID,
      reference: '9012 345',
      notes: null,
      receivedByUserId: PERSON_ID,
    });
  });

  it('a payment dated before the order date, and one dated today (07 D-41)', () => {
    expect(messageFor('paymentDate', { paymentDate: '2020-01-01' })).toBeNull();
    expect(messageFor('paymentDate', { paymentDate: TODAY })).toBeNull();
  });

  it('exactly the balance, to the centavo', () => {
    expect(messageFor('amount', { amount: '9327.50' })).toBeNull();
  });
});

describe('orderPaymentSchema date', () => {
  it('asks for a date', () => {
    expect(messageFor('paymentDate', { paymentDate: '' })).toBe('Enter the payment date.');
  });

  it('refuses a date that is not real', () => {
    expect(messageFor('paymentDate', { paymentDate: '2026-02-30' })).toBe('Enter a real date.');
  });

  it("refuses a date after the server's today", () => {
    expect(messageFor('paymentDate', { paymentDate: '2026-10-09' })).toBe("The payment date can't be in the future.");
  });
});

describe('orderPaymentSchema amount', () => {
  it('asks for an amount', () => {
    expect(messageFor('amount', { amount: '' })).toBe('Enter the amount.');
    expect(messageFor('amount', { amount: '.' })).toBe('Enter the amount.');
  });

  it('refuses zero and anything above one million', () => {
    const range = 'Enter an amount from ₱0.01 to ₱1,000,000.00.';
    expect(messageFor('amount', { amount: '0' })).toBe(range);
    expect(messageFor('amount', { amount: '0.00' })).toBe(range);
    expect(messageFor('amount', { amount: '1000000.01' }, '2000000.00')).toBe(range);
    expect(messageFor('amount', { amount: '1000000.00' }, '2000000.00')).toBeNull();
  });

  it('refuses more than two decimals', () => {
    expect(messageFor('amount', { amount: '10.005' })).toBe('Use at most 2 decimal places.');
  });

  it('refuses an amount above the balance and names the most that can be paid', () => {
    expect(messageFor('amount', { amount: '9327.51' })).toBe('This is more than the balance. Enter ₱9,327.50 or less.');
  });

  it('says nothing is owed when the cap is zero', () => {
    expect(messageFor('amount', { amount: '1.00' }, '0.00')).toBe('Nothing is owed on this order.');
  });

  it('refuses text that is not an amount', () => {
    expect(messageFor('amount', { amount: 'abc' })).not.toBeNull();
  });
});

describe('orderPaymentSchema the other fields', () => {
  it('asks for a method, with nothing chosen at the start (D-29)', () => {
    expect(messageFor('paymentMethodId', { paymentMethodId: '' })).toBe('Choose a payment method.');
  });

  it('asks for who received the money', () => {
    expect(messageFor('receivedByUserId', { receivedByUserId: '' })).toBe('Choose who received the money.');
  });

  it('keeps the reference to 100 characters and the notes to 500 after trimming', () => {
    expect(messageFor('reference', { reference: 'r'.repeat(100) })).toBeNull();
    expect(messageFor('reference', { reference: 'r'.repeat(101) })).toBe(
      'Keep the reference to 100 characters or fewer.',
    );
    expect(messageFor('notes', { notes: 'n'.repeat(500) })).toBeNull();
    expect(messageFor('notes', { notes: 'n'.repeat(501) })).toBe('Keep notes to 500 characters or fewer.');
    expect(messageFor('reference', { reference: ` ${'r'.repeat(100)} ` })).toBeNull();
  });
});

describe('blankOrderPayment', () => {
  it('starts on the server today with no amount, no method and the signed-in person (D-11, D-29)', () => {
    expect(blankOrderPayment(TODAY, PERSON_ID)).toEqual({
      paymentDate: TODAY,
      amount: '',
      paymentMethodId: '',
      reference: '',
      notes: '',
      receivedByUserId: PERSON_ID,
    });
  });
});

describe('paymentCap', () => {
  it('is the server balance on an add', () => {
    expect(paymentCap(order0148)).toBe('9327.50');
  });

  it("is the server balance plus the payment's saved amount on an edit", () => {
    expect(paymentCap(order0148, 2000)).toBe('11327.50');
    expect(paymentCap(order0148, '2000.00')).toBe('11327.50');
  });

  it('is zero when nothing is owed, and never below zero', () => {
    const paid = buildOrderDetail({ totals: { ...order0148.totals, balance: 0 } });
    const credit = buildOrderDetail({ totals: { ...order0148.totals, balance: -500, customerCredit: 500 } });

    expect(paymentCap(paid)).toBe('0.00');
    expect(paymentCap(credit)).toBe('0.00');
    expect(paymentCap(credit, 300)).toBe('0.00');
    expect(paymentCap(credit, 700)).toBe('200.00');
  });
});

describe('isOverPaymentCap', () => {
  it('is true for a well-formed amount above the cap', () => {
    expect(isOverPaymentCap('9327.51', CAP)).toBe(true);
    expect(isOverPaymentCap('12000', CAP)).toBe(true);
    expect(isOverPaymentCap('1.00', '0.00')).toBe(true);
  });

  it('is false for an amount within the cap, at the cap or empty', () => {
    expect(isOverPaymentCap('9327.50', CAP)).toBe(false);
    expect(isOverPaymentCap('1.00', CAP)).toBe(false);
    expect(isOverPaymentCap('', CAP)).toBe(false);
    expect(isOverPaymentCap('.', CAP)).toBe(false);
  });

  it('is false when another rule fails first: three decimals, out of range, not an amount', () => {
    expect(isOverPaymentCap('10000.005', CAP)).toBe(false);
    expect(isOverPaymentCap('0', CAP)).toBe(false);
    expect(isOverPaymentCap('1000000.01', '2000000.00')).toBe(false);
    expect(isOverPaymentCap('abc', CAP)).toBe(false);
  });
});

describe('wouldLeavePaymentsBelowRefunds', () => {
  const payment = orderPayment('2026-10-03', CASH, 2000);

  it('is false when there are no refunds', () => {
    expect(wouldLeavePaymentsBelowRefunds(order0148, payment)).toBe(false);
  });

  it('is true when the payments left would be less than the refunds', () => {
    const refunded = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 11000 } });
    expect(wouldLeavePaymentsBelowRefunds(refunded, payment)).toBe(true);
  });

  it('is false when the payments left still cover the refunds exactly', () => {
    const refunded = buildOrderDetail({ totals: { ...order0148.totals, paid: 12000, refunded: 10000 } });
    expect(wouldLeavePaymentsBelowRefunds(refunded, payment)).toBe(false);
  });
});
