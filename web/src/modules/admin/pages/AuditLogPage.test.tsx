import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import type { AuditLogItem, AuditLogResponse, AuditPerson } from '@/modules/admin/services/auditLogService';
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
    changes: [],
    snapshot: null,
    orderSnapshot: null,
    orderNumber: null,
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

const PEOPLE: AuditPerson[] = [{ ...CARMEN }, { ...PAOLO }, { ...LIZA }];

function pageOf(items: AuditLogItem[], total = items.length): AuditLogResponse {
  return { items, total, page: 1, pageSize: 20 };
}

type Responder = (url: URL) => AuditLogResponse | Response | Promise<AuditLogResponse | Response>;

/** The fake API: the list (answered by `respond`, or a page of `items`) and the people. Returns the list calls. */
function backend(items: AuditLogItem[] = ITEMS, respond?: Responder, peopleDelay = 0): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/audit-log/people', async () => {
      await delay(peopleDelay);
      return HttpResponse.json(PEOPLE);
    }),
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
        'Every sign-in, security, staff account and expense change, newest first. Times are Manila time. Entries are kept for 8 months.',
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
    expect(actions).toEqual(['Role changed', 'Sign-in failed', 'User invited', 'orders.archived']);
  });

  it('shows When as the business date and time inside a time element carrying the UTC instant', async () => {
    backend();
    await openPage();

    const time = cellOf(rowOf('Role changed'), 'When').querySelector('time');
    expect(time).toHaveTextContent('Oct 17, 2026, 3:42 PM');
    expect(time).toHaveAttribute('datetime', '2026-10-17T07:42:00Z');
  });

  it('names the person who did it and the person it was done to, as text', async () => {
    backend();
    await openPage();

    const row = rowOf('Role changed');
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

    const toggle = within(rowOf('Role changed')).getByRole('button', {
      name: 'Show details for Role changed, Oct 17, 2026, 3:42 PM',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the detail row, renames the toggle and points aria-controls at the detail', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'Show details for Role changed, Oct 17, 2026, 3:42 PM' }));

    const toggle = screen.getByRole('button', { name: 'Hide details for Role changed, Oct 17, 2026, 3:42 PM' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById(toggle.getAttribute('aria-controls') ?? 'missing');
    if (detail === null) {
      throw new Error('aria-controls names no element');
    }
    expect(detail).toBeVisible();
    expect(within(detail).getByText('Role: Admin to Manager')).toBeInTheDocument();
    expect(within(detail).getByText('203.0.113.0/24')).toBeInTheDocument();
    expect(within(detail).getByText('Chrome on Android')).toBeInTheDocument();
    expect(within(detail).getByText('ref-4')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /^Show details for Role changed/ }));
    await user.click(screen.getByRole('button', { name: /^Hide details for Role changed/ }));

    expect(screen.getByRole('button', { name: /^Show details for Role changed/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Role: Admin to Manager')).not.toBeVisible();
  });

  it('lets several rows be open at once', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: /^Show details for Role changed/ }));
    await user.click(screen.getByRole('button', { name: /^Show details for Sign-in failed/ }));

    expect(screen.getByRole('button', { name: /^Hide details for Role changed/ })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /^Show details for Role changed/ }));

    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('turns the chevron only through a transition that reduced motion switches off', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();

    const toggle = screen.getByRole('button', { name: /^Show details for Role changed/ });
    expect(toggle.querySelector('svg')?.getAttribute('class')).toContain('motion-reduce:transition-none');
    expect(toggle.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-180');
    await user.click(toggle);

    expect(screen.getByRole('button', { name: /^Hide details for Role changed/ }).querySelector('svg')).toHaveClass(
      'rotate-180',
    );
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

/** The query a list call carried, as a plain object. */
function paramsOf(call: URL | undefined): Record<string, string> {
  return Object.fromEntries(call?.searchParams ?? []);
}

function lastQuery(calls: URL[]): Record<string, string> {
  return paramsOf(calls.at(-1));
}

/** The query string of the last URL write, or null if there was none. */
function lastUrl(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): string | null {
  return spy.mock.calls.at(-1)?.[0].queryString ?? null;
}

describe('A1 the date range (D-26, WEB-10)', () => {
  it('offers the six ranges in a Date range select, with Last 7 days chosen', async () => {
    backend();
    await openPage();

    const select = screen.getByLabelText('Date range');
    expect([...within(select).getAllByRole('option')].map((option) => option.textContent)).toEqual([
      'Last 7 days',
      'Last 30 days',
      'This month',
      'Last month',
      'Everything kept (8 months)',
      'Custom range',
    ]);
    expect(select).toHaveValue('last-7-days');
  });

  it('Last 30 days sends from and to worked out from the business today, and the URL keeps the name only', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);

    await user.selectOptions(screen.getByLabelText('Date range'), 'Last 30 days');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ from: '2026-09-19', to: '2026-10-18' });
    });
    expect(lastUrl(onUrlUpdate)).toBe('?range=last-30-days');
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe('replace');
    expect(screen.getByText('Range: Last 30 days')).toBeInTheDocument();
  });

  it('This month and Last month resolve against the business today', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();

    await user.selectOptions(screen.getByLabelText('Date range'), 'This month');
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ from: '2026-10-01', to: '2026-10-18' });
    });
    await user.selectOptions(screen.getByLabelText('Date range'), 'Last month');
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    });
  });

  it('Everything kept sends the start of the 8-month window through today', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();

    await user.selectOptions(screen.getByLabelText('Date range'), 'Everything kept (8 months)');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ from: '2026-02-18', to: '2026-10-18' });
    });
    expect(screen.getByText('Range: Everything kept (8 months)')).toBeInTheDocument();
  });

  it('choosing Last 7 days again takes the range out of the URL and removes the chip', async () => {
    backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('?range=last-30-days', onUrlUpdate);

    await user.selectOptions(screen.getByLabelText('Date range'), 'Last 7 days');

    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('');
    });
    await waitFor(() => {
      expect(screen.queryByText('Range: Last 30 days')).toBeNull();
    });
  });

  it('a shared link with range=this-month is worked out against today, not against the day it was copied', async () => {
    const { calls } = backend();
    await openPage('?range=this-month');

    expect(lastQuery(calls)).toMatchObject({ from: '2026-10-01', to: '2026-10-18' });
    expect(screen.getByLabelText('Date range')).toHaveValue('this-month');
  });

  it('Custom range shows From and To, bounded by the start of the kept window and today', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();
    expect(screen.queryByLabelText('From')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Date range'), 'Custom range');

    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    expect(from).toHaveAttribute('type', 'date');
    expect(from).toHaveAttribute('min', '2026-02-18');
    expect(from).toHaveAttribute('max', '2026-10-18');
    expect(to).toHaveAttribute('min', '2026-02-18');
    expect(to).toHaveAttribute('max', '2026-10-18');
  });

  it('applies a custom range only once both dates are valid', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);
    await user.selectOptions(screen.getByLabelText('Date range'), 'Custom range');
    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('?range=custom');
    });
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });

    expect(lastUrl(onUrlUpdate)).toBe('?range=custom');
    expect(calls).toHaveLength(before);

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });

    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('?from=2026-10-01&range=custom&to=2026-10-12');
    });
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ from: '2026-10-01', to: '2026-10-12' });
    });
  });

  it('a shared link with a custom range reopens with the dates filled and sends them', async () => {
    const { calls } = backend();
    await openPage('?range=custom&from=2026-09-01&to=2026-09-15');

    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-09-15');
    expect(lastQuery(calls)).toMatchObject({ from: '2026-09-01', to: '2026-09-15' });
  });

  it('says "Enter a start date." and "Enter an end date." under the date that is missing', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(screen.getByLabelText('Date range'), 'Custom range');
    expect(screen.queryByText('Enter a start date.')).toBeNull();

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });
    expect(await screen.findByText('Enter a start date.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });

    expect(await screen.findByText('Enter an end date.')).toBeInTheDocument();
  });

  it('says "The start date must be on or before the end date." and does not apply the range', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(screen.getByLabelText('Date range'), 'Custom range');
    const before = calls.length;

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } });

    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
  });

  it('says "Choose a date from Feb 18, 2026 to today." for a date outside the kept window', async () => {
    backend();
    const user = userEvent.setup();
    await openPage();
    await user.selectOptions(screen.getByLabelText('Date range'), 'Custom range');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-02-17' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });

    expect(await screen.findByText('Choose a date from Feb 18, 2026 to today.')).toBeInTheDocument();
  });
});

