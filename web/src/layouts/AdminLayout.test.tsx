import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { collectConsole } from '@/test/consoleGuard';
import { ERROR_BOUNDARY_COPY } from '@/core/routes/ErrorBoundary';
import { lazyRoute, queryBranch, routes, type RouteModule } from '@/core/routes/router';
import { AdminPreviewRoute } from '@/modules/admin/pages/AdminPreviewPage';
import { devRoutes } from '@/modules/admin/routes';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { acceptSession, clearSession, getSessionUser, takeSignInNotice } from '@/modules/admin/services/session';
import { siteSettingsService } from '@/modules/admin/services/siteSettingsService';
import { AdminFrame } from '@/layouts/AdminLayout';
import { useAdminTheme } from '@/modules/admin/hooks/useAdminTheme';
import { ProfileRoute } from '@/modules/admin/pages/ProfilePage';

/**
 * The dev preview of /admin/orders that plan 08-06 took out of `devRoutes` (the real Orders page replaced it). These layout
 * tests still need a short page to render in the shell, so they add the preview to their own copy of the dev routes.
 */
function devRoutesWithOrdersPreview(): RouteObject[] {
  const [admin, ...rest] = devRoutes;
  const urlState = admin?.children?.[0];
  if (admin === undefined || urlState === undefined) {
    throw new Error('The admin routes changed shape: expected admin > url state.');
  }
  const preview: RouteObject = {
    path: 'orders',
    lazy: lazyRoute(() => Promise.resolve({ Component: AdminPreviewRoute })),
  };
  return [
    { ...admin, children: [{ ...urlState, children: [...(urlState.children ?? []), preview] }] } as RouteObject,
    ...rest,
  ];
}

/**
 * The app's route tree as a dev build has it: the dev-only previews in front of the public layout and the guarded admin
 * routes. Tests run with `__DEV_ROUTES__` false (the production value), so they add the previews themselves, as
 * router.tsx does in dev.
 */
function devTree(): RouteObject[] {
  const [root, ...rest] = routes;
  if (root === undefined) {
    throw new Error('The app has no root route.');
  }
  return [
    { ...root, children: [queryBranch(devRoutesWithOrdersPreview()), ...(root.children ?? [])] } as RouteObject,
    ...rest,
  ];
}

interface AdminTreeOptions {
  /** Replaces the admin layout route's fields (for example its lazy module). */
  readonly layout?: Partial<RouteObject>;
  /** Replaces the dashboard page route's fields. */
  readonly page?: Partial<RouteObject>;
  /** Replaces the orders page route's fields. */
  readonly orders?: Partial<RouteObject>;
}

/** The dev route tree with the admin layout or the dashboard page swapped for a failing one; boundaries stay. */
function adminTree({ layout, page, orders }: AdminTreeOptions): RouteObject[] {
  const admin = devRoutesWithOrdersPreview()[0];
  const urlState = admin?.children?.[0];
  const pages = urlState?.children ?? [];
  const [dashboard, ...others] = pages;
  if (admin === undefined || urlState === undefined || dashboard === undefined) {
    throw new Error('The admin routes changed shape: expected admin > url state > pages.');
  }
  const [root] = devTree();
  return [
    {
      ...root,
      children: [
        queryBranch([
          {
            ...admin,
            ...layout,
            children: [
              {
                ...urlState,
                children: [
                  { ...dashboard, ...page } as RouteObject,
                  ...others.map((route) =>
                    route.path === 'orders' ? ({ ...route, ...orders } as RouteObject) : route,
                  ),
                ],
              } as RouteObject,
            ],
          } as RouteObject,
        ]),
        ...(root?.children ?? []).filter((route) => route.path !== 'admin'),
      ],
    } as RouteObject,
  ];
}

const CRASH = new Error('Kaboom in an admin page');

function Crash(): never {
  throw CRASH;
}

/** Development error reports may only be about the provoked failure. */
function expectOnlyReportsOf(error: Error): void {
  for (const call of collectConsole()) {
    expect(call.args.some((argument) => argument === error)).toBe(true);
  }
}

