// @vitest-environment node
// The client router's public page paths equal tests/fixtures/public-paths.json, the list the server's route table is
// tested against too (plan 11-02), so the two sides cannot drift apart (PUB-01). A node test cannot import router.tsx (the
// node project has no JSX), so it reads the `publicRoutes` block of the source: the index route is "/", each `path` below
// it is a page, and the `*` splat is the catch-all, not a page.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const shared = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/public-paths.json'), 'utf8'),
) as { pages: string[] };

const source = readFileSync(resolve(import.meta.dirname, '../core/routes/router.tsx'), 'utf8');
const block = /export const publicRoutes[^=]*=\s*\[([\s\S]*?)\n\];/.exec(source)?.[1] ?? '';
const declared = [...block.matchAll(/\bpath: '([^']+)'/g)].map((match) => match[1] ?? '');

describe('the client router and the shared public path list (PUB-01)', () => {
  it('finds the publicRoutes block in router.tsx', () => {
    expect(block).toContain('lazy: publicLayout');
    expect(block).toContain('NotFoundPage');
  });

  it('has the same page paths as tests/fixtures/public-paths.json', () => {
    const pages = [
      ...(/\bindex: true\b/.test(block) ? ['/'] : []),
      ...declared.filter((path) => path !== '*').map((path) => `/${path}`),
    ];
    expect(pages.toSorted()).toEqual([...shared.pages].toSorted());
  });

  it('ends with a catch-all page for every other public path', () => {
    expect(declared.at(-1)).toBe('*');
  });

  it('puts the Gallery route under the lazy UrlStateLayout and no other route (WEB-10)', () => {
    expect(block.match(/urlStateLayout/g)).toHaveLength(1);
    expect(block.indexOf('urlStateLayout')).toBeLessThan(block.indexOf("path: 'gallery'"));
    expect(block.indexOf("path: 'gallery'")).toBeLessThan(block.indexOf("path: 'contact'"));
  });

  it('keeps the shared list to the four pages and the three legal pages (LEGAL-05, D-72)', () => {
    expect(shared.pages).toEqual([
      '/',
      '/products',
      '/gallery',
      '/contact',
      '/privacy',
      '/terms',
      '/accessibility',
    ]);
  });
});
