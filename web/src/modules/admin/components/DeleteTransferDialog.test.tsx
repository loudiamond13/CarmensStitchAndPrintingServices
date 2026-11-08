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
import { parseTransferPage, toTransferTarget, type TransferTarget } from '@/modules/admin/services/moneyService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  deleteTransferBackend,
  TRANSFER_ID,
  TRANSFER_VERSION,
  transferItemFixture,
  transferListFixture,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Delete Transfer confirm (D-23, D-29, MONEY-06; UI-SPEC T2): a simple confirm with no reason, Cancel focused first, the transfer's
// version sent as a query parameter, and the money answers read again after it.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
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

  it('reads the transfers, ledger, balances, my money and dashboard answers again after a delete (D-13)', async () => {
    deleteTransferBackend();
    const keys = [
      transfersKey({ page: 1, pageSize: 20, deleted: false }),
      ledgerKey('me', { page: 1, pageSize: 20, deleted: false }),
      staffBalancesKey,
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
