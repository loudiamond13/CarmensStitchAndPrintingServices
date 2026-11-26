import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, type InitialEntry } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import QuoteRequestPage from '@/modules/admin/pages/QuoteRequestPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { NEW_QUOTE_COUNT_KEY } from '@/modules/admin/hooks/useNewQuoteCountQuery';
import {
  MARIA,
  quoteProblem,
  quoteRequestBackend,
  quoteRequestDetail,
  quoteRequestId,
  quoteRequestPhoto,
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

  it('encodes ?, &, # and % in the mailto: link, so an address cannot add a Cc or a subject', async () => {
    const email = 'info?cc=other%40example.test&subject=Hi#x@example.test';
    quoteRequestBackend(quoteRequestDetail(ID, { email }));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(within(detailValue('Email')).getByRole('link', { name: email })).toHaveAttribute(
      'href',
      'mailto:info%3Fcc=other%2540example.test%26subject=Hi%23x@example.test',
    );
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

  it('uses the version of the latest read for the next move', async () => {
    const backend = quoteRequestBackend(
      (read) =>
        read === 1 ? quoteRequestDetail(ID) : quoteRequestDetail(ID, { status: 'contacted', version: 'AAAAAAAAB9I=' }),
      (body, id) => ({
        id,
        status: body.status,
        statusChangedAtUtc: '2026-11-21T08:05:00Z',
        version: body.version === 'AAAAAAAAB9E=' ? 'AAAAAAAAB9I=' : 'AAAAAAAAB9J=',
      }),
    );
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

    const title = await screen.findByText('Someone else changed this request.');
    const banner = title.closest<HTMLElement>('[role="alert"]');
    if (banner === null) throw new Error('The banner is not an alert.');
    expect(banner).toHaveTextContent('Someone else changed this request.Load the latest to see it.');
    const loadLatest = within(banner).getByRole('button', { name: 'Load Latest' });
    expect(loadLatest).toHaveFocus();
    await user.click(loadLatest);

    await waitFor(() => {
      expect(screen.queryByText('Someone else changed this request.')).toBeNull();
    });
    expect(backend.reads.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Contacted', { selector: '*:not(li)' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toHaveFocus();
  });

  it('keeps the banner and focus on Load Latest and shows a danger toast when Load Latest fails', async () => {
    quoteRequestBackend(
      (read) => (read === 1 ? quoteRequestDetail(ID) : quoteProblem(500)),
      () => quoteProblem(409, { code: 'quote-requests.conflict' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));
    const loadLatest = await screen.findByRole('button', { name: 'Load Latest' });
    await user.click(loadLatest);

    expect(await screen.findByText('Something went wrong')).toBeVisible();
    expect(screen.getByText('Please try again.')).toBeVisible();
    expect(screen.getByText('Someone else changed this request.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
  });

  it('shows not found, focused, when Load Latest finds the request gone', async () => {
    quoteRequestBackend(
      (read) => (read === 1 ? quoteRequestDetail(ID) : quoteProblem(404, { code: 'quote-requests.not-found' })),
      () => quoteProblem(409, { code: 'quote-requests.conflict' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));
    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });

  it('shows the ConflictBanner after the Spam confirm closes on a 409, with focus on Load Latest', async () => {
    quoteRequestBackend(quoteRequestDetail(ID), () => quoteProblem(409, { code: 'quote-requests.conflict' }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark this request as spam?' });
    await user.click(within(dialog).getByRole('button', { name: 'Mark as Spam' }));

    const title = await screen.findByText('Someone else changed this request.');
    const banner = title.closest<HTMLElement>('[role="alert"]');
    if (banner === null) throw new Error('The banner is not an alert.');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(within(banner).getByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it('shows no status menu on a Converted request', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { status: 'converted' }));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(screen.getByText('Converted')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });
});

describe('Turn into Order on the page (INQ-06, D-20, UI-SPEC R2)', () => {
  it.each(['new', 'contacted', 'quoted', 'closed', 'spam'])(
    'offers Turn into Order first in the actions on a %s request, to the prefilled New Order form',
    async (status) => {
      quoteRequestBackend(quoteRequestDetail(ID, { status }));
      renderPage();

      const turn = await screen.findByRole('link', { name: 'Turn into Order' });
      expect(turn).toHaveAttribute('href', `/admin/orders/new?fromRequest=${ID}`);
      const menu = screen.getByRole('button', { name: 'Change Status' });
      expect(turn.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  const ORDER_ID = '00000000-0000-4000-8000-000000000160';
  const CONVERTED = quoteRequestDetail(ID, {
    status: 'converted',
    orderId: ORDER_ID,
    orderNumber: 'ORD-2026-0160',
    history: [
      { from: 'quoted', to: 'converted', changedBy: MARIA, changedAt: '2026-11-21T09:10:00Z' },
      { from: null, to: 'new', changedBy: null, changedAt: '2026-11-21T07:42:00Z' },
    ],
  });

  it('shows Open Order {number} instead of Turn into Order on a Converted request, with no status menu (D-21)', async () => {
    signInAsAdmin();
    quoteRequestBackend(CONVERTED);
    renderPage();

    const open = await screen.findByRole('link', { name: 'Open Order ORD-2026-0160' });
    expect(open).toHaveAttribute('href', `/admin/orders/${ORDER_ID}`);
    expect(screen.queryByRole('link', { name: 'Turn into Order' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });

  it('keeps Delete Request aria-disabled for a Manager beside Open Order', async () => {
    quoteRequestBackend(CONVERTED);
    renderPage();

    const open = await screen.findByRole('link', { name: 'Open Order ORD-2026-0160' });
    const remove = screen.getByRole('button', { name: 'Delete Request' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(open.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads the conversion in the history as "Converted to order {number}", with the number as a link', async () => {
    quoteRequestBackend(CONVERTED);
    renderPage();

    const card = await screen.findByRole('region', { name: 'History' });
    const [converted] = within(card).getAllByRole('listitem');
    expect(converted).toHaveTextContent('Converted to order ORD-2026-0160 · Maria Santos · Nov 21, 2026, 5:10 PM');
    expect(within(converted ?? card).getByRole('link', { name: 'ORD-2026-0160' })).toHaveAttribute(
      'href',
      `/admin/orders/${ORDER_ID}`,
    );
  });

  it('has no axe violations on a Converted request', async () => {
    quoteRequestBackend(CONVERTED);
    const { container } = renderPage();

    await screen.findByRole('link', { name: 'Open Order ORD-2026-0160' });
    await expectNoAxeViolations(container);
  });
});

/** A gate a fake answer waits on until the test lets it go. */
function gate(): { wait: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

describe('loading, failure and not found (UI-SPEC R2 States)', () => {
  it('shows the back link at once and a busy region while the first read runs', async () => {
    const held = gate();
    quoteRequestBackend(async () => {
      await held.wait;
      return quoteRequestDetail(ID);
    });
    const { container } = renderPage();

    expect(await screen.findByRole('link', { name: 'Quote Requests' })).toBeVisible();
    expect(await screen.findByText('Loading the quote request…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    held.open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the error with Try Again; the same alert and button stay, focused, while it reads again', async () => {
    const held = gate();
    let reading = false;
    quoteRequestBackend(async (read) => {
      if (read === 1) return quoteProblem(500);
      reading = true;
      await held.wait;
      return quoteRequestDetail(ID);
    });
    renderPage();
    const user = userEvent.setup();

    const title = await screen.findByText("Couldn't load this quote request.");
    const alert = title.closest('[role="alert"]');
    expect(alert).toHaveTextContent('Check your internet connection. Your data is safe. Nothing was changed.');
    const retry = screen.getByRole('button', { name: 'Try Again' });
    await user.click(retry);

    await waitFor(() => {
      expect(reading).toBe(true);
    });
    expect(alert?.isConnected).toBe(true);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBe(retry);
    expect(retry).toHaveFocus();
    held.open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
    expect(screen.queryByText("Couldn't load this quote request.")).toBeNull();
  });

  it('shows Quote request not found for a gone request, with Back to Quote Requests', async () => {
    quoteRequestBackend(() => quoteProblem(404, { code: 'quote-requests.not-found' }));
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Quote request not found' })).toBeVisible();
    expect(screen.getByText('It may have been deleted or cleaned up after 6 months.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Quote Requests' })).toHaveAttribute(
      'href',
      '/admin/quote-requests',
    );
    expect(screen.queryByText("Couldn't load this quote request.")).toBeNull();
    expect(document.title).toBe('Quote Request · CSPS Admin');
  });

  it('shows the same not found for an id that is not a GUID, without asking the server', async () => {
    const backend = quoteRequestBackend(quoteRequestDetail(ID));
    renderPage(['/admin/quote-requests/not-a-guid']);

    expect(await screen.findByRole('heading', { level: 1, name: 'Quote request not found' })).toBeVisible();
    expect(screen.queryByText('Loading the quote request…')).toBeNull();
    expect(backend.reads).toHaveLength(0);
  });

  it('shows not found when a move finds the request gone', async () => {
    quoteRequestBackend(
      (read) => (read === 1 ? quoteRequestDetail(ID) : quoteProblem(404, { code: 'quote-requests.not-found' })),
      () => quoteProblem(404, { code: 'quote-requests.not-found' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Closed' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    expect(heading).toBeVisible();
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it('puts focus on not found when the Spam confirm finds the request gone', async () => {
    quoteRequestBackend(
      (read) => (read === 1 ? quoteRequestDetail(ID) : quoteProblem(404, { code: 'quote-requests.not-found' })),
      () => quoteProblem(404, { code: 'quote-requests.not-found' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Spam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark this request as spam?' });
    await user.click(within(dialog).getByRole('button', { name: 'Mark as Spam' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it('puts focus on not found when the first read finds the request gone', async () => {
    quoteRequestBackend(() => quoteProblem(404, { code: 'quote-requests.not-found' }));
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it('has no axe violations in the error and not-found states', async () => {
    quoteRequestBackend(() => quoteProblem(500));
    const failed = renderPage();
    await screen.findByText("Couldn't load this quote request.");
    await expectNoAxeViolations(failed.container);
    failed.unmount();
    queryClient.clear();

    quoteRequestBackend(() => quoteProblem(404));
    const gone = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    await expectNoAxeViolations(gone.container);
  });
});

describe('the photo states (D-03, D-04)', () => {
  it('lists the photos that arrived and names the missing ones', async () => {
    quoteRequestBackend(
      quoteRequestDetail(ID, {
        photoCount: 3,
        photos: [quoteRequestPhoto(0, 'front.jpg')],
        missingPhotos: ['logo.png', 'sketch.heic'],
      }),
    );
    renderPage();

    const card = await screen.findByRole('region', { name: 'Photos' });
    expect(within(card).getAllByRole('button', { name: /^Open photo/ })).toHaveLength(1);
    expect(card).toHaveTextContent(
      "2 photos didn't upload: logo.png, sketch.heic. Ask the customer to send them on Messenger.",
    );
  });

  it('says "1 photo" for one missing photo', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { photoCount: 1, photos: [], missingPhotos: ['logo.png'] }));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Photos' });
    expect(card).toHaveTextContent("1 photo didn't upload: logo.png. Ask the customer to send them on Messenger.");
    expect(card).not.toHaveTextContent('No photos were sent.');
  });

  it.each([
    ['marked Spam', 'spam'],
    ['moved back out of Spam', 'new'],
  ])('explains the photos were deleted when the request was %s', async (_case, status) => {
    quoteRequestBackend(
      quoteRequestDetail(ID, {
        status,
        photoCount: 0,
        photos: [],
        missingPhotos: [],
        photosRemovedAtUtc: '2026-11-21T08:05:00Z',
      }),
    );
    renderPage();

    const card = await screen.findByRole('region', { name: 'Photos' });
    expect(card).toHaveTextContent('The photos were deleted when this request was marked as spam.');
    expect(within(card).queryByRole('button', { name: /^Open photo/ })).toBeNull();
    expect(card).not.toHaveTextContent('No photos were sent.');
  });

  it('shows no photos while the removal job has not run yet', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { status: 'spam', photosRemovedAtUtc: '2026-11-21T08:05:00Z' }));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Photos' });
    expect(card).toHaveTextContent('The photos were deleted when this request was marked as spam.');
    expect(within(card).queryByRole('button', { name: /^Open photo/ })).toBeNull();
  });

  it('says "No photos were sent." when there were none', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { photoCount: 0, photos: [], missingPhotos: [] }));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Photos' });
    expect(within(card).getByText('No photos were sent.')).toBeVisible();
    expect(within(card).queryByRole('list')).toBeNull();
  });

  it('has no axe violations with missing photos and after Spam', async () => {
    quoteRequestBackend(
      quoteRequestDetail(ID, { photos: [quoteRequestPhoto(0)], missingPhotos: ['logo.png', 'sketch.heic'] }),
    );
    const missing = renderPage();
    await screen.findByText(/photos didn't upload/);
    await expectNoAxeViolations(missing.container);
    missing.unmount();
    queryClient.clear();

    quoteRequestBackend(
      quoteRequestDetail(ID, { status: 'spam', photos: [], photosRemovedAtUtc: '2026-11-21T08:05:00Z' }),
    );
    const spam = renderPage();
    await screen.findByText('The photos were deleted when this request was marked as spam.');
    await expectNoAxeViolations(spam.container);
  });
});

describe('empty values and long text (OR-4, UI-SPEC R2 overflow)', () => {
  it('shows each empty value as EmptyValue, never a dash', async () => {
    quoteRequestBackend(
      quoteRequestDetail(ID, { teamName: null, email: null, product: null, quantity: null, message: null }),
    );
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    for (const term of ['Team / organization', 'Email', 'Product type', 'Quantity (estimate)', 'Message']) {
      expect(detailValue(term)).toHaveTextContent('Not set');
      expect(within(detailValue(term)).queryByRole('link')).toBeNull();
    }
    expect(detailValue('Contact number')).toHaveTextContent('0917 555 0101');
  });

  it('names Not sure yet for that product choice', async () => {
    quoteRequestBackend(quoteRequestDetail(ID, { product: { choice: 'not-sure', title: null } }));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(detailValue('Product type')).toHaveTextContent('Not sure yet');
  });

  it('lets a 160-character name and a long message wrap', async () => {
    const name = 'Juan'.repeat(40);
    const message = `${'x'.repeat(300)}\nSecond line`;
    quoteRequestBackend(quoteRequestDetail(ID, { customerName: name, message }));
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name });
    expect(heading.className).toContain('wrap-anywhere');
    const value = detailValue('Message');
    expect(value.className).toContain('wrap-anywhere');
    expect(value.className).toContain('whitespace-pre-wrap');
    expect(value.textContent).toBe(message);
  });
});

const NOTES_PATH = /\/api\/v1\/quote-requests\/([0-9a-f-]{36})\/notes$/;

/** Answers POST /quote-requests/{id}/notes with `answer` and records each body. */
function notesBackend(answer: () => Response | object) {
  const posts: unknown[] = [];
  server.use(
    http.post(NOTES_PATH, async ({ request }) => {
      posts.push(await request.json());
      const body = answer();
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return posts;
}

describe('Internal notes on the page (D-17, UI-SPEC R2 item 4)', () => {
  const LIST_KEY = ['quote-requests', 'list', { status: 'open', q: null, page: 1, size: 20 }] as const;
  const NOTE = {
    id: quoteRequestId(101),
    text: 'Called back, wants 12.',
    createdBy: MARIA,
    createdAtUtc: '2026-11-21T09:00:00Z',
  };
  const ADDED = { id: ID, noteId: NOTE.id, createdAtUtc: NOTE.createdAtUtc, version: 'AAAAAAAAB9J=' };

  it('sits in the aside above History', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    renderPage();

    const notes = await screen.findByRole('region', { name: 'Internal notes' });
    const history = screen.getByRole('region', { name: 'History' });
    expect(notes.parentElement).toBe(history.parentElement);
    expect(notes.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads the request again after a note, shows it at the top, and marks the inbox lists and the New count stale', async () => {
    const older = { ...NOTE, id: quoteRequestId(100), text: 'Older note', createdAtUtc: '2026-11-21T08:00:00Z' };
    const backend = quoteRequestBackend((read) =>
      read === 1
        ? quoteRequestDetail(ID, { notes: [older] })
        : quoteRequestDetail(ID, { notes: [NOTE, older], version: 'AAAAAAAAB9J=' }),
    );
    const posts = notesBackend(() => ADDED);
    queryClient.setQueryData(NEW_QUOTE_COUNT_KEY, 4);
    queryClient.setQueryData(LIST_KEY, { items: [] });
    renderPage();
    const user = userEvent.setup();

    const box = await screen.findByRole('textbox', { name: 'Add a note' });
    await user.type(box, 'Called back, wants 12.');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    const notes = screen.getByRole('region', { name: 'Internal notes' });
    await waitFor(() => {
      expect(within(notes).getAllByRole('listitem')[0]).toHaveTextContent('Called back, wants 12.');
    });
    const first = within(notes).getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('Maria Santos');
    expect(first).toHaveTextContent('Nov 21, 2026, 5:00 PM');
    expect(within(notes).getAllByRole('listitem')).toHaveLength(2);
    expect(posts).toEqual([{ text: 'Called back, wants 12.' }]);
    expect(backend.reads).toHaveLength(2);
    expect(queryClient.getQueryState(NEW_QUOTE_COUNT_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    expect(box).toHaveFocus();
  });

  it('sends the version from the note answer with the next status change, before the read lands', async () => {
    const read = gate();
    const backend = quoteRequestBackend(async (count) => {
      if (count === 1) return quoteRequestDetail(ID);
      await read.wait;
      return quoteRequestDetail(ID, { notes: [NOTE], version: 'AAAAAAAAB9J=' });
    });
    notesBackend(() => ADDED);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Add a note' }), 'Called back, wants 12.');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    await screen.findByText('Note added.');
    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Contacted' }));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(1);
    });
    expect(backend.moves[0]?.body).toEqual({ status: 'contacted', version: 'AAAAAAAAB9J=' });
    read.open();
    expect(await screen.findByText('This request is now Contacted.')).toBeVisible();
    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'Internal notes' })).getAllByRole('listitem')).toHaveLength(1);
    });
  });

  it('keeps the typed note and shows the ConflictBanner on a 409', async () => {
    quoteRequestBackend(quoteRequestDetail(ID));
    notesBackend(() => quoteProblem(409, { code: 'quote-requests.conflict' }));
    renderPage();
    const user = userEvent.setup();

    const box = await screen.findByRole('textbox', { name: 'Add a note' });
    await user.type(box, 'Do not lose me');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(await screen.findByText('Someone else changed this request.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue('Do not lose me');
  });

  it('shows not found, focused, when the request is gone as a note is added', async () => {
    quoteRequestBackend((read) =>
      read === 1 ? quoteRequestDetail(ID) : quoteProblem(404, { code: 'quote-requests.not-found' }),
    );
    notesBackend(() => quoteProblem(404, { code: 'quote-requests.not-found' }));
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Add a note' }), 'Too late');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quote request not found' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});

/** Answers DELETE /quote-requests/{id} with `answer` (by default 204) and records each address. */
function deleteBackend(answer: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 })) {
  const deletes: URL[] = [];
  server.use(
    http.delete(/\/api\/v1\/quote-requests\/([0-9a-f-]{36})$/, async ({ request }) => {
      deletes.push(new URL(request.url));
      return answer();
    }),
  );
  return deletes;
}

function signInAsAdmin(): void {
  clearSession();
  const manager = sessionResponse();
  acceptSession(sessionResponse({ user: { ...manager.user, role: 'Admin' } }));
}

describe('Delete Request (D-16, UI-SPEC R2 actions and Destructive actions)', () => {
  const LIST_KEY = ['quote-requests', 'list', { status: 'open', q: null, page: 1, size: 20 }] as const;
  const CONTACTED = quoteRequestDetail(ID, { status: 'contacted' });

  it('is not shown to an Admin, while Change Status is', async () => {
    signInAsAdmin();
    quoteRequestBackend(CONTACTED);
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(screen.getByRole('button', { name: 'Change Status' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete Request' })).toBeNull();
  });

  it('is not shown to an Admin on a Converted request, nor its reason', async () => {
    signInAsAdmin();
    quoteRequestBackend(quoteRequestDetail(ID, { status: 'converted' }));
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Juan Dela Cruz' });
    expect(screen.queryByRole('button', { name: 'Delete Request' })).toBeNull();
    expect(screen.queryByText("A request that became an order can't be deleted.")).toBeNull();
  });

  it('asks a Manager first, naming the visitor, with Cancel focused; Cancel closes with focus back on the button', async () => {
    const deletes = deleteBackend();
    quoteRequestBackend(CONTACTED);
    renderPage();
    const user = userEvent.setup();

    const button = await screen.findByRole('button', { name: 'Delete Request' });
    expect(button.className).toContain('bg-danger-soft');
    await user.click(button);

    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    expect(dialog).toHaveTextContent(
      "This deletes the request from Juan Dela Cruz and its photos for good. This can't be undone.",
    );
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Request' })).toBeVisible();
    await expectNoAxeViolations(document.body);

    await user.click(cancel);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Delete Request' })).toHaveFocus();
    expect(deletes).toHaveLength(0);
  });

  it('deletes with the version, shows Deleting, then opens the inbox with the toast and asks it to focus its h1', async () => {
    const answer = gate();
    const deletes = deleteBackend(async () => {
      await answer.wait;
      return new HttpResponse(null, { status: 204 });
    });
    quoteRequestBackend(CONTACTED);
    queryClient.setQueryData(NEW_QUOTE_COUNT_KEY, 4);
    queryClient.setQueryData(LIST_KEY, { items: [] });
    const { router } = renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));

    expect(await within(dialog).findByRole('button', { name: 'Deleting' })).toBeVisible();
    await waitFor(() => {
      expect(deletes).toHaveLength(1);
    });
    expect(deletes[0]?.pathname).toBe(`/api/v1/quote-requests/${ID}`);
    expect(Object.fromEntries(deletes[0]?.searchParams ?? [])).toEqual({ version: 'AAAAAAAAB9E=' });
    answer.open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Quote Requests inbox' })).toBeVisible();
    expect(screen.getByText('Quote request deleted')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/quote-requests');
    expect(router.state.location.state).toEqual({ focusHeading: true });
    expect(queryClient.getQueryState(NEW_QUOTE_COUNT_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['quote-requests', 'detail', ID])).toBeUndefined();
  });

  it('returns to the inbox view the person came from, in place of the deleted request in history', async () => {
    deleteBackend();
    quoteRequestBackend(CONTACTED);
    const inbox = '/admin/quote-requests?status=all&q=juan';
    const { router } = renderPage([inbox, { pathname: PATH, state: { from: inbox } }]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));

    await screen.findByRole('heading', { level: 1, name: 'Quote Requests inbox' });
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(inbox);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('treats a 404 on its own delete as deleted: the same toast and way back (13-REVIEW-W8 IN-02)', async () => {
    deleteBackend(() => quoteProblem(404, { code: 'quote-requests.not-found' }));
    quoteRequestBackend(CONTACTED);
    const { router } = renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Quote Requests inbox' })).toBeVisible();
    expect(screen.getByText('Quote request deleted')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/quote-requests');
  });

  it('closes the confirm and shows the ConflictBanner, focused, on a 409', async () => {
    deleteBackend(() => quoteProblem(409, { code: 'quote-requests.conflict' }));
    quoteRequestBackend(CONTACTED);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));

    const title = await screen.findByText('Someone else changed this request.');
    const banner = title.closest<HTMLElement>('[role="alert"]');
    if (banner === null) throw new Error('The banner is not an alert.');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(within(banner).getByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it("shows the server's sentence in the confirm on a 400", async () => {
    deleteBackend(() =>
      quoteProblem(400, {
        code: 'quote-requests.converted-locked',
        detail: "A request that became an order can't be deleted.",
      }),
    );
    quoteRequestBackend(CONTACTED);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));

    expect(await within(dialog).findByText(/A request that became an order can't be deleted\./)).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeInTheDocument();
  });

  it('reads the request again on a 400 converted-locked, so the page shows Converted after Cancel', async () => {
    deleteBackend(() =>
      quoteProblem(400, {
        code: 'quote-requests.converted-locked',
        detail: "A request that became an order can't be deleted.",
      }),
    );
    const backend = quoteRequestBackend((read) =>
      read === 1 ? CONTACTED : quoteRequestDetail(ID, { status: 'converted' }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this quote request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Request' }));
    expect(await within(dialog).findByText(/A request that became an order can't be deleted\./)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Request' })).toHaveAttribute('aria-disabled', 'true');
    });
    expect(backend.reads).toHaveLength(2);
    expect(screen.getByText('Converted', { selector: '*:not(li)' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
  });

  it('is aria-disabled for a Manager on a Converted request, described by the reason, and opens nothing', async () => {
    const deletes = deleteBackend();
    quoteRequestBackend(quoteRequestDetail(ID, { status: 'converted' }));
    const { container } = renderPage();
    const user = userEvent.setup();

    const button = await screen.findByRole('button', { name: 'Delete Request' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription("A request that became an order can't be deleted.");
    expect(screen.queryByRole('button', { name: 'Change Status' })).toBeNull();
    await user.click(button);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deletes).toHaveLength(0);
    await expectNoAxeViolations(container);
  });
});
