// The client router's public page paths equal tests/fixtures/public-paths.json, the list the server's route table is
// tested against too (plan 11-02), so the two sides cannot drift apart (PUB-01).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { publicRoutes } from '@/core/routes/router';

const shared = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/public-paths.json'), 'utf8'),
) as { pages: string[] };

/** The paths of the page routes below the public layout: the index is "/", a pathless layout adds nothing, a splat is no page. */
function pagePaths(children: readonly RouteObject[], parent = ''): string[] {
  return children.flatMap((route) => {
    if (route.path === '*') {
      return [];
    }
    const here = route.path === undefined ? parent : `${parent}/${route.path}`.replace(/\/+/g, '/');
    if (route.children !== undefined) {
      return pagePaths(route.children, here);
    }
    return [route.index === true ? (parent === '' ? '/' : parent) : here];
  });
}

describe('the client router and the shared public path list (PUB-01)', () => {
  it('has the same page paths as tests/fixtures/public-paths.json', () => {
    const layout = publicRoutes[0];
    expect(layout?.children).toBeDefined();
    expect(pagePaths(layout?.children ?? []).toSorted()).toEqual([...shared.pages].toSorted());
  });

  it('ends with a catch-all page for every other public path', () => {
    const children = publicRoutes[0]?.children ?? [];
    expect(children.at(-1)?.path).toBe('*');
  });

  it('keeps the shared list to the four pages', () => {
    expect(shared.pages).toEqual(['/', '/products', '/gallery', '/contact']);
  });
});
