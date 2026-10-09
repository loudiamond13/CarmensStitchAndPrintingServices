// @vitest-environment node
// PERF-01: the bundle budgets, evaluated over synthetic chunk graphs (research Pattern 12). Sizes are gzip level 9 bytes
// and 1 KB = 1000 B, so 150.0 KB is 150_000 B; a value exactly at its limit passes.
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROUTE,
  BUDGETS,
  evaluateBudgets,
  PUBLIC_ROUTE,
  routeInitialSize,
  type BudgetAsset,
  type BudgetChunk,
  type BudgetGraph,
} from './budget.ts';

function chunk(fileName: string, gzipSize: number, extra: Partial<BudgetChunk> = {}): BudgetChunk {
  return {
    fileName,
    gzipSize,
    isEntry: false,
    isDynamicEntry: false,
    facadeModuleId: null,
    imports: [],
    moduleIds: [],
    ...extra,
  };
}

function css(fileName: string, gzipSize: number): BudgetAsset {
  return { fileName, gzipSize };
}

const PUBLIC_LAYOUT = 'src/app/public/PublicLayout.tsx';
const PUBLIC_PAGE = 'src/app/public/PublicPlaceholderPage.tsx';
const ADMIN_LAYOUT = 'src/app/admin/AdminLayout.tsx';
const URL_STATE_LAYOUT = 'src/lib/url-state/UrlStateLayout.tsx';
const ADMIN_PAGE = 'src/app/admin/AdminPreviewPage.tsx';
const ENTRY = 'assets/index-A1.js';
const SHARED = 'assets/shared-B2.js';

/**
 * A production-shaped graph: the entry and the public layout both import one shared chunk, the placeholder page imports
 * nothing. The public initial JS is entry + shared + layout + page = `publicBytes`.
 */
function productionGraph(publicBytes: number, cssBytes = 15_000): BudgetGraph {
  return {
    chunks: [
      chunk(ENTRY, publicBytes - 3_000, {
        isEntry: true,
        facadeModuleId: 'index.html',
        imports: [SHARED],
        moduleIds: ['index.html', 'src/main.tsx', 'src/app/router.tsx'],
      }),
      chunk(SHARED, 1_000, { moduleIds: ['node_modules/react/index.js'] }),
      chunk('assets/PublicLayout-C3.js', 1_500, {
        isDynamicEntry: true,
        facadeModuleId: PUBLIC_LAYOUT,
        imports: [SHARED],
        moduleIds: [PUBLIC_LAYOUT],
      }),
      chunk('assets/PublicPlaceholderPage-D4.js', 500, {
        isDynamicEntry: true,
        facadeModuleId: PUBLIC_PAGE,
        moduleIds: [PUBLIC_PAGE],
      }),
    ],
    assets: [
      css('assets/index-E5.css', cssBytes),
      { fileName: 'assets/archivo-latin-wght-normal-F6.woff2', gzipSize: 30_000 },
    ],
  };
}

/** The budget-mode graph: the production graph plus the parity entry and the admin route modules. */
function devRoutesGraph(adminRouteBytes: number, publicBytes = 120_000): BudgetGraph {
  const base = productionGraph(publicBytes);
  const adminShared = 'assets/admin-shared-G7.js';
  return {
    chunks: [
      ...base.chunks,
      chunk('assets/parity-P0.js', 400_000, {
        isEntry: true,
        facadeModuleId: 'parity.html',
        imports: [SHARED],
        moduleIds: ['parity.html', 'src/dev/scenarios/index.ts', 'visual/parity/page.tsx'],
      }),
      chunk('assets/AdminLayout-H8.js', adminRouteBytes - publicBytes + 2_000 - 3_000, {
        isDynamicEntry: true,
        facadeModuleId: ADMIN_LAYOUT,
        imports: [SHARED, adminShared],
        moduleIds: [ADMIN_LAYOUT, 'src/app/admin/TabBar.tsx'],
      }),
      chunk(adminShared, 1_000),
      chunk('assets/UrlStateLayout-I9.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: URL_STATE_LAYOUT,
        imports: [adminShared],
        moduleIds: [URL_STATE_LAYOUT],
      }),
      chunk('assets/AdminPreviewPage-J0.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: ADMIN_PAGE,
        imports: [SHARED],
        moduleIds: [ADMIN_PAGE],
      }),
    ],
    assets: base.assets,
  };
}

const production = { devRoutes: false } as const;
const devRoutes = { devRoutes: true } as const;

describe('BUDGETS (PERF-01)', () => {
  it('holds the three limits in bytes with 1 KB = 1000 B', () => {
    expect(BUDGETS).toEqual({ publicJs: 150_000, adminJs: 250_000, css: 35_000 });
  });

  it('names the public route modules (layout and placeholder page) and the admin route modules', () => {
    expect(PUBLIC_ROUTE).toEqual(['src/app/public/PublicLayout.tsx', 'src/app/public/PublicPlaceholderPage.tsx']);
    expect(ADMIN_ROUTE).toEqual([
      'src/app/admin/AdminLayout.tsx',
      'src/lib/url-state/UrlStateLayout.tsx',
      'src/app/admin/AdminPreviewPage.tsx',
    ]);
  });
});

