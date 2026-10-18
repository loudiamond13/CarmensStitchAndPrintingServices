import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { AuditLogRoute } from '@/modules/admin/pages/AuditLogPage';
import type {
  AuditLogItem,
  AuditLogResponse,
  AuditPerson,
} from '@/modules/admin/services/auditLogService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// A1 Audit Log, /admin/audit-log (AUDIT-02, D-26..D-29, D-40; plan 05-33): the Manager-only list of audited events.

const CARMEN = { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Carmen Reyes', formerStaff: false };
const PAOLO = { id: '00000000-0000-4000-8000-000000000002', name: 'Paolo Garcia', formerStaff: false };
const LIZA = { id: '00000000-0000-4000-8000-000000000003', name: 'Liza Mercado', formerStaff: true };

function entry(id: number, overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id,
    occurredAt: '2026-10-17T07:42:00Z',
    doneBy: { kind: 'user', person: CARMEN },
    action: 'user.role-changed',
    doneTo: PAOLO,
    detail: 'role=admin>manager',
    ipPrefix: '203.0.113.0/24',
    device: 'Chrome on Android',
    reference: `ref-${String(id)}`,
    ...overrides,
  };
}

/** Newest first, as the API sends them. */
const ITEMS: AuditLogItem[] = [
  entry(4),
  entry(3, {
    occurredAt: '2026-10-17T05:30:00Z',
    doneBy: { kind: 'unknown-account', person: null },
    action: 'auth.sign-in-failed',
    doneTo: null,
    detail: 'unknown-account',
    ipPrefix: null,
    device: null,
  }),
  entry(2, {
    occurredAt: '2026-10-16T02:00:00Z',
    doneBy: { kind: 'system', person: null },
    action: 'user.invited',
    doneTo: CARMEN,
    detail: 'bootstrap',
  }),
  entry(1, {
    occurredAt: '2026-10-15T01:00:00Z',
    doneBy: { kind: 'user', person: LIZA },
    action: 'orders.archived',
    doneTo: null,
    detail: null,
  }),
];

const PEOPLE: AuditPerson[] = [
  { ...CARMEN },
  { ...PAOLO },
  { ...LIZA },
];

function pageOf(items: AuditLogItem[], total = items.length): AuditLogResponse {
  return { items, total, page: 1, pageSize: 20 };
}

type Responder = (url: URL) => AuditLogResponse | Response | Promise<AuditLogResponse | Response>;

/** The fake API: the list (answered by `respond`, or a page of `items`) and the people. Returns the list calls. */
function backend(items: AuditLogItem[] = ITEMS, respond?: Responder): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/audit-log/people', () => HttpResponse.json(PEOPLE)),
    http.get('*/api/v1/audit-log', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const answer = respond === undefined ? pageOf(items) : await respond(url);
      return answer instanceof Response ? answer : HttpResponse.json(answer);
    }),
  );
  return { calls };
}

function problem(status: number): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
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
            <AuditLogRoute />
          </ToastProvider>
        </MemoryRouter>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

function renderPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  return render(<Harness search={search} onUrlUpdate={onUrlUpdate} />);
}

async function openPage(search = '', onUrlUpdate: OnUrlUpdateFunction = () => undefined) {
  const view = renderPage(search, onUrlUpdate);
  await screen.findByRole('table', { name: 'Audit log' });
  return view;
}

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

/** The data row (not the detail row) whose Action cell reads `label`. */
function rowOf(label: string): HTMLElement {
  const row = screen
    .getAllByRole('row')
    .find((candidate) => candidate.querySelector(`td[data-label="Action"]`)?.textContent === label);
  if (row === undefined) {
    throw new Error(`No row for ${label}`);
  }
  return row;
}

function cellOf(row: HTMLElement, label: string): HTMLElement {
  const cell = row.querySelector<HTMLElement>(`td[data-label="${label}"]`);
  if (cell === null) {
    throw new Error(`No ${label} cell`);
  }
  return cell;
}

beforeEach(() => {
  // 12:00 on Oct 18, 2026 in Manila; only Date is faked, so timers and the network run as usual.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T04:00:00Z'));
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  vi.useRealTimers();
  queryClient.clear();
  clearSession();
  document.title = '';
});

