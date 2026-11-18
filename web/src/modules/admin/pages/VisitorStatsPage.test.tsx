import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
type Trend = VisitorStatsResponse['trend'];

/** `count` day buckets from `start`, the figures growing with the day. */
function dayTrend(start: string, count: number): Trend {
  const [year, month, day] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + i)).toISOString().slice(0, 10),
    pageViews: i * 3,
    uniqueVisitors: i,
  }));
}

function statsAnswer(totals: Partial<Totals> = {}, rest: Partial<VisitorStatsResponse> = {}): VisitorStatsResponse {
  return {
    range: 'last-30-days',
    from: '2026-10-17',
    to: '2026-11-15',
    cutDate: '2025-10-15',
    totals: { uniqueVisitors: 1234, visits: 980, pageViews: 4567, countedFrom: null, ...totals },
    bucket: 'day',
    trend: dayTrend('2026-10-17', 30),
    topPages: [
      { name: 'gallery', count: 412, share: 38 },
      { name: 'home', count: 300, share: 28 },
      { name: 'contact', count: 200, share: 18 },
      { name: 'not-found', count: 172, share: 16 },
    ],
    referrers: [
      { name: 'Facebook', count: 300, share: 62 },
      { name: 'Direct', count: 120, share: 25 },
      { name: 'basketball-league.ph', count: 64, share: 13 },
    ],
    devices: [
      { name: 'Phone', count: 400, share: 82 },
      { name: 'Computer', count: 70, share: 14 },
      { name: 'Tablet', count: 20, share: 4 },
    ],
    browsers: [
      { name: 'Chrome', count: 200, share: 41 },
      { name: 'Facebook in-app', count: 150, share: 31 },
      { name: 'Safari', count: 90, share: 18 },
      { name: 'Other', count: 50, share: 10 },
    ],
    speed: {
      lcp: { p75: 2100, rating: 'good', samples: 412 },
      cls: { p75: 0.04, rating: 'good', samples: 380 },
      inp: { p75: 180, rating: 'good', samples: 200 },
      pageViews: 412,
      available: true,
    },
    ...rest,
  };
}

type Responder = (url: URL) => VisitorStatsResponse | Response | Promise<VisitorStatsResponse | Response>;

/** The business today the server gives (D-59): the one small orders call useBusinessToday makes. */
const TODAY = '2026-11-15';

/** The range each preset resolves to on the server, for TODAY. */
const RESOLVED: Readonly<Record<string, readonly [string, string]>> = {
  'last-7-days': ['2026-11-09', TODAY],
  'last-30-days': ['2026-10-17', TODAY],
  'this-month': ['2026-11-01', TODAY],
  'last-month': ['2026-10-01', '2026-10-31'],
  'this-year': ['2026-01-01', TODAY],
};

/** Answers as the server does: the range it read, with the dates it resolved. */
function echo(url: URL): VisitorStatsResponse {
  const range = url.searchParams.get('range') ?? 'last-30-days';
  if (range === 'custom') {
    return statsAnswer({}, { range, from: url.searchParams.get('from') ?? '', to: url.searchParams.get('to') ?? '' });
  }
  const [from, to] = RESOLVED[range] ?? RESOLVED['last-30-days'] ?? ['', ''];
  return statsAnswer({}, { range, from, to });
}

/** The fake stats API; returns the calls it answered. */
function backend(respond: VisitorStatsResponse | Responder = statsAnswer()): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/orders', () => HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 0, today: TODAY })),
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

function Harness({ search, onUrlUpdate, theme }: { search: string; onUrlUpdate: OnUrlUpdateFunction; theme: string }) {
  return (
    <div data-theme={theme}>
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
    </div>
  );
}

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined, theme = 'light') {
  return render(<Harness search={search} onUrlUpdate={onUrlUpdate} theme={theme} />);
}

/** The KPI card whose overline label reads `label` (the chart legend says some of the same words). */
function card(label: string): HTMLElement {
  const root = screen
    .getAllByText(label, { selector: 'span' })
    .map((overline) => overline.parentElement?.parentElement)
    .find((element) => element instanceof HTMLElement && element.tagName !== 'FIGURE');
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

/** The Trend card, found by its title. */
function trendCard(): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: 'Visits over time' }).closest('section');
  if (section === null) throw new Error('No Trend card');
  return section;
}

