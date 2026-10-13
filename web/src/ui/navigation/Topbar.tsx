// Topbar (App. D.3 "Navigation", CSPS-UI-SPEC.md §6.6, §8.1), converted to utilities (D-33) with App. D.3's props API,
// markup and copy: the phone "Open navigation" button, the search box with its "/" hint, then the theme toggle (when
// the shell can toggle) and the user-menu button. Behaviour as App. D.3 (UI-SPEC Interaction Contract):
//   - "/" pressed anywhere outside a field focuses the search box; Enter hands its text to onSearch (the Phase 2 shell
//     passes none, so Enter does nothing there);
//     SPEC-DEVIATION: UI-WR-07 (WCAG 2.1.4) the shortcut is narrowed without any visible change: it ignores "/" with
//     Ctrl, Cmd or Alt, during an IME composition, after another handler took the key, inside any text entry (fields,
//     editable content and the textbox, searchbox, combobox and spinbutton roles), and while a modal dialog is open
//     (it would move focus out of the dialog). A way to turn it off or to need a modifier is an owner question
//     (deferred-items.md), because either changes what the user sees;
//   - the theme toggle is named for what it will do, "Switch to dark mode" with the moon in light, "Switch to light
//     mode" with the sun in dark;
//   - the user-menu button announces its menu (`aria-haspopup="menu"`) and opens it: the button and its popover are the
//     UserMenu (SPEC-GAP, plan 02-32), which renders App. D.3's button markup unchanged and adds `aria-expanded`.
// D-01 (C-34): the search text is 16px on phones (14px elsewhere), so iOS Safari does not zoom on focus.
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import type { Role } from '@/lib/csps';
import { Icon } from '@/ui/brand';
import { iconButtonClasses } from '@/ui/feedback';
import {
  searchClasses,
  searchInputClasses,
  searchInputCompatClasses,
  searchKbdClasses,
  topbarClasses,
  topbarMenuClasses,
  topbarRightClasses,
} from './navigation.recipe';
import { UserMenu } from './UserMenu';

/** Elements whose own typing keeps a "/" (App. D.3's test). */
const FIELD_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

/** ARIA text-entry widgets, which keep their "/" too (UI-WR-07). */
const TEXT_ENTRY = '[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]';

/** True when a "/" keydown is the search shortcut (App. D.3, narrowed by UI-WR-07). */
function isSearchShortcut(event: KeyboardEvent): boolean {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
    return false;
  }
  if (event.defaultPrevented || document.querySelector('[aria-modal="true"]') !== null) {
    return false;
  }
  // SPEC-DEVIATION: strict types: App. D.3 casts the event target; a target that is not an element (the window
  // itself) counts as "outside a field" here, as it does there.
  const target = event.target instanceof HTMLElement ? event.target : null;
  const inField =
    target !== null &&
    (target.isContentEditable || FIELD_TAGS.test(target.tagName) || target.closest(TEXT_ENTRY) !== null);
  return !inField;
}

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
  // SPEC-DEVIATION: UI-SPEC UserMenu (plan 02-32) the user menu's "Logout" item; App. D.3 draws no menu to call it.
  /** "Logout" in the user menu. */
  onLogout?: (() => void) | undefined;
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
  onLogout,
}: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isSearchShortcut(event)) {
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
        <UserMenu user={user} role={role} onLogout={onLogout} />
      </div>
    </div>
  );
}
