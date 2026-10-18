import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { UsersRoute } from '@/modules/admin/pages/UsersPage';
import type { UserListItem, UserListResponse } from '@/modules/admin/services/usersService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

// U1 Users, /admin/users (USER-01, USER-08, D-09, D-19, C-35, OR-4; plan 05-20): the Manager-only roster.

const ME = '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f';

function person(id: string, first: string, last: string, overrides: Partial<UserListItem> = {}): UserListItem {
  return {
    id,
    firstName: first,
    lastName: last,
    email: `${first.toLowerCase()}@example.ph`,
    role: 'Admin',
    status: 'active',
    inviteState: 'none',
    createdAt: '2026-10-17T01:00:00Z',
    ...overrides,
  };
}

/** One row in every state the roster can show. */
const ROWS: UserListItem[] = [
  person(ME, 'Carmen', 'Reyes', { role: 'Manager', email: 'carmen@example.ph' }),
  person('00000000-0000-4000-8000-000000000002', 'Paolo', 'Garcia'),
  person('00000000-0000-4000-8000-000000000003', 'Liza', 'Mercado', { status: 'inactive' }),
  person('00000000-0000-4000-8000-000000000004', 'Rhea', 'Villanueva', { role: 'Manager', status: 'locked' }),
  person('00000000-0000-4000-8000-000000000005', 'Jomar', 'Santos', { inviteState: 'pending' }),
  person('00000000-0000-4000-8000-000000000006', 'Mario', 'Lopez', { inviteState: 'expired' }),
  person('00000000-0000-4000-8000-000000000007', 'Nena', 'Cruz', {
    // 17:00 UTC on Oct 16 is already Oct 17 in Manila.
    createdAt: '2026-10-16T17:00:00Z',
  }),
];

function listOf(items: UserListItem[], total = items.length): UserListResponse {
  return { items, page: 1, pageSize: 20, total };
}

/** What the fake API answers for one request: a page, or a ready-made response. */
type Responder = (url: URL) => UserListResponse | Response | Promise<UserListResponse | Response>;

function backend(items: UserListItem[] = ROWS, respond?: Responder): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/users', async ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const answer = respond === undefined ? listOf(items) : await respond(url);
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
          <UsersRoute />
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
  await screen.findByText('Paolo Garcia');
  return view;
}

/** The URL writes nuqs made, as history mode and query string. */
function updates(spy: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>): { history: string; query: string }[] {
  return spy.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

function rowOf(name: string): HTMLElement {
  const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText(name) !== null);
  if (row === undefined) {
    throw new Error(`No row for ${name}`);
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

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasTone(badge: HTMLElement, tone: keyof typeof badgeToneClasses): boolean {
  return tokens(badgeToneClasses[tone]).every((token) => tokens(badge.className).includes(token));
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

describe('U1 the header', () => {
  it('shows the h1, the Manager only badge and the verbatim subline', async () => {
    backend();
    await openPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Manager only')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Who can sign in to CSPS Admin. Admins manage orders and expenses; Managers can also manage users.',
      ),
    ).toBeInTheDocument();
  });

  it('sets the document title to "Users · CSPS Admin"', async () => {
    backend();
    await openPage();

    expect(document.title).toBe('Users · CSPS Admin');
  });

  it('names the table "Users" and shows the columns, with Actions visually hidden', async () => {
    backend();
    await openPage();

    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['User', 'Email', 'Role', 'Status', 'Created', 'Actions']);
    expect(tokens(screen.getByText('Actions').className)).toEqual(expect.arrayContaining(tokens(srOnlyClasses)));
  });

  it('shows the caption under the table', async () => {
    backend();
    await openPage();

    expect(
      screen.getByText(
        "You can't lock, deactivate, demote or delete your own account. Locked and deactivated users can't sign in, but their records stay on orders and expenses.",
      ),
    ).toBeInTheDocument();
  });
});

