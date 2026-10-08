// @vitest-environment node
// Golden vectors (WEB-07, D-09): orderTotals must give exactly the figures of the shared vector file that the xUnit
// suite (Csps.Domain.UnitTests OrderMathGoldenVectorTests) also checks. The file is only read here; regenerate it
// with `node web/scripts/gen-golden-vectors.mjs`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { orderTotals, type Order } from './csps';

interface VectorCase {
  id: string;
  category: string;
  note: string;
  items: { quantity: string; unitPrice: string }[];
  discounts: { type: 'fixed' | 'percentage'; value: string }[];
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
  schemaVersion: number;
  operationOrder: string;
  cases: VectorCase[];
}

const vectors = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/order-math-golden-vectors.json', import.meta.url), 'utf8'),
) as VectorFile;

/** D.1's types are numbers, so the vector strings are converted with Number() exactly as a form value would be. */
function toOrder(c: VectorCase): Partial<Order> {
  return {
    items: c.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
    discounts: c.discounts.map((d) => ({ type: d.type, value: Number(d.value) })),
    payments: c.payments.map((amount) => ({ amount: Number(amount) })),
    expenses: c.expenses.map((amount) => ({ amount: Number(amount) })),
  };
}

describe('order-math golden vectors', () => {
  it('pins the operation order in the shared file (D-09)', () => {
    expect(vectors.schemaVersion).toBe(1);
    expect(vectors.operationOrder).toBe(
      'round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)',
    );
  });

  it.for(vectors.cases)('$id: $note', (c) => {
    const t = orderTotals(toOrder(c));
    expect({
      total: t.total.toFixed(2),
      discount: t.discount.toFixed(2),
      paid: t.paid.toFixed(2),
      balance: t.balance.toFixed(2),
      expenses: t.expenses.toFixed(2),
      profit: t.profit.toFixed(2),
      fullyPaid: t.fullyPaid,
    }).toEqual(c.expected);
  });
});
