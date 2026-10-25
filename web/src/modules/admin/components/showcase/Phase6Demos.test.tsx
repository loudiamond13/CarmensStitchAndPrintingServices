// Phase 6 demos in the Component Showcase (UI-SPEC Component Inventory, UI Considerations backstops; plan 06-18): the Company
// Expenses table, month cards, expense modal, delete dialogs, deleted rows and the Settings category rows and modal, all on
// made-up data and local state, with the longest and largest values the rules allow. No test here may cause a request.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import {
  HUGE_PERIOD_TOTAL,
  LONG_CATEGORY_NAME,
  LONG_DESCRIPTION,
  LONG_NAME,
  LONG_NOTES,
  MAX_AMOUNT,
} from '@/test/expenseFixtures';
import { server } from '@/test/msw';
import { Phase6Demos } from './Phase6Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase6Demos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

/** Every request the page makes, seen two ways: MSW's request events and a spy on fetch. */
const requests: string[] = [];
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  server.events.removeAllListeners();
  fetchSpy.mockRestore();
});

/** The money as the pages write it. */
function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

describe('Phase6Demos: the lists on the longest and largest values', () => {
  it('shows the E1 table with an Upcoming row, a former staff payer with a 100-character name, a retired 40-character category, a row at the amount limit and a footer at the largest total', () => {
    renderDemos();
    const table = within(caseFrame('expenses-table')).getByRole('table', { name: 'Company expenses' });

    expect(within(table).getByText('Upcoming')).toBeInTheDocument();
    expect(LONG_NAME).toHaveLength(100);
    expect(table).toHaveTextContent(`${LONG_NAME} (former staff)`);
    expect(LONG_CATEGORY_NAME).toHaveLength(40);
    expect(within(table).getByText(LONG_CATEGORY_NAME)).toBeInTheDocument();
    expect(LONG_DESCRIPTION).toHaveLength(200);
    expect(within(table).getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    expect(within(table).getAllByText(peso(MAX_AMOUNT)).length).toBeGreaterThan(0);
    expect(within(table).getByText('System')).toBeInTheDocument();
    const footer = table.querySelector('tfoot');
    expect(footer).toHaveTextContent(peso(HUGE_PERIOD_TOTAL));
    expect(footer).toHaveTextContent(/expenses · /);
  });

  it('wraps the long description and the long names anywhere inside their cells', () => {
    renderDemos();
    const table = within(caseFrame('expenses-table')).getByRole('table', { name: 'Company expenses' });

    expect(within(table).getByText(LONG_DESCRIPTION).className).toContain('wrap-anywhere');
    expect(within(table).getByText(LONG_CATEGORY_NAME).className).toContain('wrap-anywhere');
    const payer = within(table).getByText(LONG_NAME, { exact: false }).closest('span');
    expect(payer?.className).toContain('wrap-anywhere');
  });

  it('shows the three month cards with a 40-character top category and a total at the largest figure, and the empty Top category beside the others', () => {
    renderDemos();
    const full = within(caseFrame('expenses-kpis'));

    expect(full.getByText('This month · Oct')).toBeInTheDocument();
    expect(full.getByText('Last month · Sep')).toBeInTheDocument();
    expect(full.getByText('Top category · Oct')).toBeInTheDocument();
    expect(full.getByText(peso(HUGE_PERIOD_TOTAL))).toBeInTheDocument();
    expect(full.getByText(LONG_CATEGORY_NAME)).toBeInTheDocument();

    const empty = within(caseFrame('expenses-kpis-empty'));
    expect(empty.getByText('Top category · Oct')).toBeInTheDocument();
    expect(empty.getByText('Not set')).toBeInTheDocument();
    expect(empty.getByText('No expenses this month')).toBeInTheDocument();
  });

  it('shows the E4 rows with Deleted by naming a former staff member, and Restore and Delete permanently by name', () => {
    renderDemos();
    const table = within(caseFrame('expenses-deleted-rows')).getByRole('table', { name: 'Deleted expenses' });

    expect(table).toHaveTextContent(`${LONG_NAME} (former staff)`);
    expect(within(table).getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: /^Restore .*, Oct \d{1,2}, 2026$/ }).length).toBeGreaterThan(0);
    expect(
      within(table).getAllByRole('button', { name: /^Delete .*, Oct \d{1,2}, 2026 permanently$/ }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the S1 rows: active, retired, never used and Others, each with only the actions it is allowed', () => {
    renderDemos();
    const table = within(caseFrame('settings-category-rows')).getByRole('table', { name: 'Expense categories' });

    const rowOf = (name: string): HTMLElement => {
      const row = within(table).getByText(name).closest('tr');
      if (row === null) {
        throw new Error(`No row for ${name}.`);
      }
      return row;
    };
    const active = within(rowOf('Rent'));
    expect(active.getByText('Active')).toBeInTheDocument();
    expect(active.getByRole('button', { name: 'Retire Rent' })).toBeInTheDocument();
    expect(active.queryByRole('button', { name: /^Delete / })).toBeNull();

    const retired = within(rowOf('Old subscriptions'));
    expect(retired.getByText('Retired')).toBeInTheDocument();
    expect(retired.getByRole('button', { name: 'Use Old subscriptions again' })).toBeInTheDocument();

    const neverUsed = within(rowOf(LONG_CATEGORY_NAME));
    expect(neverUsed.getByRole('button', { name: `Delete ${LONG_CATEGORY_NAME}` })).toBeInTheDocument();

    const others = within(rowOf('Others'));
    expect(others.getByText('Always listed last')).toBeInTheDocument();
    expect(others.getAllByRole('button')).toHaveLength(1);
  });
});

describe('Phase6Demos: the expense modal and the delete dialogs are live', () => {
  it('opens the E2 modal in add mode with the form fields, and Cancel closes it and returns focus', async () => {
    const user = userEvent.setup();
    renderDemos();
    const trigger = within(caseFrame('expenses-modal')).getByRole('button', { name: 'Open Add Expense' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add Expense' });
    for (const label of [/^Date/, /^Category/, /^Description/, /^Amount/, /^Paid by/, /^Notes/]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Recorded by')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('opens the E2 modal in edit mode with the stale save banner, the access note and who recorded and changed it; Load Latest clears the banner', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('expenses-modal')).getByRole('button', { name: 'Open Edit Expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Expense' });
    expect(within(dialog).getByText('This was changed by someone else.')).toBeInTheDocument();
    expect(within(dialog).getByText(/After you save, you can't edit this expense any more/)).toBeInTheDocument();
    expect(within(dialog).getByText('Last changed by')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(within(dialog).queryByText('This was changed by someone else.')).toBeNull();
    });
  });

  it('opens the E2 modal in view mode with 1,000 characters of notes and a Close button only', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('expenses-modal')).getByRole('button', { name: 'Open Expense details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Expense details' });
    expect(LONG_NOTES).toHaveLength(1000);
    expect(within(dialog).getByText(LONG_NOTES).className).toContain('whitespace-pre-line');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Save/ })).toBeNull();
  });

  it('opens both E3 dialogs with the 200-character description in the title, Cancel focused, and closing returns focus', async () => {
    const user = userEvent.setup();
    renderDemos();

    for (const [label, confirm, suffix] of [
      ['Open Delete Expense', 'Delete Expense', ')?'],
      ['Open Delete Permanently', 'Delete Permanently', ') permanently?'],
    ] as const) {
      const trigger = within(caseFrame('expenses-delete-dialogs')).getByRole('button', { name: label });
      await user.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: new RegExp(`^Delete “${LONG_DESCRIPTION}” \\(₱`) });
      expect(dialog).toHaveAccessibleName(`Delete “${LONG_DESCRIPTION}” (${peso(MAX_AMOUNT)}${suffix}`);
      await waitFor(() => {
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      });
      expect(within(dialog).getByRole('button', { name: confirm })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    }
  });

  it('opens S2 in add mode with six color radios whose badges follow the typed name, and in edit mode with a 40-character name', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('settings-category-modal')).getByRole('button', { name: 'Open Add Category' }));
    const add = await screen.findByRole('dialog', { name: 'Add Category' });
    expect(within(add).getAllByRole('radio')).toHaveLength(6);
    expect(within(add).getByRole('radio', { name: 'Taupe' })).toBeChecked();
    expect(within(add).getByRole('radio', { name: 'Blue' })).toHaveAccessibleDescription('Sample');
    fireEvent.change(within(add).getByRole('textbox', { name: /^Name/ }), { target: { value: 'Courier' } });
    expect(within(add).getByRole('radio', { name: 'Blue' })).toHaveAccessibleDescription('Courier');
    await user.click(within(add).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.click(within(caseFrame('settings-category-modal')).getByRole('button', { name: 'Open Edit Category' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit Category' });
    expect(within(edit).getByRole('textbox', { name: /^Name/ })).toHaveValue(LONG_CATEGORY_NAME);
    expect(within(edit).getByRole('radio', { name: 'Plum' })).toBeChecked();
    expect(within(edit).getByText('Recorded by')).toBeInTheDocument();
  });
});