describe('V1 the Trend card', () => {
  it('shows "Visits over time" per day with one bucket for each day of the range', async () => {
    backend();
    await openPage();

    expect(within(trendCard()).getByText('Per day')).toBeInTheDocument();
    const plot = within(trendCard()).getByRole('group', {
      name: 'Page views and unique visitors, Oct 17 to Nov 15, 2026',
    });
    expect(plot.querySelectorAll('[data-bucket]')).toHaveLength(30);
  });

  it('says "Per month" and draws month buckets when the server chose months for This year', async () => {
    const months = Array.from({ length: 11 }, (_, i) => ({
      start: `2026-${String(i + 1).padStart(2, '0')}-01`,
      pageViews: 100 + i,
      uniqueVisitors: 10 + i,
    }));
    backend(statsAnswer({}, { range: 'this-year', from: '2026-01-01', bucket: 'month', trend: months }));
    await openPage('?range=this-year');

    expect(within(trendCard()).getByText('Per month')).toBeInTheDocument();
    const plot = within(trendCard()).getByRole('group', {
      name: 'Page views and unique visitors, Jan 1 to Nov 15, 2026',
    });
    expect(plot.querySelectorAll('[data-bucket]')).toHaveLength(11);
    expect(within(plot).getByText('Jan')).toBeInTheDocument();
  });

  it('has no axe violations with the chart shown', async () => {
    backend();
    const { container } = await openPage();
    within(trendCard()).getByRole('group');

    await expectNoAxeViolations(container);
  });
});

/** A list card, found by its title. */
function listCard(title: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (section === null) throw new Error(`No card ${title}`);
  return section;
}

describe('V1 the Most viewed pages card', () => {
  it('shows "Most viewed pages" with its sub line and the server rows by page name', async () => {
    backend();
    await openPage();

    expect(screen.queryByRole('heading', { level: 2, name: 'Most viewed pages' })).not.toBeNull();
    const card = listCard('Most viewed pages');
    expect(within(card).getByText('Every page opened')).toBeInTheDocument();
    const rows = within(within(card).getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0] ?? card).getByText('Gallery')).toBeInTheDocument();
    expect(within(rows[0] ?? card).getByText('412 · 38%')).toBeInTheDocument();
    expect(within(rows[3] ?? card).getByText('Page not found')).toBeInTheDocument();
  });

  it('fills each bar to the share the server sent', async () => {
    backend();
    await openPage();

    const fills = listCard('Most viewed pages').querySelectorAll<HTMLElement>('li [style]');
    expect([...fills].map((bar) => bar.style.getPropertyValue('--bar-w'))).toEqual(['38%', '28%', '18%', '16%']);
  });

  it.each([
    ['home', 'Home'],
    ['products', 'Products'],
    ['gallery', 'Gallery'],
    ['contact', 'Contact'],
    ['privacy', 'Privacy Policy'],
    ['cookies', 'Cookie Policy'],
    ['terms', 'Terms of Use'],
    ['accessibility', 'Accessibility Statement'],
    ['not-found', 'Page not found'],
  ])('names the page key %s "%s"', async (key, label) => {
    backend(statsAnswer({}, { topPages: [{ name: key, count: 1, share: 100 }] }));
    await openPage();

    expect(within(listCard('Most viewed pages')).getByText(label)).toBeInTheDocument();
  });
});

/** The shown names of a list, in order. */
function names(list: HTMLElement): (string | null)[] {
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.querySelector('[data-stat-name]')?.textContent ?? null);
}

