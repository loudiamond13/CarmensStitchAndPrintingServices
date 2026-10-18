import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeFragment, tokenFromHash } from '@/utils/urlFragment';

// The fragment helpers of the emailed-link screens (reset, invite and email change; IN-18, CWE-598).

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('tokenFromHash', () => {
  it.each([
    ['#token=abc', 'abc'],
    ['token=abc', 'abc'],
    ['#token=a%2Bb', 'a+b'],
    ['#other=1&token=abc', 'abc'],
    ['', null],
    ['#', null],
    ['#token=', null],
    ['#nottoken=abc', null],
  ])('reads %j as %j', (hash, expected) => {
    expect(tokenFromHash(hash)).toBe(expected);
  });
});

describe('removeFragment', () => {
  it('clears the hash and keeps the path and the query', () => {
    window.history.replaceState(null, '', '/admin/confirm-email?from=mail#token=abc');

    removeFragment();

    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/admin/confirm-email');
    expect(window.location.search).toBe('?from=mail');
  });

  it("uses history.replaceState and keeps the router's history state, so no entry is added", () => {
    const state = { idx: 3 };
    window.history.replaceState(state, '', '/admin/reset-password#token=abc');
    const replace = vi.spyOn(window.history, 'replaceState');
    const lengthBefore = window.history.length;

    removeFragment();

    expect(replace).toHaveBeenCalledWith(state, '', '/admin/reset-password');
    expect(window.history.length).toBe(lengthBefore);
  });
});