describe('Phase6Demos: made-up data, local state, no request', () => {
  it('makes no request while the demos render and are used', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('expenses-modal')).getByRole('button', { name: 'Open Edit Expense' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit Expense' });
    await user.click(within(edit).getByRole('button', { name: 'Load Latest' }));
    await user.click(within(edit).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(within(caseFrame('expenses-delete-dialogs')).getByRole('button', { name: 'Open Delete Expense' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Expense' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses only the spec section 12 names and example.com addresses', () => {
    const { container } = renderDemos();

    expect(container.textContent).not.toMatch(/@(?!example\.com)/);
  });

  it('has no axe violations in the static cases', async () => {
    const { container } = renderDemos();
    expect(caseFrame('expenses-table')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it.each([
    ['expenses-modal', 'Open Add Expense', 'Add Expense'],
    ['expenses-modal', 'Open Edit Expense', 'Edit Expense'],
    ['expenses-modal', 'Open Expense details', 'Expense details'],
    ['settings-category-modal', 'Open Add Category', 'Add Category'],
    ['settings-category-modal', 'Open Edit Category', 'Edit Category'],
  ])('has no axe violations with the %s demo open: %s', async (id, trigger, title) => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame(id)).getByRole('button', { name: trigger }));
    const dialog = await screen.findByRole('dialog', { name: title });

    await expectNoAxeViolations(dialog);
  });

  it.each(['Open Delete Expense', 'Open Delete Permanently'])(
    'has no axe violations with a delete dialog open: %s',
    async (trigger) => {
      const user = userEvent.setup();
      renderDemos();

      await user.click(within(caseFrame('expenses-delete-dialogs')).getByRole('button', { name: trigger }));
      const dialog = await screen.findByRole('dialog');

      await expectNoAxeViolations(dialog);
    },
  );
});
