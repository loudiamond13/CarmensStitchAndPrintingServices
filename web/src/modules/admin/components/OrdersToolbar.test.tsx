import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { OrdersToolbar } from '@/modules/admin/components/OrdersToolbar';
import { useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';
import { expectNoAxeViolations } from '@/test/axe';

// The Orders toolbar (ORD-02, D-55, WEB-10; plan 08-09). It reads and writes the URL only through useOrdersListParams.

function Harness() {
  const [values, set] = useOrdersListParams();
  return <OrdersToolbar values={values} set={set} />;
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

afterEach(() => {
  vi.useRealTimers();
});

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
