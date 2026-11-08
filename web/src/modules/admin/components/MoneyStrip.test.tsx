import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { myMoneyKey, useMyMoneyQuery, type MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import type { MyMoney } from '@/modules/admin/services/moneyService';
import { expectNoAxeViolations } from '@/test/axe';
import { problemResponse } from '@/test/expenseFixtures';
import {
  MY_MONEY_USER_ID,
  myMoneyBackend,
  myMoneyFixture,
  myMoneyNegativeFixture,
  myMoneyZeroFixture,
  transferRecipientsBackend,
} from '@/test/moneyFixtures';

// The personal strip under the dashboard greeting (D-46, D-21, MONEY-02): the caller's own figure from the server, a link to
// the ledger page, and its own loading and failure states. The strip works out nothing.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

/** The strip fed by the real hook, so the request, the narrowing and the states are the ones the page has. */
function Fed({ actions }: { actions?: ReactNode }) {
  const query = useMyMoneyQuery();
  return <MoneyStrip query={query} actions={actions} />;
}

function renderFed(actions?: ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Fed actions={actions} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function queryOf(overrides: Partial<MyMoneyCardQuery> = {}): MyMoneyCardQuery {
  // With nothing to show and no failure, a plain query is still reading.
  const isFetching = overrides.data === undefined && overrides.isError !== true;
  return { data: undefined, isError: false, isFetching, error: null, refetch: vi.fn(), ...overrides };
}

function moneyOf(balance: number): MyMoney {
  return { userId: MY_MONEY_USER_ID, name: 'Liza Mercado', balance, today: '2026-11-04' };
}

function renderWith(query: MyMoneyCardQuery, actions?: ReactNode) {
  return render(
    <MemoryRouter>
      <MoneyStrip query={query} actions={actions} />
    </MemoryRouter>,
  );
}

describe('the figure from the server (D-46, MONEY-02)', () => {
  it('reads "Your money on hand" over the server balance and asks only for the caller own figure', async () => {
    const calls = myMoneyBackend(myMoneyFixture({ balance: 8450 }));
    renderFed();

    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    expect(screen.getByText('Your money on hand')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.pathname).toBe('/api/v1/staff-money/me');
    expect(calls[0]?.search).toBe('');
  });

  it('is a region named by its visible label, so a screen reader can find it by landmark (wave 6 IN-02)', async () => {
    myMoneyBackend();
    renderFed();

    await screen.findByText('₱8,450.00');
    const region = screen.getByRole('region', { name: 'Your money on hand' });
    expect(region).toContainElement(screen.getByText('₱8,450.00'));
    expect(region).toHaveAttribute('aria-labelledby', screen.getByText('Your money on hand').id);
    expect(region).not.toHaveAttribute('aria-label');
  });

  it('links View Ledger to the My Money page', async () => {
    myMoneyBackend();
    renderFed();

    await screen.findByText('₱8,450.00');
    expect(screen.getByRole('link', { name: 'View Ledger' })).toHaveAttribute('href', '/admin/money');
  });

  it('shows a balance below zero as a negative figure with the true minus sign in the danger tone (D-21)', async () => {
    myMoneyBackend(myMoneyNegativeFixture());
    renderFed();

    const figure = await screen.findByText('−₱500.00');
    expect(figure).toBeVisible();
    expect(figure.className).toContain('text-danger');
  });

  it('shows ₱0.00 in the zero dim and not in the danger tone (D-39)', async () => {
    myMoneyBackend(myMoneyZeroFixture());
    renderFed();

    const figure = await screen.findByText('₱0.00');
    expect(figure.className).toContain('text-ink-subtle');
    expect(figure.className).not.toContain('text-danger');
  });

  it('keeps a positive figure in the plain ink: neither the danger tone nor the zero dim', async () => {
    myMoneyBackend();
    renderFed();

    const figure = await screen.findByText('₱8,450.00');
    expect(figure.className).not.toContain('text-danger');
    expect(figure.className).not.toContain('text-ink-subtle');
  });

  it('shows a decorative wallet tile that no assistive technology reaches', async () => {
    myMoneyBackend();
    const { container } = renderFed();

    await screen.findByText('₱8,450.00');
    const tile = container.querySelector('svg.lucide-wallet')?.parentElement;
    expect(tile).not.toBeNull();
    expect(tile?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('puts the actions slot before View Ledger, so Transfer can sit beside it later (plan 10-15)', async () => {
    myMoneyBackend();
    renderFed(<button type="button">Slot action</button>);

    await screen.findByText('₱8,450.00');
    const slot = screen.getByRole('button', { name: 'Slot action' });
    const ledger = screen.getByRole('link', { name: 'View Ledger' });
    expect(slot.compareDocumentPosition(ledger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no axe violations', async () => {
    myMoneyBackend();
    const { container } = renderFed();

    await screen.findByText('₱8,450.00');
    await expectNoAxeViolations(container);
  });
});

describe('the Transfer button (D-46, D-47; plan 10-15)', () => {
  it('is a secondary small arrow-right "Transfer" before the slot actions and View Ledger', () => {
    renderWith(queryOf({ data: moneyOf(8450) }), <button type="button">Slot action</button>);

    const transfer = screen.getByRole('button', { name: 'Transfer' });
    expect(transfer.className).toContain('h-9');
    expect(transfer.querySelector('svg.lucide-arrow-right')).not.toBeNull();
    const slot = screen.getByRole('button', { name: 'Slot action' });
    const ledger = screen.getByRole('link', { name: 'View Ledger' });
    expect(transfer.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.compareDocumentPosition(ledger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the Transfer Money window', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    renderFed();

    await screen.findByText('₱8,450.00');
    await userEvent.click(screen.getByRole('button', { name: 'Transfer' }));

    expect(await screen.findByRole('dialog', { name: 'Transfer Money' })).toBeVisible();
  });
});

describe('Transfer with nothing to send (D-14, P8 D-14 pattern)', () => {
  it.each([
    ['₱0.00', 0],
    ['−₱500.00', -500],
  ])(
    'with %s the button is aria-disabled, still focusable, and tied to its visible reason',
    async (_figure, balance) => {
      renderWith(queryOf({ data: moneyOf(balance) }));

      const transfer = screen.getByRole('button', { name: 'Transfer' });
      expect(transfer).toHaveAttribute('aria-disabled', 'true');
      expect(transfer).not.toBeDisabled();
      transfer.focus();
      expect(transfer).toHaveFocus();
      const reason = screen.getByText('Nothing on hand to transfer.');
      expect(reason).toBeVisible();
      expect(transfer).toHaveAttribute('aria-describedby', reason.id);
      expect(reason.id).not.toBe('');
    },
  );

  it('does not open the window when it is pressed', async () => {
    renderWith(queryOf({ data: moneyOf(0) }));

    await userEvent.click(screen.getByRole('button', { name: 'Transfer' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is never hidden: View Ledger and the slot actions stay beside it', () => {
    renderWith(queryOf({ data: moneyOf(0) }), <button type="button">Slot action</button>);

    expect(screen.getByRole('button', { name: 'Transfer' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'View Ledger' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Slot action' })).toBeVisible();
  });

  it('is enabled with money on hand, and shows no reason', () => {
    renderWith(queryOf({ data: moneyOf(0.01) }));

    expect(screen.getByRole('button', { name: 'Transfer' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Nothing on hand to transfer.')).toBeNull();
  });

  it('is aria-disabled while the figure loads, with no reason line', () => {
    renderWith(queryOf());

    const transfer = screen.getByRole('button', { name: 'Transfer' });
    expect(transfer).toHaveAttribute('aria-disabled', 'true');
    expect(transfer).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Nothing on hand to transfer.')).toBeNull();
  });

  it('is aria-disabled when the figure could not load, with no reason line', () => {
    renderWith(queryOf({ isError: true, error: new Error('x') }));

    const transfer = screen.getByRole('button', { name: 'Transfer' });
    expect(transfer).toHaveAttribute('aria-disabled', 'true');
    expect(transfer).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Nothing on hand to transfer.')).toBeNull();
  });

  it('has no axe violations with the reason shown', async () => {
    const { container } = renderWith(queryOf({ data: moneyOf(0) }));

    await expectNoAxeViolations(container);
  });
});

describe('loading (UI-SPEC D1 MoneyStrip, Loading)', () => {
  it('announces "Loading your money on hand…" and shows the 160 x 28 figure skeleton while View Ledger still works', async () => {
    myMoneyBackend(async () => {
      await delay(300);
      return myMoneyFixture();
    });
    const { container } = renderFed();

    expect(screen.getByText('Loading your money on hand…')).toBeInTheDocument();
    const skeleton = Array.from(container.querySelectorAll<HTMLElement>('span')).find(
      (element) => element.style.getPropertyValue('--sk-w') === '160px',
    );
    expect(skeleton?.style.getPropertyValue('--sk-h')).toBe('28px');
    expect(screen.getByRole('link', { name: 'View Ledger' })).toHaveAttribute('href', '/admin/money');
    expect(await screen.findByText('₱8,450.00')).toBeVisible();
    expect(screen.getByText('Your money on hand loaded.')).toBeInTheDocument();
  });

  it('marks the busy strip aria-busy and shows no figure before the answer', () => {
    const { container } = renderWith(queryOf());

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(/₱/)).toBeNull();
  });
});

describe('failure (UI-SPEC D1 MoneyStrip, Error)', () => {
  it('says "Couldn\'t load your money on hand." with a ghost small Try Again, and View Ledger still works', () => {
    renderWith(queryOf({ isError: true, error: new Error('x') }));

    expect(screen.getByText("Couldn't load your money on hand.")).toBeVisible();
    const retry = screen.getByRole('button', { name: 'Try Again' });
    expect(retry.className).toContain('h-9');
    expect(retry.className).toContain('bg-transparent');
    expect(screen.getByRole('link', { name: 'View Ledger' })).toHaveAttribute('href', '/admin/money');
    expect(screen.queryByText(/₱/)).toBeNull();
  });

  it('announces the failure as an alert', () => {
    renderWith(queryOf({ isError: true, error: new Error('x') }));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your money on hand.");
  });

  it('asks the server again when Try Again is pressed', async () => {
    const refetch = vi.fn();
    renderWith(queryOf({ isError: true, error: new Error('x'), refetch }));

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('recovers: a failed read then Try Again shows the figure', async () => {
    let calls = 0;
    myMoneyBackend(() => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : myMoneyFixture({ balance: 120 });
    });
    renderFed();

    expect(await screen.findByText("Couldn't load your money on hand.")).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('₱120.00')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText("Couldn't load your money on hand.")).toBeNull();
    });
  });

  it('keeps one status: silent on the failure, "Loading your money on hand…" during Try Again, then "Your money on hand loaded."', async () => {
    let answered = 0;
    myMoneyBackend(async () => {
      answered += 1;
      if (answered === 1) return problemResponse(500);
      await delay(300);
      return myMoneyFixture({ balance: 120 });
    });
    renderFed();
    await screen.findByText("Couldn't load your money on hand.");
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Loading your money on hand…');
    });
    expect(status.previousElementSibling).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('₱120.00')).toBeVisible();
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Your money on hand loaded.');
    expect(status.previousElementSibling).not.toHaveAttribute('aria-busy');
  });

  it('keeps one status when a later read fails over a good figure: "Loading your money on hand…" during Try Again, then "Your money on hand loaded."', async () => {
    let answered = 0;
    myMoneyBackend(async () => {
      answered += 1;
      if (answered === 1) return myMoneyFixture({ balance: 8450 });
      if (answered === 2) return problemResponse(500);
      await delay(300);
      return myMoneyFixture({ balance: 120 });
    });
    renderFed();
    await screen.findByText('₱8,450.00');
    const status = screen.getByRole('status');
    await act(() => queryClient.invalidateQueries({ queryKey: myMoneyKey }));
    await screen.findByText("Couldn't load your money on hand.");

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(status).toHaveTextContent('Loading your money on hand…');
    });
    expect(status.previousElementSibling).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('₱120.00')).toBeVisible();
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Your money on hand loaded.');
    expect(status.previousElementSibling).not.toHaveAttribute('aria-busy');
  });

  it('shows the failure, not a figure, when the server sends a balance the browser cannot read', async () => {
    myMoneyBackend(myMoneyFixture({ balance: 'lots' }));
    renderFed();

    expect(await screen.findByText("Couldn't load your money on hand.")).toBeVisible();
    expect(screen.queryByText(/₱/)).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderWith(queryOf({ isError: true, error: new Error('x') }));

    await expectNoAxeViolations(container);
  });
});

describe('the figure as given (no arithmetic in the strip)', () => {
  it('writes the balance the query holds, unchanged', () => {
    renderWith(queryOf({ data: moneyOf(1234.5) }));

    expect(screen.getByText('₱1,234.50')).toBeVisible();
  });

  it.each([
    [0.1, '₱0.10'],
    [1234.5, '₱1,234.50'],
    [-0.5, '−₱0.50'],
    [9999999.99, '₱9,999,999.99'],
  ])('writes %s as %s and nothing else', (balance, text) => {
    renderWith(queryOf({ data: moneyOf(balance) }));

    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getAllByText(/₱/)).toHaveLength(1);
  });
});

// jsdom evaluates no container query, so the phone rules are pinned as classes here and as generated CSS in money.recipe.node.test.ts.
describe('very large figures and phones (UI-SPEC overflow rows, D-46)', () => {
  it('keeps a 9,999,999.99 figure on one line', () => {
    renderWith(queryOf({ data: moneyOf(9999999.99) }));

    expect(screen.getByText('₱9,999,999.99').className.split(' ')).toContain('whitespace-nowrap');
  });

  it('lets the button row wrap under the figure on phones and share the row equally', () => {
    renderWith(queryOf({ data: moneyOf(9999999.99) }), <button type="button">Slot action</button>);

    const row = screen.getByRole('link', { name: 'View Ledger' }).parentElement;
    const classes = row?.className.split(' ') ?? [];
    expect(classes).toEqual(expect.arrayContaining(['flex-wrap', 'pg-phone:w-full', 'pg-phone:*:flex-1']));
    expect(row).toContainElement(screen.getByRole('button', { name: 'Slot action' }));
  });

  it('wraps the whole strip, so the buttons can drop to their own row', () => {
    const { container } = renderWith(queryOf({ data: moneyOf(8450) }));

    expect(container.querySelector('section')?.className.split(' ')).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'min-w-0']),
    );
  });

  it('hides the wallet tile at 767px and below and stacks the label over the figure', () => {
    const { container } = renderWith(queryOf({ data: moneyOf(8450) }));

    const tile = container.querySelector('svg.lucide-wallet')?.parentElement;
    expect(tile?.className.split(' ')).toContain('pg-phone:hidden');
    const body = screen.getByText('Your money on hand').parentElement;
    expect(body?.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-col', 'min-w-0']));
  });
});
