import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { MoneyRoute } from '@/modules/admin/pages/MoneyPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  createHandoverBackend,
  handoverSavedFixture,
  JOMAR_ID,
  ledgerBackend,
  myMoneyBackend,
  myMoneyFixture,
  myMoneyNegativeFixture,
  staffBalancesBackend,
  staffBalancesFixture,
  transferRecipientsBackend,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// My Money, /admin/money (D-39, MONEY-02): the header, the caller's own balance card and the ledger under it. A Manager also gets the
// tabs Mine and All Staff (D-42, plan 10-19); an Admin sees only the Mine content.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  ledgerBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
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
            <MoneyRoute />
          </MemoryRouter>
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

describe('the page (D-39)', () => {
  it('shows the h1 "My Money", the subline and the balance card with the explanation line', async () => {
    myMoneyBackend(myMoneyFixture({ balance: 8450 }));
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
    expect(screen.getByText('What you hold from payments, transfers and expenses.')).toBeVisible();
    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    expect(screen.getByText('Money on hand')).toBeVisible();
    expect(
      screen.getByText(
        'Payments received and transfers in, minus transfers out, expenses paid and refunds handed back.',
      ),
    ).toBeVisible();
  });

  it('sets the document title to "My Money · CSPS Admin"', async () => {
    myMoneyBackend();
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('My Money · CSPS Admin');
    });
  });

  it('is the only h1 and asks only for the caller own figure', async () => {
    const calls = myMoneyBackend();
    renderPage();

    await screen.findByText('₱8,450.00');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe('/api/v1/staff-money/me');
  });

  it('shows a balance below zero in the danger tone with the true minus sign (D-21)', async () => {
    myMoneyBackend(myMoneyNegativeFixture());
    renderPage();

    const card = await screen.findByRole('region', { name: 'Money on hand' });
    const figure = await within(card).findByText('−₱500.00');
    expect(figure.className).toContain('text-danger');
  });

  it('reads the money again on every visit (D-13)', async () => {
    const calls = myMoneyBackend();
    const first = renderPage();
    await screen.findByText('₱8,450.00');
    first.unmount();

    renderPage();
    await screen.findByText('₱8,450.00');

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });

  it('has no axe violations', async () => {
    myMoneyBackend();
    const { container } = renderPage();

    await screen.findByText('₱8,450.00');
    await expectNoAxeViolations(container);
  });
});

