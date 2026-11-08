import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { TransfersCard } from '@/modules/admin/components/TransfersCard';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  deleteTransferBackend,
  staffBalancesBackend,
  transferItemFixture,
  transferListFixture,
  transfersBackend,
  type TransferItemFixture,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Transfers card (D-48, MONEY-03, WEB-10; plan 10-20): the head, the result bar, the table, paging and the states of the Manager's
// list of every transfer. Its place (page, rows per page) lives in the URL.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  staffBalancesBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderCard(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <MemoryRouter>
            <TransfersCard />
          </MemoryRouter>
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

function rowAt(index: number): HTMLElement {
  const row = within(screen.getByRole('table', { name: 'Transfers' }))
    .getAllByRole('row')
    .slice(1)
    .at(index);
  if (row === undefined) throw new Error(`No row ${String(index)}.`);
  return row;
}

function item(id: string, amount: number, overrides: Partial<TransferItemFixture> = {}): TransferItemFixture {
  return transferItemFixture({ id, amount, version: `ver-${id}`, ...overrides });
}

const ID_A = '0b0f6c1e-0000-4000-8000-0000000000e1';
const ID_B = '0b0f6c1e-0000-4000-8000-0000000000e2';
const ID_C = '0b0f6c1e-0000-4000-8000-0000000000e3';

const deleteName = (amount: string) => `Delete transfer of ${amount} from Paolo Garcia to Liza Mercado, Oct 6, 2026`;

describe('the card', () => {
  it('shows the Transfers heading and its line over the result bar and the rows', async () => {
    transfersBackend();
    renderCard();

    expect(await screen.findByRole('table', { name: 'Transfers' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Transfers' })).toBeVisible();
    expect(screen.getByText('Every transfer between staff, newest first.')).toBeVisible();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 transfer · newest first');
  });

  it('reads "Showing 3 transfers · newest first" for the total, not the rows on the page', async () => {
    transfersBackend(transferListFixture([item(ID_A, 100)], { total: 3 }));
    renderCard();

    await screen.findByRole('table', { name: 'Transfers' });
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 3 transfers · newest first');
  });

  it('asks for the first page of 20 and sends no deleted parameter at first', async () => {
    const calls = transfersBackend();
    renderCard();

    await screen.findByRole('table', { name: 'Transfers' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe('/api/v1/money-transfers');
    expect(calls[0]?.searchParams.get('page')).toBe('1');
    expect(calls[0]?.searchParams.get('pageSize')).toBe('20');
    expect(calls[0]?.searchParams.has('deleted')).toBe(false);
  });

  it('has no axe violations', async () => {
    transfersBackend();
    const { container } = renderCard();

    await screen.findByRole('table', { name: 'Transfers' });
    await expectNoAxeViolations(container);
  });
});

describe('paging (WEB-10)', () => {
  it('asks for page 2 when the URL says page=2', async () => {
    const calls = transfersBackend(transferListFixture([item(ID_A, 100)], { total: 45, page: 2 }));
    renderCard('?page=2');

    await screen.findByRole('table', { name: 'Transfers' });
    expect(calls[0]?.searchParams.get('page')).toBe('2');
  });

  it('pushes a history entry for Next and asks for the next page', async () => {
    const calls = transfersBackend((url) =>
      transferListFixture([item(ID_A, 100)], { total: 45, page: Number(url.searchParams.get('page') ?? '1') }),
    );
    const updates: Parameters<OnUrlUpdateFunction>[0][] = [];
    renderCard('', (update) => updates.push(update));
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Transfers' });
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('page')).toBe('2');
    });
    expect(updates.at(-1)?.options.history).toBe('push');
  });

  it('never says "No transfers yet" while a page past the last is replaced by the last page (wave 8 WR-01)', async () => {
    const calls = transfersBackend((url) =>
      url.searchParams.get('page') === '1'
        ? transferListFixture([item(ID_A, 100)], { total: 1, page: 1 })
        : transferListFixture([], { total: 1, page: 5 }),
    );
    renderCard('?page=5');

    await screen.findByRole('table', { name: 'Transfers' });
    expect(screen.queryByText('No transfers yet')).toBeNull();
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('page')).toBe('1');
    });
  });

  it('keeps "Rows per page" while the list has more than 10 transfers', async () => {
    transfersBackend(transferListFixture([item(ID_A, 100)], { total: 11 }));
    renderCard();

    await screen.findByRole('table', { name: 'Transfers' });
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeVisible();
  });

  it('offers no "Rows per page" when every transfer fits the smallest size anyway', async () => {
    transfersBackend();
    renderCard();

    await screen.findByRole('table', { name: 'Transfers' });
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).toBeNull();
  });
});

