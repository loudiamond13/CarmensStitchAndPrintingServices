// Data group (App. D.3 "Data display": OrderCard, DataTable and IncomeExpenseChart, CSPS-UI-SPEC.md §6.4; plan 02-24). Every scenario
// here has group 'data'. Each case is shown in both themes at 390 and 1440:
//   - OrderCard on the spec §12.2 seed orders as order list rows (plan 08-02): ORD-2026-0148 (In Production, a cover
//     with 4 images, balance due ₱9,327.50; also on hover, where the card lifts), ORD-2026-0151 (Ready, Fully Paid) and
//     ORD-2026-0153 (no team: the customer is the title and the customer line reads "Walk-in customer", owner ruling
//     D-40, in the WalkInOrderCard wrapper pair; Mockup, no images yet). The card changed by owner rulings (D-04, D-22,
//     D-27, D-40), so the frozen design has no card to compare with: these cases are implementation-only (parity false);
//   - DataTable with the §12.2 orders (money columns right-aligned, two columns sized through `--col-w`; also with the
//     first row hovered), loading (4 skeleton rows), empty and error, each in the KeyboardScrollTable wrapper pair;
//   - IncomeExpenseChart at rest with the spec §12.4 six months (May to Oct 2026; axis ₱0 / ₱100k / ₱200k) and twelve
//     months (Nov 2025 to Oct 2026: the six §12.4 months after six demo months chosen below the same axis top).
// The OrderCard rows carry the server's figures as decimal text, the way the list API sends them; data.test.tsx checks
// them against orderTotals for the same seed orders. The table's figures are the §12.2 results
// (Total = Subtotal − Discount, PRD §5.1, D-41 R2-06; Balance = Total − Paid), which data.test.tsx checks against
// orderTotals.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

interface CaseOptions {
  readonly states?: readonly ScenarioState[];
  readonly handlers?: readonly string[];
  readonly target?: string;
  /** False for a case the frozen design cannot be compared with (the OrderCard, changed by owner rulings). */
  readonly parity?: boolean;
}

/** A data case shown in both themes at 390 and 1440; compared with the reference unless `parity` is false. */
function dataCase(id: string, node: ScenarioNode, options: CaseOptions = {}): Scenario {
  const { states = ['rest'], handlers, target, parity = true } = options;
  return {
    id,
    group: 'data',
    node,
    themes: ['light', 'dark'],
    responsive: false,
    states,
    parity,
    ...(handlers === undefined ? {} : { handlers }),
    ...(target === undefined ? {} : { target }),
  };
}

const CARD_HANDLERS = ['onView', 'onEdit'] as const;

/** ORD-2026-0148 as an order list row (balance due), with a four-image cover; none has a file, so the cover is a placeholder. */
export const CARD_0148: ScenarioProps = {
  number: 'ORD-2026-0148',
  teamName: 'Brgy. San Roque Ballers',
  customerName: 'Juan Dela Cruz',
  status: 'production',
  orderDate: '2026-09-28',
  dueDate: '2026-10-14',
  pieces: 48,
  subtotal: '22450.00',
  discount: '1122.50',
  total: '21327.50',
  paid: '12000.00',
  refunded: '0.00',
  balance: '9327.50',
  customerCredit: '0.00',
  fullyPaid: false,
  cover: { name: 'front-mockup.png', number: '23', count: 4 },
};

/** ORD-2026-0151 as an order list row (Fully Paid). */
export const CARD_0151: ScenarioProps = {
  number: 'ORD-2026-0151',
  teamName: 'Tondo Riders MC',
  customerName: 'Mark Villanueva',
  status: 'ready',
  orderDate: '2026-09-30',
  dueDate: '2026-10-10',
  pieces: 20,
  subtotal: '23000.00',
  discount: '500.00',
  total: '22500.00',
  paid: '22500.00',
  refunded: '0.00',
  balance: '0.00',
  customerCredit: '0.00',
  fullyPaid: true,
};

/** ORD-2026-0153 as an order list row: no team, Mockup, 12 pieces, no images yet. */
export const CARD_0153: ScenarioProps = {
  number: 'ORD-2026-0153',
  teamName: null,
  customerName: 'Angelica Santos',
  status: 'mockup',
  orderDate: '2026-10-03',
  dueDate: '2026-10-05',
  pieces: 12,
  subtotal: '9360.00',
  discount: '0.00',
  total: '9360.00',
  paid: '3000.00',
  refunded: '0.00',
  balance: '6360.00',
  customerCredit: '0.00',
  fullyPaid: false,
};

/** Spec §12.2 ORD-2026-0153 as an order: no team, Mockup, overdue (due Oct 5), 12 × 780 with ₱3,000 paid, no images. The table figures are checked against it. */
export const ORDER_0153: ScenarioProps = {
  number: 'ORD-2026-0153',
  customer: 'Angelica Santos',
  status: 'mockup',
  orderDate: '2026-10-03',
  dueDate: '2026-10-05',
  overdue: true,
  items: [{ productType: 'Basketball Jersey', quantity: 12, unitPrice: 780 }],
  payments: [{ amount: 3000 }],
  images: [],
};

