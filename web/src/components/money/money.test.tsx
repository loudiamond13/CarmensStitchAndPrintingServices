import type { ReactElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as moneyScenarios } from '@/dev/scenarios/groups/money';
import type { ScenarioNode } from '@/dev/scenarios/types';
import type { Order, OrderFigures } from '@/utils/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { skeletonClasses } from '@/components/feedback/feedback.recipe';
import { KpiCard, Money, OrderTotals } from '@/components/money';
import {
  balanceClasses,
  balanceOverlineClasses,
  balancePaidClasses,
  balanceToneClasses,
  balanceValueClasses,
  balanceWrapClasses,
  deltaClasses,
  deltaToneClasses,
  kpiClasses,
  kpiFootClasses,
  kpiHeadClasses,
  kpiIconClasses,
  kpiLongValueClasses,
  kpiTextValueClasses,
  kpiValueClasses,
  moneyClasses,
  overlineClasses,
  moneySizeClasses,
  moneyToneClasses,
  totalsClasses,
  totalsFigureClasses,
  totalsInternalClasses,
  totalsNegativeClasses,
  totalsNoteClasses,
  totalsRowClasses,
  totalsRowsClasses,
  totalsTermClasses,
} from './money.recipe';

// The converted App. D.3 money display (plan 02-23, CSPS-UI-SPEC.md §6.4, §9.2, §12.2). The look is proven by the
// parity suite (`--grep @money`); these tests pin the markup, the figures (spec §12.2 "Expected figures"), the U+2212
// minus and the scenario set the parity suite compares.

const MINUS = '−';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

const byId = new Map(moneyScenarios.map((scenario) => [scenario.id, scenario]));

/** The money group's wrapper pairs: one plain block each around the component (docs/web/parity.md section 5). */
const WRAPPERS: readonly string[] = ['DefinedTotalsNote', 'DimmedZeroKpi'];

