import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as listsParity } from '@/dev/scenarios/groups/lists';
import { scenarios as listsStates } from '@/dev/scenarios/groups/lists-states';
import { expectNoAxeViolations } from '@/test/axe';
import { STATES_COPY } from '@/components/states';
import { WALK_IN_CUSTOMER } from '@/components/data';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  CustomerCell,
  LISTS_COPY,
  ResponsiveTable,
  RowAction,
  RowActions,
  SkeletonTable,
  UserCell,
  type ResponsiveTableColumn,
  type ResponsiveTableProps,
} from '@/components/lists';

// ResponsiveTable (SPEC-GAP, plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → ResponsiveTable, spec §8.4, App. E.7/E.12
// list-table markup; WEB-06, WEB-08, A11Y-01, D-02, D-38). The WEB-06 list table: a real table that the pg-phone
// utilities turn into stacked cards, with every list state (first load, refetch, error, first use, no matches). The
// look is proven against App. E.12 by the parity suite (`npm --prefix web run parity -- --grep @lists`); these tests
// pin the structure, the states, the class hooks of the cascade results and axe. axe on real timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created: string | null;
}

/** Spec §12.1: Carmen Reyes (Manager, the signed-in user) and Jomar Santos (Admin, inactive). */
const USERS: readonly User[] = [
  {
    id: 'u1',
    name: 'Carmen Reyes',
    email: 'carmen.reyes.csp@gmail.com',
    role: 'Manager',
    active: true,
    created: 'Jan 12, 2026',
  },
  { id: 'u5', name: 'Jomar Santos', email: 'jomar.santos@yahoo.com', role: 'Admin', active: false, created: null },
];

const COLUMNS: readonly ResponsiveTableColumn<User>[] = [
  { key: 'user', header: 'User', lead: true, cell: (user) => <UserCell name={user.name} sub={user.role} /> },
  { key: 'email', header: 'Email', cell: (user) => user.email },
  { key: 'status', header: 'Status', cell: (user) => (user.active ? 'Active' : 'Inactive') },
  { key: 'created', header: 'Created', muted: true, cell: (user) => user.created },
  { key: 'paid', header: 'Paid', label: 'Paid so far', money: true, cell: () => '₱1,000.00' },
  {
    key: 'actions',
    header: LISTS_COPY.actions,
    actions: true,
    cell: (user) => (
      <RowActions>
        <RowAction icon="pencil" label={`Edit ${user.name}`} onClick={() => undefined} />
        <RowAction icon="trash-2" label={`Delete ${user.name}`} danger onClick={() => undefined} />
      </RowActions>
    ),
  },
];

type Props = ResponsiveTableProps<User>;

function table(overrides: Partial<Props> = {}): ReactNode {
  return (
    <ResponsiveTable<User>
      caption="Users"
      columns={COLUMNS}
      rows={USERS}
      rowKey={(user) => user.id}
      isInactive={(user) => !user.active}
      things="users"
      {...overrides}
    />
  );
}

