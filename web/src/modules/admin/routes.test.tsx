// The guarded admin routes (AUTH-05, D-07, D-20 reversal; plan 04-25), over the app's real route objects with MSW
// answering the API.
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryBranch, routes } from '@/core/routes/router';
import { devRoutes } from '@/modules/admin/routes';
import type { RouteObject } from 'react-router';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoriesBackend,
  deletedExpenseItem,
  deletedExpenseList,
  deletedExpensesBackend,
  expenseItem,
  expenseList,
  expensesBackend,
} from '@/test/expenseFixtures';
import { server } from '@/test/msw';
import { expectNoAxeViolations } from '@/test/axe';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The first render of a lazy route is slow while many workers start at once (a cold start of the lazy route chunks), so this file waits longer than
// the 5 s default for every test: only this file, never the whole suite (plan 05-37).
vi.setConfig({ testTimeout: 15_000 });

interface RefreshProbe {
  count: number;
  csrf: (string | null)[];
}

/** Answers POST /api/v1/auth/refresh with a 401, or with a session when `session` is given. */
function answerRefresh(session?: ReturnType<typeof sessionResponse>): RefreshProbe {
  const probe: RefreshProbe = { count: 0, csrf: [] };
  server.use(
    http.post('*/api/v1/auth/refresh', ({ request }) => {
      probe.count += 1;
      probe.csrf.push(request.headers.get('X-CSPS-CSRF'));
      return session === undefined
        ? HttpResponse.json(
            { title: 'Sign in again', status: 401 },
            { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
          )
        : HttpResponse.json(session);
    }),
  );
  return probe;
}

beforeEach(() => {
  clearSession();
});

describe('guarded admin routes (AUTH-05, D-07)', () => {
  it('opening /admin/orders without a session refreshes once and lands on the sign-in page with the return path', async () => {
    const probe = answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    // The first lazy route chunk of the file loads here; on a loaded machine that takes longer than 5 s.
    await expect.poll(() => router.state.location.pathname, { timeout: 15_000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin%2Forders');
    // One refresh for the guard, and one more when the sign-in page checks that no session is live.
    expect(probe.count).toBe(2);
    expect(probe.csrf).toEqual(['1', '1']);
  });

  it('with a refresh cookie the shell shows the signed-in user instead of the dev placeholder', async () => {
    const probe = answerRefresh(sessionResponse());
    useOrderHandlers();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    const names = await screen.findAllByText('Carmen Reyes', {}, { timeout: 5000 });

    expect(names.length).toBeGreaterThan(0);
    expect(router.state.location.pathname).toBe('/admin/orders');
    expect(probe.count).toBe(1);
  });

  it('shows a real name and role, not the dev user, for another account', async () => {
    answerRefresh(
      sessionResponse({
        user: {
          id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
          email: 'lito@example.ph',
          firstName: 'Lito',
          lastName: 'Santos',
          role: 'Admin',
        },
      }),
    );
    useOrderHandlers();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    await screen.findAllByText('Lito Santos', {}, { timeout: 5000 });

    expect(screen.queryByText('Carmen Reyes')).toBeNull();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('opening /admin with a session goes to Orders (D-61) until the dashboard exists', async () => {
    answerRefresh(sessionResponse());
    // The Orders page loads its list after the redirect; answer it so the request never goes unhandled.
    const backend = useOrderHandlers();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/orders');
    await expect.poll(() => backend.lists.length, { timeout: 5000 }).toBe(1);
  });

  it('keeps the return path of a deep link with a query', async () => {
    answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders?page=2'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin%2Forders%3Fpage%3D2');
  });
});

const adminSession = () =>
  sessionResponse({
    user: {
      id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
      email: 'lito@example.ph',
      firstName: 'Lito',
      lastName: 'Santos',
      role: 'Admin',
    },
  });

describe('Manager-only routes (USER-08)', () => {
  it.each(['/admin/users', '/admin/audit-log', '/admin/settings'])(
    'an Admin who opens %s lands on /admin and then Orders',
    async (path) => {
      answerRefresh(adminSession());
      useOrderHandlers();
      const router = createMemoryRouter(routes, { initialEntries: [path] });
      render(<RouterProvider router={router} />);

      await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/orders');

      await screen.findAllByText('Lito Santos', {}, { timeout: 5000 });
      expect(screen.queryByRole('link', { name: /^Users/ })).toBeNull();
    },
  );

  it('a Manager who opens /admin/audit-log stays and sees the Audit Log (AUDIT-02)', async () => {
    answerRefresh(sessionResponse());
    server.use(
      http.get('*/api/v1/audit-log/people', () => HttpResponse.json([])),
      http.get('*/api/v1/audit-log', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 })),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/audit-log'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Audit Log' }, { timeout: 5000 })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/audit-log');
    // The shell around it: Audit Log is the one current sidebar item.
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    const current = [...(sidebar?.querySelectorAll('[aria-current="page"]') ?? [])];
    expect(current.map((link) => link.textContent.replace('Manager', ''))).toEqual(['Audit Log']);
    await waitFor(() => {
      expect(document.title).toBe('Audit Log · CSPS Admin');
    });
  });

  it('a Manager who opens /admin/users stays and sees the Users roster (USER-01)', async () => {
    answerRefresh(sessionResponse());
    server.use(
      http.get('*/api/v1/users', () =>
        HttpResponse.json({
          items: [
            {
              id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
              firstName: 'Carmen',
              lastName: 'Reyes',
              email: 'carmen@example.ph',
              role: 'Manager',
              status: 'active',
              inviteState: 'none',
              createdAt: '2026-10-17T01:00:00Z',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        }),
      ),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/users'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' }, { timeout: 5000 })).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Users' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/users');
    // The shell around it: Users is the one current sidebar item (its Manager tag hidden, D-BL-02) and no tab is current.
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    const current = sidebar?.querySelectorAll('[aria-current="page"]') ?? [];
    expect([...current].map((link) => link.textContent.replace('Manager', ''))).toEqual(['Users']);
    const usersLink = [...(sidebar?.querySelectorAll('a') ?? [])].find((link) => link.textContent.startsWith('Users'));
    const managerTag = [...(usersLink?.querySelectorAll('*') ?? [])].find(
      (element) => element.childElementCount === 0 && element.textContent === 'Manager',
    );
    expect(managerTag?.className).toContain('group-aria-[current=page]/nav:hidden');
    const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
    expect(tabBar?.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    await waitFor(() => {
      expect(document.title).toBe('Users · CSPS Admin');
    });
  });

  it.each(['/admin/users', '/admin/audit-log', '/admin/settings'])(
    'a visitor without a session opening %s goes to sign-in with the return path',
    async (path) => {
      answerRefresh();
      const router = createMemoryRouter(routes, { initialEntries: [path] });
      render(<RouterProvider router={router} />);

      await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

      expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent(path)}`);
    },
  );

  it('a session with an unknown role is sent to sign-in, never shown the Manager pages', async () => {
    answerRefresh(sessionResponse({ user: { ...sessionResponse().user, role: 'Owner' } }));
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/users'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(screen.queryByRole('heading', { level: 1, name: 'Page not found' })).toBeNull();
  });
});

describe('Company Expenses for both roles (CEXP-01, D-25, T-06-18)', () => {
  it.each([
    ['Manager', () => sessionResponse()],
    ['Admin', adminSession],
  ])(
    'when a %s opens /admin/expenses they see the real page, not a preview',
    async (_role, session) => {
      answerRefresh(session());
      expensesBackend(expenseList([expenseItem('00000000-0000-4000-8000-000000000001')]));
      const router = createMemoryRouter(routes, { initialEntries: ['/admin/expenses'] });
      render(<RouterProvider router={router} />);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Company Expenses' }, { timeout: 10_000 }),
      ).toBeVisible();
      expect(await screen.findByRole('table', { name: 'Company expenses' })).toBeVisible();
      expect(router.state.location.pathname).toBe('/admin/expenses');
      expect(screen.queryByText('Development only. This screen is built in a later phase.')).toBeNull();
      const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
      const current = [...(sidebar?.querySelectorAll('[aria-current="page"]') ?? [])];
      expect(current.map((link) => link.textContent.replace('Manager', ''))).toEqual(['Company Expenses']);
      await waitFor(() => {
        expect(document.title).toBe('Company Expenses · CSPS Admin');
      });
    },
    30_000,
  );

  it('a visitor without a session opening /admin/expenses goes to sign-in with the return path', async () => {
    answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/expenses'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent('/admin/expenses')}`);
  }, 15_000);
});

