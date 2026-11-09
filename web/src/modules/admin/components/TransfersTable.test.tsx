import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TransfersTable } from '@/modules/admin/components/TransfersTable';
import { parseTransferPage } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import {
  LIZA_ID,
  PAOLO_ID,
  TRANSFER_ID,
  TRANSFER_VERSION,
  transferDeletedFixture,
  transferItemFixture,
  transferListFixture,
  type TransferItemFixture,
} from '@/test/moneyFixtures';

// The Transfers table (D-48, MONEY-03; UI-SPEC M1 "Transfers panel"): the server's transfers, newest first, with the people on each,
// the amount, the note, who recorded it and the Manager's Delete action. The table works out nothing and offers no edit (D-22).

const DATE = 0;
const FROM = 1;
const TO = 2;
const AMOUNT = 3;
const NOTE = 4;
const RECORDED_BY = 5;
const ACTIONS = 6;

function renderTable(
  items: TransferItemFixture[] = [transferItemFixture()],
  handlers: { onDelete?: () => void; onRemove?: () => void } = {},
) {
  const page = parseTransferPage(transferListFixture(items));
  return render(
    <MemoryRouter>
      <TransfersTable page={page} onDelete={handlers.onDelete ?? vi.fn()} onRemove={handlers.onRemove ?? vi.fn()} />
    </MemoryRouter>,
  );
}

function bodyRows(): HTMLElement[] {
  return within(screen.getByRole('table', { name: 'Transfers' }))
    .getAllByRole('row')
    .slice(1);
}

function cellAt(row: number, column: number): HTMLElement {
  const cell = bodyRows().at(row)?.querySelectorAll<HTMLElement>('td')[column];
  if (cell === undefined) throw new Error(`No cell at row ${String(row)}, column ${String(column)}.`);
  return cell;
}

const DELETE_NAME = 'Delete transfer of ₱2,000.00 from Paolo Garcia to Liza Mercado, Oct 6, 2026';

