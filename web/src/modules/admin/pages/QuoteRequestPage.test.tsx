import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type InitialEntry } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import QuoteRequestPage from '@/modules/admin/pages/QuoteRequestPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { NEW_QUOTE_COUNT_KEY } from '@/modules/admin/hooks/useNewQuoteCountQuery';
import {
  MARIA,
  quoteProblem,
  quoteRequestBackend,
  quoteRequestDetail,
  quoteRequestId,
} from '@/test/quoteRequestFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// R2 Quote request, /admin/quote-requests/:id (INQ-05, D-13, D-15, D-36; plan 13-19).

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

const ID = quoteRequestId(1);
const PATH = `/admin/quote-requests/${ID}`;

function renderPage(entries: InitialEntry[] = [PATH], initialIndex = entries.length - 1) {
  const router = createMemoryRouter(
    [
      { path: '/admin/quote-requests', element: <h1>Quote Requests inbox</h1> },
      { path: '/admin/quote-requests/:id', element: <QuoteRequestPage /> },
    ],
    { initialEntries: entries, initialIndex },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

/** The value of a term in the Request card. */
function detailValue(term: string): HTMLElement {
  const card = screen.getByRole('region', { name: 'Request' });
  const dt = within(card).getByText(term, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`No value after ${term}`);
  return dd;
}

describe('the populated request (INQ-05, UI-SPEC R2)', () => {
  it("shows the visitor's name as the h1, the received line and the status badge", async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
    expect(screen.getByText('Received Nov 21, 2026, 3:42 PM from the website')).toBeVisible();
    expect(screen.getByText('New')).toBeVisible();
  });

  it('titles the document "Quote Request · CSPS Admin", never with the name (CWE-598)', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    await waitFor(() => {
      expect(document.title).toBe('Quote Request · CSPS Admin');
    });
    expect(document.title).not.toContain('Juan');
  });

  it('lists the details with a tel: and a mailto: link, the product, the quantity and the message', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(screen.getByRole('heading', { level: 2, name: 'Request' })).toBeVisible();
    expect(detailValue('Team / organization')).toHaveTextContent('Brgy. San Roque Ballers');
    expect(within(detailValue('Contact number')).getByRole('link', { name: '0917 555 0101' })).toHaveAttribute(
      'href',
      'tel:09175550101',
    );
    expect(within(detailValue('Email')).getByRole('link', { name: 'juan@example.test' })).toHaveAttribute(
      'href',
      'mailto:juan@example.test',
    );
    expect(detailValue('Product type')).toHaveTextContent('Basketball Jerseys');
    expect(detailValue('Quantity (estimate)')).toHaveTextContent('21-50 pcs');
    expect(detailValue('Message')).toHaveTextContent('Twelve jerseys, numbers 1 to 12.');
  });

  it('renders visitor text as text, never as HTML (CWE-79)', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { message: '<img src=x onerror=alert(1)><b>bold</b>' }));
    const { container } = renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(detailValue('Message')).toHaveTextContent('<img src=x onerror=alert(1)><b>bold</b>');
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('shows the photos with the count chip, and the viewer opens the server 2000px address (D-36)', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage();
    const user = userEvent.setup();

    const card = await screen.findByRole('region', { name: /^Photos/ });
    expect(within(card).getByText('3')).toBeVisible();
    const tiles = within(card).getAllByRole('button', { name: /^Open photo/ });
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Open photo 1 of 3: front.jpg',
      'Open photo 2 of 3: back.jpg',
      'Open photo 3 of 3: logo.jpg',
    ]);
    expect(within(card).queryByText('Cover')).toBeNull();

    await user.click(within(card).getByRole('button', { name: 'Open photo 2 of 3: back.jpg' }));
    const viewer = await screen.findByRole('dialog');
    expect(within(viewer).getByRole('link', { name: /Open Full Size/ })).toHaveAttribute(
      'href',
      'https://images.example.test/quote/1/full-2000.jpg',
    );
  });

  it('lists the history newest first, with the received row last and no creator', async () => {
    quoteRequestBackend(
      quoteRequestDetail(ID, {
        status: 'quoted',
        history: [
          { from: 'contacted', to: 'quoted', changedBy: MARIA, changedAt: '2026-11-21T09:10:00Z' },
          { from: 'new', to: 'contacted', changedBy: MARIA, changedAt: '2026-11-21T08:05:00Z' },
          { from: null, to: 'new', changedBy: null, changedAt: '2026-11-21T07:42:00Z' },
        ],
      }),
    );
    renderPage();

    const card = await screen.findByRole('region', { name: 'History' });
    const rows = within(card).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Quoted · Maria Santos · Nov 21, 2026, 5:10 PM',
      'Contacted · Maria Santos · Nov 21, 2026, 4:05 PM',
      'Received from the website · Nov 21, 2026, 3:42 PM',
    ]);
  });

  it('has no axe violations', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { container } = renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    await expectNoAxeViolations(container);
  });
});