describe('Deleted Expenses for Managers (D-03, D-07, OQ-2; plan 06-16)', () => {
  it('a Manager who opens /admin/expenses/deleted stays and sees the page, with Company Expenses the current item', async () => {
    answerRefresh(sessionResponse());
    deletedExpensesBackend(deletedExpenseList([deletedExpenseItem('00000000-0000-4000-8000-000000000001')]));
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/expenses/deleted'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deleted Expenses' }, { timeout: 10_000 }),
    ).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Deleted expenses' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/expenses/deleted');
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    const current = [...(sidebar?.querySelectorAll('[aria-current="page"]') ?? [])];
    expect(current.map((link) => link.textContent.replace('Manager', ''))).toEqual(['Company Expenses']);
    const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
    expect([...(tabBar?.querySelectorAll('[aria-current="page"]') ?? [])].map((link) => link.textContent)).toEqual([
      'Expenses',
    ]);
    await waitFor(() => {
      expect(document.title).toBe('Deleted Expenses · CSPS Admin');
    });
  }, 30_000);

  it('an Admin who opens /admin/expenses/deleted is redirected to /admin/expenses by the route loader', async () => {
    answerRefresh(adminSession());
    expensesBackend(expenseList([expenseItem('00000000-0000-4000-8000-000000000001')]));
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/expenses/deleted'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Company Expenses' }, { timeout: 10_000 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/expenses');
    expect(screen.queryByRole('heading', { level: 1, name: 'Deleted Expenses' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Deleted Expenses' })).toBeNull();
  }, 30_000);

  it('a visitor without a session opening /admin/expenses/deleted goes to sign-in with the return path', async () => {
    answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/expenses/deleted'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent('/admin/expenses/deleted')}`);
  }, 15_000);
});

describe('Settings for Managers (D-14, OQ-3; plan 06-17)', () => {
  it('a Manager who opens /admin/settings stays and sees the page, with Settings the one current item and no tab current', async () => {
    answerRefresh(sessionResponse());
    categoriesBackend();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/settings'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: 10_000 })).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Expense categories' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/settings');
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    const current = [...(sidebar?.querySelectorAll('[aria-current="page"]') ?? [])];
    expect(current.map((link) => link.textContent.replace('Manager', ''))).toEqual(['Settings']);
    const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
    expect(tabBar?.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    await waitFor(() => {
      expect(document.title).toBe('Settings · CSPS Admin');
    });
  }, 30_000);

  it('an Admin sees no Settings item in the shell', async () => {
    answerRefresh(adminSession());
    server.use(http.get('*/api/v1/sessions', () => HttpResponse.json([])));
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/sessions'] });
    render(<RouterProvider router={router} />);

    await screen.findAllByText('Lito Santos', {}, { timeout: 5000 });
    expect(screen.queryByRole('link', { name: /^Settings/ })).toBeNull();
  }, 30_000);
});

describe('the component showcase for Managers (D-30, D-31, D-32)', () => {
  it('a Manager who opens /admin/components stays and sees the showcase marked as demo data, with no nav item current', async () => {
    answerRefresh(sessionResponse());
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/components'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /Component Showcase/ }, { timeout: 10_000 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/components');
    expect(screen.getByText('Demo data')).toBeVisible();
    expect(screen.getByText(/^Demo data\. Every order, name and amount on this page is made up/)).toBeVisible();
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.querySelector('[aria-current="page"]')).toBeNull();
    const tabBar = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((nav) => !nav.closest('aside'));
    expect(tabBar?.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    await waitFor(() => {
      expect(document.title).toBe('Component Showcase · CSPS Admin');
    });
  }, 30_000);

  it('an Admin who opens /admin/components lands on /admin and then Orders, like /admin/users', async () => {
    answerRefresh(adminSession());
    useOrderHandlers();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/components'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/orders');

    await screen.findAllByText('Lito Santos', {}, { timeout: 5000 });
    expect(screen.queryByRole('heading', { level: 1, name: /Component Showcase/ })).toBeNull();
  }, 15_000);

  it('a visitor without a session opening /admin/components goes to sign-in with the return path', async () => {
    answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/components'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent('/admin/components')}`);
  }, 15_000);
});