/** The dev route tree in a memory router at `path`, settled once the page's h1 is on screen. */
async function renderAt(path: string) {
  const router = createMemoryRouter(devTree(), { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  // The first render transforms the lazy route modules on demand, which can take over the default 1 s in a full run.
  await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
  return { ...view, router };
}

function sidebarNav(): HTMLElement {
  const nav = document.querySelector('aside nav[aria-label="Admin"]');
  if (!(nav instanceof HTMLElement)) {
    throw new Error('No sidebar navigation.');
  }
  return nav;
}

function sidebarAside(): HTMLElement {
  const aside = document.querySelector('aside');
  if (!(aside instanceof HTMLElement)) {
    throw new Error('No sidebar.');
  }
  return aside;
}

function sidebarLink(name: string): HTMLElement {
  return within(sidebarNav()).getByRole('link', { name: new RegExp(`^${name}`) });
}

/** What POST /auth/sign-out answers: a status, or `'network'` for a dropped connection. */
type SignOutAnswer = number | 'network';

/**
 * Answers POST /auth/sign-out with `answers` in order (the last one repeats); the returned function says how many calls
 * arrived. Leaving for the real sign-in page makes its loader look for a session, so POST /auth/refresh answers 401
 * (the confirmed sign-out deleted the cookie).
 */
function answerSignOut(...answers: SignOutAnswer[]): () => number {
  const list: SignOutAnswer[] = answers.length === 0 ? [204] : answers;
  let calls = 0;
  server.use(
    http.post('*/api/v1/auth/refresh', () =>
      HttpResponse.json({ title: 'Sign in again', status: 401 }, { status: 401 }),
    ),
    http.post('*/api/v1/auth/sign-out', () => {
      const answer = list[Math.min(calls, list.length - 1)] ?? 204;
      calls += 1;
      return answer === 'network' ? HttpResponse.error() : new HttpResponse(null, { status: answer });
    }),
  );
  return () => calls;
}

describe('AdminLayout sections (D-20, A11Y-04)', () => {
  it.each([
    ['/admin', 'Dashboard'],
    ['/admin/orders', 'Orders'],
    ['/admin/orders/', 'Orders'],
  ])('%s shows the h1 "%s", makes it the only current sidebar item and titles the document', async (path, label) => {
    await renderAt(path);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(label);
    expect(
      [...sidebarNav().querySelectorAll('[aria-current="page"]')].map((link) =>
        link.textContent.replace('Manager', ''),
      ),
    ).toEqual([label]);
    await waitFor(() => {
      expect(document.title).toBe(`${label} · CSPS Admin`);
    });
  });

  it('shows the section icon in the empty state and a primary md link to the Component Showcase', async () => {
    const { container } = await renderAt('/admin/orders');
    const showcase = screen.getByRole('link', { name: 'Open Component Showcase' });
    expect(showcase.className.split(' ')).toEqual(expect.arrayContaining(['bg-primary', 'h-11']));
    // The empty-state title is an h2 under the page h1 (A11Y-02 heading order).
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(container.querySelector('main svg.lucide-clipboard-list')).not.toBeNull();
  });

  it('is signed in as Carmen Reyes (Manager): the Users item shows its Manager tag when it is not current', async () => {
    await renderAt('/admin');
    expect(within(sidebarLink('Users')).getByText('Manager')).toBeInTheDocument();
    expect(sidebarLink('Users')).not.toHaveAttribute('aria-current');
    expect(screen.getAllByText('Carmen Reyes').length).toBeGreaterThan(0);
  });

  it('gives the Manager an Audit Log item and a Settings item after Users in the sidebar and the drawer, but no tab (OQ-2, OQ-3)', async () => {
    await renderAt('/admin');
    const labels = within(sidebarNav())
      .getAllByRole('link')
      .map((link) => link.textContent.replace('Manager', ''));
    expect(labels).toEqual(['Dashboard', 'Orders', 'Company Expenses', 'Users', 'Audit Log', 'Settings', 'My Profile']);
    expect(sidebarLink('Audit Log')).toHaveAttribute('href', '/admin/audit-log');
    expect(sidebarLink('Settings')).toHaveAttribute('href', '/admin/settings');

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(within(drawer).getByRole('link', { name: /^Audit Log/ })).toHaveAttribute('href', '/admin/audit-log');
    expect(within(drawer).getByRole('link', { name: /^Settings/ })).toHaveAttribute('href', '/admin/settings');

    const tabBar = document.querySelectorAll('nav[aria-label="Admin"]');
    const tabs = [...tabBar].filter((nav) => !nav.closest('aside'));
    expect(tabs.flatMap((nav) => [...nav.querySelectorAll('a')].map((link) => link.getAttribute('href')))).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/profile',
    ]);
  });

  it('follows a sidebar navigation: choosing Orders makes Orders current and retitles the page', async () => {
    const { router } = await renderAt('/admin');
    await userEvent.click(sidebarLink('Orders'));
    await screen.findByRole('heading', { level: 1, name: 'Orders' });
    expect(router.state.location.pathname).toBe('/admin/orders');
    expect(sidebarLink('Orders')).toHaveAttribute('aria-current', 'page');
    expect(sidebarLink('Dashboard')).not.toHaveAttribute('aria-current');
    await waitFor(() => {
      expect(document.title).toBe('Orders · CSPS Admin');
    });
  });
});