describe('V1 the Where visitors came from card', () => {
  it('shows the sources exactly as the server stored them, with their figures', async () => {
    backend();
    await openPage();

    expect(screen.queryByRole('heading', { level: 2, name: 'Where visitors came from' })).not.toBeNull();
    const card = listCard('Where visitors came from');
    expect(within(card).getByText('Visitors who allowed visitor stats')).toBeInTheDocument();
    expect(names(within(card).getByRole('list'))).toEqual(['Facebook', 'Direct', 'basketball-league.ph']);
    expect(within(card).getByText('300 · 62%')).toBeInTheDocument();
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('sits beside Most viewed pages in a row that becomes one column at 1023px and below', async () => {
    backend();
    await openPage();

    const row = listCard('Where visitors came from').parentElement;
    expect(row).toContainElement(listCard('Most viewed pages'));
    expect(row?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid-cols-[repeat(2,minmax(0,1fr))]', 'pg-lt-lg:grid-cols-[minmax(0,1fr)]']),
    );
  });

  it('shows the empty line when no visitor allowed visitor stats', async () => {
    backend(statsAnswer({}, { referrers: [] }));
    await openPage();

    expect(
      within(listCard('Where visitors came from')).getByText('No visitors allowed visitor stats in these dates.'),
    ).toBeInTheDocument();
  });
});

describe('V1 the Devices and browsers card', () => {
  it('shows Device and Browser lists under their h3s with the server order', async () => {
    backend();
    await openPage();

    expect(screen.queryByRole('heading', { level: 2, name: 'Devices and browsers' })).not.toBeNull();
    const card = listCard('Devices and browsers');
    expect(within(card).getByText('Visitors who allowed visitor stats')).toBeInTheDocument();
    const device = within(card).getByRole('heading', { level: 3, name: 'Device' });
    const browser = within(card).getByRole('heading', { level: 3, name: 'Browser' });
    expect(names(device.parentElement ?? card)).toEqual(['Phone', 'Computer', 'Tablet']);
    expect(names(browser.parentElement ?? card)).toEqual(['Chrome', 'Facebook in-app', 'Safari', 'Other']);
    expect(within(browser.parentElement ?? card).getByText('50 · 10%')).toBeInTheDocument();
  });

  it.each([
    ['Phone', 'Phone'],
    ['Tablet', 'Tablet'],
    ['Computer', 'Computer'],
    ['Other', 'Other'],
  ])('names the device %s "%s" from the copy', async (stored, label) => {
    backend(statsAnswer({}, { devices: [{ name: stored, count: 1, share: 100 }] }));
    await openPage();

    const device = within(listCard('Devices and browsers')).getByRole('heading', { level: 3, name: 'Device' });
    expect(names(device.parentElement ?? document.body)).toEqual([label]);
  });

  it('puts the two lists side by side at 1280px and up and stacks them below', async () => {
    backend();
    await openPage();

    const device = within(listCard('Devices and browsers')).getByRole('heading', { level: 3, name: 'Device' });
    const grid = device.parentElement?.parentElement;
    expect(grid?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid-cols-[repeat(2,minmax(0,1fr))]', 'pg-lt-xl:grid-cols-[minmax(0,1fr)]']),
    );
  });

  it('shows the empty line in each list with no rows', async () => {
    backend(statsAnswer({}, { devices: [], browsers: [] }));
    await openPage();

    expect(
      within(listCard('Devices and browsers')).getAllByText('No visitors allowed visitor stats in these dates.'),
    ).toHaveLength(2);
  });

  it('has no axe violations with every list shown', async () => {
    backend();
    const { container } = await openPage();
    listCard('Devices and browsers');

    await expectNoAxeViolations(container);
  });
});

/** The last stats request's query, as an object. */
function lastQuery(calls: URL[]): Record<string, string> {
  return Object.fromEntries(calls.at(-1)?.searchParams ?? []);
}

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

function lastUrl(onUrlUpdate: UrlUpdateSpy): string | undefined {
  return onUrlUpdate.mock.calls.at(-1)?.[0].queryString;
}

function rangeSelect(): HTMLElement {
  return screen.getByLabelText('Date range');
}

describe('V1 the Page speed card', () => {
  it('shows "Page speed" beside Devices and browsers with the server ratings and values', async () => {
    backend();
    await openPage();

    expect(screen.queryByRole('heading', { level: 2, name: 'Page speed' })).not.toBeNull();
    const speed = listCard('Page speed');
    expect(within(speed).getByText('2.1 s')).toBeInTheDocument();
    expect(within(speed).getByText('0.04')).toBeInTheDocument();
    expect(within(speed).getByText('180 ms')).toBeInTheDocument();
    expect(within(speed).getAllByText('Good')).toHaveLength(3);
    expect(within(speed).getByText('From 412 page views')).toBeInTheDocument();
    expect(speed.parentElement).toBe(listCard('Devices and browsers').parentElement);
  });
});

const NOTE =
  'Unique visitors and visits are kept for 13 months. Before Oct 15, 2025, this range shows page views, pages, referrers and devices only.';

/** A month trend from Sep 2025 to Nov 2026 with no unique visitors before the cut month. */
function crossingTrend(): Trend {
  return ['2025-09-01', '2025-10-01', '2025-11-01'].map((start, i) => ({
    start,
    pageViews: 100 + i,
    uniqueVisitors: i === 0 ? null : 10 + i,
  }));
}

describe('V1 ranges over 13 months (D-27)', () => {
  it('shows the 13-month Note with the cut date when the range crosses it, with the partial hints and the line gap', async () => {
    backend(
      statsAnswer(
        { uniqueVisitors: 300, visits: 410, countedFrom: '2025-10-15' },
        { range: 'custom', from: '2025-09-01', to: '2025-11-30', bucket: 'month', trend: crossingTrend() },
      ),
    );
    await openPage('?range=custom&from=2025-09-01&to=2025-11-30');

    expect(screen.queryByText(NOTE)).not.toBeNull();
    expect(screen.getByText(NOTE).closest('div')?.querySelector('svg.lucide-info')).not.toBeNull();
    expect(within(card('Unique visitors')).getByText('Counted from Oct 15, 2025 only')).toBeInTheDocument();
    expect(within(card('Visits')).getByText('Counted from Oct 15, 2025 only')).toBeInTheDocument();
    const plot = within(trendCard()).getByRole('group');
    expect(plot.querySelectorAll('[data-bucket]')).toHaveLength(3);
    expect(plot.querySelectorAll('circle')).toHaveLength(2);
  });

  it('shows no Note when the range is inside the last 13 months', async () => {
    backend();
    await openPage();

    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows Not available for visitors, visits and speed on a wholly old range, and the daily counts for the rest', async () => {
    backend(
      statsAnswer(
        { uniqueVisitors: null, visits: null, pageViews: 4567 },
        {
          range: 'custom',
          from: '2024-01-01',
          to: '2024-12-31',
          bucket: 'month',
          trend: [{ start: '2024-01-01', pageViews: 4567, uniqueVisitors: null }],
          speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: false },
        },
      ),
    );
    await openPage('?range=custom&from=2024-01-01&to=2024-12-31');

    expect(screen.queryByText(NOTE)).not.toBeNull();
    expect(within(card('Unique visitors')).getByText('Not available')).toBeInTheDocument();
    expect(within(card('Visits')).getByText('Not available')).toBeInTheDocument();
    const speed = listCard('Page speed');
    expect(within(speed).getByText('Not available for dates over 13 months ago')).toBeInTheDocument();
    expect(within(speed).queryByText('Good')).toBeNull();
    expect(within(listCard('Most viewed pages')).getByText('Gallery')).toBeInTheDocument();
    expect(within(listCard('Where visitors came from')).getByText('Facebook')).toBeInTheDocument();
  });

  it('has no axe violations with the Note shown', async () => {
    backend(statsAnswer({ countedFrom: '2025-10-15' }, { from: '2025-09-01' }));
    const { container } = await openPage();
    screen.getByText(NOTE);

    await expectNoAxeViolations(container);
  });
});

/** A range with no page views: real zero totals, empty lists and no speed. */
function noVisitsAnswer(): VisitorStatsResponse {
  return statsAnswer(
    { uniqueVisitors: 0, visits: 0, pageViews: 0 },
    {
      trend: dayTrend('2026-10-17', 30).map((bucket) => ({ ...bucket, pageViews: 0, uniqueVisitors: 0 })),
      topPages: [],
      referrers: [],
      devices: [],
      browsers: [],
      speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: true },
    },
  );
}