describe('routeInitialSize', () => {
  it('counts a chunk shared by the entry and a route chunk once', () => {
    const graph = productionGraph(100_000);
    const result = routeInitialSize(graph.chunks, [ENTRY, 'assets/PublicLayout-C3.js']);
    expect(result.files.toSorted()).toEqual([ENTRY, 'assets/PublicLayout-C3.js', SHARED].toSorted());
    expect(result.bytes).toBe(97_000 + 1_000 + 1_500);
  });

  it('follows static imports transitively', () => {
    const chunks = [
      chunk('a.js', 10, { imports: ['b.js'] }),
      chunk('b.js', 20, { imports: ['c.js'] }),
      chunk('c.js', 30),
      chunk('d.js', 40),
    ];
    expect(routeInitialSize(chunks, ['a.js'])).toEqual({ bytes: 60, files: ['a.js', 'b.js', 'c.js'] });
  });

  it('fails closed on an import that names no chunk', () => {
    expect(() => routeInitialSize([chunk('a.js', 10, { imports: ['missing.js'] })], ['a.js'])).toThrow(/missing\.js/);
  });
});

describe('evaluateBudgets: public JS and CSS (production build)', () => {
  it('passes public initial JS of 149.9 KB', () => {
    const report = evaluateBudgets(productionGraph(149_900), production);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.publicJs).toBe(149_900);
  });

  it('passes public initial JS of exactly 150.0 KB (the limit itself passes)', () => {
    const report = evaluateBudgets(productionGraph(150_000), production);
    expect(report.ok).toBe(true);
    expect(report.publicJs).toBe(150_000);
  });

  it('fails public initial JS of 150.1 KB', () => {
    const report = evaluateBudgets(productionGraph(150_100), production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/public JS.*150\.10 KB.*150\.00 KB/)]);
  });

  it('passes 35.0 KB of CSS and fails 35.1 KB', () => {
    expect(evaluateBudgets(productionGraph(120_000, 35_000), production).ok).toBe(true);
    const over = evaluateBudgets(productionGraph(120_000, 35_100), production);
    expect(over.ok).toBe(false);
    expect(over.css).toBe(35_100);
    expect(over.errors).toEqual([expect.stringMatching(/CSS.*35\.10 KB.*35\.00 KB/)]);
  });

  it('fails when the build emits two CSS assets (a stray stylesheet import, D-33)', () => {
    const graph = productionGraph(120_000);
    const report = evaluateBudgets(
      { ...graph, assets: [...graph.assets, css('assets/stray-K1.css', 100)] },
      production,
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/exactly one CSS asset.*index-E5\.css.*stray-K1\.css/)]);
  });

  it('fails when the build emits no CSS asset', () => {
    const graph = productionGraph(120_000);
    const report = evaluateBudgets({ ...graph, assets: [] }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/exactly one CSS asset/)]);
  });

  it('fails closed when a public route module has no chunk', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => c.facadeModuleId !== PUBLIC_PAGE);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicJs).toBeNull();
    expect(report.errors).toEqual([expect.stringContaining('src/app/public/PublicPlaceholderPage.tsx')]);
  });

  it('fails closed when the index.html entry chunk is missing', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => !c.isEntry);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicJs).toBeNull();
    expect(report.errors).toEqual([expect.stringContaining('index.html')]);
  });

  it('fails a production chunk whose modules include src/app/admin/AdminLayout.tsx (D-20, CWE-489)', () => {
    const graph = productionGraph(120_000);
    const leaked = graph.chunks.map((c) =>
      c.fileName === SHARED ? { ...c, moduleIds: [...c.moduleIds, 'src/app/admin/AdminLayout.tsx'] } : c,
    );
    const report = evaluateBudgets({ ...graph, chunks: leaked }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/shared-B2\.js.*src\/app\/admin\/AdminLayout\.tsx/)]);
  });

  it('fails a production build with a second entry (the parity page must never ship)', () => {
    const graph = productionGraph(120_000);
    const report = evaluateBudgets(
      {
        ...graph,
        chunks: [...graph.chunks, chunk('assets/parity-P0.js', 10, { isEntry: true, facadeModuleId: 'parity.html' })],
      },
      production,
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining('parity.html')]);
  });

  it('measures no admin route in the production build', () => {
    const report = evaluateBudgets(productionGraph(120_000), production);
    expect(report.adminJs).toBeNull();
  });

  it('reports every measured value against its limit in a table', () => {
    const report = evaluateBudgets(productionGraph(150_100), production);
    expect(report.table).toContain('public JS');
    expect(report.table).toContain('150.10 KB');
    expect(report.table).toContain('150.00 KB');
    expect(report.table).toContain('CSS');
    expect(report.table).toContain('15.00 KB');
    expect(report.table).toContain('35.00 KB');
    expect(report.table).toMatch(/public JS.*OVER/);
  });
});

describe('evaluateBudgets: admin topology (budget-mode build with dev routes)', () => {
  it('passes admin initial JS of exactly 250 KB and counts the shared chunks once', () => {
    const report = evaluateBudgets(devRoutesGraph(250_000), devRoutes);
    expect(report.errors).toEqual([]);
    expect(report.adminJs).toBe(250_000);
  });

  it('fails admin initial JS of 251 KB', () => {
    const report = evaluateBudgets(devRoutesGraph(251_000), devRoutes);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/admin JS.*251\.00 KB.*250\.00 KB/)]);
  });

  it('fails closed when the admin layout chunk is missing', () => {
    const graph = devRoutesGraph(200_000);
    const chunks = graph.chunks.filter((c) => c.facadeModuleId !== ADMIN_LAYOUT);
    const report = evaluateBudgets({ ...graph, chunks }, devRoutes);
    expect(report.ok).toBe(false);
    expect(report.adminJs).toBeNull();
    expect(report.errors).toEqual([expect.stringContaining('src/app/admin/AdminLayout.tsx')]);
  });

  it('never measures the parity entry as a route and allows dev-only modules', () => {
    const report = evaluateBudgets(devRoutesGraph(200_000, 120_000), devRoutes);
    expect(report.ok).toBe(true);
    expect(report.publicJs).toBe(120_000);
  });
});