/**
 * Renders a money scenario exactly as the parity page does: through the implementation kit. The panels sit in the
 * DefinedTotalsNote wrapper pair and the zero KPI in the DimmedZeroKpi pair (one plain block each), so `container` is
 * the block that holds the component.
 */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No money scenario "${id}".`);
  }
  const result = render(renderNode(kit, scenario.node, scenario.handlers ?? []));
  const wrapper = WRAPPERS.includes(scenario.node.component) ? result.container.firstElementChild : null;
  return { ...result, container: wrapper ?? result.container };
}

/** The component node of a money scenario, inside its wrapper or not. */
function totalsNode(id: string): ScenarioNode | undefined {
  const outer = byId.get(id)?.node;
  const inner = outer?.props?.children;
  return outer !== undefined &&
    WRAPPERS.includes(outer.component) &&
    typeof inner === 'object' &&
    inner !== null &&
    'kind' in inner
    ? (inner as ScenarioNode)
    : outer;
}

/** The label → figure pairs of one `<dl>`, in DOM order. */
function figures(list: Element | null | undefined): [string, string][] {
  return [...(list?.querySelectorAll('dt') ?? [])].map((term) => [
    term.textContent,
    term.nextElementSibling?.textContent ?? '',
  ]);
}

describe('Money (App. D.3)', () => {
  it('renders formatPeso text in one tabular span, 600 weight at the default md size', () => {
    const { container } = render(<Money amount={12450} />);
    const money = container.firstElementChild;

    expect(money?.localName).toBe('span');
    expect(money?.textContent).toBe('₱12,450.00');
    expect(classTokens(money)).toEqual(tokens(`${moneyClasses} ${moneySizeClasses.md}`));
    expect(container.childElementCount).toBe(1);
  });

  it('writes a negative amount with the true minus sign U+2212 (ORD-09)', () => {
    const { container } = render(<Money amount={-732.5} tone="danger" />);
    const text = container.firstElementChild?.textContent ?? '';

    expect(text).toBe(`${MINUS}₱732.50`);
    expect(text.codePointAt(0)).toBe(0x2212);
    expect(text).not.toContain('-');
  });

  it('formats through centavos, half away from zero (D-09)', () => {
    const { container } = render(<Money amount={1.005} />);

    expect(container.firstElementChild?.textContent).toBe('₱1.01');
  });

  it('takes the size look and the tone colour from complete literals', () => {
    const { container, rerender } = render(<Money amount={126450} size="lg" tone="success" />);

    expect(classTokens(container.firstElementChild)).toEqual(
      tokens(`${moneyClasses} ${moneySizeClasses.lg} ${moneyToneClasses.success}`),
    );
    rerender(<Money amount={38226.95} size="sm" tone="muted" />);
    expect(classTokens(container.firstElementChild)).toEqual(
      tokens(`${moneyClasses} ${moneySizeClasses.sm} ${moneyToneClasses.muted}`),
    );
    rerender(<Money amount={9327.5} tone="warning" />);
    expect(classTokens(container.firstElementChild)).toEqual(
      tokens(`${moneyClasses} ${moneySizeClasses.md} ${moneyToneClasses.warning}`),
    );
  });

  it('adds a layout className after its own look', () => {
    const { container } = render(<Money amount={0} className="ml-2" />);

    expect(classTokens(container.firstElementChild)).toEqual(tokens(`${moneyClasses} ${moneySizeClasses.md} ml-2`));
    expect(container.firstElementChild?.textContent).toBe('₱0.00');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <p>
        Balance <Money amount={-732.5} tone="danger" />
      </p>,
    );

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Money amount={12450} />);
    const first = container.innerHTML;

    rerender(<Money amount={12450} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Money amount={-1122.5} tone="danger" />);
    expect(container.firstElementChild?.textContent).toBe(`${MINUS}₱1,122.50`);
  });
});

/** Server figures for ORD-2026-0148, as the API sends them (decimal strings). */
const SERVER_0148: OrderFigures = {
  subtotal: '22450.00',
  discount: '1122.50',
  total: '21327.50',
  paid: '12000.00',
  refunded: '0.00',
  balance: '9327.50',
  customerCredit: '0.00',
  fullyPaid: false,
  expenses: '6065.00',
  profit: '15262.50',
};

describe('OrderTotals (D-01 to D-07, D-45)', () => {
  it('shows the figures for ORD-2026-0148 in the panel: Subtotal, Discount, Total and Paid, then expenses and profit (D-01, D-06)', () => {
    const { container } = renderCase('order-totals-0148');
    const [main, internal] = [...container.querySelectorAll('dl')];

    expect(figures(main)).toEqual([
      ['Subtotal', '₱22,450.00'],
      ['Discount', `${MINUS}₱1,122.50`],
      ['Total', '₱21,327.50'],
      ['Paid', `${MINUS}₱12,000.00`],
    ]);
    expect(figures(internal)).toEqual([
      ['Order Expenses', '₱6,065.00'],
      ['Estimated Profit', '₱15,262.50'],
    ]);
    expect(container.textContent).not.toMatch(/Total Discount|Total Paid|Internal only/);
  });

  it('shows server decimal strings as they are, with no float rounding (ORD-01 precision)', () => {
    const { container } = render(<OrderTotals totals={SERVER_0148} status="production" />);

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Subtotal', '₱22,450.00'],
      ['Discount', `${MINUS}₱1,122.50`],
      ['Total', '₱21,327.50'],
      ['Paid', `${MINUS}₱12,000.00`],
    ]);
    expect(container.firstElementChild?.children[1]?.lastElementChild?.textContent).toBe('₱9,327.50');

    const big = render(
      <OrderTotals totals={{ ...SERVER_0148, subtotal: 99999999.99, total: '1000000.00', balance: 99999999.99 }} />,
    );
    expect(big.container.textContent).toContain('₱99,999,999.99');
    expect(big.container.textContent).toContain('₱1,000,000.00');
  });

  it('shows ORD-2026-0148 as balance due: the warning ground, "Balance due" and ₱9,327.50', () => {
    const { container } = renderCase('order-totals-0148');
    const root = container.firstElementChild;
    const balance = root?.children[1];
    const [overline, value] = [...(balance?.children ?? [])];

    expect(classTokens(root)).toEqual(tokens(totalsClasses.panel));
    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.panel} ${balanceToneClasses.due}`));
    expect(overline?.localName).toBe('span');
    expect(overline?.textContent).toBe('Balance due');
    expect(classTokens(overline)).toEqual(tokens(balanceOverlineClasses.due));
    expect(value?.textContent).toBe('₱9,327.50');
    expect(classTokens(value)).toEqual(tokens(balanceValueClasses.panel));
    expect(screen.queryByText('Fully Paid')).toBeNull();
  });

  it('renders the panel markup: rows list, balance, then the dashed internal list with the Staff only note', () => {
    const { container } = renderCase('order-totals-0148');
    const root = container.firstElementChild;
    const [main, , internal] = [...(root?.children ?? [])];
    const rows = [...(main?.children ?? []), ...(internal?.children ?? [])].filter((row) => row.localName === 'div');
    const note = internal?.lastElementChild;

    expect(root?.children).toHaveLength(3);
    expect(main?.localName).toBe('dl');
    expect(classTokens(main)).toEqual(tokens(totalsRowsClasses.panel));
    expect(internal?.localName).toBe('dl');
    expect(classTokens(internal)).toEqual(tokens(`${totalsRowsClasses.panel} ${totalsInternalClasses}`));
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(classTokens(row)).toEqual(tokens(totalsRowClasses.panel));
      expect(classTokens(row.querySelector('dd'))).toEqual(tokens(totalsFigureClasses));
    }
    expect(classTokens(rows[0]?.querySelector('dt'))).toEqual(tokens(totalsTermClasses.normal));
    expect(classTokens(rows[5]?.querySelector('dt'))).toEqual(tokens(totalsTermClasses.strong));
    expect(note?.localName).toBe('p');
    expect(note?.textContent).toBe(`Profit = Total ${MINUS} Expenses. Staff only.`);
    expect(classTokens(note)).toEqual(tokens(totalsNoteClasses));
  });

  it('keeps the note inside the internal list as a definition, so the list stays valid (A11Y-01)', () => {
    const { container } = renderCase('order-totals-0148');

    expect(container.querySelector('dl p')?.getAttribute('role')).toBe('definition');
  });

  it('shows ORD-2026-0151 as fully paid: the success ground, "Balance", the check icon and "Fully Paid"', () => {
    const { container } = renderCase('order-totals-0151');
    const balance = container.firstElementChild?.children[1];
    const [overline, paid] = [...(balance?.children ?? [])];
    const icon = paid?.querySelector('svg');

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Subtotal', '₱23,000.00'],
      ['Discount', `${MINUS}₱500.00`],
      ['Total', '₱22,500.00'],
      ['Paid', `${MINUS}₱22,500.00`],
    ]);
    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.panel} ${balanceToneClasses.paid}`));
    expect(overline?.textContent).toBe('Balance');
    expect(classTokens(overline)).toEqual(tokens(balanceOverlineClasses.paid));
    expect(paid?.textContent).toBe('Fully Paid');
    expect(classTokens(paid)).toEqual(tokens(balancePaidClasses));
    expect(icon?.getAttribute('class')).toContain('lucide-circle-check');
    expect(icon?.getAttribute('width')).toBe('22');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).not.toContain('Balance due');
  });

  it('shows ORD-2026-0151 expenses and profit: ₱9,300.00 and ₱13,200.00', () => {
    const { container } = renderCase('order-totals-0151');

    expect(figures(container.querySelectorAll('dl')[1])).toEqual([
      ['Order Expenses', '₱9,300.00'],
      ['Estimated Profit', '₱13,200.00'],
    ]);
  });

  it('renders the compact card variant: one Total row, the 28px balance, 18px check, and no discount, expenses or profit (D-04, D-06)', () => {
    const { container } = renderCase('order-totals-card-0148');
    const root = container.firstElementChild;
    const balance = root?.children[1];

    expect(root?.children).toHaveLength(2);
    expect(classTokens(root)).toEqual(tokens(totalsClasses.card));
    expect(classTokens(root?.firstElementChild)).toEqual(tokens(totalsRowsClasses.card));
    expect(figures(root?.firstElementChild)).toEqual([['Total', '₱21,327.50']]);
    expect(classTokens(root?.querySelector('dl > div'))).toEqual(tokens(totalsRowClasses.card));
    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.card} ${balanceToneClasses.due}`));
    expect(classTokens(balance?.lastElementChild)).toEqual(tokens(balanceValueClasses.card));
    expect(container.textContent).not.toMatch(/Estimated Profit|Order Expenses|Discount/);

    const paid = render(<OrderTotals variant="card" totals={{ ...SERVER_0148, balance: '0.00', fullyPaid: true }} />);
    expect(paid.container.querySelector('svg')?.getAttribute('width')).toBe('18');
  });

  it('computes a preview with the D-09 centavo rounding: 7.5% of ₱17.00 is ₱1.28', () => {
    const order: Partial<Order> = {
      items: [{ quantity: 1, unitPrice: 17 }],
      discounts: [{ type: 'percentage', value: 7.5 }],
    };
    const { container } = render(<OrderTotals order={order} />);

    expect(figures(container.querySelector('dl'))[1]).toEqual(['Discount', `${MINUS}₱1.28`]);
  });

  it('shows a customer credit in the info block with the D-02 line and never as a negative balance', () => {
    const { container } = render(
      <OrderTotals totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '1000.00' }} />,
    );
    const balance = container.firstElementChild?.children[1];

    expect(balance?.textContent).toContain('Customer credit');
    expect(balance?.textContent).toContain('₱1,000.00');
    expect(balance?.textContent).toContain('Paid over the total. Record a refund to clear it.');
    expect(classTokens(balance)).toEqual(
      tokens(`${balanceClasses.panel} ${balanceToneClasses.credit} ${balanceWrapClasses}`),
    );
    expect(classTokens(balance?.firstElementChild)).toEqual(tokens(balanceOverlineClasses.credit));
    expect(balance?.textContent).not.toContain(MINUS);
    expect(container.textContent).not.toContain('Balance due');
    expect(container.textContent).not.toContain('Fully Paid');
  });

  it('shows the credit before Fully Paid when both are true (D-02)', () => {
    render(<OrderTotals totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '0.01', fullyPaid: true }} />);

    expect(screen.getByText('Customer credit')).toBeTruthy();
    expect(screen.getByText('₱0.01')).toBeTruthy();
    expect(screen.queryByText('Fully Paid')).toBeNull();
  });

  it('shows Record Refund in the credit block only when the caller gives a handler, and calls it (D-19)', () => {
    const credit = { ...SERVER_0148, balance: '0.00', customerCredit: '1000.00' };
    const { rerender } = render(<OrderTotals totals={credit} />);
    expect(screen.queryByRole('button', { name: 'Record Refund' })).toBeNull();

    const onRecordRefund = vi.fn();
    rerender(<OrderTotals totals={credit} onRecordRefund={onRecordRefund} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record Refund' }));
    expect(onRecordRefund).toHaveBeenCalledTimes(1);

    rerender(<OrderTotals totals={SERVER_0148} onRecordRefund={onRecordRefund} />);
    expect(screen.queryByRole('button', { name: 'Record Refund' })).toBeNull();
  });

  it('shows a credit on the card as a "Credit ₱X" info badge on the neutral ground, with no refund button (D-04)', () => {
    const { container } = render(
      <OrderTotals
        variant="card"
        totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '1000.00' }}
        onRecordRefund={vi.fn()}
      />,
    );
    const balance = container.firstElementChild?.children[1];

    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.card} ${balanceToneClasses.neutral}`));
    expect(balance?.firstElementChild?.textContent).toBe('Balance');
    expect(within(balance as HTMLElement).getByText('Credit ₱1,000.00')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).not.toContain(MINUS);
  });

  it('shows Not collected for a Cancelled order with a balance, on the neutral ground (D-45)', () => {
    const { container } = render(<OrderTotals totals={{ ...SERVER_0148, balance: '500.00' }} status="cancelled" />);
    const balance = container.firstElementChild?.children[1];

    expect(balance?.firstElementChild?.textContent).toBe('Not collected');
    expect(balance?.lastElementChild?.textContent).toBe('₱500.00');
    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.panel} ${balanceToneClasses.neutral}`));
    expect(classTokens(balance?.firstElementChild)).toEqual(tokens(balanceOverlineClasses.neutral));
    expect(container.textContent).not.toContain('Balance due');
  });

  it('keeps Balance due on a Cancelled order with nothing owed, and Fully Paid when it is paid', () => {
    const { rerender } = render(<OrderTotals totals={{ ...SERVER_0148, balance: '0.00' }} status="cancelled" />);
    expect(screen.getByText('Balance due')).toBeTruthy();
    expect(screen.queryByText('Not collected')).toBeNull();

    rerender(<OrderTotals totals={{ ...SERVER_0148, balance: '0.00', fullyPaid: true }} status="cancelled" />);
    expect(screen.getByText('Fully Paid')).toBeTruthy();
  });

  it('draws the balance edge cases by the centavo (ORD-01 adjacency)', () => {
    const { rerender } = render(<OrderTotals totals={{ ...SERVER_0148, balance: '0.00', fullyPaid: true }} />);
    expect(screen.getByText('Fully Paid')).toBeTruthy();

    rerender(<OrderTotals totals={{ ...SERVER_0148, balance: '0.01' }} />);
    expect(screen.getByText('Balance due')).toBeTruthy();
    expect(screen.getByText('₱0.01')).toBeTruthy();

    rerender(<OrderTotals totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '0.01' }} />);
    expect(screen.getByText('Customer credit')).toBeTruthy();
    expect(screen.getByText('₱0.01')).toBeTruthy();
  });

  it('shows the Refunded row as +₱ only when something was refunded (D-03)', () => {
    const { container, rerender } = render(<OrderTotals totals={SERVER_0148} />);
    expect(container.textContent).not.toContain('Refunded');

    rerender(<OrderTotals totals={{ ...SERVER_0148, refunded: '500.00' }} />);
    expect(figures(container.querySelector('dl'))).toEqual([
      ['Subtotal', '₱22,450.00'],
      ['Discount', `${MINUS}₱1,122.50`],
      ['Total', '₱21,327.50'],
      ['Paid', `${MINUS}₱12,000.00`],
      ['Refunded', '+₱500.00'],
    ]);
  });

  it('reads the Cancelled profit note: money kept (Paid - Refunded) minus Expenses (D-07)', () => {
    const { container } = render(<OrderTotals totals={SERVER_0148} status="cancelled" />);

    expect(container.querySelector('dl p')?.textContent).toBe(
      `Cancelled: profit = money kept (Paid ${MINUS} Refunded) ${MINUS} Expenses. Staff only.`,
    );
  });

  it('shows a negative profit in the danger colour with the true minus', () => {
    const { container } = render(<OrderTotals totals={{ ...SERVER_0148, profit: '-1200.00' }} />);
    const profit = container.querySelectorAll('dl')[1]?.querySelectorAll('dd')[1];

    expect(profit?.textContent).toBe(`${MINUS}₱1,200.00`);
    expect(classTokens(profit)).toEqual(tokens(`${totalsFigureClasses} ${totalsNegativeClasses}`));
  });

  it('leaves the expenses and profit list out when the figures carry none', () => {
    const listFigures: OrderFigures = {
      subtotal: '22450.00',
      discount: '1122.50',
      total: '21327.50',
      paid: '12000.00',
      refunded: '0.00',
      balance: '9327.50',
      customerCredit: '0.00',
      fullyPaid: false,
    };
    const { container } = render(<OrderTotals totals={listFigures} />);

    expect(container.querySelectorAll('dl')).toHaveLength(1);
  });

  it('treats an empty order as ₱0.00 due, not fully paid (Fully Paid needs Subtotal > 0)', () => {
    const { container } = render(<OrderTotals />);
    const balance = container.firstElementChild?.children[1];

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Subtotal', '₱0.00'],
      ['Discount', '₱0.00'],
      ['Total', '₱0.00'],
      ['Paid', '₱0.00'],
    ]);
    expect(balance?.firstElementChild?.textContent).toBe('Balance due');
    expect(balance?.lastElementChild?.textContent).toBe('₱0.00');
  });

  // D-41 R2-06 (owner, 2026-10-13; NET-IN-01 ruled keep): nothing is owed on a fully discounted order.
  it('shows a 100%-discounted order with no payment as "Fully Paid"', () => {
    const order: Partial<Order> = {
      items: [{ quantity: 3, unitPrice: 17 }],
      discounts: [{ type: 'percentage', value: 100 }],
    };
    const { container } = render(<OrderTotals order={order} />);
    const balance = container.firstElementChild?.children[1];

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Subtotal', '₱51.00'],
      ['Discount', `${MINUS}₱51.00`],
      ['Total', '₱0.00'],
      ['Paid', '₱0.00'],
    ]);
    expect(balance?.firstElementChild?.textContent).toBe('Balance');
    expect(balance?.lastElementChild?.textContent).toBe('Fully Paid');
  });

  it('previews an overpaid order as a customer credit, never a negative balance', () => {
    const order: Partial<Order> = { items: [{ quantity: 1, unitPrice: 100 }], payments: [{ amount: 130 }] };
    const { container } = render(<OrderTotals order={order} />);

    expect(container.firstElementChild?.children[1]?.textContent).toContain('Customer credit');
    expect(container.firstElementChild?.children[1]?.textContent).toContain('₱30.00');
    expect(container.firstElementChild?.children[1]?.textContent).not.toContain(MINUS);
  });

  it('has no axe violations for every balance state, panel and card', async () => {
    const states: [string, ReactElement][] = [
      ['due', <OrderTotals key="a" totals={SERVER_0148} />],
      ['paid', <OrderTotals key="b" totals={{ ...SERVER_0148, balance: '0.00', fullyPaid: true }} />],
      [
        'credit',
        <OrderTotals
          key="c"
          totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '1000.00', refunded: '200.00' }}
          onRecordRefund={vi.fn()}
        />,
      ],
      ['not collected', <OrderTotals key="d" totals={{ ...SERVER_0148, balance: '500.00' }} status="cancelled" />],
      ['card due', <OrderTotals key="e" variant="card" totals={SERVER_0148} />],
      [
        'card credit',
        <OrderTotals key="f" variant="card" totals={{ ...SERVER_0148, balance: '0.00', customerCredit: '5.00' }} />,
      ],
    ];
    for (const [, element] of states) {
      const { container, unmount } = render(element);
      await expectNoAxeViolations(container);
      unmount();
    }
    for (const id of ['order-totals-0148', 'order-totals-0151', 'order-totals-card-0148']) {
      const { container, unmount } = renderCase(id);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const totals: OrderFigures = { ...SERVER_0148, subtotal: '100.00', total: '100.00', balance: '100.00' };
    const { container, rerender } = render(<OrderTotals totals={totals} />);
    const first = container.innerHTML;

    rerender(<OrderTotals totals={totals} />);
    expect(container.innerHTML).toBe(first);

    rerender(<OrderTotals totals={{ ...totals, balance: '0.00', paid: '100.00', fullyPaid: true }} variant="card" />);
    expect(within(container).getByText('Fully Paid')).toBeTruthy();
  });
});

