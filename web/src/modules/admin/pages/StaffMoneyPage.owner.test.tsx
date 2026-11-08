import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransferActionDialogsProps } from '@/modules/admin/components/TransferActionDialogs';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { StaffMoneyRoute } from '@/modules/admin/pages/StaffMoneyPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { JOMAR_ID, ledgerBackend, staffPersonBackend, staffPersonFixture } from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The person's standing reaches the delete target (wave 10 IN-07): a deleted account is former staff on the owner's side of the transfer,
// a deactivated one is not (the server marks former staff by deletion). The dialogs only read names today, so the test reads their props.

const seen = vi.hoisted(() => ({ props: null as TransferActionDialogsProps | null }));

vi.mock('@/modules/admin/components/TransferActionDialogs', () => ({
  TransferActionDialogs: (props: TransferActionDialogsProps) => {
    seen.props = props;
    return null;
  },
}));

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  seen.props = null;
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams} hasMemory>
        <MemoryRouter initialEntries={[`/admin/money/staff/${JOMAR_ID}`]}>
          <Routes>
            <Route path="/admin/money/staff/:userId" element={<StaffMoneyRoute />} />
          </Routes>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

async function pressFirstDelete(): Promise<TransferActionDialogsProps['deleting']> {
  await screen.findByRole('table', { name: 'Ledger' });
  const [first] = screen.getAllByRole('button', { name: /^Delete transfer of / });
  if (first === undefined) throw new Error('No Delete action.');
  await userEvent.setup().click(first);
  return seen.props?.deleting ?? null;
}

describe("the person's standing in a delete target", () => {
  it('marks the owner former staff on a deleted person page', async () => {
    staffPersonBackend(JOMAR_ID, staffPersonFixture({ status: 'deleted' }));
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    const deleting = await pressFirstDelete();

    expect(deleting?.target.from).toMatchObject({ id: JOMAR_ID, formerStaff: true });
  });

  it('does not mark a deactivated person former staff, because the account still exists', async () => {
    staffPersonBackend(JOMAR_ID, staffPersonFixture({ status: 'deactivated' }));
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    const deleting = await pressFirstDelete();

    expect(deleting?.target.from).toMatchObject({ id: JOMAR_ID, formerStaff: false });
  });
});
