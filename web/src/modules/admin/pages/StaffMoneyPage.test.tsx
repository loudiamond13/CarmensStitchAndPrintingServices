import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { StaffMoneyRoute } from '@/modules/admin/pages/StaffMoneyPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  JOMAR_ID,
  LIZA_ID,
  ledgerBackend,
  ledgerEntriesFixture,
  ledgerPageFixture,
  staffPersonBackend,
  staffPersonFixture,
} from '@/test/moneyFixtures';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// M2 One person's money, /admin/money/staff/:userId (D-42, D-43, MONEY-03; plan 10-19): for a Manager, a back link, the person's name with
// their role and standing, the balance card and the ledger. The route loader keeps an Admin out; an invalid id sends no request.

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

function renderPage(userId: string = JOMAR_ID, search = '') {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter initialEntries={[`/admin/money/staff/${userId}`]}>
          <Routes>
            <Route path="/admin/money/staff/:userId" element={<StaffMoneyRoute />} />
          </Routes>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

function parentOf(element: HTMLElement): HTMLElement {
  if (element.parentElement === null) throw new Error('The element has no parent.');
  return element.parentElement;
}

/** Records every request to any staff-money address, whatever its shape, so a test can say "no request was made". */
function anyStaffMoneyRequest(): string[] {
  const seen: string[] = [];
  server.use(
    http.get('*/api/v1/staff-money/*', ({ request }) => {
      seen.push(new URL(request.url).pathname);
      return HttpResponse.json({}, { status: 500 });
    }),
  );
  return seen;
}

describe('the page for a leaver (D-42, D-43)', () => {
  it('shows a back link "All staff" to All Staff, the name as the h1 and the subline', async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Jomar Santos' });
    expect(heading).toBeVisible();
    const back = screen.getByRole('link', { name: 'All staff' });
    expect(back).toHaveAttribute('href', '/admin/money?tab=staff');
    expect(screen.getByText('Money on hand and ledger.')).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('puts the role badge and the "Deactivated" badge beside the name, outside the h1', async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Jomar Santos' });
    const row = parentOf(heading);
    expect(within(row).getByText('Admin')).toBeVisible();
    expect(within(row).getByText('Deactivated')).toBeVisible();
    expect(heading).toHaveTextContent(/^Jomar Santos$/);
  });

  it('says "Deleted" for a deleted person and no standing badge for an active one', async () => {
    staffPersonBackend(JOMAR_ID, staffPersonFixture({ status: 'deleted' }));
    ledgerBackend(undefined, JOMAR_ID);
    const first = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Jomar Santos' });
    expect(screen.getByText('Deleted')).toBeVisible();
    first.unmount();
    queryClient.clear();

    staffPersonBackend(LIZA_ID, staffPersonFixture({ userId: LIZA_ID, name: 'Liza Mercado', status: 'active' }));
    ledgerBackend(undefined, LIZA_ID);
    renderPage(LIZA_ID);
    await screen.findByRole('heading', { level: 1, name: 'Liza Mercado' });
    expect(screen.queryByText('Deleted')).toBeNull();
    expect(screen.queryByText('Deactivated')).toBeNull();
    expect(screen.queryByText('Active')).toBeNull();
  });

  it("shows the person's balance card and ledger, asks for that person's ledger, and offers a Manager Show deleted", async () => {
    staffPersonBackend(JOMAR_ID);
    const ledgerCalls = ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    const card = await screen.findByRole('region', { name: 'Money on hand' });
    expect(await within(card).findByText('₱2,000.00')).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Ledger' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeVisible();
    expect(ledgerCalls).toHaveLength(1);
    expect(ledgerCalls[0]?.pathname).toBe(`/api/v1/staff-money/${JOMAR_ID}/ledger`);
    expect(ledgerCalls[0]?.search).toBe('?page=1&pageSize=20');
  });

  it("names the person on the Manager's Delete action of a transfer row (plan 10-20)", async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(ledgerPageFixture(ledgerEntriesFixture()), JOMAR_ID);
    renderPage();

    expect(
      await screen.findByRole('button', {
        name: 'Delete transfer of ₱2,000.00 from Jomar Santos to Liza Mercado, Nov 2, 2026',
      }),
    ).toBeVisible();
  });

  it('has no header action: no Transfer and no Hand Over button on the page', async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.queryByRole('button', { name: /^(Transfer|Hand Over)/i })).toBeNull();
    const heading = screen.getByRole('heading', { level: 1, name: 'Jomar Santos' });
    expect(within(parentOf(parentOf(heading))).queryByRole('button')).toBeNull();
  });

  it('sets the document title to "{name} · Money · CSPS Admin"', async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('Jomar Santos · Money · CSPS Admin');
    });
  });

  it('asks for page 2 of that ledger when the address says so', async () => {
    staffPersonBackend(JOMAR_ID);
    const calls = ledgerBackend(
      (url) => ledgerPageFixture(ledgerEntriesFixture(), { total: 30, page: Number(url.searchParams.get('page')) }),
      JOMAR_ID,
    );
    renderPage(JOMAR_ID, '?page=2&size=10');

    await screen.findByRole('table', { name: 'Ledger' });
    expect(calls[0]?.search).toBe('?page=2&pageSize=10');
  });

  it("does not use the signed-in person's own wording when the ledger is empty (wave 8 IN-08)", async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(ledgerPageFixture([]), JOMAR_ID);
    renderPage();

    expect(await screen.findByText('No money in or out yet')).toBeVisible();
    expect(screen.queryByText(/Payments you receive/)).toBeNull();
  });

  it('has no axe violations', async () => {
    staffPersonBackend(JOMAR_ID);
    ledgerBackend(undefined, JOMAR_ID);
    const { container } = renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    await expectNoAxeViolations(container);
  });
});