describe('the rows (D-48)', () => {
  it('is captioned "Transfers" under the seven headers, one row per transfer in the order the server sent', () => {
    renderTable([
      transferItemFixture(),
      transferItemFixture({ id: '0b0f6c1e-0000-4000-8000-0000000000d9', transferDate: '2026-10-05' }),
    ]);

    const headers = within(screen.getByRole('table', { name: 'Transfers' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Date', 'From', 'To', 'Amount', 'Note', 'Recorded by', 'Actions']);
    expect(bodyRows()).toHaveLength(2);
    expect(cellAt(0, DATE)).toHaveTextContent('Oct 6, 2026');
    expect(cellAt(1, DATE)).toHaveTextContent('Oct 5, 2026');
  });

  it('shows the sender, the receiver, the amount and who recorded it', () => {
    renderTable();

    expect(cellAt(0, FROM)).toHaveTextContent('Paolo Garcia');
    expect(cellAt(0, TO)).toHaveTextContent('Liza Mercado');
    expect(cellAt(0, AMOUNT)).toHaveTextContent('₱2,000.00');
    expect(cellAt(0, RECORDED_BY)).toHaveTextContent('Carmen Reyes');
  });

  it('marks a former staff member with the former-staff word, as ActorName does', () => {
    renderTable([transferItemFixture({ to: { id: LIZA_ID, name: 'Liza Mercado', formerStaff: true } })]);

    expect(cellAt(0, TO)).toHaveTextContent('Liza Mercado');
    expect(cellAt(0, TO)).toHaveTextContent(/former/i);
  });

  it('shows the note, and the empty marker when there is none', () => {
    renderTable([
      transferItemFixture({ note: 'Cash for the fabric run' }),
      transferItemFixture({ id: '0b0f6c1e-0000-4000-8000-0000000000d8', note: null }),
    ]);

    expect(cellAt(0, NOTE)).toHaveTextContent('Cash for the fabric run');
    expect(cellAt(1, NOTE)).toHaveTextContent('Not set');
  });

  it('lets a 200-character note wrap inside the table instead of widening it', () => {
    const note = 'x'.repeat(200);
    renderTable([transferItemFixture({ note })]);

    const text = within(cellAt(0, NOTE)).getByText(note);
    expect(text.className).toContain('wrap-anywhere');
  });

  it('wraps a very long name in From and To', () => {
    renderTable([transferItemFixture({ from: { id: PAOLO_ID, name: 'P'.repeat(120), formerStaff: false } })]);

    expect(cellAt(0, FROM).querySelector('[class*="wrap-anywhere"]')).not.toBeNull();
  });
});

describe('the Delete action (D-29, MONEY-06)', () => {
  it('has a row-scoped name with a matching title, naming the amount, both people and the date', () => {
    renderTable();

    const button = within(cellAt(0, ACTIONS)).getByRole('button', { name: DELETE_NAME });
    expect(button).toHaveAttribute('title', DELETE_NAME);
  });

  it('calls onDelete with the facts the dialog needs, including the version and the receiver', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderTable([transferItemFixture()], { onDelete });

    await user.click(screen.getByRole('button', { name: DELETE_NAME }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({
      id: TRANSFER_ID,
      version: TRANSFER_VERSION,
      amount: 2000,
      date: '2026-10-06',
      from: { name: 'Paolo Garcia' },
      to: { id: LIZA_ID, name: 'Liza Mercado' },
    });
  });

  it('offers nothing else on a row: no edit, no restore (D-22, D-28, MONEY-07)', () => {
    renderTable();

    expect(within(cellAt(0, ACTIONS)).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /edit|restore/i })).toBeNull();
  });
});

const REMOVE_NAME = 'Remove transfer of ₱2,000.00 from Paolo Garcia to Liza Mercado, Oct 6, 2026 permanently';

describe('a deleted transfer (D-30, D-31, D-24)', () => {
  it('shows the "Deleted" badge after the date, a muted struck amount, and who deleted it and when under the note', () => {
    renderTable([transferDeletedFixture({ note: 'Cash for the fabric run' })]);

    expect(cellAt(0, DATE)).toHaveTextContent('Oct 6, 2026');
    expect(within(cellAt(0, DATE)).getByText('Deleted')).toBeVisible();
    const amount = within(cellAt(0, AMOUNT)).getByText('₱2,000.00');
    expect(amount.parentElement?.className).toContain('line-through');
    expect(amount.parentElement?.className).toContain('text-ink-muted');
    expect(cellAt(0, NOTE)).toHaveTextContent('Cash for the fabric run');
    expect(cellAt(0, NOTE)).toHaveTextContent('Deleted by Carmen Reyes · Oct 8, 2026, 3:42 PM');
  });

  it('shows only the deleted line, no empty marker, when a deleted transfer has no note', () => {
    renderTable([transferDeletedFixture({ note: null })]);

    expect(cellAt(0, NOTE)).toHaveTextContent('Deleted by Carmen Reyes · Oct 8, 2026, 3:42 PM');
    expect(cellAt(0, NOTE)).not.toHaveTextContent('Not set');
  });

  it('has the Remove action instead of Delete, named with "permanently" and a matching title', () => {
    renderTable([transferDeletedFixture()]);

    const button = within(cellAt(0, ACTIONS)).getByRole('button', { name: REMOVE_NAME });
    expect(button).toHaveAttribute('title', REMOVE_NAME);
    expect(within(cellAt(0, ACTIONS)).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Delete transfer/ })).toBeNull();
  });

  it('calls onRemove with who deleted it and when, and never onDelete', async () => {
    const onRemove = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderTable([transferDeletedFixture()], { onRemove, onDelete });

    await user.click(screen.getByRole('button', { name: REMOVE_NAME }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(onRemove.mock.calls[0]?.[0]).toMatchObject({
      id: '0b0f6c1e-0000-4000-8000-0000000000d2',
      deletedBy: { name: 'Carmen Reyes' },
      deletedAtUtc: '2026-10-08T07:42:00Z',
    });
  });

  it('keeps a counted transfer next to it plain: no badge, no strike, a Delete action', () => {
    renderTable([transferDeletedFixture(), transferItemFixture({ id: '0b0f6c1e-0000-4000-8000-0000000000d7' })]);

    expect(within(cellAt(1, DATE)).queryByText('Deleted')).toBeNull();
    expect(within(cellAt(1, AMOUNT)).getByText('₱2,000.00').parentElement?.className ?? '').not.toContain(
      'line-through',
    );
    expect(within(cellAt(1, ACTIONS)).getByRole('button', { name: DELETE_NAME })).toBeVisible();
  });

  it('offers no restore, no edit and no bulk action on any row (D-27, D-28, MONEY-07)', () => {
    renderTable([transferDeletedFixture(), transferItemFixture({ id: '0b0f6c1e-0000-4000-8000-0000000000d7' })]);

    expect(screen.queryByRole('button', { name: /restore|edit|remove all|delete all|select/i })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('has no axe violations with a deleted row', async () => {
    const { container } = renderTable([transferDeletedFixture({ note: 'Cash' }), transferItemFixture()]);

    await expectNoAxeViolations(container);
  });
});

describe('states', () => {
  it('has no axe violations', async () => {
    const { container } = renderTable([transferItemFixture({ note: 'Cash for the fabric run' })]);

    await expectNoAxeViolations(container);
  });
});

describe('tablets (D-109)', () => {
  it('has no 680px floor on tablets, so Transfers fits its card at 768px', () => {
    renderTable();

    const table = screen.getByRole('table', { name: 'Transfers' });
    expect(table.className.split(/\s+/)).not.toContain('pg-tablet:min-w-[680px]');
  });
});
