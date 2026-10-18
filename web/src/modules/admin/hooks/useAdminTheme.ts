// RED stub: the real hooks land in the GREEN commit.
import type { Theme } from '@/modules/admin/theme';

export interface AdminThemeContext {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
}

export function useThemeState(): AdminThemeContext {
  return { theme: 'light', setTheme: () => undefined };
}

export function useAdminTheme(): AdminThemeContext {
  return { theme: 'light', setTheme: () => undefined };
}
