// The admin theme choice (D-13, C-11; UI-SPEC Layout Contract "Admin layout" → Theme). A manual Blush/Espresso toggle
// kept in localStorage. With nothing saved, or anything but the two names saved, the admin starts in Blush; it never
// follows the operating system's colour scheme. The layout reads it in a lazy useState initializer (no inline bootstrap
// script, which `script-src 'self'` blocks). Every storage access is guarded (T-02-70): a blocked or full storage
// leaves the in-memory theme working.

export type Theme = 'light' | 'dark';

/** The one storage key. Only 'light' or 'dark' is ever written there; nothing else is stored. */
export const THEME_KEY = 'csps-theme';

/** The part of the Web Storage API the theme uses. */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage; reaching it can itself throw (storage disabled), so it is read inside the guards. */
function browserStorage(): ThemeStorage {
  return window.localStorage;
}

/** The saved theme: 'dark' only when exactly 'dark' is saved, else Blush ('light'), also when the storage throws. */
export function readTheme(storage: () => ThemeStorage = browserStorage): Theme {
  try {
    return storage().getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Saves the theme; false when the storage refused it (the caller keeps the in-memory theme). */
export function writeTheme(theme: Theme, storage: () => ThemeStorage = browserStorage): boolean {
  try {
    storage().setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
