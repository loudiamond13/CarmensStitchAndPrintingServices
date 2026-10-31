// The admin theme as one state (PROF-04, D-22, D-13): the admin layout owns it (useThemeState) and hands it to the pages
// below through its Outlet context, so the top bar toggle and the Appearance tab of My Profile always agree. A page reads
// it with useAdminTheme. The choice lives in this browser's localStorage only (theme.ts); it is never sent to the server,
// and the public site never reads it.
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { readTheme, writeTheme, type Theme } from '@/modules/admin/theme';

/** What the admin layout shares with its pages. */
export interface AdminThemeContext {
  readonly theme: Theme;
  /** Applies a theme at once and saves it; the theme that is already active changes and writes nothing. */
  readonly setTheme: (theme: Theme) => void;
}

/**
 * The layout's side: the theme read once from the storage (Blush when nothing valid is saved, also when the storage
 * throws) and the setter. A storage that refuses the write leaves the in-memory theme working (theme.ts).
 */
export function useThemeState(): AdminThemeContext {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const setTheme = (next: Theme): void => {
    if (next === theme) {
      return;
    }
    setThemeState(next);
    writeTheme(next);
  };
  return { theme, setTheme };
}

function isThemeContext(value: unknown): value is AdminThemeContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'theme' in value &&
    (value.theme === 'light' || value.theme === 'dark') &&
    'setTheme' in value &&
    typeof value.setTheme === 'function'
  );
}

/** A page's side: the theme and the setter from the admin layout's Outlet context. */
export function useAdminTheme(): AdminThemeContext {
  const context: unknown = useOutletContext();
  if (!isThemeContext(context)) {
    throw new Error('useAdminTheme needs the admin layout.');
  }
  return context;
}