describe('U1 the rows', () => {
  it('shows a row for every person with the name, the email and the created date in the business zone', async () => {
    backend();
    await openPage();

    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    const paolo = rowOf('Paolo Garcia');
    expect(within(cellOf(paolo, 'Email')).getByText('paolo@example.ph')).toBeInTheDocument();
    expect(cellOf(paolo, 'Created')).toHaveTextContent('Oct 17, 2026');
    expect(cellOf(rowOf('Nena Cruz'), 'Created')).toHaveTextContent('Oct 17, 2026');
  });

  it('shows the role as the sub line on other rows and "You" on the signed-in Manager', async () => {
    backend();
    await openPage();

    const me = rowOf('Carmen Reyes');
    expect(within(cellOf(me, 'User')).getByText('You')).toBeInTheDocument();
    expect(within(cellOf(rowOf('Paolo Garcia'), 'User')).getByText('Admin')).toBeInTheDocument();
    expect(within(cellOf(rowOf('Rhea Villanueva'), 'User')).getByText('Manager')).toBeInTheDocument();
  });

  it('shows the role badge: Manager accent, Admin neutral', async () => {
    backend();
    await openPage();

    const manager = within(cellOf(rowOf('Carmen Reyes'), 'Role')).getByText('Manager');
    const admin = within(cellOf(rowOf('Paolo Garcia'), 'Role')).getByText('Admin');
    expect(hasTone(manager, 'accent')).toBe(true);
    expect(hasTone(admin, 'neutral')).toBe(true);
  });

  it.each([
    ['Paolo Garcia', 'Active', 'success'],
    ['Liza Mercado', 'Inactive', 'neutral'],
    ['Rhea Villanueva', 'Locked', 'warning'],
  ] as const)('shows %s as a %s badge with a dot in the %s tone', async (name, label, tone) => {
    backend();
    await openPage();

    const badge = within(cellOf(rowOf(name), 'Status')).getByText(label);
    expect(hasTone(badge, tone)).toBe(true);
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('adds "Invite pending" (info) or "Invite expired" (warning) after the status when no password is set', async () => {
    backend();
    await openPage();

    const pending = within(cellOf(rowOf('Jomar Santos'), 'Status')).getByText('Invite pending');
    const expired = within(cellOf(rowOf('Mario Lopez'), 'Status')).getByText('Invite expired');
    expect(hasTone(pending, 'info')).toBe(true);
    expect(hasTone(expired, 'warning')).toBe(true);
    expect(within(cellOf(rowOf('Jomar Santos'), 'Status')).getByText('Active')).toBeInTheDocument();
  });

  it('shows no invitation badge when a password is set', async () => {
    backend();
    await openPage();

    expect(within(cellOf(rowOf('Paolo Garcia'), 'Status')).queryByText(/Invite/)).toBeNull();
  });

  it('gives an Inactive row the surface-2 look on its cells and no other row', async () => {
    backend();
    await openPage();

    const inactive = tokens(cellOf(rowOf('Liza Mercado'), 'Email').className);
    const active = tokens(cellOf(rowOf('Paolo Garcia'), 'Email').className);
    expect(inactive).toContain('bg-surface-2');
    expect(active).not.toContain('bg-surface-2');
    expect(inactive.some((token) => token.startsWith('opacity-'))).toBe(false);
  });

  it('wraps a long name and email anywhere', async () => {
    const long = person('00000000-0000-4000-8000-000000000008', 'Maximiliano', 'Villavicencio-Montenegro', {
      email: 'maximiliano.villavicencio.montenegro.the.third@example.ph',
    });
    backend([person(ME, 'Carmen', 'Reyes', { role: 'Manager' }), long]);
    renderPage();
    await screen.findByText('Maximiliano Villavicencio-Montenegro');

    // overflow-wrap is inherited, so the name's wrapper carries it.
    expect(tokens(screen.getByText('Maximiliano Villavicencio-Montenegro').parentElement?.className ?? '')).toContain(
      'wrap-anywhere',
    );
    expect(tokens(screen.getByText('maximiliano.villavicencio.montenegro.the.third@example.ph').className)).toContain(
      'wrap-anywhere',
    );
  });
});

describe('U1 the row actions (D-19)', () => {
  it('gives the signed-in Manager only a pencil link to My Profile named "Edit your details in My Profile"', async () => {
    backend();
    await openPage();

    const me = rowOf('Carmen Reyes');
    const link = within(me).getByRole('link', { name: 'Edit your details in My Profile' });
    expect(link).toHaveAttribute('href', '/admin/profile');
    expect(within(me).queryAllByRole('button')).toHaveLength(0);
    expect(within(me).getAllByRole('link')).toHaveLength(1);
  });

  it('offers the signed-in Manager no deactivate, activate, lock or delete on their own row', async () => {
    backend();
    await openPage();

    expect(
      within(rowOf('Carmen Reyes')).queryByRole('button', { name: /activate|deactivate|lock|delete/i }),
    ).toBeNull();
  });

  it('puts no profile link on any other row', async () => {
    backend();
    await openPage();

    expect(screen.getAllByRole('link', { name: 'Edit your details in My Profile' })).toHaveLength(1);
  });
});

describe('U1 deleted users (D-09)', () => {
  it('has no Deleted filter, no Restore action and no deleted rows', async () => {
    backend();
    await openPage();

    expect(screen.queryByText(/restore/i)).toBeNull();
    expect(screen.queryByRole('option', { name: /deleted/i })).toBeNull();
    expect(screen.queryByText(/deleted/i)).toBeNull();
  });
});

describe('U1 states', () => {
  it('shows the loading skeleton and announces "Loading users…" and then "Users loaded."', async () => {
    server.use(
      http.get('*/api/v1/users', async () => {
        await delay(50);
        return HttpResponse.json(listOf(ROWS));
      }),
    );
    renderPage();

    expect(await screen.findByText('Loading users…')).toBeInTheDocument();
    expect(await screen.findByText('Users loaded.')).toBeInTheDocument();
    expect(await screen.findByText('Paolo Garcia')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load users." with Try Again on a 500, and Try Again reads the roster again', async () => {
    let fail = true;
    server.use(http.get('*/api/v1/users', () => (fail ? problem(500) : HttpResponse.json(listOf(ROWS)))));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load users.");
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Paolo Garcia')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the "You don\'t have access to this" banner when the role was lost mid-session (403)', async () => {
    server.use(http.get('*/api/v1/users', () => problem(403)));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("You don't have access to this");
    expect(alert).toHaveTextContent('Ask a Manager if you need it.');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('U1 accessibility', () => {
  it('has no axe violations with every row state on screen', async () => {
    backend();
    const { container } = await openPage();

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    });
    await expectNoAxeViolations(container);
  });
});

describe('U1 toolbar (WEB-10)', () => {
  it('shows Search "Name or email" capped at 100, a Role select and a Status select with the verbatim options', async () => {
    backend();
    await openPage();

    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(search).toHaveAttribute('placeholder', 'Name or email');
    expect(search).toHaveAttribute('maxlength', '100');
    const options = (name: string) =>
      within(screen.getByRole('combobox', { name }))
        .getAllByRole('option')
        .map((option) => option.textContent);
    expect(options('Role')).toEqual(['All roles', 'Admin', 'Manager']);
    expect(options('Status')).toEqual(['All statuses', 'Active', 'Inactive', 'Locked']);
  });

  it('writes a typed search to the URL after 300 ms with a replace, and asks the server once for the settled text', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('', onUrlUpdate);

    const search = screen.getByRole('searchbox', { name: 'Search' });
    for (const text of ['c', 'ca', 'car', 'carm']) {
      fireEvent.change(search, { target: { value: text } });
    }
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?q=carm' }]);
    });
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('q')).toBe('carm');
    });
    expect(calls.filter((url) => url.searchParams.has('q'))).toHaveLength(1);
  });

  it('adds the chip "Role: Manager" when Role is set, asks the server for it and replaces the URL', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'manager');

    expect(await screen.findByText('Role: Manager')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('role')).toBe('manager');
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?role=manager' }]);
  });

  it('adds the chip "Status: Locked" when Status is set', async () => {
    const { calls } = backend();
    await openPage();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'locked');

    expect(await screen.findByText('Status: Locked')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('status')).toBe('locked');
    });
  });

  it('shows one chip per non-default filter, and clearing a chip removes only that filter from the URL', async () => {
    backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('?q=ca&role=manager&status=locked', onUrlUpdate);

    expect(screen.getByText('Search: ca')).toBeInTheDocument();
    expect(screen.getByText('Role: Manager')).toBeInTheDocument();
    expect(screen.getByText('Status: Locked')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear role filter' }));

    await waitFor(() => {
      expect(screen.queryByText('Role: Manager')).toBeNull();
    });
    expect(screen.getByText('Search: ca')).toBeInTheDocument();
    expect(screen.getByText('Status: Locked')).toBeInTheDocument();
    expect(updates(onUrlUpdate).at(-1)).toEqual({ history: 'replace', query: '?q=ca&status=locked' });
  });

  it('shows no chip and sends no filter in the unfiltered roster', async () => {
    const { calls } = backend();
    await openPage();

    expect(screen.queryByRole('button', { name: /^Clear .* filter$/ })).toBeNull();
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({ page: '1', pageSize: '20' });
  });

  it('removes an invalid role from the URL once and asks the server with no role', async () => {
    const { calls } = backend();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('?role=owner', onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    });
    expect(calls.every((url) => !url.searchParams.has('role'))).toBe(true);
    expect(screen.queryByText(/^Role:/)).toBeNull();
  });
});