describe('A1 the header', () => {
  it('shows the h1, the Manager only badge and the verbatim subline, with no header action', async () => {
    backend();
    await openPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeInTheDocument();
    expect(screen.getByText('Manager only')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Every sign-in, security and staff account change, newest first. Times are Manila time. Entries are kept for 8 months.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export|download/i })).toBeNull();
  });

  it('sets the document title to "Audit Log · CSPS Admin"', async () => {
    backend();
    await openPage();

    expect(document.title).toBe('Audit Log · CSPS Admin');
  });

  it('names the table "Audit log" and shows the columns, with Actions visually hidden', async () => {
    backend();
    await openPage();

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['When', 'Done by', 'Action', 'Done to', 'Actions']);
    expect(tokens(screen.getByText('Actions').className)).toEqual(expect.arrayContaining(tokens(srOnlyClasses)));
  });
});

describe('A1 the request', () => {
  it('asks for the last 7 business days, the first page of 20, with no other filter', async () => {
    const { calls } = backend();
    await openPage();

    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
      page: '1',
      pageSize: '20',
    });
  });
});

describe('A1 the rows', () => {
  it('lists the entries in the order the API sent them, newest first', async () => {
    backend();
    await openPage();

    const actions = screen
      .getAllByRole('row')
      .map((row) => row.querySelector('td[data-label="Action"]')?.textContent)
      .filter((text): text is string => text !== undefined);
    expect(actions).toEqual(['User role changed', 'Sign-in failed', 'User invited', 'orders.archived']);
  });

  it('shows When as the business date and time inside a time element carrying the UTC instant', async () => {
    backend();
    await openPage();

    const time = cellOf(rowOf('User role changed'), 'When').querySelector('time');
    expect(time).toHaveTextContent('Oct 17, 2026, 3:42 PM');
    expect(time).toHaveAttribute('datetime', '2026-10-17T07:42:00Z');
  });

  it('names the person who did it and the person it was done to, as text', async () => {
    backend();
    await openPage();

    const row = rowOf('User role changed');
    expect(cellOf(row, 'Done by')).toHaveTextContent('Carmen Reyes');
    expect(cellOf(row, 'Done to')).toHaveTextContent('Paolo Garcia');
  });

  it('reads System, Unknown account and (former staff) where they apply', async () => {
    backend();
    await openPage();

    expect(cellOf(rowOf('User invited'), 'Done by')).toHaveTextContent('System');
    expect(cellOf(rowOf('Sign-in failed'), 'Done by')).toHaveTextContent('Unknown account');
    expect(cellOf(rowOf('orders.archived'), 'Done by')).toHaveTextContent('Liza Mercado (former staff)');
  });

  it('shows the empty-value icon with "Not set" when nobody is the target', async () => {
    backend();
    await openPage();

    const cell = cellOf(rowOf('Sign-in failed'), 'Done to');
    expect(within(cell).getByText('Not set')).toBeInTheDocument();
    expect(cell.querySelector('svg')).not.toBeNull();
  });

  it('shows the key itself as the action when the key is unknown', async () => {
    backend();
    await openPage();

    expect(cellOf(rowOf('orders.archived'), 'Action')).toHaveTextContent('orders.archived');
  });

  it('shows the result bar with the count and the order', async () => {
    backend();
    await openPage();

    expect(screen.getByText('Showing', { exact: false })).toHaveTextContent('Showing 4 entries · newest first');
  });

  it('says "1 entry" for exactly one', async () => {
    backend([entry(9)]);
    await openPage();

    expect(screen.getByText('Showing', { exact: false })).toHaveTextContent('Showing 1 entry · newest first');
  });

  it('shows no chip for the default range', async () => {
    backend();
    await openPage();

    expect(screen.queryByRole('button', { name: /^Clear .* filter$/ })).toBeNull();
  });
});

