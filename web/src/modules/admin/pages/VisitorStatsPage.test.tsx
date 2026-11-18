import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { VisitorStatsRoute } from '@/modules/admin/pages/VisitorStatsPage';
import type { VisitorStatsResponse } from '@/modules/admin/services/visitorStatsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// V1 Visitor Stats, /admin/visitor-stats (ANL-08, D-23, D-24, D-27, D-33; plan 12-23): the Manager-only page head, KPI row and
// date range toolbar. Every count is the server's; the page only formats.

type Totals = VisitorStatsResponse['totals'];

function statsAnswer(totals: Partial<Totals> = {}, rest: Partial<VisitorStatsResponse> = {}): VisitorStatsResponse {
  return {
    range: 'last-30-days',
    from: '2026-10-17',
    to: '2026-11-15',
    cutDate: '2025-10-15',
    totals: { uniqueVisitors: 1234, visits: 980, pageViews: 4567, countedFrom: null, ...totals },
    ...rest,
  };
}

type Responder = (url: URL) => VisitorStatsResponse | Response | Promise<VisitorStatsResponse | Response>;

/** The fake stats API; returns the calls it answered. */
function backend(respond: VisitorStatsResponse | Responder = statsAnswer()): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/visitor-stats', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const body = typeof respond === 'function' ? await respond(url) : respond;
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return { calls };
}

let queryClient: QueryClient;

function Harness({ search, onUrlUpdate }: { search: string; onUrlUpdate: OnUrlUpdateFunction }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <MemoryRouter>
          <ToastProvider>
            <VisitorStatsRoute />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(<Harness search={search} onUrlUpdate={onUrlUpdate} />);
}

/** The KPI card whose overline label reads `label`. */
function card(label: string): HTMLElement {
  const overline = screen.getByText(label, { selector: 'span' });
  const root = overline.parentElement?.parentElement;
  if (!(root instanceof HTMLElement)) throw new Error(`No card for ${label}`);
  return root;
}

async function openPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  const view = renderPage(search, onUrlUpdate);
  await screen.findByText('4,567');
  return view;
}

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  document.title = '';
});

describe('V1 the page head', () => {
  it('shows the h1 and the subline built from the range the server resolved', async () => {
    backend();
    await openPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Oct 17 to Nov 15, 2026 · Visits to the public website. Staff signed in to admin aren't counted.",
      ),
    ).toBeInTheDocument();
  });

  it('writes the year on both dates when the range crosses a year', async () => {
    backend(statsAnswer({}, { from: '2025-12-20', to: '2026-01-18' }));
    await openPage();

    expect(
      screen.getByText(
        "Dec 20, 2025 to Jan 18, 2026 · Visits to the public website. Staff signed in to admin aren't counted.",
      ),
    ).toBeInTheDocument();
  });

  it('sets the document title to "Visitor Stats · CSPS Admin"', async () => {
    backend();
    await openPage();

    await waitFor(() => {
      expect(document.title).toBe('Visitor Stats · CSPS Admin');
    });
  });

  it('asks for the default range by name and never works out dates for it', async () => {
    const { calls } = backend();
    await openPage();

    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({ range: 'last-30-days' });
  });
});

describe('V1 the KPI row', () => {
  it('shows the three totals with en-PH grouping, each with its icon and hint', async () => {
    backend();
    await openPage();

    const unique = card('Unique visitors');
    expect(within(unique).getByText('1,234')).toBeInTheDocument();
    expect(within(unique).getByText('Visitors who allowed visitor stats')).toBeInTheDocument();
    expect(unique.querySelector('svg.lucide-users')).not.toBeNull();

    const visits = card('Visits');
    expect(within(visits).getByText('980')).toBeInTheDocument();
    expect(
      within(visits).getByText('One sitting on the website. A new one starts after 30 minutes away.'),
    ).toBeInTheDocument();
    expect(visits.querySelector('svg.lucide-clock')).not.toBeNull();

    const views = card('Page views');
    expect(within(views).getByText('4,567')).toBeInTheDocument();
    expect(within(views).getByText('Every page opened, with or without cookies')).toBeInTheDocument();
    expect(views.querySelector('svg.lucide-eye')).not.toBeNull();
  });

  it('shows "Not available" and its hint when the server has no count for those dates', async () => {
    backend(statsAnswer({ uniqueVisitors: null, visits: null }));
    await openPage();

    for (const label of ['Unique visitors', 'Visits']) {
      const element = card(label);
      expect(within(element).getByText('Not available')).toBeInTheDocument();
      expect(within(element).getByText('Not available for dates over 13 months ago')).toBeInTheDocument();
      expect(within(element).queryByText('0')).toBeNull();
    }
    expect(within(card('Page views')).getByText('Every page opened, with or without cookies')).toBeInTheDocument();
  });

  it('shows the partial hint when the counts start at the 13-month line', async () => {
    backend(statsAnswer({ uniqueVisitors: 300, visits: 410, countedFrom: '2025-10-15' }));
    await openPage();

    expect(within(card('Unique visitors')).getByText('Counted from Oct 15, 2025 only')).toBeInTheDocument();
    expect(within(card('Visits')).getByText('Counted from Oct 15, 2025 only')).toBeInTheDocument();
    expect(within(card('Page views')).getByText('Every page opened, with or without cookies')).toBeInTheDocument();
  });

  it('shows real zeros as "0"', async () => {
    backend(statsAnswer({ uniqueVisitors: 0, visits: 0, pageViews: 0 }));
    renderPage();

    await waitFor(() => {
      expect(within(card('Page views')).getByText('0')).toBeInTheDocument();
    });
    expect(within(card('Visits')).getByText('0')).toBeInTheDocument();
    expect(within(card('Unique visitors')).getByText('0')).toBeInTheDocument();
  });

  it('shows the cards loading inside one region named the visitor stats', async () => {
    backend(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return statsAnswer();
    });
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Visitor Stats' })).toBeInTheDocument();
    expect(screen.getByText('Loading the visitor stats…')).toBeInTheDocument();
    expect(card('Visits')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('4,567')).toBeInTheDocument();
    expect(screen.getByText('The visitor stats loaded.')).toBeInTheDocument();
  });

  it('shows the failure with Try Again when the first read fails', async () => {
    backend(() => new HttpResponse(null, { status: 500 }));
    renderPage();

    expect(await screen.findByText("Couldn't load the visitor stats.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('has no axe violations with the figures shown', async () => {
    backend(statsAnswer({ uniqueVisitors: null, visits: null }));
    const { container } = await openPage();

    await expectNoAxeViolations(container);
  });
});