describe('AdminLayout landmarks and keyboard (A11Y-01, A11Y-02)', () => {
  it('has one main#main, focusable by script only, and labels the sidebar navigation "Admin"', async () => {
    await renderAt('/admin/orders');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(sidebarNav()).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('puts the skip link first in the keyboard order; it moves focus to main and leaves the URL alone', async () => {
    const { router } = await renderAt('/admin/orders');
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/admin/orders');
    expect(router.state.location.hash).toBe('');
  });

  it('Logout signs out on the server, leaves the shell for /admin/login and shows the signed-out notice on the sign-in page', async () => {
    const calls = answerSignOut();
    const { router } = await renderAt('/admin/orders');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(calls()).toBe(1);
    expect(await screen.findByRole('status')).toHaveTextContent("You've signed out.");
  });

  it('keeps the owner copy for a failed Logout word for word (D-45)', () => {
    expect(`${ADMIN_COPY.signOutFailed.title} ${ADMIN_COPY.signOutFailed.message}`).toBe(
      'We couldn’t sign you out. Check your connection and try again.',
    );
  });

  it.each<[string, SignOutAnswer]>([
    ['a 500', 500],
    ['a 503', 503],
    ['a 429', 429],
    ['a network error', 'network'],
  ])(
    'a Logout that fails with %s keeps the person signed in on the same page with the danger toast',
    async (_name, answer) => {
      acceptSession(sessionResponse());
      const calls = answerSignOut(answer);
      const { router } = await renderAt('/admin/orders');

      await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

      expect(await screen.findByText(ADMIN_COPY.signOutFailed.title)).toBeInTheDocument();
      expect(screen.getByText(ADMIN_COPY.signOutFailed.message)).toBeInTheDocument();
      expect(calls()).toBe(1);
      expect(router.state.location.pathname).toBe('/admin/orders');
      expect(screen.queryByText("You've signed out.")).toBeNull();
      expect(getSessionUser()).not.toBeNull();
    },
  );

  it('a 409 twice makes two calls and then shows the same failure state', async () => {
    acceptSession(sessionResponse());
    const calls = answerSignOut(409);
    const { router } = await renderAt('/admin/orders');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByText(ADMIN_COPY.signOutFailed.title)).toBeInTheDocument();
    expect(calls()).toBe(2);
    expect(router.state.location.pathname).toBe('/admin/orders');
    expect(getSessionUser()).not.toBeNull();
  });

  it('a second failed press replaces the toast instead of stacking another', async () => {
    acceptSession(sessionResponse());
    const calls = answerSignOut(500);
    await renderAt('/admin/orders');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByText(ADMIN_COPY.signOutFailed.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(calls()).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText(ADMIN_COPY.signOutFailed.title)).toHaveLength(1);
    });
  });

  it('pressing Logout again after a failure retries and leaves for /admin/login', async () => {
    acceptSession(sessionResponse());
    answerSignOut(500, 204);
    const { router } = await renderAt('/admin/orders');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByText(ADMIN_COPY.signOutFailed.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Carmen Reyes/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByText("You've signed out.")).toBeInTheDocument();
    expect(getSessionUser()).toBeNull();
  });

  it('has no axe violations with the sign-out failure toast showing', async () => {
    acceptSession(sessionResponse());
    answerSignOut(500);
    const { container } = await renderAt('/admin/orders');
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await screen.findByText(ADMIN_COPY.signOutFailed.title);

    await expectNoAxeViolations(container);
  });

  it('has no axe violations', async () => {
    const { container } = await renderAt('/admin/orders');
    await expectNoAxeViolations(container);
  });
});

