import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { toastEdgeToneClasses } from '@/components/feedback/feedback.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { TransferModal, type HandoverLeaver } from '@/modules/admin/components/TransferModal';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { myMoneyKey, useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';
import { dashboardSummaryFixture } from '@/test/dashboardFixtures';
import { problemResponse } from '@/test/expenseFixtures';
import { buildOrderList, useOrderHandlers } from '@/test/orderFixtures';
import {
  ANA_ID,
  createHandoverBackend,
  createTransferBackend,
  handoverSavedFixture,
  JOMAR_ID,
  LIZA_ID,
  MY_MONEY_USER_ID,
  myMoneyBackend,
  myMoneyFixture,
  staffBalancesBackend,
  staffBalancesFixture,
  transferBusyProblem,
  transferFieldProblem,
  transferRecipientsBackend,
  transferRecipientsFixture,
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
    expect(toBox()).not.toHaveAttribute('aria-disabled');
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

  it('shows no error under Amount just because the window opened: the cursor moving to To is not leaving Amount', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await waitFor(() => {
      expect(toBox()).toHaveFocus();
    });

    // Let any check started by the move finish before looking.
    await delay(50);
    expect(screen.queryByText('Enter the amount.')).toBeNull();
    expect(screen.getByText('You have ₱8,450.00 on hand.')).toBeVisible();
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

  it('asks the server for the business today when no answer holds it, and shows a skeleton until it arrives', async () => {
    // A money answer whose day is not a real date is not trusted, so the window asks (never the device clock).
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', today: 'soon' }));
    transferRecipientsBackend();
    const asked = useOrderHandlers({
      list: async () => {
        await delay(200);
        return buildOrderList([], { today: '2026-11-04' });
      },
    });
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);

    expect(within(dialog).queryByRole('button', { name: 'Record Transfer' })).toBeNull();
    await waitFor(() => {
      expect(dateBox()).toHaveValue('2026-11-04');
    });
    expect(asked.lists).toHaveLength(1);
  });

  it('draws the skeleton in a busy region that says "Loading staff…" while the business today is unknown (UI-21)', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', today: 'soon' }));
    transferRecipientsBackend();
    useOrderHandlers({
      list: async () => {
        await delay(300);
        return buildOrderList([], { today: '2026-11-04' });
      },
    });
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);

    const status = within(dialog).getByRole('status');
    expect(status).toHaveTextContent('Loading staff…');
    expect(status.previousElementSibling).toHaveAttribute('aria-busy', 'true');
    await expectNoAxeViolations(dialog);
    await waitFor(() => {
      expect(dateBox()).toHaveValue('2026-11-04');
    });
  });

  it("reads the balance afresh when the window opens: the description and the cap use it, not the strip's older figure (wave 7 WR-04)", async () => {
    let reads = 0;
    myMoneyBackend(() => {
      reads += 1;
      return myMoneyFixture({ name: 'Carmen Reyes', balance: reads === 1 ? 8450 : 3200 });
    });
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);
    await recipientsReady();

    expect(await within(dialog).findByText('From Carmen Reyes (you). You have ₱3,200.00 on hand.')).toBeVisible();
    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '5000');
    await user.click(recordButton());

    expect(await screen.findByText('You only have ₱3,200.00 on hand.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
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

describe('the Date follows a newer business day (wave 7 IN-08, WR-05)', () => {
  beforeEach(() => {
    clearSession();
    acceptSession(sessionResponse());
    // A money answer held from before midnight: the window opens on its day, and its own read then brings the new one.
    queryClient.setQueryData(myMoneyKey, {
      userId: MY_MONEY_USER_ID,
      name: 'Carmen Reyes',
      balance: 8450,
      today: '2026-11-07',
    });
  });

  afterEach(() => {
    clearSession();
  });

  function renderWindow() {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <TransferModal mode="transfer" onClose={() => undefined} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('moves an untouched Date to the newer day the window own read brings', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', balance: 8450, today: '2026-11-08' }));
    transferRecipientsBackend();
    staffBalancesBackend();
    renderWindow();

    expect(await screen.findByRole('dialog', { name: 'Transfer Money' })).toBeVisible();
    expect(dateBox()).toHaveValue('2026-11-07');

    await waitFor(() => {
      expect(dateBox()).toHaveValue('2026-11-08');
    });
  });

  it('keeps a date the person set when a newer day arrives', async () => {
    myMoneyBackend(async () => {
      await delay(150);
      return myMoneyFixture({ name: 'Carmen Reyes', balance: 8450, today: '2026-11-08' });
    });
    transferRecipientsBackend();
    staffBalancesBackend();
    renderWindow();
    await screen.findByRole('dialog', { name: 'Transfer Money' });

    fireEvent.change(dateBox(), { target: { value: '2026-11-05' } });
    await delay(300);

    expect(dateBox()).toHaveValue('2026-11-05');
  });

  it('is not left dirty by the move: closing a window the person has not typed in asks nothing', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', balance: 8450, today: '2026-11-08' }));
    transferRecipientsBackend();
    staffBalancesBackend();
    const user = userEvent.setup();
    renderWindow();
    await waitFor(() => {
      expect(dateBox()).toHaveValue('2026-11-08');
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/discard/i)).toBeNull();
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

describe('the rules, checked before any request (OR-3, D-14)', () => {
  it('shows the To and Amount lines for an empty window and sends nothing', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await user.click(recordButton());

    expect(await screen.findByText('Choose who got the cash.')).toBeVisible();
    expect(screen.getByText('Enter the amount.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
    expect(toBox()).toHaveFocus();
  });

  it('shows the Date line when the day is cleared', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    fireEvent.change(dateBox(), { target: { value: '' } });
    await user.click(recordButton());

    expect(await screen.findByText('Enter the transfer date.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('refuses an amount above the balance read when the window opened, with the server words, and sends nothing', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', balance: 3200 }));
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user, '₱3,200.00');
    await recipientsReady();

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '3200.01');
    await user.click(recordButton());

    expect(await screen.findByText('You only have ₱3,200.00 on hand.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses a date after the business today and a note over 200 characters', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes', today: '2026-11-04' }));
    transferRecipientsBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '10');
    fireEvent.change(dateBox(), { target: { value: '2026-11-05' } });
    fireEvent.change(noteBox(), { target: { value: 'a'.repeat(201) } });
    await user.click(recordButton());

    expect(await screen.findByText("The transfer date can't be in the future.")).toBeVisible();
    expect(screen.getByText('Keep the note to 200 characters or fewer.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('limits the note box to 200 characters and says so in the hint', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    expect(noteBox()).toHaveAttribute('maxlength', '200');
    expect(screen.getByText('Optional. Up to 200 characters.')).toBeVisible();
    expect(noteBox()).toHaveAttribute('placeholder', 'e.g. Cash for the fabric run');
  });
});

describe('the people (D-56, D-49)', () => {
  it('marks To unavailable with "Loading staff…" while the list loads, yet keeps it able to take the cursor (wave 9 IN-01)', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend(async () => {
      await delay(300);
      return transferRecipientsFixture();
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    expect(toBox()).toHaveAttribute('aria-disabled', 'true');
    expect(toBox()).toBeEnabled();
    expect(within(toBox()).getByRole('option', { name: 'Loading staff…' })).toBeInTheDocument();
    await recipientsReady();
    expect(toBox()).not.toHaveAttribute('aria-disabled');
    expect(within(toBox()).getByRole('option', { name: 'Choose a coworker' })).toBeInTheDocument();
  });

  it('puts the cursor on To as the window opens, while the people still load, so Amount is never left (wave 9 IN-01)', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend(async () => {
      await delay(300);
      return transferRecipientsFixture();
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    // Before the people arrive: the window's own first focus is on To, not on Amount.
    expect(toBox()).toHaveFocus();
    await recipientsReady();
    await delay(50);
    expect(toBox()).toHaveFocus();
    expect(screen.queryByText('Enter the amount.')).toBeNull();
  });

  it('shows no figure for anyone in the list', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    for (const option of Array.from(toBox().options)) {
      expect(option.text).not.toContain('₱');
    }
  });

  it('says the staff list could not load and keeps To disabled', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend(() => problemResponse(500));
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    expect(await screen.findByText("Couldn't load the staff list. Close this form and try again.")).toBeVisible();
    expect(toBox()).toBeDisabled();
  });

  it('wraps a very long name inside the window text instead of widening it', async () => {
    const longName = 'Maria Cristina Dela Cruz-Villanueva de los Santos y Fernandez-Montenegro';
    myMoneyBackend(myMoneyFixture({ name: longName }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);

    const description = within(dialog).getByText(new RegExp(`^From ${longName}`));
    expect(description.parentElement?.className).toContain('wrap-anywhere');
  });
});

describe('what the server refuses (D-14, D-56, SEC-06)', () => {
  async function fill(user: UserEvent, amount: string, person = 'Liza Mercado') {
    await user.selectOptions(toBox(), person);
    await user.type(amountBox(), amount);
  }

  it('puts the balance refusal under Amount, reads the balance again, keeps what was typed and gives the corrected body a new key', async () => {
    let balance = 8450;
    myMoneyBackend(() => myMoneyFixture({ name: 'Carmen Reyes', balance }));
    transferRecipientsBackend();
    let answers = 0;
    const sent = createTransferBackend(() => {
      answers += 1;
      if (answers === 1) {
        balance = 3200;
        return transferFieldProblem('amount', 'You only have ₱3,200.00 on hand.');
      }
      return Response.json(transferSavedFixture({ senderBalance: 200 }), { status: 201 });
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '5000');

    await user.click(recordButton());

    expect(await screen.findByText('You only have ₱3,200.00 on hand.')).toBeVisible();
    expect(amountBox()).toHaveValue('5000.00');
    expect(toBox()).toHaveValue(LIZA_ID);
    // The balance is read again: the description follows it at once, and the Amount hint (hidden under the error) follows too.
    expect(await screen.findByText('From Carmen Reyes (you). You have ₱3,200.00 on hand.')).toBeVisible();

    await user.clear(amountBox());
    await user.type(amountBox(), '3000');
    await user.click(recordButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(2);
    });
    expect(sent.keys[1]).toBeTruthy();
    expect(sent.keys[1]).not.toBe(sent.keys[0]);
    expect(sent.bodies[1]).toMatchObject({ amount: '3000.00' });
  });

  it('puts a recipient refusal under To and reads the people again', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    const people = transferRecipientsBackend();
    createTransferBackend(() =>
      transferFieldProblem('toUserId', "Liza Mercado can't receive transfers now. Choose someone else."),
    );
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');
    expect(people).toHaveLength(1);

    await user.click(recordButton());

    expect(await screen.findByText("Liza Mercado can't receive transfers now. Choose someone else.")).toBeVisible();
    await waitFor(() => {
      expect(people).toHaveLength(2);
    });
    expect(amountBox()).toHaveValue('100.00');
  });

  it('clears To when the people read again no longer hold the chosen person, so the hidden id is never sent (wave 7 WR-02)', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    let reads = 0;
    const people = transferRecipientsBackend(() => {
      reads += 1;
      return reads === 1
        ? transferRecipientsFixture()
        : transferRecipientsFixture().filter((person) => person.id !== LIZA_ID);
    });
    const sent = createTransferBackend(() =>
      transferFieldProblem('toUserId', "Liza Mercado can't receive transfers now. Choose someone else."),
    );
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');

    await user.click(recordButton());
    expect(await screen.findByText("Liza Mercado can't receive transfers now. Choose someone else.")).toBeVisible();
    await waitFor(() => {
      expect(people).toHaveLength(2);
    });
    await waitFor(() => {
      expect(toBox()).toHaveValue('');
    });
    expect(within(toBox()).queryByRole('option', { name: 'Liza Mercado' })).toBeNull();

    await user.click(recordButton());

    expect(await screen.findByText('Choose who got the cash.')).toBeVisible();
    expect(sent.bodies).toHaveLength(1);
  });

  it('shows the server line for a busy answer as a danger toast and keeps the window and the typed values', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    createTransferBackend(() => transferBusyProblem());
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');

    await user.click(recordButton());

    const line = await screen.findByText('Something changed at the same time. Try again.');
    expect(line).toBeVisible();
    // The toast carries the danger tone (the colored edge), not the success one (wave 7 WR-04).
    const toast = line.parentElement?.parentElement;
    expect(toast).toHaveClass(toastEdgeToneClasses.danger);
    expect(toast).not.toHaveClass(toastEdgeToneClasses.success);
    expect(screen.getByRole('dialog', { name: 'Transfer Money' })).toBeVisible();
    expect(amountBox()).toHaveValue('100.00');
  });

  it('keeps one Idempotency-Key when the same transfer is sent again after a server failure', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    let calls = 0;
    const sent = createTransferBackend(() => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : Response.json(transferSavedFixture(), { status: 201 });
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');

    await user.click(recordButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await user.click(recordButton());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(sent.keys).toHaveLength(2);
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });

  it('reads the money again after a server failure that may have saved, so the strip shows the new figure (wave 7 WR-03)', async () => {
    let balance = 8450;
    const mine = myMoneyBackend(() => myMoneyFixture({ name: 'Carmen Reyes', balance }));
    transferRecipientsBackend();
    createTransferBackend(() => {
      // The server saved the transfer but the answer was lost on the way.
      balance = 6450;
      return problemResponse(500);
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '2000');
    const readsBefore = mine.length;

    await user.click(recordButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    await waitFor(() => {
      expect(mine.length).toBeGreaterThan(readsBefore);
    });
    expect(await screen.findByText('₱6,450.00')).toBeVisible();
  });

  it('does not read the money again after a refusal that saved nothing', async () => {
    const mine = myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    createTransferBackend(() =>
      transferFieldProblem('toUserId', "Liza Mercado can't receive transfers now. Choose someone else."),
    );
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');
    const readsBefore = mine.length;

    await user.click(recordButton());

    expect(await screen.findByText("Liza Mercado can't receive transfers now. Choose someone else.")).toBeVisible();
    expect(mine.length).toBe(readsBefore);
  });

  it('keeps one Idempotency-Key when the same transfer is sent again after a busy answer (wave 7 WR-04)', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    let calls = 0;
    const sent = createTransferBackend(() => {
      calls += 1;
      return calls === 1 ? transferBusyProblem() : Response.json(transferSavedFixture(), { status: 201 });
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');

    await user.click(recordButton());
    expect(await screen.findByText('Something changed at the same time. Try again.')).toBeVisible();
    await user.click(recordButton());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(sent.keys).toHaveLength(2);
    expect(sent.keys[0]).toBeTruthy();
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });

  it('shows "Saving" with aria-busy while the request runs and ignores Esc and the scrim until it ends', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    createTransferBackend(async () => {
      await delay(400);
      return Response.json(transferSavedFixture(), { status: 201 });
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await fill(user, '100');

    await user.click(recordButton());
    await waitFor(() => {
      expect(recordButton()).toHaveTextContent('Saving');
    });
    expect(recordButton()).toHaveAttribute('aria-busy', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Transfer Money' })).toBeVisible();
    // A full press and click on the scrim closes nothing while the save runs, and no "Discard changes?" is asked (wave 7 WR-04).
    const scrim = screen.getByRole('dialog', { name: 'Transfer Money' }).parentElement;
    if (scrim === null) throw new Error('The window has no scrim.');
    fireEvent.mouseDown(scrim);
    fireEvent.mouseUp(scrim);
    fireEvent.click(scrim);
    expect(screen.getByRole('dialog', { name: 'Transfer Money' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('closing (08 D-58)', () => {
  it('closes a window nobody changed at once', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);
    await recipientsReady();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Transfer' })).toHaveFocus();
  });

  it('asks "Discard changes?" first when something was typed, and keeps it on Keep Editing', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);
    await recipientsReady();
    await user.type(amountBox(), '50');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(amountBox()).toHaveValue('50.00');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('starts clean when it is opened again', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const user = userEvent.setup();
    renderStrip();
    const dialog = await openWindow(user);
    await recipientsReady();
    await user.type(amountBox(), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Transfer' }));
    await screen.findByRole('dialog', { name: 'Transfer Money' });

    expect(amountBox()).toHaveValue('');
  });
});

// The Manager's owed-leaver cap (D-49, OR-3; plan 10-19): in transfer mode a Manager who picks a leaver who is owed money is checked in the
// browser against the staff balances read when the window opened. An Admin is never sent any figure and relies on the server's refusal.

describe('a Manager sending to a leaver who is owed money (D-49)', () => {
  beforeEach(() => {
    clearSession();
    acceptSession(sessionResponse());
  });

  afterEach(() => {
    clearSession();
  });

  it('reads the staff balances once when the window opens', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await waitFor(() => {
      expect(staff).toHaveLength(1);
    });
  });

  it('refuses more than Ana is owed in the browser: "Ana Villanueva is owed only ₱300.00. Enter that or less."', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await waitFor(() => {
      expect(staff).toHaveLength(1);
    });

    await user.selectOptions(toBox(), 'Ana Villanueva (former staff)');
    await user.type(amountBox(), '300.01');
    await user.click(recordButton());

    expect(await screen.findByText('Ana Villanueva is owed only ₱300.00. Enter that or less.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
    expect(amountBox()).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends exactly what Ana is owed', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await waitFor(() => {
      expect(staff).toHaveLength(1);
    });

    await user.selectOptions(toBox(), 'Ana Villanueva (former staff)');
    await user.type(amountBox(), '300');
    await user.click(recordButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toMatchObject({ toUserId: ANA_ID, amount: '300.00' });
  });

  it('does not cap a payment to an active coworker who happens to be owed money', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const sent = createTransferBackend();
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await waitFor(() => {
      expect(staff).toHaveLength(1);
    });

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '5000');
    await user.click(recordButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
  });

  it('leaves the cap to the server when the staff balances could not be read, and still sends', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend(() => problemResponse(500));
    const sent = createTransferBackend(() =>
      transferFieldProblem('amount', 'Ana Villanueva is owed only ₱300.00. Enter that or less.'),
    );
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();
    await waitFor(() => {
      expect(staff.length).toBeGreaterThanOrEqual(1);
    });

    await user.selectOptions(toBox(), 'Ana Villanueva (former staff)');
    await user.type(amountBox(), '900');
    await user.click(recordButton());

    expect(await screen.findByText('Ana Villanueva is owed only ₱300.00. Enter that or less.')).toBeVisible();
    expect(sent.bodies).toHaveLength(1);
  });
});

describe('an Admin sending to a leaver who is owed money (D-49, OD-19)', () => {
  const ADMIN_USER = {
    id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
    email: 'lito@example.ph',
    firstName: 'Lito',
    lastName: 'Santos',
    role: 'Admin',
  };

  beforeEach(() => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
  });

  afterEach(() => {
    clearSession();
  });

  it('is never sent the staff balances: no request is made, and the same choice goes to the server, whose Admin line shows', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Lito Santos' }));
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const sent = createTransferBackend(() =>
      transferFieldProblem('amount', "That's more than Ana Villanueva is owed. Ask a Manager for the amount."),
    );
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);
    await recipientsReady();

    await user.selectOptions(toBox(), 'Ana Villanueva (former staff)');
    await user.type(amountBox(), '300.01');
    await user.click(recordButton());

    expect(
      await screen.findByText("That's more than Ana Villanueva is owed. Ask a Manager for the amount."),
    ).toBeVisible();
    expect(sent.bodies).toHaveLength(1);
    expect(staff).toHaveLength(0);
    // The owed figure never reaches an Admin's DOM, in the window or behind it.
    expect(document.body).not.toHaveTextContent('300.00');
  });
});

// The hand-over mode (D-17, D-18, D-45, D-56, OR-3; plan 10-19): a Manager moves money held by a person who left to an active coworker.

describe('the hand-over mode (D-17, D-18)', () => {
  const JOMAR_LEAVER: HandoverLeaver = {
    userId: JOMAR_ID,
    name: 'Jomar Santos',
    status: 'deactivated',
    balance: 2000,
  };
  const ANA_LEAVER: HandoverLeaver = { userId: ANA_ID, name: 'Ana Villanueva', status: 'deleted', balance: 750 };

  beforeEach(() => {
    clearSession();
    acceptSession(sessionResponse());
    // A held money answer carries the business today, as it does on My Money where the window is opened.
    queryClient.setQueryData(myMoneyKey, {
      userId: MY_MONEY_USER_ID,
      name: 'Carmen Reyes',
      balance: 8450,
      today: '2026-11-04',
    });
  });

  afterEach(() => {
    clearSession();
  });

  function HandoverHost({ leaver }: { leaver: HandoverLeaver }) {
    const [open, setOpen] = useState(true);
    return (
      <TransferModal
        mode="handover"
        leaver={leaver}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    );
  }

  function renderHandover(leaver: HandoverLeaver = JOMAR_LEAVER) {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <HandoverHost leaver={leaver} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  const handoverButton = () => screen.getByRole('button', { name: /^(Record Handover|Saving)$/ });

  it('opens "Hand Over Money" from the leaver, with what they hold, and asks for no figure of the Manager', async () => {
    const mine = myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover();

    const dialog = await screen.findByRole('dialog', { name: 'Hand Over Money' });
    expect(within(dialog).getByText('From Jomar Santos (deactivated). They hold ₱2,000.00.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(handoverButton()).toHaveTextContent('Record Handover');
    await recipientsReady();
    expect(mine).toHaveLength(0);
  });

  it('puts the cursor on To as the window opens, while the people still load, so Amount is never left (wave 9 IN-01)', async () => {
    myMoneyBackend();
    transferRecipientsBackend(async () => {
      await delay(300);
      return transferRecipientsFixture();
    });
    staffBalancesBackend();
    renderHandover();
    await screen.findByRole('dialog', { name: 'Hand Over Money' });

    // Before the people arrive: the window's own first focus is on To, not on Amount.
    expect(toBox()).toHaveFocus();
    await recipientsReady();
    await delay(50);
    expect(toBox()).toHaveFocus();
    expect(screen.queryByText('Enter the amount.')).toBeNull();
  });

  it('says "(deleted)" for a deleted person', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover(ANA_LEAVER);

    expect(await screen.findByText('From Ana Villanueva (deleted). They hold ₱750.00.')).toBeVisible();
  });

  it('lists the signed-in Manager first as "{name} (you)", then the other active staff, and never a leaver; nothing is chosen', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover();
    await recipientsReady();

    expect(Array.from(toBox().options, (option) => option.text)).toEqual([
      'Choose a coworker',
      'Carmen Reyes (you)',
      'Liza Mercado',
      'Paolo Garcia',
    ]);
    expect(toBox()).toHaveValue('');
  });

  it('puts the cursor on To, shows "{name} holds {₱2,000.00}." under Amount and the recorded-by note', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover();
    await recipientsReady();

    await waitFor(() => {
      expect(toBox()).toHaveFocus();
    });
    await delay(50);
    expect(screen.queryByText('Enter the amount.')).toBeNull();
    expect(screen.getByText('Jomar Santos holds ₱2,000.00.')).toBeVisible();
    expect(
      screen.getByText('This is recorded as a transfer from Jomar Santos, with you as the one who recorded it.'),
    ).toBeVisible();
    expect(dateBox()).toHaveValue('2026-11-04');
  });

  it('refuses more than the leaver holds in the browser: "{name} only has ₱2,000.00 on hand."', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    const sent = createHandoverBackend();
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '2000.01');
    await user.click(handoverButton());

    expect(await screen.findByText('Jomar Santos only has ₱2,000.00 on hand.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('shows the To and Amount lines for an empty window and sends nothing', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    const sent = createHandoverBackend();
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();

    await user.click(handoverButton());

    expect(await screen.findByText('Choose who got the cash.')).toBeVisible();
    expect(screen.getByText('Enter the amount.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('records the hand-over with the leaver as the sender, one Idempotency-Key, and says what the leaver now holds', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const sent = createHandoverBackend();
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();

    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '2000');
    await user.type(noteBox(), 'Final settlement');
    const readsBefore = staff.length;
    await user.click(handoverButton());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(sent.bodies).toEqual([
      {
        fromUserId: JOMAR_ID,
        toUserId: LIZA_ID,
        amount: '2000.00',
        transferDate: '2026-11-04',
        note: 'Final settlement',
      },
    ]);
    expect(sent.keys).toHaveLength(1);
    expect(sent.keys[0]).toBeTruthy();
    expect(await screen.findByText('Handover recorded')).toBeVisible();
    expect(screen.getByText('Jomar Santos now holds ₱0.00.')).toBeVisible();
    // The staff balances are read again, so the All Staff row follows the hand-over (D-13).
    await waitFor(() => {
      expect(staff.length).toBeGreaterThan(readsBefore);
    });
  });

  it("reads the leaver's balance afresh when the window opens: the description and the cap follow it", async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend(
      staffBalancesFixture({
        items: staffBalancesFixture().items.map((row) => (row.userId === JOMAR_ID ? { ...row, balance: 500 } : row)),
      }),
    );
    const sent = createHandoverBackend();
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();

    expect(await screen.findByText('From Jomar Santos (deactivated). They hold ₱500.00.')).toBeVisible();
    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '600');
    await user.click(handoverButton());

    expect(await screen.findByText('Jomar Santos only has ₱500.00 on hand.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('says there is nothing to hand over when the fresh read no longer lists the leaver', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend(
      staffBalancesFixture({ items: staffBalancesFixture().items.filter((row) => row.userId !== JOMAR_ID) }),
    );
    const sent = createHandoverBackend();
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();

    await screen.findByText('From Jomar Santos (deactivated). They hold ₱0.00.');
    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '10');
    await user.click(handoverButton());

    expect(await screen.findByText('Jomar Santos has nothing on hand to hand over.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it("puts the server's refusal under Amount, reads the balance again, keeps the typed values and gives the corrected body a new key", async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    let answers = 0;
    const sent = createHandoverBackend(() => {
      answers += 1;
      return answers === 1
        ? transferFieldProblem('amount', 'Jomar Santos only has ₱1,500.00 on hand.')
        : Response.json(handoverSavedFixture(), { status: 201 });
    });
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();
    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '2000');
    const readsBefore = staff.length;

    await user.click(handoverButton());

    expect(await screen.findByText('Jomar Santos only has ₱1,500.00 on hand.')).toBeVisible();
    expect(amountBox()).toHaveValue('2000.00');
    expect(toBox()).toHaveValue(LIZA_ID);
    await waitFor(() => {
      expect(staff.length).toBeGreaterThan(readsBefore);
    });
    await user.clear(amountBox());
    await user.type(amountBox(), '1500');
    await user.click(handoverButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(2);
    });
    expect(sent.keys[1]).not.toBe(sent.keys[0]);
  });

  it("shows the server's line for a sender who is active again as a banner and reads the staff balances again (wave 9 WR-02)", async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    const staff = staffBalancesBackend();
    const refusal = 'Only money held by former staff can be handed over.';
    const sent = createHandoverBackend(() => transferFieldProblem('fromUserId', refusal));
    const user = userEvent.setup();
    renderHandover();
    await recipientsReady();
    await user.selectOptions(toBox(), 'Liza Mercado');
    await user.type(amountBox(), '1000');
    const readsBefore = staff.length;

    await user.click(handoverButton());

    expect(await screen.findByText(refusal)).toBeVisible();
    expect(sent.bodies).toHaveLength(1);
    await waitFor(() => {
      expect(staff.length).toBeGreaterThan(readsBefore);
    });
    expect(amountBox()).toHaveValue('1000.00');
    expect(toBox()).toHaveValue(LIZA_ID);
  });

  it('asks "Discard changes?" before closing a window that was changed', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    const user = userEvent.setup();
    renderHandover();
    const dialog = await screen.findByRole('dialog', { name: 'Hand Over Money' });
    await recipientsReady();
    await user.type(amountBox(), '50');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  });

  it('wraps a very long leaver name inside the window text', async () => {
    const longName = 'Maria Cristina Dela Cruz-Villanueva de los Santos y Fernandez-Montenegro';
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover({ ...JOMAR_LEAVER, name: longName });

    const dialog = await screen.findByRole('dialog', { name: 'Hand Over Money' });
    const description = within(dialog).getByText(new RegExp(`^From ${longName}`));
    expect(description.parentElement?.className).toContain('wrap-anywhere');
  });

  it('has no axe violations while open', async () => {
    myMoneyBackend();
    transferRecipientsBackend();
    staffBalancesBackend();
    renderHandover();
    await recipientsReady();

    await expectNoAxeViolations(document.body);
  });
});
