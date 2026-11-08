import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { LedgerCard } from '@/modules/admin/components/LedgerCard';
import type { TransferActionDialogsProps } from '@/modules/admin/components/TransferActionDialogs';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { JOMAR_ID, ledgerBackend } from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The ledger owner's former-staff state (wave 10 IN-07): the card hands the row actions the owner as the page knows them, so a delete
// target never claims a deleted person is current staff. The dialogs only read names today, so the test reads the props they get.

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

function renderCard(userId: string, ownerName?: string, ownerFormerStaff?: boolean) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams} hasMemory>
        <ToastProvider>
          <MemoryRouter>
            <LedgerCard userId={userId} ownerName={ownerName} ownerFormerStaff={ownerFormerStaff} />
          </MemoryRouter>
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

async function pressFirstDelete(userId: string): Promise<TransferActionDialogsProps['deleting']> {
  ledgerBackend(undefined, userId);
  await screen.findByRole('table', { name: 'Ledger' });
  const [first] = screen.getAllByRole('button', { name: /^Delete transfer of / });
  if (first === undefined) throw new Error('No Delete action.');
  await userEvent.setup().click(first);
  return seen.props?.deleting ?? null;
}

describe("the ledger owner's former-staff state in a delete target", () => {
  it("is true on the owner's side when the page says the person's account was deleted", async () => {
    renderCard(JOMAR_ID, 'Jomar Santos', true);

    const deleting = await pressFirstDelete(JOMAR_ID);

    expect(deleting?.target.from).toMatchObject({ id: JOMAR_ID, formerStaff: true });
  });

  it('is false on My Money, where the owner is the signed-in person', async () => {
    renderCard('me');

    const deleting = await pressFirstDelete('me');

    expect(deleting?.target.from).toMatchObject({ formerStaff: false });
  });
});