describe('AdminLayout error boundaries (WEB-05, UI-SPEC "Global error boundary")', () => {
  it('shows the admin error screen inside main when a page crashes, keeping the sidebar and topbar', async () => {
    const router = createMemoryRouter(adminTree({ page: { lazy: () => Promise.resolve({ Component: Crash }) } }), {
      initialEntries: ['/admin'],
    });
    render(<RouterProvider router={router} />);

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('heading', { level: 2, name: ERROR_BOUNDARY_COPY.title })).toBeVisible();
    expect(within(main).getByText(ERROR_BOUNDARY_COPY.adminBody)).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: ERROR_BOUNDARY_COPY.reload })).toBeInTheDocument();
    expect(sidebarNav()).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
    expectOnlyReportsOf(CRASH);
  });

  it('shows the admin error screen in a page root of its own when the admin layout chunk fails to load', async () => {
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/AdminLayout-x.js');
    const router = createMemoryRouter(adminTree({ layout: { lazy: lazyRoute(() => Promise.reject(chunkError)) } }), {
      initialEntries: ['/admin/orders'],
    });
    const { container } = render(<RouterProvider router={router} />);

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('heading', { level: 2, name: ERROR_BOUNDARY_COPY.title })).toBeVisible();
    expect(within(main).getByText(ERROR_BOUNDARY_COPY.adminBody)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'light');
    expect(document.querySelector('aside')).toBeNull();
    expectOnlyReportsOf(chunkError);
    await expectNoAxeViolations(container);
  });
});

/** The page root: the element carrying the theme. */
function pageRoot(): HTMLElement {
  const root = document.querySelector('[data-theme]');
  if (!(root instanceof HTMLElement)) {
    throw new Error('No page root.');
  }
  return root;
}

/** The phone tab bar: the "Admin" navigation outside the sidebar. */
function tabBar(): HTMLElement {
  const nav = [...document.querySelectorAll('nav[aria-label="Admin"]')].find((element) => !element.closest('aside'));
  if (!(nav instanceof HTMLElement)) {
    throw new Error('No tab bar.');
  }
  return nav;
}

const RAIL = 'pg-tablet:in-data-[ui=s-admin-side]:';

afterEach(() => {
  window.localStorage.clear();
  clearSession();
  takeSignInNotice();
});

describe('AdminLayout theme (D-13)', () => {
  it('starts in Blush with nothing saved, and offers dark mode', async () => {
    await renderAt('/admin');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('switches to Espresso on the toggle, saves "dark", and starts in Espresso after a reload', async () => {
    const first = await renderAt('/admin');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
    first.unmount();

    await renderAt('/admin/orders');
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('csps-theme')).toBe('light');
  });

  it('ignores an invalid saved value and starts in Blush', async () => {
    window.localStorage.setItem('csps-theme', 'purple');
    await renderAt('/admin');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });

  it('keeps working in memory when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    await renderAt('/admin');
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });
});