function bodyRows(): HTMLElement[] {
  const [, ...rows] = screen.getAllByRole('row');
  return rows;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ResponsiveTable tracer (WEB-06, spec §8.4, App. E.12)', () => {
  it('renders the Users list as a real table: a hidden caption, a hidden Actions header and data-label on every cell', () => {
    render(table());

    const region = screen.getByRole('region', { name: 'Users' });
    expect(region).toHaveAttribute('tabindex', '0');
    const grid = within(region).getByRole('table', { name: 'Users' });
    const caption = grid.querySelector('caption');
    expect(caption).toHaveTextContent('Users');
    expect(tokens(caption?.className)).toEqual(tokens(srOnlyClasses));

    const headers = within(grid).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'User',
      'Email',
      'Status',
      'Created',
      'Paid',
      'Actions',
    ]);
    const actionsLabel = headers[5]?.querySelector('span');
    expect(actionsLabel).toHaveTextContent('Actions');
    expect(tokens(actionsLabel?.className)).toEqual(tokens(srOnlyClasses));

    const cells = grid.querySelectorAll('td');
    expect(cells).toHaveLength(USERS.length * COLUMNS.length);
    for (const cell of cells) {
      expect(cell).toHaveAttribute('data-label');
    }
    expect([...(bodyRows()[0]?.querySelectorAll('td') ?? [])].map((cell) => cell.dataset.label)).toEqual([
      'User',
      'Email',
      'Status',
      'Created',
      'Paid so far',
      'Actions',
    ]);
    expect(within(grid).getByRole('button', { name: 'Edit Carmen Reyes' })).toBeInTheDocument();
  });

  it('turns rows into phone cards that print each data-label, with the last card title unruled (D-38)', () => {
    render(table());
    const [first, second] = bodyRows();
    const lead = first?.querySelector('td');
    const plain = first?.querySelectorAll('td')[1];

    expect(tokens(first?.className)).toEqual(
      expect.arrayContaining(['group/row', 'pg-phone:block', 'pg-phone:rounded-md']),
    );
    expect(tokens(plain?.className)).toEqual(
      expect.arrayContaining(['pg-phone:before:content-[attr(data-label)]', 'pg-phone:flex', 'pg-phone:border-b-0']),
    );
    expect(tokens(lead?.className)).toEqual(
      expect.arrayContaining([
        'border-b',
        'group-last/row:border-b-0',
        'pg-phone:before:hidden',
        'pg-phone:pr-22',
        'pg-phone:text-left',
      ]),
    );
    expect(tokens(lead?.className)).not.toContain('pg-phone:border-b-0');
    expect(tokens(second?.querySelectorAll('td')[5]?.className)).toEqual(
      expect.arrayContaining(['pg-phone:absolute', 'pg-phone:top-1.5', 'pg-phone:right-1.5', 'text-right']),
    );
  });

  it('right-aligns money cells in the tabular 600 look and mutes the muted column', () => {
    render(table());
    const cells = bodyRows()[0]?.querySelectorAll('td');
    expect(tokens(cells?.[4]?.className)).toEqual(
      expect.arrayContaining(['text-right', 'tabular-nums', 'font-semibold', 'whitespace-nowrap']),
    );
    expect(tokens(cells?.[3]?.className)).toContain('text-ink-muted');
    const headers = screen.getAllByRole('columnheader');
    expect(tokens(headers[4]?.className)).toContain('text-right');
    expect(tokens(headers[0]?.className)).toContain('text-left');
  });

  it('puts an inactive row (Jomar Santos) on --surface-2, cell and phone card, by colour only (D-02)', () => {
    const { container } = render(table());
    const [active, inactive] = bodyRows();
    expect(within(screen.getByRole('row', { name: /Jomar Santos/ })).getByText('Inactive')).toBeInTheDocument();
    for (const cell of inactive?.querySelectorAll('td') ?? []) {
      expect(tokens(cell.className)).toContain('bg-surface-2');
      expect(tokens(cell.className)).not.toContain('group-hover/row:bg-surface-2');
    }
    expect(tokens(inactive?.className)).toContain('pg-phone:bg-surface-2');
    expect(tokens(active?.className)).toContain('pg-phone:bg-surface');
    for (const cell of active?.querySelectorAll('td') ?? []) {
      expect(tokens(cell.className)).toContain('group-hover/row:bg-surface-2');
    }
    expect(container.innerHTML).not.toMatch(/opacity/);
  });

  it('shows the empty-value icon for a missing value (spec §9.4, OR-4)', () => {
    render(table());
    const cell = bodyRows()[1]?.querySelectorAll('td')[3];
    expect(cell?.textContent).toBe(STATES_COPY.emptyValue);
    expect(cell?.querySelector('svg.lucide-minus[aria-hidden="true"]')).not.toBeNull();
  });

  it('leaves an empty actions cell empty', () => {
    const columns = COLUMNS.map((column) =>
      column.actions === true ? { ...column, cell: (user: User) => (user.active ? 'Edit' : null) } : column,
    );
    render(table({ columns }));
    const cell = bodyRows()[1]?.querySelectorAll('td')[5];
    expect(cell?.textContent).toBe('');
    expect(cell?.querySelector('svg')).toBeNull();
  });

  it('renders the optional tfoot as one labelled totals row', () => {
    render(table({ footer: { user: 'Total', paid: '₱2,000.00' } }));
    const grid = screen.getByRole('table', { name: 'Users' });
    const foot = grid.querySelector('tfoot');
    const cells = [...(foot?.querySelectorAll('td') ?? [])];
    expect(cells.map((cell) => cell.textContent)).toEqual(['Total', '', '', '', '₱2,000.00', '']);
    expect(cells.map((cell) => cell.dataset.label)).toEqual([
      'User',
      'Email',
      'Status',
      'Created',
      'Paid so far',
      'Actions',
    ]);
    expect(tokens(cells[4]?.className)).toEqual(expect.arrayContaining(['font-bold', 'border-t-2', 'text-right']));
  });

  it('makes the caption a focus target when it has an id (Pagination moves focus there)', () => {
    render(table({ captionId: 'users-caption' }));
    const caption = document.getElementById('users-caption');
    expect(caption).toHaveAttribute('tabindex', '-1');
    caption?.focus();
    expect(caption).toHaveFocus();
  });
});