/** The DataTable columns: two sized through `--col-w` (px and %), the money columns right-aligned. */
const TABLE_COLUMNS: readonly ScenarioProps[] = [
  { key: 'number', label: 'Order', width: 150 },
  { key: 'team', label: 'Customer / team' },
  { key: 'status', label: 'Status' },
  { key: 'due', label: 'Due', width: '16%' },
  { key: 'total', label: 'Total', align: 'right', money: true },
  { key: 'balance', label: 'Balance', align: 'right', money: true },
];

/** Spec §12.2 orders as table rows: Total = Subtotal − Discount (PRD §5.1, D-41 R2-06); Balance = Total − Paid. */
export const TABLE_ROWS: readonly ScenarioProps[] = [
  {
    number: 'ORD-2026-0148',
    team: 'Brgy. San Roque Ballers',
    status: 'In Production',
    due: 'Oct 14, 2026',
    total: 21327.5,
    balance: 9327.5,
  },
  { number: 'ORD-2026-0151', team: 'Tondo Riders MC', status: 'Ready', due: 'Oct 10, 2026', total: 22500, balance: 0 },
  {
    number: 'ORD-2026-0153',
    team: 'Angelica Santos',
    status: 'Mockup',
    due: 'Oct 5, 2026',
    total: 9360,
    balance: 6360,
  },
  {
    number: 'ORD-2026-0155',
    team: 'Lady Spikers QC',
    status: 'Pending',
    due: 'Oct 24, 2026',
    total: 10080,
    balance: 10080,
  },
  {
    number: 'ORD-2026-0157',
    team: 'St. Jude Parish Youth',
    status: 'In Production',
    due: 'Oct 17, 2026',
    total: 18000,
    balance: 9000,
  },
];

/**
 * A DataTable inside the KeyboardScrollTable wrapper pair (docs/web/parity.md §5): at 390 the frame scrolls sideways,
 * and the reference side gives the frozen App. D.3 frame the focusable-region attributes the converted DataTable
 * renders by itself (A11Y-01), so axe passes on both pages. The wrapper is one plain block with no look.
 */
function table(props: ScenarioProps): ScenarioNode {
  return node('KeyboardScrollTable', {
    children: node('DataTable', { columns: TABLE_COLUMNS, caption: 'Recent orders', ...props }),
  });
}

/** Spec §12.4 chart data (income / expenses), May to Oct 2026. `label` names each month for assistive technology. */
export const CHART_6_MONTHS: readonly ScenarioProps[] = [
  { month: 'May', label: 'May 2026', income: 98400, expenses: 61200 },
  { month: 'Jun', label: 'Jun 2026', income: 132650, expenses: 70350 },
  { month: 'Jul', label: 'Jul 2026', income: 87300, expenses: 66480 },
  { month: 'Aug', label: 'Aug 2026', income: 145900, expenses: 74120 },
  { month: 'Sep', label: 'Sep 2026', income: 112980, expenses: 69900 },
  { month: 'Oct', label: 'Oct 2026', income: 126450, expenses: 58320 },
];

/**
 * Twelve months: six demo months (Nov 2025 to Apr 2026; the spec gives only six, so these are chosen, each below the
 * §12.4 maximum of ₱145,900, keeping the axis at ₱200k), then the §12.4 six.
 */
export const CHART_12_MONTHS: readonly ScenarioProps[] = [
  { month: 'Nov', label: 'Nov 2025', income: 76500, expenses: 52100 },
  { month: 'Dec', label: 'Dec 2025', income: 118200, expenses: 64800 },
  { month: 'Jan', label: 'Jan 2026', income: 64350, expenses: 48900 },
  { month: 'Feb', label: 'Feb 2026', income: 81700, expenses: 55240 },
  { month: 'Mar', label: 'Mar 2026', income: 104600, expenses: 60150 },
  { month: 'Apr', label: 'Apr 2026', income: 92850, expenses: 58700 },
  ...CHART_6_MONTHS,
];

/**
 * A no-team OrderCard inside the WalkInOrderCard wrapper pair (docs/web/parity.md §5, owner ruling D-40): App. D.3 leaves
 * the customer line of a no-team card empty, so the reference side writes "Walk-in customer" into it after mount; the
 * converted OrderCard renders the line by itself.
 */
function walkInCard(order: ScenarioProps): ScenarioNode {
  return node('WalkInOrderCard', { children: node('OrderCard', { order }) });
}

export const scenarios: readonly Scenario[] = [
  dataCase('order-card-0148', node('OrderCard', { order: CARD_0148 }), {
    states: ['rest', 'hover'],
    handlers: CARD_HANDLERS,
    parity: false,
  }),
  dataCase('order-card-0151', node('OrderCard', { order: CARD_0151 }), { handlers: CARD_HANDLERS, parity: false }),
  dataCase('order-card-walk-in', walkInCard(CARD_0153), { handlers: CARD_HANDLERS, parity: false }),
  dataCase('data-table-orders', table({ rows: TABLE_ROWS, rowKey: 'number' }), {
    states: ['rest', 'hover'],
    target: 'tbody tr',
  }),
  dataCase('data-table-loading', table({ rows: [], loading: true })),
  dataCase('data-table-empty', table({ rows: [] })),
  dataCase('data-table-error', table({ rows: [], error: "Couldn't load orders." })),
  dataCase('chart-6-months', node('IncomeExpenseChart', { data: CHART_6_MONTHS })),
  dataCase('chart-12-months', node('IncomeExpenseChart', { data: CHART_12_MONTHS })),
];
