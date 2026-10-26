import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { expenseKpisKey } from '@/modules/admin/hooks/useExpenseKpisQuery';
import { expenseCategoriesKey } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { expensesDeletedKey } from '@/modules/admin/hooks/useDeletedExpensesQuery';
import { expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { SettingsRoute } from '@/modules/admin/pages/SettingsPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoriesBackend,
  categoryDetail,
  categoryDetailBackend,
  categoryItem,
  codedProblemResponse,
  createCategoryBackend,
  deleteCategoryBackend,
  EXPENSE_CATEGORIES,
  problemResponse,
  reactivateCategoryBackend,
  RENT,
  RETIRED_CATEGORY_ID,
  retireCategoryBackend,
  updateCategoryBackend,
} from '@/test/expenseFixtures';
import type { CategoryListItemFixture } from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';

// S1 Settings, /admin/settings (D-08..D-15, OQ-3; plan 06-17): the Manager's page for the expense category list.

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

/** The usage counts the server would send: some used, some never used (0), the retired one used twice. */
const COUNTS: Readonly<Record<string, number>> = {
  Maintenance: 3,
  'Old subscriptions': 2,
  Rent: 12,
  Salaries: 4,
  Supplies: 7,
  'Transport and fuel': 1,
  Utilities: 5,
};

const CATEGORIES: readonly CategoryListItemFixture[] = EXPENSE_CATEGORIES.map((category) => ({
  ...category,
  expenseCount: COUNTS[category.name] ?? 0,
}));

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <SettingsRoute />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasTone(badge: HTMLElement, tone: keyof typeof badgeToneClasses): boolean {
  return tokens(badgeToneClasses[tone]).every((token) => tokens(badge.className).includes(token));
}

function rowOf(name: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(name) !== null);
  if (row === undefined) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

function cellOf(row: HTMLElement, label: string): HTMLElement {
  const cell = row.querySelector<HTMLElement>(`td[data-label="${label}"]`);
  if (cell === null) {
    throw new Error(`No ${label} cell`);
  }
  return cell;
}

async function openPage() {
  categoriesBackend(CATEGORIES);
  const view = renderPage();
  await screen.findByRole('table', { name: 'Expense categories' });
  return view;
}