describe('AdminLayout phone tab bar (App. E.6 `.s-tabbar`, D-03)', () => {
  it('lists Dashboard, Orders, Expenses and Profile, with their paths', async () => {
    await renderAt('/admin');
    const links = within(tabBar()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Dashboard', 'Orders', 'Expenses', 'Profile']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/profile',
    ]);
  });

  it.each([
    ['/admin', 'Dashboard'],
    ['/admin/orders', 'Orders'],
  ])('on %s marks %s current, in bold (D-03), and only it', async (path, label) => {
    await renderAt(path);
    const current = [...tabBar().querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual([label]);
    expect(current[0]?.className.split(' ')).toEqual(
      expect.arrayContaining(['aria-[current=page]:font-bold', 'aria-[current=page]:text-ink']),
    );
  });

  // Company Expenses is a real, guarded page since plan 06-04, so the frame is rendered on its own for that section.
  it('marks Expenses current, in bold (D-03), and only it, on the expenses section (a real page since plan 06-04)', () => {
    const router = createMemoryRouter([
      {
        path: '*',
        element: (
          <AdminFrame section="expenses" user={{ name: 'Lito Santos', role: 'admin' }} theme="light">
            <p>page</p>
          </AdminFrame>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    const current = [...tabBar().querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual(['Expenses']);
    expect(current[0]?.className.split(' ')).toEqual(
      expect.arrayContaining(['aria-[current=page]:font-bold', 'aria-[current=page]:text-ink']),
    );
  });

  it('marks Profile current, in bold (D-03), and only it, on the profile section (a real page since plan 05-13)', () => {
    const router = createMemoryRouter([
      {
        path: '*',
        element: (
          <AdminFrame section="profile" user={{ name: 'Lito Santos', role: 'admin' }} theme="light">
            <p>page</p>
          </AdminFrame>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    const current = [...tabBar().querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual(['Profile']);
    expect(current[0]?.className.split(' ')).toEqual(
      expect.arrayContaining(['aria-[current=page]:font-bold', 'aria-[current=page]:text-ink']),
    );
  });

  it('shows only on phones: hidden by default, a 4-column grid in the phone container', async () => {
    await renderAt('/admin');
    expect(tabBar().className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'pg-phone:grid', 'grid-cols-4']));
  });

  it('takes the visitor to the section of a tab', async () => {
    const { router } = await renderAt('/admin');
    await userEvent.click(within(tabBar()).getByRole('link', { name: 'Orders' }));
    await screen.findByRole('heading', { level: 1, name: 'Orders' });
    expect(router.state.location.pathname).toBe('/admin/orders');
  });
});

describe('AdminLayout tablet icon rail (App. C tablet block, WEB-05)', () => {
  it('marks the side column, and gives the sidebar parts their rail looks from 768 to 1023px', async () => {
    await renderAt('/admin');
    const side = document.querySelector('[data-ui="s-admin-side"]');
    const aside = side?.querySelector('aside');
    expect(aside?.className).toContain(`${RAIL}w-(--sidebar-collapsed)`);
    expect(sidebarLink('Orders').className).toContain(`${RAIL}w-[52px]`);
    expect(within(sidebarLink('Users')).getByText('Manager').className).toContain(`${RAIL}hidden`);
    expect(within(sidebarLink('Orders')).getByText('Orders').className).toContain(`${RAIL}hidden`);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' }).className).toContain(`${RAIL}hidden`);
  });

  it('hides the side column on phones and keeps the body in the main column', async () => {
    await renderAt('/admin');
    const side = document.querySelector('[data-ui="s-admin-side"]');
    expect(side?.className.split(' ')).toContain('pg-phone:hidden');
    expect(document.querySelector('[data-ui="s-admin-main"]')).toContainElement(screen.getByRole('main'));
  });
});

describe('AdminLayout route-chunk loading (UI-SPEC UI Considerations: loading, route chunks)', () => {
  it('shows a skeleton page head in a busy main while the next page chunk loads, then the page', async () => {
    let release: (module: RouteModule) => void = () => undefined;
    const pending = new Promise<RouteModule>((resolve) => {
      release = resolve;
    });
    const router = createMemoryRouter(adminTree({ orders: { lazy: () => pending } }), {
      initialEntries: ['/admin'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });

    await userEvent.click(sidebarLink('Orders'));
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
    expect(within(main).queryByRole('heading', { level: 1 })).toBeNull();
    const skeletons = main.querySelectorAll('[aria-hidden="true"][style]');
    expect([...skeletons].map((skeleton) => skeleton.getAttribute('style'))).toEqual([
      '--sk-w: 40%; --sk-h: 34px; --sk-r: 6px;',
      '--sk-w: 60%; --sk-h: 14px; --sk-r: 6px;',
    ]);

    await act(async () => {
      release({ Component: AdminPreviewRoute });
      await pending;
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
  });
});

describe('AdminLayout re-render (React Compiler memo cache)', () => {
  it('keeps the shell when the same route renders again, and updates on a new path', async () => {
    const { router } = await renderAt('/admin/orders');
    await act(async () => {
      await router.navigate('/admin/orders');
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Orders');
    await act(async () => {
      await router.navigate('/admin');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(sidebarLink('Dashboard')).toHaveAttribute('aria-current', 'page');
  });
});

describe('AdminLayout phone navigation drawer (WEB-05, A11Y-02; SPEC-GAP MobileNavDrawer, plan 02-32)', () => {
  // D-34: the button is named for what it will do, so it is "Close navigation" while the drawer is open.
  function openNavigation(): HTMLElement {
    return screen.getByRole('button', { name: /^(Open|Close) navigation$/ });
  }

  it('wires the Topbar menu button to the drawer: aria-controls names it, aria-expanded follows it', async () => {
    await renderAt('/admin/orders');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(openNavigation()).toHaveAttribute('aria-expanded', 'false');
    expect(openNavigation()).toHaveAccessibleName('Open navigation');
    const controls = openNavigation().getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    await userEvent.click(openNavigation());

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(drawer.id).toBe(controls);
    expect(openNavigation()).toHaveAttribute('aria-expanded', 'true');
    expect(openNavigation()).toHaveAccessibleName('Close navigation');
    expect(within(drawer).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
  });

  it('renders the drawer inside the page root after the frame, and makes the frame inert while it is open', async () => {
    await renderAt('/admin');
    const frame = screen.getByRole('main').closest('[data-ui="s-admin-main"]')?.parentElement;
    expect(frame).not.toHaveAttribute('inert');

    await userEvent.click(openNavigation());

    const drawerRoot = screen.getByRole('dialog', { name: 'Navigation' }).parentElement;
    expect(drawerRoot?.previousElementSibling).toBe(frame);
    expect(frame?.closest('[data-theme]')).toContainElement(drawerRoot);
    expect(frame).toHaveAttribute('inert');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(frame).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(openNavigation());
  });

  it('follows a navigation from the drawer: the page changes, the drawer closes and focus is back on the menu button', async () => {
    await renderAt('/admin');
    await userEvent.click(openNavigation());

    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'Orders' }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(openNavigation()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(openNavigation());
  });

  it('signs out from the drawer and leaves for /admin/login', async () => {
    answerSignOut();
    const { router } = await renderAt('/admin');
    await userEvent.click(openNavigation());

    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('button', { name: 'Logout' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByRole('status')).toHaveTextContent("You've signed out.");
  });

  it('has no axe violations with the drawer open', async () => {
    const { container } = await renderAt('/admin');
    await userEvent.click(openNavigation());

    await expectNoAxeViolations(container);
  });
});

describe('AdminLayout user menu (spec §6.6; SPEC-GAP UserMenu, plan 02-32)', () => {
  function userButton(): HTMLElement {
    return screen.getByRole('button', { name: /Carmen Reyes/ });
  }

  it('opens the user menu from the Topbar user button; Logout signs out and leaves for /admin/login', async () => {
    answerSignOut();
    const { router } = await renderAt('/admin');
    expect(userButton()).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(userButton());
    expect(userButton()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByRole('status')).toHaveTextContent("You've signed out.");
  });

  it('takes the user to My Profile from the user menu', async () => {
    // My Profile is a real, guarded page (plan 05-13), so the person is signed in and the profile answers.
    acceptSession(sessionResponse());
    server.use(
      http.get('*/api/v1/profile', () =>
        HttpResponse.json({
          id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
          firstName: 'Carmen',
          lastName: 'Reyes',
          email: 'carmen@example.ph',
          role: 'Manager',
          pendingEmail: null,
          memberSince: '2026-10-17T01:00:00Z',
          version: '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3',
        }),
      ),
    );
    const { router } = await renderAt('/admin');

    await userEvent.click(userButton());
    await userEvent.click(screen.getByRole('menuitem', { name: 'My Profile' }));

    expect(await screen.findByRole('tab', { name: 'Details' }, { timeout: 5000 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/profile');
    expect(sidebarLink('My Profile')).toHaveAttribute('aria-current', 'page');
    clearSession();
  });

  it('has no axe violations with the user menu open', async () => {
    const { container } = await renderAt('/admin');
    await userEvent.click(userButton());

    await expectNoAxeViolations(container);
  });

  it('lists the session items between My Profile and Logout (D-04, D-43, OQ-3)', async () => {
    await renderAt('/admin');

    await userEvent.click(userButton());

    expect(screen.getAllByRole('menuitem').map((element) => element.textContent)).toEqual([
      'My Profile',
      'Signed-in Devices',
      'Sign Out Other Devices',
      'Logout',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Signed-in Devices' })).toHaveAttribute('href', '/admin/sessions');
  });

  it('opens the sign-out-others dialog from the menu, signs the others out, toasts and returns focus to the menu button', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/v1/auth/sign-out-others', () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderAt('/admin');
    await userEvent.click(userButton());

    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out Other Devices' }));

    const dialog = await screen.findByRole('dialog', { name: 'Sign out of other devices?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Others Signed In' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    expect(await screen.findByText('Signed out of other devices')).toBeInTheDocument();
    expect(calls).toBe(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Sign out of other devices?' })).toBeNull();
    });
    expect(userButton()).toHaveFocus();
  });

  it('refreshes the open Signed-in Devices list after Sign Out Other Devices from the menu', async () => {
    acceptSession(sessionResponse());
    const current = {
      id: '00000000-0000-4000-8000-000000000001',
      device: 'Chrome on Windows',
      signedInAt: '2026-10-12T07:42:00Z',
      lastActiveAt: new Date().toISOString(),
      persistent: true,
      current: true,
    };
    const phone = {
      ...current,
      id: '00000000-0000-4000-8000-000000000002',
      device: 'Safari on iPhone',
      current: false,
    };
    let devices = [current, phone];
    server.use(
      http.get('*/api/v1/sessions', () => HttpResponse.json(devices)),
      http.post('*/api/v1/auth/sign-out-others', () => {
        devices = [current];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/sessions'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Safari on iPhone', undefined, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.click(userButton());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out Other Devices' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out of other devices?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign Out Other Devices' }));

    await waitFor(() => {
      expect(screen.queryByText('Safari on iPhone')).toBeNull();
    });
    expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    clearSession();
  });

  // D-39: the dialog stays in the tree while it plays its exit; jsdom runs no animation, so the computed animation name
  // of a closed element is mocked.
  it('keeps the sign-out-others dialog in the tree while it closes, with focus back on the menu button', async () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
      element.getAttribute('data-state') === 'closed'
        ? ({ animationName: 'csp-rise-out' } as CSSStyleDeclaration)
        : real(element, pseudo),
    );
    await renderAt('/admin');
    await userEvent.click(userButton());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out Other Devices' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out of other devices?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep Others Signed In' }));

    expect(dialog.isConnected).toBe(true);
    expect(dialog.getAttribute('data-state')).toBe('closed');
    expect(document.activeElement).toBe(userButton());
  });

  it('keeps the other devices signed in when the dialog is dismissed with Esc', async () => {
    await renderAt('/admin');
    await userEvent.click(userButton());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out Other Devices' }));
    await screen.findByRole('dialog', { name: 'Sign out of other devices?' });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(userButton()).toHaveFocus();
  });
});

/** A page that reads the theme the way a page under the admin layout does, and sets it from two buttons. */
function ThemeProbe() {
  const { theme, setTheme } = useAdminTheme();
  return (
    <div>
      <h1>Theme probe</h1>
      <p>Page theme: {theme}</p>
      <button
        type="button"
        onClick={() => {
          setTheme('dark');
        }}
      >
        Probe dark
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme('light');
        }}
      >
        Probe light
      </button>
    </div>
  );
}

describe('AdminLayout theme context for pages (PROF-04, D-22)', () => {
  async function renderProbe() {
    const router = createMemoryRouter(adminTree({ page: { lazy: () => Promise.resolve({ Component: ThemeProbe }) } }), {
      initialEntries: ['/admin'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Theme probe' }, { timeout: 5000 });
    return router;
  }

  it('gives the page the layout theme and a setter: the setter changes the root, the saved value and the top bar toggle', async () => {
    await renderProbe();
    expect(screen.getByText('Page theme: light')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Probe dark' }));

    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
    expect(screen.getByText('Page theme: dark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('shows the page the theme the top bar toggle chose', async () => {
    await renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(screen.getByText('Page theme: dark')).toBeInTheDocument();
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
  });

  it('reads a stored value that is not light or dark as light, for the page too', async () => {
    window.localStorage.setItem('csps-theme', 'purple');

    await renderProbe();

    expect(screen.getByText('Page theme: light')).toBeInTheDocument();
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });

  it('writes nothing when the page sets the theme that is already active', async () => {
    await renderProbe();
    const write = vi.spyOn(Storage.prototype, 'setItem');

    await userEvent.click(screen.getByRole('button', { name: 'Probe light' }));

    expect(write).not.toHaveBeenCalled();
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
  });

  it('keeps the page and the toggle in step in memory when the storage throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    await renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'Probe dark' }));

    expect(screen.getByText('Page theme: dark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('keeps the Appearance control of My Profile and the top bar toggle in step, both ways', async () => {
    server.use(
      http.get('*/api/v1/profile', () =>
        HttpResponse.json({
          id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
          firstName: 'Carmen',
          lastName: 'Reyes',
          email: 'carmen@example.ph',
          role: 'Manager',
          pendingEmail: null,
          memberSince: '2026-10-17T01:00:00Z',
          version: '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3',
        }),
      ),
    );
    const router = createMemoryRouter(
      adminTree({ page: { lazy: () => Promise.resolve({ Component: ProfileRoute }) } }),
      {
        initialEntries: ['/admin'],
      },
    );
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Carmen Reyes' }, { timeout: 5000 });
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

    await userEvent.click(screen.getByRole('radio', { name: 'Espresso (dark)' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(pageRoot()).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('radio', { name: 'Blush (light)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Espresso (dark)' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('AdminLayout session user (PROF-01)', () => {
  afterEach(() => {
    clearSession();
  });

  /** The admin tree as production has it: the layout loader gives the session user. */
  function signedInTree(): RouteObject[] {
    return adminTree({ layout: { loader: () => getSessionUser() } });
  }

  function renewedSession(firstName: string, lastName: string) {
    return sessionResponse({
      user: {
        id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
        email: 'carmen@example.ph',
        firstName,
        lastName,
        role: 'Manager',
      },
    });
  }

  it('shows the new name in the Sidebar chip and the user menu button after the session user changes, without a reload', async () => {
    acceptSession(renewedSession('Carmen', 'Reyes'));
    const router = createMemoryRouter(signedInTree(), { initialEntries: ['/admin'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    expect(within(sidebarAside()).getByText('Carmen Reyes')).toBeInTheDocument();

    act(() => {
      acceptSession(renewedSession('Ana', 'Cruz'));
    });

    // The names follow the session store on the next render, which a loaded machine can delay: wait for them.
    expect(await within(sidebarAside()).findByText('Ana Cruz', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Ana Cruz/ }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('Carmen Reyes')).toBeNull();
  });

  it('keeps the placeholder user of the dev routes, whatever session the tab holds', async () => {
    acceptSession(renewedSession('Ana', 'Cruz'));

    await renderAt('/admin');

    expect(screen.getByRole('button', { name: /Carmen Reyes/ })).toBeInTheDocument();
    expect(screen.queryByText('Ana Cruz')).toBeNull();
  });
});

describe('AdminLayout session (AUTH-05, AUTH-06, R2-09)', () => {
  it('AdminFrame shows the user it is given, with the role', () => {
    const router = createMemoryRouter([
      {
        path: '*',
        element: (
          <AdminFrame section="orders" user={{ name: 'Lito Santos', role: 'admin' }} theme="light">
            <p>page</p>
          </AdminFrame>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getAllByText('Lito Santos').length).toBeGreaterThan(0);
    expect(screen.queryByText('Carmen Reyes')).toBeNull();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('shows the error screen, not a made-up user, when the route gives no signed-in user', async () => {
    const router = createMemoryRouter(adminTree({ layout: { loader: () => null } }), { initialEntries: ['/admin'] });
    render(<RouterProvider router={router} />);

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('heading', { level: 2, name: ERROR_BOUNDARY_COPY.title })).toBeVisible();
    expect(screen.queryByText('Carmen Reyes')).toBeNull();
    collectConsole();
  });

  it('a session that ends in the API client sends the shell to /admin/login with the session-ended notice', async () => {
    acceptSession(sessionResponse());
    server.use(
      http.get('*/api/v1/site-settings', () => HttpResponse.json({ title: 'x', status: 401 }, { status: 401 })),
      http.post('*/api/v1/auth/refresh', () => HttpResponse.json({ title: 'x', status: 401 }, { status: 401 })),
    );
    const { router } = await renderAt('/admin/orders');

    await expect(siteSettingsService.get()).rejects.toMatchObject({ status: 401 });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Your session ended. Sign in again.');
    clearSession();
  });
});

describe('AdminLayout topbar search (ORD-02, D-53)', () => {
  it('Enter opens Orders with the text as q, encoded, and nothing else in the URL', async () => {
    const { router } = await renderAt('/admin');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'Peña{Enter}');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/orders');
    });
    expect(router.state.location.search).toBe('?q=Pe%C3%B1a');
  });

  it('trims the text before it goes to the URL', async () => {
    const { router } = await renderAt('/admin');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), '  ballers  {Enter}');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=ballers');
    });
  });

  it('opens Orders with the other filters at their defaults when it starts on a filtered list', async () => {
    const { router } = await renderAt('/admin/orders?status=delivered&page=3');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), '0148{Enter}');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=0148');
    });
    expect(router.state.location.pathname).toBe('/admin/orders');
  });

  it('does nothing for an empty search or one of only spaces', async () => {
    const { router } = await renderAt('/admin');
    const search = screen.getByRole('searchbox', { name: 'Search' });

    await userEvent.type(search, '{Enter}');
    await userEvent.type(search, '   {Enter}');

    expect(router.state.location.pathname).toBe('/admin');
    expect(router.state.location.search).toBe('');
  });
});
