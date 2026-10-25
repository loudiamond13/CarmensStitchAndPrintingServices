import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  staffBackend,
  SUPPLIES,
} from '@/test/expenseFixtures';
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
