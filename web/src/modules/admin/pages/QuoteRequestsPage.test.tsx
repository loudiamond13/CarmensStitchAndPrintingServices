import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import QuoteRequestsPage from '@/modules/admin/pages/QuoteRequestsPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { quoteRequestId, quoteRequestItem, quoteRequestList, quoteRequestsBackend } from '@/test/quoteRequestFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';

// R1 Quote Requests inbox, /admin/quote-requests (INQ-05, D-13, D-18; plan 13-15).

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

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter initialEntries={[`/admin/quote-requests${search}`]}>
          <ToastProvider>
            <QuoteRequestsPage />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

const FIRST = quoteRequestId(1);
const SECOND = quoteRequestId(2);

const ROWS = [
  quoteRequestItem(FIRST),
  quoteRequestItem(SECOND, {
    receivedAtUtc: '2026-11-20T01:05:00Z',
    customerName: 'Ana Lopez',
    teamName: null,
    contactNumber: '0918 555 0202',
    product: null,
    quantity: null,
    photoCount: 0,
    storedPhotoCount: 0,
    status: 'contacted',
  }),
];

/** The URL writes nuqs made, as history mode and query string. */
function updates(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

/** The body row whose name link is `name`. */
async function rowOf(name: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name });
  const row = link.closest('tr');
  if (row === null) throw new Error(`No row holds ${name}.`);
  return row;
}

describe('the inbox opens on the open requests, newest first (INQ-05, D-18)', () => {
  it('shows the page head, the subline and the document title', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Quote Requests' })).toBeVisible();
    expect(screen.getByText('Requests sent from the Get a Quote form on the website.')).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Quote Requests · CSPS Admin');
    });
  });

  it('asks for the open group, page 1 and 20 rows, with no search', async () => {
    const backend = quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    await rowOf('Juan Dela Cruz');
    const url = backend.lists[0];
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({ status: 'open', page: '1', size: '20' });
  });

  it('draws the seven columns and one row per request', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    const table = await screen.findByRole('table', { name: 'Quote requests' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Received', 'Name', 'Phone', 'Product', 'Pieces', 'Photos', 'Status']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('shows the received date over the time in Manila, the name link, the team, the phone, product, pieces and status', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    const row = await rowOf('Juan Dela Cruz');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Nov 21, 2026');
    expect(cells[0]).toHaveTextContent('3:42 PM');
    expect(within(row).getByRole('link', { name: 'Juan Dela Cruz' })).toHaveAttribute(
      'href',
      `/admin/quote-requests/${FIRST}`,
    );
    expect(cells[1]).toHaveTextContent('Brgy. San Roque Ballers');
    expect(cells[2]).toHaveTextContent('0917 555 0101');
    expect(cells[3]).toHaveTextContent('Basketball Jerseys');
    expect(cells[4]).toHaveTextContent('21-50 pcs');
    expect(cells[6]).toHaveTextContent('New');
  });

  it('shows nothing for an empty team and the empty value for no product or pieces', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    const row = await rowOf('Ana Lopez');
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]?.textContent).toBe('Ana Lopez');
    expect(cells[3]).toHaveTextContent('Not set');
    expect(cells[4]).toHaveTextContent('Not set');
    expect(cells[6]).toHaveTextContent('Contacted');
  });

  it('names the two fixed product choices', async () => {
    quoteRequestsBackend(
      quoteRequestList([
        quoteRequestItem(FIRST, { product: { choice: 'custom', title: null } }),
        quoteRequestItem(SECOND, { customerName: 'Ana Lopez', product: { choice: 'not-sure', title: null } }),
      ]),
    );
    renderPage();

    expect(within(await rowOf('Juan Dela Cruz')).getAllByRole('cell')[3]).toHaveTextContent('Custom design');
    expect(within(await rowOf('Ana Lopez')).getAllByRole('cell')[3]).toHaveTextContent('Not sure yet');
  });
});

