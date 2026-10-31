import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { OrdersToolbar } from '@/modules/admin/components/OrdersToolbar';
import { useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';
import { useOrdersView } from '@/modules/admin/hooks/useOrdersView';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { BASKETBALL_ID, CYCLING_ID, PRODUCT_TYPES } from '@/test/orderListFixtures';

// The Orders toolbar (ORD-02, D-55, WEB-10; plan 08-09). It reads and writes the URL only through useOrdersListParams.

function Harness() {
  const [values, set] = useOrdersListParams();
  const { view, setView } = useOrdersView(values, set);
  return <OrdersToolbar values={values} set={set} view={view} onViewChange={setView} />;
}

function renderToolbar(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <Harness />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

function updates(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

beforeEach(() => {
  server.use(http.get('*/api/v1/product-types', () => HttpResponse.json(PRODUCT_TYPES)));
});

afterEach(() => {
  vi.useRealTimers();
});

function optionTexts(select: HTMLElement): (string | null)[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('the search box (ORD-02, D-55)', () => {
  it('sits in a search landmark labelled Search with the D-55 placeholder, capped at 100', () => {
    renderToolbar();

    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(screen.getByRole('search')).toContainElement(search);
    expect(search).toHaveAttribute('placeholder', 'Order no., customer, team or phone');
    expect(search).toHaveAttribute('maxlength', '100');
  });

  it('writes a typed search after 300 ms with one replace', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('', onUrlUpdate);

    const search = screen.getByRole('searchbox', { name: 'Search' });
    for (const text of ['0', '01', '014', '0148']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=0148' }]);
    });
  });

  it('cuts a pasted text of 101 characters to 100', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('', onUrlUpdate);

    const search = screen.getByRole('searchbox', { name: 'Search' });
    await userEvent.click(search);
    await userEvent.paste('b'.repeat(101));

    expect(search).toHaveValue('b'.repeat(100));
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?q=${'b'.repeat(100)}` }]);
    });
  });

  it('takes the search already in the URL', () => {
    renderToolbar('?q=ballers');

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('ballers');
  });

  it('has no axe violations', async () => {
    const view = renderToolbar();

    await expectNoAxeViolations(view.container);
  });
});

describe('the controls and their words (ORD-02, UI-SPEC L1 toolbar)', () => {
  it('has Search, Status, Order date, Product type, the balance box and Sort by, in that order', async () => {
    renderToolbar();

    const bar = screen.getByRole('search');
    const controls = [...bar.querySelectorAll('input[type="search"], select, input[type="checkbox"]')];
    expect(controls).toHaveLength(6);
    expect(controls.map((control) => control.getAttribute('type') ?? control.tagName.toLowerCase())).toEqual([
      'search',
      'select',
      'select',
      'select',
      'checkbox',
      'select',
    ]);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Order date' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Product type' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Only orders with a balance' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
  });

  it('offers Active + recent first, then All statuses and the seven statuses', () => {
    renderToolbar();

    const status = screen.getByRole('combobox', { name: 'Status' });
    expect(optionTexts(status)).toEqual([
      'Active + recent',
      'All statuses',
      'Pending',
      'Mockup',
      'In Production',
      'Ready',
      'Delivered',
      'Completed',
      'Cancelled',
    ]);
    expect(status).toHaveValue('active');
  });

  it('starts Order date at Any date (D-42) and offers the four ranges', () => {
    renderToolbar();

    const dates = screen.getByRole('combobox', { name: 'Order date' });
    expect(optionTexts(dates)).toEqual(['Any date', 'Last 30 days', 'Last 90 days', 'This month', 'Custom range…']);
    expect(dates).toHaveValue('');
  });

  it('offers the four sorts with Due date (soonest) first', () => {
    renderToolbar();

    const sort = screen.getByRole('combobox', { name: 'Sort by' });
    expect(optionTexts(sort)).toEqual(['Due date (soonest)', 'Newest first', 'Balance (highest)', 'Total (highest)']);
    expect(sort).toHaveValue('due');
  });

  it('lists the product types in filter mode: All products first, a retired type labelled', async () => {
    renderToolbar();

    const product = await screen.findByRole('combobox', { name: 'Product type' });
    await waitFor(() => {
      expect(product).toBeEnabled();
    });
    expect(optionTexts(product)).toEqual([
      'All products',
      'Basketball Jersey',
      'Cycling Jersey',
      'Old Style Jersey (retired)',
    ]);
  });

  it('shows the values already in the URL', async () => {
    renderToolbar(`?status=delivered&dates=90d&sort=balance&hasBalance=true&productType=${CYCLING_ID}`);

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('delivered');
    expect(screen.getByRole('combobox', { name: 'Order date' })).toHaveValue('90d');
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('balance');
    expect(screen.getByRole('checkbox', { name: 'Only orders with a balance' })).toBeChecked();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue(CYCLING_ID);
    });
  });

  it('has no axe violations with every control shown', async () => {
    const view = renderToolbar('?status=delivered&dates=custom&from=2026-10-01&to=2026-10-31');

    await screen.findByRole('combobox', { name: 'Product type' });
    await expectNoAxeViolations(view.container);
  });
});

describe('a filter change replaces the entry and resets the page (ORD-02, EDGE adjacency)', () => {
  it('Status writes the key with one replace from page 3', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=3', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Delivered');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?status=delivered' }]);
    });
  });

  it('choosing Active + recent again removes the status from the URL', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?status=delivered', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Active + recent');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });

  it.each([
    ['Newest first', 'newest'],
    ['Balance (highest)', 'balance'],
    ['Total (highest)', 'total'],
  ])('Sort by %s writes sort=%s', async (label, key) => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=2', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), label);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?sort=${key}` }]);
    });
  });

  it.each([
    ['Last 30 days', '30d'],
    ['Last 90 days', '90d'],
    ['This month', 'month'],
  ])('Order date %s writes dates=%s and no from or to', async (label, key) => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=2', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Order date' }), label);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?dates=${key}` }]);
    });
  });

  it('Any date removes the preset', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?dates=30d', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Order date' }), 'Any date');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
  });

  it('Product type writes the id, and All products removes it', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=2', onUrlUpdate);
    const product = await screen.findByRole('combobox', { name: 'Product type' });
    await waitFor(() => {
      expect(product).toBeEnabled();
    });

    await userEvent.selectOptions(product, 'Basketball Jersey');
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: `?productType=${BASKETBALL_ID}` }]);
    });

    await userEvent.selectOptions(product, 'All products');
    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
  });

  it('the balance box writes hasBalance=true when ticked and removes it when cleared (D-43)', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=2', onUrlUpdate);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Only orders with a balance' }));
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?hasBalance=true' }]);
    });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Only orders with a balance' }));
    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
  });
});

describe('the custom range (ORD-02, UIC-45, OR-3)', () => {
  async function chooseCustom(): Promise<void> {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Order date' }), 'Custom range…');
  }

  function setDate(label: 'From' | 'To', value: string): void {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it('shows From and To only for a custom range, and writes nothing to the URL until both apply', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('', onUrlUpdate);
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();

    await chooseCustom();

    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Order date' })).toHaveValue('custom');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('applies the range once both dates are real and From is not after To', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=3', onUrlUpdate);
    await chooseCustom();

    setDate('From', '2026-10-01');
    expect(onUrlUpdate).not.toHaveBeenCalled();
    setDate('To', '2026-10-31');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([
        { history: 'replace', query: '?dates=custom&from=2026-10-01&to=2026-10-31' },
      ]);
    });
  });

  it('applies From equal to To as a one-day range', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('', onUrlUpdate);
    await chooseCustom();

    setDate('From', '2026-10-05');
    setDate('To', '2026-10-05');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([
        { history: 'replace', query: '?dates=custom&from=2026-10-05&to=2026-10-05' },
      ]);
    });
  });

  it('says Enter a real date. under the empty date of a half-filled range and does not apply it', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('', onUrlUpdate);
    await chooseCustom();

    setDate('From', '2026-10-01');

    expect(await screen.findByText('Enter a real date.')).toBeVisible();
    expect(screen.getByLabelText('To')).toHaveAccessibleDescription('Enter a real date.');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("says The end date can't be before the start date. for From after To and keeps the last applied range", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?dates=custom&from=2026-10-01&to=2026-10-31', onUrlUpdate);

    setDate('From', '2026-11-15');

    expect(await screen.findByText("The end date can't be before the start date.")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('shows the applied range in the inputs when the URL has one', () => {
    renderToolbar('?dates=custom&from=2026-10-01&to=2026-10-31');

    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-31');
    expect(screen.getByRole('combobox', { name: 'Order date' })).toHaveValue('custom');
  });

  it('closes the inputs when another range is chosen', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?dates=custom&from=2026-10-01&to=2026-10-31', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Order date' }), 'This month');

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?dates=month' }]);
    });
    expect(screen.queryByLabelText('From')).toBeNull();
  });
});

describe('the View switch (ORD-10, plan 08-11)', () => {
  it('sits last in the search landmark as an icon-only group of two radios', () => {
    renderToolbar();

    const group = screen.getByRole('radiogroup', { name: 'View' });
    expect(screen.getByRole('search')).toContainElement(group);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Grid view', 'Table view']);
    expect(radios.map((radio) => radio.getAttribute('title'))).toEqual(['Grid view', 'Table view']);
    expect(radios.map((radio) => radio.textContent)).toEqual(['', '']);
  });

  it('checks the view the URL names', () => {
    renderToolbar('?view=table');

    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Grid view' })).not.toBeChecked();
  });

  it('writes the chosen view with one replace and leaves the other filters alone', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderToolbar('?page=2&status=delivered', onUrlUpdate);

    await userEvent.click(screen.getByRole('radio', { name: 'Table view' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=2&status=delivered&view=table' }]);
    });
  });

  it('has no axe violations', async () => {
    const view = renderToolbar('?view=table');

    await expectNoAxeViolations(view.container);
  });
});
