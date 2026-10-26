import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cascadeSentence,
  discountAmount,
  formatDate,
  formatPeso,
  orderNumber,
  orderTotals,
  passwordStrength,
  round2, // SPEC-DEVIATION: D-09 rounding tests below (not in App. D.2)
  type Order,
} from './csps';

/* App. D.2 verbatim from here to the end of describe('formatting'); Prettier only re-wrapped the lines. */

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
    // SPEC-DEVIATION: D-41 R2-06 (owner, 2026-10-13). App. D.2 expects `total: 22450`, the amount before discount;
    // the PRD 5.1 names are used now: Subtotal is before discount and Total = Subtotal − Discount.
    expect(t).toEqual({
      subtotal: 22450,
      discount: 1122.5,
      total: 21327.5,
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
  // SPEC-DEVIATION: D-41 R2-06 (owner, 2026-10-13; NET-IN-01 ruled keep), not in App. D.2.
  it('marks a 100%-discounted order with no payment fully paid (Subtotal > 0 and Balance ≤ 0)', () => {
    expect(
      orderTotals({ items: [{ quantity: 3, unitPrice: 17 }], discounts: [{ type: 'percentage', value: 100 }] }),
    ).toEqual({
      subtotal: 51,
      discount: 51,
      total: 0,
      paid: 0,
      balance: 0,
      expenses: 0,
      profit: 0,
      fullyPaid: true,
    });
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
    expect(formatDate(undefined)).toBeNull();
    expect(orderNumber(2026, 148)).toBe('ORD-2026-0148');
  });
  it('builds the cascade sentence', () => {
    expect(cascadeSentence({ items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 })).toBe(
      'This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images.',
    );
    expect(cascadeSentence({ expenses: 1235, images: 1000 })).toBe(
      'This will also delete 1,235 expenses, and 1,000 images.',
    );
    expect(cascadeSentence({ items: 1 })).toBe('This will also delete 1 item.');
    expect(cascadeSentence({})).toBe('');
  });
  it('scores passwords', () => {
    expect(passwordStrength('').label).toBe('');
    expect(passwordStrength('Csp!Volt26').label).toBe('Strong');
  });
});

/* End of App. D.2. Everything below is added (D-09, characterization of App. D.1). */

// SPEC-DEVIATION: D-09 formatPeso goes through integer centavos, half away from zero (not in App. D.2).
describe('formatPeso through centavos (D-09)', () => {
  it.for([
    [1.005, '₱1.01'],
    [10.075, '₱10.08'],
    [-732.5, '−₱732.50'],
    [-1.005, '−₱1.01'],
    ['1250.5', '₱1,250.50'],
    [9999999999.99, '₱9,999,999,999.99'],
    [-0.001, '₱0.00'],
    [null, '₱0.00'],
    [undefined, '₱0.00'],
    [Number.NaN, '₱0.00'],
    [Number.POSITIVE_INFINITY, '₱0.00'],
    ['abc', '₱0.00'],
  ] as const)('formats %s as %j', ([value, text]) => {
    expect(formatPeso(value)).toBe(text);
  });
});

// SPEC-DEVIATION: D-09 rounding (not in App. D.2); the golden vectors cover orderTotals as a whole.
describe('round2 (D-09)', () => {
  it.for([
    [1.005, 1.01],
    [10.075, 10.08],
    [-1.005, -1.01],
    ['2.675', 2.68],
    [0.125, 0.13],
    [1e21, 1e21],
    [1.5e-7, 0],
  ] as const)('rounds %s half away from zero at the centavo', ([value, expected]) => {
    expect(round2(value)).toBe(expected);
  });

  it.for([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, 'abc'])(
    'reads %s as 0',
    (value) => {
      expect(round2(value)).toBe(0);
    },
  );
});

describe('discountAmount (D-09)', () => {
  it('is 0 without a discount', () => {
    expect(discountAmount(null, 100)).toBe(0);
    expect(discountAmount(undefined, 100)).toBe(0);
  });

  it('rounds a percentage of the items total half away from zero', () => {
    expect(discountAmount({ type: 'percentage', value: 7.5 }, 17)).toBe(1.28);
    expect(discountAmount({ type: 'percentage', value: 2.5 }, 23)).toBe(0.58);
  });
});

// LIB-WR-07: the date an order shows must not move with the machine's zone.
describe('formatDate never reads the machine zone', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.for(['America/Chicago', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'shows the API instant 2026-10-05T16:30:00Z and the date 2026-10-06 as "Oct 6, 2026" on a machine in %s',
    (zone) => {
      vi.stubEnv('TZ', zone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
      expect(formatDate('2026-10-05T16:30:00Z')).toBe('Oct 6, 2026');
      expect(formatDate(new Date('2026-10-05T16:30:00Z'))).toBe('Oct 6, 2026');
      expect(formatDate('2026-10-06')).toBe('Oct 6, 2026');
    },
  );
});

// App. D.1 behavior beyond the App. D.2 tests (characterization, so the lint-only SPEC-DEVIATION edits stay honest).
describe('App. D.1 characterization', () => {
  // SPEC-DEVIATION (LIB-WR-07): D.1 read a Date or a timestamp in the machine's zone, read a zone-less date-time as
  // machine-local and echoed unparseable text. formatDate now goes through @/utils/format: instants in the business zone,
  // and null for anything that is neither a calendar date nor an instant with a zone.
  it('formats a Date in the business zone, and refuses a zone-less date-time and unparseable text', () => {
    expect(formatDate(new Date('2026-10-05T16:30:00Z'))).toBe('Oct 6, 2026');
    expect(formatDate(new Date(Number.NaN))).toBeNull();
    expect(formatDate('2026-10-06T08:00:00')).toBeNull();
    expect(formatDate('garbage')).toBeNull();
    expect(formatDate('')).toBeNull();
    expect(formatDate(null)).toBeNull();
  });

  it('treats a missing order as empty', () => {
    expect(orderTotals(null)).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
      paid: 0,
      balance: 0,
      expenses: 0,
      profit: 0,
      fullyPaid: false,
    });
  });

  it('joins two cascade parts with ", and"', () => {
    expect(cascadeSentence({ items: 2, images: 1 })).toBe('This will also delete 2 items, and 1 image.');
    expect(cascadeSentence()).toBe('');
  });

  it.for([
    ['abc', 1, 'Weak'],
    ['abcdefgh', 1, 'Weak'],
    ['abcdefghijkl', 2, 'Fair'],
    ['Abcdefgh1', 3, 'Good'],
  ] as const)('scores %j as %s (%s)', ([password, score, label]) => {
    expect(passwordStrength(password)).toEqual({ score, label });
  });

  it('scores a missing password as empty', () => {
    expect(passwordStrength()).toEqual({ score: 0, label: '' });
  });

  it('pads the order sequence to four digits', () => {
    expect(orderNumber(2026, 7)).toBe('ORD-2026-0007');
    expect(orderNumber(2026, 12345)).toBe('ORD-2026-12345');
  });
});
