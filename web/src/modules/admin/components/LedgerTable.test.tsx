import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LedgerTable } from '@/modules/admin/components/LedgerTable';
import { parseLedgerPage } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import {
  LEDGER_ORDER_ID,
  LEDGER_TRANSFER_ID,
  LIZA_ID,
  ledgerDeletedEntryFixture,
  ledgerEntriesFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
  type LedgerEntryFixture,
} from '@/test/moneyFixtures';

// The ledger table (D-41, MONEY-02; UI-SPEC M1 "Ledger card" and Copywriting "Ledger rows"): the server's rows, newest first, each with
// its title and sub line, Money in or Money out, and the running balance after it. The table works out nothing.

const DATE = 0;
const DETAILS = 1;
const MONEY_IN = 2;
const MONEY_OUT = 3;
const BALANCE = 4;

function renderTable(items: LedgerEntryFixture[] = ledgerEntriesFixture()) {
  const page = parseLedgerPage(ledgerPageFixture(items));
  return render(
    <MemoryRouter>
      <LedgerTable page={page} />
    </MemoryRouter>,
  );
}

/** The body rows of the table, in the order drawn. */
function bodyRows(): HTMLElement[] {
  return within(screen.getByRole('table', { name: 'Ledger' }))
    .getAllByRole('row')
    .slice(1);
}

/** One cell: the row's place in the table, then Date 0, Details 1, Money in 2, Money out 3, Balance 4. */
function cellAt(row: number, column: number): HTMLElement {
  const cell = bodyRows().at(row)?.querySelectorAll<HTMLElement>('td')[column];
  if (cell === undefined) throw new Error(`No cell at row ${String(row)}, column ${String(column)}.`);
  return cell;
}

