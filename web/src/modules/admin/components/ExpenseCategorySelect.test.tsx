import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { expectNoAxeViolations } from '@/test/axe';
import {
  categoriesBackend,
  EXPENSE_CATEGORIES,
  problemResponse,
  RENT,
  RETIRED_CATEGORY_ID,
} from '@/test/expenseFixtures';
import { ExpenseCategorySelect } from './ExpenseCategorySelect';

// The category Select in filter mode (D-11, D-15; plan 06-07): every category in the server's order, retired ones marked.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function renderSelect(value: string | null = null, onChange: (id: string | null) => void = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpenseCategorySelect mode="filter" value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
}

function optionTexts(select: HTMLElement): (string | null)[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('ExpenseCategorySelect filter mode', () => {
  it('lists All categories first, then every category in the given order, retired ones as "{name} (retired)"', async () => {
    categoriesBackend();
    renderSelect();

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([
      'All categories',
      'Equipment',
      'Government contributions',
      'Maintenance',
      'Old subscriptions (retired)',
      'Rent',
      'Salaries',
      'Supplies',
      'Taxes and permits',
      'Transport and fuel',
      'Utilities',
      'Others',
    ]);
  });

  it('keeps the server order: it does not sort', async () => {
    categoriesBackend([...EXPENSE_CATEGORIES].reverse());
    renderSelect();

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select).slice(0, 3)).toEqual(['All categories', 'Others', 'Utilities']);
  });

  it('is disabled and reads "Loading categories…" while the list loads', async () => {
    categoriesBackend(async () => {
      await delay(120);
      return EXPENSE_CATEGORIES;
    });
    renderSelect();

    const select = screen.getByRole('combobox', { name: 'Category' });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual(['Loading categories…']);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)[0]).toBe('All categories');
  });

  it('selects the category in value and reports a choice as its id, and All categories as null', async () => {
    categoriesBackend();
    const onChange = vi.fn<(id: string | null) => void>();
    renderSelect(RENT.id, onChange);
    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    expect(select).toHaveValue(RENT.id);
    await userEvent.selectOptions(select, 'Utilities');
    expect(onChange).toHaveBeenLastCalledWith('51702a8f-81e4-4a20-8e39-2d4b270793de');
    await userEvent.selectOptions(select, 'All categories');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('stays usable as All categories when the list cannot be read', async () => {
    categoriesBackend(() => problemResponse(500));
    renderSelect();

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual(['All categories']);
  });

  it('has no axe violations while loading and once loaded', async () => {
    categoriesBackend(async () => {
      await delay(60);
      return EXPENSE_CATEGORIES;
    });
    const view = renderSelect();

    await expectNoAxeViolations(view.container);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Category' })).toBeEnabled();
    });
    await expectNoAxeViolations(view.container);
  });
});

describe('ExpenseCategorySelect picker mode', () => {
  function renderPicker(
    props: { value?: string; onChange?: (id: string) => void; savedCategoryId?: string | null; error?: string } = {},
  ) {
    return render(
      <QueryClientProvider client={queryClient}>
        <ExpenseCategorySelect
          mode="picker"
          value={props.value ?? ''}
          onChange={props.onChange ?? (() => undefined)}
          savedCategoryId={props.savedCategoryId ?? null}
          error={props.error}
        />
      </QueryClientProvider>,
    );
  }

  it('lists only active categories under "Choose a category" with nothing selected', async () => {
    categoriesBackend();
    renderPicker();

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([
      'Choose a category',
      'Equipment',
      'Government contributions',
      'Maintenance',
      'Rent',
      'Salaries',
      'Supplies',
      'Taxes and permits',
      'Transport and fuel',
      'Utilities',
      'Others',
    ]);
    expect(select).toHaveValue('');
  });

  it('is disabled and reads "Loading categories…" while the list loads', async () => {
    categoriesBackend(async () => {
      await delay(120);
      return EXPENSE_CATEGORIES;
    });
    renderPicker();

    const select = screen.getByRole('combobox', { name: 'Category' });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual(['Loading categories…']);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
  });

  it('reports the chosen category id and shows a given error', async () => {
    categoriesBackend();
    const onChange = vi.fn<(id: string) => void>();
    renderPicker({ onChange, error: 'Choose a category.' });
    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    await userEvent.selectOptions(select, 'Rent');

    expect(onChange).toHaveBeenLastCalledWith(RENT.id);
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
  });

  it('keeps a saved retired category as "{name} (retired)" so an edit can leave it alone', async () => {
    categoriesBackend();
    renderPicker({ value: RETIRED_CATEGORY_ID, savedCategoryId: RETIRED_CATEGORY_ID });
    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    expect(optionTexts(select)).toContain('Old subscriptions (retired)');
    expect(select).toHaveValue(RETIRED_CATEGORY_ID);
  });

  it('has no axe violations', async () => {
    categoriesBackend();
    const view = renderPicker();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Category' })).toBeEnabled();
    });

    await expectNoAxeViolations(view.container);
  });
});
