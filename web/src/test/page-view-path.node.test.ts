// @vitest-environment node
// ANL-05, OR-3. The web page view check accepts and refuses exactly the paths in tests/fixtures/page-view-path-cases.json, the file the
// server PageViewRequestValidator is tested against too, so the browser never sends a path the server would refuse.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_VIEW_PATH_MAX_LENGTH, isPageViewPath } from '../utils/pageViewPath';

const cases = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/page-view-path-cases.json'), 'utf8'),
) as { maxLength: number; accept: string[]; refuse: string[] };

// A slash and then letters, `length` characters in all: the server test builds the same two boundary paths.
const longPath = (length: number) => `/${'a'.repeat(length - 1)}`;

describe('the web page view check and the shared cases (OR-3)', () => {
  it('uses the server length limit', () => {
    expect(PAGE_VIEW_PATH_MAX_LENGTH).toBe(cases.maxLength);
  });

  it.each(cases.accept)('accepts %j', (path) => {
    expect(isPageViewPath(path)).toBe(true);
  });

  it.each(cases.refuse)('refuses %j', (path) => {
    expect(isPageViewPath(path)).toBe(false);
  });

  it('accepts a path of exactly the limit and refuses one character more', () => {
    expect(isPageViewPath(longPath(cases.maxLength))).toBe(true);
    expect(isPageViewPath(longPath(cases.maxLength + 1))).toBe(false);
  });
});