describe('A1 Done by, Action and Done to (D-26)', () => {
  it('lists staff by name, then former staff with the suffix, then System under Done by', async () => {
    backend();
    await openPage();

    const select = screen.getByLabelText('Done by');
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect([...within(select).getAllByRole('option')].map((option) => option.textContent)).toEqual([
      'Anyone',
      'Carmen Reyes',
      'Paolo Garcia',
      'Liza Mercado (former staff)',
      'System',
    ]);
  });

  it('leaves System out of Done to', async () => {
    backend();
    await openPage();

    const select = screen.getByLabelText('Done to');
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    expect([...within(select).getAllByRole('option')].map((option) => option.textContent)).toEqual([
      'Anyone',
      'Carmen Reyes',
      'Paolo Garcia',
      'Liza Mercado (former staff)',
    ]);
  });

  it('disables both with "Loading staff…" while the staff list loads', async () => {
    backend(ITEMS, undefined, 400);
    await openPage();

    for (const label of ['Done by', 'Done to']) {
      const select = screen.getByLabelText(label);
      expect(select).toBeDisabled();
      expect(within(select).getByRole('option', { name: 'Loading staff…' })).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getByLabelText('Done by')).toBeEnabled();
    });
  });

  it('sends the chosen person as actor by id, keeps the id in the URL and shows the chip with the name', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage('', onUrlUpdate);
    await waitFor(() => {
      expect(screen.getByLabelText('Done by')).toBeEnabled();
    });

    await user.selectOptions(screen.getByLabelText('Done by'), 'Paolo Garcia');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ actor: PAOLO.id });
    });
    expect(lastUrl(onUrlUpdate)).toBe(`?actor=${PAOLO.id}`);
    expect(screen.getByText('Done by: Paolo Garcia')).toBeInTheDocument();
  });

  it('sends System as actor=system', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();
    await waitFor(() => {
      expect(screen.getByLabelText('Done by')).toBeEnabled();
    });

    await user.selectOptions(screen.getByLabelText('Done by'), 'System');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ actor: 'system' });
    });
    expect(screen.getByText('Done by: System')).toBeInTheDocument();
  });

  it('groups the actions under the five groups, the expense ones with their labels', async () => {
    backend();
    await openPage();

    const select = screen.getByLabelText('Action');
    expect(within(select).getByRole('option', { name: 'All actions' })).toBeInTheDocument();
    for (const group of [
      'Sign-in and security',
      'Staff accounts',
      'Profile changes',
      'Company expenses',
      'Expense categories',
    ]) {
      expect(within(select).getByRole('group', { name: group })).toBeInTheDocument();
    }
    const expenses = within(select).getByRole('group', { name: 'Company expenses' });
    expect(
      within(expenses)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Expense added',
      'Expense changed',
      'Expense payer changed',
      'Expense deleted',
      'Expense restored',
      'Expense permanently deleted',
    ]);
    const categories = within(select).getByRole('group', { name: 'Expense categories' });
    expect(
      within(categories)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Category added',
      'Category renamed',
      'Category color changed',
      'Category retired',
      'Category back in use',
      'Category deleted',
    ]);
    const staff = within(select).getByRole('group', { name: 'Staff accounts' });
    expect(within(staff).getByRole('option', { name: 'User deactivated' })).toBeInTheDocument();
  });

  it('sends the chosen action code and shows the chip with the label', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();

    await user.selectOptions(screen.getByLabelText('Action'), 'User deactivated');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ action: 'user.deactivated' });
    });
    expect(screen.getByText('Action: User deactivated')).toBeInTheDocument();
  });

  it('sends the chosen person as target and shows the chip', async () => {
    const { calls } = backend();
    const user = userEvent.setup();
    await openPage();
    await waitFor(() => {
      expect(screen.getByLabelText('Done to')).toBeEnabled();
    });

    await user.selectOptions(screen.getByLabelText('Done to'), 'Liza Mercado (former staff)');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ target: LIZA.id });
    });
    expect(screen.getByText('Done to: Liza Mercado (former staff)')).toBeInTheDocument();
  });

  it('shows the chips in order and clears one at a time, each with a replace', async () => {
    backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    await openPage(`?range=last-30-days&actor=${CARMEN.id}&action=user.deactivated&target=${PAOLO.id}`, onUrlUpdate);

    await waitFor(() => {
      expect(screen.getByText('Done to: Paolo Garcia')).toBeInTheDocument();
    });
    const chips = screen
      .getAllByRole('button', { name: /^Clear .* filter$/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(chips).toEqual([
      'Clear range filter',
      'Clear done by filter',
      'Clear action filter',
      'Clear done to filter',
    ]);

    await user.click(screen.getByRole('button', { name: 'Clear action filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Action: User deactivated')).toBeNull();
    });
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe('replace');
  });

  it('reopens the link of a user activity (target and range=all): the person is the Done to filter', async () => {
    const { calls } = backend();
    await openPage(`?target=${PAOLO.id}&range=all`);

    expect(lastQuery(calls)).toMatchObject({ target: PAOLO.id, from: '2026-02-18', to: '2026-10-18' });
    await waitFor(() => {
      expect(screen.getByLabelText('Done to')).toHaveValue(PAOLO.id);
    });
    expect(screen.getByText('Done to: Paolo Garcia')).toBeInTheDocument();
  });

  it('drops an email in the actor and sends no actor (the URL never holds an email, D-40)', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('?actor=carmen%40example.ph', onUrlUpdate);

    expect(calls.every((call) => !call.searchParams.has('actor'))).toBe(true);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    expect(lastUrl(onUrlUpdate)).toBe('');
  });

  it('shows "No matches" with Clear Filters when a filter finds nothing, and Clear Filters resets them', async () => {
    backend([]);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const user = userEvent.setup();
    renderPage('?action=user.deleted', onUrlUpdate);

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

    await waitFor(() => {
      expect(lastUrl(onUrlUpdate)).toBe('');
    });
  });

  it('does not offer Show Everything Kept when an action filter is set (that is "No matches")', async () => {
    backend([]);
    renderPage('?action=user.deleted');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Everything Kept' })).toBeNull();
  });

  it('has no axe violations with the custom range and a filter shown', async () => {
    vi.useRealTimers();
    backend();
    const { container } = await openPage('?range=custom&from=2026-09-01&to=2026-09-15&action=user.deactivated');
    await waitFor(() => {
      expect(screen.getByLabelText('Done by')).toBeEnabled();
    });

    await expectNoAxeViolations(container);
  });
});

