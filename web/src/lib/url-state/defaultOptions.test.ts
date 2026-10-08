import { describe, expect, it } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from './defaultOptions';

describe('URL_STATE_DEFAULTS', () => {
  it('keeps shallow updates, drops defaults from the URL and never scrolls', () => {
    expect(URL_STATE_DEFAULTS).toEqual({ shallow: true, clearOnDefault: true, scroll: false });
  });
});

describe('orderSearchParams', () => {
  it('writes page, size and q first, then the other keys by name', () => {
    const ordered = orderSearchParams(
      new URLSearchParams('status=done&q=a&kind=jersey&size=50&page=2&from=2026-10-01'),
    );
    expect(ordered.toString()).toBe('page=2&size=50&q=a&from=2026-10-01&kind=jersey&status=done');
  });

  it('keeps repeated keys in their original relative order', () => {
    const ordered = orderSearchParams(new URLSearchParams('tag=b&page=2&tag=a'));
    expect(ordered.toString()).toBe('page=2&tag=b&tag=a');
  });

  it('gives the same query string for the same values in any order', () => {
    const first = orderSearchParams(new URLSearchParams('b=2&a=1&page=3'));
    const second = orderSearchParams(new URLSearchParams('page=3&a=1&b=2'));
    expect(first.toString()).toBe(second.toString());
  });

  it('returns an empty query for an empty one', () => {
    expect(orderSearchParams(new URLSearchParams()).toString()).toBe('');
  });
});
