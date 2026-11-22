import { describe, expect, it } from 'vitest';
import { withoutTrailingSlash } from './urlPath';

describe('withoutTrailingSlash', () => {
  it.each([
    ['/privacy/', '/privacy'],
    ['/privacy//', '/privacy'],
    ['/privacy', '/privacy'],
    ['/', '/'],
    ['', ''],
  ])('turns %j into %j', (path, expected) => {
    expect(withoutTrailingSlash(path)).toBe(expected);
  });
});
