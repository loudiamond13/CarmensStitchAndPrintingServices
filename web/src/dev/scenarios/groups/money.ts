// Money group (App. D.3 "Data display": Money, KpiCard and OrderTotals; CSPS-UI-SPEC.md §6.4). Every scenario here has
// group 'money'. Plan 02-23:
//   - Money in the default look ("₱12,450.00"), negative in the danger tone ("−₱732.50", U+2212), and the other sizes
//     and tones (lg success, sm muted, md warning);
//   - OrderTotals on the spec §12.2 seed orders: ORD-2026-0148 (balance due ₱9,327.50, the Order Detail panel and the
//     OrderCard block) and ORD-2026-0151 (fully paid: 23,000 − 500 − 22,500 = 0), at every width.
// The figures are never typed here: both sides compute them from the seed order with orderTotals (the reference with
// App. D.1, the implementation with the D-09 centavo math), and spec §12.2 lists the expected results, which
// money.test.tsx asserts. Each case is compared in both themes at rest. The panels sit in the DefinedTotalsNote wrapper
// pair (see totalsPanel); the card variant has no note and needs none.
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

interface CaseOptions {
  readonly responsive?: boolean;
}

/** A money case compared in both themes at rest. */
function moneyCase(id: string, node: ScenarioNode, options: CaseOptions = {}): Scenario {
  const { responsive = false } = options;
  return { id, group: 'money', node, themes: ['light', 'dark'], responsive, states: ['rest'], parity: true };
}

/**
 * An OrderTotals panel inside the DefinedTotalsNote wrapper pair (docs/web/parity.md §5): the reference side gives the
 * frozen App. D.3 note paragraph the role="definition" the converted panel renders by itself, so axe passes on both
 * pages. The wrapper is one plain block with no look.
 */
function totalsPanel(order: ScenarioProps): ScenarioNode {
  return node('DefinedTotalsNote', { children: node('OrderTotals', { order }) });
}

/** Spec §12.2 ORD-2026-0148 (the Order Detail mockup): 5 items, a 5% discount, 2 payments and 3 order expenses. */
export const ORDER_0148: ScenarioProps = {
  number: 'ORD-2026-0148',
  team: 'Brgy. San Roque Ballers',
  customer: 'Juan Dela Cruz',
  status: 'production',
  orderDate: '2026-09-28',
  dueDate: '2026-10-14',
  items: [
    {
      productType: 'Basketball Jersey',
      description: 'Jersey top — sublimated, names & numbers',
      quantity: 15,
      unitPrice: 650,
    },
    { productType: 'Basketball Jersey', description: 'Shorts — matching colorway', quantity: 15, unitPrice: 300 },
    { productType: 'Polo Shirt', description: 'Coach polo, embroidered logo', quantity: 2, unitPrice: 550 },
    { productType: 'Long Sleeves', description: 'Warm-up shooting shirt', quantity: 15, unitPrice: 420 },
    { productType: 'Custom Design', description: 'Team logo redraw & vector cleanup', quantity: 1, unitPrice: 800 },
  ],
  discounts: [{ reason: 'Barangay league discount', type: 'percentage', value: 5 }],
  payments: [
    { date: '2026-09-28', amount: 10000, method: 'GCash' },
    { date: '2026-10-03', amount: 2000, method: 'Cash' },
  ],
  expenses: [
    { date: '2026-10-01', category: 'Fabric', amount: 3825 },
    { date: '2026-10-02', category: 'Ink & paper', amount: 1640 },
    { date: '2026-10-04', category: 'Outsourcing', amount: 600 },
  ],
};

/** Spec §12.2 ORD-2026-0151: 20 × 1,150, a ₱500 fixed discount, 12,000 + 10,500 paid, so it renders "Fully Paid". */
export const ORDER_0151: ScenarioProps = {
  number: 'ORD-2026-0151',
  team: 'Tondo Riders MC',
  customer: 'Mark Villanueva',
  status: 'ready',
  orderDate: '2026-09-30',
  dueDate: '2026-10-10',
  items: [{ productType: 'Moto Riding Jersey', quantity: 20, unitPrice: 1150 }],
  discounts: [{ type: 'fixed', value: 500 }],
  payments: [{ amount: 12000 }, { amount: 10500 }],
  expenses: [
    { category: 'Fabric', amount: 7200 },
    { category: 'Labor', amount: 2100 },
  ],
};

export const scenarios: readonly Scenario[] = [
  moneyCase('money-positive', node('Money', { amount: 12450 })),
  moneyCase('money-negative', node('Money', { amount: -732.5, tone: 'danger' })),
  moneyCase('money-lg-success', node('Money', { amount: 126450, size: 'lg', tone: 'success' })),
  moneyCase('money-sm-muted', node('Money', { amount: 38226.95, size: 'sm', tone: 'muted' })),
  moneyCase('money-warning', node('Money', { amount: 9327.5, tone: 'warning' })),
  moneyCase('order-totals-0148', totalsPanel(ORDER_0148), { responsive: true }),
  moneyCase('order-totals-0151', totalsPanel(ORDER_0151), { responsive: true }),
  moneyCase('order-totals-card-0148', node('OrderTotals', { order: ORDER_0148, variant: 'card' }), {
    responsive: true,
  }),
];
