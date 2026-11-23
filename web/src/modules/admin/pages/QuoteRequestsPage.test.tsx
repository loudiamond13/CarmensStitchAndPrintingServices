import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import QuoteRequestsPage from '@/modules/admin/pages/QuoteRequestsPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { quoteRequestId, quoteRequestItem, quoteRequestList, quoteRequestsBackend } from '@/test/quoteRequestFixtures';
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