describe('ResponsiveTable list states (UI considerations empty, loading, error, refetch)', () => {
  it('shows SkeletonTable (4 rows inside the wrapper look) in a busy LoadingRegion on the first load', () => {
    const { container } = render(table({ rows: undefined, pending: true }));
    expect(screen.queryByRole('table')).toBeNull();
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    const skeleton = busy?.querySelector('[aria-hidden="true"]');
    expect(skeleton?.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
  });

  it('announces "Users loaded." once the first load ends', () => {
    const { rerender } = render(table({ rows: undefined, pending: true }));
    rerender(table());
    expect(screen.getByRole('status')).toHaveTextContent('Users loaded.');
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
  });

  it('shows ErrorState above the table when a load fails, and Try Again calls onRetry', () => {
    const onRetry = vi.fn();
    render(table({ failed: true, onRetry }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load users.");
    expect(alert.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows only the ErrorState (no empty state) when the first load fails', () => {
    render(table({ rows: undefined, failed: true }));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load users.");
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('shows the first-use EmptyState "No users yet" with its one primary action when nothing is filtered', () => {
    render(
      table({
        rows: [],
        emptyIcon: 'users',
        emptyMessage: 'Add your first user to let staff sign in.',
        emptyAction: <button type="button">Add User</button>,
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'No users yet' })).toBeInTheDocument();
    expect(screen.getByText('Add your first user to let staff sign in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows "No matches" with Clear Filters when filters or a search are active', () => {
    const onClearFilters = vi.fn();
    render(
      table({
        rows: [],
        filtered: true,
        search: 'Ballers',
        filterSummary: 'status Ready',
        onClearFilters,
        emptyLevel: 3,
      }),
    );
    expect(screen.getByRole('heading', { level: 3, name: 'No matches' })).toBeInTheDocument();
    expect(
      screen.getByText('No users match “Ballers” with status Ready. Try another search or clear the filters.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('treats a search on its own as a filter', () => {
    render(table({ rows: [], search: '  jersey ' }));
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(screen.getByText('No users match “jersey”. Try another search or clear the filters.')).toBeInTheDocument();
  });

  it('words the no-match body for filters without a search, and with nothing to name', () => {
    expect(LISTS_COPY.noMatchesBody('orders', null, 'status Ready')).toBe(
      'No orders with status Ready. Try another search or clear the filters.',
    );
    expect(LISTS_COPY.noMatchesBody('orders')).toBe(
      'No orders match the filters. Try another search or clear the filters.',
    );
    expect(LISTS_COPY.emptyTitle('orders')).toBe('No orders yet');
  });

  it('keeps the previous rows while refetching and marks them only after 200 ms (colour-only dim, aria-busy)', () => {
    vi.useFakeTimers();
    const { container } = render(table({ refetching: true }));
    const region = screen.getByRole('region', { name: 'Users' });
    expect(region).not.toHaveAttribute('data-refetching');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(region).not.toHaveAttribute('data-refetching');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region).toHaveAttribute('data-refetching', 'true');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
    expect(screen.getAllByRole('row')).toHaveLength(USERS.length + 1);
    for (const cell of bodyRows()[0]?.querySelectorAll('td') ?? []) {
      expect(tokens(cell.className)).toContain('in-data-[refetching=true]:bg-surface-2');
    }
    expect(tokens(bodyRows()[0]?.className)).toContain('pg-phone:in-data-[refetching=true]:bg-surface-2');
  });

  it('drops the mark as soon as the refetch ends', () => {
    vi.useFakeTimers();
    const { rerender } = render(table({ refetching: true }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    rerender(table({ refetching: false }));
    expect(screen.getByRole('region', { name: 'Users' })).not.toHaveAttribute('data-refetching');
    expect(screen.getByRole('status')).toHaveTextContent('Users loaded.');
  });
});

describe('list cells (App. E.7/E.12)', () => {
  it('UserCell: the avatar, the name and the sub line in the App. E.12 cell', () => {
    const { container } = render(<UserCell name="Carmen Reyes" sub="You" />);
    expect(screen.getByRole('img', { name: 'Carmen Reyes' })).toHaveTextContent('CR');
    expect(container.querySelector('strong')).toHaveTextContent('Carmen Reyes');
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('CustomerCell: the team over the customer, or the customer over the shared "Walk-in customer" (D-40)', () => {
    const { rerender, container } = render(<CustomerCell team="Tondo Riders MC" customer="Mark Villanueva" />);
    expect(container.querySelector('strong')).toHaveTextContent('Tondo Riders MC');
    expect(screen.getByText('Mark Villanueva')).toBeInTheDocument();

    rerender(<CustomerCell team={null} customer="Angelica Santos" />);
    expect(container.querySelector('strong')).toHaveTextContent('Angelica Santos');
    expect(screen.getByText(WALK_IN_CUSTOMER)).toBeInTheDocument();
  });

  it('RowAction: a named 36px icon button; the danger one hovers in the danger look', () => {
    const onClick = vi.fn();
    render(
      <RowActions>
        <RowAction icon="lock" label="Deactivate Paolo" title="Deactivate Paolo" onClick={onClick} />
        <RowAction icon="trash-2" label="Delete Paolo Garcia" danger onClick={onClick} />
      </RowActions>,
    );
    const lock = screen.getByRole('button', { name: 'Deactivate Paolo' });
    expect(lock).toHaveAttribute('title', 'Deactivate Paolo');
    expect(tokens(lock.className)).toEqual(expect.arrayContaining(['size-9', 'hover:bg-surface-2']));
    const remove = screen.getByRole('button', { name: 'Delete Paolo Garcia' });
    expect(tokens(remove.className)).toEqual(expect.arrayContaining(['hover:bg-danger-soft', 'hover:text-danger']));
    fireEvent.click(remove);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('RowAction with `to`: a router link in the same icon-button look, named for its row, with no button', () => {
    render(
      <MemoryRouter>
        <RowActions>
          <RowAction to="/admin/profile" icon="pencil" label="Edit your details in My Profile" />
          <RowAction icon="trash-2" label="Delete Paolo Garcia" danger onClick={() => undefined} />
        </RowActions>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Edit your details in My Profile' });
    expect(link).toHaveAttribute('href', '/admin/profile');
    expect(tokens(link.className)).toEqual(expect.arrayContaining(['size-9', 'hover:bg-surface-2', 'hover:text-ink']));
    expect(link.querySelector('svg')).not.toBeNull();
    // The button form is unchanged beside it.
    const remove = screen.getByRole('button', { name: 'Delete Paolo Garcia' });
    expect(tokens(remove.className)).toEqual(expect.arrayContaining(['hover:bg-danger-soft', 'hover:text-danger']));
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('RowAction with `to`: carries the title and hands its anchor to a ref', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <MemoryRouter>
        <RowActions>
          <RowAction to="/admin/profile" icon="pencil" label="Edit mine" title="Edit mine" ref={ref} />
        </RowActions>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Edit mine' });
    expect(link).toHaveAttribute('title', 'Edit mine');
    expect(ref.current).toBe(link);
  });

  it('RowAction: hands its button element to a ref, so a screen can move focus to it', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <RowActions>
        <RowAction icon="log-out" label="Sign out Phone" ref={ref} />
      </RowActions>,
    );
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Sign out Phone' }));
  });
});

describe('list cells and SkeletonTable re-render', () => {
  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onClick = vi.fn();
    const cells = (name: string) => (
      <>
        <UserCell name={name} sub="Admin" />
        <CustomerCell team="Tondo Riders MC" customer={name} />
        <RowActions>
          <RowAction icon="pencil" label={`Edit ${name}`} onClick={onClick} />
        </RowActions>
      </>
    );
    const { rerender } = render(cells('Paolo Garcia'));
    rerender(cells('Paolo Garcia'));
    expect(screen.getByRole('button', { name: 'Edit Paolo Garcia' })).toBeInTheDocument();
    rerender(cells('Liza Mercado'));
    expect(screen.getByRole('button', { name: 'Edit Liza Mercado' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Liza Mercado' })).toHaveTextContent('LM');

    const skeleton = render(<SkeletonTable columns={COLUMNS} />);
    skeleton.rerender(<SkeletonTable columns={COLUMNS} />);
    skeleton.rerender(<SkeletonTable columns={COLUMNS.slice(0, 2)} />);
    expect(skeleton.container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2);
  });
});

describe('SkeletonTable', () => {
  it('renders the column headers and 4 aria-hidden skeleton rows, every cell labelled', () => {
    const { container } = render(<SkeletonTable columns={COLUMNS} />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).not.toHaveAttribute('tabindex');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
    for (const cell of container.querySelectorAll('td')) {
      expect(cell).toHaveAttribute('data-label');
      expect(cell.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    }
    expect([...container.querySelectorAll('th')].map((header) => header.textContent)).toEqual([
      'User',
      'Email',
      'Status',
      'Created',
      'Paid',
      'Actions',
    ]);
  });
});

describe('ResponsiveTable accessibility and re-render', () => {
  it('has no axe violations with rows, on the first load, on error and empty', async () => {
    const populated = render(table({ footer: { user: 'Total' } }));
    await expectNoAxeViolations(populated.container);
    populated.unmount();

    const loading = render(table({ rows: undefined, pending: true }));
    await expectNoAxeViolations(loading.container);
    loading.unmount();

    const failed = render(table({ failed: true, onRetry: () => undefined }));
    await expectNoAxeViolations(failed.container);
    failed.unmount();

    const empty = render(table({ rows: [], filtered: true, onClearFilters: () => undefined }));
    await expectNoAxeViolations(empty.container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { rerender } = render(table());
    rerender(table());
    expect(bodyRows()).toHaveLength(2);
    rerender(table({ rows: USERS.slice(0, 1), caption: 'Staff' }));
    expect(screen.getByRole('table', { name: 'Staff' })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
  });
});

const listScenarios = [...listsParity, ...listsStates];

describe('lists scenarios (the ResponsiveTable cases)', () => {
  const ids = [
    'rt-users-populated',
    'rt-long-name',
    'rt-loading',
    'rt-error',
    'rt-empty',
    'rt-no-matches',
    'rt-refetching',
  ];

  it('declares the populated Users table and the long-name case for parity, the states implementation only', () => {
    const byId = new Map(listScenarios.map((scenario) => [scenario.id, scenario]));
    for (const id of ids) {
      expect(byId.get(id), id).toMatchObject({ themes: ['light', 'dark'], responsive: true });
    }
    expect(byId.get('rt-users-populated')).toMatchObject({ group: 'lists', parity: true });
    expect(byId.get('rt-long-name')).toMatchObject({ group: 'lists', parity: true });
    for (const id of ['rt-loading', 'rt-error', 'rt-empty', 'rt-no-matches', 'rt-refetching']) {
      expect(byId.get(id), id).toMatchObject({ group: 'lists-states', parity: false });
    }
  });

  it('seeds the populated case with the spec §12.1 users, Jomar Santos inactive, and a 40-character name', () => {
    const populated = listScenarios.find((scenario) => scenario.id === 'rt-users-populated');
    render(renderNode(kit, populated?.node ?? { kind: 'node', component: 'Missing' }, []));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    const jomar = screen.getByRole('row', { name: /Jomar Santos/ });
    expect(within(jomar).getByText('Inactive')).toBeInTheDocument();
    expect(within(jomar).getByRole('button', { name: 'Activate Jomar' })).toBeInTheDocument();
    const carmen = screen.getByRole('row', { name: /Carmen Reyes/ });
    expect(within(carmen).getByText('You')).toBeInTheDocument();
    expect(within(carmen).getAllByRole('button')).toHaveLength(1);
    expect(within(carmen).getByText('Jan 12, 2026')).toBeInTheDocument();

    const long = listScenarios.find((scenario) => scenario.id === 'rt-long-name');
    const props = long?.node.props as { users?: readonly { first: string; last: string }[] } | undefined;
    const longest = Math.max(...(props?.users ?? []).map((user) => `${user.first} ${user.last}`.length));
    expect(longest).toBe(40);
  });

  it('renders every ResponsiveTable scenario through the implementation kit with no axe violations', async () => {
    const cases = listScenarios.filter((scenario) => ids.includes(scenario.id));
    expect(cases).toHaveLength(ids.length);
    for (const scenario of cases) {
      const view = render(renderNode(kit, scenario.node, scenario.handlers ?? []));
      expect(view.container.querySelector('[role="alert"]')?.textContent ?? '', scenario.id).not.toMatch(
        /Missing component/,
      );
      await expectNoAxeViolations(view.container);
      view.unmount();
    }
  });
});
