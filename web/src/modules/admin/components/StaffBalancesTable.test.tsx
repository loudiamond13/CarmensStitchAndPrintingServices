import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { StaffBalancesTable } from '@/modules/admin/components/StaffBalancesTable';
import type { StaffBalancesTableQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import type { StaffBalance, StaffBalances } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import { ANA_ID, JOMAR_ID, LIZA_ID, MY_MONEY_USER_ID, PAOLO_ID } from '@/test/moneyFixtures';

// The All Staff table (D-42 to D-45, MONEY-03; plan 10-19): every person's money on hand with the total held by staff. It draws the
// server's figures as they come and works out nothing.

const CARMEN: StaffBalance = {
  userId: MY_MONEY_USER_ID,
  name: 'Carmen Reyes',
  role: 'Manager',
  status: 'active',
  balance: 8450,
  isYou: true,
};
const LIZA: StaffBalance = {
  userId: LIZA_ID,
  name: 'Liza Mercado',
  role: 'Admin',
  status: 'active',
  balance: -500,
  isYou: false,
};
const PAOLO: StaffBalance = {
  userId: PAOLO_ID,
  name: 'Paolo Garcia',
  role: 'Admin',
  status: 'active',
  balance: 0,
  isYou: false,
};
const ANA: StaffBalance = {
  userId: ANA_ID,
  name: 'Ana Villanueva',
  role: 'Admin',
  status: 'deleted',
  balance: -300,
  isYou: false,
};
const JOMAR: StaffBalance = {
  userId: JOMAR_ID,
  name: 'Jomar Santos',
  role: 'Admin',
  status: 'deactivated',
  balance: 2000,
  isYou: false,
};

function everyone(overrides: Partial<StaffBalances> = {}): StaffBalances {
  return { rows: [CARMEN, LIZA, PAOLO, ANA, JOMAR], total: 9650, ...overrides };
}

function loaded(data: StaffBalances = everyone()): StaffBalancesTableQuery {
  return { data, isError: false, isFetching: false, error: null, refetch: vi.fn() };
}

function renderTable(query: StaffBalancesTableQuery = loaded(), onHandOver = vi.fn()) {
  const view = render(
    <MemoryRouter>
      <StaffBalancesTable query={query} onHandOver={onHandOver} />
    </MemoryRouter>,
  );
  return { ...view, onHandOver };
}

const table = () => screen.getByRole('table', { name: 'Staff money on hand' });

/** The body rows, header and footer left out. */
function bodyRows(): HTMLElement[] {
  return within(table()).getAllByRole('row').slice(1, -1);
}

/** The total row at the foot of the table. */
function footerRow(): HTMLElement {
  const footer = within(table()).getAllByRole('row').at(-1);
  if (footer === undefined) throw new Error('The table has no total row.');
  return footer;
}

function rowOf(name: string): HTMLElement {
  const row = bodyRows().find((candidate) => within(candidate).queryByRole('link', { name }) !== null);
  if (row === undefined) throw new Error(`No row for ${name}.`);
  return row;
}

describe('the card and its rows (D-42, D-43)', () => {
  it('shows the "All staff" head and its line over a table captioned "Staff money on hand"', () => {
    renderTable();

    expect(screen.getByRole('heading', { level: 2, name: 'All staff' })).toBeVisible();
    expect(screen.getByText("Everyone's money on hand. Open a person to see their ledger.")).toBeVisible();
    expect(table()).toBeVisible();
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Person', 'Role', 'Status', 'Money on hand', 'Actions']);
  });

  it('lists the rows in the order the server sent: active people, then leavers', () => {
    renderTable();

    expect(bodyRows()).toHaveLength(5);
    const names = bodyRows().map((row) => within(row).getAllByRole('link')[0]?.textContent);
    expect(names).toEqual(['Carmen Reyes', 'Liza Mercado', 'Paolo Garcia', 'Ana Villanueva', 'Jomar Santos']);
  });

  it('links a person to their page, and the signed-in Manager own row to My Money with " (you)"', () => {
    renderTable();

    expect(within(rowOf('Liza Mercado')).getByRole('link', { name: 'Liza Mercado' })).toHaveAttribute(
      'href',
      `/admin/money/staff/${LIZA_ID}`,
    );
    const own = rowOf('Carmen Reyes');
    expect(within(own).getByRole('link', { name: 'Carmen Reyes' })).toHaveAttribute('href', '/admin/money');
    expect(own).toHaveTextContent('Carmen Reyes (you)');
    expect(within(rowOf('Liza Mercado')).queryByText('(you)')).toBeNull();
  });

  it('shows the role and the status words: Active, Deactivated, Deleted', () => {
    renderTable();

    expect(within(rowOf('Carmen Reyes')).getByText('Manager')).toBeVisible();
    expect(within(rowOf('Liza Mercado')).getByText('Admin')).toBeVisible();
    expect(within(rowOf('Liza Mercado')).getByText('Active')).toBeVisible();
    expect(within(rowOf('Jomar Santos')).getByText('Deactivated')).toBeVisible();
    expect(within(rowOf('Ana Villanueva')).getByText('Deleted')).toBeVisible();
  });

  it('shows each money on hand as the server sent it: below zero in danger with the true minus, zero dimmed', () => {
    renderTable();

    expect(within(rowOf('Carmen Reyes')).getByText('₱8,450.00')).toBeVisible();
    const owed = within(rowOf('Liza Mercado')).getByText('−₱500.00');
    expect(owed.className).toContain('text-danger');
    expect(within(rowOf('Ana Villanueva')).getByText('−₱300.00').className).toContain('text-danger');
    expect(within(rowOf('Paolo Garcia')).getByText('₱0.00').className).toContain('text-ink-subtle');
    expect(within(rowOf('Jomar Santos')).getByText('₱2,000.00').className).not.toContain('text-danger');
  });

  it('gives every row an eye link named "View ledger of {name}" to that person, the own row to My Money', () => {
    renderTable();

    for (const person of [LIZA, PAOLO, ANA, JOMAR]) {
      expect(screen.getByRole('link', { name: `View ledger of ${person.name}` })).toHaveAttribute(
        'href',
        `/admin/money/staff/${person.userId}`,
      );
    }
    expect(screen.getByRole('link', { name: 'View ledger of Carmen Reyes' })).toHaveAttribute('href', '/admin/money');
  });

  it('puts a data-label on every cell, so phones draw row cards', () => {
    renderTable();

    const labels = Array.from(rowOf('Jomar Santos').querySelectorAll('td'), (cell) => cell.getAttribute('data-label'));
    expect(labels).toEqual(['Person', 'Role', 'Status', 'Money on hand', 'Actions']);
  });

  it('wraps a very long name inside its cell', () => {
    const long = 'Maria Cristina Dela Cruz-Villanueva '.repeat(6).trim();
    renderTable(loaded(everyone({ rows: [{ ...LIZA, name: long }] })));

    expect(screen.getByRole('link', { name: long }).parentElement?.className).toContain('wrap-anywhere');
  });
});

describe('Hand Over (D-45)', () => {
  it('shows a secondary small "Hand Over" button named "Hand over money from {name}" on a leaver who holds money', () => {
    renderTable();

    const button = within(rowOf('Jomar Santos')).getByRole('button', { name: 'Hand over money from Jomar Santos' });
    expect(button).toHaveTextContent('Hand Over');
    expect(button.querySelector('svg.lucide-arrow-right')).not.toBeNull();
    expect(button.className).toContain('h-9');
  });

  it('shows it on no one else: not on an active person, not on a leaver who is owed money, not on a leaver at zero', () => {
    renderTable(loaded(everyone({ rows: [CARMEN, LIZA, PAOLO, ANA, { ...JOMAR, balance: 0 }] })));

    expect(screen.queryByRole('button', { name: /^Hand over money from/ })).toBeNull();
  });

  it('shows exactly one Hand Over for the standard rows', () => {
    renderTable();

    expect(screen.getAllByRole('button', { name: /^Hand over money from/ })).toHaveLength(1);
  });

  // Plan 10-21 sweep, 320 px: a phone card pins the eye link and Hand Over to its top right, and the title reserves room for two icon
  // buttons only. A short name beside the wider Hand Over button was partly covered (axe target-size), so a row with Hand Over reserves more.
  it('keeps the name of a row with Hand Over clear of the pinned buttons on phones, and no other name', () => {
    renderTable();

    const person = (name: string) => screen.getByRole('link', { name }).parentElement?.parentElement;
    expect(person('Jomar Santos')).toHaveClass('pg-phone:pr-18');
    expect(person('Liza Mercado')).not.toHaveClass('pg-phone:pr-18');
    expect(person('Ana Villanueva')).not.toHaveClass('pg-phone:pr-18');
  });

  it('calls onHandOver with the row and the button that was pressed', async () => {
    const { onHandOver } = renderTable();

    const button = screen.getByRole('button', { name: 'Hand over money from Jomar Santos' });
    await userEvent.click(button);

    expect(onHandOver).toHaveBeenCalledTimes(1);
    expect(onHandOver).toHaveBeenCalledWith(JOMAR, button);
  });
});

describe('the total (D-44)', () => {
  it('ends with "Total held by staff" and the server total', () => {
    renderTable();

    const footer = footerRow();
    expect(footer).toHaveTextContent('Total held by staff');
    expect(footer).toHaveTextContent('₱9,650.00');
    expect(within(footer).getByText('₱9,650.00').className).not.toContain('text-danger');
  });

  it('shows a total below zero in the danger tone with the true minus', () => {
    renderTable(loaded(everyone({ total: -1200 })));

    expect(within(footerRow()).getByText('−₱1,200.00').className).toContain('text-danger');
  });

  it('shows one row plus the total when only the Manager is listed', () => {
    renderTable(loaded({ rows: [CARMEN], total: 8450 }));

    expect(bodyRows()).toHaveLength(1);
    const footer = footerRow();
    expect(footer).toHaveTextContent('Total held by staff');
    expect(footer).toHaveTextContent('₱8,450.00');
  });
});

describe('loading and failure', () => {
  it('shows "Loading staff balances…" with a skeleton while the first read runs', () => {
    renderTable({ data: undefined, isError: false, isFetching: true, error: null, refetch: vi.fn() });

    expect(screen.getByText('Loading staff balances…')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Staff money on hand' })).toBeNull();
  });

  it('shows "Couldn\'t load staff balances." with Try Again, which reads again', async () => {
    const refetch = vi.fn();
    renderTable({ data: undefined, isError: true, isFetching: false, error: new Error('x'), refetch });

    expect(screen.getByText("Couldn't load staff balances.")).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the skeleton, not the old error, while Try Again runs', () => {
    renderTable({ data: undefined, isError: true, isFetching: true, error: new Error('x'), refetch: vi.fn() });

    expect(screen.getByText('Loading staff balances…')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load staff balances.")).toBeNull();
  });
});

describe('accessibility', () => {
  it('has no axe violations with the rows and the total', async () => {
    const { container } = renderTable();

    await expectNoAxeViolations(container);
  });

  it('has no axe violations in the error state', async () => {
    const { container } = renderTable({
      data: undefined,
      isError: true,
      isFetching: false,
      error: new Error('x'),
      refetch: vi.fn(),
    });

    await expectNoAxeViolations(container);
  });
});
