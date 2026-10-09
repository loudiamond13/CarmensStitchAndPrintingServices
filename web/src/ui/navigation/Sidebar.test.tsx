import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as navigationScenarios } from '@/dev/scenarios/groups/navigation';
import type { Role } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { ADMIN_NAV, Sidebar, type AdminSection } from '@/ui/navigation';
import {
  navTagClasses,
  sidebarClasses,
  sidebarToggleClasses,
  sidebarUserClasses,
  sidebarWidthClasses,
} from './navigation.recipe';
import { navButtonClasses, navIconClasses, navItemClasses, navLabelHiddenClasses } from './navItem.recipe';

// The converted App. D.3 Sidebar (plan 02-26, CSPS-UI-SPEC.md §6.6, UI-SPEC "Owner rulings"): App. D.3's markup and
// props with the D-03 second cue (aria-current + weight 700), the D-27 Logout button and the D-31 D-BL-02 hidden
// "Manager" tag on the current row. The look is proven by the parity suite (`--grep @navigation`); these tests pin the
// markup, the names, the behaviour and the sidebar scenarios.

// L-20: the user role goes through a typed variable, never a literal role prop (jsx-a11y reads it as an ARIA role).
const MANAGER: Role = 'manager';
const ADMIN: Role = 'admin';
const CARMEN = { name: 'Carmen Reyes' };

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function inRouter(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

/** Text without the whitespace text nodes the Mark drawing carries (plan 02-18). */
function text(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, '');
}

function navLinks(): HTMLElement[] {
  return within(screen.getByRole('navigation', { name: 'Admin' })).getAllByRole('link');
}

function link(name: string): HTMLElement {
  return screen.getByRole('link', { name: new RegExp(`^${name}`) });
}

const byId = new Map(navigationScenarios.map((scenario) => [scenario.id, scenario]));

