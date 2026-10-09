// Topbar (App. D.3 "Navigation", CSPS-UI-SPEC.md §6.6, §8.1), converted to utilities (D-33) with App. D.3's props API,
// markup and copy: the phone "Open navigation" button, the search box with its "/" hint, then the theme toggle (when
// the shell can toggle) and the user-menu button. Behaviour as App. D.3 (UI-SPEC Interaction Contract):
//   - "/" pressed anywhere outside a field focuses the search box; Enter hands its text to onSearch (the Phase 2 shell
//     passes none, so Enter does nothing there);
//   - the theme toggle is named for what it will do, "Switch to dark mode" with the moon in light, "Switch to light
//     mode" with the sun in dark;
//   - the user-menu button announces its menu (`aria-haspopup="menu"`); the popover itself is plan 02-32's UserMenu.
// D-01 (C-34): the search text is 16px on phones (14px elsewhere), so iOS Safari does not zoom on focus.
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import type { Role } from '@/lib/csps';
import { Icon } from '@/ui/brand';
import { iconButtonClasses } from '@/ui/feedback';
import { Avatar } from '@/ui/status';
import {
  searchClasses,
  searchInputClasses,
  searchInputCompatClasses,
  searchKbdClasses,
  topbarClasses,
  topbarMenuClasses,
  topbarRightClasses,
  userMenuClasses,
  userMenuNameClasses,
  userMenuRoleClasses,
  userMenuTextClasses,
} from './navigation.recipe';

/** Elements whose own typing keeps a "/" (App. D.3's test). */
const FIELD_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

export interface TopbarProps {
  user?: { name: string } | undefined;
  /** The signed-in user's role, shown under the name. */
  role?: Role | undefined;
  placeholder?: string | undefined;
  /** The phone "Open navigation" button (it opens the mobile navigation drawer, plan 02-31). */
  onMenu?: (() => void) | undefined;
  /** `aria-expanded` of the "Open navigation" button, when it controls a drawer (UI-SPEC MobileNavDrawer). */
  menuExpanded?: boolean | undefined;
  /** `aria-controls` of the "Open navigation" button: the drawer's id. */
  menuControls?: string | undefined;
  /** The theme in use; the toggle offers the other one. */
  theme?: 'light' | 'dark' | undefined;
  /** Shows the theme toggle. */
  onToggleTheme?: (() => void) | undefined;
  /** Called with the search text on Enter. */
  onSearch?: ((query: string) => void) | undefined;
}

export function Topbar({
  user = { name: 'Carmen Reyes' },
  role = 'manager',
  placeholder = 'Search orders, customers, teams…',
  onMenu,
  menuExpanded,
  menuControls,
  theme,
  onToggleTheme,
  onSearch,
}: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // SPEC-DEVIATION: strict types: App. D.3 casts the event target; a target that is not an element (the window
      // itself) counts as "outside a field" here, as it does there.
      const target = event.target instanceof HTMLElement ? event.target : null;
      const inField = target !== null && (target.isContentEditable || FIELD_TAGS.test(target.tagName));
      if (event.key === '/' && !inField) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
  return (
    <div className={topbarClasses}>
      {/* SPEC-DEVIATION: UI-SPEC MobileNavDrawer the menu button carries the aria-expanded / aria-controls the drawer
          passes (none when it passes none, as App. D.3). */}
      <button
        type="button"
        className={topbarMenuClasses}
        aria-label="Open navigation"
        aria-expanded={menuExpanded}
        aria-controls={menuControls}
        onClick={onMenu}
      >
        <Icon name="menu" size={20} />
      </button>
      <label className={searchClasses}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          className={clsx(searchInputClasses, searchInputCompatClasses)}
          placeholder={placeholder}
          aria-label="Search"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearch?.(event.currentTarget.value);
            }
          }}
        />
        <kbd className={searchKbdClasses}>/</kbd>
      </label>
      <div className={topbarRightClasses}>
        {onToggleTheme !== undefined && (
          <button
            type="button"
            className={iconButtonClasses}
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
        )}
        <button type="button" className={userMenuClasses} aria-haspopup="menu">
          <Avatar name={user.name} size={32} />
          <span className={userMenuTextClasses}>
            <strong className={userMenuNameClasses}>{user.name}</strong>
            <span className={userMenuRoleClasses}>{role === 'manager' ? 'Manager' : 'Admin'}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      </div>
    </div>
  );
}
