import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios } from '@/dev/scenarios';
import type { Role } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { ADMIN_NAV, navButtonClasses, navItemClasses, Topbar, UserMenu } from '@/ui/navigation';
import { userMenuClasses, userMenuPopoverClasses } from './navigation.recipe';
import { PROFILE_PATH } from './UserMenu';

// The user menu (SPEC-GAP, spec §6.6, UI-SPEC "SPEC-GAP Primitive Specs" → UserMenu; plan 02-32): the Topbar's user
// button (`aria-haspopup="menu"`, `aria-expanded`) opens a `role="menu"` popover under it with the menuitems "My
// Profile" (→ /admin/profile) and "Logout" in the nav-item look; the WAI-ARIA menu-button keys move between them, and
// Esc closes it with focus back on the button.

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

/** The router's current path, so a test can tell the profile link navigated in the app. */
function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

function renderMenu(onLogout = vi.fn()) {
  const view = render(
    <MemoryRouter initialEntries={['/admin']}>
      <UserMenu user={CARMEN} role={MANAGER} onLogout={onLogout} />
      <button type="button">Elsewhere</button>
      <CurrentPath />
    </MemoryRouter>,
  );
  return { ...view, onLogout, user: userEvent.setup() };
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: /Carmen Reyes/ });
}

function menu(): HTMLElement {
  return screen.getByRole('menu');
}

function item(name: string): HTMLElement {
  return screen.getByRole('menuitem', { name });
}

describe('UserMenu button (spec §6.6)', () => {
  it('is the user-menu button with the avatar, name, role and chevron, announcing a closed menu', () => {
    renderMenu();

    expect(trigger()).toHaveAttribute('type', 'button');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    expect(hasClasses(trigger(), userMenuClasses)).toBe(true);
    expect(trigger().textContent).toBe('CRCarmen ReyesManager');
    expect(trigger().lastElementChild?.localName).toBe('svg');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the Admin role for an admin', () => {
    render(<UserMenu user={{ name: 'Lea Santos' }} role={ADMIN} />);

    expect(screen.getByRole('button', { name: /Lea Santos/ }).textContent).toBe('LSLea SantosAdmin');
  });
});

describe('UserMenu popover (SPEC-GAP: user menu)', () => {
  it('opens on a click: a menu labelled by the button, controlled by it, with My Profile and Logout', async () => {
    const { user } = renderMenu();

    await user.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', menu().id);
    expect(menu()).toHaveAttribute('aria-labelledby', trigger().id);
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((element) => element.textContent),
    ).toEqual(['My Profile', 'Logout']);
    expect(item('My Profile')).toHaveAttribute('href', '/admin/profile');
    expect(ADMIN_NAV.find((entry) => entry.id === 'profile')?.to).toBe(PROFILE_PATH);
    expect(item('Logout').localName).toBe('button');
  });

  it('puts the popover under the button (its next sibling) in the surface-3 look, with nav-item rows and 20px icons', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    expect(trigger().nextElementSibling).toBe(menu());
    expect(hasClasses(menu(), userMenuPopoverClasses)).toBe(true);
    for (const token of ['absolute', 'top-full', 'bg-surface-3', 'rounded-md', 'shadow-level-2', 'min-w-[200px]']) {
      expect(menu().classList.contains(token), token).toBe(true);
    }
    expect(hasClasses(item('My Profile'), navItemClasses())).toBe(true);
    expect(hasClasses(item('Logout'), navItemClasses())).toBe(true);
    expect(hasClasses(item('Logout'), navButtonClasses)).toBe(true);
    expect(item('Logout')).toHaveAttribute('type', 'button');
    for (const element of [item('My Profile'), item('Logout')]) {
      expect(element.querySelector('svg')?.getAttribute('width')).toBe('20');
      expect(element).toHaveAttribute('tabindex', '-1');
    }
  });

  it('focuses the first item when it opens', async () => {
    const { user } = renderMenu();

    await user.click(trigger());

    expect(document.activeElement).toBe(item('My Profile'));
  });

  it('opens from the keyboard: Enter and Space focus the first item, ArrowDown the first, ArrowUp the last', async () => {
    const { user } = renderMenu();
    trigger().focus();

    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(item('My Profile'));
    await user.keyboard('{Escape}');

    await user.keyboard(' ');
    expect(document.activeElement).toBe(item('My Profile'));
    await user.keyboard('{Escape}');

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('My Profile'));
    await user.keyboard('{Escape}');

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item('Logout'));
  });

  it('leaves other keys on the closed button alone', async () => {
    const { user } = renderMenu();
    trigger().focus();

    await user.keyboard('a{ArrowLeft}');

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves with ArrowDown / ArrowUp (wrapping) and Home / End, and ignores other keys', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('Logout'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('My Profile'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(item('Logout'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(item('My Profile'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(item('Logout'));
    await user.keyboard('{ArrowRight}x');
    expect(document.activeElement).toBe(item('Logout'));
    expect(menu()).toBeInTheDocument();
  });

  it('closes on Esc and returns focus to the button', async () => {
    const { user } = renderMenu();
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Tab, and focus moves on past the button', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    await user.tab();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));
  });

  it('toggles closed on a second click of the button', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    await user.click(trigger());

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a press outside, but not on one inside the menu', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    fireEvent.pointerDown(menu());
    expect(menu()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));
  });

  it('follows "My Profile" in the app, closes, and returns focus to the button', async () => {
    const { user } = renderMenu();
    await user.click(trigger());

    await user.click(item('My Profile'));

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/admin/profile');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('calls onLogout from "Logout" (Enter on the item), closes, and returns focus to the button', async () => {
    const { user, onLogout } = renderMenu();
    await user.click(trigger());
    await user.keyboard('{End}{Enter}');

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes from "Logout" without an onLogout', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserMenu user={CARMEN} role={MANAGER} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Carmen Reyes/ }));

    await user.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no axe violations open or closed', async () => {
    const { container, user } = renderMenu();
    await expectNoAxeViolations(container);

    await user.click(trigger());
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onLogout = vi.fn();
    const { container, rerender } = render(<UserMenu user={CARMEN} role={MANAGER} onLogout={onLogout} />);
    const before = container.innerHTML;

    rerender(<UserMenu user={CARMEN} role={MANAGER} onLogout={onLogout} />);
    expect(container.innerHTML).toBe(before);

    rerender(<UserMenu user={{ name: 'Lea Santos' }} role={ADMIN} onLogout={onLogout} />);
    expect(screen.getByRole('button', { name: /Lea Santos/ }).textContent).toBe('LSLea SantosAdmin');
  });
});

