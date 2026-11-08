import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { dashboardSummaryFixture } from '@/test/dashboardFixtures';
import {
  createTransferBackend,
  LIZA_ID,
  myMoneyBackend,
  myMoneyFixture,
  transferRecipientsBackend,
  transferSavedFixture,
} from '@/test/moneyFixtures';
import { expectNoAxeViolations } from '@/test/axe';

// T1 Transfer window (D-47, D-14, D-56, MONEY-04, SEC-06; plan 10-15), opened from the dashboard strip.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

/** The strip fed by the real money hook, as the dashboard has it, with the toast layer the window raises its toast in. */
function Fed() {
  const query = useMyMoneyQuery();
  return <MoneyStrip query={query} />;
}

function renderStrip() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Fed />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const toBox = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^To/ });
const amountBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Amount/ });
const dateBox = () => screen.getByLabelText<HTMLInputElement>(/^Date/);
const noteBox = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^Note/ });
const recordButton = () => screen.getByRole('button', { name: /^(Record Transfer|Saving)$/ });

/** Waits for the strip's figure, presses Transfer and waits for the window. */
async function openWindow(user: UserEvent, figure = '₱8,450.00') {
  await screen.findByText(figure);
  await user.click(screen.getByRole('button', { name: 'Transfer' }));
  return screen.findByRole('dialog', { name: 'Transfer Money' });
}

async function recipientsReady() {
  await waitFor(() => {
    expect(toBox()).toBeEnabled();
  });
}

describe('the window from the strip (D-47, D-56)', () => {
  it('opens "Transfer Money" with the sender and the balance in the description and the cursor on To', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', balance: 8450 }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();

    const dialog = await openWindow(user);

    expect(within(dialog).getByText('From Carmen Reyes (you). You have ₱8,450.00 on hand.')).toBeVisible();
    await recipientsReady();
    await waitFor(() => {
      expect(toBox()).toHaveFocus();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Record Transfer' })).toBeVisible();
  });

  it('lists the coworkers by name, then the owed leavers as (inactive) or (former staff), and never the sender', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    expect(Array.from(toBox().options, (option) => option.text)).toEqual([
      'Choose a coworker',
      'Liza Mercado',
      'Paolo Garcia',
      'Jomar Santos (inactive)',
      'Ana Villanueva (former staff)',
    ]);
  });

  it('starts with the business today in Date, from the server and not the device clock', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', today: '2026-11-04' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    expect(dateBox()).toHaveValue('2026-11-04');
    expect(amountBox()).toHaveValue('');
    expect(noteBox()).toHaveValue('');
  });

  it('has no axe violations while open', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await expectNoAxeViolations(document.body);
  });
});

describe('recording a transfer (D-47, SEC-06)', () => {
  it('sends the four fields with one Idempotency-Key, closes, returns the cursor to Transfer and says the new balance', async () => {
    let balance = 8450;
    const mine = myMoneyBackend(() => myMoneyFixture({ name: 'Carmen Reyes', balance }));
    transferRecipientsBackend();
    const sent = createTransferBackend(() => {
      balance = 6450;
      return Response.json(transferSavedFixture({ senderBalance: 6450 }), { status: 201 });
    });
    queryClient.setQueryData(dashboardSummaryKey, dashboardSummaryFixture());
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '2000');
    await user.click(recordButton());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(sent.bodies).toEqual([{ toUserId: LIZA_ID, amount: '2000.00', transferDate: '2026-11-04', note: null }]);
    expect(sent.keys).toHaveLength(1);
    expect(sent.keys[0]).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Transfer' })).toHaveFocus();
    });
    expect(await screen.findByText('Transfer recorded')).toBeVisible();
    expect(screen.getByText('You now have ₱6,450.00 on hand.')).toBeVisible();
    // The money is read again (the strip shows the new figure) and the dashboard is marked for a new read (D-13).
    expect(await screen.findByText('₱6,450.00')).toBeVisible();
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(queryClient.getQueryState(dashboardSummaryKey)?.isInvalidated).toBe(true);
  });

  it('sends no sender, balance or stamp: the body is toUserId, amount, transferDate and note only', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await user.selectOptions(toBox(), 'Paolo Garcia');
    await user.type(amountBox(), '12.5');
    await user.type(noteBox(), 'Cash for the fabric run');
    await user.click(recordButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    const body = sent.bodies[0];
    expect(Object.keys(body as object).sort()).toEqual(['amount', 'note', 'toUserId', 'transferDate']);
    expect(body).toMatchObject({ amount: '12.50', note: 'Cash for the fabric run' });
  });
});
