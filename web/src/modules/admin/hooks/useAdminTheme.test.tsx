import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectConsole } from '@/test/consoleGuard';
import { useAdminTheme, useThemeState, type AdminThemeContext } from './useAdminTheme';

// The admin theme (PROF-04, D-22): one state in the layout, read by the top bar toggle and by any page below it.

beforeEach(() => {
  window.localStorage.clear();
});

describe('useThemeState (the layout side)', () => {
  it('starts in Blush with nothing saved', () => {
    const { result } = renderHook(() => useThemeState());

    expect(result.current.theme).toBe('light');
  });

  it('starts in Espresso when "dark" is saved', () => {
    window.localStorage.setItem('csps-theme', 'dark');

    const { result } = renderHook(() => useThemeState());

    expect(result.current.theme).toBe('dark');
  });

  it.each(['purple', 'Dark', ' dark', ''])('reads the saved value %j as Blush', (saved) => {
    window.localStorage.setItem('csps-theme', saved);

    const { result } = renderHook(() => useThemeState());

    expect(result.current.theme).toBe('light');
  });

  it('applies a new theme at once and saves exactly that value', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(window.localStorage.getItem('csps-theme')).toBe('dark');
  });

  it('writes nothing when the theme that is already active is set again', () => {
    const { result } = renderHook(() => useThemeState());
    const write = vi.spyOn(Storage.prototype, 'setItem');

    act(() => {
      result.current.setTheme('light');
    });

    expect(write).not.toHaveBeenCalled();
    expect(result.current.theme).toBe('light');
  });

  it('keeps the theme in memory when the storage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useThemeState());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
  });
});

describe('useAdminTheme (the page side)', () => {
  function withContext(context: unknown) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter>
          <Routes>
            <Route element={<Outlet context={context} />}>
              <Route path="*" element={children} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    };
  }

  it('returns the theme and the setter the layout put in its Outlet context', () => {
    const context: AdminThemeContext = { theme: 'dark', setTheme: vi.fn() };

    const { result } = renderHook(() => useAdminTheme(), { wrapper: withContext(context) });

    expect(result.current).toBe(context);
  });

  it.each([
    ['no context', undefined],
    ['a context without the setter', { theme: 'dark' }],
    ['a theme that is neither light nor dark', { theme: 'purple', setTheme: () => undefined }],
    ['a setter that is not a function', { theme: 'light', setTheme: 'x' }],
    ['a null context', null],
  ])('says it needs the admin layout when it gets %s', (_name, context) => {
    expect(() => renderHook(() => useAdminTheme(), { wrapper: withContext(context) })).toThrow(
      'useAdminTheme needs the admin layout.',
    );
    // React reports the render error it rethrows.
    collectConsole();
  });
});
