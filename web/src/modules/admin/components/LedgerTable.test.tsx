import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LedgerTable } from '@/modules/admin/components/LedgerTable';
import { parseLedgerPage } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import {
  LEDGER_ORDER_ID,
  ledgerEntriesFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
  type LedgerEntryFixture,
} from '@/test/moneyFixtures';

// The ledger table (D-41, MONEY-02; UI-SPEC M1 "Ledger card" and Copywriting "Ledger rows"): the server's rows, newest first, each with
// its title and sub line, Money in or Money out, and the running balance after it. The table works out nothing.

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

/** The five cells of one body row: Date, Details, Money in, Money out, Balance. */
function cellsOf(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole('cell');
}

describe('the rows (D-41)', () => {
  it('draws one row per entry in the order the server sent, under the five headers and no Actions column', () => {
    renderTable();

    const headers = within(screen.getByRole('table', { name: 'Ledger' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Date', 'Details', 'Money in', 'Money out', 'Balance']);
    expect(bodyRows()).toHaveLength(6);
    expect(cellsOf(bodyRows()[0] as HTMLElement)[1]).toHaveTextContent('Order expense');
    expect(cellsOf(bodyRows()[5] as HTMLElement)[1]).toHaveTextContent('Payment received');
  });

  it('writes the date as "Oct 28, 2026"', () => {
    renderTable();

    expect(cellsOf(bodyRows()[5] as HTMLElement)[0]).toHaveTextContent('Oct 28, 2026');
    expect(cellsOf(bodyRows()[0] as HTMLElement)[0]).toHaveTextContent('Nov 4, 2026');
  });

  it('titles a payment "Payment received" over its order number, team and method, with the number a link to the order', () => {
    renderTable();

    const details = cellsOf(bodyRows()[5] as HTMLElement)[1] as HTMLElement;
    expect(details).toHaveTextContent('Payment received');
    expect(details).toHaveTextContent('ORD-2026-0148 · Blue Hawks · GCash');
    expect(within(details).getByRole('link', { name: 'ORD-2026-0148' })).toHaveAttribute(
      'href',
      `/admin/orders/${LEDGER_ORDER_ID}`,
    );
  });

  it('titles a refund "Refund handed back" over its order number and the team', () => {
    renderTable();

    const details = cellsOf(bodyRows()[4] as HTMLElement)[1] as HTMLElement;
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

    expect(cellsOf(bodyRows()[0] as HTMLElement)[1]).toHaveTextContent('ORD-2026-0150 · Rico Dela Cruz · Cash');
  });

  it('titles a transfer in "Transfer from {name}" over its note', () => {
    renderTable();

    const details = cellsOf(bodyRows()[3] as HTMLElement)[1] as HTMLElement;
    expect(details).toHaveTextContent('Transfer from Paolo Garcia');
    expect(details).toHaveTextContent('Cash for the fabric run');
  });

  it('titles a hand-over "Transfer to {name}" and adds "Handed over by {Manager}"', () => {
    renderTable();

    const details = cellsOf(bodyRows()[2] as HTMLElement)[1] as HTMLElement;
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

    expect(cellsOf(bodyRows()[0] as HTMLElement)[1]).toHaveTextContent('Closing cash · Handed over by Carmen Reyes');
  });

  it('titles a company expense "Company expense" over its category and description', () => {
    renderTable();

    const details = cellsOf(bodyRows()[1] as HTMLElement)[1] as HTMLElement;
    expect(details).toHaveTextContent('Company expense');
    expect(details).toHaveTextContent('Utilities · Electric bill for October');
  });

  it('titles an order expense "Order expense" over its order number, category and description', () => {
    renderTable();

    const details = cellsOf(bodyRows()[0] as HTMLElement)[1] as HTMLElement;
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

    const [expense, transfer, payment] = bodyRows().map((row) => cellsOf(row)[1] as HTMLElement);
    expect(expense?.textContent).toBe('Company expenseUtilities');
    expect(transfer?.textContent).toBe('Transfer from Paolo Garcia');
    expect(payment?.textContent).toBe('Payment receivedCash');
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

    const details = cellsOf(bodyRows()[0] as HTMLElement)[1] as HTMLElement;
    expect(details).toHaveTextContent('Transfer from Ana Villanueva (former staff)');
    expect(details).toHaveTextContent('Handed over by Carmen Reyes (former staff)');
  });
});

describe('Money in, Money out and Balance (D-21, OR-4, MONEY-02)', () => {
  it('shows a payment in Money in with the empty marker under Money out, and a refund the other way round', () => {
    renderTable();

    const [, , moneyIn, moneyOut] = cellsOf(bodyRows()[5] as HTMLElement);
    expect(moneyIn).toHaveTextContent('₱2,000.00');
    expect(moneyOut).toHaveTextContent('Not set');
    const [, , refundIn, refundOut] = cellsOf(bodyRows()[4] as HTMLElement);
    expect(refundIn).toHaveTextContent('Not set');
    expect(refundOut).toHaveTextContent('₱300.00');
  });

  it('shows every money out amount without a sign', () => {
    renderTable();

    for (const index of [0, 1, 2, 4]) {
      const cells = cellsOf(bodyRows()[index] as HTMLElement);
      expect(cells[3]?.textContent).toMatch(/^₱[\d,]+\.\d{2}$/);
    }
  });

  it("shows each row's balance after it as the server sent it, with nothing added up here", () => {
    renderTable();

    const balances = bodyRows().map((row) => cellsOf(row)[4]?.textContent);
    expect(balances).toEqual(['−₱500.00', '₱950.00', '₱1,700.00', '₱3,700.00', '₱1,700.00', '₱2,000.00']);
  });

  it('shows a negative balance in the danger tone with the true minus sign (D-21)', () => {
    renderTable();

    const figure = within(cellsOf(bodyRows()[0] as HTMLElement)[4] as HTMLElement).getByText('−₱500.00');
    expect(figure.className).toContain('text-danger');
    const positive = within(cellsOf(bodyRows()[1] as HTMLElement)[4] as HTMLElement).getByText('₱950.00');
    expect(positive.className).not.toContain('text-danger');
  });

  it('offers no edit or delete action on any row (D-22, MONEY-07)', () => {
    renderTable();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });
});

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderTable();

    await expectNoAxeViolations(container);
  });
});
