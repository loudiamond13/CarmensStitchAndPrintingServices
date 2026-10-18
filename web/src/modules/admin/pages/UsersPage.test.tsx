import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

function backend(items: UserListItem[] = ROWS): { calls: URL[] } {
  const calls: URL[] = [];
  server.use(
    http.get('*/api/v1/users', ({ request }) => {
      calls.push(new URL(request.url));
      return HttpResponse.json(listOf(items));
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

function Harness({ search }: { search: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
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

function renderPage(search = '') {
  return render(<Harness search={search} />);
}

async function openPage(search = '') {
  const view = renderPage(search);
  await screen.findByText('Paolo Garcia');
  return view;
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

    expect(screen.getByText('Maximiliano Villavicencio-Montenegro').className).toContain('wrap-anywhere');
    expect(screen.getByText('maximiliano.villavicencio.montenegro.the.third@example.ph').className).toContain(
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
