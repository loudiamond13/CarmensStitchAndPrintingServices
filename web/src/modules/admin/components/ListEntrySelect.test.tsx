import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { expectNoAxeViolations } from '@/test/axe';
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
    listBackend('product-types', [...PRODUCT_TYPES, entry('d4c3b2a1-0f9e-4d8c-8b7a-1a2b3c4d5e6f', 'Old Cut', { status: 'retired' })]);
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
