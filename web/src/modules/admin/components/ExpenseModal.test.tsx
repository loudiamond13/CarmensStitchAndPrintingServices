import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoriesBackend,
  createExpenseBackend,
  EXPENSE_TODAY,
  expenseDetail,
  ME_ID,
  problemResponse,
  staffBackend,
  SUPPLIES,
} from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { ExpenseModal } from './ExpenseModal';

// E2 Expense modal, add mode (CEXP-02, CEXP-04, D-18; plan 06-12): the fields in UI-SPEC order, one save with one key.

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

function renderModal(handlers: { onClose?: () => void; onSaved?: (expense: unknown) => void } = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseModal mode="add" today={EXPENSE_TODAY} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

const date = () => screen.getByLabelText<HTMLInputElement>(/^Date/);
const category = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Category/ });
const description = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Description/ });
const amount = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Amount/ });
const paidBy = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /^Paid by/ });
const saveButton = () => screen.getByRole('button', { name: /^(Save Expense|Saving)$/ });

function backends() {
  categoriesBackend();
  staffBackend();
}

async function ready() {
  await waitFor(() => {
    expect(category()).toBeEnabled();
    expect(paidBy()).toBeEnabled();
  });
}

describe('E2 add mode', () => {
  it('opens as the "Add Expense" dialog with its description, today in Date with focus, and Cancel and Save Expense', async () => {
    backends();
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Add Expense' });
    expect(within(dialog).getByText('A general business cost, not tied to any order.')).toBeInTheDocument();
    expect(date()).toHaveValue(EXPENSE_TODAY);
    expect(date()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();
    expect(screen.getByText("Up to 30 days ahead is fine for a cost you'll pay soon.")).toBeInTheDocument();
    await ready();
  });

  it('starts with no category chosen, Paid by as the signed-in user, and empty Description, Amount and Notes', async () => {
    backends();
    renderModal();
    await ready();

    expect(category()).toHaveValue('');
    expect(paidBy()).toHaveValue(ME_ID);
    expect(description()).toHaveValue('');
    expect(amount()).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Notes/ })).toHaveValue('');
  });

  it('shows Recorded by as "{First Last} (you)" in plain text, not a field', async () => {
    backends();
    renderModal();
    await ready();

    const label = screen.getByText('Recorded by');
    expect(label.tagName).toBe('SPAN');
    const value = screen.getByText('Carmen Reyes (you)', { selector: 'span' });
    expect(value.closest('input, select, textarea')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Recorded by/ })).toBeNull();
  });

  it('sends one create with the date, category, description, amount as a number, the signed-in payer and null notes, then reports the saved expense', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await ready();

    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), 'Thread and needles');
    await user.type(amount(), '640');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.bodies).toEqual([
      {
        date: EXPENSE_TODAY,
        categoryId: SUPPLIES.id,
        description: 'Thread and needles',
        amount: 640,
        paidByUserId: ME_ID,
        notes: null,
      },
    ]);
    expect(sent.keys).toHaveLength(1);
    expect(sent.keys[0]).toMatch(/\S+/);
    expect(onSaved).toHaveBeenCalledWith(expenseDetail());
  });

  it('reads "Saving" while the request runs and sends nothing twice on a second press', async () => {
    backends();
    const sent = createExpenseBackend(async () => {
      await delay(80);
      return Response.json(expenseDetail(), { status: 201 });
    });
    const user = userEvent.setup();
    renderModal();
    await ready();
    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), 'Thread');
    await user.type(amount(), '12.50');

    await user.click(saveButton());
    expect(await screen.findByRole('button', { name: 'Saving' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Saving' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Saving' })).toBeNull();
    });
    expect(sent.bodies).toHaveLength(1);
  });
});

const PROBLEM = { 'Content-Type': 'application/problem+json' };

function problem(status: number, body: Record<string, unknown> = {}): Response {
  return Response.json({ title: 'x', status, ...body }, { status, headers: PROBLEM });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(category(), 'Supplies');
  await user.type(description(), 'Thread and needles');
  await user.type(amount(), '640');
}

describe('E2 checks before sending (OR-3)', () => {
  it('shows every required message at once, sends nothing, keeps Save Expense enabled and focuses Category', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.click(saveButton());

    expect(await screen.findByText('Choose a category.')).toBeInTheDocument();
    expect(screen.getByText('Add a short description so others know what this was for.')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount greater than ₱0.00.')).toBeInTheDocument();
    expect(category()).toHaveAttribute('aria-invalid', 'true');
    expect(category()).toHaveFocus();
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(sent.bodies).toHaveLength(0);
  });

  it('refuses a date after today plus 30 days with the latest day named, before any request', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    renderModal();
    await ready();
    await fillValid(user);
    fireEvent.change(date(), { target: { value: '2026-11-25' } });

    await user.click(saveButton());

    expect(
      await screen.findByText('Choose a date up to 30 days from today, Nov 24, 2026 at the latest.'),
    ).toBeInTheDocument();
    expect(date()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it.each([
    ['0', 'Enter an amount greater than ₱0.00.'],
    ['1000000.01', 'Enter an amount of ₱1,000,000.00 or less.'],
  ])('refuses an amount of %s with its exact message and sends nothing', async (typed, message) => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    renderModal();
    await ready();
    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), 'Thread');
    await user.type(amount(), typed);

    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(amount()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it('accepts exactly today plus 30 days and an amount of 1000000.00', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await ready();
    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), 'Event deposit');
    await user.type(amount(), '1000000');
    fireEvent.change(date(), { target: { value: '2026-11-24' } });

    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.bodies).toMatchObject([{ date: '2026-11-24', amount: 1000000 }]);
  });

  it('trims the description and sends notes only when something was typed', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    renderModal();
    await ready();
    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), '  Thread  ');
    await user.type(amount(), '5');
    await user.type(screen.getByRole('textbox', { name: /^Notes/ }), 'Paid in cash');

    await user.click(saveButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toMatchObject({ description: 'Thread', notes: 'Paid in cash' });
  });

  it('has no axe violations with the errors showing', async () => {
    backends();
    const user = userEvent.setup();
    renderModal();
    await ready();

    await user.click(saveButton());
    await screen.findByText('Choose a category.');

    await expectNoAxeViolations(document.body);
  });
});

