import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import QuoteRequestsPage from '@/modules/admin/pages/QuoteRequestsPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  quoteProblem,
  quoteRequestId,
  quoteRequestItem,
  quoteRequestList,
  quoteRequestsBackend,
} from '@/test/quoteRequestFixtures';
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
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

/** The window loses focus and gets it back, as TanStack Query sees it. */
function refocusWindow(): void {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

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

describe('the Photos column (UI-SPEC R1 item 4)', () => {
  it('shows the count, the missing-photo mark, the empty value and Removed', async () => {
    quoteRequestsBackend(
      quoteRequestList([
        quoteRequestItem(quoteRequestId(1), { customerName: 'All Arrived' }),
        quoteRequestItem(quoteRequestId(2), { customerName: 'Some Missing', storedPhotoCount: 2 }),
        quoteRequestItem(quoteRequestId(3), { customerName: 'No Photos', photoCount: 0, storedPhotoCount: 0 }),
        quoteRequestItem(quoteRequestId(4), {
          customerName: 'Marked Spam',
          status: 'spam',
          storedPhotoCount: 0,
          photosRemoved: true,
        }),
      ]),
    );
    renderPage();

    const photos = async (name: string): Promise<HTMLElement> => {
      const cell = within(await rowOf(name)).getAllByRole('cell')[5];
      if (cell === undefined) throw new Error(`No Photos cell for ${name}.`);
      return cell;
    };
    expect((await photos('All Arrived')).textContent).toBe('3');
    const missing = await photos('Some Missing');
    expect(missing.textContent).toBe('2 of 3 photos arrived');
    expect(missing.querySelector('svg')).not.toBeNull();
    expect(within(missing).getByText('photos arrived').className).toBe(srOnlyClasses);
    expect(await photos('No Photos')).toHaveTextContent('Not set');
    expect((await photos('Marked Spam')).textContent).toBe('Removed');
  });
});

describe('the empty, loading, error and refresh states (UI-SPEC R1 "States")', () => {
  it('Open with no requests shows the inbox empty state with no button', async () => {
    quoteRequestsBackend(quoteRequestList([], { counts: { open: 0, converted: 0, closed: 0, spam: 0, all: 0 } }));
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'No open quote requests' })).toBeVisible();
    expect(screen.getByText("New requests from the website's Get a Quote form show here.")).toBeVisible();
    expect(screen.queryByRole('button', { name: /Clear/ })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each([
    ['converted', 'No converted requests', 'Requests show here when their status changes.'],
    ['closed', 'No closed requests', 'Requests show here when their status changes.'],
    ['spam', 'No spam requests', 'Requests show here when their status changes.'],
    ['all', 'No quote requests yet', "Requests from the website's Get a Quote form show here."],
  ])('the %s pill with no requests says "%s"', async (status, title, message) => {
    quoteRequestsBackend(quoteRequestList([]));
    renderPage(`?status=${status}`);

    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeVisible();
    expect(screen.getByText(message)).toBeVisible();
  });

  it('a search with no match names the search and Clear Search removes it', async () => {
    quoteRequestsBackend(quoteRequestList([]));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?q=zzz', onUrlUpdate);
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { level: 2, name: 'No requests match "zzz"' })).toBeVisible();
    expect(screen.getByText('Check the spelling, or search by phone number.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    await waitFor(() => {
      expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '' });
    });
  });

  it('the first load shows 5 skeleton rows in a busy region and the pills without counts', async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    quoteRequestsBackend(async () => {
      await held;
      return quoteRequestList(ROWS);
    });
    renderPage();

    const region = await screen.findByText('Loading the quote requests…');
    expect(region).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')?.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    release();
    expect(await screen.findByRole('button', { name: 'Open 4 requests' })).toBeVisible();
  });

  it('a failed load shows the error with Try Again, which reads again', async () => {
    let fail = true;
    quoteRequestsBackend(() => (fail ? quoteProblem(500) : quoteRequestList(ROWS)));
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Couldn't load the quote requests.")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('link', { name: 'Juan Dela Cruz' })).toBeVisible();
    expect(screen.queryByText("Couldn't load the quote requests.")).toBeNull();
  });

  it('a failed later refresh keeps the rows and shows the stale line', async () => {
    let fail = false;
    quoteRequestsBackend(() => (fail ? quoteProblem(500) : quoteRequestList(ROWS)));
    renderPage();
    await rowOf('Juan Dela Cruz');

    fail = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['quote-requests'] });
    });

    expect(await screen.findByText(/^Showing figures from .+\. Couldn't refresh\.$/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Juan Dela Cruz' })).toBeVisible();
    expect(screen.queryByText("Couldn't load the quote requests.")).toBeNull();
  });

  it('reads again every 60 seconds while visible and whenever the window regains focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const backend = quoteRequestsBackend(quoteRequestList(ROWS));
    renderPage();
    await rowOf('Juan Dela Cruz');

    const first = backend.lists.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => {
      expect(backend.lists.length).toBe(first + 1);
    });
    refocusWindow();
    await waitFor(() => {
      expect(backend.lists.length).toBe(first + 2);
    });
    const query = queryClient.getQueryCache().find({ queryKey: ['quote-requests', 'list'], exact: false });
    expect(query?.observers[0]?.options.refetchIntervalInBackground).toBe(false);
  });

  it('a failed refresh stops the clock and the focus re-read, so the stale line and Try Again stay put', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fail = false;
    const backend = quoteRequestsBackend(() => (fail ? quoteProblem(500) : quoteRequestList(ROWS)));
    renderPage();
    await rowOf('Juan Dela Cruz');
    fail = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['quote-requests'] });
    });
    const line = await screen.findByText(/^Showing figures from .+\. Couldn't refresh\.$/);
    const tryAgain = screen.getByRole('button', { name: 'Try Again' });
    tryAgain.focus();
    const before = backend.lists.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    refocusWindow();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(backend.lists.length).toBe(before);
    expect(line.isConnected).toBe(true);
    expect(tryAgain).toHaveFocus();
  });

  it('Try Again on the stale line keeps the line and the focused button in place while it reads, then the clock resumes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let mode: 'ok' | 'fail' | 'hold' = 'ok';
    let release = (): void => undefined;
    const backend = quoteRequestsBackend(async () => {
      if (mode === 'fail') return quoteProblem(500);
      if (mode === 'hold') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return quoteRequestList(ROWS);
    });
    renderPage();
    await rowOf('Juan Dela Cruz');
    mode = 'fail';
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['quote-requests'] });
    });
    const line = await screen.findByText(/^Showing figures from .+\. Couldn't refresh\.$/);
    const tryAgain = screen.getByRole('button', { name: 'Try Again' });

    mode = 'hold';
    const before = backend.lists.length;
    tryAgain.focus();
    fireEvent.click(tryAgain);
    await waitFor(() => {
      expect(backend.lists.length).toBe(before + 1);
    });
    expect(line.isConnected).toBe(true);
    expect(tryAgain.isConnected).toBe(true);
    expect(tryAgain).toHaveFocus();
    expect(tryAgain).toHaveAttribute('aria-busy', 'true');

    mode = 'ok';
    act(() => {
      release();
    });
    await waitFor(() => {
      expect(line.isConnected).toBe(false);
    });
    const recovered = backend.lists.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => {
      expect(backend.lists.length).toBe(recovered + 1);
    });
  });

  it('a failed first load is not read again by the clock or on focus, so the error stays put', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const backend = quoteRequestsBackend(() => quoteProblem(500));
    renderPage();
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent("Couldn't load the quote requests.");
    const before = backend.lists.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    refocusWindow();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(backend.lists.length).toBe(before);
    expect(error.isConnected).toBe(true);
  });

  it('a refresh that brings a new request says so politely and never moves focus', async () => {
    let rows = ROWS;
    const backend = quoteRequestsBackend(() => quoteRequestList(rows));
    renderPage();
    await rowOf('Juan Dela Cruz');
    const search = screen.getByRole('searchbox', { name: 'Search requests' });
    search.focus();
    expect(screen.queryByText(/new quote request/)).toBeNull();

    rows = [quoteRequestItem(quoteRequestId(9), { customerName: 'Mark Villanueva' }), ...ROWS];
    const before = backend.lists.length;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(await screen.findByRole('link', { name: 'Mark Villanueva' })).toBeVisible();
    expect(backend.lists.length).toBeGreaterThan(before);
    await waitFor(() => {
      expect(screen.getByText('1 new quote request.')).toBeInTheDocument();
    });
    expect(search).toHaveFocus();
    act(() => {
      focusManager.setFocused(undefined);
    });
  });

  it('the new-request line clears after 5 seconds, so a second single arrival is read out again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let rows = ROWS;
    quoteRequestsBackend(() => quoteRequestList(rows));
    renderPage();
    await rowOf('Juan Dela Cruz');

    rows = [
      quoteRequestItem(quoteRequestId(9), { customerName: 'Mark Villanueva', receivedAtUtc: '2026-11-22T01:00:00Z' }),
      ...ROWS,
    ];
    refocusWindow();
    const line = await screen.findByText('1 new quote request.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_900);
    });
    expect(line).toHaveTextContent('1 new quote request.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(line.textContent).toBe('');

    rows = [
      quoteRequestItem(quoteRequestId(10), { customerName: 'Liza Ramos', receivedAtUtc: '2026-11-22T02:00:00Z' }),
      ...rows,
    ];
    refocusWindow();
    expect(await screen.findByRole('link', { name: 'Liza Ramos' })).toBeVisible();
    await waitFor(() => {
      expect(line).toHaveTextContent('1 new quote request.');
    });
  });

  it('a second arrival while the line still shows adds to its count', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let rows = ROWS;
    quoteRequestsBackend(() => quoteRequestList(rows));
    renderPage();
    await rowOf('Juan Dela Cruz');

    rows = [
      quoteRequestItem(quoteRequestId(9), { customerName: 'Mark Villanueva', receivedAtUtc: '2026-11-22T01:00:00Z' }),
      ...ROWS,
    ];
    refocusWindow();
    const line = await screen.findByText('1 new quote request.');
    rows = [
      quoteRequestItem(quoteRequestId(10), { customerName: 'Liza Ramos', receivedAtUtc: '2026-11-22T02:00:00Z' }),
      ...rows,
    ];
    refocusWindow();

    await waitFor(() => {
      expect(line).toHaveTextContent('2 new quote requests.');
    });
  });

  it('a filter change clears the new-request line at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let rows = ROWS;
    quoteRequestsBackend(() => quoteRequestList(rows));
    renderPage();
    await rowOf('Juan Dela Cruz');
    rows = [
      quoteRequestItem(quoteRequestId(9), { customerName: 'Mark Villanueva', receivedAtUtc: '2026-11-22T01:00:00Z' }),
      ...ROWS,
    ];
    refocusWindow();
    const line = await screen.findByText('1 new quote request.');

    fireEvent.click(screen.getByRole('button', { name: 'All 20 requests' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All 20 requests' })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(line.textContent).toBe('');
  });

  it('a filter change is not news: no new-request line', async () => {
    quoteRequestsBackend((url) =>
      url.searchParams.get('status') === 'all'
        ? quoteRequestList([quoteRequestItem(quoteRequestId(9), { customerName: 'Mark Villanueva' }), ...ROWS])
        : quoteRequestList(ROWS),
    );
    renderPage();
    const user = userEvent.setup();
    await rowOf('Juan Dela Cruz');

    await user.click(screen.getByRole('button', { name: 'All 20 requests' }));

    expect(await screen.findByRole('link', { name: 'Mark Villanueva' })).toBeVisible();
    expect(screen.queryByText(/new quote request/)).toBeNull();
  });

  it('has no axe violations in the empty state', async () => {
    quoteRequestsBackend(quoteRequestList([]));
    const { container } = renderPage();

    await screen.findByRole('heading', { level: 2, name: 'No open quote requests' });
    await expectNoAxeViolations(container);
  });
});
