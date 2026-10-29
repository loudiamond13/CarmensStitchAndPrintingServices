import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { expectNoAxeViolations } from '@/test/axe';
import { categoriesBackend, EXPENSE_CATEGORIES, problemResponse, RETIRED_CATEGORY_ID } from '@/test/expenseFixtures';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';
import { ListEntrySelect, type ListEntrySelectProps } from './ListEntrySelect';

// The one picker and filter for the order lists (plan 08-04, D-32, UIC-15, UIC-44): active entries in the server order,
// the record's own retired entry kept as "{name} (retired)", and a disabled loading name while the list loads.

type Item = components['schemas']['OrderListItem'];

const RETIRED_TYPE_ID = '8c1a2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const BASKETBALL_ID = '3b0a4a6e-5d7c-4c31-9a58-2f6f6f0c1a11';

function entry(id: string, name: string, overrides: Partial<Item> = {}): Item {
  return { id, name, tone: 'neutral', status: 'active', isOthers: false, useCount: 0, ...overrides };
}

const PRODUCT_TYPES: readonly Item[] = [
  entry(BASKETBALL_ID, 'Basketball Jersey'),
  entry('0f7e1d2c-3b4a-4958-8677-665544332211', 'Custom Design'),
  entry(RETIRED_TYPE_ID, 'Moto Riding Jersey', { status: 'retired', useCount: 4 }),
  entry('a1b2c3d4-e5f6-4a07-8c19-2a3b4c5d6e7f', 'Polo Shirt'),
];

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

type Answer = readonly Item[] | (() => readonly Item[] | Response | Promise<readonly Item[] | Response>);

function listBackend(path: string, answer: Answer): void {
  server.use(
    http.get(`*/api/v1/${path}`, async () => {
      const body = typeof answer === 'function' ? await answer() : answer;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
}

function failing(): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status: 500 }), {
    status: 500,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

function renderSelect(props: ListEntrySelectProps) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ListEntrySelect {...props} />
    </QueryClientProvider>,
  );
}