describe('a person who is not found (MONEY-03)', () => {
  it('shows "This person wasn\'t found." with Back to All Staff for an invalid id, and sends no request', async () => {
    const seen = anyStaffMoneyRequest();
    renderPage('not-a-guid');

    expect(await screen.findByText("This person wasn't found.")).toBeVisible();
    expect(screen.getByText('Check the link, or go back to All Staff.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to All Staff' })).toHaveAttribute('href', '/admin/money?tab=staff');
    await delay(60);
    expect(seen).toEqual([]);
  });

  it('shows the same for the all-zero id and sends no request', async () => {
    const seen = anyStaffMoneyRequest();
    renderPage('00000000-0000-0000-0000-000000000000');

    expect(await screen.findByText("This person wasn't found.")).toBeVisible();
    await delay(60);
    expect(seen).toEqual([]);
  });

  it('shows the same when the server answers 404, and never asks for the ledger', async () => {
    staffPersonBackend(JOMAR_ID, () => problemResponse(404));
    const ledgerCalls = ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    expect(await screen.findByText("This person wasn't found.")).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to All Staff' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(ledgerCalls).toHaveLength(0);
  });

  it('has no axe violations in the not-found state', async () => {
    anyStaffMoneyRequest();
    const { container } = renderPage('not-a-guid');

    await screen.findByText("This person wasn't found.");
    await expectNoAxeViolations(container);
  });
});

describe('loading and failure', () => {
  it('shows "Loading money on hand…" and the back link while the person loads, and no ledger request yet', async () => {
    staffPersonBackend(JOMAR_ID, async () => {
      await delay(200);
      return staffPersonFixture();
    });
    const ledgerCalls = ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    expect(screen.getByText('Loading money on hand…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All staff' })).toBeVisible();
    expect(ledgerCalls).toHaveLength(0);
    expect(await screen.findByRole('heading', { level: 1, name: 'Jomar Santos' })).toBeVisible();
  });

  it('shows "Couldn\'t load the money on hand." with Try Again, which reads the person again and then the ledger', async () => {
    let answered = 0;
    const calls = staffPersonBackend(JOMAR_ID, () => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : staffPersonFixture();
    });
    ledgerBackend(undefined, JOMAR_ID);
    renderPage();

    expect(await screen.findByText("Couldn't load the money on hand.")).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jomar Santos' })).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Ledger' })).toBeVisible();
    expect(calls).toHaveLength(2);
  });

  it('has no axe violations in the error state', async () => {
    staffPersonBackend(JOMAR_ID, () => problemResponse(500));
    const { container } = renderPage();

    await screen.findByText("Couldn't load the money on hand.");
    await expectNoAxeViolations(container);
  });
});