describe('Topbar user menu (spec §6.6)', () => {
  it('opens the user menu from the Topbar user button and hands Logout to onLogout', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Topbar user={CARMEN} role={MANAGER} onLogout={onLogout} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Carmen Reyes/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('navigation-gaps scenarios (implementation only; SPEC-GAP)', () => {
  const gaps = scenarios.filter((scenario) => scenario.group === 'navigation-gaps');
  const byId = new Map(gaps.map((scenario) => [scenario.id, scenario]));

  it('declares the open user menu, the open drawer and the 40-character name, none compared (no reference)', () => {
    expect(gaps.map((scenario) => scenario.id)).toEqual(['user-menu-open', 'drawer-open', 'user-chip-long-name']);
    for (const scenario of gaps) {
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.states, scenario.id).toEqual(['rest']);
    }
    expect(byId.get('user-menu-open')?.themes).toEqual(['light', 'dark']);
    expect(byId.get('drawer-open')?.themes).toEqual(['light', 'dark']);
    expect(byId.get('drawer-open')?.frame).toBe('viewport');
    expect(byId.get('user-chip-long-name')?.responsive).toBe(true);
    const name = byId.get('user-chip-long-name')?.node.props?.name;
    expect(typeof name === 'string' ? name.length : 0).toBe(40);
  });

  it('renders the open user menu through the kit with its two items and no axe violations', async () => {
    const scenario = byId.get('user-menu-open');
    if (scenario === undefined) {
      throw new Error('No user-menu-open scenario.');
    }
    const { container } = render(
      <MemoryRouter>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>,
    );

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });

  it('renders the open drawer through the kit as the Navigation dialog with no axe violations', async () => {
    const scenario = byId.get('drawer-open');
    if (scenario === undefined) {
      throw new Error('No drawer-open scenario.');
    }
    const { container } = render(
      <MemoryRouter>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>,
    );

    expect(await screen.findByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders the 40-character name in the sidebar chip and the Topbar user button, with no axe violations', async () => {
    const scenario = byId.get('user-chip-long-name');
    const name = scenario?.node.props?.name;
    if (scenario === undefined || typeof name !== 'string') {
      throw new Error('No user-chip-long-name scenario.');
    }
    const { container } = render(
      <MemoryRouter>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>,
    );

    expect(within(container).getAllByText(name)).toHaveLength(2);
    expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-haspopup', 'menu');
    await expectNoAxeViolations(container);
  });
});
