import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as moneyScenarios } from '@/dev/scenarios/groups/money';
import type { ScenarioNode } from '@/dev/scenarios/types';
import type { Order, Totals } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { Money, OrderTotals } from '@/ui/money';
import {
  balanceClasses,
  balanceOverlineClasses,
  balancePaidClasses,
  balanceToneClasses,
  balanceValueClasses,
  moneyClasses,
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

/**
 * Renders a money scenario exactly as the parity page does: through the implementation kit. The panels sit in the
 * DefinedTotalsNote wrapper pair (one plain block), so `container` is the block that holds the component.
 */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No money scenario "${id}".`);
  }
  const result = render(renderNode(kit, scenario.node, scenario.handlers ?? []));
  const wrapper = scenario.node.component === 'DefinedTotalsNote' ? result.container.firstElementChild : null;
  return { ...result, container: wrapper ?? result.container };
}

/** The OrderTotals node of a money scenario, inside its wrapper or not. */
function totalsNode(id: string): ScenarioNode | undefined {
  const outer = byId.get(id)?.node;
  const inner = outer?.props?.children;
  return outer?.component === 'DefinedTotalsNote' && typeof inner === 'object' && inner !== null && 'kind' in inner
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

describe('OrderTotals (App. D.3)', () => {
  it('shows the spec §12.2 figures for ORD-2026-0148 in the panel: Total, Discount and Paid as negatives', () => {
    const { container } = renderCase('order-totals-0148');
    const [main, internal] = [...container.querySelectorAll('dl')];

    expect(figures(main)).toEqual([
      ['Total', '₱22,450.00'],
      ['Total Discount', `${MINUS}₱1,122.50`],
      ['Total Paid', `${MINUS}₱12,000.00`],
    ]);
    expect(figures(internal)).toEqual([
      ['Order Expenses', '₱6,065.00'],
      ['Estimated Profit', '₱15,262.50'],
    ]);
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

  it('renders the App. D.3 panel markup: rows list, balance, then the dashed internal list with the note', () => {
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
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(classTokens(row)).toEqual(tokens(totalsRowClasses.panel));
      expect(classTokens(row.querySelector('dd'))).toEqual(tokens(totalsFigureClasses));
    }
    expect(classTokens(rows[0]?.querySelector('dt'))).toEqual(tokens(totalsTermClasses.normal));
    expect(classTokens(rows[4]?.querySelector('dt'))).toEqual(tokens(totalsTermClasses.strong));
    expect(note?.localName).toBe('p');
    expect(note?.textContent).toBe(`Profit = Total ${MINUS} Discount ${MINUS} Expenses. Internal only.`);
    expect(classTokens(note)).toEqual(tokens(totalsNoteClasses));
  });

  it('keeps the note inside the internal list as a definition, so the list stays valid (A11Y-01)', () => {
    const { container } = renderCase('order-totals-0148');
    const note = container.querySelector('dl p');

    expect(note?.getAttribute('role')).toBe('definition');
  });

  it('shows ORD-2026-0151 as fully paid: the success ground, "Balance", the check icon and "Fully Paid"', () => {
    const { container } = renderCase('order-totals-0151');
    const balance = container.firstElementChild?.children[1];
    const [overline, paid] = [...(balance?.children ?? [])];
    const icon = paid?.querySelector('svg');

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Total', '₱23,000.00'],
      ['Total Discount', `${MINUS}₱500.00`],
      ['Total Paid', `${MINUS}₱22,500.00`],
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

  it('renders the compact card variant: tighter rows, the 28px balance, 18px check, and no expenses or profit', () => {
    const { container } = renderCase('order-totals-card-0148');
    const root = container.firstElementChild;
    const balance = root?.children[1];

    expect(root?.children).toHaveLength(2);
    expect(classTokens(root)).toEqual(tokens(totalsClasses.card));
    expect(classTokens(root?.firstElementChild)).toEqual(tokens(totalsRowsClasses.card));
    expect(classTokens(root?.querySelector('dl > div'))).toEqual(tokens(totalsRowClasses.card));
    expect(classTokens(balance)).toEqual(tokens(`${balanceClasses.card} ${balanceToneClasses.due}`));
    expect(classTokens(balance?.lastElementChild)).toEqual(tokens(balanceValueClasses.card));
    expect(container.textContent).not.toContain('Estimated Profit');

    const paid = render(<OrderTotals variant="card" totals={{ ...ZERO_TOTALS, total: 100, fullyPaid: true }} />);
    expect(paid.container.querySelector('svg')?.getAttribute('width')).toBe('18');
  });

  it('shows the figures it is given (the server totals) instead of computing a preview (D-09)', () => {
    const server: Totals = {
      total: 23000,
      discount: 500,
      paid: 10000,
      balance: 12500,
      expenses: 9300,
      profit: 13200,
      fullyPaid: false,
    };
    const order: Partial<Order> = { items: [{ quantity: 1, unitPrice: 1 }] };
    const { container } = render(<OrderTotals order={order} totals={server} />);

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Total', '₱23,000.00'],
      ['Total Discount', `${MINUS}₱500.00`],
      ['Total Paid', `${MINUS}₱10,000.00`],
    ]);
    expect(container.firstElementChild?.children[1]?.lastElementChild?.textContent).toBe('₱12,500.00');
  });

  it('computes a preview with the D-09 centavo rounding: 7.5% of ₱17.00 is ₱1.28', () => {
    const order: Partial<Order> = {
      items: [{ quantity: 1, unitPrice: 17 }],
      discounts: [{ type: 'percentage', value: 7.5 }],
    };
    const { container } = render(<OrderTotals order={order} />);

    expect(figures(container.querySelector('dl'))[1]).toEqual(['Total Discount', `${MINUS}₱1.28`]);
  });

  it('shows a negative profit in the danger colour', () => {
    const order: Partial<Order> = { items: [{ quantity: 1, unitPrice: 1000 }], expenses: [{ amount: 1500 }] };
    const { container } = render(<OrderTotals order={order} />);
    const profit = container.querySelectorAll('dl')[1]?.querySelectorAll('dd')[1];

    expect(profit?.textContent).toBe(`${MINUS}₱500.00`);
    expect(classTokens(profit)).toEqual(tokens(`${totalsFigureClasses} ${totalsNegativeClasses}`));
  });

  it('treats an empty order as ₱0.00 due, not fully paid (Fully Paid needs Total > 0)', () => {
    const { container } = render(<OrderTotals />);
    const balance = container.firstElementChild?.children[1];

    expect(figures(container.querySelector('dl'))).toEqual([
      ['Total', '₱0.00'],
      ['Total Discount', '₱0.00'],
      ['Total Paid', '₱0.00'],
    ]);
    expect(balance?.firstElementChild?.textContent).toBe('Balance due');
    expect(balance?.lastElementChild?.textContent).toBe('₱0.00');
  });

  it('has no axe violations, due and fully paid, panel and card', async () => {
    for (const id of ['order-totals-0148', 'order-totals-0151', 'order-totals-card-0148']) {
      const { container, unmount } = renderCase(id);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const totals: Totals = { ...ZERO_TOTALS, total: 100, balance: 100 };
    const { container, rerender } = render(<OrderTotals totals={totals} />);
    const first = container.innerHTML;

    rerender(<OrderTotals totals={totals} />);
    expect(container.innerHTML).toBe(first);

    rerender(<OrderTotals totals={{ ...totals, balance: 0, paid: 100, fullyPaid: true }} variant="card" />);
    expect(within(container).getByText('Fully Paid')).toBeTruthy();
  });
});

const ZERO_TOTALS: Totals = {
  total: 0,
  discount: 0,
  paid: 0,
  balance: 0,
  expenses: 0,
  profit: 0,
  fullyPaid: false,
};

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
