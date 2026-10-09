import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { CARD_0148, ORDER_0153, scenarios as dataScenarios, TABLE_ROWS } from '@/dev/scenarios/groups/data';
import { ORDER_0148, ORDER_0151 } from '@/dev/scenarios/groups/money';
import type { ScenarioNode } from '@/dev/scenarios/types';
import { formatPeso, orderTotals, type Order, type Totals } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { DataTable, OrderCard, type DataTableColumn } from '@/ui/data';
import { skeletonClasses } from '@/ui/feedback/feedback.recipe';
import { srOnlyClasses } from '@/ui/layout/layout.recipe';
import {
  orderActionsClasses,
  orderBodyClasses,
  orderCardClasses,
  orderCountClasses,
  orderCustomerClasses,
  orderDateClasses,
  orderDatesClasses,
  orderHeadClasses,
  orderImageClasses,
  orderLastActionClasses,
  orderMediaClasses,
  orderNumberClasses,
  orderOverdueClasses,
  orderPlaceholderClasses,
  orderQtyClasses,
  orderStatusBadgeClasses,
  orderStatusClasses,
  orderTeamClasses,
  tableAlignClasses,
  tableCellClasses,
  tableColumnWidthClasses,
  tableClasses,
  tableHeadCellClasses,
  tableNumberCellClasses,
  tableRowClasses,
  tableStateClasses,
  tableStateToneClasses,
  tableWrapClasses,
} from './data.recipe';

// The converted App. D.3 OrderCard and DataTable (plan 02-24, CSPS-UI-SPEC.md §6.4, §12.2). The look is proven by the
// parity suite (`--grep @data`); these tests pin the markup, the figures, the custom-property-only styles and the
// scenario set the parity suite compares.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).every((token) => own.has(token));
}

const byId = new Map(dataScenarios.map((scenario) => [scenario.id, scenario]));

