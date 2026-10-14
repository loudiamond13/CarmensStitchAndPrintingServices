import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTheme, THEME_KEY, writeTheme, type Theme } from './theme';

/** An in-memory storage for one test. */
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
    values,
  };
}

/** A storage whose every access throws, as a browser does with storage blocked (Safari private mode, policies). */
const blockedStorage = {
  getItem: (): string | null => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  },
  setItem: (): void => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  },
};

afterEach(() => {
  window.localStorage.clear();
});

describe('admin theme persistence (D-13)', () => {
  it('keeps the choice under the "csps-theme" key', () => {
    expect(THEME_KEY).toBe('csps-theme');
  });

  it('starts in Blush (light) when nothing is saved', () => {
    expect(readTheme(() => memoryStorage())).toBe('light');
  });

  it.each(['dark', 'light'] as const)('reads a saved "%s"', (saved) => {
    expect(readTheme(() => memoryStorage({ [THEME_KEY]: saved }))).toBe(saved);
  });

  it.each(['blue', 'DARK', ' dark', '', 'null', '{"theme":"dark"}'])(
    'treats the invalid saved value %j as Blush (light)',
    (saved) => {
      expect(readTheme(() => memoryStorage({ [THEME_KEY]: saved }))).toBe('light');
    },
  );

  it.each(['light', 'dark'] as const)('writes "%s" under the key and reports success', (theme: Theme) => {
    const storage = memoryStorage();
    expect(writeTheme(theme, () => storage)).toBe(true);
    expect(storage.values.get(THEME_KEY)).toBe(theme);
  });

  it('survives a reload through the real localStorage: a written "dark" is read back', () => {
    expect(readTheme()).toBe('light');
    expect(writeTheme('dark')).toBe(true);
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
    expect(readTheme()).toBe('dark');
  });

  it('falls back to Blush, without throwing, when reading the storage throws', () => {
    expect(readTheme(() => blockedStorage)).toBe('light');
  });

  it('falls back to Blush when even reaching the storage throws (storage disabled)', () => {
    expect(
      readTheme(() => {
        throw new DOMException('Access is denied for this document.', 'SecurityError');
      }),
    ).toBe('light');
  });

  it('reports failure, without throwing, when writing the storage throws (the caller keeps the in-memory theme)', () => {
    expect(writeTheme('dark', () => blockedStorage)).toBe(false);
  });

  it('never asks the operating system colour scheme (no prefers-color-scheme)', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia');
    readTheme(() => memoryStorage());
    readTheme();
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
