import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import {
  CARD_0148,
  CARD_0151,
  CARD_0153,
  ORDER_0153,
  scenarios as dataScenarios,
  TABLE_ROWS,
} from '@/dev/scenarios/groups/data';
import { ORDER_0148, ORDER_0151 } from '@/dev/scenarios/groups/money';
import type { ScenarioNode, ScenarioProps } from '@/dev/scenarios/types';
import { formatPeso, orderTotals, type Order } from '@/utils/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { DataTable, OrderCard, WALK_IN_CUSTOMER, type DataTableColumn, type OrderCardOrder } from '@/components/data';
import { skeletonClasses } from '@/components/feedback/feedback.recipe';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
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
  orderMediaClasses,
  orderNumberClasses,
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

/** A list row as the API sends it, with the figures as decimal text (ORD-2026-0148). */
const row0148: OrderCardOrder = CARD_0148 as unknown as OrderCardOrder;
const row0151: OrderCardOrder = CARD_0151 as unknown as OrderCardOrder;
const row0153: OrderCardOrder = CARD_0153 as unknown as OrderCardOrder;

const creditRow: OrderCardOrder = { ...row0151, balance: '0.00', customerCredit: '1000.00', fullyPaid: false };
const cancelledRow: OrderCardOrder = {
  ...row0148,
  status: 'cancelled',
  paid: '1000.00',
  balance: '20327.50',
};

/** The label → figure pairs of the card's totals list, in DOM order. */
function figures(container: HTMLElement): [string, string][] {
  return [...container.querySelectorAll('dt')].map((term) => [
    term.textContent,
    term.nextElementSibling?.textContent ?? '',
  ]);
}

