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
