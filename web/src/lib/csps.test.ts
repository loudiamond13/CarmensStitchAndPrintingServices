import { describe, expect, it } from 'vitest';
import {
  cascadeSentence,
  centavosToAmount, // SPEC-GAP: MoneyInput conversion (not in App. D.2)
  discountAmount,
  formatDate,
  formatPeso,
  orderNumber,
  orderTotals,
  passwordStrength,
  toCentavos, // SPEC-GAP: MoneyInput conversion (not in App. D.2)
  type Order,
} from './csps';

const ORD_0148: Order = {
  number: 'ORD-2026-0148',
  team: 'Brgy. San Roque Ballers',
  customer: 'Juan Dela Cruz',
  status: 'production',
  orderDate: '2026-09-28',
  dueDate: '2026-10-14',
  items: [
    { quantity: 15, unitPrice: 650 },
    { quantity: 15, unitPrice: 300 },
    { quantity: 2, unitPrice: 550 },
    { quantity: 15, unitPrice: 420 },
    { quantity: 1, unitPrice: 800 },
  ],
  discounts: [{ type: 'percentage', value: 5 }],
  payments: [{ amount: 10000 }, { amount: 2000 }],
  expenses: [{ amount: 3825 }, { amount: 1640 }, { amount: 600 }],
  images: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
};

describe('orderTotals', () => {
  it('matches the approved ORD-2026-0148 figures', () => {
    const t = orderTotals(ORD_0148);
    expect(t).toEqual({
      total: 22450,
      discount: 1122.5,
      paid: 12000,
      balance: 9327.5,
      expenses: 6065,
      profit: 15262.5,
      fullyPaid: false,
    });
    expect(formatPeso(t.balance)).toBe('₱9,327.50');
    expect(formatPeso(-t.discount)).toBe('−₱1,122.50');
  });
  it('marks ORD-2026-0151 fully paid', () => {
    const t = orderTotals({
      items: [{ quantity: 20, unitPrice: 1150 }],
      discounts: [{ type: 'fixed', value: 500 }],
      payments: [{ amount: 12000 }, { amount: 10500 }],
    });
    expect(t.balance).toBe(0);
    expect(t.fullyPaid).toBe(true);
  });
  it('is not fully paid when empty', () => {
    expect(orderTotals({}).fullyPaid).toBe(false);
  });
  it('applies percentage discounts to the items total', () => {
    expect(discountAmount({ type: 'percentage', value: 5 }, 22450)).toBe(1122.5);
    expect(discountAmount({ type: 'fixed', value: 500 }, 22450)).toBe(500);
  });
});

describe('formatting', () => {
  it('formats pesos and dates', () => {
    expect(formatPeso(38226.95)).toBe('₱38,226.95');
    expect(formatPeso(0)).toBe('₱0.00');
    expect(formatDate('2026-10-06')).toBe('Oct 6, 2026');
    expect(formatDate(undefined)).toBe('—');
    expect(orderNumber(2026, 148)).toBe('ORD-2026-0148');
  });
  it('builds the cascade sentence', () => {
    expect(cascadeSentence({ items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 })).toBe(
      'This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images.',
    );
    expect(cascadeSentence({ items: 1 })).toBe('This will also delete 1 item.');
    expect(cascadeSentence({})).toBe('');
  });
  it('scores passwords', () => {
    expect(passwordStrength('').label).toBe('');
    expect(passwordStrength('Csp!Volt26').label).toBe('Strong');
  });
});

// SPEC-GAP: MoneyInput conversion (D-09, ORD-09). Not part of App. D.2.
describe('toCentavos', () => {
  it.for([
    ['1250.5', 125050n],
    ['5', 500n],
    ['5.', 500n],
    ['.5', 50n],
    ['0', 0n],
    ['999999999.99', 99999999999n],
  ] as const)('reads %j exactly', ([text, centavos]) => {
    expect(toCentavos(text)).toBe(centavos);
  });

  it.for(['', '.', '-5', '1,250', '1.234', '1e3', '1234567890', ' 5', '5 '])('rejects %j', (text) => {
    expect(toCentavos(text)).toBeNull();
  });
});

describe('centavosToAmount', () => {
  it('writes two decimals with no grouping', () => {
    expect(centavosToAmount(125050n)).toBe('1250.50');
    expect(centavosToAmount(5n)).toBe('0.05');
    expect(centavosToAmount(0n)).toBe('0.00');
    expect(centavosToAmount(99999999999n)).toBe('999999999.99');
  });

  it('round-trips with toCentavos', () => {
    expect(toCentavos(centavosToAmount(123456n))).toBe(123456n);
  });
});
