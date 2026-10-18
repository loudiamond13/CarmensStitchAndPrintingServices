import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/utils/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { MobileNavDrawer, Sidebar } from '@/components/navigation';
import { Modal } from '@/components/overlays';
import { bodyScrollLockClass } from '@/components/overlays/overlays.recipe';
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

/** The router's current path, so a test can tell an in-app navigation happened. */
function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

function renderHarness(props: HarnessProps = {}) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin/*" element={<Harness {...props} />} />
      </Routes>
      <CurrentPath />
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

  it('returns focus to the menu button even when opening it did not focus it (Safari on a click)', async () => {
    const user = userEvent.setup();
    renderHarness({ initialOpen: true });
    expect(drawer()).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(menuButton());
  });

  it('returns focus to whatever had it on open when no element controls the drawer', async () => {
    const user = userEvent.setup();
    function Uncontrolled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Show navigation
          </button>
          <MobileNavDrawer
            id="loose-drawer"
            open={open}
            onClose={() => {
              setOpen(false);
            }}
          >
            <Sidebar active="dashboard" role={MANAGER} />
          </MobileNavDrawer>
        </>
      );
    }
    render(
      <MemoryRouter>
        <Uncontrolled />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Show navigation' }));

    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show navigation' }));
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

    const scrim = drawer().parentElement;
    if (scrim === null) {
      throw new Error('The drawer panel has no layer around it.');
    }
    fireEvent.click(scrim);
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

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/admin/orders');
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

describe('MobileNavDrawer under a dialog (UI-WR-01, UI-WR-02)', () => {
  it('stays open on the Esc that closes a dialog opened over it, and gets focus back when it closes', async () => {
    const user = userEvent.setup();
    const onDrawerClose = vi.fn();
    function DrawerAndDialog() {
      const [dialog, setDialog] = useState(true);
      return (
        <MemoryRouter>
          <MobileNavDrawer id={DRAWER_ID} open onClose={onDrawerClose}>
            <Sidebar active="dashboard" role={MANAGER} user={CARMEN} />
          </MobileNavDrawer>
          {dialog && (
            <Modal
              title="Session ending"
              onClose={() => {
                setDialog(false);
              }}
            >
              <button type="button">Stay signed in</button>
            </Modal>
          )}
        </MemoryRouter>
      );
    }
    render(<DrawerAndDialog />);
    expect(screen.getByRole('dialog', { name: 'Session ending' }).contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Session ending' })).toBeNull();
    expect(onDrawerClose).not.toHaveBeenCalled();
    expect(drawer().contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(onDrawerClose).toHaveBeenCalledTimes(1);
  });
});

// D-34: the drawer slides out and the scrim fades out, so it stays mounted as data-state="closed" until the panel's
// animation ends. jsdom runs no animation, so the computed animation name of a closed element is mocked; focus, scroll
// lock and the trap are released at once and the closing layer takes no input.
describe('MobileNavDrawer closing animation (D-34, D-38)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function animateClosedElements(): void {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
      element.getAttribute('data-state') === 'closed'
        ? ({ animationName: 'csp-drawer-out' } as CSSStyleDeclaration)
        : real(element, pseudo),
    );
  }

  async function openAndEscape(onClose?: () => void) {
    animateClosedElements();
    const user = userEvent.setup();
    renderHarness(onClose === undefined ? {} : { onClose });
    await user.click(menuButton());
    const panel = drawer();
    const layer = panel.parentElement;
    await user.keyboard('{Escape}');
    return { user, panel, layer };
  }

  it('marks the layer and the panel open while open', async () => {
    await openDrawer();

    expect(drawer()).toHaveAttribute('data-state', 'open');
    expect(drawer().parentElement).toHaveAttribute('data-state', 'open');
  });

  it('stays mounted as closed while it animates out, with the layer and the panel marked closed', async () => {
    const { panel, layer } = await openAndEscape();

    expect(panel.isConnected).toBe(true);
    expect(panel.getAttribute('data-state')).toBe('closed');
    expect(layer?.isConnected).toBe(true);
    expect(layer?.getAttribute('data-state')).toBe('closed');
  });

  it('puts focus on the menu button and releases the scroll lock at once', async () => {
    await openAndEscape();

    expect(menuButton()).toHaveFocus();
    expect(document.body.classList.contains(bodyScrollLockClass)).toBe(false);
  });

  it('leaves the DOM when the panel ends its own animation, and not for an animation that bubbles up from a child', async () => {
    const { panel } = await openAndEscape();

    act(() => {
      within(panel)
        .getByRole('link', { name: 'Orders' })
        .dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(panel).toBeInTheDocument();

    act(() => {
      panel.dispatchEvent(new Event('animationend'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores Esc and a scrim click while it closes', async () => {
    const onClose = vi.fn();
    const { layer } = await openAndEscape(onClose);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    if (layer === null) {
      throw new Error('The drawer panel has no layer around it.');
    }
    fireEvent.click(layer);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a followed link while it closes', async () => {
    const onClose = vi.fn();
    const { panel } = await openAndEscape(onClose);

    fireEvent.click(within(panel).getByRole('link', { name: 'Orders' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be focused or pressed while it closes (the layer is inert and takes no pointer input)', async () => {
    const { layer } = await openAndEscape();

    expect(layer).toHaveAttribute('inert');
  });

  it('opens again when reopened during the close', async () => {
    const { user, panel } = await openAndEscape();

    await user.click(menuButton());

    expect(panel).toHaveAttribute('data-state', 'open');
    expect(panel.parentElement).not.toHaveAttribute('inert');
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.body.classList.contains(bodyScrollLockClass)).toBe(true);
  });
});
