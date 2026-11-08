import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { RemoveTransferDialog } from '@/modules/admin/components/RemoveTransferDialog';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { ledgerKey } from '@/modules/admin/hooks/useLedgerQuery';
import { myMoneyKey } from '@/modules/admin/hooks/useMyMoneyQuery';
import { staffBalancesKey } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { transfersKey } from '@/modules/admin/hooks/useTransfersQuery';
import { parseTransferPage, toTransferTarget, type TransferTarget } from '@/modules/admin/services/moneyService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  removeTransferBackend,
  staffBalancesBackend,
  transferDeletedFixture,
  transferListFixture,
  transferNotFoundProblem,
  type TransferItemFixture,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Remove Transfer confirm (D-24 to D-28, MONEY-06; UI-SPEC T3): the stronger confirm before a deleted transfer is removed for good.
// A danger details box names the record, Cancel is focused first, there is nothing to type, and the balances do not change.

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

const DELETED_ID = '0b0f6c1e-0000-4000-8000-0000000000d2';

function target(overrides: Partial<TransferItemFixture> = {}): TransferTarget {
  const [row] = parseTransferPage(transferListFixture([transferDeletedFixture(overrides)])).rows;
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
        <RemoveTransferDialog transfer={transfer} open onClose={onClose} onDone={onDone} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, onDone };
}

describe('the confirm (D-26)', () => {
  it('asks "Permanently remove this transfer?" and says it cannot be undone', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    expect(within(dialog).getByText("This can't be undone.")).toBeVisible();
  });

  it('shows the details box: the record, its dates, who deleted it, and what stays', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    expect(within(dialog).getByText('₱2,000.00 from Paolo Garcia to Liza Mercado')).toBeVisible();
    expect(within(dialog).getByText('Dated Oct 6, 2026 · Deleted by Carmen Reyes on Oct 8, 2026')).toBeVisible();
    expect(
      within(dialog).getByText("Balances don't change. Only the record is removed. A copy stays in the audit log."),
    ).toBeVisible();
  });

  it('draws the details box in the danger look: soft danger ground, a danger border, 8px radius', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    const box = within(dialog).getByText('₱2,000.00 from Paolo Garcia to Liza Mercado').parentElement;
    expect(box?.className).toContain('bg-danger-soft');
    expect(box?.className).toContain('border-danger');
    expect(box?.className).toContain('rounded-sm');
  });

  it('leaves out the deleted-by part when the record does not say who or when', async () => {
    renderDialog(target({ deletedBy: null, deletedAtUtc: null }));

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    expect(within(dialog).getByText('Dated Oct 6, 2026')).toBeVisible();
    expect(within(dialog).queryByText(/Deleted by/)).toBeNull();
  });

  it('wraps very long names inside the details box', async () => {
    const long = 'P'.repeat(120);
    renderDialog(target({ from: { id: 'a', name: long, formerStaff: false } }));

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    const line = within(dialog).getByText(new RegExp(`^₱2,000.00 from ${long}`));
    expect(line.className).toContain('wrap-anywhere');
  });

  it('puts the focus on Cancel first, offers no box to type in, and the danger button "Remove Permanently"', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    expect(within(dialog).getByRole('button', { name: 'Remove Permanently' })).toBeEnabled();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
  });

  it('Cancel closes it without a request', async () => {
    const removals = removeTransferBackend();
    const { onClose } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(removals.urls).toHaveLength(0);
  });

  it('reads no balances: the remove changes none (D-24)', async () => {
    const balances = staffBalancesBackend();
    renderDialog();

    await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    expect(balances).toHaveLength(0);
  });

  it('has no axe violations', async () => {
    renderDialog();

    await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await expectNoAxeViolations(document.body);
  });
});

describe('Remove Permanently (D-24, D-25)', () => {
  it('sends DELETE /api/v1/money-transfers/{id}/permanent with no version', async () => {
    const removals = removeTransferBackend();
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    await waitFor(() => {
      expect(removals.urls).toHaveLength(1);
    });
    expect(removals.urls[0]?.pathname).toBe(`/api/v1/money-transfers/${DELETED_ID}/permanent`);
    expect(removals.urls[0]?.search).toBe('');
  });

  it('shows "Removing" on the button while the request runs', async () => {
    removeTransferBackend(async () => {
      await delay(200);
      return new Response(null, { status: 204 });
    });
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    expect(await within(dialog).findByRole('button', { name: 'Removing' })).toHaveAttribute('aria-busy', 'true');
  });

  it('on 204 toasts "Transfer removed for good" with its line, closes, and tells the host', async () => {
    removeTransferBackend();
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    expect(await screen.findByText('Transfer removed for good')).toBeVisible();
    expect(screen.getByText("Balances didn't change.")).toBeVisible();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: DELETED_ID }));
  });

  it('reads the transfers, ledger, balances, my money and dashboard answers again after a remove (D-13)', async () => {
    removeTransferBackend();
    const keys = [
      transfersKey({ page: 1, pageSize: 20, deleted: true }),
      ledgerKey('me', { page: 1, pageSize: 20, deleted: true }),
      staffBalancesKey,
      myMoneyKey,
      dashboardSummaryKey,
    ];
    keys.forEach((key) => {
      queryClient.setQueryData(key, { held: true });
    });
    renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    await screen.findByText('Transfer removed for good');
    await waitFor(() => {
      keys.forEach((key) => {
        expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
      });
    });
  });

  it('on a 404 closes with the info toast "Already removed", tells the host, and reads the lists again', async () => {
    removeTransferBackend(() => transferNotFoundProblem());
    const key = transfersKey({ page: 1, pageSize: 20, deleted: true });
    queryClient.setQueryData(key, { held: true });
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    expect(await screen.findByText('Already removed')).toBeVisible();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Transfer removed for good')).toBeNull();
    await waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });

  it('keeps the dialog open with the error line when the server fails, so the Manager can try again', async () => {
    removeTransferBackend(() => problemResponse(500));
    const { onClose, onDone } = renderDialog();
    const user = userEvent.setup();

    const dialog = await screen.findByRole('dialog', { name: 'Permanently remove this transfer?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Permanently' }));

    expect(await within(dialog).findByRole('alert')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText('Transfer removed for good')).toBeNull();
  });
});