describe('E2 server answers', () => {
  it('shows an inactive payer and a retired category under their fields and focuses the first', async () => {
    backends();
    createExpenseBackend(() =>
      problem(400, {
        errors: {
          paidByUserId: ["This person can't be chosen because their account isn't active. Choose someone else."],
          categoryId: ['This category was retired. Choose another one.'],
        },
      }),
    );
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await ready();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByText('This category was retired. Choose another one.')).toBeInTheDocument();
    expect(
      screen.getByText("This person can't be chosen because their account isn't active. Choose someone else."),
    ).toBeInTheDocument();
    expect(category()).toHaveAttribute('aria-invalid', 'true');
    expect(paidBy()).toHaveAttribute('aria-invalid', 'true');
    expect(category()).toHaveFocus();
    expect(onSaved).not.toHaveBeenCalled();
    expect(description()).toHaveValue('Thread and needles');
  });

  it('shows one alert line for a failure that belongs to no field and keeps the typed values', async () => {
    backends();
    createExpenseBackend(() => problem(500));
    const user = userEvent.setup();
    renderModal();
    await ready();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(description()).toHaveValue('Thread and needles');
    expect(saveButton()).toHaveFocus();
  });

  it('keeps one Idempotency-Key when the same form is sent again after a server failure', async () => {
    backends();
    let calls = 0;
    const sent = createExpenseBackend(() => {
      calls += 1;
      return calls === 1 ? problem(500) : Response.json(expenseDetail(), { status: 201 });
    });
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await ready();
    await fillValid(user);

    await user.click(saveButton());
    await screen.findByRole('alert');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.keys).toHaveLength(2);
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });

  it('says the staff list could not load under Paid by and has no axe violations', async () => {
    categoriesBackend();
    staffBackend(() => problemResponse(500));
    renderModal();

    expect(await screen.findByText("Couldn't load the staff list. Close this form and try again.")).toBeInTheDocument();
    expect(paidBy()).toBeDisabled();
    await expectNoAxeViolations(document.body);
  });
});

describe('E2 close, reopen and keys', () => {
  function tree(open: boolean, today = EXPENSE_TODAY, onClose: () => void = () => undefined) {
    return (
      <QueryClientProvider client={queryClient}>
        <ExpenseModal mode="add" open={open} today={today} onClose={onClose} onSaved={() => undefined} />
      </QueryClientProvider>
    );
  }

  it('starts again from today and the signed-in payer after the modal is closed with typed values', async () => {
    backends();
    const user = userEvent.setup();
    const view = render(tree(true));
    await ready();
    await user.selectOptions(category(), 'Supplies');
    await user.type(description(), 'Thread');
    await user.type(amount(), '12');
    await user.selectOptions(paidBy(), 'Liza Mercado');
    fireEvent.change(date(), { target: { value: '2026-10-01' } });

    view.rerender(tree(false));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    view.rerender(tree(true, '2026-10-26'));
    await ready();

    expect(date()).toHaveValue('2026-10-26');
    expect(category()).toHaveValue('');
    expect(description()).toHaveValue('');
    expect(amount()).toHaveValue('');
    expect(paidBy()).toHaveValue(ME_ID);
  });

  it('adds a line with Enter in Notes and does not submit', async () => {
    backends();
    const sent = createExpenseBackend();
    const user = userEvent.setup();
    renderModal();
    await ready();
    await fillValid(user);
    const notes = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^Notes/ });

    await user.type(notes, 'first{Enter}second');

    expect(notes).toHaveValue('first\nsecond');
    await delay(30);
    expect(sent.bodies).toHaveLength(0);
  });

  it('ignores Esc, the scrim and Close while the request runs, and closes once it has saved', async () => {
    backends();
    createExpenseBackend(async () => {
      await delay(500);
      return Response.json(expenseDetail(), { status: 201 });
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(tree(true, EXPENSE_TODAY, onClose));
    await ready();
    await fillValid(user);

    await user.click(saveButton());
    await screen.findByRole('button', { name: 'Saving' });
    fireEvent.keyDown(window, { key: 'Escape' });
    const scrim = screen.getByRole('dialog').parentElement;
    if (scrim === null) {
      throw new Error('The dialog has no scrim.');
    }
    fireEvent.mouseDown(scrim);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
