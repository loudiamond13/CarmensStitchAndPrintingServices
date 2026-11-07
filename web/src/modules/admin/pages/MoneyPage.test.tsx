import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { MoneyRoute } from '@/modules/admin/pages/MoneyPage';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import { myMoneyBackend, myMoneyFixture, myMoneyNegativeFixture } from '@/test/moneyFixtures';

// My Money, /admin/money (D-39, MONEY-02): the header and the caller's own balance card. The Manager tabs and the ledger arrive
// in later plans, so for now this is the Mine content for both roles.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MoneyRoute />
      </MemoryRouter>
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

    const figure = await screen.findByText('−₱500.00');
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
      return answered === 1 ? problemResponse(500) : myMoneyFixture({ balance: 300 });
    });
    renderPage();

    expect(await screen.findByText("Couldn't load the money on hand.")).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'My Money' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('₱300.00')).toBeVisible();
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