const CARD_TITLES = [
  'Visits over time',
  'Most viewed pages',
  'Where visitors came from',
  'Devices and browsers',
  'Page speed',
];

const THEMES = [
  ['Blush', 'light'],
  ['Espresso', 'dark'],
] as const;

describe('V1 states: no visits', () => {
  it('keeps the real zero KPIs and shows one "No visits in these dates" EmptyState instead of the trend, lists and speed', async () => {
    backend(noVisitsAnswer());
    renderPage();
    await waitFor(() => {
      expect(within(card('Page views')).getByText('0')).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { level: 2, name: 'No visits in these dates' })).not.toBeNull();
    const empty = screen.getByRole('heading', { level: 2, name: 'No visits in these dates' }).parentElement;
    expect(empty).not.toBeNull();
    expect(
      within(empty as HTMLElement).getByText(
        'Visits show here after people open the website. Try a longer date range.',
      ),
    ).toBeInTheDocument();
    expect(empty?.querySelector('svg.lucide-chart-column')).not.toBeNull();
    expect(within(empty as HTMLElement).queryByRole('button')).toBeNull();
    for (const title of CARD_TITLES) {
      expect(screen.queryByRole('heading', { level: 2, name: title })).toBeNull();
    }
    expect(within(card('Visits')).getByText('0')).toBeInTheDocument();
    expect(within(card('Unique visitors')).getByText('0')).toBeInTheDocument();
  });

  it('shows the cards again when a range with visits is chosen', async () => {
    backend((url) => (url.searchParams.get('range') === 'this-year' ? statsAnswer() : noVisitsAnswer()));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'No visits in these dates' });

    await user.selectOptions(rangeSelect(), 'This year');

    expect(await screen.findByText('4,567')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'No visits in these dates' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Page speed' })).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations with no visits in %s', async (_, theme) => {
    backend(noVisitsAnswer());
    const { container } = renderPage('', () => undefined, theme);
    await screen.findByRole('heading', { level: 2, name: 'No visits in these dates' });

    await expectNoAxeViolations(container);
  });
});

