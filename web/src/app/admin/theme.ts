// RED stub (plan 02-31 Task 2).
export type Theme = 'light' | 'dark';

export const THEME_KEY = '';

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readTheme(storage?: () => ThemeStorage): Theme {
  return storage === undefined ? 'light' : 'light';
}

export function writeTheme(theme: Theme, storage?: () => ThemeStorage): boolean {
  return storage === undefined && theme === 'dark';
}