describe('S1 the page', () => {
  it('shows the heading with the Manager only badge, the subline, the card title, its hint and Add Category', async () => {
    await openPage();

    const heading = screen.getByRole('heading', { level: 1, name: 'Settings' });
    expect(heading).toBeVisible();
    expect(within(heading.parentElement ?? document.body).getByText('Manager only')).toBeVisible();
    expect(screen.getByText('Lists and options the whole team uses.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Expense Categories' })).toBeVisible();
    expect(screen.getByText('Staff pick one of these when they record a company expense.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Category' })).toBeVisible();
    expect(document.title).toBe('Settings · CSPS Admin');
  });

  it('shows the table with Category, Status, Expenses and the hidden Actions column, and the retire-versus-delete caption', async () => {
    await openPage();

    const table = screen.getByRole('table', { name: 'Expense categories' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Category', 'Status', 'Expenses', 'Actions']);
    expect(
      screen.getByText(
        'Retired categories are hidden from the Add Expense form, but past expenses keep them and the list filter still shows them. A category no expense has ever used, deleted ones included, can be deleted.',
      ),
    ).toBeVisible();
  });

  it("lists every category in the server's order, with Others last", async () => {
    await openPage();

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td[data-label="Category"]')?.textContent.replace('Always listed last', ''));
    expect(names).toEqual(EXPENSE_CATEGORIES.map((category) => category.name));
    expect(names.at(-1)).toBe('Others');
  });

  it('shows each category as a badge in its stored tone', async () => {
    await openPage();

    const rent = within(cellOf(rowOf('Rent'), 'Category')).getByText('Rent');
    const equipment = within(cellOf(rowOf('Equipment'), 'Category')).getByText('Equipment');
    expect(hasTone(rent, 'accent')).toBe(true);
    expect(hasTone(equipment, 'success')).toBe(true);
  });

  it('puts "Always listed last" under Others and nowhere else', async () => {
    await openPage();

    expect(screen.getAllByText('Always listed last')).toHaveLength(1);
    expect(within(cellOf(rowOf('Others'), 'Category')).getByText('Always listed last')).toBeVisible();
  });

  it.each([
    ['Rent', 'Active', 'success'],
    ['Old subscriptions', 'Retired', 'neutral'],
    ['Others', 'Active', 'success'],
  ] as const)('shows %s as a %s badge with a dot in the %s tone', async (name, label, tone) => {
    await openPage();

    const badge = within(cellOf(rowOf(name), 'Status')).getByText(label);
    expect(hasTone(badge, tone)).toBe(true);
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows how many expenses use each category, and 0 for a never-used one', async () => {
    await openPage();

    expect(cellOf(rowOf('Rent'), 'Expenses')).toHaveTextContent('12');
    expect(cellOf(rowOf('Old subscriptions'), 'Expenses')).toHaveTextContent('2');
    expect(cellOf(rowOf('Equipment'), 'Expenses')).toHaveTextContent('0');
    expect(cellOf(rowOf('Equipment'), 'Expenses').textContent).toBe('0');
  });

  it('shows a large usage count with a thousands separator', async () => {
    categoriesBackend([
      categoryItem('b74d786b-8092-4e67-a0ba-a419e9d1ba75', 'Maintenance', 'neutral', { expenseCount: 1235 }),
    ]);
    renderPage();
    await screen.findByRole('table', { name: 'Expense categories' });

    expect(cellOf(rowOf('Maintenance'), 'Expenses').textContent).toBe('1,235');
  });

  it('gives a retired row the surface-2 look on its cells and an active row none', async () => {
    await openPage();

    expect(tokens(cellOf(rowOf('Old subscriptions'), 'Status').className)).toContain('bg-surface-2');
    expect(tokens(cellOf(rowOf('Rent'), 'Status').className)).not.toContain('bg-surface-2');
  });

  it('has no axe violations with rows', async () => {
    const view = await openPage();
    await expectNoAxeViolations(view.container);
  });
});

describe('S1 the list states (UI Considerations)', () => {
  it('announces Loading categories on the first load, then shows the rows', async () => {
    categoriesBackend(async () => {
      await delay(150);
      return CATEGORIES;
    });
    renderPage();

    expect(await screen.findByText('Loading categories…')).toBeInTheDocument();
    await screen.findByText('Utilities');
    expect(screen.queryByText('Loading categories…')).toBeNull();
  });

  it("shows Couldn't load categories with Try Again, and Try Again reads the list again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    categoriesBackend(() => {
      calls += 1;
      return calls === 1 ? problemResponse(500) : CATEGORIES;
    });
    const view = renderPage();

    expect(await screen.findByText("Couldn't load categories.")).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoAxeViolations(view.container);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await screen.findByText('Utilities');
    expect(calls).toBe(2);
  });
});