describe('V1 states: loading and a failed first read', () => {
  it('loads in one region: KPI cards loading, the 220 high chart skeleton and skeleton lines in each list and Page speed', async () => {
    backend(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return statsAnswer();
    });
    renderPage();

    expect(screen.getByText('Loading the visitor stats…')).toBeInTheDocument();
    const region = trendCard().closest('[aria-busy="true"]');
    expect(region).not.toBeNull();
    expect(card('Visits')).toHaveAttribute('aria-busy', 'true');
    expect(region).toContainElement(card('Visits'));
    expect(trendCard().querySelector('[style*="--sk-h: 220px"]')).not.toBeNull();
    for (const title of ['Most viewed pages', 'Where visitors came from', 'Devices and browsers', 'Page speed']) {
      const section = listCard(title);
      expect(region).toContainElement(section);
      expect([title, section.querySelector('[style*="--sk-h"]') !== null]).toEqual([title, true]);
    }
    expect(await screen.findByText('4,567')).toBeInTheDocument();
  });

  it('shows the ErrorState under the toolbar with the shared body, and Try Again reads again', async () => {
    let answered = 0;
    backend(() => {
      answered += 1;
      return answered === 1 ? new HttpResponse(null, { status: 500 }) : statsAnswer();
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Couldn't load the visitor stats.")).toBeInTheDocument();
    expect(
      screen.getByText('Check your internet connection. Your data is safe. Nothing was changed.'),
    ).toBeInTheDocument();
    expect(rangeSelect()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Page speed' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('4,567')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the visitor stats.")).toBeNull();
  });

  it.each(THEMES)('has no axe violations while loading and after a failed first read in %s', async (_, theme) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend(async () => {
      await held;
      return new HttpResponse(null, { status: 500 });
    });
    const { container } = renderPage('', () => undefined, theme);
    screen.getByText('Loading the visitor stats…');

    await expectNoAxeViolations(container);
    release();
    await screen.findByText("Couldn't load the visitor stats.");
    await expectNoAxeViolations(container);
  });
});

describe('V1 states: a failed later refresh (P10 D-111)', () => {
  const AT_941 = '2026-11-15T01:41:00Z';
  const AT_955 = '2026-11-15T01:55:00Z';
  const STALE = "Showing figures from 9:41 AM. Couldn't refresh.";

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AT_941));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function refreshAt(instant: string) {
    vi.setSystemTime(new Date(instant));
    await act(async () => {
      await queryClient.invalidateQueries();
    });
  }

  it('keeps the last figures and shows the stale line with Try Again', async () => {
    let answered = 0;
    const { calls } = backend(() => {
      answered += 1;
      return answered === 1 ? statsAnswer() : new HttpResponse(null, { status: 500 });
    });
    await openPage();

    await refreshAt(AT_955);
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(screen.queryByRole('alert')).not.toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(STALE);
    expect(alert.parentElement).toContainElement(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('4,567')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Page speed' })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the visitor stats.")).toBeNull();
  });

  it('Try Again reads again and the line leaves when it works', async () => {
    let answered = 0;
    const { calls } = backend(() => {
      answered += 1;
      return answered === 2
        ? new HttpResponse(null, { status: 500 })
        : statsAnswer({ pageViews: answered === 3 ? 9999 : 4567 });
    });
    await openPage();
    await refreshAt(AT_955);
    await screen.findByText(STALE);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('9,999')).toBeInTheDocument();
    expect(screen.queryByText(STALE)).toBeNull();
    expect(calls).toHaveLength(3);
  });

  it.each(THEMES)('has no axe violations with the stale line in %s', async (_, theme) => {
    let answered = 0;
    backend(() => {
      answered += 1;
      return answered === 1 ? statsAnswer() : new HttpResponse(null, { status: 500 });
    });
    const { container } = renderPage('', () => undefined, theme);
    await screen.findByText('4,567');
    await refreshAt(AT_955);
    await screen.findByText(STALE);

    await expectNoAxeViolations(container);
  });
});

