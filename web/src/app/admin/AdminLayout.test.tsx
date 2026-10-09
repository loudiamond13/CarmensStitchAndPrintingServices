import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { collectConsole } from '@/test/consoleGuard';
import { ERROR_BOUNDARY_COPY } from '../ErrorBoundary';
import { lazyRoute, routes, type RouteModule } from '../router';
import { AdminPreviewRoute } from './AdminPreviewPage';
import { adminRoutes } from './routes';

/**
 * The app's route tree as a dev build has it: the root route with the admin branch next to the public layout. Tests run
 * with `__DEV_ROUTES__` false (the production value), so they add the branch themselves, as router.tsx does in dev.
 */
function devRoutes(): RouteObject[] {
  const [root, ...rest] = routes;
  if (root === undefined) {
    throw new Error('The app has no root route.');
  }
  return [{ ...root, children: [...(root.children ?? []), ...adminRoutes] } as RouteObject, ...rest];
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
  const admin = adminRoutes[0];
  const urlState = admin?.children?.[0];
  const pages = urlState?.children ?? [];
  const [dashboard, ...others] = pages;
  if (admin === undefined || urlState === undefined || dashboard === undefined) {
    throw new Error('The admin routes changed shape: expected admin > url state > pages.');
  }
  const [root] = devRoutes();
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
  const router = createMemoryRouter(devRoutes(), { initialEntries: [path] });
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

  it('shows the info toast "Not available yet" when Logout is pressed (dev shell)', async () => {
    await renderAt('/admin/users');
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Not available yet');
    expect(toast).toHaveTextContent('Sign-out comes with the sign-in phase.');
    const layer = document.querySelector('[data-ui="s-toast-layer"]');
    expect(layer).toContainElement(toast);
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
