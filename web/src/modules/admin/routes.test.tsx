// The guarded admin routes (AUTH-05, D-07, D-20 reversal; plan 04-25), over the app's real route objects with MSW
// answering the API.
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryBranch, routes } from '@/core/routes/router';
import { devRoutes } from '@/modules/admin/routes';
import type { RouteObject } from 'react-router';
import { clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';

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

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin%2Forders');
    // One refresh for the guard, and one more when the sign-in page checks that no session is live.
    expect(probe.count).toBe(2);
    expect(probe.csrf).toEqual(['1', '1']);
  });

  it('with a refresh cookie the shell shows the signed-in user instead of the dev placeholder', async () => {
    const probe = answerRefresh(sessionResponse());
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
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={router} />);

    await screen.findAllByText('Lito Santos', {}, { timeout: 5000 });

    expect(screen.queryByText('Carmen Reyes')).toBeNull();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('opening /admin with a session goes to Signed-in devices (D-43) until the dashboard exists', async () => {
    answerRefresh(sessionResponse());
    const router = createMemoryRouter(routes, { initialEntries: ['/admin'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/sessions');
  });

  it('keeps the return path of a deep link with a query', async () => {
    answerRefresh();
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/orders?page=2'] });
    render(<RouterProvider router={router} />);

    await expect.poll(() => router.state.location.pathname, { timeout: 5000 }).toBe('/admin/login');

    expect(router.state.location.search).toBe('?returnUrl=%2Fadmin%2Forders%3Fpage%3D2');
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

  it('the production /admin section routes are guarded and show the page-not-found screen inside the shell', async () => {
    answerRefresh(sessionResponse());
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/users'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' }, { timeout: 5000 })).toBeVisible();
    expect(screen.getAllByRole('navigation', { name: 'Admin' }).length).toBeGreaterThan(0);
  });

  it('with the dev routes added, /dev/components and the section previews render without a session or a refresh', async () => {
    const probe = answerRefresh();
    const showcase = createMemoryRouter(devTree(), { initialEntries: ['/dev/components'] });
    const first = render(<RouterProvider router={showcase} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Component Showcase/ }, { timeout: 5000 }),
    ).toBeVisible();
    first.unmount();

    const preview = createMemoryRouter(devTree(), { initialEntries: ['/admin/orders'] });
    render(<RouterProvider router={preview} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' }, { timeout: 5000 })).toBeVisible();
    expect(screen.getByText('Development only. This screen is built in a later phase.')).toBeVisible();
    expect(preview.state.location.pathname).toBe('/admin/orders');
    expect(probe.count).toBe(0);
  });
});
