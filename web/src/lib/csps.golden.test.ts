// @vitest-environment node
// Golden vectors (WEB-07, D-09): orderTotals must give exactly the figures of the shared vector file that the xUnit
// suite (Csps.Domain.UnitTests OrderMathGoldenVectorTests) also checks. The file is only read here; regenerate it
// with `node web/scripts/gen-golden-vectors.mjs --write`.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { orderTotals, type Order } from './csps';

interface VectorCase {
  id: string;
  category: string;
  note: string;
  items: { quantity: number; unitPrice: string }[];
  discounts: { kind: 'fixed' | 'percentage'; value: string }[];
  payments: string[];
  expenses: string[];
  expected: {
    total: string;
    discount: string;
    paid: string;
    balance: string;
    expenses: string;
    profit: string;
    fullyPaid: boolean;
  };
}

interface VectorFile {
  version: number;
  operationOrder: string;
  cases: VectorCase[];
}

const vectors = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/order-math-golden-vectors.json', import.meta.url), 'utf8'),
) as VectorFile;

/** D.1's types are numbers, so the vector strings are converted with Number() exactly as a form value would be. */
function toOrder(c: VectorCase): Partial<Order> {
  return {
    items: c.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    discounts: c.discounts.map((d) => ({ type: d.kind, value: Number(d.value) })),
    payments: c.payments.map((amount) => ({ amount: Number(amount) })),
    expenses: c.expenses.map((amount) => ({ amount: Number(amount) })),
  };
}

/** Every category the generator must cover (WEB-07); the xUnit suite asserts the same list. */
const CATEGORIES = [
  'midpoint',
  'ord-fixture',
  'percent-100',
  'zero-items',
  'multi-discount',
  'negative-balance',
  'large-value',
  'seeded-random',
];

/** Formats a Totals-shaped result the way the vector file writes amounts. */
function asExpected(t: {
  total: number;
  discount: number;
  paid: number;
  balance: number;
  expenses: number;
  profit: number;
  fullyPaid: boolean;
}): VectorCase['expected'] {
  return {
    total: t.total.toFixed(2),
    discount: t.discount.toFixed(2),
    paid: t.paid.toFixed(2),
    balance: t.balance.toFixed(2),
    expenses: t.expenses.toFixed(2),
    profit: t.profit.toFixed(2),
    fullyPaid: t.fullyPaid,
  };
}

/* The UNMODIFIED App. D.1 order math (spec §9.2: `Math.round(n × 100) / 100`), kept here only to prove the vectors
   catch it (research Pitfall 13). It must never be used for a figure. */
const specRound2 = (n: number): number => Math.round(n * 100) / 100;
function specOrderTotals(order: Partial<Order>): VectorCase['expected'] {
  const total = specRound2((order.items ?? []).reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = specRound2(
    (order.discounts ?? []).reduce(
      (s, d) => s + specRound2(d.type === 'percentage' ? (total * d.value) / 100 : d.value),
      0,
    ),
  );
  const paid = specRound2((order.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const expenses = specRound2((order.expenses ?? []).reduce((s, e) => s + e.amount, 0));
  const balance = specRound2(total - discount - paid);
  const profit = specRound2(total - discount - expenses);
  return asExpected({ total, discount, paid, balance, expenses, profit, fullyPaid: total > 0 && balance <= 0 });
}

describe('order-math golden vectors', () => {
  it('pins the operation order in the shared file (D-09)', () => {
    expect(vectors.version).toBe(1);
    expect(vectors.operationOrder).toBe(
      'round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)',
    );
  });

  it('HasAtLeast200CasesWithUniqueIds', () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(200);
    expect(new Set(vectors.cases.map((c) => c.id)).size).toBe(vectors.cases.length);
  });

  it.for(CATEGORIES)('covers the %s category', (category) => {
    expect(vectors.cases.filter((c) => c.category === category).length).toBeGreaterThan(0);
  });

  it('catches the unmodified spec round2 on at least one midpoint vector (Pitfall 13)', () => {
    const failing = vectors.cases.filter((c) => !isDeepStrictEqual(specOrderTotals(toOrder(c)), c.expected));
    expect(failing.filter((c) => c.category === 'midpoint').length).toBeGreaterThan(0);
    expect(failing.map((c) => c.id)).toContain('midpoint-7-5-percent-of-17');
  });

  it.for(vectors.cases)('$id: $note', (c) => {
    expect(asExpected(orderTotals(toOrder(c)))).toEqual(c.expected);
  });
});