function optionTexts(select: HTMLElement): (string | null)[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('ListEntrySelect product types, picker mode', () => {
  function renderPicker(extra: { value?: string; savedEntry?: string | null; error?: string } = {}) {
    return renderSelect({
      list: 'product-types',
      mode: 'picker',
      value: extra.value ?? '',
      onChange: () => undefined,
      savedEntry: extra.savedEntry ?? null,
      error: extra.error,
    });
  }

  it('lists only active entries under "Choose a product type" with nothing chosen', async () => {
    listBackend('product-types', PRODUCT_TYPES);
    renderPicker();

    const select = screen.getByRole('combobox', { name: /Product type/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual(['Choose a product type', 'Basketball Jersey', 'Custom Design', 'Polo Shirt']);
    expect(select).toHaveValue('');
  });

  it('keeps the saved retired entry as "{name} (retired)", selected, and hides every other retired entry', async () => {
    listBackend('product-types', [
      ...PRODUCT_TYPES,
      entry('d4c3b2a1-0f9e-4d8c-8b7a-1a2b3c4d5e6f', 'Old Cut', { status: 'retired' }),
    ]);
    renderPicker({ value: RETIRED_TYPE_ID, savedEntry: RETIRED_TYPE_ID });

    const select = screen.getByRole('combobox', { name: /Product type/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([
      'Choose a product type',
      'Basketball Jersey',
      'Custom Design',
      'Moto Riding Jersey (retired)',
      'Polo Shirt',
    ]);
    expect(select).toHaveValue(RETIRED_TYPE_ID);
  });

  it('is disabled and named "Loading product types…" while the list loads', async () => {
    listBackend('product-types', async () => {
      await delay(120);
      return PRODUCT_TYPES;
    });
    renderPicker();

    const select = screen.getByRole('combobox', { name: /Product type/ });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual(['Loading product types…']);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
  });

  it('reports the chosen id and shows a given error', async () => {
    listBackend('product-types', PRODUCT_TYPES);
    const onChange = vi.fn<(id: string) => void>();
    renderSelect({ list: 'product-types', mode: 'picker', value: '', onChange, error: 'Choose a product type.' });
    const select = screen.getByRole('combobox', { name: /Product type/ });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    await userEvent.selectOptions(select, 'Polo Shirt');

    expect(onChange).toHaveBeenLastCalledWith('a1b2c3d4-e5f6-4a07-8c19-2a3b4c5d6e7f');
    expect(screen.getByText('Choose a product type.')).toBeInTheDocument();
  });

  it('stays disabled with a message when the list cannot be read', async () => {
    listBackend('product-types', failing);
    renderPicker();

    expect(await screen.findByText(/Couldn't load the product types/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Product type/ })).toBeDisabled();
  });

  it('has no axe violations while loading and once loaded', async () => {
    listBackend('product-types', async () => {
      await delay(60);
      return PRODUCT_TYPES;
    });
    const view = renderPicker();

    await expectNoAxeViolations(view.container);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Product type/ })).toBeEnabled();
    });
    await expectNoAxeViolations(view.container);
  });
});

const RETIRED_METHOD_ID = '5d4c3b2a-1f0e-4d9c-8b8a-7a6b5c4d3e2f';
const PAYMENT_METHODS: readonly Item[] = [
  entry('11111111-aaaa-4bbb-8ccc-000000000001', 'Bank Transfer'),
  entry('11111111-aaaa-4bbb-8ccc-000000000002', 'Cash'),
  entry(RETIRED_METHOD_ID, 'Cheque', { status: 'retired' }),
  entry('11111111-aaaa-4bbb-8ccc-000000000004', 'GCash'),
];

const RETIRED_ORDER_CATEGORY_ID = '9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a';
const ORDER_CATEGORIES: readonly Item[] = [
  entry('22222222-aaaa-4bbb-8ccc-000000000001', 'Delivery'),
  entry('22222222-aaaa-4bbb-8ccc-000000000002', 'Fabric'),
  entry(RETIRED_ORDER_CATEGORY_ID, 'Outsourcing', { status: 'retired' }),
  entry('22222222-aaaa-4bbb-8ccc-000000000004', 'Others', { isOthers: true }),
];

describe.each([
  {
    list: 'payment-methods',
    items: PAYMENT_METHODS,
    retiredId: RETIRED_METHOD_ID,
    label: /Method/,
    placeholder: 'Choose a method',
    loading: 'Loading methods…',
    active: ['Bank Transfer', 'Cash', 'GCash'],
    retiredLabel: 'Cheque (retired)',
  },
  {
    list: 'order-expense-categories',
    items: ORDER_CATEGORIES,
    retiredId: RETIRED_ORDER_CATEGORY_ID,
    label: /Category/,
    placeholder: 'Choose a category',
    loading: 'Loading categories…',
    active: ['Delivery', 'Fabric', 'Others'],
    retiredLabel: 'Outsourcing (retired)',
  },
] as const)('ListEntrySelect $list, picker mode', (scenario) => {
  function renderPicker(extra: { value?: string; savedEntry?: string | null } = {}) {
    return renderSelect({
      list: scenario.list,
      mode: 'picker',
      value: extra.value ?? '',
      onChange: () => undefined,
      savedEntry: extra.savedEntry ?? null,
    });
  }

  it(`lists only active entries under "${scenario.placeholder}" with nothing chosen`, async () => {
    listBackend(scenario.list, scenario.items);
    renderPicker();

    const select = screen.getByRole('combobox', { name: scenario.label });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([scenario.placeholder, ...scenario.active]);
    expect(select).toHaveValue('');
  });

  it('keeps the saved retired entry as "{name} (retired)", selected', async () => {
    listBackend(scenario.list, scenario.items);
    renderPicker({ value: scenario.retiredId, savedEntry: scenario.retiredId });

    const select = screen.getByRole('combobox', { name: scenario.label });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toContain(scenario.retiredLabel);
    expect(select).toHaveValue(scenario.retiredId);
  });

  it(`is disabled and named "${scenario.loading}" while the list loads`, async () => {
    listBackend(scenario.list, async () => {
      await delay(120);
      return scenario.items;
    });
    renderPicker();

    const select = screen.getByRole('combobox', { name: scenario.label });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual([scenario.loading]);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
  });

  it('has no axe violations once loaded', async () => {
    listBackend(scenario.list, scenario.items);
    const view = renderPicker();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: scenario.label })).toBeEnabled();
    });

    await expectNoAxeViolations(view.container);
  });
});

