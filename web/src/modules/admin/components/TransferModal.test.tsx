import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { MoneyStrip } from '@/modules/admin/components/MoneyStrip';
import { dashboardSummaryKey } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { dashboardSummaryFixture } from '@/test/dashboardFixtures';
import { problemResponse } from '@/test/expenseFixtures';
import { buildOrderList, useOrderHandlers } from '@/test/orderFixtures';
import {
  createTransferBackend,
  LIZA_ID,
  myMoneyBackend,
  myMoneyFixture,
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
  it('disables To with "Loading staff…" while the list loads', async () => {
    myMoneyBackend(myMoneyFixture({ name: 'Carmen Reyes' }));
    transferRecipientsBackend(async () => {
      await delay(300);
      return transferRecipientsFixture();
    });
    const user = userEvent.setup();
    renderStrip();
    await openWindow(user);

    expect(toBox()).toBeDisabled();
    expect(within(toBox()).getByRole('option', { name: 'Loading staff…' })).toBeInTheDocument();
    await recipientsReady();
    expect(within(toBox()).getByRole('option', { name: 'Choose a coworker' })).toBeInTheDocument();
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

    expect(await screen.findByText('Something changed at the same time. Try again.')).toBeVisible();
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
