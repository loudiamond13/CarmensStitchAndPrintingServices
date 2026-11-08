import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { MoneyRoute } from '@/modules/admin/pages/MoneyPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  ledgerBackend,
  myMoneyBackend,
  myMoneyFixture,
  myMoneyNegativeFixture,
  transferRecipientsBackend,
} from '@/test/moneyFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// My Money, /admin/money (D-39, MONEY-02): the header, the caller's own balance card and the ledger under it. The Manager tabs
// arrive in a later plan, so for now this is the Mine content for both roles.

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

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams} hasMemory>
        <MemoryRouter>
          <MoneyRoute />
        </MemoryRouter>
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
