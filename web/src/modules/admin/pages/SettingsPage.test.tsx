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
import { expensesDeletedKey, expensesKey } from '@/modules/admin/hooks/useExpensesQuery';
import { SettingsRoute } from '@/modules/admin/pages/SettingsPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoriesBackend,
  categoryDetail,
  categoryDetailBackend,
  createCategoryBackend,
  EXPENSE_CATEGORIES,
  problemResponse,
  RENT,
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