const NO_PERSON = { fromPerson: null, toPerson: null } as const;

const EXPENSE_ITEMS: AuditLogItem[] = [
  entry(12, {
    action: 'expense-category.renamed',
    doneTo: null,
    detail: 'name=Supplies>Office%20supplies',
    changes: [{ field: 'name', from: 'Supplies', to: 'Office supplies', ...NO_PERSON }],
  }),
  entry(11, {
    action: 'company-expense.payer-changed',
    doneTo: PAOLO,
    detail: `payer=${CARMEN.id}>${PAOLO.id}`,
    changes: [{ field: 'payer', from: null, to: null, fromPerson: CARMEN, toPerson: PAOLO }],
  }),
  entry(10, {
    action: 'company-expense.changed',
    doneTo: PAOLO,
    detail: 'date=2026-10-05>2026-10-06;fields=notes;payer=x',
    changes: [
      { field: 'date', from: '2026-10-05', to: '2026-10-06', ...NO_PERSON },
      { field: 'category', from: 'Supplies', to: null, ...NO_PERSON },
      { field: 'notes', from: null, to: null, ...NO_PERSON },
    ],
  }),
  entry(9, {
    action: 'company-expense.added',
    doneTo: PAOLO,
    detail: 'date=2026-10-05',
    snapshot: { date: '2026-10-05', category: 'Utilities', amount: 8642.35, payer: PAOLO },
  }),
];