describe('the status pills and the search filter the inbox, and the URL keeps them (WEB-10, D-18)', () => {
  it('shows the five pills with the server counts, Open pressed by default', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();

    const toolbar = await screen.findByRole('toolbar', { name: 'Show' });
    expect(await within(toolbar).findByRole('button', { name: 'Open 4 requests' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(toolbar).getAllByRole('button')).toHaveLength(5);
  });

  it('choosing Spam replaces the URL with status=spam and page 1, and asks the server for the spam group', async () => {
    const backend = quoteRequestsBackend(quoteRequestList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?page=2', onUrlUpdate);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Spam 1 requests' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?status=spam' });
    });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.get('status')).toBe('spam');
    });
    expect(backend.lists.at(-1)?.searchParams.get('page')).toBe('1');
    expect(screen.getByRole('button', { name: 'Spam 1 requests' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('choosing Open removes the status from the URL', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?status=closed', onUrlUpdate);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open 4 requests' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
  });

  it('a search waits 300 ms, then writes q with one replace, shows its chip and "Showing 1 request"', async () => {
    const backend = quoteRequestsBackend((url) =>
      url.searchParams.get('q') === 'juan' ? quoteRequestList([quoteRequestItem(FIRST)]) : quoteRequestList(ROWS),
    );
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('', onUrlUpdate);
    await rowOf('Ana Lopez');

    const search = screen.getByRole('searchbox', { name: 'Search requests' });
    expect(search).toHaveAttribute('placeholder', 'Name, team or phone');
    expect(search).toHaveAttribute('maxlength', '100');
    for (const text of ['j', 'ju', 'jua', 'juan']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=juan' }]);
    });
    await waitFor(() => {
      expect(backend.lists.at(-1)?.searchParams.get('q')).toBe('juan');
    });
    expect(await screen.findByText('Search: juan')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText(/^Showing/).textContent).toBe('Showing 1 request');
    });
    expect(screen.queryByRole('link', { name: 'Ana Lopez' })).toBeNull();
  });

  it('shows "Showing 4 requests" for four rows', async () => {
    quoteRequestsBackend(quoteRequestList(ROWS, { total: 4 }));
    renderPage();

    await rowOf('Juan Dela Cruz');
    expect(screen.getByText(/^Showing/).textContent).toBe('Showing 4 requests');
  });

  it("the search chip's clear button removes q from the URL and empties the box", async () => {
    quoteRequestsBackend(quoteRequestList([quoteRequestItem(FIRST)]));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?q=juan', onUrlUpdate);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Clear search filter' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
    expect(screen.getByRole('searchbox', { name: 'Search requests' })).toHaveValue('');
    expect(screen.queryByText('Search: juan')).toBeNull();
  });

  it('removes a status off the allow-list with one replace and asks for the open group', async () => {
    const backend = quoteRequestsBackend(quoteRequestList(ROWS));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?status=pending', onUrlUpdate);

    await rowOf('Juan Dela Cruz');
    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    expect(backend.lists.every((url) => url.searchParams.get('status') === 'open')).toBe(true);
  });

  it('opens on the pill and search from the URL', async () => {
    const backend = quoteRequestsBackend(quoteRequestList([quoteRequestItem(FIRST, { status: 'spam' })]));
    renderPage('?status=spam&q=juan');

    await rowOf('Juan Dela Cruz');
    expect(screen.getByRole('button', { name: 'Spam 1 requests' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Search requests' })).toHaveValue('juan');
    expect(Object.fromEntries(backend.lists[0]?.searchParams ?? [])).toEqual({
      status: 'spam',
      q: 'juan',
      page: '1',
      size: '20',
    });
  });

  it('has no axe violations with the pills, the search and its chip', async () => {
    quoteRequestsBackend(quoteRequestList([quoteRequestItem(FIRST)]));
    const { container } = renderPage('?q=juan');

    await rowOf('Juan Dela Cruz');
    await expectNoAxeViolations(container);
  });
});