describe('states', () => {
  it('shows "No transfers yet" with its line and no button when there is nothing', async () => {
    transfersBackend(transferListFixture([]));
    renderCard();

    expect(await screen.findByText('No transfers yet')).toBeVisible();
    expect(screen.getByText('Transfers between staff show here.')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/^Showing/)).toBeNull();
  });

  it('shows "Loading transfers…" with the skeleton, then the rows, and says the transfers loaded', async () => {
    transfersBackend(async () => {
      await delay(300);
      return transferListFixture();
    });
    renderCard();

    expect(screen.getByText('Loading transfers…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Transfers' })).toBeVisible();
    await screen.findByRole('table', { name: 'Transfers' });
    expect(screen.getByText('The transfers loaded.')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load transfers." with Try Again, which reads the list again', async () => {
    let answered = 0;
    const calls = transfersBackend(() => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : transferListFixture();
    });
    renderCard();
    const user = userEvent.setup();

    expect(await screen.findByText("Couldn't load transfers.")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByRole('table', { name: 'Transfers' });
    expect(calls).toHaveLength(2);
    expect(screen.queryByText("Couldn't load transfers.")).toBeNull();
  });

  it('shows the failure line, not a wrong row, when an amount is not a plain decimal', async () => {
    transfersBackend(transferListFixture([transferItemFixture({ amount: 'abc' })]));
    renderCard();

    expect(await screen.findByText("Couldn't load transfers.")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('has no axe violations in the error state', async () => {
    transfersBackend(() => problemResponse(500));
    const { container } = renderCard();

    await screen.findByText("Couldn't load transfers.");
    await expectNoAxeViolations(container);
  });
});

describe('deleting from the list (D-29, D-35; plan 10-20)', () => {
  it('opens the delete confirm for the row, sends the version, reads the list again and drops the row', async () => {
    let deleted = false;
    const calls = transfersBackend(() =>
      transferListFixture(deleted ? [item(ID_B, 300)] : [item(ID_A, 100), item(ID_B, 300)]),
    );
    const deletions = deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Transfers' });
    await user.click(screen.getByRole('button', { name: deleteName('₱100.00') }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(deletions.urls).toHaveLength(1);
    expect(deletions.urls[0]?.pathname).toBe(`/api/v1/money-transfers/${ID_A}`);
    expect(deletions.urls[0]?.searchParams.get('version')).toBe(`ver-${ID_A}`);
    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    await waitFor(() => {
      expect(within(screen.getByRole('table', { name: 'Transfers' })).getAllByRole('row')).toHaveLength(2);
    });
  });

  it("moves focus to the next row's action after a delete", async () => {
    let deleted = false;
    transfersBackend(() =>
      transferListFixture(
        deleted ? [item(ID_B, 300), item(ID_C, 500)] : [item(ID_A, 100), item(ID_B, 300), item(ID_C, 500)],
      ),
    );
    deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Transfers' });
    await user.click(screen.getByRole('button', { name: deleteName('₱100.00') }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(within(rowAt(0)).getByRole('button', { name: deleteName('₱300.00') })).toHaveFocus();
    });
  });

  it("moves focus to the previous row's action when the last row is deleted", async () => {
    let deleted = false;
    transfersBackend(() => transferListFixture(deleted ? [item(ID_A, 100)] : [item(ID_A, 100), item(ID_B, 300)]));
    deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Transfers' });
    await user.click(screen.getByRole('button', { name: deleteName('₱300.00') }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(within(rowAt(0)).getByRole('button', { name: deleteName('₱100.00') })).toHaveFocus();
    });
  });

  it('moves focus to the card heading when the only row is deleted, because the empty list has no caption', async () => {
    let deleted = false;
    transfersBackend(() => transferListFixture(deleted ? [] : [item(ID_A, 100)]));
    deleteTransferBackend(() => {
      deleted = true;
      return new Response(null, { status: 204 });
    });
    renderCard();
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Transfers' });
    await user.click(screen.getByRole('button', { name: deleteName('₱100.00') }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(screen.getByText('No transfers yet')).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Transfers' })).toHaveFocus();
    });
  });
});