describe('A1 expense and category entries (D-27)', () => {
  it('names the payer as Done to for an expense entry and shows the empty-value icon for a category entry', async () => {
    backend(EXPENSE_ITEMS);
    await openPage();

    expect(cellOf(rowOf('Expense changed'), 'Done to')).toHaveTextContent('Paolo Garcia');
    const category = cellOf(rowOf('Category renamed'), 'Done to');
    expect(within(category).getByText('Not set')).toBeInTheDocument();
  });

  it('reads the change lines and the snapshot of each entry as fixed sentences, never the stored detail', async () => {
    backend(EXPENSE_ITEMS);
    const user = userEvent.setup();
    const { container } = await openPage();

    for (const action of ['Category renamed', 'Expense payer changed', 'Expense changed', 'Expense added']) {
      await user.click(within(rowOf(action)).getByRole('button', { name: new RegExp(`^Show details for ${action}`) }));
    }

    expect(screen.getByText('Name: Supplies to Office supplies')).toBeInTheDocument();
    expect(screen.getByText('Paid by: Carmen Reyes to Paolo Garcia')).toBeInTheDocument();
    expect(screen.getByText('Date: Oct 5, 2026 to Oct 6, 2026')).toBeInTheDocument();
    expect(screen.getByText('Category: Supplies to a deleted category')).toBeInTheDocument();
    expect(screen.getByText('Notes changed')).toBeInTheDocument();
    expect(screen.getByText('Oct 5, 2026 · Utilities · ₱8,642.35 · Paid by Paolo Garcia')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Office%20supplies');
    expect(container).not.toHaveTextContent('payer=');
  });

  it('has no axe violations with the expense entries open', async () => {
    vi.useRealTimers();
    backend(EXPENSE_ITEMS);
    const user = userEvent.setup();
    const { container } = await openPage();
    await user.click(screen.getByRole('button', { name: /^Show details for Expense changed/ }));
    await user.click(screen.getByRole('button', { name: /^Show details for Expense added/ }));

    await expectNoAxeViolations(container);
  });
});

describe('A1 accessibility', () => {
  it('has no axe violations with entries, one of them open', async () => {
    vi.useRealTimers();
    backend();
    const user = userEvent.setup();
    const { container } = await openPage();
    await user.click(screen.getByRole('button', { name: /^Show details for Role changed/ }));

    await expectNoAxeViolations(container);
  });
});

const ORDER_ITEMS: AuditLogItem[] = [
  entry(32, {
    action: 'order-payment.receiver-changed',
    doneTo: null,
    detail: `payment=x;receiver=${CARMEN.id}>${PAOLO.id}`,
    orderNumber: 'ORD-2026-0148',
    changes: [{ field: 'receiver', from: null, to: null, fromPerson: CARMEN, toPerson: PAOLO }],
  }),
  entry(31, {
    action: 'order.permanently-deleted',
    doneTo: null,
    detail: 'number=ORD-2026-0150;status=cancelled;total=100.00;paid=0.00;balance=100.00',
    orderNumber: 'ORD-2026-0150',
    orderSnapshot: { number: 'ORD-2026-0150', status: 'cancelled', total: 100, paid: 0, balance: 100 },
  }),
  entry(30, { action: 'order-item.added', doneTo: null, detail: null, orderNumber: null }),
];

describe('A1 order entries (D-31)', () => {
  it('names the order in Done to, and shows the empty-value icon when the order is not known', async () => {
    backend(ORDER_ITEMS);
    await openPage();

    expect(cellOf(rowOf('Payment receiver changed'), 'Done to')).toHaveTextContent('ORD-2026-0148');
    expect(cellOf(rowOf('Order permanently deleted'), 'Done to')).toHaveTextContent('ORD-2026-0150');
    expect(within(cellOf(rowOf('Item added'), 'Done to')).getByText('Not set')).toBeInTheDocument();
  });

  it('reads who received a payment before and after, and the snapshot of a deleted order, with no axe violations', async () => {
    vi.useRealTimers();
    backend(ORDER_ITEMS);
    const user = userEvent.setup();
    const { container } = await openPage();

    await user.click(screen.getByRole('button', { name: /^Show details for Payment receiver changed/ }));
    await user.click(screen.getByRole('button', { name: /^Show details for Order permanently deleted/ }));

    expect(screen.getByText('Received by: Carmen Reyes to Paolo Garcia')).toBeInTheDocument();
    expect(
      screen.getByText('ORD-2026-0150, Cancelled, total ₱100.00, paid ₱0.00, balance ₱100.00'),
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent('receiver=');
    await expectNoAxeViolations(container);
  });
});