describe('U1 result bar and empty result', () => {
  it('says "Showing 2 users" for many, sorted by name', async () => {
    backend([
      person(ME, 'Carmen', 'Reyes', { role: 'Manager' }),
      person('00000000-0000-4000-8000-000000000002', 'Paolo', 'Garcia'),
    ]);
    await openPage();

    expect(await screen.findByText(/Showing/)).toHaveTextContent('Showing 2 users · sorted by name');
  });

  it('says "Showing 1 user" for exactly one', async () => {
    backend([person(ME, 'Carmen', 'Reyes', { role: 'Manager' })]);
    renderPage();
    await screen.findByText('Carmen Reyes');

    expect(await screen.findByText(/Showing/)).toHaveTextContent('Showing 1 user · sorted by name');
  });

  it('shows "No matches" with the search and filter named, and Clear Filters clears all of them', async () => {
    backend(ROWS, (url) =>
      url.searchParams.get('role') === 'manager' && url.searchParams.get('q') === 'zzz' ? listOf([], 0) : listOf(ROWS),
    );
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?q=zzz&role=manager', onUrlUpdate);

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(
      screen.getByText('No users match “zzz” with role Manager. Try another search or clear the filters.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Search: zzz')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(await screen.findByText('Paolo Garcia')).toBeInTheDocument();
    expect(screen.queryByText('Search: zzz')).toBeNull();
    expect(screen.queryByText('Role: Manager')).toBeNull();
    expect(updates(onUrlUpdate).at(-1)?.query).toBe('');
  });

  it('never shows an empty state for the unfiltered roster', async () => {
    backend();
    await openPage();

    expect(screen.queryByText('No matches')).toBeNull();
    expect(screen.queryByText(/No users yet/)).toBeNull();
  });
});

describe('U1 paging', () => {
  const MANY = (url: URL): UserListResponse => ({
    items: ROWS,
    page: Number(url.searchParams.get('page')),
    pageSize: Number(url.searchParams.get('pageSize')),
    total: 45,
  });

  it('shows Page 1 of 3 for 45 people at 20 a page, and Next pushes ?page=2 and asks for page 2', async () => {
    const { calls } = backend(ROWS, MANY);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('', onUrlUpdate);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('page')).toBe('2');
    });
    expect(updates(onUrlUpdate)).toEqual([{ history: 'push', query: '?page=2' }]);
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toHaveFocus();
  });

  it('Rows per page replaces the URL, resets the page and asks the server for that size', async () => {
    const { calls } = backend(ROWS, MANY);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await openPage('?page=2', onUrlUpdate);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');

    await waitFor(() => {
      expect(calls.at(-1)?.searchParams.get('pageSize')).toBe('50');
    });
    expect(calls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?size=50' }]);
  });

  it('reads ?size=50 from the link', async () => {
    const { calls } = backend();
    await openPage('?size=50');

    expect(calls[0]?.searchParams.get('pageSize')).toBe('50');
  });

  it('clamps page 3 of 2 to the last page with one replace and shows that page', async () => {
    const { calls } = backend(ROWS, (url) => {
      const page = Number(url.searchParams.get('page'));
      return { items: page === 3 ? [] : ROWS, page, pageSize: 20, total: 25 };
    });
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderPage('?page=3', onUrlUpdate);

    await waitFor(() => {
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=2' }]);
    });
    expect(await screen.findByText('Paolo Garcia')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 2 of 2');
    expect(calls.map((url) => url.searchParams.get('page'))).toEqual(['3', '2']);
  });
});

describe('U1 refetch', () => {
  it('keeps the rows and dims them by colour after 200 ms while a filter change loads', async () => {
    backend(ROWS, async (url) => {
      if (url.searchParams.get('role') === 'manager') {
        await delay(600);
      }
      return listOf(ROWS);
    });
    await openPage();
    const region = screen.getByRole('region', { name: 'Users' });
    expect(region).not.toHaveAttribute('data-refetching');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'manager');

    expect(screen.getByText('Paolo Garcia')).toBeInTheDocument();
    expect(region).not.toHaveAttribute('data-refetching');
    await waitFor(() => {
      expect(region).toHaveAttribute('data-refetching', 'true');
    });
    expect(screen.getByText('Paolo Garcia')).toBeInTheDocument();
    await waitFor(() => {
      expect(region).not.toHaveAttribute('data-refetching');
    });
  });
});
