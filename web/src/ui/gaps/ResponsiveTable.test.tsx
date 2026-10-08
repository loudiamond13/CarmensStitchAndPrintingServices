// WEB-06, WEB-08, A11Y-01, PERF-03 (02-UI-SPEC SPEC-GAP "ResponsiveTable"; UI Considerations empty, loading,
// refetching, error, populated and partial rows): one list table with every state, in the App. E.7/E.12 markup.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/lib/api';
import { expectNoAxeViolations } from '@/test/axe';
import { Badge, Button, formatDate, formatPeso, Icon } from '@/ui';
import { CustomerCell, ResponsiveTable, type ResponsiveColumn, type ResponsiveTableProps } from './ResponsiveTable';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'Manager' | 'Admin';
  active: boolean;
  created: string;
  note: string | null;
}

/** Spec section 12 / App. E.12 seed: Carmen Reyes (Manager) and Jomar Santos (inactive). */
const USERS: User[] = [
  {
    id: 1,
    name: 'Carmen Reyes',
    email: 'carmen.reyes.csp@gmail.com',
    role: 'Manager',
    active: true,
    created: '2026-01-12',
    note: 'Owner',
  },
  {
    id: 5,
    name: 'Jomar Santos',
    email: 'jomar.santos@yahoo.com',
    role: 'Admin',
    active: false,
    created: '2026-04-02',
    note: null,
  },
];

