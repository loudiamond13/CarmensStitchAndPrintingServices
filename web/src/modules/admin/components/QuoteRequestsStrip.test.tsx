import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { QuoteRequestsStrip } from '@/modules/admin/components/QuoteRequestsStrip';
import {
  moneyStripActionsClasses,
  moneyStripClasses,
  moneyStripFigureClasses,
  moneyStripTileClasses,
  moneyStripToneClasses,
} from '@/modules/admin/components/money.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import { useNewQuoteCountQuery, type NewQuoteCountQuery } from '@/modules/admin/hooks/useNewQuoteCountQuery';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// The dashboard strip of new quote requests (D-19, UI-SPEC R4): the inbox tile, the server's New count and a link to the inbox,
// in the MoneyStrip look, with its own loading and failure states.

const COPY = DASHBOARD_COPY.quotes;

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function queryOf(overrides: Partial<NewQuoteCountQuery> = {}): NewQuoteCountQuery {
  const isFetching = overrides.data === undefined && overrides.isError !== true;
  return { data: undefined, isError: false, isFetching, refetch: vi.fn(), ...overrides };
}

function renderStrip(query: NewQuoteCountQuery) {
  return render(
    <MemoryRouter>
      <QuoteRequestsStrip query={query} />
    </MemoryRouter>,
  );
}

function strip(): HTMLElement {
  return screen.getByRole('region', { name: COPY.label });
}

describe('QuoteRequestsStrip (D-19, UI-SPEC R4)', () => {
  it('keeps its words in the dashboard copy', () => {
    expect(COPY).toMatchObject({
      label: 'New quote requests',
      open: 'Open Quote Requests',
      things: 'the new quote requests',
      failed: "Couldn't load the new requests.",
      retry: 'Try Again',
    });
  });

  it('with 3 shows the inbox tile, the label over the figure and the link to the inbox', () => {
    const { container } = renderStrip(queryOf({ data: 3 }));
    const region = strip();

    expect(hasClasses(region, moneyStripClasses)).toBe(true);
    const tile = container.querySelector('svg.lucide-inbox')?.parentElement;
    expect(hasClasses(tile, moneyStripTileClasses)).toBe(true);
    expect(tokens(moneyStripTileClasses)).toContain('pg-phone:hidden');
    const figure = within(region).getByText('3');
    expect(hasClasses(figure, moneyStripFigureClasses)).toBe(true);
    expect(hasClasses(figure, moneyStripToneClasses.plain)).toBe(true);
    const label = within(region).getByText(COPY.label);
    expect(label.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const link = within(region).getByRole('link', { name: COPY.open });
    expect(link).toHaveAttribute('href', '/admin/quote-requests');
    expect(hasClasses(link.parentElement, moneyStripActionsClasses)).toBe(true);
  });

  it('dims the figure at 0, as the KPI cards dim a zero (D-39)', () => {
    renderStrip(queryOf({ data: 0 }));

    expect(hasClasses(within(strip()).getByText('0'), moneyStripToneClasses.zero)).toBe(true);
  });

  it('shows the exact count, with no 99+ cap', () => {
    renderStrip(queryOf({ data: 1250 }));

    expect(within(strip()).getByText('1,250')).toBeInTheDocument();
  });

  it('while loading shows a 24px skeleton in a busy region named for the new quote requests', () => {
    renderStrip(queryOf());

    const busy = strip().querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    const skeleton = busy?.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(skeleton?.style.getPropertyValue('--sk-h')).toBe('24px');
    expect(screen.getByRole('status')).toHaveTextContent('Loading the new quote requests');
    expect(within(strip()).getByRole('link', { name: COPY.open })).toBeInTheDocument();
  });

  it('when the read fails shows the failure line with Try Again, and the link still works', async () => {
    const query = queryOf({ isError: true, isFetching: false });
    renderStrip(query);

    expect(within(strip()).getByRole('alert')).toHaveTextContent(COPY.failed);
    expect(within(strip()).queryByText('0')).toBeNull();
    const retry = within(strip()).getByRole('button', { name: COPY.retry });
    await userEvent.click(retry);
    expect(query.refetch).toHaveBeenCalledOnce();
    expect(within(strip()).getByRole('link', { name: COPY.open })).toHaveAttribute('href', '/admin/quote-requests');
  });

  it('never shows an older count after a failed read', () => {
    renderStrip(queryOf({ data: 4, isError: true, isFetching: false }));

    expect(within(strip()).queryByText('4')).toBeNull();
    expect(within(strip()).getByRole('alert')).toHaveTextContent(COPY.failed);
  });

  it('keeps the same failure line while a read runs again, with Try Again busy, so nothing is read out twice', () => {
    renderStrip(queryOf({ isError: true, isFetching: true }));

    expect(within(strip()).getByRole('alert')).toHaveTextContent(COPY.failed);
    expect(within(strip()).getByRole('button', { name: COPY.retry })).toHaveAttribute('aria-busy', 'true');
    expect(strip().querySelector('[aria-busy="true"]:not(button)')).toBeNull();
  });

  it.each<[string, Partial<NewQuoteCountQuery>]>([
    ['3', { data: 3 }],
    ['0', { data: 0 }],
    ['loading', {}],
    ['failed', { isError: true, isFetching: false }],
  ])('has no axe violations (%s)', async (_state, overrides) => {
    const { container } = renderStrip(queryOf(overrides));
    await expectNoAxeViolations(container);
  });
});

describe('QuoteRequestsStrip fed by the shared count query', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  function Fed() {
    return <QuoteRequestsStrip query={useNewQuoteCountQuery()} />;
  }

  it('shows the server count, and Try Again after a failure reads again', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/quote-requests/new-count', () => {
        reads += 1;
        return reads <= 3
          ? HttpResponse.json({ title: 'x', status: 500 }, { status: 500 })
          : HttpResponse.json({ count: 7 });
      }),
    );
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Fed />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: COPY.retry }, { timeout: 5000 }));

    await waitFor(() => {
      expect(within(strip()).getByText('7')).toBeInTheDocument();
    });
    expect(within(strip()).queryByRole('alert')).toBeNull();
  }, 10_000);
});
