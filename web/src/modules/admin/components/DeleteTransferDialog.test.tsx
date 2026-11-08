import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { DeleteTransferDialog } from '@/modules/admin/components/DeleteTransferDialog';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { ledgerKey } from '@/modules/admin/hooks/useLedgerQuery';
import { myMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { staffBalancesKey } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { transfersKey } from '@/modules/admin/hooks/useTransfersQuery';
import {
  parseStaffBalances,
  parseTransferPage,
  toTransferTarget,
  type TransferTarget,
} from '@/modules/admin/services/moneyService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  deleteTransferBackend,
  LIZA_ID,
  staffBalancesBackend,
  staffBalancesFixture,
  TRANSFER_ID,
  TRANSFER_VERSION,
  transferItemFixture,
  transferListFixture,
  transferNotFoundProblem,
  transferStaleProblem,
  type StaffBalancesFixture,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Delete Transfer confirm (D-23, D-29, MONEY-06; UI-SPEC T2): a simple confirm with no reason, Cancel focused first, the transfer's
// version sent as a query parameter, and the money answers read again after it.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  // The dialog reads the staff balances when it opens, for the resulting-balance check (D-33).
  staffBalancesBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function target(overrides: Partial<Parameters<typeof transferItemFixture>[0]> = {}): TransferTarget {
  const [row] = parseTransferPage(transferListFixture([transferItemFixture(overrides)])).rows;
  if (row === undefined) throw new Error('No row.');
  return toTransferTarget(row);
}

function renderDialog(
  transfer: TransferTarget = target(),
  handlers: { onClose?: () => void; onDone?: () => void } = {},
) {
  const onClose = handlers.onClose ?? vi.fn();
  const onDone = handlers.onDone ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DeleteTransferDialog transfer={transfer} open onClose={onClose} onDone={onDone} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, onDone };
}

describe('the confirm (D-29)', () => {
  it('asks "Delete this transfer?" and says what it does, with the amount, both people and the date', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(
      within(dialog).getByText(
        "₱2,000.00 from Paolo Garcia to Liza Mercado, Oct 6, 2026. It stops counting toward both balances. You can't undo this, but you can record it again.",
      ),
    ).toBeVisible();
  });

  it('puts the focus on Cancel first and offers no reason box', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeVisible();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
  });

  it('Cancel closes it without a request', async () => {
    const deletions = deleteTransferBackend();
    const { onClose } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deletions.urls).toHaveLength(0);
  });

  it('has no axe violations', async () => {
    renderDialog();

    await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await expectNoAxeViolations(document.body);
  });
});

describe('Delete Transfer (D-23)', () => {
  it('sends DELETE /api/v1/money-transfers/{id}?version= with the version of the row', async () => {
    const deletions = deleteTransferBackend();
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(deletions.urls).toHaveLength(1);
    });
    expect(deletions.urls[0]?.pathname).toBe(`/api/v1/money-transfers/${TRANSFER_ID}`);
    expect(deletions.urls[0]?.searchParams.get('version')).toBe(TRANSFER_VERSION);
  });

  it('sends a version with "+" and "/" encoded, so the server reads the same text', async () => {
    const deletions = deleteTransferBackend();
    renderDialog(target({ version: 'a+b/c==' }));
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(deletions.urls).toHaveLength(1);
    });
    expect(deletions.urls[0]?.search).toContain('version=a%2Bb%2Fc%3D%3D');
    expect(deletions.urls[0]?.searchParams.get('version')).toBe('a+b/c==');
  });

  it('shows "Deleting" on the button while the request runs, and ignores a second press', async () => {
    const deletions = deleteTransferBackend(async () => {
      await delay(200);
      return new Response(null, { status: 204 });
    });
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    expect(await within(dialog).findByRole('button', { name: 'Deleting' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => {
      expect(deletions.urls).toHaveLength(1);
    });
  });

  it('on 204 toasts "Transfer deleted" with its line, closes, and tells the host the transfer is gone', async () => {
    deleteTransferBackend();
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    expect(await screen.findByText('Transfer deleted')).toBeVisible();
    expect(screen.getByText('It no longer counts toward any balance.')).toBeVisible();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: TRANSFER_ID }));
  });

  it('reads the transfers, ledger, my money and dashboard answers again after a delete (D-13)', async () => {
    deleteTransferBackend();
    const keys = [
      transfersKey({ page: 1, pageSize: 20, deleted: false }),
      ledgerKey('me', { page: 1, pageSize: 20, deleted: false }),
      myMoneyKey,
      dashboardSummaryKey,
    ];
    keys.forEach((key) => {
      queryClient.setQueryData(key, { held: true });
    });
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await screen.findByText('Transfer deleted');
    await waitFor(() => {
      keys.forEach((key) => {
        expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
      });
    });
  });
});

