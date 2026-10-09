import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { routes } from '../router';
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
  return [{ ...root, children: [...adminRoutes, ...(root.children ?? [])] }, ...rest];
}

/** The dev route tree in a memory router at `path`, settled once the page's h1 is on screen. */
async function renderAt(path: string) {
  const router = createMemoryRouter(devRoutes(), { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
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
    expect(document.title).toBe('Users · CSPS Admin');
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
    expect(document.title).toBe(`${label} · CSPS Admin`);
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
    expect(document.title).toBe('Orders · CSPS Admin');
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
