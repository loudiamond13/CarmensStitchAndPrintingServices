// @vitest-environment node
// The exact-rational oracle behind tests/fixtures/order-math-golden-vectors.json (WEB-07, D-09). These are hand-worked
// figures; the oracle shares no code with Csps.Domain.Orders.OrderMath or web/src/utils/csps.ts.
import { describe, expect, it } from 'vitest';
import { OPERATION_ORDER, computeExpected, formatCentavos, type VectorInput } from './golden-math.mjs';

function percentOf(unitPrice: string, percent: string, quantity = 1): VectorInput {
  return {
    items: [{ quantity, unitPrice }],
    discounts: [{ kind: 'percentage', value: percent }],
    payments: [],
    expenses: [],
  };
}

describe('computeExpected', () => {
  it('pins the operation order text (D-09)', () => {
    expect(OPERATION_ORDER).toBe(
      'round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)',
    );
  });

  it('rounds 7.5% of 17.00 (1.275) away from zero to 1.28', () => {
    expect(computeExpected(percentOf('17.00', '7.5')).discount).toBe('1.28');
  });

  it('rounds 7.5% of 3 x 17.00 (3.825) away from zero to 3.83', () => {
    expect(computeExpected(percentOf('17.00', '7.5', 3)).discount).toBe('3.83');
  });

  it('rounds 2.5% of 23.00 (0.575) away from zero to 0.58', () => {
    expect(computeExpected(percentOf('23.00', '2.5')).discount).toBe('0.58');
  });

  it('rounds 12.5% of 1.16 (0.145) away from zero to 0.15', () => {
    expect(computeExpected(percentOf('1.16', '12.5')).discount).toBe('0.15');
  });

  it('rounds the items total before the percentage: 3 x 0.335 = 1.005 -> 1.01, and 10% of 1.01 = 0.101 -> 0.10', () => {
    const expected = computeExpected(percentOf('0.335', '10', 3));
    expect(expected.subtotal).toBe('1.01');
    expect(expected.discount).toBe('0.10');
  });

  it('rounds each discount before the sum: fixed 1.005 + fixed 1.005 = 2.02, not 2.01', () => {
    const input: VectorInput = {
      items: [{ quantity: 1, unitPrice: '100.00' }],
      discounts: [
        { kind: 'fixed', value: '1.005' },
        { kind: 'fixed', value: '1.005' },
      ],
      payments: [],
      expenses: [],
    };
    expect(computeExpected(input).discount).toBe('2.02');
  });

  it('computes ORD-2026-0151 as fully paid: Total = Subtotal - Discount and Balance = Total - Paid (PRD 5.1, D-41 R2-06)', () => {
    const input: VectorInput = {
      items: [{ quantity: 20, unitPrice: '1150.00' }],
      discounts: [{ kind: 'fixed', value: '500.00' }],
      payments: ['12000.00', '10500.00'],
      expenses: ['7200.00', '2100.00'],
    };
    expect(computeExpected(input)).toEqual({
      subtotal: '23000.00',
      discount: '500.00',
      total: '22500.00',
      paid: '22500.00',
      balance: '0.00',
      expenses: '9300.00',
      profit: '13200.00',
      fullyPaid: true,
    });
  });

  it('computes ORD-2026-0148 from the approved figures', () => {
    const input: VectorInput = {
      items: [
        { quantity: 15, unitPrice: '650.00' },
        { quantity: 15, unitPrice: '300.00' },
        { quantity: 2, unitPrice: '550.00' },
        { quantity: 15, unitPrice: '420.00' },
        { quantity: 1, unitPrice: '800.00' },
      ],
      discounts: [{ kind: 'percentage', value: '5' }],
      payments: ['10000.00', '2000.00'],
      expenses: ['3825.00', '1640.00', '600.00'],
    };
    expect(computeExpected(input)).toEqual({
      subtotal: '22450.00',
      discount: '1122.50',
      total: '21327.50',
      paid: '12000.00',
      balance: '9327.50',
      expenses: '6065.00',
      profit: '15262.50',
      fullyPaid: false,
    });
  });

  it('gives total 0 and balance 0 minus payments on a 100% discount', () => {
    const input: VectorInput = { ...percentOf('17.00', '100', 3), payments: ['20.00'] };
    expect(computeExpected(input)).toMatchObject({
      subtotal: '51.00',
      discount: '51.00',
      total: '0.00',
      balance: '-20.00',
    });
  });

  // D-41 R2-06 (owner, 2026-10-13): NET-IN-01 is ruled keep. Fully paid is Subtotal > 0 and Balance <= 0, so a fully
  // discounted order with no payment reads "Fully Paid", and an empty order does not.
  it('is fully paid on a 100% discount with no payment (NET-IN-01 ruled keep)', () => {
    expect(computeExpected(percentOf('17.00', '100', 3))).toEqual({
      subtotal: '51.00',
      discount: '51.00',
      total: '0.00',
      paid: '0.00',
      balance: '0.00',
      expenses: '0.00',
      profit: '0.00',
      fullyPaid: true,
    });
  });

  it('returns the PRD 5.1 names in a fixed order (D-41 R2-06)', () => {
    expect(Object.keys(computeExpected(percentOf('17.00', '5')))).toEqual([
      'subtotal',
      'discount',
      'total',
      'paid',
      'balance',
      'expenses',
      'profit',
      'fullyPaid',
    ]);
  });

  it('gives a negative balance when payments exceed what is owed', () => {
    const input: VectorInput = {
      items: [{ quantity: 1, unitPrice: '100.00' }],
      discounts: [],
      payments: ['150.00'],
      expenses: [],
    };
    expect(computeExpected(input).balance).toBe('-50.00');
  });

  it('is not fully paid when there are no items', () => {
    expect(computeExpected({ items: [], discounts: [], payments: [], expenses: [] })).toEqual({
      subtotal: '0.00',
      discount: '0.00',
      total: '0.00',
      paid: '0.00',
      balance: '0.00',
      expenses: '0.00',
      profit: '0.00',
      fullyPaid: false,
    });
  });

  it('computes the largest items total exactly', () => {
    const input: VectorInput = { ...percentOf('999999999.99', '7.5'), payments: ['999999999.99'] };
    expect(computeExpected(input)).toMatchObject({
      subtotal: '999999999.99',
      discount: '75000000.00',
      total: '924999999.99',
      balance: '-75000000.00',
    });
  });

  it.for(['1e3', '', '1,250', ' 5', '+5'])('rejects %j, which is not a plain decimal string', (amount) => {
    expect(() => computeExpected({ items: [], discounts: [], payments: [amount], expenses: [] })).toThrow(
      `Not a decimal amount: ${JSON.stringify(amount)}`,
    );
  });

  it('rejects a quantity that is not a whole number', () => {
    expect(() => computeExpected(percentOf('1.00', '5', 1.5))).toThrow('Not a whole quantity: 1.5');
  });
});

describe('formatCentavos', () => {
  it.for([
    [125050n, '1250.50'],
    [5n, '0.05'],
    [0n, '0.00'],
    [-73250n, '-732.50'],
    [-5n, '-0.05'],
    [99999999999n, '999999999.99'],
  ] as const)('writes %s centavos as %j (two decimals, ASCII minus)', ([centavos, text]) => {
    expect(formatCentavos(centavos)).toBe(text);
  });
});
