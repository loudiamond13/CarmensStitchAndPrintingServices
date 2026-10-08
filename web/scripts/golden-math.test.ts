// @vitest-environment node
// The exact-rational oracle behind tests/fixtures/order-math-golden-vectors.json (WEB-07, D-09). These are hand-checked
// figures; the oracle shares no code with Csps.Domain.Orders.OrderMath or web/src/lib/csps.ts.
import { describe, expect, it } from 'vitest';
import { computeExpected, formatCentavos, type VectorInput } from './golden-math.mjs';

function percentOf(unitPrice: string, percent: string, quantity = '1'): VectorInput {
  return {
    items: [{ quantity, unitPrice }],
    discounts: [{ type: 'percentage', value: percent }],
    payments: [],
    expenses: [],
  };
}

describe('computeExpected', () => {
  it('rounds 7.5% of 17.00 (1.275) away from zero to 1.28', () => {
    expect(computeExpected(percentOf('17.00', '7.5')).discount).toBe('1.28');
  });

  it('rounds 7.5% of 3 x 17.00 (3.825) away from zero to 3.83', () => {
    expect(computeExpected(percentOf('17.00', '7.5', '3')).discount).toBe('3.83');
  });

  it('rounds 2.5% of 23.00 (0.575) away from zero to 0.58', () => {
    expect(computeExpected(percentOf('23.00', '2.5')).discount).toBe('0.58');
  });

  it('rounds 12.5% of 1.16 (0.145) away from zero to 0.15', () => {
    expect(computeExpected(percentOf('1.16', '12.5')).discount).toBe('0.15');
  });

  it('rounds a fixed discount of 1.005 away from zero to 1.01', () => {
    const input: VectorInput = {
      items: [{ quantity: '1', unitPrice: '100.00' }],
      discounts: [{ type: 'fixed', value: '1.005' }],
      payments: [],
      expenses: [],
    };
    expect(computeExpected(input).discount).toBe('1.01');
  });

  it('computes ORD-2026-0151 as fully paid', () => {
    const input: VectorInput = {
      items: [{ quantity: '20', unitPrice: '1150.00' }],
      discounts: [{ type: 'fixed', value: '500.00' }],
      payments: ['12000.00', '10500.00'],
      expenses: ['7200.00', '2100.00'],
    };
    expect(computeExpected(input)).toEqual({
      total: '23000.00',
      discount: '500.00',
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
        { quantity: '15', unitPrice: '650.00' },
        { quantity: '15', unitPrice: '300.00' },
        { quantity: '2', unitPrice: '550.00' },
        { quantity: '15', unitPrice: '420.00' },
        { quantity: '1', unitPrice: '800.00' },
      ],
      discounts: [{ type: 'percentage', value: '5' }],
      payments: ['10000.00', '2000.00'],
      expenses: ['3825.00', '1640.00', '600.00'],
    };
    expect(computeExpected(input)).toEqual({
      total: '22450.00',
      discount: '1122.50',
      paid: '12000.00',
      balance: '9327.50',
      expenses: '6065.00',
      profit: '15262.50',
      fullyPaid: false,
    });
  });

  it('gives a negative balance when payments exceed what is owed', () => {
    const input: VectorInput = {
      items: [{ quantity: '1', unitPrice: '100.00' }],
      discounts: [],
      payments: ['150.00'],
      expenses: [],
    };
    expect(computeExpected(input).balance).toBe('-50.00');
  });

  it('is not fully paid when there are no items', () => {
    expect(computeExpected({ items: [], discounts: [], payments: [], expenses: [] })).toEqual({
      total: '0.00',
      discount: '0.00',
      paid: '0.00',
      balance: '0.00',
      expenses: '0.00',
      profit: '0.00',
      fullyPaid: false,
    });
  });

  it('rejects an amount that is not a plain decimal string', () => {
    expect(() => computeExpected({ items: [], discounts: [], payments: ['1e3'], expenses: [] })).toThrow(
      'Not a decimal amount: "1e3"',
    );
  });
});

describe('formatCentavos', () => {
  it('writes two decimals with an ASCII minus', () => {
    expect(formatCentavos(125050n)).toBe('1250.50');
    expect(formatCentavos(5n)).toBe('0.05');
    expect(formatCentavos(0n)).toBe('0.00');
    expect(formatCentavos(-73250n)).toBe('-732.50');
    expect(formatCentavos(99999999999n)).toBe('999999999.99');
  });
});