/** The staff balances with Liza (the receiver of the default transfer) holding `liza`, or left out when it is null. */
function balancesWithLiza(liza: number | null): StaffBalancesFixture {
  const others = staffBalancesFixture().items.filter((row) => row.userId !== LIZA_ID);
  const lizaRow = staffBalancesFixture().items.find((row) => row.userId === LIZA_ID);
  if (lizaRow === undefined) throw new Error('No Liza row.');
  return staffBalancesFixture({ items: liza === null ? others : [...others, { ...lizaRow, balance: liza }] });
}

const WARNING = "Liza Mercado's balance will be −₱500.00.";

describe('the resulting-balance warning (D-33, T-10-44)', () => {
  it("warns that the receiver's balance will go below zero: 1,500.00 held, 2,000.00 deleted", async () => {
    staffBalancesBackend(balancesWithLiza(1500));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(await within(dialog).findByText(WARNING)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeEnabled();
  });

  it('shows no warning when the balance stays at or above zero: 3,000.00 held, and exactly 2,000.00 held', async () => {
    staffBalancesBackend(balancesWithLiza(3000));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeEnabled();
    });
    expect(within(dialog).queryByText(/balance will be/)).toBeNull();
  });

  it('shows no warning when the balance lands exactly on zero', async () => {
    staffBalancesBackend(balancesWithLiza(2000));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeEnabled();
    });
    expect(within(dialog).queryByText(/balance will be/)).toBeNull();
  });

  it('treats a receiver the balances list leaves out (a leaver at zero) as holding nothing', async () => {
    staffBalancesBackend(balancesWithLiza(null));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(await within(dialog).findByText("Liza Mercado's balance will be −₱2,000.00.")).toBeVisible();
  });

  it('draws the warning with an alert icon in front of the line', async () => {
    staffBalancesBackend(balancesWithLiza(1500));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    const line = await within(dialog).findByText(WARNING);
    expect(line.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('shows a skeleton and keeps Delete Transfer disabled while the balances are read', async () => {
    staffBalancesBackend(async () => {
      await delay(300);
      return balancesWithLiza(1500);
    });
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(within(dialog).getByText('Loading staff balances…')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(await within(dialog).findByText(WARNING)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeEnabled();
  });

  it('reads the balances fresh when it opens, even when an older answer is cached', async () => {
    queryClient.setQueryData(staffBalancesKey, parseStaffBalances(balancesWithLiza(3000)));
    const calls = staffBalancesBackend(async () => {
      await delay(100);
      return balancesWithLiza(1500);
    });
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeDisabled();
    expect(await within(dialog).findByText(WARNING)).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  it('says "Couldn\'t check the new balances. The delete still works." and leaves Delete Transfer enabled when the read fails', async () => {
    staffBalancesBackend(() => problemResponse(500));
    const deletions = deleteTransferBackend();
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    expect(await within(dialog).findByText("Couldn't check the new balances. The delete still works.")).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Delete Transfer' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(deletions.urls).toHaveLength(1);
    });
  });

  it('has no axe violations with the warning shown, and with the check failed', async () => {
    staffBalancesBackend(balancesWithLiza(1500));
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await within(dialog).findByText(WARNING);
    await expectNoAxeViolations(document.body);
  });
});

describe('a stale or missing transfer (SEC-07)', () => {
  it('on a 409 keeps the dialog open with the alert line, and reads the lists again (stale)', async () => {
    deleteTransferBackend(() => transferStaleProblem());
    const key = transfersKey({ page: 1, pageSize: 20, deleted: false });
    queryClient.setQueryData(key, { held: true });
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('This was changed by someone else. Reload and try again.');
    expect(screen.getByRole('dialog', { name: 'Delete this transfer?' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
    expect(screen.queryByText('Transfer deleted')).toBeNull();
  });

  it("says the stale line from the copy when the server's answer carries no detail", async () => {
    deleteTransferBackend(
      () =>
        new Response(JSON.stringify({ title: 'Conflict', status: 409 }), {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    );
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This was changed by someone else. Reload and try again.',
    );
  });

  it('on a 404 closes with the info toast "Already deleted", tells the host, and reads the lists again', async () => {
    deleteTransferBackend(() => transferNotFoundProblem());
    const key = transfersKey({ page: 1, pageSize: 20, deleted: false });
    queryClient.setQueryData(key, { held: true });
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    expect(await screen.findByText('Already deleted')).toBeVisible();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: TRANSFER_ID }));
    expect(screen.queryByText('Transfer deleted')).toBeNull();
    await waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });

  it('lets a corrected retry after a 409 go through (the dialog is not stuck)', async () => {
    let answered = 0;
    const deletions = deleteTransferBackend(() => {
      answered += 1;
      return answered === 1 ? transferStaleProblem() : new Response(null, { status: 204 });
    });
    const { onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Transfer' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(deletions.urls).toHaveLength(2);
  });
});