describe('A1 expanding an entry (D-27)', () => {
  it('names the toggle for the action and the time, collapsed at first', async () => {
    backend();
    await openPage();

    const toggle = within(rowOf('User role changed')).getByRole('button', {
      name: 'Show details for User role changed, Oct 17, 2026, 3:42 PM',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the detail row, renames the toggle and points aria-controls at the detail', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'Show details for User role changed, Oct 17, 2026, 3:42 PM' }));

    const toggle = screen.getByRole('button', { name: 'Hide details for User role changed, Oct 17, 2026, 3:42 PM' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById(toggle.getAttribute('aria-controls') ?? 'missing');
    expect(detail).not.toBeNull();
    expect(detail).toBeVisible();
    expect(within(detail as HTMLElement).getByText('Role: Admin to Manager')).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText('203.0.113.0/24')).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText('Chrome on Android')).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText('ref-4')).toBeInTheDocument();
  });

  it('keeps the detail hidden until its toggle is pressed', async () => {
    backend();
    await openPage();

    expect(screen.queryByText('Role: Admin to Manager')).not.toBeVisible();
  });

  it('closes the detail again with the same toggle', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /^Show details for User role changed/ }));
    await user.click(screen.getByRole('button', { name: /^Hide details for User role changed/ }));

    expect(screen.getByRole('button', { name: /^Show details for User role changed/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Role: Admin to Manager')).not.toBeVisible();
  });

  it('lets several rows be open at once', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /^Show details for User role changed/ }));
    await user.click(screen.getByRole('button', { name: /^Show details for Sign-in failed/ }));

    expect(screen.getByRole('button', { name: /^Hide details for User role changed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hide details for Sign-in failed/ })).toBeInTheDocument();
    expect(screen.getByText('Role: Admin to Manager')).toBeVisible();
    expect(screen.getByText('Unknown browser')).toBeVisible();
  });

  it('does not put the open state in the URL', async () => {
    backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);
    onUrlUpdate.mockClear();

    await user.click(screen.getByRole('button', { name: /^Show details for User role changed/ }));

    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('turns the chevron only through a transition that reduced motion switches off', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    const toggle = screen.getByRole('button', { name: /^Show details for User role changed/ });
    expect(toggle.querySelector('svg')?.getAttribute('class')).toContain('motion-reduce:transition-none');
    expect(toggle.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-180');
    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: /^Hide details for User role changed/ }).querySelector('svg'),
    ).toHaveClass('rotate-180');
  });

  it('never shows a name or an email in what changed (D-40)', async () => {
    backend([entry(8, { action: 'user.details-changed', detail: 'fields=carmen@example.ph' })]);
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /^Show details for User details changed/ }));

    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText('What changed')).toBeNull();
  });
});

describe('A1 the states', () => {
  it('shows the skeleton with "Loading audit entries…" on the first load', async () => {
    backend(ITEMS, async () => {
      await delay(150);
      return pageOf(ITEMS);
    });
    renderPage();

    expect(await screen.findByText('Loading audit entries…')).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Audit log' });
  });

  it('with no entries in the default range, offers Show Everything Kept, which sets range=all', async () => {
    const { calls } = backend([]);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    renderPage('', onUrlUpdate);

    expect(await screen.findByRole('heading', { name: 'No entries in the last 7 days' })).toBeInTheDocument();
    expect(screen.getByText('Choose a wider date range to see older entries.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show Everything Kept' }));

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe('?range=all');
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe('replace');
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('from')).toBe('2026-02-18');
    });
    expect(calls.at(-1)?.searchParams.get('to')).toBe('2026-10-18');
  });

  it('shows "Couldn\'t load audit entries." with Try Again when the load fails, and Try Again reads again', async () => {
    let fail = true;
    const { calls } = backend(ITEMS, () => (fail ? problem(500) : pageOf(ITEMS)));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Couldn't load audit entries.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('table', { name: 'Audit log' })).toBeInTheDocument();
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the access banner instead of the table when the API answers 403', async () => {
    backend(ITEMS, () => problem(403));
    renderPage();

    expect(await screen.findByText("You don't have access to this")).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('A1 accessibility', () => {
  it('has no axe violations with entries, one of them open', async () => {
    vi.useRealTimers();
    backend();
    const user = userEvent.setup();
    const { container } = await openPage();
    await user.click(screen.getByRole('button', { name: /^Show details for User role changed/ }));

    await expectNoAxeViolations(container);
  });
});
