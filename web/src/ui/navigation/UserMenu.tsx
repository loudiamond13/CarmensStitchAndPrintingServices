// SPEC-GAP: user menu
// The Topbar's user menu (CSPS-UI-SPEC.md §6.6, where the menu is "not drawn"; UI-SPEC "SPEC-GAP Primitive Specs" →
// UserMenu; plan 02-32; A11Y-02). The trigger is App. D.3's user-menu button, unchanged in markup and look (the avatar,
// the name over the role, the chevron); the popover under it is composed from existing tokens (navigation.recipe.ts)
// and its items use the nav-item recipe with 20px icons: "My Profile" (`user-round`, a link to the profile page) and
// "Logout" (`log-out`, a button that calls onLogout; the Phase 2 shell shows the dev toast).
// Keyboard (WAI-ARIA APG menu button pattern):
//   - the button (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open): Enter, Space or a click open
//     the menu on its first item, ArrowDown on the first, ArrowUp on the last; a second click closes it;
//   - in the menu (role menu, labelled by the button; items `role="menuitem"` with a roving tabIndex -1): ArrowDown
//     and ArrowUp move with wrap-around, Home and End jump (rovingItem 'menu'); Esc closes it and focuses the button;
//     Tab closes it and moves on from the button (focus goes to the button first, then the browser's Tab moves on);
//   - choosing an item closes the menu and focuses the button; a press outside closes it and leaves focus alone.
// The trigger and the popover are siblings with no wrapper (the Topbar's markup stays App. D.3's); the document
// listener goes through an effect (Pitfall 7).
import clsx from 'clsx';
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Role } from '@/lib/csps';
import { UiLink } from '@/ui/actions';
import { Icon } from '@/ui/brand';
import { rovingItem } from '@/ui/choice/roving';
import { Avatar } from '@/ui/status';
import {
  userMenuClasses,
  userMenuNameClasses,
  userMenuPopoverClasses,
  userMenuRoleClasses,
  userMenuTextClasses,
} from './navigation.recipe';
import { navButtonClasses, navItemClasses } from './navItem.recipe';

/** "My Profile" goes where the Sidebar's My Profile item goes (App. D.3 ADMIN_NAV; the tests pin the two equal). */
export const PROFILE_PATH = '/admin/profile';

export interface UserMenuProps {
  user: { name: string };
  /** The signed-in user's role, shown under the name. */
  role: Role;
  /** "Logout" (the Phase 2 shell shows the dev toast; Phase 4 signs out). */
  onLogout?: (() => void) | undefined;
}

/** Which item takes focus when the menu opens. */
type OpenAt = 'first' | 'last';

export function UserMenu({ user, role, onLogout }: UserMenuProps) {
  const [openAt, setOpenAt] = useState<OpenAt | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const buttonId = useId();
  const menuId = useId();
  const open = openAt !== null;

  const close = (focusButton: boolean) => {
    setOpenAt(null);
    if (focusButton) {
      buttonRef.current?.focus();
    }
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpenAt(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={userMenuClasses}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpenAt(open ? null : 'first');
        }}
        onKeyDown={onButtonKeyDown}
      >
        <Avatar name={user.name} size={32} />
        <span className={userMenuTextClasses}>
          <strong className={userMenuNameClasses}>{user.name}</strong>
          <span className={userMenuRoleClasses}>{role === 'manager' ? 'Manager' : 'Admin'}</span>
        </span>
        <Icon name="chevron-down" size={16} />
      </button>
      {openAt !== null && (
        <MenuPopover
          id={menuId}
          labelledBy={buttonId}
          openAt={openAt}
          buttonRef={buttonRef}
          onClose={close}
          onLogout={onLogout}
        />
      )}
    </>
  );
}

interface MenuPopoverProps {
  id: string;
  labelledBy: string;
  openAt: OpenAt;
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** Closes the menu; `true` puts focus back on the button. */
  onClose: (focusButton: boolean) => void;
  onLogout?: (() => void) | undefined;
}

/** The menu's items, in order. */
function menuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

function MenuPopover({ id, labelledBy, openAt, buttonRef, onClose, onLogout }: MenuPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(onClose);

  // Focus the first or the last item on open; close on a press outside the menu and its button.
  useEffect(() => {
    const menu = menuRef.current;
    if (menu === null) {
      return undefined;
    }
    const items = menuItems(menu);
    (openAt === 'first' ? items[0] : items.at(-1))?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && !menu.contains(target) && buttonRef.current?.contains(target) !== true) {
        requestClose(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openAt, buttonRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === 'Tab') {
      // No preventDefault: focus goes to the button, and the browser's Tab then moves on from there.
      onClose(true);
      return;
    }
    const items = menuItems(event.currentTarget);
    const index = items.findIndex((element) => element === document.activeElement);
    const next = rovingItem(items, index, event.key, 'menu');
    if (next !== undefined) {
      event.preventDefault();
      next.item.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={userMenuPopoverClasses}
      onKeyDown={onKeyDown}
    >
      <UiLink
        to={PROFILE_PATH}
        role="menuitem"
        tabIndex={-1}
        className={navItemClasses()}
        onClick={() => {
          onClose(true);
        }}
      >
        <Icon name="user-round" size={20} />
        <span>My Profile</span>
      </UiLink>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={clsx(navItemClasses(), navButtonClasses)}
        onClick={() => {
          onLogout?.();
          onClose(true);
        }}
      >
        <Icon name="log-out" size={20} />
        <span>Logout</span>
      </button>
    </div>
  );
}