describe('the back link', () => {
  it('goes back in history when the inbox is the previous entry, keeping its filters', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { router } = renderPage([
      '/admin/quote-requests?status=spam&q=juan',
      { pathname: PATH, state: { from: '/admin/quote-requests?status=spam&q=juan' } },
    ]);
    const user = userEvent.setup();

    const back = await screen.findByRole('link', { name: 'Quote Requests' });
    expect(back).toHaveAttribute('href', '/admin/quote-requests?status=spam&q=juan');
    await user.click(back);

    await waitFor(() => {
      expect(router.state.location.search).toBe('?status=spam&q=juan');
    });
    expect(router.state.historyAction).toBe('POP');
  });

  it('links to the inbox when the page was opened another way', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    const { router } = renderPage();
    const user = userEvent.setup();

    const back = await screen.findByRole('link', { name: 'Quote Requests' });
    expect(back).toHaveAttribute('href', '/admin/quote-requests');
    await user.click(back);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/quote-requests');
    });
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('ignores a navigation state that is not an inbox address (CWE-601)', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage([{ pathname: PATH, state: { from: 'https://evil.example/admin/quote-requests' } }]);

    expect(await screen.findByRole('link', { name: 'Quote Requests' })).toHaveAttribute(
      'href',
      '/admin/quote-requests',
    );
  });
});

describe('Change Status on the page (D-15, D-14)', () => {
  const LIST_KEY = ['quote-requests', 'list', { status: 'open', q: null, page: 1, size: 20 }] as const;

  it('updates the badge, reads the request again for the history, and marks the inbox lists and the New count stale', async () => {
    const quoted = quoteRequestDetail(ID, {
      status: 'quoted',
      version: 'AAAAAAAAB9I=',
      history: [
        { from: 'new', to: 'quoted', changedBy: MARIA, changedAt: '2026-11-21T08:05:00Z' },
        { from: null, to: 'new', changedBy: null, changedAt: '2026-11-21T07:42:00Z' },
      ],
    });
    const backend = quoteRequestBackend((read) => (read === 1 ? quoteRequestDetail(ID) : quoted));
    queryClient.setQueryData(NEW_QUOTE_COUNT_KEY, 4);
    queryClient.setQueryData(LIST_KEY, { items: [] });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Quoted' }));

    expect(await screen.findByText('This request is now Quoted.')).toBeVisible();
    const history = screen.getByRole('region', { name: 'History' });
    expect(await within(history).findByText(/^Quoted · Maria Santos/)).toBeVisible();
    expect(backend.reads).toHaveLength(2);
    expect(screen.getByText('Quoted', { selector: '*:not(li)' })).toBeVisible();
    expect(queryClient.getQueryState(NEW_QUOTE_COUNT_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    expect(screen.getByRole('button', { name: 'Change Status' })).toHaveFocus();
  });

  it('uses the version of the answer for the next move', async () => {
    const backend = quoteRequestBackend(quoteRequestDetail(ID), (body, id) => ({
      id,
      status: body.status,
      statusChangedAtUtc: '2026-11-21T08:05:00Z',
      version: body.version === 'AAAAAAAAB9E=' ? 'AAAAAAAAB9I=' : 'AAAAAAAAB9J=',
    }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Contacted' }));
    await screen.findByText('This request is now Contacted.');
    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(2);
    });
    expect(backend.moves[1]?.body).toEqual({ status: 'closed', version: 'AAAAAAAAB9I=' });
    expect(backend.moves[1]?.key).not.toBe(backend.moves[0]?.key);
  });

  it('shows the ConflictBanner on a 409, and Load Latest reads the request again', async () => {
    const backend = quoteRequestBackend(
      (read) =>
        read === 1 ? quoteRequestDetail(ID) : quoteRequestDetail(ID, { status: 'contacted', version: 'AAAAAAAAB9K=' }),
      () => quoteProblem(409, { code: 'quote-requests.conflict' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Someone else changed this request. Load the latest to see it.');
    const loadLatest = within(banner).getByRole('button', { name: 'Load Latest' });
    expect(loadLatest).toHaveFocus();
    await user.click(loadLatest);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(backend.reads.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Contacted', { selector: '*:not(li)' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toHaveFocus();
  });

  it('shows no status menu on a Converted request', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { status: 'converted' }));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(screen.getByText('Converted')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });
});