describe('the confirm-email link (PROF-02, C-17)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  function openConfirmEmail(): ReturnType<typeof createMemoryRouter> {
    window.history.replaceState(null, '', `/admin/confirm-email#token=${'z'.repeat(43)}`);
    server.use(
      http.post('*/api/v1/profile/email-change/check', () => HttpResponse.json({ newEmail: 'carmen.new@example.ph' })),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/confirm-email'] });
    render(<RouterProvider router={router} />);
    return router;
  }

  it('renders without a session and does not send the person to sign in', async () => {
    const probe = answerRefresh();
    const router = openConfirmEmail();

    expect(await screen.findByRole('button', { name: 'Confirm New Email' }, { timeout: 5000 })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/confirm-email');
    expect(probe.count).toBe(0);
  });

  it('renders with a session too, with no redirect to the admin', async () => {
    acceptSession(sessionResponse());
    const router = openConfirmEmail();

    expect(await screen.findByRole('button', { name: 'Confirm New Email' }, { timeout: 5000 })).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin/confirm-email');
  });
});

/** The route tree as a dev-route build has it: the unguarded previews in front of everything else. */
function devTree(): RouteObject[] {
  const [root, ...rest] = routes;
  if (root === undefined) {
    throw new Error('The app has no root route.');
  }
  return [{ ...root, children: [queryBranch(devRoutes), ...(root.children ?? [])] } as RouteObject, ...rest];
}