describe('the rows (D-41)', () => {
  it('draws one row per entry in the order the server sent, under the five headers and no Actions column', () => {
    renderTable();

    const headers = within(screen.getByRole('table', { name: 'Ledger' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Date', 'Details', 'Money in', 'Money out', 'Balance']);
    expect(bodyRows()).toHaveLength(6);
    expect(cellAt(0, DETAILS)).toHaveTextContent('Order expense');
    expect(cellAt(5, DETAILS)).toHaveTextContent('Payment received');
  });

  it('writes the date as "Oct 28, 2026"', () => {
    renderTable();

    expect(cellAt(5, DATE)).toHaveTextContent('Oct 28, 2026');
    expect(cellAt(0, DATE)).toHaveTextContent('Nov 4, 2026');
  });

  it('titles a payment "Payment received" over its order number, team and method, with the number a link to the order', () => {
    renderTable();

    const details = cellAt(5, DETAILS);
    expect(details).toHaveTextContent('Payment received');
    expect(details).toHaveTextContent('ORD-2026-0148 · Blue Hawks · GCash');
    expect(within(details).getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/${LEDGER_ORDER_ID}`,
    );
  });

  it('titles a refund "Refund handed back" over its order number and the team', () => {
    renderTable();

    const details = cellAt(4, DETAILS);
    expect(details).toHaveTextContent('Refund handed back');
    expect(details).toHaveTextContent('ORD-2026-0148 · Blue Hawks');
    expect(details).not.toHaveTextContent('Rico Dela Cruz');
  });

  it('puts the customer in the sub line when the order has no team', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'payment-received',
        orderId: LEDGER_ORDER_ID,
        orderNumber: 'ORD-2026-0150',
        customer: 'Rico Dela Cruz',
        paymentMethod: 'Cash',
      }),
    ]);

    expect(cellAt(0, DETAILS)).toHaveTextContent('ORD-2026-0150 · Rico Dela Cruz · Cash');
  });

  it('titles a transfer in "Transfer from {name}" over its note', () => {
    renderTable();

    const details = cellAt(3, DETAILS);
    expect(details).toHaveTextContent('Transfer from Paolo Garcia');
    expect(details).toHaveTextContent('Cash for the fabric run');
  });

  it('titles a hand-over "Transfer to {name}" and adds "Handed over by {Manager}"', () => {
    renderTable();

    const details = cellAt(2, DETAILS);
    expect(details).toHaveTextContent('Transfer to Liza Mercado');
    expect(details).toHaveTextContent('Handed over by Carmen Reyes');
  });

  it('joins a note and the hand-over line with " · "', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'transfer-in',
        moneyIn: 100,
        moneyOut: null,
        counterpart: { id: 'x', name: 'Jomar Santos', formerStaff: false },
        note: 'Closing cash',
        isHandover: true,
        recordedBy: { id: 'y', name: 'Carmen Reyes', formerStaff: false },
      }),
    ]);

    expect(cellAt(0, DETAILS)).toHaveTextContent('Closing cash · Handed over by Carmen Reyes');
  });

  it('titles a company expense "Company expense" over its category and description', () => {
    renderTable();

    const details = cellAt(1, DETAILS);
    expect(details).toHaveTextContent('Company expense');
    expect(details).toHaveTextContent('Utilities · Electric bill for October');
  });

  it('titles an order expense "Order expense" over its order number, category and description', () => {
    renderTable();

    const details = cellAt(0, DETAILS);
    expect(details).toHaveTextContent('Order expense');
    expect(details).toHaveTextContent('ORD-2026-0148 · Fabric · Extra dye lot');
    expect(within(details).getByRole('link', { name: 'ORD-2026-0148' })).toBeVisible();
  });

  it('leaves a missing note or description out of the sub line, with no stray separator or dash', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'company-expense',
        moneyIn: null,
        moneyOut: 80,
        category: 'Utilities',
        description: null,
      }),
      ledgerEntryFixture({
        kind: 'transfer-in',
        counterpart: { id: 'x', name: 'Paolo Garcia', formerStaff: false },
        note: null,
      }),
      ledgerEntryFixture({
        kind: 'payment-received',
        orderId: null,
        orderNumber: null,
        team: null,
        customer: null,
        paymentMethod: 'Cash',
      }),
    ]);

    expect(cellAt(0, DETAILS).textContent).toBe('Company expenseUtilities');
    expect(cellAt(1, DETAILS).textContent).toBe('Transfer from Paolo Garcia');
    expect(cellAt(2, DETAILS).textContent).toBe('Payment receivedCash');
  });

  it('keeps the former-staff mark on a deleted person in the title and the hand-over line', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'transfer-in',
        counterpart: { id: 'x', name: 'Ana Villanueva', formerStaff: true },
        isHandover: true,
        recordedBy: { id: 'y', name: 'Carmen Reyes', formerStaff: true },
      }),
    ]);

    const details = cellAt(0, DETAILS);
    expect(details).toHaveTextContent('Transfer from Ana Villanueva (former staff)');
    expect(details).toHaveTextContent('Handed over by Carmen Reyes (former staff)');
  });
});

describe('Money in, Money out and Balance (D-21, OR-4, MONEY-02)', () => {
  it('shows a payment in Money in with the empty marker under Money out, and a refund the other way round', () => {
    renderTable();

    expect(cellAt(5, MONEY_IN)).toHaveTextContent('₱2,000.00');
    expect(cellAt(5, MONEY_OUT)).toHaveTextContent('Not set');
    expect(cellAt(4, MONEY_IN)).toHaveTextContent('Not set');
    expect(cellAt(4, MONEY_OUT)).toHaveTextContent('₱300.00');
  });

  it('shows every money out amount without a sign', () => {
    renderTable();

    for (const index of [0, 1, 2, 4]) {
      expect(cellAt(index, MONEY_OUT).textContent).toMatch(/^₱[\d,]+\.\d{2}$/);
    }
  });

  it("shows each row's balance after it as the server sent it, with nothing added up here", () => {
    renderTable();

    const balances = bodyRows().map((_row, index) => cellAt(index, BALANCE).textContent);
    expect(balances).toEqual(['−₱500.00', '₱950.00', '₱1,700.00', '₱3,700.00', '₱1,700.00', '₱2,000.00']);
  });

  it('shows a negative balance in the danger tone with the true minus sign (D-21)', () => {
    renderTable();

    expect(within(cellAt(0, BALANCE)).getByText('−₱500.00').className).toContain('text-danger');
    expect(within(cellAt(1, BALANCE)).getByText('₱950.00').className).not.toContain('text-danger');
  });

  it('offers no edit or delete action on any row (D-22, MONEY-07)', () => {
    renderTable();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });
});

describe('phones and long text (UI-SPEC M1 phone and long-text rules)', () => {
  const LONG_NOTE = `Note ${'n'.repeat(195)}`;
  const LONG_DESCRIPTION = `Part ${'d'.repeat(195)}`;

  it('gives every cell its column header as data-label, so a phone card labels each value', () => {
    renderTable();

    for (const row of bodyRows()) {
      const labels = [...row.querySelectorAll('td')].map((cell) => cell.getAttribute('data-label'));
      expect(labels).toEqual(['Date', 'Details', 'Money in', 'Money out', 'Balance']);
    }
  });

  it('makes the date the lead of each phone card: its label is hidden and the other cells keep theirs', () => {
    renderTable();

    for (const index of [0, 1, 5]) {
      expect(cellAt(index, DATE).className).toContain('pg-phone:before:hidden');
      for (const column of [DETAILS, MONEY_IN, MONEY_OUT, BALANCE]) {
        expect(cellAt(index, column).className).not.toContain('pg-phone:before:hidden');
      }
    }
  });

  it('wraps a long 200-character note anywhere and keeps all of it', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'transfer-in',
        counterpart: { id: 'x', name: 'Paolo Garcia', formerStaff: false },
        note: LONG_NOTE,
      }),
    ]);

    const note = within(cellAt(0, DETAILS)).getByText(LONG_NOTE);
    expect(note.className).toContain('wrap-anywhere');
    expect(note.className).not.toMatch(/truncate|text-ellipsis|line-clamp/);
    expect(LONG_NOTE).toHaveLength(200);
  });

  it('wraps a long 200-character description anywhere and keeps all of it', () => {
    renderTable([
      ledgerEntryFixture({
        kind: 'company-expense',
        moneyIn: null,
        moneyOut: 80,
        category: null,
        description: LONG_DESCRIPTION,
      }),
    ]);

    const description = within(cellAt(0, DETAILS)).getByText(LONG_DESCRIPTION);
    expect(description.className).toContain('wrap-anywhere');
    expect(description.className).not.toMatch(/truncate|text-ellipsis|line-clamp/);
  });

  it('wraps a long person name in a title anywhere', () => {
    const name = `Maria ${'a'.repeat(120)}`;
    renderTable([
      ledgerEntryFixture({
        kind: 'transfer-out',
        counterpart: { id: 'x', name, formerStaff: false },
        moneyIn: null,
        moneyOut: 5,
      }),
    ]);

    const title = within(cellAt(0, DETAILS)).getByText(`Transfer to ${name}`);
    expect(title.parentElement?.className).toContain('wrap-anywhere');
  });
});

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderTable();

    await expectNoAxeViolations(container);
  });
});

// The Manager's row actions on transfer rows (D-22, D-29, D-30, MONEY-06, MONEY-07; plan 10-20): Delete on a counted transfer, Remove on a
// deleted one, each named by the row. Nothing else gets an action, and the ledger never offers an edit.

const OWNER = { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Carmen Reyes', formerStaff: false };
const ACTIONS_COLUMN = 5;
const DELETE_OUT = 'Delete transfer of ₱2,000.00 from Carmen Reyes to Liza Mercado, Nov 2, 2026';
const DELETE_IN = 'Delete transfer of ₱2,000.00 from Paolo Garcia to Carmen Reyes, Nov 1, 2026';
const REMOVE_DELETED = 'Remove transfer of ₱2,000.00 from Carmen Reyes to Liza Mercado, Oct 6, 2026 permanently';

interface ActionOptions {
  canSeeActions?: boolean;
  owner?: { id: string; name: string; formerStaff: boolean } | undefined;
  onDelete?: (target: unknown) => void;
  onRemove?: (target: unknown) => void;
}

function renderWithActions(items: LedgerEntryFixture[] = ledgerEntriesFixture(), options: ActionOptions = {}) {
  const page = parseLedgerPage(ledgerPageFixture(items));
  return render(
    <MemoryRouter>
      <LedgerTable
        page={page}
        canSeeActions={options.canSeeActions ?? true}
        owner={'owner' in options ? options.owner : OWNER}
        onDelete={options.onDelete ?? vi.fn()}
        onRemove={options.onRemove ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('the Manager row actions (plan 10-20)', () => {
  it('adds a sixth Actions column, with Delete on each counted transfer row named by the row and a matching title', () => {
    renderWithActions();

    const headers = within(screen.getByRole('table', { name: 'Ledger' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Date', 'Details', 'Money in', 'Money out', 'Balance', 'Actions']);
    const out = within(cellAt(2, ACTIONS_COLUMN)).getByRole('button', { name: DELETE_OUT });
    expect(out).toHaveAttribute('title', DELETE_OUT);
    const received = within(cellAt(3, ACTIONS_COLUMN)).getByRole('button', { name: DELETE_IN });
    expect(received).toHaveAttribute('title', DELETE_IN);
  });

  it('gives payment, refund, company expense and order expense rows no action', () => {
    renderWithActions();

    for (const row of [0, 1, 4, 5]) {
      expect(within(cellAt(row, ACTIONS_COLUMN)).queryByRole('button')).toBeNull();
    }
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('gives a deleted transfer the Remove action instead, named with "permanently"', () => {
    renderWithActions([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()]);

    const remove = within(cellAt(0, ACTIONS_COLUMN)).getByRole('button', { name: REMOVE_DELETED });
    expect(remove).toHaveAttribute('title', REMOVE_DELETED);
    expect(within(cellAt(0, ACTIONS_COLUMN)).queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('calls onDelete with the transfer id, its version, the amount, the date, both people and the receiver', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithActions(ledgerEntriesFixture(), { onDelete });

    await user.click(screen.getByRole('button', { name: DELETE_OUT }));

    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({
      id: LEDGER_TRANSFER_ID,
      version: 'AAAAAAAAB9E=',
      amount: 2000,
      date: '2026-11-02',
      from: { id: OWNER.id, name: 'Carmen Reyes' },
      to: { id: LIZA_ID, name: 'Liza Mercado' },
    });
  });

  it('takes the ledger owner as the receiver of a transfer in', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithActions(ledgerEntriesFixture(), { onDelete });

    await user.click(screen.getByRole('button', { name: DELETE_IN }));

    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({
      from: { name: 'Paolo Garcia' },
      to: { id: OWNER.id, name: 'Carmen Reyes' },
    });
  });

  it("carries the ledger owner's own former-staff state onto the owner's side of the transfer (wave 10 IN-07)", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithActions(ledgerEntriesFixture(), { onDelete, owner: { ...OWNER, formerStaff: true } });

    await user.click(screen.getByRole('button', { name: DELETE_OUT }));
    await user.click(screen.getByRole('button', { name: DELETE_IN }));

    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({
      from: { id: OWNER.id, formerStaff: true },
      to: { id: LIZA_ID, formerStaff: false },
    });
    expect(onDelete.mock.calls[1]?.[0]).toMatchObject({
      from: { name: 'Paolo Garcia', formerStaff: false },
      to: { id: OWNER.id, formerStaff: true },
    });
  });

  it('calls onRemove with who deleted the transfer and when', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderWithActions([ledgerDeletedEntryFixture()], { onRemove });

    await user.click(screen.getByRole('button', { name: REMOVE_DELETED }));

    expect(onRemove.mock.calls[0]?.[0]).toMatchObject({
      deletedBy: { name: 'Carmen Reyes' },
      deletedAtUtc: '2026-10-08T07:42:00Z',
      version: 'AAAAAAAAB9G=',
    });
  });

  it('offers an Admin no Actions column and no button on any row (D-31, D-32)', () => {
    renderWithActions(ledgerEntriesFixture(), { canSeeActions: false });

    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws no Actions column when the ledger owner is not known, because the actions could not be named', () => {
    renderWithActions(ledgerEntriesFixture(), { owner: undefined });

    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never offers an edit or a restore on any row (D-22, D-28, MONEY-07)', () => {
    renderWithActions([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()]);

    expect(screen.queryByRole('button', { name: /edit|restore/i })).toBeNull();
  });

  it('has no axe violations with the actions drawn', async () => {
    const { container } = renderWithActions([ledgerDeletedEntryFixture(), ...ledgerEntriesFixture()]);

    await expectNoAxeViolations(container);
  });
});