describe('V1 the date range toolbar (D-24, WEB-10)', () => {
  it('offers the five server presets and Custom range in a Date range select, with Last 30 days chosen', async () => {
    backend(echo);
    await openPage();

    expect(
      within(rangeSelect())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Last 7 days', 'Last 30 days', 'This month', 'Last month', 'This year', 'Custom range']);
    expect(rangeSelect()).toHaveValue('last-30-days');
  });

  it.each([
    ['Last 7 days', 'last-7-days', 'Nov 9 to Nov 15, 2026'],
    ['This month', 'this-month', 'Nov 1 to Nov 15, 2026'],
    ['Last month', 'last-month', 'Oct 1 to Oct 31, 2026'],
    ['This year', 'this-year', 'Jan 1 to Nov 15, 2026'],
  ])('choosing %s writes ?range=%s with replace and asks the server for it by name', async (label, range, dates) => {
    const { calls } = backend(echo);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);

    await user.selectOptions(rangeSelect(), label);

    await waitFor(() => {
      expect(lastQuery(calls)).toEqual({ range });
    });
    expect(lastUrl(onUrlUpdate)).toBe(`?range=${range}`);
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe('replace');
    expect(
      await screen.findByText(`${dates} · Visits to the public website. Staff signed in to admin aren't counted.`),
    ).toBeInTheDocument();
  });

  it('choosing Last 30 days again takes the range out of the URL', async () => {
    const { calls } = backend(echo);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('?range=this-year', onUrlUpdate);
    expect(lastQuery(calls)).toEqual({ range: 'this-year' });

    await user.selectOptions(rangeSelect(), 'Last 30 days');

    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('');
    });
    await waitFor(() => {
      expect(lastQuery(calls)).toEqual({ range: 'last-30-days' });
    });
  });

  it.each(['forever', 'today'])('an unknown ?range=%s falls back to Last 30 days', async (range) => {
    const { calls } = backend(echo);
    await openPage(`?range=${range}`);

    expect(rangeSelect()).toHaveValue('last-30-days');
    expect(lastQuery(calls)).toEqual({ range: 'last-30-days' });
  });

  it('Custom range shows From and To bounded by the 3-year floor and the business today, and keeps the last range', async () => {
    const { calls } = backend(echo);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('?range=this-year', onUrlUpdate);
    expect(screen.queryByLabelText('From')).toBeNull();

    await user.selectOptions(rangeSelect(), 'Custom range');

    await waitFor(() => {
      expect(screen.getByLabelText('From')).toHaveAttribute('min', '2023-11-15');
    });
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    expect(from).toHaveAttribute('type', 'date');
    expect(from).toHaveAttribute('max', TODAY);
    expect(to).toHaveAttribute('min', '2023-11-15');
    expect(to).toHaveAttribute('max', TODAY);
    expect(lastUrl(onUrlUpdate)).toBe('?range=custom');
    expect(screen.queryByText('Enter a start date.')).toBeNull();
    expect(screen.queryByText('Enter an end date.')).toBeNull();
    expect(calls).toHaveLength(1);
    expect(
      screen.getByText(
        "Jan 1 to Nov 15, 2026 · Visits to the public website. Staff signed in to admin aren't counted.",
      ),
    ).toBeInTheDocument();
  });

  it('applies a custom range only once both dates are valid', async () => {
    const { calls } = backend(echo);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-05' } });
    expect(lastUrl(onUrlUpdate)).toBe('?range=custom');
    expect(calls).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-04' } });

    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('?from=2026-01-05&range=custom&to=2026-02-04');
    });
    await waitFor(() => {
      expect(lastQuery(calls)).toEqual({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });
    });
    expect(
      await screen.findByText(
        "Jan 5 to Feb 4, 2026 · Visits to the public website. Staff signed in to admin aren't counted.",
      ),
    ).toBeInTheDocument();
  });

  it('a shared link with a custom range reopens with the dates filled and asks for them', async () => {
    const { calls } = backend(echo);
    renderPage('?range=custom&from=2026-01-05&to=2026-02-04');

    await waitFor(() => {
      expect(lastQuery(calls)).toEqual({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });
    });
    expect(screen.getByLabelText('From')).toHaveValue('2026-01-05');
    expect(screen.getByLabelText('To')).toHaveValue('2026-02-04');
    expect(calls).toHaveLength(1);
  });

  it('says "Enter a start date." and "Enter an end date." under the date that is missing, once touched', async () => {
    backend(echo);
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });
    expect(await screen.findByText('Enter a start date.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });

    expect(await screen.findByText('Enter an end date.')).toBeInTheDocument();
  });

  it('says "The start date must be on or before the end date." and keeps the last applied range', async () => {
    const { calls } = backend(echo);
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } });

    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(lastQuery(calls)).toEqual({ range: 'last-30-days' });
    expect(screen.getByText('4,567')).toBeInTheDocument();
  });

  it('says "Choose a date from Nov 15, 2023 to today." for a date before the 3-year floor', async () => {
    const { calls } = backend(echo);
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2023-11-14' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });

    expect(await screen.findByText('Choose a date from Nov 15, 2023 to today.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('keeps the last figures on screen under aria-busy while a new range loads', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend(async (url) => {
      if (url.searchParams.get('range') === 'this-year') await held;
      return url.searchParams.get('range') === 'this-year' ? statsAnswer({ pageViews: 9999 }) : statsAnswer();
    });
    const user = userEvent.setup();
    await openPage();

    await user.selectOptions(rangeSelect(), 'This year');

    await waitFor(() => {
      expect(screen.getByText('Loading the visitor stats…')).toBeInTheDocument();
    });
    const region = screen.getByText('4,567').closest('[aria-busy="true"]');
    expect(region).not.toBeNull();
    expect(region?.querySelector('[data-kpi-value]')).not.toBeNull();
    release();
    expect(await screen.findByText('9,999')).toBeInTheDocument();
    expect(screen.queryByText('4,567')).toBeNull();
  });

  it('puts the toolbar under the title up to 1023px and each control on its own full-width row on phones', async () => {
    backend(echo);
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');

    const toolbar = rangeSelect().closest(`div.${CSS.escape('pg-phone:flex-col')}`);
    expect(toolbar).not.toBeNull();
    const classes = toolbar?.className.split(/\s+/) ?? [];
    expect(classes).toEqual(expect.arrayContaining(['flex-wrap', 'pg-lt-lg:w-full', 'pg-phone:*:w-full']));
    expect(toolbar).toContainElement(screen.getByLabelText('From'));
    expect(toolbar).toContainElement(screen.getByLabelText('To'));
  });

  it('has no axe violations with Custom range open and a message shown', async () => {
    backend(echo);
    const user = userEvent.setup();
    const { container } = await openPage();
    await user.selectOptions(rangeSelect(), 'Custom range');
    await screen.findByLabelText('From');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });
    await screen.findByText('Enter a start date.');

    await expectNoAxeViolations(container);
  });
});