/** Renders a data scenario exactly as the parity page does: through the implementation kit. */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No data scenario "${id}".`);
  }
  return render(renderNode(kit, scenario.node, scenario.handlers ?? []));
}

const order0148 = CARD_0148 as unknown as Order;
const order0151 = ORDER_0151 as unknown as Order;
const order0153 = ORDER_0153 as unknown as Order;

/** The label → figure pairs of the card's totals list, in DOM order. */
function figures(container: HTMLElement): [string, string][] {
  return [...container.querySelectorAll('dt')].map((term) => [
    term.textContent,
    term.nextElementSibling?.textContent ?? '',
  ]);
}

describe('OrderCard (App. D.3)', () => {
  it('renders ORD-2026-0148: the number, 48 pcs, the team, the customer, the dates and the status', () => {
    render(<OrderCard order={order0148} />);
    const card = screen.getByRole('article');

    expect(within(card).getByText('ORD-2026-0148')).toBeTruthy();
    expect(within(card).getByText('48 pcs')).toBeTruthy();
    expect(within(card).getByRole('heading', { level: 3 }).textContent).toBe('Brgy. San Roque Ballers');
    expect(within(card).getByText('Juan Dela Cruz')).toBeTruthy();
    expect(within(card).getByText('Sep 28, 2026')).toBeTruthy();
    expect(within(card).getByText('Due Oct 14, 2026')).toBeTruthy();
    expect(within(card).getByText('In Production')).toBeTruthy();
  });

  it('shows the spec §12.2 figures for ORD-2026-0148 in the compact totals: balance due ₱9,327.50', () => {
    const { container } = render(<OrderCard order={order0148} />);

    expect(figures(container)).toEqual([
      ['Total', '₱22,450.00'],
      ['Total Discount', '−₱1,122.50'],
      ['Total Paid', '−₱12,000.00'],
    ]);
    expect(screen.getByText('Balance due')).toBeTruthy();
    expect(screen.getByText('₱9,327.50')).toBeTruthy();
    expect(screen.queryByText('Order Expenses')).toBeNull();
  });

  it('shows ORD-2026-0151 as Fully Paid', () => {
    render(<OrderCard order={order0151} />);

    expect(screen.getByText('Fully Paid')).toBeTruthy();
    expect(screen.getByText('Tondo Riders MC')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('shows the server totals it is given instead of computing a preview (D-09)', () => {
    const totals: Totals = {
      total: 23000,
      discount: 500,
      paid: 10000,
      balance: 12500,
      expenses: 0,
      profit: 22500,
      fullyPaid: false,
    };
    render(<OrderCard order={order0151} totals={totals} />);

    expect(screen.getByText('−₱10,000.00')).toBeTruthy();
    expect(screen.getByText('₱12,500.00')).toBeTruthy();
    expect(screen.queryByText('Fully Paid')).toBeNull();
  });

  it('makes the cover a button named "View order {number}" holding the placeholder, the status and the image count', () => {
    render(<OrderCard order={order0148} />);
    const media = screen.getByRole('button', { name: 'View order ORD-2026-0148' });

    expect(media.getAttribute('type')).toBe('button');
    expect(classTokens(media)).toEqual(tokens(orderMediaClasses));
    const placeholder = within(media).getByRole('img', { name: 'front-mockup.png (no image yet)' });
    expect(hasClasses(placeholder, orderPlaceholderClasses)).toBe(true);
    expect(placeholder.textContent).toContain('23');
    const status = within(media).getByText('In Production').parentElement;
    expect(classTokens(status)).toEqual(tokens(orderStatusClasses));
    expect(hasClasses(within(media).getByText('In Production'), orderStatusBadgeClasses)).toBe(true);
    const count = within(media).getByText('4');
    expect(classTokens(count)).toEqual(tokens(orderCountClasses));
    expect(count.querySelector('svg')).not.toBeNull();
  });

  it('shows a cover image with an empty alt, and no count chip for a single image', () => {
    const order: Order = { ...order0148, images: [{ id: 'cover', name: 'front.png', src: '/media/front.png' }] };
    const { container } = render(<OrderCard order={order} />);
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/media/front.png');
    expect(image?.getAttribute('alt')).toBe('');
    expect(classTokens(image)).toEqual(tokens(orderImageClasses));
    expect(screen.queryByRole('img', { name: /no image yet/ })).toBeNull();
    expect([...container.querySelectorAll('span')].some((span) => hasClasses(span, orderCountClasses))).toBe(false);
  });

  it('shows the customer as the title of a no-team order and leaves the customer line empty, as the approved design', () => {
    render(<OrderCard order={order0153} />);
    const card = screen.getByRole('article');
    const title = within(card).getByRole('heading', { level: 3 });

    expect(title.textContent).toBe('Angelica Santos');
    const customerLine = title.nextElementSibling;
    expect(customerLine?.localName).toBe('p');
    expect(customerLine?.textContent).toBe('');
    expect(classTokens(customerLine)).toEqual(tokens(orderCustomerClasses));
    expect(within(card).getByRole('img', { name: 'No images yet (no image yet)' })).toBeTruthy();
    expect(within(card).getByText('12 pcs')).toBeTruthy();
  });

  it('marks an overdue due date in the danger colour, and only the due date', () => {
    render(<OrderCard order={order0153} />);
    const due = screen.getByText('Due Oct 5, 2026');
    const ordered = screen.getByText('Oct 3, 2026');

    expect(classTokens(due)).toEqual(tokens(`${orderDateClasses} ${orderOverdueClasses}`));
    expect(classTokens(ordered)).toEqual(tokens(orderDateClasses));
    expect(due.querySelector('svg')).not.toBeNull();
  });

  it('renders the App. D.3 structure in the order-card looks', () => {
    const { container } = render(<OrderCard order={order0148} />);
    const card = container.firstElementChild;
    const [media, body, actions] = [...(card?.children ?? [])];
    const [head, team, customer, dates] = [...(body?.children ?? [])];

    expect(card?.localName).toBe('article');
    expect(classTokens(card)).toEqual(tokens(orderCardClasses));
    expect(media?.localName).toBe('button');
    expect(classTokens(body)).toEqual(tokens(orderBodyClasses));
    expect(classTokens(head)).toEqual(tokens(orderHeadClasses));
    expect(classTokens(head?.children[0])).toEqual(tokens(orderNumberClasses));
    expect(classTokens(head?.children[1])).toEqual(tokens(orderQtyClasses));
    expect(classTokens(team)).toEqual(tokens(orderTeamClasses));
    expect(customer?.textContent).toBe('Juan Dela Cruz');
    expect(classTokens(dates)).toEqual(tokens(orderDatesClasses));
    expect(classTokens(actions)).toEqual(tokens(orderActionsClasses));
  });

  it('ends with View, Edit and an icon-only Delete pushed right, each calling its handler', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<OrderCard order={order0148} onView={onView} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'View order ORD-2026-0148' }));
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const remove = screen.getByRole('button', { name: 'Delete order ORD-2026-0148' });
    fireEvent.click(remove);

    expect(onView).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(remove.textContent).toBe('');
    expect(remove.parentElement?.lastElementChild).toBe(remove);
    expect(hasClasses(remove, orderLastActionClasses)).toBe(true);
  });

  it('counts pieces from item quantities, reading a missing item list as 0 pcs', () => {
    const { number, customer, orderDate, dueDate, status } = order0148;
    render(<OrderCard order={{ number, customer, orderDate, dueDate, status }} />);

    expect(screen.getByText('0 pcs')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'No images yet (no image yet)' })).toBeTruthy();
  });

  it('counts a missing or non-numeric quantity as 0, as App. D.3 does', () => {
    const order: Order = {
      ...order0148,
      items: [
        { quantity: 3, unitPrice: 100 },
        { quantity: Number.NaN, unitPrice: 100 },
      ],
    };
    render(<OrderCard order={order} />);

    expect(screen.getByText('3 pcs')).toBeTruthy();
  });

  it('names a cover placeholder without a file name "No image yet"', () => {
    render(<OrderCard order={{ ...order0148, images: [{ id: 'cover' }] }} />);

    expect(screen.getByRole('img', { name: 'No image yet' })).toBeTruthy();
  });

  it('has no axe violations on the three seed cards', async () => {
    for (const id of ['order-card-0148', 'order-card-0151', 'order-card-walk-in']) {
      const { container, unmount } = renderCase(id);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<OrderCard order={order0148} />);
    const first = container.innerHTML;

    rerender(<OrderCard order={order0148} />);
    expect(container.innerHTML).toBe(first);

    rerender(<OrderCard order={order0151} />);
    expect(screen.getByText('Fully Paid')).toBeTruthy();
  });
});

type Row = Record<string, unknown>;

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'number', label: 'Order', width: 150 },
  { key: 'team', label: 'Customer / team' },
  { key: 'due', label: 'Due', width: '16%', align: 'center' },
  { key: 'total', label: 'Total', align: 'right', money: true },
];

const ROWS: Row[] = [
  { number: 'ORD-2026-0148', team: 'Brgy. San Roque Ballers', due: 'Oct 14, 2026', total: 22450 },
  { number: 'ORD-2026-0151', team: 'Tondo Riders MC', due: 'Oct 10, 2026', total: 23000 },
];

describe('DataTable (App. D.3)', () => {
  it('renders a real table: a visually hidden caption and column headers in the header look', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey="number" caption="Recent orders" />);
    const table = screen.getByRole('table', { name: 'Recent orders' });
    const headers = within(table).getAllByRole('columnheader');

    expect(classTokens(table)).toEqual(tokens(tableClasses));
    expect(classTokens(table.parentElement)).toEqual(tokens(tableWrapClasses));
    expect(classTokens(table.querySelector('caption'))).toEqual(tokens(srOnlyClasses));
    expect(headers.map((header) => header.textContent)).toEqual(['Order', 'Customer / team', 'Due', 'Total']);
    for (const header of headers) {
      expect(header.getAttribute('scope')).toBe('col');
      expect(hasClasses(header, tableHeadCellClasses)).toBe(true);
    }
  });

  it('makes the sideways-scrolling frame a focusable region named by the caption (A11Y-01, WCAG 2.1.1)', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} caption="Recent orders" />);
    const region = screen.getByRole('region', { name: 'Recent orders' });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table')).toBeTruthy();
  });

  it('aligns cells through the class map: left by default, right and centre when asked', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const [order, team, due, total] = screen.getAllByRole('columnheader');
    const cells = screen.getAllByRole('cell');

    expect(hasClasses(order, tableAlignClasses.left)).toBe(true);
    expect(hasClasses(team, tableAlignClasses.left)).toBe(true);
    expect(hasClasses(due, tableAlignClasses.center)).toBe(true);
    expect(hasClasses(total, tableAlignClasses.right)).toBe(true);
    expect(classTokens(cells[0])).toEqual(tokens(`${tableCellClasses} ${tableAlignClasses.left}`));
    expect(classTokens(cells[2])).toEqual(tokens(`${tableCellClasses} ${tableAlignClasses.center}`));
  });

  it('formats money cells with formatPeso, right-aligned in the tabular number look', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const money = screen.getByText('₱22,450.00');

    expect(money.localName).toBe('td');
    expect(classTokens(money)).toEqual(
      tokens(`${tableCellClasses} ${tableAlignClasses.right} ${tableNumberCellClasses}`),
    );
    expect(screen.getByText('₱23,000.00')).toBeTruthy();
  });

  it('sizes columns only through --col-w (px for a number, the text for a string); no other inline style', () => {
    const { container } = render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const [order, team, due] = screen.getAllByRole('columnheader');

    expect(order?.style.getPropertyValue('--col-w')).toBe('150px');
    expect(due?.style.getPropertyValue('--col-w')).toBe('16%');
    expect(hasClasses(order, tableColumnWidthClasses)).toBe(true);
    expect(hasClasses(team, tableColumnWidthClasses)).toBe(false);
    expect(team?.getAttribute('style')).toBeNull();
    for (const element of container.querySelectorAll('[style]')) {
      const style = (element as HTMLElement).style;
      const names = Array.from({ length: style.length }, (_, index) => style.item(index));
      expect(names, element.outerHTML).toEqual(['--col-w']);
    }
  });

  it('marks every body row as the row group, so the last row drops its rule and a hovered row highlights', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const rows = within(screen.getAllByRole('rowgroup')[1] ?? document.body).getAllByRole('row');

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(classTokens(row)).toEqual(tokens(tableRowClasses));
    }
    expect(tokens(tableCellClasses)).toEqual(
      expect.arrayContaining(['group-last/row:border-b-0', 'group-hover/row:bg-surface-2']),
    );
  });

  it('while loading: four hidden skeleton rows, 60% wide in right-aligned columns and 80% elsewhere, 14px high', () => {
    const { container } = render(<DataTable columns={COLUMNS} rows={ROWS} loading />);
    const body = container.querySelector('tbody');
    const rows = [...(body?.querySelectorAll('tr') ?? [])];

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.getAttribute('aria-hidden')).toBe('true');
      const bones = [...row.querySelectorAll('td > span')];
      expect(bones).toHaveLength(4);
      expect(bones.map((bone) => (bone as HTMLElement).style.getPropertyValue('--sk-w'))).toEqual([
        '80%',
        '80%',
        '80%',
        '60%',
      ]);
      for (const bone of bones) {
        expect(classTokens(bone)).toEqual(tokens(skeletonClasses));
        expect((bone as HTMLElement).style.getPropertyValue('--sk-h')).toBe('14px');
      }
    }
    expect(screen.queryByText('ORD-2026-0148')).toBeNull();
  });

  it('shows an error as one danger row across every column, with the alert icon', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} error="Couldn't load orders." />);
    const message = screen.getByText("Couldn't load orders.");

    expect(classTokens(message)).toEqual(tokens(`${tableStateClasses} ${tableStateToneClasses.error}`));
    expect(message.parentElement?.getAttribute('colspan')).toBe('4');
    expect(message.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('ORD-2026-0148')).toBeNull();
  });

  it('shows "Nothing here yet." for no rows, or the empty node it is given', () => {
    const { rerender } = render(<DataTable columns={COLUMNS} rows={[]} />);
    const message = screen.getByText('Nothing here yet.');

    expect(classTokens(message)).toEqual(tokens(`${tableStateClasses} ${tableStateToneClasses.empty}`));
    expect(message.parentElement?.getAttribute('colspan')).toBe('4');

    rerender(<DataTable columns={COLUMNS} rows={[]} empty={<p>No orders yet</p>} />);
    expect(screen.getByText('No orders yet')).toBeTruthy();
    expect(screen.queryByText('Nothing here yet.')).toBeNull();
  });

  it('renders a cell through the column render function when there is one', () => {
    const columns: DataTableColumn<Row>[] = [
      { key: 'number', label: 'Order', render: (row) => <strong>{String(row.number)}!</strong> },
    ];
    render(<DataTable columns={columns} rows={ROWS} />);

    expect(screen.getByText('ORD-2026-0148!').localName).toBe('strong');
  });

  it('has no axe violations with rows, loading, empty and error', async () => {
    for (const id of ['data-table-orders', 'data-table-loading', 'data-table-empty', 'data-table-error']) {
      const { container, unmount } = renderCase(id);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const first = container.innerHTML;

    rerender(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(container.innerHTML).toBe(first);

    rerender(<DataTable columns={COLUMNS} rows={ROWS.slice(1)} />);
    expect(screen.queryByText('ORD-2026-0148')).toBeNull();
  });
});

describe('data scenarios (the data parity group, OrderCard and DataTable)', () => {
  it('declares OrderCard on the spec seed orders: ORD-2026-0148, ORD-2026-0151 and the no-team ORD-2026-0153', () => {
    const cards = dataScenarios.filter((scenario) => scenario.node.component === 'OrderCard');

    expect(cards.map((scenario) => scenario.id)).toEqual(['order-card-0148', 'order-card-0151', 'order-card-walk-in']);
    for (const card of cards) {
      expect(card.handlers, card.id).toEqual(['onView', 'onEdit', 'onDelete']);
    }
    expect(byId.get('order-card-0148')?.states).toEqual(['rest', 'hover']);
    expect(ORDER_0153.team).toBeUndefined();
  });

  it('declares DataTable with the orders (hovering the first row), loading, empty and error', () => {
    const tables = dataScenarios.filter((scenario) => scenario.node.component === 'KeyboardScrollTable');
    for (const scenario of tables) {
      const inner = scenario.node.props?.children as ScenarioNode | undefined;
      expect(inner?.component, scenario.id).toBe('DataTable');
    }

    expect(tables.map((scenario) => scenario.id)).toEqual([
      'data-table-orders',
      'data-table-loading',
      'data-table-empty',
      'data-table-error',
    ]);
    expect(byId.get('data-table-orders')?.states).toEqual(['rest', 'hover']);
    expect(byId.get('data-table-orders')?.target).toBe('tbody tr');
  });

  it('lists the table figures that orderTotals gives for the seed orders', () => {
    const fromSeed = new Map(
      [ORDER_0148, ORDER_0151, ORDER_0153].map((order) => [
        order.number as string,
        orderTotals(order as unknown as Order),
      ]),
    );
    for (const row of TABLE_ROWS) {
      const totals = fromSeed.get(row.number as string);
      if (totals !== undefined) {
        expect(formatPeso(row.total as number), row.number as string).toBe(formatPeso(totals.total));
        expect(formatPeso(row.balance as number), row.number as string).toBe(formatPeso(totals.balance));
      }
    }
    expect(fromSeed.size).toBe(3);
  });

  it('compares every case in both themes at 390 and 1440', () => {
    for (const scenario of dataScenarios) {
      expect(scenario.group, scenario.id).toBe('data');
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.responsive, scenario.id).toBe(false);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });
});