describe('the header Transfer button (D-39, D-14; plan 10-15)', () => {
  it('is a primary md "Transfer" with the arrow-right icon and opens the Transfer Money window', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('₱8,450.00');
    const transfer = screen.getByRole('button', { name: 'Transfer' });
    expect(transfer.className).toContain('bg-primary');
    expect(transfer.className).toContain('h-11');
    expect(transfer.querySelector('svg.lucide-arrow-right')).not.toBeNull();
    await user.click(transfer);

    const dialog = await screen.findByRole('dialog', { name: 'Transfer Money' });
    expect(within(dialog).getByText('From Carmen Reyes (you). You have ₱8,450.00 on hand.')).toBeVisible();
  });

  it('sits in the header beside the title, not in the balance card', async () => {
    myMoneyBackend();
    renderPage();

    await screen.findByText('₱8,450.00');
    const heading = screen.getByRole('heading', { level: 1, name: 'My Money' });
    const header = heading.parentElement?.parentElement;
    expect(header).toContainElement(screen.getByRole('button', { name: 'Transfer' }));
  });

  it.each([
    ['₱0.00', myMoneyFixture({ balance: 0 })],
    ['−₱500.00', myMoneyNegativeFixture()],
  ])(
    'with %s it is aria-disabled and focusable, with its visible reason under the header actions',
    async (figure, fixture) => {
      myMoneyBackend(fixture);
      renderPage();

      await within(await screen.findByRole('region', { name: 'Money on hand' })).findByText(figure);
      const transfer = screen.getByRole('button', { name: 'Transfer' });
      expect(transfer).toHaveAttribute('aria-disabled', 'true');
      transfer.focus();
      expect(transfer).toHaveFocus();
      const reason = screen.getByText('Nothing on hand to transfer.');
      expect(reason).toBeVisible();
      expect(transfer).toHaveAttribute('aria-describedby', reason.id);
      await userEvent.click(transfer);
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('is aria-disabled with no reason line while the figure loads, and when it failed', async () => {
    myMoneyBackend(async () => {
      await delay(300);
      return problemResponse(500);
    });
    renderPage();

    const transfer = screen.getByRole('button', { name: 'Transfer' });
    expect(transfer).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Nothing on hand to transfer.')).toBeNull();
    await screen.findByText("Couldn't load the money on hand.");
    expect(screen.getByRole('button', { name: 'Transfer' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Nothing on hand to transfer.')).toBeNull();
  });

  it('has no axe violations with the reason shown', async () => {
    myMoneyBackend(myMoneyFixture({ balance: 0 }));
    const { container } = renderPage();

    await screen.findByText('₱0.00');
    await expectNoAxeViolations(container);
  });
});

describe('loading and failure', () => {
  it('shows the header at once and "Loading money on hand…" with the skeleton while the figure loads', async () => {
    myMoneyBackend(async () => {
      await delay(300);
      return myMoneyFixture();
    });
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
    expect(screen.getByText('Loading money on hand…')).toBeInTheDocument();
    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    expect(screen.getByText('Money on hand loaded.')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load the money on hand." with Try Again, which reads the figure again', async () => {
    let answered = 0;
    const calls = myMoneyBackend(() => {
      answered += 1;
      return answered === 1 ? problemResponse(500) : myMoneyFixture({ balance: 275 });
    });
    renderPage();

    expect(await screen.findByText("Couldn't load the money on hand.")).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('₱275.00')).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(screen.queryByText("Couldn't load the money on hand.")).toBeNull();
  });

  it('has no axe violations in the error state', async () => {
    myMoneyBackend(() => problemResponse(500));
    const { container } = renderPage();

    await screen.findByText("Couldn't load the money on hand.");
    await expectNoAxeViolations(container);
  });
});

describe('the Ledger card under the balance card (D-41, MONEY-02; plan 10-17)', () => {
  it('shows the Ledger card after the balance card, with its heading, its line and the rows newest first', async () => {
    myMoneyBackend();
    renderPage();

    const heading = await screen.findByRole('heading', { level: 2, name: 'Ledger' });
    expect(screen.getByText('Newest first. The balance after each entry is shown on the right.')).toBeVisible();
    const balanceCard = screen.getByRole('region', { name: 'Money on hand' });
    expect(balanceCard.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const table = await screen.findByRole('table', { name: 'Ledger' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
  });

  it('reads "Showing 6 entries · newest first" over the table', async () => {
    myMoneyBackend();
    renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 6 entries · newest first');
  });

  it('asks for the first page of the caller own ledger and never for deleted transfers', async () => {
    myMoneyBackend();
    const calls = ledgerBackend();
    renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe('/api/v1/staff-money/me/ledger');
    expect(calls[0]?.search).toBe('?page=1&pageSize=20');
  });

  it('is named by its heading, so a screen reader can find the ledger by landmark', async () => {
    myMoneyBackend();
    renderPage();

    const heading = await screen.findByRole('heading', { level: 2, name: 'Ledger' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('has no axe violations with the ledger drawn', async () => {
    myMoneyBackend();
    const { container } = renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    await expectNoAxeViolations(container);
  });
});

describe('Hand Over from the All Staff row (D-17, D-45; plan 10-19)', () => {
  const handOverButton = () => screen.getByRole('button', { name: 'Hand over money from Jomar Santos' });
  const caption = () => screen.getByText('Staff money on hand', { selector: 'caption' });

  /** The All Staff answer with Jomar holding `jomar` (or not listed when it is 0), as the server would send it. */
  function staffWithJomar(jomar: number) {
    const base = staffBalancesFixture();
    const items = base.items.filter((row) => row.userId !== JOMAR_ID || jomar > 0);
    return staffBalancesFixture({
      items: items.map((row) => (row.userId === JOMAR_ID ? { ...row, balance: jomar } : row)),
      total: 9650 - 2000 + jomar,
    });
  }

  it('opens "Hand Over Money" for that person when Hand Over is pressed, and Cancel puts focus back on the button', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    staffBalancesBackend();
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderPage('?tab=staff');

    await user.click(await screen.findByRole('button', { name: 'Hand over money from Jomar Santos' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hand Over Money' });
    expect(within(dialog).getByText('From Jomar Santos (deactivated). They hold ₱2,000.00.')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(handOverButton()).toHaveFocus();
    });
  });

  it('records the hand-over, then the row follows the new figure: a leaver left at zero loses the row and focus goes to the table caption', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    let jomar = 2000;
    staffBalancesBackend(() => staffWithJomar(jomar));
    transferRecipientsBackend();
    const sent = createHandoverBackend(() => {
      jomar = 0;
      return Response.json(handoverSavedFixture(), { status: 201 });
    });
    const user = userEvent.setup();
    renderPage('?tab=staff');

    await user.click(await screen.findByRole('button', { name: 'Hand over money from Jomar Santos' }));
    await screen.findByRole('dialog', { name: 'Hand Over Money' });
    await waitFor(() => {
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /^To/ })).toBeEnabled();
    });
    await user.selectOptions(screen.getByRole('combobox', { name: /^To/ }), 'Liza Mercado');
    await user.type(screen.getByRole('textbox', { name: /^Amount/ }), '2000');
    await user.click(screen.getByRole('button', { name: 'Record Handover' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(sent.bodies).toHaveLength(1);
    expect(await screen.findByText('Handover recorded')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Hand over money from Jomar Santos' })).toBeNull();
    });
    expect(screen.queryByText('Jomar Santos')).toBeNull();
    expect(screen.getByText('₱7,650.00')).toBeVisible();
    await waitFor(() => {
      expect(caption()).toHaveFocus();
    });
  });

  it('puts focus back on the row Hand Over button when money is still left to hand over', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    let jomar = 2000;
    staffBalancesBackend(() => staffWithJomar(jomar));
    transferRecipientsBackend();
    createHandoverBackend(() => {
      jomar = 500;
      return Response.json(handoverSavedFixture({ senderBalance: 500 }), { status: 201 });
    });
    const user = userEvent.setup();
    renderPage('?tab=staff');

    await user.click(await screen.findByRole('button', { name: 'Hand over money from Jomar Santos' }));
    await screen.findByRole('dialog', { name: 'Hand Over Money' });
    await waitFor(() => {
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /^To/ })).toBeEnabled();
    });
    await user.selectOptions(screen.getByRole('combobox', { name: /^To/ }), 'Liza Mercado');
    await user.type(screen.getByRole('textbox', { name: /^Amount/ }), '1500');
    await user.click(screen.getByRole('button', { name: 'Record Handover' }));

    expect(await screen.findByText('Jomar Santos now holds ₱500.00.')).toBeVisible();
    await waitFor(() => {
      expect(within(screen.getByRole('table', { name: 'Staff money on hand' })).getByText('₱500.00')).toBeVisible();
    });
    await waitFor(() => {
      expect(handOverButton()).toHaveFocus();
    });
  });
});

const ADMIN_SESSION = sessionResponse({
  user: {
    id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
    email: 'lito@example.ph',
    firstName: 'Lito',
    lastName: 'Santos',
    role: 'Admin',
  },
});

describe('the Manager tabs Mine and All Staff (D-42, MONEY-03; plan 10-19)', () => {
  it('shows a Manager the tabs Mine and All Staff, with Mine selected and its balance card and ledger drawn', async () => {
    myMoneyBackend();
    const staff = staffBalancesBackend();
    renderPage();

    const tabs = screen.getByRole('tablist');
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Mine', 'All Staff']);
    expect(screen.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('table', { name: 'Ledger' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Money on hand' })).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Staff money on hand' })).toBeNull();
    expect(staff).toHaveLength(0);
  });

  it('writes tab=staff with a replace when All Staff is chosen, and shows the table with the total', async () => {
    myMoneyBackend();
    staffBalancesBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    renderPage('', onUrlUpdate);

    await user.click(screen.getByRole('tab', { name: 'All Staff' }));

    expect(await screen.findByRole('table', { name: 'Staff money on hand' })).toBeVisible();
    expect(screen.getByText('Total held by staff')).toBeVisible();
    expect(screen.getByText('₱9,650.00')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'All Staff' })).toHaveAttribute('aria-selected', 'true');
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toContainEqual([
      'replace',
      '?tab=staff',
    ]);
    expect(screen.queryByRole('table', { name: 'Ledger' })).toBeNull();
  });

  it('opens on All Staff from ?tab=staff and keeps the header, with Transfer, on both tabs', async () => {
    myMoneyBackend();
    staffBalancesBackend();
    renderPage('?tab=staff');

    expect(await screen.findByRole('table', { name: 'Staff money on hand' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'All Staff' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeVisible();
  });

  it('names each panel by its tab', async () => {
    myMoneyBackend();
    staffBalancesBackend();
    renderPage('?tab=staff');

    await screen.findByRole('table', { name: 'Staff money on hand' });
    expect(screen.getByRole('tabpanel', { name: 'All Staff' })).toBeVisible();
  });

  it('shows "Loading staff balances…" while All Staff loads and the failure line with Try Again if it fails', async () => {
    myMoneyBackend();
    let answered = 0;
    const calls = staffBalancesBackend(async () => {
      answered += 1;
      await delay(100);
      return answered === 1 ? problemResponse(500) : staffBalancesFixture();
    });
    renderPage('?tab=staff');

    expect(screen.getByText('Loading staff balances…')).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load staff balances.")).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Total held by staff')).toBeVisible();
    expect(calls).toHaveLength(2);
  });

  it('has no axe violations on All Staff', async () => {
    myMoneyBackend();
    staffBalancesBackend();
    const { container } = renderPage('?tab=staff');

    await screen.findByRole('table', { name: 'Staff money on hand' });
    await expectNoAxeViolations(container);
  });

  it('shows an Admin no tab strip, makes no staff request, and holds no other person figure in the DOM (OD-19, D-31, D-49)', async () => {
    clearSession();
    acceptSession(ADMIN_SESSION);
    myMoneyBackend(myMoneyFixture({ name: 'Lito Santos' }));
    const staff = staffBalancesBackend();
    const { container } = renderPage();

    await screen.findByRole('table', { name: 'Ledger' });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('table', { name: 'Staff money on hand' })).toBeNull();
    expect(staff).toHaveLength(0);
    // Liza and Paolo are counterparts in the Admin's own ledger fixture, so only the staff-only names and figures are checked.
    for (const other of ['Jomar Santos', 'Ana Villanueva', 'Total held by staff', '9,650.00']) {
      expect(container).not.toHaveTextContent(other);
    }
  });

  it('drops tab=staff from an Admin URL with one replace, shows Mine and still makes no staff request (Admin)', async () => {
    clearSession();
    acceptSession(ADMIN_SESSION);
    myMoneyBackend();
    const staff = staffBalancesBackend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?tab=staff', onUrlUpdate);

    expect(await screen.findByRole('table', { name: 'Ledger' })).toBeVisible();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(onUrlUpdate.mock.calls.map(([event]) => [event.options.history, event.queryString])).toEqual([
      ['replace', ''],
    ]);
    expect(staff).toHaveLength(0);
    expect(screen.queryByRole('table', { name: 'Staff money on hand' })).toBeNull();
  });
});
