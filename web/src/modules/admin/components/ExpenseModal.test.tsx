import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoriesBackend,
  CARMEN,
  createExpenseBackend,
  EXPENSE_TODAY,
  expenseDetail,
  expenseDetailBackend,
  LIZA_ID,
  LONG_DESCRIPTION,
  ME_ACTOR,
  ME_ID,
  problemResponse,
  RETIRED_CATEGORY_ID,
  staffBackend,
  SUPPLIES,
  updateExpenseBackend,
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

  it('shows the Date label, box and hint with no date written out beside the box (D-63)', async () => {
    backends();
    renderModal();
    const field = date().parentElement?.parentElement ?? null;

    expect(field).toHaveTextContent("Date *Up to 30 days ahead is fine for a cost you'll pay soon.");
    expect(field).not.toHaveTextContent('Oct 25, 2026');
    fireEvent.change(date(), { target: { value: '2026-11-02' } });
    expect(field).not.toHaveTextContent('Nov 2, 2026');
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

  it('shows the mapped alert line for a 404 on add, keeps Save enabled and the typed values (no deleted banner)', async () => {
    backends();
    createExpenseBackend(() => problem(404, { code: 'company-expenses.not-found' }));
    const user = userEvent.setup();
    const { onSaved } = renderModal();
    await ready();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not found. It may have been deleted. Go back and refresh the list.',
    );
    expect(screen.queryByText('This expense was deleted.')).toBeNull();
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(saveButton()).toHaveFocus();
    expect(description()).toHaveValue('Thread and needles');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows the mapped alert line for a not-yours 403 on add and keeps Save enabled', async () => {
    backends();
    createExpenseBackend(() => problem(403, { code: 'company-expenses.not-yours' }));
    const user = userEvent.setup();
    renderModal();
    await ready();
    await fillValid(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this.");
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(description()).toHaveValue('Thread and needles');
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

// E2 Expense modal, edit mode (CEXP-02, CEXP-04, SEC-07, 05 D-13, D-20; plan 06-14): the detail is read fresh on every open and
// the form keeps the row version it opened with.
const EXPENSE_ID = expenseDetail().id;

function renderEdit(handlers: { onClose?: () => void; onSaved?: (expense: unknown) => void } = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ExpenseModal mode="edit" expenseId={EXPENSE_ID} today={EXPENSE_TODAY} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

const saveChanges = () => screen.getByRole('button', { name: /^(Save Changes|Saving)$/ });

async function loaded() {
  await screen.findByRole('textbox', { name: /^Description/ });
  await waitFor(() => {
    expect(category()).toBeEnabled();
    expect(paidBy()).toBeEnabled();
  });
}

describe('E2 edit mode', () => {
  it('says "Loading expense…" until the detail arrives, then "Expense loaded." and fills the saved values with focus on Date', async () => {
    backends();
    expenseDetailBackend(expenseDetail({ notes: 'Bought in bulk', amount: 640 }));
    renderEdit();

    const dialog = screen.getByRole('dialog', { name: 'Edit Expense' });
    expect(within(dialog).getByText('Loading expense…')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: /^Description/ })).toBeNull();
    await loaded();

    expect(screen.getByText('Expense loaded.')).toBeInTheDocument();
    expect(date()).toHaveValue(EXPENSE_TODAY);
    expect(date()).toHaveFocus();
    expect(category()).toHaveValue(SUPPLIES.id);
    expect(description()).toHaveValue('Thread and needles');
    expect(amount()).toHaveValue('640.00');
    expect(paidBy()).toHaveValue(ME_ID);
    expect(screen.getByRole('textbox', { name: /^Notes/ })).toHaveValue('Bought in bulk');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows Recorded by as the original recorder and Last changed by as Not set until the first change', async () => {
    backends();
    expenseDetailBackend(expenseDetail({ recordedBy: CARMEN, lastChangedBy: null, lastChangedAt: null }));
    renderEdit();
    await loaded();

    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual(['Recorded by', 'Last changed by']);
    const [recorded, changed] = screen.getAllByRole('definition');
    expect(recorded?.textContent).toMatch(/^Carmen Reyes · /);
    expect(changed?.textContent).toBe('Not set');
  });

  it('names the editor under Last changed by and keeps the recorder under Recorded by', async () => {
    backends();
    expenseDetailBackend(
      expenseDetail({
        recordedBy: { id: 'a-1', name: 'Liza Mercado', formerStaff: true },
        lastChangedBy: CARMEN,
        lastChangedAt: '2026-10-25T05:00:00Z',
      }),
    );
    renderEdit();
    await loaded();

    const [recorded, changed] = screen.getAllByRole('definition');
    expect(recorded?.textContent).toMatch(/^Liza Mercado \(former staff\) · /);
    expect(changed?.textContent).toMatch(/^Carmen Reyes · /);
  });

  it('sends one PUT with the changed fields and the row version it opened with, no Idempotency-Key, then reports the saved expense', async () => {
    backends();
    expenseDetailBackend();
    const sent = updateExpenseBackend(() => Response.json(expenseDetail({ amount: 700, version: 'AAAAAAAAB9I=' })));
    const user = userEvent.setup();
    const { onSaved, onClose } = renderEdit();
    await loaded();

    await user.clear(amount());
    await user.type(amount(), '700');
    await user.click(saveChanges());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent.ids).toEqual([EXPENSE_ID]);
    expect(sent.keys).toEqual([null]);
    expect(sent.bodies).toEqual([
      {
        date: EXPENSE_TODAY,
        categoryId: SUPPLIES.id,
        description: 'Thread and needles',
        amount: 700,
        paidByUserId: ME_ID,
        notes: null,
        version: 'AAAAAAAAB9E=',
      },
    ]);
  });

  it('reads the detail again on every open and never changes the version the form holds when it is refetched', async () => {
    backends();
    const { ids } = expenseDetailBackend();
    const sent = updateExpenseBackend();
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    expect(ids).toEqual([EXPENSE_ID]);

    expenseDetailBackend(expenseDetail({ version: 'AAAAAAAAB9M=' }));
    await queryClient.refetchQueries();
    await user.clear(amount());
    await user.type(amount(), '701');
    await user.click(saveChanges());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toMatchObject({ version: 'AAAAAAAAB9E=' });
  });

  it('checks the rules in the browser before sending: an amount of 0 sends nothing', async () => {
    backends();
    expenseDetailBackend();
    const sent = updateExpenseBackend();
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.clear(amount());
    await user.type(amount(), '0');
    await user.click(saveChanges());

    expect(await screen.findByText('Enter an amount greater than ₱0.00.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('saves an imported expense over the amount cap when the amount is unchanged (D-33)', async () => {
    backends();
    expenseDetailBackend(expenseDetail({ amount: 1_500_000 }));
    const sent = updateExpenseBackend();
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    expect(amount()).toHaveValue('1500000.00');

    await user.clear(description());
    await user.type(description(), 'Bulk thread');
    await user.click(saveChanges());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toMatchObject({ description: 'Bulk thread', amount: 1_500_000 });
  });

  it('blocks an imported expense changed to another amount over the cap before sending', async () => {
    backends();
    expenseDetailBackend(expenseDetail({ amount: 1_500_000 }));
    const sent = updateExpenseBackend();
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.clear(amount());
    await user.type(amount(), '1600000');
    await user.click(saveChanges());

    expect(await screen.findByText('Enter an amount of ₱1,000,000.00 or less.')).toBeVisible();
    expect(sent.bodies).toHaveLength(0);
  });

  it('has no axe violations once loaded', async () => {
    backends();
    expenseDetailBackend();
    renderEdit();
    await loaded();

    await expectNoAxeViolations(screen.getByRole('dialog', { name: 'Edit Expense' }));
  });
});

// A stale save, a lost right and a deletion while editing keep every typed value and say what happened (SEC-07, D-26, 05 D-20).
describe('E2 edit conflicts', () => {
  const STALE_BODY = { code: 'edit.stale', detail: 'This was changed by someone else.' };
  const STALE_TITLE = 'This was changed by someone else.';
  const STALE_HELP = 'Reload and try again. Your typed changes stay here until you press Load Latest.';

  async function typeAmount(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.clear(amount());
    await user.type(amount(), text);
  }

  it('keeps every typed value on a 409, shows the banner and puts focus on Load Latest', async () => {
    backends();
    expenseDetailBackend();
    updateExpenseBackend(() => problem(409, STALE_BODY));
    const user = userEvent.setup();
    const { onSaved } = renderEdit();
    await loaded();

    await typeAmount(user, '700');
    await user.type(description(), ' for the shop');
    await user.click(saveChanges());

    expect(await screen.findByText(STALE_TITLE)).toBeVisible();
    expect(screen.getByText(STALE_HELP)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    expect(amount().value).toContain('700');
    expect(description()).toHaveValue('Thread and needles for the shop');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('Load Latest replaces the values and the version, removes the banner, focuses Date and says so politely', async () => {
    backends();
    expenseDetailBackend();
    let calls = 0;
    const sent = updateExpenseBackend(() => {
      calls += 1;
      return calls === 1 ? problem(409, STALE_BODY) : Response.json(expenseDetail({ amount: 905 }));
    });
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    await typeAmount(user, '700');
    await user.click(saveChanges());
    await screen.findByText(STALE_TITLE);

    expenseDetailBackend(
      expenseDetail({ amount: 900, description: 'Thread, needles and bobbins', version: 'AAAAAAAAB9Q=' }),
    );
    await user.click(screen.getByRole('button', { name: 'Load Latest' }));

    await waitFor(() => {
      expect(screen.queryByText(STALE_TITLE)).toBeNull();
    });
    expect(amount()).toHaveValue('900.00');
    expect(description()).toHaveValue('Thread, needles and bobbins');
    expect(date()).toHaveFocus();
    expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();

    await user.click(saveChanges());
    await waitFor(() => {
      expect(sent.bodies).toHaveLength(2);
    });
    expect(sent.bodies[1]).toMatchObject({ amount: 900, version: 'AAAAAAAAB9Q=' });
  });

  it('shows the not-yours banner on a 403, disables Save and keeps the typed values', async () => {
    backends();
    expenseDetailBackend();
    const sent = updateExpenseBackend(() => problem(403, { code: 'company-expenses.not-yours' }));
    const user = userEvent.setup();
    const { onSaved } = renderEdit();
    await loaded();
    await typeAmount(user, '700');
    await user.click(saveChanges());

    expect(await screen.findByText("You can't edit this expense.")).toBeVisible();
    expect(
      screen.getByText('Admins can edit only the expenses they recorded or paid. Ask a Manager to change it.'),
    ).toBeVisible();
    expect(saveChanges()).toHaveAttribute('aria-disabled', 'true');
    expect(amount().value).toContain('700');

    await user.click(saveChanges());
    expect(sent.bodies).toHaveLength(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows "This expense was deleted." on a 404 at save, disables Save and keeps the typed values', async () => {
    backends();
    expenseDetailBackend();
    const sent = updateExpenseBackend(() => problem(404, { code: 'company-expenses.not-found' }));
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    await typeAmount(user, '700');
    await user.click(saveChanges());

    expect(await screen.findByText('This expense was deleted.')).toBeVisible();
    expect(screen.getByText('Close this and refresh the list.')).toBeVisible();
    expect(saveChanges()).toHaveAttribute('aria-disabled', 'true');
    expect(amount().value).toContain('700');
    await user.click(saveChanges());
    expect(sent.bodies).toHaveLength(1);
  });

  it('shows "This expense was deleted." when the detail is already gone on open, with Save disabled and no Try Again', async () => {
    backends();
    expenseDetailBackend(() => problem(404, { code: 'company-expenses.not-found' }));
    renderEdit();

    expect(await screen.findByText('This expense was deleted.')).toBeVisible();
    expect(screen.getByText('Close this and refresh the list.')).toBeVisible();
    expect(saveChanges()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
  });

  it('shows "Couldn\'t load this expense." with Try Again, and Try Again loads the form', async () => {
    backends();
    let calls = 0;
    expenseDetailBackend(() => {
      calls += 1;
      return calls === 1 ? problem(500) : expenseDetail();
    });
    const user = userEvent.setup();
    renderEdit();

    expect(await screen.findByText("Couldn't load this expense.")).toBeVisible();
    expect(saveChanges()).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await loaded();
    expect(description()).toHaveValue('Thread and needles');
  });

  it('shows a payer or category the server refused under its field and focuses the first', async () => {
    backends();
    expenseDetailBackend();
    updateExpenseBackend(() =>
      problem(400, {
        errors: {
          paidByUserId: ["This person can't be chosen because their account isn't active. Choose someone else."],
          categoryId: ['This category was retired. Choose another one.'],
        },
      }),
    );
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.click(saveChanges());

    expect(await screen.findByText('This category was retired. Choose another one.')).toBeInTheDocument();
    expect(
      screen.getByText("This person can't be chosen because their account isn't active. Choose someone else."),
    ).toBeInTheDocument();
    expect(category()).toHaveFocus();
    expect(description()).toHaveValue('Thread and needles');
  });

  it('shows one alert line for another failure and keeps the typed values', async () => {
    backends();
    expenseDetailBackend();
    updateExpenseBackend(() => problem(500));
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    await typeAmount(user, '700');
    await user.click(saveChanges());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(amount().value).toContain('700');
    expect(saveChanges()).toHaveFocus();
  });
});

describe('E2 edit saved inactive payer and retired category (OQ-7, D-11)', () => {
  const selectedText = (select: HTMLElement) => within(select).getByRole('option', { selected: true }).textContent;

  it('keeps a saved payer who is no longer active as "{name} (inactive)" and a saved retired category as "{name} (retired)", and sends them unchanged', async () => {
    backends();
    const OLD_ID = '00000000-0000-4000-8000-0000000000b1';
    expenseDetailBackend(
      expenseDetail({
        paidBy: { id: OLD_ID, name: 'Old Helper', formerStaff: false },
        paidByActive: false,
        category: { id: RETIRED_CATEGORY_ID, name: 'Old subscriptions', tone: 'accent', retired: true },
      }),
    );
    const sent = updateExpenseBackend();
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    expect(selectedText(paidBy())).toBe('Old Helper (inactive)');
    expect(selectedText(category())).toBe('Old subscriptions (retired)');
    await user.click(saveChanges());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toMatchObject({ paidByUserId: OLD_ID, categoryId: RETIRED_CATEGORY_ID });
  });

  it('names a saved payer whose account was deleted "{name} (former staff)"', async () => {
    backends();
    expenseDetailBackend(
      expenseDetail({
        paidBy: { id: '00000000-0000-4000-8000-0000000000b2', name: 'Gone Helper', formerStaff: true },
        paidByActive: false,
      }),
    );
    renderEdit();
    await loaded();

    expect(selectedText(paidBy())).toBe('Gone Helper (former staff)');
  });
});

describe('E2 edit access note (D-26)', () => {
  const NOTE =
    "After you save, you can't edit this expense any more. Only the person who recorded it, the person who paid it, or a Manager can.";
  const LIZA = { id: LIZA_ID, name: 'Liza Mercado', formerStaff: false };

  function signInAsAdmin() {
    clearSession();
    acceptSession(
      sessionResponse({
        user: {
          id: ME_ID,
          email: 'carmen@example.ph',
          firstName: 'Carmen',
          lastName: 'Reyes',
          role: 'Admin',
        },
      }),
    );
  }

  it('shows the note to an Admin who did not record the expense once Paid by moves away from them, and hides it when changed back', async () => {
    signInAsAdmin();
    backends();
    expenseDetailBackend(expenseDetail({ recordedBy: LIZA, paidBy: ME_ACTOR }));
    const user = userEvent.setup();
    renderEdit();
    await loaded();
    expect(screen.queryByText(NOTE)).toBeNull();

    await user.selectOptions(paidBy(), 'Paolo Garcia');
    expect(await screen.findByText(NOTE)).toBeVisible();

    await user.selectOptions(paidBy(), 'Carmen Reyes (you)');
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows no note to an Admin who recorded the expense', async () => {
    signInAsAdmin();
    backends();
    expenseDetailBackend(expenseDetail({ recordedBy: ME_ACTOR, paidBy: ME_ACTOR }));
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.selectOptions(paidBy(), 'Paolo Garcia');
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows no note to a Manager', async () => {
    backends();
    expenseDetailBackend(expenseDetail({ recordedBy: LIZA, paidBy: ME_ACTOR }));
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.selectOptions(paidBy(), 'Paolo Garcia');
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});

// E2 Expense modal, view mode (OQ-8; plan 06-14): the read-only look an Admin gets for an expense they cannot edit.
describe('E2 view mode', () => {
  function renderView(onClose: () => void = vi.fn()) {
    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseModal mode="view" expenseId={EXPENSE_ID} onClose={onClose} />
      </QueryClientProvider>,
    );
    return { onClose };
  }

  const dialogOf = () => screen.getByRole('dialog', { name: 'Expense details' });

  it('says "Loading expense…" and then shows the saved values as read-only text with Notes', async () => {
    expenseDetailBackend(
      expenseDetail({
        notes: 'Bought in bulk',
        paidBy: { id: LIZA_ID, name: 'Liza Mercado', formerStaff: true },
        recordedBy: ME_ACTOR,
      }),
    );
    renderView();

    expect(within(dialogOf()).getByText('Loading expense…')).toBeInTheDocument();
    const dialog = dialogOf();
    expect(await within(dialog).findByText('Bought in bulk')).toBeVisible();
    expect(within(dialog).getByText('A general business cost, not tied to any order.')).toBeInTheDocument();
    expect(within(dialog).getByText('Expense loaded.')).toBeInTheDocument();
    const terms = within(dialog)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual([
      'Date',
      'Category',
      'Description',
      'Amount',
      'Paid by',
      'Notes',
      'Recorded by',
      'Last changed by',
    ]);
    expect(within(dialog).getByText('Oct 25, 2026')).toBeVisible();
    expect(within(dialog).getByText('Supplies')).toBeVisible();
    expect(within(dialog).getByText('Thread and needles')).toBeVisible();
    expect(within(dialog).getByText('₱640.00')).toBeVisible();
    expect(within(dialog).getByText('Liza Mercado', { exact: false }).textContent).toContain('(former staff)');
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByRole('combobox')).toBeNull();
  });

  it('has only a Close button in its footer, with focus on it, and Close closes', async () => {
    expenseDetailBackend();
    const user = userEvent.setup();
    const { onClose } = renderView();
    const dialog = dialogOf();
    await within(dialog).findByText('Thread and needles');

    expect(within(dialog).queryByRole('button', { name: /Save|Cancel/ })).toBeNull();
    const closers = within(dialog).getAllByRole('button', { name: 'Close' });
    const footerClose = closers.at(-1);
    expect(footerClose).toHaveFocus();
    await user.click(footerClose ?? dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Not set for empty Notes and for Last changed by', async () => {
    expenseDetailBackend(expenseDetail({ notes: null, lastChangedBy: null, lastChangedAt: null }));
    renderView();
    const dialog = dialogOf();
    await within(dialog).findByText('Thread and needles');

    const notes = within(dialog).getByText('Notes', { exact: true }).closest('div');
    expect(notes?.textContent).toContain('Not set');
    const [, changed] = within(dialog).getAllByRole('definition').slice(-2);
    expect(changed?.textContent).toBe('Not set');
  });

  it('wraps a very long description and keeps the original recorder under Recorded by', async () => {
    expenseDetailBackend(expenseDetail({ description: LONG_DESCRIPTION, recordedBy: CARMEN }));
    renderView();
    const dialog = dialogOf();

    const text = await within(dialog).findByText(LONG_DESCRIPTION);
    expect(text.className).toContain('wrap-anywhere');
    const recorded = within(dialog).getAllByRole('definition').slice(-2)[0];
    expect(recorded?.textContent).toMatch(/^Carmen Reyes · /);
  });

  it('shows "This expense was deleted." for a 404 and "Couldn\'t load this expense." with Try Again for another failure', async () => {
    expenseDetailBackend(() => problem(404, { code: 'company-expenses.not-found' }));
    renderView();
    expect(await screen.findByText('This expense was deleted.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
  });

  it('offers Try Again after a failed read', async () => {
    let calls = 0;
    expenseDetailBackend(() => {
      calls += 1;
      return calls === 1 ? problem(500) : expenseDetail();
    });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("Couldn't load this expense.")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Thread and needles')).toBeVisible();
  });

  it('makes the body a named region the keyboard can focus, because it scrolls on a phone and holds nothing to press', async () => {
    expenseDetailBackend();
    renderView();
    const region = await within(dialogOf()).findByRole('region', { name: 'Expense details' });

    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('has no axe violations once loaded', async () => {
    expenseDetailBackend(expenseDetail({ notes: 'Bought in bulk' }));
    renderView();
    await within(dialogOf()).findByText('Bought in bulk');

    await expectNoAxeViolations(dialogOf());
  });
});