describe('S1 add, rename and recolor (D-08, D-12, D-13; plan 06-17)', () => {
  function expectRefreshed(spy: MockInstance<QueryClient['invalidateQueries']>) {
    const keys = spy.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    for (const key of [expenseCategoriesKey, expensesKey, expenseKpisKey, expensesDeletedKey]) {
      expect(keys).toContain(JSON.stringify(key));
    }
  }

  it('gives every row an Edit button named for its category, with a matching title (Others included)', async () => {
    await openPage();

    for (const category of EXPENSE_CATEGORIES) {
      const button = within(rowOf(category.name)).getByRole('button', { name: `Edit ${category.name}` });
      expect(button).toHaveAttribute('title', `Edit ${category.name}`);
    }
  });

  it('opens the Add Category dialog from the card button; a save toasts, refreshes every list and returns focus to the button', async () => {
    const sent = createCategoryBackend();
    const user = userEvent.setup();
    await openPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const add = screen.getByRole('button', { name: 'Add Category' });

    await user.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Add Category' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Packaging');
    await user.click(within(dialog).getByRole('radio', { name: 'Blue' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save Category' }));

    expect(await screen.findByText('Category added')).toBeVisible();
    expect(screen.getByText('Packaging is ready to use.')).toBeVisible();
    expect(sent.bodies).toEqual([{ name: 'Packaging', tone: 'info' }]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(add).toHaveFocus();
    expectRefreshed(invalidate);
  });

  it('opens Edit {name} for a row; a save toasts the new name, refreshes every list and returns focus to the row Edit button', async () => {
    categoryDetailBackend(categoryDetail());
    updateCategoryBackend(() => Response.json(categoryDetail({ name: 'Rent and bills' })));
    const user = userEvent.setup();
    await openPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const edit = within(rowOf(RENT.name)).getByRole('button', { name: 'Edit Rent' });

    await user.click(edit);
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    const name = await within(dialog).findByDisplayValue('Rent');
    await user.clear(name);
    await user.type(name, 'Rent and bills');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Category updated')).toBeVisible();
    expect(screen.getByText('Rent and bills')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(edit).toHaveFocus();
    expectRefreshed(invalidate);
  });

  it('reads the category list again after a save, so a rename shows in the table', async () => {
    const renamed = CATEGORIES.map((category) =>
      category.id === RENT.id ? { ...category, name: 'Rent and bills' } : category,
    );
    let saved = false;
    categoriesBackend(() => (saved ? renamed : CATEGORIES));
    categoryDetailBackend(categoryDetail());
    updateCategoryBackend(() => {
      saved = true;
      return Response.json(categoryDetail({ name: 'Rent and bills' }));
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Expense categories' });

    await user.click(screen.getByRole('button', { name: 'Edit Rent' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    const name = await within(dialog).findByDisplayValue('Rent');
    await user.clear(name);
    await user.type(name, 'Rent and bills');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(
      await within(screen.getByRole('table', { name: 'Expense categories' })).findByText('Rent and bills'),
    ).toBeVisible();
  });

  it('has no axe violations with the Add Category dialog open', async () => {
    const user = userEvent.setup();
    const view = await openPage();

    await user.click(screen.getByRole('button', { name: 'Add Category' }));
    await screen.findByRole('dialog', { name: 'Add Category' });

    await expectNoAxeViolations(view.container);
    await expectNoAxeViolations(screen.getByRole('dialog', { name: 'Add Category' }));
  });
});

describe('S1 retire, use again and delete (D-10, D-11, D-30, OQ-4, OQ-5; plan 06-17)', () => {
  const EQUIPMENT_ID = EXPENSE_CATEGORIES.find((category) => category.name === 'Equipment')?.id ?? '';
  const OLD_ID = RETIRED_CATEGORY_ID;
  const DELETE_TITLE = 'Delete the Equipment category?';
  const DELETE_MESSAGE = "No expense has ever used it, so it can be deleted. This can't be undone.";

  /** A category list the fake server edits as the calls arrive. */
  function liveList(initial: readonly CategoryListItemFixture[] = CATEGORIES) {
    const state = new Map(initial.map((category) => [category.id, { ...category }]));
    const calls = categoriesBackend(() => [...state.values()]);
    return { state, calls };
  }

  function titlesIn(row: HTMLElement): (string | null)[] {
    return within(row)
      .getAllByRole('button')
      .map((button) => button.getAttribute('title'));
  }

  async function openLive(list = liveList()) {
    const view = renderPage();
    await screen.findByRole('table', { name: 'Expense categories' });
    return { view, ...list };
  }

  describe('the row actions', () => {
    it('gives an active category that is in use Edit and Retire only', async () => {
      await openLive();

      expect(titlesIn(rowOf('Rent'))).toEqual(['Edit Rent', 'Retire Rent']);
    });

    it('gives an active category that was never used Edit, Retire and Delete', async () => {
      await openLive();

      expect(titlesIn(rowOf('Equipment'))).toEqual(['Edit Equipment', 'Retire Equipment', 'Delete Equipment']);
    });

    it('gives a retired category Use again, and no Retire', async () => {
      await openLive();

      expect(titlesIn(rowOf('Old subscriptions'))).toEqual(['Edit Old subscriptions', 'Use Old subscriptions again']);
    });

    it('gives a retired category that was never used Use again and Delete', async () => {
      const retiredUnused = CATEGORIES.map((category) =>
        category.id === OLD_ID ? { ...category, expenseCount: 0 } : category,
      );
      await openLive(liveList(retiredUnused));

      expect(titlesIn(rowOf('Old subscriptions'))).toEqual([
        'Edit Old subscriptions',
        'Use Old subscriptions again',
        'Delete Old subscriptions',
      ]);
    });

    it('gives Others Edit only, even though nothing uses it', async () => {
      await openLive();

      expect(titlesIn(rowOf('Others'))).toEqual(['Edit Others']);
    });

    it('names each action for its category and marks Delete as the danger action', async () => {
      await openLive();

      const remove = within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' });
      expect(remove).toHaveAttribute('title', 'Delete Equipment');
      expect(tokens(remove.className).some((token) => token.includes('danger'))).toBe(true);
    });
  });

  describe('Retire and Use again act at once, with no confirmation (OQ-4, OQ-5)', () => {
    it('Retire flips the status and the action, keeps focus on the flipped action and toasts what it did', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      const sent = retireCategoryBackend((id) => {
        const category = state.get(id);
        if (category !== undefined) {
          category.status = 'retired';
        }
        return new Response(null, { status: 204 });
      });
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      const retire = within(rowOf('Equipment')).getByRole('button', { name: 'Retire Equipment' });
      await user.click(retire);

      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() => {
        expect(within(cellOf(rowOf('Equipment'), 'Status')).getByText('Retired')).toBeVisible();
      });
      expect(sent.ids).toEqual([EQUIPMENT_ID]);
      expect(sent.keys[0]).toMatch(/\S+/);
      const again = within(rowOf('Equipment')).getByRole('button', { name: 'Use Equipment again' });
      expect(again).toHaveAttribute('title', 'Use Equipment again');
      expect(again).toHaveFocus();
      expect(await screen.findByText('Category retired')).toBeVisible();
      expect(
        screen.getByText('Equipment no longer shows in the Add Expense form. Past expenses keep it.'),
      ).toBeVisible();
      expect(tokens(cellOf(rowOf('Equipment'), 'Status').className)).toContain('bg-surface-2');
      const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
      expect(keys).toEqual(
        expect.arrayContaining([
          JSON.stringify(expenseCategoriesKey),
          JSON.stringify(expensesKey),
          JSON.stringify(expenseKpisKey),
          JSON.stringify(expensesDeletedKey),
        ]),
      );
    });

    it('Use again flips a retired category back, keeps focus on the flipped action and toasts what it did', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      const sent = reactivateCategoryBackend((id) => {
        const category = state.get(id);
        if (category !== undefined) {
          category.status = 'active';
        }
        return new Response(null, { status: 204 });
      });

      await user.click(within(rowOf('Old subscriptions')).getByRole('button', { name: 'Use Old subscriptions again' }));

      await waitFor(() => {
        expect(within(cellOf(rowOf('Old subscriptions'), 'Status')).getByText('Active')).toBeVisible();
      });
      expect(sent.ids).toEqual([OLD_ID]);
      expect(sent.keys[0]).toMatch(/\S+/);
      expect(
        within(rowOf('Old subscriptions')).getByRole('button', { name: 'Retire Old subscriptions' }),
      ).toHaveFocus();
      expect(await screen.findByText('Category back in use')).toBeVisible();
      expect(screen.getByText('Old subscriptions shows in the Add Expense form again.')).toBeVisible();
    });

    it('shows a persistent danger toast with the mapper line when Retire fails, keeps the status, and a retry reuses the key', async () => {
      const user = userEvent.setup();
      await openLive();
      const sent = retireCategoryBackend(() => problemResponse(500));

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Retire Equipment' }));

      expect(await screen.findByText("Couldn't retire Equipment")).toBeVisible();
      expect(screen.getByText(/Something went wrong/)).toBeVisible();
      expect(within(cellOf(rowOf('Equipment'), 'Status')).getByText('Active')).toBeVisible();

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Retire Equipment' }));

      await waitFor(() => {
        expect(sent.keys).toHaveLength(2);
      });
      expect(sent.keys[1]).toBe(sent.keys[0]);
      // The first toast is still there (a danger toast stays until it is closed), and the second failure adds its own.
      expect(await screen.findAllByText("Couldn't retire Equipment")).toHaveLength(2);
    });

    it("says Couldn't bring back {name} when Use again fails", async () => {
      const user = userEvent.setup();
      await openLive();
      reactivateCategoryBackend(() => problemResponse(500));

      await user.click(within(rowOf('Old subscriptions')).getByRole('button', { name: 'Use Old subscriptions again' }));

      expect(await screen.findByText("Couldn't bring back Old subscriptions")).toBeVisible();
      expect(within(cellOf(rowOf('Old subscriptions'), 'Status')).getByText('Retired')).toBeVisible();
    });

    it('reads the list again when Retire answers 404, so a category deleted meanwhile leaves the table', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      retireCategoryBackend((id) => {
        state.delete(id);
        return problemResponse(404);
      });

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Retire Equipment' }));

      expect(await screen.findByText("Couldn't retire Equipment")).toBeVisible();
      await waitFor(() => {
        expect(within(screen.getByRole('table')).queryByText('Equipment')).toBeNull();
      });
    });

    it('reads the list again when Use again answers 404, so a category deleted meanwhile leaves the table', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      reactivateCategoryBackend((id) => {
        state.delete(id);
        return problemResponse(404);
      });

      await user.click(within(rowOf('Old subscriptions')).getByRole('button', { name: 'Use Old subscriptions again' }));

      expect(await screen.findByText("Couldn't bring back Old subscriptions")).toBeVisible();
      await waitFor(() => {
        expect(within(screen.getByRole('table')).queryByText('Old subscriptions')).toBeNull();
      });
    });
  });

  describe('Delete a never-used category (D-10, D-30)', () => {
    it('opens the confirmation with its title and message, Cancel focused, and sends nothing yet', async () => {
      const user = userEvent.setup();
      await openLive();
      const sent = deleteCategoryBackend();

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));

      const dialog = await screen.findByRole('dialog', { name: DELETE_TITLE });
      expect(within(dialog).getByText(DELETE_MESSAGE)).toBeVisible();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      expect(within(dialog).getByRole('button', { name: 'Delete Category' })).toBeVisible();
      expect(within(dialog).queryByRole('textbox')).toBeNull();
      expect(sent.ids).toEqual([]);
    });

    it('confirming sends the DELETE, drops the row, moves focus to the next row Edit, reads the lists again and toasts', async () => {
      const user = userEvent.setup();
      const { state, calls } = await openLive();
      const sent = deleteCategoryBackend((id) => {
        state.delete(id);
        return new Response(null, { status: 204 });
      });
      const reads = calls.calls.length;
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      await user.click(
        within(await screen.findByRole('dialog', { name: DELETE_TITLE })).getByRole('button', {
          name: 'Delete Category',
        }),
      );

      await waitFor(() => {
        expect(within(screen.getByRole('table')).queryByText('Equipment')).toBeNull();
      });
      expect(sent.ids).toEqual([EQUIPMENT_ID]);
      expect(sent.keys).toEqual([null]);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit Government contributions' })).toHaveFocus();
      });
      expect(await screen.findByText('Category deleted')).toBeVisible();
      await waitFor(() => {
        expect(calls.calls.length).toBeGreaterThan(reads);
      });
      const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
      expect(keys).toEqual(expect.arrayContaining([JSON.stringify(expenseCategoriesKey), JSON.stringify(expensesKey)]));
    });

    it('shows the category name alone in the toast message', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      deleteCategoryBackend((id) => {
        state.delete(id);
        return new Response(null, { status: 204 });
      });

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Category' }));

      const title = await screen.findByText('Category deleted');
      expect(title.parentElement?.textContent).toBe('Category deletedEquipment');
    });

    it('moves focus to the previous row Edit when the last row was deleted', async () => {
      const user = userEvent.setup();
      const pair = [
        categoryItem('11111111-1111-4111-8111-111111111111', 'Alpha', 'info'),
        categoryItem('22222222-2222-4222-8222-222222222222', 'Beta', 'success'),
      ];
      const { state } = await openLive(liveList(pair));
      deleteCategoryBackend((id) => {
        state.delete(id);
        return new Response(null, { status: 204 });
      });

      await user.click(within(rowOf('Beta')).getByRole('button', { name: 'Delete Beta' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Category' }));

      await waitFor(() => {
        expect(within(screen.getByRole('table')).queryByText('Beta')).toBeNull();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit Alpha' })).toHaveFocus();
      });
    });

    it('moves focus to the card heading when the only row was deleted', async () => {
      const user = userEvent.setup();
      const only = [categoryItem('11111111-1111-4111-8111-111111111111', 'Alpha', 'info')];
      const { state } = await openLive(liveList(only));
      deleteCategoryBackend((id) => {
        state.delete(id);
        return new Response(null, { status: 204 });
      });

      await user.click(within(rowOf('Alpha')).getByRole('button', { name: 'Delete Alpha' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Category' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: 'Expense Categories' })).toHaveFocus();
      });
    });

    it('keeps the dialog open on a server failure, with the mapper line as an alert and focus on the confirm button', async () => {
      const user = userEvent.setup();
      await openLive();
      deleteCategoryBackend(() => problemResponse(500));

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      const dialog = await screen.findByRole('dialog', { name: DELETE_TITLE });
      await user.click(within(dialog).getByRole('button', { name: 'Delete Category' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Something went wrong/);
      expect(within(dialog).getByRole('button', { name: 'Delete Category' })).toHaveFocus();
      expect(within(rowOf('Equipment')).getByText('Equipment')).toBeVisible();
    });

    it('keeps the dialog open on 422 in-use with the refusal, reads the list again and drops the Delete action', async () => {
      const user = userEvent.setup();
      const { state } = await openLive();
      deleteCategoryBackend(() => {
        const category = state.get(EQUIPMENT_ID);
        if (category !== undefined) {
          category.expenseCount = 1;
        }
        return codedProblemResponse(422, 'expense-categories.in-use');
      });

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      const dialog = await screen.findByRole('dialog', { name: DELETE_TITLE });
      await user.click(within(dialog).getByRole('button', { name: 'Delete Category' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent(
        "Equipment is now used by an expense, so it can't be deleted. Retire it instead to hide it from the Add Expense form.",
      );
      expect(dialog).toBeVisible();
      await waitFor(() => {
        expect(within(rowOf('Equipment')).queryByRole('button', { name: 'Delete Equipment' })).toBeNull();
      });
      expect(cellOf(rowOf('Equipment'), 'Expenses')).toHaveTextContent('1');
    });

    it('closes with Cancel and sends nothing', async () => {
      const user = userEvent.setup();
      await openLive();
      const sent = deleteCategoryBackend();

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(sent.ids).toEqual([]);
    });

    it('has no axe violations with the dialog open', async () => {
      const user = userEvent.setup();
      const { view } = await openLive();

      await user.click(within(rowOf('Equipment')).getByRole('button', { name: 'Delete Equipment' }));
      await screen.findByRole('dialog', { name: DELETE_TITLE });

      await expectNoAxeViolations(view.container);
      await expectNoAxeViolations(screen.getByRole('dialog', { name: DELETE_TITLE }));
    });
  });
});