describe('production and dev route lists (D-20 reversed, Pitfall 11)', () => {
  it('the production routes have no /dev/components: it falls through to the public holding page', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/dev/components'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: /New website/ }, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByText('Component Showcase')).toBeNull();
  });

  it('the production /admin/orders is the guarded real Orders page inside the shell', async () => {
    answerRefresh(sessionResponse());
    useOrderHandlers();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' }, { timeout: 10_000 })).toBeVisible();
    expect(await screen.findByText('148 orders · 37 active', {}, { timeout: 10_000 })).toBeVisible();
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Development only. This screen is built in a later phase.')).toBeNull();
  }, 30_000);

  it('with the dev routes added, /admin/orders is still the guarded real page: no preview shadows it (Pitfall 1)', async () => {
    answerRefresh(sessionResponse());
    useOrderHandlers();
    const router = createMemoryRouter(devTree(), { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('148 orders · 37 active', {}, { timeout: 10_000 })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    expect(screen.queryByText('Development only. This screen is built in a later phase.')).toBeNull();
  }, 30_000);

  it('with the dev routes added, /admin/expenses is still the guarded real page: no preview shadows it (T-06-18)', async () => {
    answerRefresh(sessionResponse());
    expensesBackend(expenseList([expenseItem('00000000-0000-4000-8000-000000000001')]));
    const router = createMemoryRouter(devTree(), { initialEntries: ['/admin/expenses'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('table', { name: 'Company expenses' }, { timeout: 10_000 })).toBeVisible();
    expect(screen.queryByText('Development only. This screen is built in a later phase.')).toBeNull();
  }, 30_000);

  it('with the dev routes added, /dev/components and the section previews render without a session or a refresh', async () => {
    const probe = answerRefresh();
    const showcase = createMemoryRouter(devTree(), { initialEntries: ['/dev/components'] });
    const first = render(<RouterProvider router={showcase} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Component Showcase/ }, { timeout: 15_000 }),
    ).toBeVisible();
    expect(screen.getByText('Demo data')).toBeVisible();
    first.unmount();

    const preview = createMemoryRouter(devTree(), { initialEntries: ['/admin'] });
    render(<RouterProvider router={preview} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, { timeout: 5000 })).toBeVisible();
    expect(screen.getByText('Development only. This screen is built in a later phase.')).toBeVisible();
    expect(preview.state.location.pathname).toBe('/admin');
    expect(probe.count).toBe(0);
  });

  it('with the dev routes added, /dev/public shows the real public layout around labelled fields, with no session request', async () => {
    const probe = answerRefresh();
    const router = createMemoryRouter(devTree(), { initialEntries: ['/dev/public'] });
    const { container } = render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Public layout check' }, { timeout: 15_000 }),
    ).toBeVisible();
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    for (let index = 1; index <= 16; index += 1) {
      expect(screen.getByRole('textbox', { name: `Field ${String(index)}` })).toBeVisible();
    }
    expect(document.title).toBe('Public layout check');
    expect(probe.count).toBe(0);
    await expectNoAxeViolations(container);
  }, 30_000);

  it('the production routes have no /dev/public: it falls through to the public holding page', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/dev/public'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: /New website/ }, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByText('Public layout check')).toBeNull();
  });
});
