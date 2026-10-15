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
import { lazyRoute, routes, type RouteModule } from '@/core/routes/router';
import { AdminPreviewRoute } from '@/modules/admin/pages/AdminPreviewPage';
import { devRoutes } from '@/modules/admin/routes';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { siteSettingsService } from '@/modules/admin/services/siteSettingsService';
import { AdminFrame } from '@/layouts/AdminLayout';

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
  return [{ ...root, children: [...devRoutes, ...(root.children ?? [])] } as RouteObject, ...rest];
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
  const admin = devRoutes[0];
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
        {
          ...admin,
          ...layout,
          children: [
            {
              ...urlState,
              children: [
                { ...dashboard, ...page } as RouteObject,
                ...others.map((route) => (route.path === 'orders' ? ({ ...route, ...orders } as RouteObject) : route)),
              ],
            } as RouteObject,
          ],
        } as RouteObject,
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

function sidebarLink(name: string): HTMLElement {
  return within(sidebarNav()).getByRole('link', { name: new RegExp(`^${name}`) });
}

/**
 * Answers POST /auth/sign-out with `status`; the returned function says how many calls arrived. Leaving for the real
 * sign-in page makes its loader look for a session, so POST /auth/refresh answers 401 (no cookie).
 */
function answerSignOut(status = 204): () => number {
  let calls = 0;
  server.use(
    http.post('*/api/v1/auth/refresh', () =>
      HttpResponse.json({ title: 'Sign in again', status: 401 }, { status: 401 }),
    ),
    http.post('*/api/v1/auth/sign-out', () => {
      calls += 1;
      return new HttpResponse(null, { status });
    }),
  );
  return () => calls;
}

describe('AdminLayout tracer (WEB-05, D-20)', () => {
  it('on /admin/users shows the admin shell with Users current, its preview page and the document title', async () => {
    await renderAt('/admin/users');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Users');
    expect(sidebarLink('Users')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(screen.getByText('Development only. This screen is built in a later phase.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Component Showcase' })).toHaveAttribute('href', '/dev/components');
    await waitFor(() => {
      expect(document.title).toBe('Users · CSPS Admin');
    });
  });
});

describe('AdminLayout sections (D-20, A11Y-04)', () => {
  it.each([
    ['/admin', 'Dashboard'],
    ['/admin/orders', 'Orders'],
    ['/admin/expenses', 'Company Expenses'],
    ['/admin/users', 'Users'],
    ['/admin/profile', 'My Profile'],
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

  it('hides the Manager tag on the current Users row (D-BL-02)', async () => {
    await renderAt('/admin/users');
    const tag = within(sidebarLink('Users')).getByText('Manager');
    expect(tag.classList.contains('group-aria-[current=page]/nav:hidden')).toBe(true);
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
    await renderAt('/admin/users');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(sidebarNav()).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('puts the skip link first in the keyboard order; it moves focus to main and leaves the URL alone', async () => {
    const { router } = await renderAt('/admin/users');
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/admin/users');
    expect(router.state.location.hash).toBe('');
  });

  it('Logout signs out on the server, leaves the shell for /admin/login and shows the signed-out notice on the sign-in page', async () => {
    const calls = answerSignOut();
    const { router } = await renderAt('/admin/users');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(calls()).toBe(1);
    expect(await screen.findByRole('status')).toHaveTextContent("You've signed out.");
  });

  it('Logout still goes to /admin/login when the server call fails', async () => {
    answerSignOut(500);
    const { router } = await renderAt('/admin/users');

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByRole('status')).toHaveTextContent("You've signed out.");
  });

  it('has no axe violations', async () => {
    const { container } = await renderAt('/admin/users');
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
    ['/admin/expenses', 'Expenses'],
    ['/admin/profile', 'Profile'],
  ])('on %s marks %s current, in bold (D-03), and only it', async (path, label) => {
    await renderAt(path);
    const current = [...tabBar().querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual([label]);
    expect(current[0]?.className.split(' ')).toEqual(
      expect.arrayContaining(['aria-[current=page]:font-bold', 'aria-[current=page]:text-ink']),
    );
  });

  it('marks no tab current on /admin/users, which has no tab', async () => {
    await renderAt('/admin/users');
    expect(tabBar().querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it('shows only on phones: hidden by default, a 4-column grid in the phone container', async () => {
    await renderAt('/admin');
    expect(tabBar().className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'pg-phone:grid', 'grid-cols-4']));
  });

  it('takes the visitor to the section of a tab', async () => {
    const { router } = await renderAt('/admin');
    await userEvent.click(within(tabBar()).getByRole('link', { name: 'Expenses' }));
    await screen.findByRole('heading', { level: 1, name: 'Company Expenses' });
    expect(router.state.location.pathname).toBe('/admin/expenses');
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
    const { router } = await renderAt('/admin/profile');
    await act(async () => {
      await router.navigate('/admin/profile');
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Profile');
    await act(async () => {
      await router.navigate('/admin/expenses');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Company Expenses' })).toBeInTheDocument();
    expect(sidebarLink('Company Expenses')).toHaveAttribute('aria-current', 'page');
  });
});

describe('AdminLayout phone navigation drawer (WEB-05, A11Y-02; SPEC-GAP MobileNavDrawer, plan 02-32)', () => {
  function openNavigation(): HTMLElement {
    return screen.getByRole('button', { name: 'Open navigation' });
  }

  it('wires the Topbar menu button to the drawer: aria-controls names it, aria-expanded follows it', async () => {
    await renderAt('/admin/orders');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(openNavigation()).toHaveAttribute('aria-expanded', 'false');
    const controls = openNavigation().getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    await userEvent.click(openNavigation());

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(drawer.id).toBe(controls);
    expect(openNavigation()).toHaveAttribute('aria-expanded', 'true');
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
      within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'Company Expenses' }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Company Expenses' })).toBeInTheDocument();
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
    await renderAt('/admin');

    await userEvent.click(userButton());
    await userEvent.click(screen.getByRole('menuitem', { name: 'My Profile' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'My Profile' })).toBeInTheDocument();
    expect(sidebarLink('My Profile')).toHaveAttribute('aria-current', 'page');
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
    const { router } = await renderAt('/admin/users');

    await expect(siteSettingsService.get()).rejects.toMatchObject({ status: 401 });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Your session ended. Sign in again.');
    clearSession();
  });
});