const USER_COLUMNS: ResponsiveColumn<User>[] = [
  {
    key: 'user',
    header: 'User',
    lead: true,
    render: (u) => (
      <span className="csp-cell-user">
        <span>
          <strong>{u.name}</strong>
          <span>{u.role}</span>
        </span>
      </span>
    ),
  },
  { key: 'email', header: 'Email', render: (u) => u.email },
  {
    key: 'role',
    header: 'Role',
    render: (u) => <Badge tone={u.role === 'Manager' ? 'accent' : 'neutral'}>{u.role}</Badge>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (u) => (
      <Badge tone={u.active ? 'success' : 'neutral'} dot>
        {u.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  { key: 'note', header: 'Note', render: (u) => u.note },
  { key: 'created', header: 'Created', className: 's-muted', render: (u) => formatDate(u.created) },
  {
    key: 'actions',
    header: 'Actions',
    actions: true,
    render: (u) => (
      <span className="s-acts">
        <button type="button" className="s-iconbtn" aria-label={`Edit ${u.name}`}>
          <Icon name="pencil" size={18} />
        </button>
      </span>
    ),
  },
];

function usersTable(props: Partial<ResponsiveTableProps<User>> = {}) {
  return (
    <ResponsiveTable<User>
      caption="Users"
      columns={USER_COLUMNS}
      rows={USERS}
      getRowKey={(u) => String(u.id)}
      isRowInactive={(u) => !u.active}
      status="ready"
      things="users"
      onRetry={vi.fn()}
      {...props}
    />
  );
}

interface OrderRow {
  number: string;
  team: string;
  customer: string;
  total: number;
  discount: number;
}

const ORDER_COLUMNS: ResponsiveColumn<OrderRow>[] = [
  { key: 'number', header: 'Order', lead: true, render: (o) => o.number },
  {
    key: 'customer',
    header: 'Customer / team',
    label: 'Customer',
    render: (o) => <CustomerCell team={o.team} customer={o.customer} />,
  },
  { key: 'total', header: 'Total', money: true, render: (o) => formatPeso(o.total) },
  {
    key: 'discount',
    header: 'Discount',
    money: true,
    className: 's-muted',
    render: (o) => (o.discount ? formatPeso(-o.discount) : null),
  },
];

const ORDERS: OrderRow[] = [
  {
    number: 'ORD-2026-0148',
    team: 'Brgy. San Roque Ballers',
    customer: 'Juan Dela Cruz',
    total: 21850,
    discount: 1093,
  },
  { number: 'ORD-2026-0153', team: '', customer: 'Angelica Santos', total: 9360, discount: 0 },
];

function ordersTable(footer?: ResponsiveTableProps<OrderRow>['footer']) {
  return (
    <ResponsiveTable<OrderRow>
      caption="Orders"
      columns={ORDER_COLUMNS}
      rows={ORDERS}
      getRowKey={(o) => o.number}
      status="ready"
      things="orders"
      footer={footer}
    />
  );
}

function traceError(traceId: string): HttpError {
  return new HttpError({
    kind: 'http',
    status: 500,
    problem: {
      type: undefined,
      title: 'Internal Server Error',
      status: 500,
      detail: undefined,
      instance: undefined,
      traceId,
      errors: {},
    },
  });
}

describe('ResponsiveTable: populated (App. E.7 / E.12 markup)', () => {
  it('renders .s-rt-wrap > table.s-rt with a visually hidden caption naming the list', async () => {
    const { container } = render(usersTable());
    const wrap = container.querySelector('.s-rt-wrap');
    expect(wrap?.firstElementChild?.tagName).toBe('TABLE');
    expect(wrap?.firstElementChild).toHaveClass('s-rt');
    const caption = container.querySelector('table.s-rt > caption');
    expect(caption).toHaveClass('csp-sr');
    expect(caption?.textContent).toBe('Users');
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('puts data-label on every td, the column header by default', () => {
    const { container } = render(usersTable());
    expect(container.querySelectorAll('td').length).toBe(USERS.length * USER_COLUMNS.length);
    expect(container.querySelectorAll('td:not([data-label])').length).toBe(0);
    const first = container.querySelectorAll('tbody tr')[0];
    expect([...(first?.querySelectorAll('td') ?? [])].map((td) => td.dataset.label)).toEqual([
      'User',
      'Email',
      'Role',
      'Status',
      'Note',
      'Created',
      'Actions',
    ]);
  });

  it('gives the lead cell .is-lead and the actions cell .r.is-acts under a .csp-sr "Actions" header', () => {
    const { container } = render(usersTable());
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells[0]).toHaveClass('is-lead');
    expect(cells[6]).toHaveClass('r', 'is-acts');
    const headers = container.querySelectorAll('thead th');
    expect(headers[0]?.textContent).toBe('User');
    expect(headers[6]).toHaveClass('r');
    expect(headers[6]?.innerHTML).toBe('<span class="csp-sr">Actions</span>');
    for (const th of headers) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  it("marks Jomar's inactive row is-inactive and leaves Carmen's row plain (D-02)", () => {
    render(usersTable());
    expect(screen.getByText('Jomar Santos').closest('tr')).toHaveClass('is-inactive');
    expect(screen.getByText('Carmen Reyes').closest('tr')).not.toHaveClass('is-inactive');
  });

  it('renders "—" for a missing value (spec section 9.4)', () => {
    const { container } = render(usersTable());
    const jomarNote = [...container.querySelectorAll('tbody tr')][1]?.querySelectorAll('td')[4];
    expect(jomarNote?.textContent).toBe('—');
  });

  it('right-aligns money cells with .r.m and keeps a caller cell class, using the column label for data-label', async () => {
    const { container } = render(ordersTable());
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells[1]).toHaveAttribute('data-label', 'Customer');
    expect(cells[2]).toHaveClass('r', 'm');
    expect(cells[2]?.textContent).toBe('₱21,850.00');
    expect(cells[3]).toHaveClass('r', 'm', 's-muted');
    const headers = container.querySelectorAll('thead th');
    expect(headers[1]?.textContent).toBe('Customer / team');
    expect(headers[2]).toHaveClass('r');
    await expectNoAxeViolations(container);
  });

  it('shows "Walk-in customer" under a missing team and "—" for no discount (UI consideration: partial)', () => {
    const { container } = render(ordersTable());
    const walkIn = [...container.querySelectorAll('tbody tr')][1];
    const who = walkIn?.querySelector('td[data-label="Customer"] .s-who');
    expect(who?.querySelector('strong')?.textContent).toBe('Angelica Santos');
    expect(who?.querySelector('span')?.textContent).toBe('Walk-in customer');
    expect(walkIn?.querySelector('td[data-label="Discount"]')?.textContent).toBe('—');
    const team = [...container.querySelectorAll('tbody tr')][0]?.querySelector('.s-who');
    expect(team?.querySelector('strong')?.textContent).toBe('Brgy. San Roque Ballers');
    expect(team?.querySelector('span')?.textContent).toBe('Juan Dela Cruz');
  });

  it('renders an optional tfoot', () => {
    const { container } = render(
      ordersTable(
        <tr>
          <td data-label="Total">Total</td>
        </tr>,
      ),
    );
    expect(container.querySelector('table.s-rt > tfoot td')?.textContent).toBe('Total');
    expect(render(ordersTable()).container.querySelector('tfoot')).toBeNull();
  });

  it('makes the caption a focus target when captionId is given (Pagination moves focus to it)', () => {
    const { container } = render(usersTable({ captionId: 'users-caption' }));
    const caption = container.querySelector('caption');
    expect(caption).toHaveAttribute('id', 'users-caption');
    expect(caption).toHaveAttribute('tabindex', '-1');
    expect(render(usersTable()).container.querySelector('caption')).not.toHaveAttribute('tabindex');
  });
});

describe('ResponsiveTable: first load (UI consideration: loading)', () => {
  it('shows SkeletonTable with 4 rows inside an aria-busy LoadingRegion announcing "Loading users…"', async () => {
    const { container } = render(usersTable({ status: 'loading', rows: [] }));
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    const skeleton = busy?.querySelector('.s-rt-wrap');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton?.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(skeleton?.querySelectorAll('.csp-skel').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveClass('csp-sr');
    await expectNoAxeViolations(container);
  });

  it('announces "Users loaded." in the same status node once the rows arrive, and drops aria-busy', () => {
    const { container, rerender } = render(usersTable({ status: 'loading', rows: [] }));
    const status = screen.getByRole('status');
    rerender(usersTable());
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Users loaded.');
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
  });
});

describe('ResponsiveTable: empty (UI consideration: empty)', () => {
  it('shows "No users yet" with one primary action when no filter is active', async () => {
    const { container } = render(
      usersTable({
        status: 'empty',
        rows: [],
        emptyAction: (
          <Button variant="primary" icon="plus">
            Add User
          </Button>
        ),
      }),
    );
    expect(container.querySelector('.csp-empty .csp-empty-title')?.textContent).toBe('No users yet');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add User' })).toHaveClass('csp-btn-primary');
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('treats a ready list with no rows as empty', () => {
    const { container } = render(usersTable({ rows: [] }));
    expect(container.querySelector('.csp-empty-title')?.textContent).toBe('No users yet');
  });

  it('shows "No matches", the search text and a secondary "Clear Filters" when filters are active', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const { container } = render(
      usersTable({
        status: 'empty',
        rows: [],
        hasActiveFilters: true,
        searchText: 'Jomar',
        filterSummary: 'role Manager',
        onClearFilters,
        emptyAction: <Button variant="primary">Add User</Button>,
      }),
    );
    expect(container.querySelector('.csp-empty-title')?.textContent).toBe('No matches');
    expect(container.querySelector('.csp-empty-msg')?.textContent).toBe(
      'No users match “Jomar” with role Manager. Try another search or clear the filters.',
    );
    expect(container.querySelector('.csp-empty-icon svg')).toHaveClass('lucide-search');
    const clear = screen.getByRole('button', { name: 'Clear Filters' });
    expect(clear).toHaveClass('csp-btn-secondary');
    expect(screen.queryByRole('button', { name: 'Add User' })).toBeNull();
    await user.click(clear);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  it('treats search text alone as an active filter', () => {
    const { container } = render(usersTable({ status: 'empty', rows: [], searchText: 'Jomar' }));
    expect(container.querySelector('.csp-empty-msg')?.textContent).toBe(
      'No users match “Jomar”. Try another search or clear the filters.',
    );
  });
});

describe('ResponsiveTable: error (UI consideration: error, list load)', () => {
  it('shows the ErrorState banner with the traceId reference and a Try Again that calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { container } = render(usersTable({ status: 'error', rows: [], error: traceError('abc123'), onRetry }));
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('s-banner', 'is-danger');
    expect(banner.querySelector('strong')?.textContent).toBe("Couldn't load users.");
    expect(banner.querySelector('span')?.textContent).toBe(
      'Check your internet connection. Your data is safe — nothing was changed. Reference: abc123',
    );
    expect(banner.querySelector('svg')).toHaveClass('lucide-triangle-alert');
    expect(screen.queryByRole('table')).toBeNull();
    const retry = screen.getByRole('button', { name: 'Try Again' });
    expect(retry).toHaveClass('csp-btn-secondary', 'csp-btn-sm');
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  it('keeps the rows it already has below the banner', () => {
    render(usersTable({ status: 'error', error: traceError('abc123') }));
    const alert = screen.getByRole('alert');
    const table = screen.getByRole('table', { name: 'Users' });
    expect(alert.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ResponsiveTable: refetching keeps the old rows (UI consideration: loading on change; WEB-08)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('does not mark a 150 ms refetch', async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(usersTable());
    rerender(usersTable({ isPlaceholderData: true }));
    await advance(150);
    expect(container.querySelector('.s-rt-wrap')).not.toHaveClass('is-refetching');
    rerender(usersTable({ isPlaceholderData: false }));
    await advance(200);
    expect(container.querySelector('.s-rt-wrap')).not.toHaveClass('is-refetching');
  });

  it('marks .is-refetching after 200 ms, keeps the rows focusable, then swaps them in place', async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(usersTable());
    const table = screen.getByRole('table', { name: 'Users' });
    rerender(usersTable({ isPlaceholderData: true }));
    await advance(250);
    const wrap = container.querySelector('.s-rt-wrap');
    expect(wrap).toHaveClass('is-refetching');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
    expect(container.querySelector('.csp-skel')).toBeNull();
    const edit = screen.getByRole('button', { name: 'Edit Jomar Santos' });
    edit.focus();
    expect(edit).toHaveFocus();
    expect(wrap?.closest('[aria-hidden="true"], [inert]')).toBeNull();
    // axe schedules its own timers, so it runs on real ones.
    vi.useRealTimers();
    await expectNoAxeViolations(container);

    rerender(usersTable({ rows: USERS.slice(0, 1), isPlaceholderData: false }));
    expect(container.querySelector('.s-rt-wrap')).not.toHaveClass('is-refetching');
    expect(screen.getByRole('table', { name: 'Users' })).toBe(table);
    expect(screen.queryByText('Jomar Santos')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Users loaded.');
  });
});

describe('CustomerCell (App. E.7 .s-who)', () => {
  it('shows the team over the customer, or the customer over "Walk-in customer"', () => {
    const { container, rerender } = render(<CustomerCell team="Tondo Riders MC" customer="Mark Villanueva" />);
    expect(container.innerHTML).toBe(
      '<div class="s-who"><strong>Tondo Riders MC</strong><span>Mark Villanueva</span></div>',
    );
    rerender(<CustomerCell team={null} customer="Angelica Santos" />);
    expect(container.innerHTML).toBe(
      '<div class="s-who"><strong>Angelica Santos</strong><span>Walk-in customer</span></div>',
    );
  });
});