describe('ListEntrySelect product types, filter mode', () => {
  function renderFilter(value: string | null = null, onChange: (id: string | null) => void = () => undefined) {
    return renderSelect({ list: 'product-types', mode: 'filter', value, onChange });
  }

  it('lists All products first, then every entry in the server order, retired ones as "{name} (retired)"', async () => {
    listBackend('product-types', PRODUCT_TYPES);
    renderFilter();

    const select = screen.getByRole('combobox', { name: 'Product type' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([
      'All products',
      'Basketball Jersey',
      'Custom Design',
      'Moto Riding Jersey (retired)',
      'Polo Shirt',
    ]);
  });

  it('is disabled and named "Loading product types…" while the list loads', async () => {
    listBackend('product-types', async () => {
      await delay(120);
      return PRODUCT_TYPES;
    });
    renderFilter();

    const select = screen.getByRole('combobox', { name: 'Product type' });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual(['Loading product types…']);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
  });

  it('selects the entry in value and reports a choice as its id, and All products as null', async () => {
    listBackend('product-types', PRODUCT_TYPES);
    const onChange = vi.fn<(id: string | null) => void>();
    renderFilter(BASKETBALL_ID, onChange);
    const select = screen.getByRole('combobox', { name: 'Product type' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    expect(select).toHaveValue(BASKETBALL_ID);
    await userEvent.selectOptions(select, 'Polo Shirt');
    expect(onChange).toHaveBeenLastCalledWith('a1b2c3d4-e5f6-4a07-8c19-2a3b4c5d6e7f');
    await userEvent.selectOptions(select, 'All products');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('stays usable as All products when the list cannot be read', async () => {
    listBackend('product-types', failing);
    renderFilter();

    const select = screen.getByRole('combobox', { name: 'Product type' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual(['All products']);
  });
});

describe('ListEntrySelect expense-categories (company expenses)', () => {
  it('filter mode lists All categories, then every category in the server order, retired ones marked', async () => {
    categoriesBackend();
    renderSelect({ list: 'expense-categories', mode: 'filter', value: null, onChange: () => undefined });

    const select = screen.getByRole('combobox', { name: 'Category' });
    expect(select).toBeDisabled();
    expect(optionTexts(select)).toEqual(['Loading categories…']);
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toEqual([
      'All categories',
      ...EXPENSE_CATEGORIES.map((category) =>
        category.status === 'retired' ? `${category.name} (retired)` : category.name,
      ),
    ]);
  });

  it('picker mode lists only active categories under "Choose a category" and names the field categoryId', async () => {
    categoriesBackend();
    const view = renderSelect({
      list: 'expense-categories',
      mode: 'picker',
      value: '',
      onChange: () => undefined,
      savedEntry: null,
    });

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)[0]).toBe('Choose a category');
    expect(optionTexts(select)).not.toContain('Old subscriptions');
    expect(optionTexts(select)).not.toContain('Old subscriptions (retired)');
    expect(select).toHaveAttribute('name', 'categoryId');
    await expectNoAxeViolations(view.container);
  });

  it('picker mode keeps the saved retired category as "{name} (retired)"', async () => {
    categoriesBackend();
    renderSelect({
      list: 'expense-categories',
      mode: 'picker',
      value: RETIRED_CATEGORY_ID,
      onChange: () => undefined,
      savedEntry: RETIRED_CATEGORY_ID,
    });

    const select = screen.getByRole('combobox', { name: 'Category' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect(optionTexts(select)).toContain('Old subscriptions (retired)');
    expect(select).toHaveValue(RETIRED_CATEGORY_ID);
  });

  it('picker mode is disabled with the Phase 6 message when the list cannot be read', async () => {
    categoriesBackend(() => problemResponse(500));
    renderSelect({ list: 'expense-categories', mode: 'picker', value: '', onChange: () => undefined });

    expect(await screen.findByText("Couldn't load the categories. Close this form and try again.")).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
  });
});