/** Renders a navigation scenario exactly as the parity page does: through the implementation kit, in a router. */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No navigation scenario "${id}".`);
  }
  return render(inRouter(renderNode(kit, scenario.node, scenario.handlers ?? [])));
}

describe('Sidebar markup (App. D.3)', () => {
  it('is an aside with the top bar, the "Admin" navigation and the foot, in that order', () => {
    const { container } = render(inRouter(<Sidebar role={MANAGER} user={CARMEN} />));
    const aside = container.firstElementChild;

    expect(aside?.localName).toBe('aside');
    expect(aside?.children).toHaveLength(3);
    expect(aside?.children[1]).toBe(screen.getByRole('navigation', { name: 'Admin' }));
    expect(hasClasses(aside, sidebarClasses)).toBe(true);
    expect(hasClasses(aside, sidebarWidthClasses.expanded)).toBe(true);
    // The top bar: the lockup without its tagline (in the nav ink), then the collapse toggle.
    const top = aside?.children[0];
    expect(within(top as HTMLElement).getByRole('img', { name: /^CSPS/ })).toBeDefined();
    expect(text(top)).toBe('SPS');
    expect(hasClasses(within(top as HTMLElement).getByRole('img', { name: /^CSPS/ }), 'text-nav-ink')).toBe(true);
    expect(hasClasses(screen.getByRole('button', { name: 'Collapse sidebar' }), sidebarToggleClasses)).toBe(true);
  });

  it('lists the five admin sections in order for a manager, with their paths and icons', () => {
    render(inRouter(<Sidebar role={MANAGER} />));

    expect(navLinks().map((item) => item.textContent)).toEqual([
      'Dashboard',
      'Orders',
      'Company Expenses',
      'UsersManager',
      'My Profile',
    ]);
    expect(navLinks().map((item) => item.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/users',
      '/admin/profile',
    ]);
    for (const item of navLinks()) {
      expect(item.querySelectorAll('svg')).toHaveLength(1);
      expect(item.querySelector('svg')?.getAttribute('width')).toBe('20');
      expect(hasClasses(item.querySelector('svg'), navIconClasses)).toBe(true);
      expect(hasClasses(item, navItemClasses())).toBe(true);
    }
    expect(ADMIN_NAV.map((item) => item.id)).toEqual(['dashboard', 'orders', 'expenses', 'users', 'profile']);
  });

  it('leaves out the manager-only Users section for an admin (the default role)', () => {
    const { rerender } = render(inRouter(<Sidebar role={ADMIN} />));
    expect(navLinks().map((item) => item.textContent)).toEqual([
      'Dashboard',
      'Orders',
      'Company Expenses',
      'My Profile',
    ]);

    rerender(inRouter(<Sidebar />));
    expect(screen.queryByRole('link', { name: /^Users/ })).toBeNull();
  });

  it('shows the user chip (avatar 32 on surface-3, name, role) above Logout when it has a user', () => {
    const { rerender } = render(inRouter(<Sidebar role={MANAGER} user={CARMEN} />));
    const avatar = screen.getByRole('img', { name: 'Carmen Reyes' });
    const chip = avatar.parentElement;

    expect(hasClasses(chip, sidebarUserClasses)).toBe(true);
    expect(chip?.textContent).toBe('CRCarmen ReyesManager');
    expect(hasClasses(avatar, 'bg-surface-3 text-ink')).toBe(true);
    expect(avatar.classList.contains('bg-surface-2')).toBe(false);
    expect(chip?.nextElementSibling).toBe(screen.getByRole('button', { name: 'Logout' }));

    rerender(inRouter(<Sidebar role={ADMIN} user={CARMEN} />));
    expect(screen.getByRole('img', { name: 'Carmen Reyes' }).parentElement?.textContent).toBe('CRCarmen ReyesAdmin');

    rerender(inRouter(<Sidebar role={ADMIN} />));
    expect(screen.queryByRole('img', { name: 'Carmen Reyes' })).toBeNull();
  });
});

describe('Sidebar current item (D-03, D-31 D-BL-02)', () => {
  it('marks only the active section current; Dashboard is the default', () => {
    const { rerender } = render(inRouter(<Sidebar role={MANAGER} />));
    expect(navLinks().map((item) => item.getAttribute('aria-current'))).toEqual(['page', null, null, null, null]);

    rerender(inRouter(<Sidebar role={MANAGER} active="orders" />));
    expect(navLinks().map((item) => item.getAttribute('aria-current'))).toEqual([null, 'page', null, null, null]);
  });

  it('gives the current row the bold second cue and the marker through aria-current (no class hook)', () => {
    render(inRouter(<Sidebar role={MANAGER} active="orders" />));
    const current = link('Orders');

    expect(current.getAttribute('aria-current')).toBe('page');
    for (const token of [
      'aria-[current=page]:font-bold',
      'aria-[current=page]:bg-primary',
      'aria-[current=page]:text-on-primary',
      'aria-[current=page]:before:bg-accent',
      'group/nav',
    ]) {
      expect(current.classList.contains(token)).toBe(true);
    }
  });

  it('hides the Manager tag on the current Users row and keeps it on the row when it is not current', () => {
    const active: AdminSection = 'users';
    const { rerender } = render(inRouter(<Sidebar role={MANAGER} active={active} />));
    const users = link('Users');
    const tag = within(users).getByText('Manager');

    expect(users.getAttribute('aria-current')).toBe('page');
    expect(hasClasses(tag, navTagClasses)).toBe(true);
    expect(tag.classList.contains('group-aria-[current=page]/nav:hidden')).toBe(true);
    // Full opacity (FYI-01): no opacity utility on the tag.
    expect([...tag.classList].some((token) => token.includes('opacity'))).toBe(false);

    rerender(inRouter(<Sidebar role={MANAGER} active="dashboard" />));
    expect(link('Users').getAttribute('aria-current')).toBeNull();
    expect(within(link('Users')).getByText('Manager')).toBeDefined();
  });

  it('calls onNavigate with the section id when a link is followed', async () => {
    const onNavigate = vi.fn();
    render(inRouter(<Sidebar role={MANAGER} onNavigate={onNavigate} />));

    await userEvent.click(link('Company Expenses'));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('expenses');
  });

  it('follows a link without onNavigate', async () => {
    render(inRouter(<Sidebar role={MANAGER} />));
    await userEvent.click(link('Orders'));
    expect(link('Orders')).toBeDefined();
  });
});

describe('Sidebar Logout (D-27)', () => {
  it('is a type="button" button with the nav-item look plus the button resets, and calls onLogout', async () => {
    const onLogout = vi.fn();
    render(inRouter(<Sidebar role={MANAGER} user={CARMEN} onLogout={onLogout} />));
    const logout = screen.getByRole('button', { name: 'Logout' });

    expect(logout.localName).toBe('button');
    expect(logout.getAttribute('type')).toBe('button');
    expect(logout.hasAttribute('href')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Logout' })).toBeNull();
    expect(hasClasses(logout, navItemClasses())).toBe(true);
    expect(hasClasses(logout, navButtonClasses)).toBe(true);
    expect(tokens(navButtonClasses)).toEqual(['appearance-none', 'cursor-pointer', 'text-start', 'w-full']);
    expect(logout.querySelector('svg')?.getAttribute('width')).toBe('20');

    await userEvent.click(logout);
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('does nothing without onLogout', async () => {
    render(inRouter(<Sidebar role={MANAGER} />));
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('button', { name: 'Logout' })).toBeDefined();
  });
});

describe('Sidebar collapse', () => {
  it('collapses and expands from its toggle; the toggle name says what it will do', async () => {
    render(inRouter(<Sidebar role={MANAGER} user={CARMEN} />));
    const aside = screen.getByRole('navigation', { name: 'Admin' }).parentElement;

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
    expect(hasClasses(aside, sidebarWidthClasses.collapsed)).toBe(true);
    expect(hasClasses(aside, sidebarWidthClasses.expanded)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeDefined();
    expect(hasClasses(aside, sidebarWidthClasses.expanded)).toBe(true);
  });

  it('collapsed: the mark only, icons with title tooltips, no tags, no user chip, a titled Logout', () => {
    render(inRouter(<Sidebar role={MANAGER} user={CARMEN} defaultCollapsed />));

    const top = screen.getByRole('navigation', { name: 'Admin' }).previousElementSibling;
    expect(text(top)).toBe('');
    expect(within(top as HTMLElement).getByRole('img', { name: /^CSPS/ })).toBeDefined();
    expect(navLinks().map((item) => item.getAttribute('title'))).toEqual([
      'Dashboard',
      'Orders',
      'Company Expenses',
      'Users',
      'My Profile',
    ]);
    for (const item of navLinks()) {
      expect(hasClasses(item, navItemClasses({ collapsed: true }))).toBe(true);
      expect(hasClasses(item.querySelector('span'), navLabelHiddenClasses)).toBe(true);
    }
    expect(screen.queryByText('Manager')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Carmen Reyes' })).toBeNull();
    const logout = screen.getByRole('button', { name: 'Logout' });
    expect(logout.getAttribute('title')).toBe('Logout');
    expect(hasClasses(logout.querySelector('span'), navLabelHiddenClasses)).toBe(true);
    expect(hasClasses(logout, navItemClasses({ collapsed: true }))).toBe(true);
  });

  it('expanded: no titles and visible labels', () => {
    render(inRouter(<Sidebar role={MANAGER} />));

    expect(navLinks().every((item) => !item.hasAttribute('title'))).toBe(true);
    // Visible labels: only the admin shell's tablet-rail variant (plan 02-31), which applies inside that shell alone.
    expect(
      navLinks().every(
        (item) => item.querySelector('span')?.className === 'pg-tablet:in-data-[ui=s-admin-side]:hidden',
      ),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Logout' }).hasAttribute('title')).toBe(false);
  });

  it('follows the collapsed prop when it is given (controlled), whatever the toggle does', async () => {
    const { rerender } = render(inRouter(<Sidebar role={MANAGER} collapsed />));
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();

    rerender(inRouter(<Sidebar role={MANAGER} collapsed={false} />));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeDefined();
  });

  it('renders the same markup again for the same props, and the new sidebar for new props', () => {
    const { container, rerender } = render(inRouter(<Sidebar role={MANAGER} user={CARMEN} active="orders" />));
    const first = container.innerHTML;

    rerender(inRouter(<Sidebar role={MANAGER} user={CARMEN} active="orders" />));
    expect(container.innerHTML).toBe(first);

    rerender(inRouter(<Sidebar role={ADMIN} user={{ name: 'Lea Santos' }} active="profile" collapsed={false} />));
    expect(container.innerHTML).not.toBe(first);
    expect(link('My Profile').getAttribute('aria-current')).toBe('page');
  });
});

describe('Sidebar scenarios, the D-27 Logout path and axe', () => {
  it('lists the sidebar cases the parity suite compares, in Blush and Espresso', () => {
    const sidebar = navigationScenarios.filter((s) => s.id.startsWith('sidebar-'));
    expect(sidebar.map((s) => [s.id, s.states.join('+'), s.themes.join('+')])).toEqual([
      ['sidebar-dashboard-current', 'rest+hover+focus-visible', 'light+dark'],
      ['sidebar-users-current', 'rest+hover+focus-visible', 'light+dark'],
      ['sidebar-collapsed', 'rest+hover+focus-visible', 'light+dark'],
    ]);
    expect(sidebar.every((s) => s.group === 'navigation' && s.parity && s.node.component === 'Sidebar')).toBe(true);
  });

  it.each(['sidebar-dashboard-current', 'sidebar-users-current', 'sidebar-collapsed'])(
    '%s renders through the kit with Logout at the registry path and no axe violations',
    async (id) => {
      const { container } = renderCase(id);
      const path = id === 'sidebar-collapsed' ? [0, 2, 0] : [0, 2, 1];
      const element = path.reduce<Element | undefined>((parent, index) => parent?.children[index], container);

      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(element?.localName).toBe('button');
      expect(element?.textContent).toBe('Logout');
      await expectNoAxeViolations(container);
    },
  );
});