describe('OrderCard (list contract, D-04, D-22, D-27, D-40, D-46, D-57)', () => {
  it('renders ORD-2026-0148: the number, 48 pcs, the team, the customer, the dates and the status', () => {
    render(<OrderCard order={row0148} />);
    const card = screen.getByRole('article');

    expect(within(card).getByText('ORD-2026-0148')).toBeTruthy();
    expect(within(card).getByText('48 pcs')).toBeTruthy();
    expect(within(card).getByRole('heading', { level: 3 }).textContent).toBe('Brgy. San Roque Ballers');
    expect(within(card).getByText('Juan Dela Cruz')).toBeTruthy();
    expect(within(card).getByText('Sep 28, 2026')).toBeTruthy();
    expect(within(card).getByText('Due Oct 14, 2026')).toBeTruthy();
    expect(within(card).getByText('In Production')).toBeTruthy();
  });

  it('shows the piece count with en-PH thousands, and a text count as it comes from the API (D-40)', () => {
    const { rerender } = render(<OrderCard order={{ ...row0148, pieces: 1234 }} />);
    expect(screen.getByText('1,234 pcs')).toBeTruthy();

    rerender(<OrderCard order={{ ...row0148, pieces: '12' }} />);
    expect(screen.getByText('12 pcs')).toBeTruthy();

    rerender(<OrderCard order={{ ...row0148, pieces: 0 }} />);
    expect(screen.getByText('0 pcs')).toBeTruthy();
  });

  it('shows Total and Balance due for ORD-2026-0148 and no discount, expenses or profit (D-04, D-06, ORD-19)', () => {
    const { container } = render(<OrderCard order={row0148} />);

    expect(figures(container)).toEqual([['Total', '₱21,327.50']]);
    expect(screen.getByText('Balance due')).toBeTruthy();
    expect(screen.getByText('₱9,327.50')).toBeTruthy();
    expect(container.textContent).not.toMatch(/Discount|Order Expenses|Estimated Profit|Profit/);
  });

  it('shows ORD-2026-0151 as Fully Paid', () => {
    render(<OrderCard order={row0151} />);

    expect(screen.getByText('Fully Paid')).toBeTruthy();
    expect(screen.getByText('Tondo Riders MC')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('shows a customer credit as a "Credit ₱X" info badge, never as a negative balance (ORD-12)', () => {
    const { container } = render(<OrderCard order={creditRow} />);

    expect(screen.getByText('Credit ₱1,000.00')).toBeTruthy();
    expect(screen.queryByText('Fully Paid')).toBeNull();
    expect(screen.queryByText('Balance due')).toBeNull();
    expect(container.textContent).not.toContain('−');
  });

  it('shows Not collected with the figure for a Cancelled order with money unpaid (D-45)', () => {
    render(<OrderCard order={cancelledRow} />);

    expect(screen.getByText('Not collected')).toBeTruthy();
    expect(screen.getByText('₱20,327.50')).toBeTruthy();
    expect(screen.queryByText('Balance due')).toBeNull();
  });

  it('shows the server figures it is given, as text, without any browser arithmetic (D-09)', () => {
    render(<OrderCard order={{ ...row0151, total: '99999999.99', balance: '12500.00', fullyPaid: false }} />);

    expect(screen.getByText('₱99,999,999.99')).toBeTruthy();
    expect(screen.getByText('₱12,500.00')).toBeTruthy();
    expect(screen.queryByText('Fully Paid')).toBeNull();
  });

  it('has no Delete action anywhere on the card (D-22)', () => {
    render(<OrderCard order={row0148} />);

    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /delete/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('shows "No images yet" on the cover and names it with the order and its status (D-27, UIC-54)', () => {
    render(<OrderCard order={row0148} />);
    const media = screen.getByRole('button', { name: 'View order ORD-2026-0148, In Production' });

    expect(media.getAttribute('type')).toBe('button');
    expect(classTokens(media)).toEqual(tokens(orderMediaClasses));
    const placeholder = within(media).getByRole('img', { name: 'No images yet (no image yet)' });
    expect(hasClasses(placeholder, orderPlaceholderClasses)).toBe(true);
    const status = within(media).getByText('In Production').parentElement;
    expect(classTokens(status)).toEqual(tokens(orderStatusClasses));
    expect(hasClasses(within(media).getByText('In Production'), orderStatusBadgeClasses)).toBe(true);
  });

  it('names the footer buttons by their order: "View order {number}" and "Edit details of order {number}" (D-46, D-57)', () => {
    render(<OrderCard order={row0148} />);
    const view = screen.getByRole('button', { name: 'View order ORD-2026-0148' });
    const edit = screen.getByRole('button', { name: 'Edit details of order ORD-2026-0148' });

    expect(view.textContent).toBe('View Order');
    expect(edit.textContent).toBe('Edit Details');
  });

  it.each(['completed', 'cancelled'] as const)('hides Edit Details on a %s order (D-15)', (status) => {
    render(<OrderCard order={{ ...row0148, status }} />);

    expect(screen.queryByRole('button', { name: /Edit details/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'View order ORD-2026-0148' })).toBeTruthy();
  });

  it.each(['pending', 'mockup', 'production', 'ready', 'delivered'] as const)(
    'offers Edit Details on a %s order',
    (status) => {
      render(<OrderCard order={{ ...row0148, status }} />);

      expect(screen.getByRole('button', { name: 'Edit details of order ORD-2026-0148' })).toBeTruthy();
    },
  );

  it('calls onView from the cover and the View Order button, and onEdit from Edit Details', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    render(<OrderCard order={row0148} onView={onView} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'View order ORD-2026-0148, In Production' }));
    fireEvent.click(screen.getByRole('button', { name: 'View order ORD-2026-0148' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details of order ORD-2026-0148' }));

    expect(onView).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps the footer to View Order and Edit Details, in the actions look', () => {
    const { container } = render(<OrderCard order={row0148} />);
    const actions = container.firstElementChild?.lastElementChild;

    expect(classTokens(actions)).toEqual(tokens(orderActionsClasses));
    expect([...(actions?.children ?? [])].map((button) => button.textContent)).toEqual(['View Order', 'Edit Details']);
  });

  it('puts the due slot after the clock icon instead of the plain due date', () => {
    const { container } = render(<OrderCard order={row0148} due={<span>Due in 3 days</span>} />);
    const clock = container.querySelector('svg.lucide-clock')?.parentElement;

    expect(clock?.textContent).toBe('Due in 3 days');
    expect(screen.queryByText('Due Oct 14, 2026')).toBeNull();
  });

  it('shows a cover image with an empty alt, the name with its image count, and a count chip (Phase 9 cover)', () => {
    const { container } = render(
      <OrderCard order={row0148} cover={{ src: '/media/front.png', name: 'front.png', count: 1200 }} />,
    );
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/media/front.png');
    expect(image?.getAttribute('alt')).toBe('');
    expect(classTokens(image)).toEqual(tokens(orderImageClasses));
    const media = screen.getByRole('button', { name: 'View order ORD-2026-0148, In Production, 1,200 images' });
    expect(media.textContent).toContain('1,200');
    expect(classTokens(within(media).getByText('1,200'))).toEqual(tokens(orderCountClasses));
    expect(screen.queryByRole('img', { name: /no image yet/ })).toBeNull();
  });

  it('draws a cover placeholder with its file name and number, and no count chip for one image', () => {
    const { container } = render(
      <OrderCard order={row0148} cover={{ name: 'front-mockup.png', number: '23', count: 1 }} />,
    );
    const placeholder = screen.getByRole('img', { name: 'front-mockup.png (no image yet)' });

    expect(placeholder.textContent).toContain('23');
    expect([...container.querySelectorAll('span')].some((span) => hasClasses(span, orderCountClasses))).toBe(false);
    expect(screen.getByRole('button', { name: 'View order ORD-2026-0148, In Production' })).toBeTruthy();
  });

  it('names a cover placeholder without a file name "No image yet"', () => {
    render(<OrderCard order={row0148} cover={{}} />);

    expect(screen.getByRole('img', { name: 'No image yet' })).toBeTruthy();
  });

  it('names the cover with the raw text for a status it does not know', () => {
    render(<OrderCard order={{ ...row0148, status: 'on_hold' as unknown as OrderCardOrder['status'] }} />);

    expect(screen.getByRole('button', { name: 'View order ORD-2026-0148, on_hold' })).toBeTruthy();
  });

  it('pins the walk-in wording to the spec §8.3 table rows: "Walk-in customer"', () => {
    expect(WALK_IN_CUSTOMER).toBe('Walk-in customer');
  });

  it('shows the customer as the title of a no-team order and "Walk-in customer" on the next line (D-40, UIC-5)', () => {
    render(<OrderCard order={row0153} />);
    const card = screen.getByRole('article');
    const title = within(card).getByRole('heading', { level: 3 });

    expect(title.textContent).toBe('Angelica Santos');
    const customerLine = title.nextElementSibling;
    expect(customerLine?.localName).toBe('p');
    expect(customerLine?.textContent).toBe('Walk-in customer');
    expect(customerLine?.childNodes).toHaveLength(1);
    expect(customerLine?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(classTokens(customerLine)).toEqual(tokens(orderCustomerClasses));
    expect(within(card).getByRole('img', { name: 'No images yet (no image yet)' })).toBeTruthy();
    expect(within(card).getByText('12 pcs')).toBeTruthy();
  });

  it('reads an empty team as no team: the customer is the title and the line says "Walk-in customer" (D-40)', () => {
    render(<OrderCard order={{ ...row0148, teamName: '' }} />);
    const title = screen.getByRole('heading', { level: 3 });

    expect(title.textContent).toBe('Juan Dela Cruz');
    expect(title.nextElementSibling?.textContent).toBe('Walk-in customer');
  });

  it('keeps a team order unchanged: the team is the title and the customer is on the customer line (D-40)', () => {
    render(<OrderCard order={row0148} />);
    const title = screen.getByRole('heading', { level: 3 });

    expect(title.textContent).toBe('Brgy. San Roque Ballers');
    expect(title.nextElementSibling?.textContent).toBe('Juan Dela Cruz');
    expect(classTokens(title.nextElementSibling)).toEqual(tokens(orderCustomerClasses));
    expect(screen.queryByText('Walk-in customer')).toBeNull();
  });

  it('renders the card structure in the order-card looks', () => {
    const { container } = render(<OrderCard order={row0148} />);
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
    expect(dates?.children).toHaveLength(2);
    expect(classTokens(dates?.children[0])).toEqual(tokens(orderDateClasses));
    expect(classTokens(actions)).toEqual(tokens(orderActionsClasses));
  });

  it('shows the empty-value icon where the due date is missing, and keeps a valid order date (OR-4)', async () => {
    const { container } = render(<OrderCard order={{ ...row0148, dueDate: null }} />);
    const due = screen.getByText(/^Due/);

    expect(due.textContent).toBe('Due Not set');
    expect(due.querySelector('svg.lucide-minus')).not.toBeNull();
    expect(screen.getByText('Sep 28, 2026')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('shows the empty-value icon where the order date is invalid (OR-4)', async () => {
    const { container } = render(<OrderCard order={{ ...row0148, orderDate: 'garbage' }} />);
    const orderDate = container.querySelector('svg.lucide-calendar')?.parentElement;

    expect(orderDate?.textContent).toBe('Not set');
    expect(orderDate?.querySelector('svg.lucide-minus')).not.toBeNull();
    expect(screen.getByText('Due Oct 14, 2026')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('has no axe violations on the seed cards, the credit card and the Not collected card', async () => {
    for (const id of ['order-card-0148', 'order-card-0151', 'order-card-walk-in']) {
      const { container, unmount } = renderCase(id);
      await expectNoAxeViolations(container);
      unmount();
    }
    for (const order of [creditRow, cancelledRow, { ...row0148, status: 'completed' as const }]) {
      const { container, unmount } = render(<OrderCard order={order} />);
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<OrderCard order={row0148} />);
    const first = container.innerHTML;

    rerender(<OrderCard order={row0148} />);
    expect(container.innerHTML).toBe(first);

    rerender(<OrderCard order={row0151} />);
    expect(screen.getByText('Fully Paid')).toBeTruthy();
  });

  it('re-renders between a walk-in order and a team order, switching the customer line (D-40)', () => {
    const { container, rerender } = render(<OrderCard order={row0153} />);
    const first = container.innerHTML;
    const line = (): string | null | undefined =>
      screen.getByRole('heading', { level: 3 }).nextElementSibling?.textContent;

    rerender(<OrderCard order={row0153} />);
    expect(container.innerHTML).toBe(first);
    expect(line()).toBe('Walk-in customer');

    rerender(<OrderCard order={row0151} />);
    expect(line()).toBe(row0151.customerName);
    expect(screen.queryByText('Walk-in customer')).toBeNull();

    rerender(<OrderCard order={row0153} />);
    expect(line()).toBe('Walk-in customer');
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

describe('data scenarios (the data group, OrderCard and DataTable)', () => {
  it('declares OrderCard on the spec seed orders: ORD-2026-0148, ORD-2026-0151 and the no-team ORD-2026-0153', () => {
    const cards = dataScenarios.filter(
      (scenario) => scenario.node.component === 'OrderCard' || scenario.node.component === 'WalkInOrderCard',
    );

    expect(cards.map((scenario) => scenario.id)).toEqual(['order-card-0148', 'order-card-0151', 'order-card-walk-in']);
    for (const card of cards) {
      expect(card.handlers, card.id).toEqual(['onView', 'onEdit']);
    }
    expect(byId.get('order-card-0148')?.states).toEqual(['rest', 'hover']);
    expect(CARD_0153.teamName).toBeNull();
  });

  // The card rows are plain data (the scenario list cannot import the app), so their figures are checked here against
  // the order math for the same seed orders.
  it('gives the seed cards the figures and piece counts that orderTotals gives for the seed orders', () => {
    const seeds: [ScenarioProps, ScenarioProps][] = [
      [CARD_0148, ORDER_0148],
      [CARD_0151, ORDER_0151],
      [CARD_0153, ORDER_0153],
    ];
    for (const [card, seed] of seeds) {
      const totals = orderTotals(seed as unknown as Order);
      const pieces = (seed.items as { quantity: number }[]).reduce((sum, item) => sum + item.quantity, 0);
      const id = card.number as string;
      expect(formatPeso(card.subtotal as string), id).toBe(formatPeso(totals.subtotal));
      expect(formatPeso(card.discount as string), id).toBe(formatPeso(totals.discount));
      expect(formatPeso(card.total as string), id).toBe(formatPeso(totals.total));
      expect(formatPeso(card.paid as string), id).toBe(formatPeso(totals.paid));
      expect(formatPeso(card.balance as string), id).toBe(formatPeso(totals.balance));
      expect(card.fullyPaid, id).toBe(totals.fullyPaid);
      expect(card.pieces, id).toBe(pieces);
      expect(card.customerName, id).toBe(seed.customer);
      expect(card.status, id).toBe(seed.status);
    }
  });

  it('wraps the no-team card, and only it, in the WalkInOrderCard pair: one plain block, "Walk-in customer" shown (D-40)', () => {
    const wrapped = dataScenarios.filter((scenario) => scenario.node.component === 'WalkInOrderCard');

    expect(wrapped.map((scenario) => scenario.id)).toEqual(['order-card-walk-in']);
    const inner = wrapped[0]?.node.props?.children as ScenarioNode | undefined;
    expect(inner?.component).toBe('OrderCard');
    expect(inner?.props?.order).toBe(CARD_0153);

    const { container } = renderCase('order-card-walk-in');
    const block = container.firstElementChild;
    expect(block?.localName).toBe('div');
    expect(block?.attributes).toHaveLength(0);
    expect(block?.children).toHaveLength(1);
    expect(block?.firstElementChild?.localName).toBe('article');
    expect(within(container).getByRole('heading', { level: 3 }).nextElementSibling?.textContent).toBe(
      'Walk-in customer',
    );
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

  // D-41 R2-06 (owner, 2026-10-13): the table's "Total" column is the PRD Total, the amount after discount.
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
    expect(TABLE_ROWS.slice(0, 2).map((row) => [row.number, row.total])).toEqual([
      ['ORD-2026-0148', 21327.5],
      ['ORD-2026-0151', 22500],
    ]);
  });

  // The OrderCard cases changed by owner rulings (D-04, D-22, D-27, D-40), so the frozen design has no card to compare
  // with: they run in the implementation only. The DataTable cases keep the parity comparison.
  it('compares every case in both themes at 390 and 1440, the DataTable and chart cases against the reference', () => {
    for (const scenario of dataScenarios) {
      const card = scenario.node.component === 'OrderCard' || scenario.node.component === 'WalkInOrderCard';
      expect(scenario.group, scenario.id).toBe('data');
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.responsive, scenario.id).toBe(false);
      expect(scenario.parity, scenario.id).toBe(!card);
    }
  });
});