describe('KpiCard (App. D.3)', () => {
  function renderCollected() {
    return render(
      <KpiCard label="Collected · Oct" value={126450} icon="trending-up" delta={12} deltaLabel="vs Sep, same day" />,
    );
  }

  it('renders the card: head (overline label, icon tile), the peso value, then the foot, in the App. D.3 looks', () => {
    const { container } = renderCollected();
    const card = container.firstElementChild;
    const [head, value, foot] = [...(card?.children ?? [])];
    const [label, tile] = [...(head?.children ?? [])];

    expect(card?.localName).toBe('div');
    expect(classTokens(card)).toEqual(tokens(kpiClasses));
    expect(card?.hasAttribute('aria-busy')).toBe(false);
    expect(card?.children).toHaveLength(3);
    expect(classTokens(head)).toEqual(tokens(kpiHeadClasses));
    expect(label?.localName).toBe('span');
    expect(label?.textContent).toBe('Collected · Oct');
    expect(classTokens(label)).toEqual(tokens(overlineClasses));
    expect(tile?.localName).toBe('span');
    expect(classTokens(tile)).toEqual(tokens(kpiIconClasses));
    expect(value?.localName).toBe('div');
    expect(value?.textContent).toBe('₱126,450.00');
    expect(classTokens(value)).toEqual(tokens(kpiValueClasses));
    expect(classTokens(foot)).toEqual(tokens(kpiFootClasses));
    expect(foot?.lastElementChild?.textContent).toBe('vs Sep, same day');
  });

  it('draws the 18px icon in the tile, hidden from assistive technology', () => {
    const { container } = renderCollected();
    const icon = container.querySelector('svg');

    expect(icon?.getAttribute('width')).toBe('18');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('class')).toContain('lucide-trending-up');
  });

  it('shows a rise as a green trending-up chip with the percentage, its direction named "Up"', () => {
    const { container } = renderCollected();
    const chip = container.querySelector('svg[role="img"]')?.parentElement;

    expect(classTokens(chip)).toEqual(tokens(`${deltaClasses} ${deltaToneClasses.up}`));
    expect(chip?.textContent).toBe('12%');
    expect(screen.getByRole('img', { name: 'Up' }).getAttribute('class')).toContain('lucide-trending-up');
    expect(screen.getByRole('img', { name: 'Up' }).getAttribute('width')).toBe('14');
  });

  it('shows a fall as a red trending-down chip with the size of the fall, its direction named "Down"', () => {
    const { container } = render(
      <KpiCard
        label="Company expenses · Oct"
        value={38226.95}
        icon="receipt"
        delta={-47}
        deltaLabel="vs Sep, same day"
      />,
    );
    const chip = screen.getByRole('img', { name: 'Down' }).parentElement;

    expect(classTokens(chip)).toEqual(tokens(`${deltaClasses} ${deltaToneClasses.down}`));
    expect(chip?.textContent).toBe('47%');
    expect(screen.getByRole('img', { name: 'Down' }).getAttribute('class')).toContain('lucide-trending-down');
    expect(container.textContent).toContain('₱38,226.95');
    expect(container.textContent).not.toContain(MINUS);
  });

  it('counts no change as a rise, as App. D.3 does (delta 0 is up 0%)', () => {
    render(<KpiCard label="Collected · Oct" value={1} delta={0} />);

    expect(screen.getByRole('img', { name: 'Up' }).parentElement?.textContent).toBe('0%');
  });

  it('shows a count as it is when money is false, and a string value unformatted', () => {
    const { container, rerender } = render(
      <KpiCard label="Active orders" value={18} money={false} icon="clipboard-list" hint="4 due this week" />,
    );
    const [, value, foot] = [...(container.firstElementChild?.children ?? [])];

    expect(value?.textContent).toBe('18');
    expect(foot?.textContent).toBe('4 due this week');
    expect(foot?.children).toHaveLength(1);

    rerender(<KpiCard label="Top category" value="Rent" />);
    expect(container.firstElementChild?.children[1]?.textContent).toBe('Rent');
  });

  it('uses the hint when there is no delta label, and leaves the foot out when there is neither delta nor hint', () => {
    const { container, rerender } = render(<KpiCard label="Collected · Oct" value={1} delta={5} hint="This month" />);

    expect(container.firstElementChild?.children[2]?.lastElementChild?.textContent).toBe('This month');

    rerender(<KpiCard label="Collected · Oct" value={1} delta={5} deltaLabel="" hint="This month" />);
    expect(container.firstElementChild?.children[2]?.lastElementChild?.textContent).toBe('This month');

    rerender(<KpiCard label="Collected · Oct" value={1} hint="" />);
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('leaves the icon tile out when no icon is given', () => {
    const { container } = render(<KpiCard label="Receivables" value={84260} />);

    expect(container.firstElementChild?.firstElementChild?.children).toHaveLength(1);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('while loading: busy, a 70% by 36px skeleton instead of the value, and no foot', () => {
    const { container } = render(
      <KpiCard label="Active orders" value={18} money={false} icon="clipboard-list" hint="4 due this week" loading />,
    );
    const card = container.firstElementChild;
    const skeleton = card?.children[1];

    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(card?.children).toHaveLength(2);
    expect(skeleton?.localName).toBe('span');
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    expect(classTokens(skeleton)).toEqual(tokens(skeletonClasses));
    expect((skeleton as HTMLElement | undefined)?.style.getPropertyValue('--sk-w')).toBe('70%');
    expect((skeleton as HTMLElement | undefined)?.style.getPropertyValue('--sk-h')).toBe('36px');
    expect(card?.textContent).toBe('Active orders');
  });

  it('dims a zero figure by colour only: --ink-subtle on the value, no opacity anywhere (D-39, D-02)', () => {
    const { container } = render(
      <KpiCard label="Total receivables" value={0} icon="wallet" hint="Unpaid balances, all active orders" />,
    );
    const card = container.firstElementChild;
    const [head, value, foot] = [...(card?.children ?? [])];
    const allClasses = [...container.querySelectorAll('*')].flatMap((element) => [...element.classList]);

    expect(value?.textContent).toBe('₱0.00');
    expect(classTokens(value)).toEqual([...tokens(kpiValueClasses), 'text-ink-subtle'].sort());
    // Only the figure dims: the label, the icon tile and the foot keep their looks (as D-02 dims only the tile count).
    expect(allClasses.filter((token) => token === 'text-ink-subtle')).toEqual(['text-ink-subtle']);
    expect(classTokens(card)).toEqual(tokens(kpiClasses));
    expect(classTokens(head?.firstElementChild)).toEqual(tokens(overlineClasses));
    expect(classTokens(head?.lastElementChild)).toEqual(tokens(kpiIconClasses));
    expect(classTokens(foot)).toEqual(tokens(kpiFootClasses));
    expect(allClasses.filter((token) => token.includes('opacity'))).toEqual([]);
  });

  it.each([
    ['a money zero', { value: 0 }, true],
    ['a negative zero', { value: -0 }, true],
    ['a money figure that rounds to ₱0.00 (D-09)', { value: 0.004 }, true],
    ['a count of zero', { value: 0, money: false }, true],
    ['the smallest money figure, ₱0.01', { value: 0.01 }, false],
    ['a negative money figure', { value: -0.01 }, false],
    ['a count that is not a whole zero', { value: 0.004, money: false }, false],
    ['a non-zero count', { value: 18, money: false }, false],
    ['a text value, even "0"', { value: '0' }, false],
    ['a text value', { value: 'Rent' }, false],
  ] as const)('dims %s: %j -> %s (D-39)', (_name, props, dimmed) => {
    const { container } = render(<KpiCard label="Figure" {...props} />);
    const value = container.firstElementChild?.children[1];

    expect(classTokens(value).includes('text-ink-subtle')).toBe(dimmed);
    const base = typeof props.value === 'string' ? kpiTextValueClasses : kpiValueClasses;
    expect(classTokens(value)).toEqual(dimmed ? [...tokens(base), 'text-ink-subtle'].sort() : tokens(base));
  });

  it('re-renders a zero figure from the memo cache, and drops or takes the dim when the figure changes (D-39)', () => {
    const { container, rerender } = render(<KpiCard label="Total receivables" value={0} />);
    const value = () => container.firstElementChild?.children[1];
    const first = container.innerHTML;

    rerender(<KpiCard label="Total receivables" value={0} />);
    expect(container.innerHTML).toBe(first);
    expect(classTokens(value())).toContain('text-ink-subtle');

    rerender(<KpiCard label="Total receivables" value={1250} />);
    expect(value()?.textContent).toBe('₱1,250.00');
    expect(classTokens(value())).not.toContain('text-ink-subtle');

    rerender(<KpiCard label="Total receivables" value={0} money={false} />);
    expect(value()?.textContent).toBe('0');
    expect(classTokens(value())).toContain('text-ink-subtle');
  });

  it('has no axe violations, with a delta, with a hint and while loading', async () => {
    for (const element of [
      <KpiCard key="a" label="Collected · Oct" value={126450} icon="trending-up" delta={12} deltaLabel="vs Sep" />,
      <KpiCard key="b" label="Company expenses · Oct" value={38226.95} icon="receipt" delta={-47} />,
      <KpiCard key="c" label="Active orders" value={18} money={false} hint="4 due this week" loading />,
    ]) {
      const { container, unmount } = render(element);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<KpiCard label="Collected · Oct" value={126450} delta={12} />);
    const first = container.innerHTML;

    rerender(<KpiCard label="Collected · Oct" value={126450} delta={12} />);
    expect(container.innerHTML).toBe(first);

    rerender(<KpiCard label="Collected · Oct" value={126450} delta={-3} loading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'Down' })).toBeNull();
  });
});

describe('KpiCard empty and text values (OR-4, D-39; plan 06-09)', () => {
  it('shows EmptyValue in the dimmed zero look and ignores the value when empty', () => {
    const { container } = render(
      <KpiCard
        label="Top category · Oct"
        value="Supplies"
        money={false}
        icon="trending-up"
        empty
        hint="No expenses this month"
      />,
    );
    const card = container.firstElementChild;
    const [, value, foot] = [...(card?.children ?? [])];

    expect(value?.textContent).toBe('Not set');
    expect(value?.textContent).not.toContain('Supplies');
    expect(classTokens(value)).toEqual([...tokens(kpiValueClasses), 'text-ink-subtle'].sort());
    expect(value?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(value as HTMLElement).getByText('Not set')).toBeInTheDocument();
    expect(foot?.textContent).toBe('No expenses this month');
  });

  it('ignores a numeric value too, and shows the skeleton while loading even when empty', () => {
    const { container, rerender } = render(<KpiCard label="Top category" value={12345} empty />);
    expect(container.firstElementChild?.children[1]?.textContent).toBe('Not set');

    rerender(<KpiCard label="Top category" value={12345} empty loading />);
    expect(container.firstElementChild?.children[1]?.textContent).toBe('');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('changes nothing when empty is false or left out', () => {
    const { container, rerender } = render(<KpiCard label="Total receivables" value={1250} />);
    const first = container.innerHTML;

    rerender(<KpiCard label="Total receivables" value={1250} empty={false} />);
    expect(container.innerHTML).toBe(first);
    expect(container.firstElementChild?.children[1]?.textContent).toBe('₱1,250.00');
  });

  it('lets a text value wrap at word boundaries instead of running past the card', () => {
    const { container } = render(<KpiCard label="Top category · Oct" value="Government contributions" money={false} />);
    const value = container.firstElementChild?.children[1];

    expect(classTokens(value)).toEqual(tokens(kpiTextValueClasses));
    expect(classTokens(value)).toContain('wrap-break-word');
    expect(classTokens(value)).not.toContain('whitespace-nowrap');
  });

  it('shrinks a money figure of 15 characters or more so ₱999,999,999.99 fits the card, and leaves shorter figures alone (plan 06-18)', () => {
    const shorter = render(<KpiCard label="This month" value={99_999_999.99} />);
    expect(shorter.container.firstElementChild?.children[1]?.textContent).toBe('₱99,999,999.99');
    expect(classTokens(shorter.container.firstElementChild?.children[1])).toEqual(tokens(kpiValueClasses));
    shorter.unmount();

    const { container } = render(<KpiCard label="This month" value={999_999_999.99} />);
    const value = container.firstElementChild?.children[1];

    expect(value?.textContent).toBe('₱999,999,999.99');
    expect(classTokens(value)).toEqual(tokens(kpiLongValueClasses));
    expect(classTokens(value)).toContain('whitespace-nowrap');
  });

  it('keeps the one-line look for numbers and counts', () => {
    const { container } = render(<KpiCard label="Active orders" value={18} money={false} />);

    expect(classTokens(container.firstElementChild?.children[1])).toEqual(tokens(kpiValueClasses));
  });

  it('has no axe violations when empty or with a long text value', async () => {
    for (const element of [
      <KpiCard
        key="a"
        label="Top category · Oct"
        value=""
        money={false}
        icon="trending-up"
        empty
        hint="No expenses this month"
      />,
      <KpiCard
        key="b"
        label="Top category · Oct"
        value="Government contributions"
        money={false}
        hint="₱1.00 · 100% of this month"
      />,
    ]) {
      const { container, unmount } = render(element);
      await expectNoAxeViolations(container);
      unmount();
    }
  });
});

describe('money scenarios (the money parity group)', () => {
  it('declares Money in the default look, negative in danger, and the other sizes and tones', () => {
    expect(byId.get('money-positive')?.node).toEqual({ kind: 'node', component: 'Money', props: { amount: 12450 } });
    expect(byId.get('money-negative')?.node).toEqual({
      kind: 'node',
      component: 'Money',
      props: { amount: -732.5, tone: 'danger' },
    });
    expect(byId.get('money-lg-success')?.node.props).toEqual({ amount: 126450, size: 'lg', tone: 'success' });
    expect(byId.get('money-sm-muted')?.node.props).toEqual({ amount: 38226.95, size: 'sm', tone: 'muted' });
    expect(byId.get('money-warning')?.node.props).toEqual({ amount: 9327.5, tone: 'warning' });
  });

  it('declares OrderTotals on the spec seed orders ORD-2026-0148 and ORD-2026-0151', () => {
    expect(totalsNode('order-totals-0148')).toMatchObject({
      component: 'OrderTotals',
      props: { order: { number: 'ORD-2026-0148' } },
    });
    expect(totalsNode('order-totals-0151')).toMatchObject({
      component: 'OrderTotals',
      props: { order: { number: 'ORD-2026-0151' } },
    });
    expect(totalsNode('order-totals-card-0148')).toMatchObject({
      component: 'OrderTotals',
      props: { order: { number: 'ORD-2026-0148' }, variant: 'card' },
    });
  });

  it('wraps only the panels, whose note needs it, in the DefinedTotalsNote pair: one plain block', () => {
    expect(byId.get('order-totals-0148')?.node.component).toBe('DefinedTotalsNote');
    expect(byId.get('order-totals-0151')?.node.component).toBe('DefinedTotalsNote');
    expect(byId.get('order-totals-card-0148')?.node.component).toBe('OrderTotals');

    const { container } = render(
      renderNode(kit, byId.get('order-totals-0148')?.node ?? { kind: 'node', component: 'none' }, []),
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.localName).toBe('div');
    expect(wrapper?.attributes).toHaveLength(0);
    expect(wrapper?.children).toHaveLength(1);
  });

  it('declares KpiCard with the spec dashboard values: rise, fall, a count, zero and loading', () => {
    expect(byId.get('kpi-income')?.node).toEqual({
      kind: 'node',
      component: 'KpiCard',
      props: {
        label: 'Collected · Oct',
        value: 126450,
        icon: 'trending-up',
        delta: 12,
        deltaLabel: 'vs Sep, same day',
      },
    });
    expect(byId.get('kpi-expenses-delta-down')?.node.props).toMatchObject({ value: 38226.95, delta: -47 });
    expect(byId.get('kpi-active-orders')?.node.props).toMatchObject({ value: 18, money: false });
    expect(totalsNode('kpi-zero')).toMatchObject({
      component: 'KpiCard',
      props: { label: 'Total receivables', value: 0 },
    });
    expect(byId.get('kpi-loading')?.node.props).toMatchObject({ loading: true });
  });

  it('wraps the zero KPI, and only it, in the DimmedZeroKpi pair: one plain block, the figure dimmed (D-39)', () => {
    const wrapped = moneyScenarios.filter((scenario) => scenario.node.component === 'DimmedZeroKpi');
    expect(wrapped.map((scenario) => scenario.id)).toEqual(['kpi-zero']);

    const { container } = renderCase('kpi-zero');
    const value = container.firstElementChild?.children[1];
    expect(container.localName).toBe('div');
    expect(container.attributes).toHaveLength(0);
    expect(container.children).toHaveLength(1);
    expect(value?.textContent).toBe('₱0.00');
    expect(classTokens(value)).toContain('text-ink-subtle');
  });

  it('runs the loading card, and only it, in the reduced-motion pass (the shimmer stops, D-31 O-6)', () => {
    const withPasses = moneyScenarios.filter((scenario) => scenario.passes !== undefined);

    expect(withPasses.map((scenario) => scenario.id)).toEqual(['kpi-loading']);
    expect(byId.get('kpi-loading')?.passes).toEqual(['motion']);
  });

  it('compares every case in both themes at rest; the totals at every width, Money at 390 and 1440', () => {
    for (const scenario of moneyScenarios) {
      expect(scenario.group, scenario.id).toBe('money');
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.responsive, scenario.id).toBe(totalsNode(scenario.id)?.component === 'OrderTotals');
    }
  });
});
