import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { MobileNavDrawer, Sidebar } from '@/ui/navigation';
import { bodyScrollLockClass } from '@/ui/overlays/overlays.recipe';
import { drawerClasses, drawerPanelClasses } from './navigation.recipe';

// The phone navigation drawer (SPEC-GAP, spec §2.10 #6, UI-SPEC "SPEC-GAP Primitive Specs" → MobileNavDrawer; plan
// 02-32): the full Sidebar as a 248px left panel over the scrim, a modal dialog named "Navigation" with focus trapped,
// closing on a scrim click, Esc or a navigation, with focus back on the menu button and body scroll locked while open.

// L-20: the user role goes through a typed variable, never a literal role prop (jsx-a11y reads it as an ARIA role).
const MANAGER: Role = 'manager';
const CARMEN = { name: 'Carmen Reyes' };
const DRAWER_ID = 'admin-nav-drawer';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

interface HarnessProps {
  readonly initialOpen?: boolean;
  readonly onClose?: () => void;
}

/** The menu button and the drawer as the admin shell wires them, in a router with the admin paths. */
function Harness({ initialOpen = false, onClose }: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={() => {
          setOpen(true);
        }}
      >
        Menu
      </button>
      <MobileNavDrawer
        id={DRAWER_ID}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <Sidebar active="dashboard" role={MANAGER} user={CARMEN} />
      </MobileNavDrawer>
    </>
  );
}

function renderHarness(props: HarnessProps = {}) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin/*" element={<Harness {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function menuButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Open navigation' });
}

function drawer(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Navigation' });
}

async function openDrawer() {
  const user = userEvent.setup();
  renderHarness();
  await user.click(menuButton());
  return user;
}

describe('MobileNavDrawer (SPEC-GAP: mobile nav drawer)', () => {
  it('renders nothing while closed', () => {
    renderHarness();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.getElementById(DRAWER_ID)).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens as a modal dialog named "Navigation" holding the full Sidebar, with the id the menu button controls', async () => {
    await openDrawer();

    const panel = drawer();
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel.id).toBe(DRAWER_ID);
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(panel).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(within(panel).getByText('Carmen Reyes')).toBeInTheDocument();
  });

  it('is the 248px left panel over the scrim at the overlay layer, rendered in place (never a portal)', () => {
    const { container } = renderHarness({ initialOpen: true });
    const root = drawer().parentElement;

    expect(root?.parentElement).toBe(container);
    expect(hasClasses(root, drawerClasses)).toBe(true);
    expect(hasClasses(drawer(), drawerPanelClasses)).toBe(true);
    for (const token of ['fixed', 'inset-0', 'z-(--z-overlay)', 'bg-scrim']) {
      expect(root?.classList.contains(token)).toBe(true);
    }
    expect(drawer().classList.contains('w-(--sidebar-width)')).toBe(true);
  });

  it('moves focus into the drawer on open', async () => {
    await openDrawer();

    expect(drawer()).toContainElement(document.activeElement as HTMLElement);
  });

  it('traps Tab and Shift+Tab inside the drawer', async () => {
    const user = await openDrawer();
    const logout = within(drawer()).getByRole('button', { name: 'Logout' });
    const first = within(drawer()).getByRole('button', { name: 'Collapse sidebar' });

    logout.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(logout);
  });

  it('closes on Esc and returns focus to the menu button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderHarness({ onClose });
    await user.click(menuButton());

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(menuButton());
  });

  it('ignores other keys', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderHarness({ onClose });
    await user.click(menuButton());

    await user.keyboard('{Enter}a');

    expect(onClose).not.toHaveBeenCalled();
    expect(drawer()).toBeInTheDocument();
  });

  it('closes on a click on the scrim, but not on a click inside the panel', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderHarness({ onClose });
    await user.click(menuButton());

    fireEvent.click(within(drawer()).getByText('Carmen Reyes'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(drawer().parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it('closes when a navigation link is followed, and returns focus to the menu button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderHarness({ onClose });
    await user.click(menuButton());

    await user.click(within(drawer()).getByRole('link', { name: 'Orders' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it('stays open when a control that is not a link is pressed (the collapse toggle, Logout)', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderHarness({ onClose });
    await user.click(menuButton());

    await user.click(within(drawer()).getByRole('button', { name: 'Logout' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(drawer()).toBeInTheDocument();
  });

  it('locks body scroll with the class while open, and releases it on close', async () => {
    const user = await openDrawer();
    expect(document.body.classList.contains(bodyScrollLockClass)).toBe(true);
    expect(document.body.getAttribute('style')).toBeNull();

    await user.keyboard('{Escape}');
    expect(document.body.classList.contains(bodyScrollLockClass)).toBe(false);
  });

  it('has no axe violations while open', async () => {
    const { container } = renderHarness({ initialOpen: true });

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onClose = vi.fn();
    const children = <Sidebar active="dashboard" role={MANAGER} />;
    const view = render(
      <MemoryRouter>
        <MobileNavDrawer id="a" open onClose={onClose}>
          {children}
        </MobileNavDrawer>
      </MemoryRouter>,
    );
    const before = view.container.innerHTML;

    view.rerender(
      <MemoryRouter>
        <MobileNavDrawer id="a" open onClose={onClose}>
          {children}
        </MobileNavDrawer>
      </MemoryRouter>,
    );
    expect(view.container.innerHTML).toBe(before);

    view.rerender(
      <MemoryRouter>
        <MobileNavDrawer id="b" open onClose={onClose}>
          <Sidebar active="orders" role={MANAGER} />
        </MobileNavDrawer>
      </MemoryRouter>,
    );
    expect(drawer().id).toBe('b');
    expect(within(drawer()).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');

    view.rerender(
      <MemoryRouter>
        <MobileNavDrawer id="b" open={false} onClose={onClose}>
          <Sidebar active="orders" role={MANAGER} />
        </MobileNavDrawer>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
