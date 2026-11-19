// @vitest-environment node
// PERF-01: the bundle budgets, evaluated over synthetic chunk graphs (research Pattern 12). Sizes are gzip level 9 bytes
// and 1 KB = 1000 B, so 150.0 KB is 150_000 B; a value exactly at its limit passes.
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROUTE,
  ADMIN_SIGN_IN_ROUTE,
  BARREL_SPLIT_TRIGGER,
  BUDGETS,
  evaluateBudgets,
  LEGAL_LOADERS,
  PARITY_ENTRY,
  PUBLIC_FORBIDDEN_MODULE_PREFIXES,
  PUBLIC_PRELOAD_ROUTE,
  PUBLIC_ROUTES,
  routeInitialSize,
  SHOWCASE_ONLY_MODULE_PREFIXES,
  SHOWCASE_PAGE,
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

const PUBLIC_LAYOUT = 'src/layouts/PublicLayout.tsx';
const PAGE_MODULES = {
  home: 'src/modules/public/pages/HomePage.tsx',
  products: 'src/modules/public/pages/ProductsPage.tsx',
  gallery: 'src/modules/public/pages/GalleryPage.tsx',
  contact: 'src/modules/public/pages/ContactPage.tsx',
  privacy: 'src/modules/public/pages/PrivacyPolicyPage.tsx',
  terms: 'src/modules/public/pages/TermsPage.tsx',
  accessibility: 'src/modules/public/pages/AccessibilityPage.tsx',
  notFound: 'src/modules/public/pages/NotFoundPage.tsx',
} as const;
const PAGE_NAMES = [
  'home',
  'products',
  'gallery',
  'contact',
  'privacy',
  'terms',
  'accessibility',
  'notFound',
] as const;
const HOME_PAGE = PAGE_MODULES.home;
const LEGAL_NAMES = ['privacy', 'terms', 'accessibility'] as const;
const LOADER_CHUNK = 'assets/legalLoaders-N1.js';
const LOADER_MODULE = 'src/modules/public/legalLoaders.ts';
const ADMIN_LAYOUT = 'src/layouts/AdminLayout.tsx';
const URL_STATE_LAYOUT = 'src/lib/url-state/UrlStateLayout.tsx';
const SESSIONS_PAGE = 'src/modules/admin/pages/SessionsPage.tsx';
const AUTH_LAYOUT = 'src/layouts/AuthLayout.tsx';
const SIGN_IN_PAGE = 'src/modules/admin/pages/SignInPage.tsx';
const GUARD = 'src/modules/admin/guard.ts';
const QUERY_ROOT = 'src/core/routes/QueryRoot.tsx';
const ADMIN_ROUTES = 'src/modules/admin/routes.tsx';
const PREVIEW_PAGE = 'src/modules/admin/pages/AdminPreviewPage.tsx';
const ENTRY = 'assets/index-A1.js';
const SHARED = 'assets/shared-B2.js';

/**
 * A production-shaped graph: the entry, the public layout and the five public pages all import one shared chunk. Each
 * of the eight public routes totals `publicBytes` (entry + shared + layout + page; the Gallery route also loads the
 * URL-state layout and the chunk it imports, so its page chunk is smaller; the three legal routes also load the 500 B
 * legal loader chunk, so their page chunks are 2,500 B). The guarded admin app ships too:
 * the signed-in entry (route table, guard, admin layout, URL-state layout, devices page) totals `adminRouteBytes`, and the
 * signed-out entry (route table, guard, auth layout, sign-in page) is about 3 KB over the public number. The route
 * table is its own lazy chunk: the router loads it on the first navigation under /admin (D-42).
 */
/** The page chunk size: the legal pages leave 500 B for the loader chunk their routes load first. */
function pageBytes(name: (typeof PAGE_NAMES)[number]): number {
  if (name === 'gallery') {
    return 1_000;
  }
  return (LEGAL_NAMES as readonly string[]).includes(name) ? 2_500 : 3_000;
}

function productionGraph(publicBytes: number, cssBytes = 15_000, adminRouteBytes = publicBytes + 42_000): BudgetGraph {
  const adminShared = 'assets/admin-shared-G7.js';
  const pageChunks = PAGE_NAMES.map((name) =>
    chunk(`assets/${name}-Page-D4.js`, pageBytes(name), {
      isDynamicEntry: true,
      facadeModuleId: PAGE_MODULES[name],
      imports: [SHARED],
      moduleIds: [PAGE_MODULES[name]],
    }),
  );
  return {
    chunks: [
      chunk(ENTRY, publicBytes - 5_000, {
        isEntry: true,
        facadeModuleId: 'index.html',
        imports: [SHARED],
        moduleIds: ['index.html', 'src/main.tsx', 'src/core/routes/router.tsx'],
      }),
      chunk(SHARED, 1_000, { moduleIds: ['node_modules/react/index.js'] }),
      chunk('assets/PublicLayout-D3.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: PUBLIC_LAYOUT,
        imports: [SHARED],
        moduleIds: [PUBLIC_LAYOUT],
      }),
      ...pageChunks,
      chunk(LOADER_CHUNK, 500, {
        isDynamicEntry: true,
        facadeModuleId: LOADER_MODULE,
        imports: [ENTRY],
        moduleIds: [LOADER_MODULE],
      }),
      chunk('assets/QueryRoot-Q5.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: QUERY_ROOT,
        imports: [SHARED],
        moduleIds: [QUERY_ROOT, 'node_modules/@tanstack/query-core/build/modern/queryClient.js'],
      }),
      chunk('assets/routes-R6.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: ADMIN_ROUTES,
        imports: [SHARED],
        moduleIds: [ADMIN_ROUTES],
      }),
      chunk('assets/AdminLayout-H8.js', adminRouteBytes - publicBytes - 2_000, {
        isDynamicEntry: true,
        facadeModuleId: ADMIN_LAYOUT,
        imports: [SHARED, adminShared],
        moduleIds: [ADMIN_LAYOUT, 'src/modules/admin/components/TabBar.tsx'],
      }),
      chunk(adminShared, 1_000),
      chunk('assets/UrlStateLayout-I9.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: URL_STATE_LAYOUT,
        imports: [adminShared],
        moduleIds: [URL_STATE_LAYOUT],
      }),
      chunk('assets/SessionsPage-J0.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: SESSIONS_PAGE,
        imports: [SHARED],
        moduleIds: [SESSIONS_PAGE],
      }),
      chunk('assets/guard-K2.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: GUARD,
        imports: [SHARED],
        moduleIds: [GUARD],
      }),
      chunk('assets/AuthLayout-L3.js', 2_000, {
        isDynamicEntry: true,
        facadeModuleId: AUTH_LAYOUT,
        imports: [SHARED, adminShared],
        moduleIds: [AUTH_LAYOUT],
      }),
      chunk('assets/SignInPage-M4.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: SIGN_IN_PAGE,
        imports: [SHARED],
        moduleIds: [SIGN_IN_PAGE],
      }),
    ],
    assets: [
      css('assets/index-E5.css', cssBytes),
      { fileName: 'assets/archivo-latin-wght-normal-F6.woff2', gzipSize: 30_000 },
    ],
  };
}

const PARITY_CHUNK = chunk('assets/parity-P0.js', 400_000, {
  isEntry: true,
  facadeModuleId: 'parity.html',
  imports: [SHARED],
  moduleIds: ['parity.html', 'src/dev/scenarios/index.ts', 'visual/parity/page.tsx'],
});

/** The parity-build graph: the e2e/budget graph plus the test-only parity entry. */
function parityGraph(adminRouteBytes: number, publicBytes = 120_000): BudgetGraph {
  const base = devRoutesGraph(adminRouteBytes, publicBytes);
  return { ...base, chunks: [...base.chunks, PARITY_CHUNK] };
}

/** The e2e/budget-build graph: the production graph plus the dev-only preview page (no parity entry). */
function devRoutesGraph(adminRouteBytes: number, publicBytes = 120_000): BudgetGraph {
  const base = productionGraph(publicBytes, 15_000, adminRouteBytes);
  return {
    chunks: [
      ...base.chunks,
      chunk('assets/AdminPreviewPage-J0.js', 1_000, {
        isDynamicEntry: true,
        facadeModuleId: PREVIEW_PAGE,
        imports: [SHARED],
        moduleIds: [PREVIEW_PAGE],
      }),
    ],
    assets: base.assets,
  };
}

const production = { build: 'production' } as const;
const devRoutes = { build: 'dev-routes' } as const;
const parity = { build: 'parity' } as const;

describe('BUDGETS (PERF-01)', () => {
  it('holds the three limits in bytes with 1 KB = 1000 B', () => {
    expect(BUDGETS).toEqual({ publicJs: 150_000, adminJs: 250_000, css: 35_000 });
  });

  it('names the public layout and each public page module (PUB-01, RESEARCH P-7), and the admin route modules', () => {
    expect(PUBLIC_ROUTES).toEqual({
      home: [PUBLIC_LAYOUT, PAGE_MODULES.home],
      products: [PUBLIC_LAYOUT, PAGE_MODULES.products],
      gallery: [PUBLIC_LAYOUT, 'src/lib/url-state/UrlStateLayout.tsx', PAGE_MODULES.gallery],
      contact: [PUBLIC_LAYOUT, PAGE_MODULES.contact],
      privacy: [PUBLIC_LAYOUT, LEGAL_LOADERS, PAGE_MODULES.privacy],
      terms: [PUBLIC_LAYOUT, LEGAL_LOADERS, PAGE_MODULES.terms],
      accessibility: [PUBLIC_LAYOUT, LEGAL_LOADERS, PAGE_MODULES.accessibility],
      notFound: [PUBLIC_LAYOUT, PAGE_MODULES.notFound],
    });
    expect(LEGAL_LOADERS).toBe('src/modules/public/legalLoaders.ts');
    expect(Object.isFrozen(PUBLIC_ROUTES)).toBe(true);
    expect(PUBLIC_PRELOAD_ROUTE).toEqual([PUBLIC_LAYOUT, HOME_PAGE]);
    expect(ADMIN_ROUTE).toEqual([
      'src/core/routes/QueryRoot.tsx',
      'src/modules/admin/routes.tsx',
      'src/layouts/AdminLayout.tsx',
      'src/lib/url-state/UrlStateLayout.tsx',
      'src/modules/admin/pages/SessionsPage.tsx',
      'src/modules/admin/guard.ts',
    ]);
    expect(ADMIN_SIGN_IN_ROUTE).toEqual([
      'src/core/routes/QueryRoot.tsx',
      'src/modules/admin/routes.tsx',
      'src/layouts/AuthLayout.tsx',
      'src/modules/admin/pages/SignInPage.tsx',
      'src/modules/admin/guard.ts',
    ]);
    expect(ADMIN_ROUTE).not.toContain(PREVIEW_PAGE);
  });
});

describe('routeInitialSize', () => {
  it('counts a chunk shared by the entry and a route chunk once', () => {
    const graph = productionGraph(100_000);
    const result = routeInitialSize(graph.chunks, [ENTRY, 'assets/home-Page-D4.js']);
    expect(result.files.toSorted()).toEqual([ENTRY, 'assets/home-Page-D4.js', SHARED].toSorted());
    expect(result.bytes).toBe(95_000 + 1_000 + 3_000);
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

  it('fails public initial JS of 150.1 KB, once for each public route', () => {
    const report = evaluateBudgets(productionGraph(150_100), production);
    expect(report.ok).toBe(false);
    expect(report.errors).toHaveLength(PAGE_NAMES.length);
    for (const name of PAGE_NAMES) {
      expect(report.errors).toContainEqual(
        expect.stringMatching(new RegExp(`public JS \\(${name}\\).*150\\.10 KB.*150\\.00 KB`)),
      );
    }
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

  it('fails closed when a public page module has no chunk', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => c.facadeModuleId !== HOME_PAGE);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicJs).toBeNull();
    expect(report.publicRoutes.home).toBeNull();
    expect(report.publicRoutes.products).toBe(120_000);
    expect(report.errors).toEqual([expect.stringContaining(HOME_PAGE)]);
  });

  it('fails closed, once, when the public layout has no chunk (every route needs it)', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => c.facadeModuleId !== PUBLIC_LAYOUT);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicJs).toBeNull();
    expect(report.errors).toEqual([expect.stringContaining(PUBLIC_LAYOUT)]);
  });

  it('fails closed when the index.html entry chunk is missing', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => !c.isEntry);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicJs).toBeNull();
    expect(report.errors).toEqual([expect.stringContaining('index.html')]);
  });

  it('fails a production chunk whose modules include the dev preview page (D-20, CWE-489)', () => {
    const graph = productionGraph(120_000);
    const leaked = graph.chunks.map((c) =>
      c.fileName === SHARED ? { ...c, moduleIds: [...c.moduleIds, 'src/modules/admin/pages/AdminPreviewPage.tsx'] } : c,
    );
    const report = evaluateBudgets({ ...graph, chunks: leaked }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringMatching(/shared-B2\.js.*src\/modules\/admin\/pages\/AdminPreviewPage\.tsx/),
    ]);
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

  it('measures the shipped admin app in the production build (the larger of the signed-in and signed-out entries)', () => {
    const report = evaluateBudgets(productionGraph(120_000), production);
    expect(report.errors).toEqual([]);
    expect(report.adminJs).toBe(162_000);
  });

  it('fails the production build when the signed-in admin entry is over 250 KB', () => {
    const report = evaluateBudgets(productionGraph(120_000, 15_000, 251_000), production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringMatching(/admin JS.*251\.00 KB.*250\.00 KB/)]);
  });

  it('fails the production build when the sign-in entry is over 250 KB, though the signed-in entry is small', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) => (c.facadeModuleId === AUTH_LAYOUT ? { ...c, gzipSize: 200_000 } : c));
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.adminJs).toBe(321_000);
    expect(report.errors).toEqual([expect.stringMatching(/admin JS.*321.00 KB.*250\.00 KB/)]);
  });

  it.each([[SIGN_IN_PAGE], [GUARD], [SESSIONS_PAGE], [ADMIN_ROUTES]])(
    'fails closed in the production build when the shipped admin module %s has no chunk',
    (module) => {
      const graph = productionGraph(120_000);
      const chunks = graph.chunks.filter((c) => c.facadeModuleId !== module);
      const report = evaluateBudgets({ ...graph, chunks }, production);
      expect(report.ok).toBe(false);
      expect(report.adminJs).toBeNull();
      expect(report.errors).toEqual([expect.stringContaining(module)]);
    },
  );

  it('reports every measured value against its limit in a table', () => {
    const report = evaluateBudgets(productionGraph(150_100), production);
    expect(report.table).toContain('public JS (home)');
    expect(report.table).toContain('public JS (notFound)');
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
    expect(report.errors).toEqual([expect.stringContaining('src/layouts/AdminLayout.tsx')]);
  });

  it('finds a route module that sits in a shared chunk (the parity entry imports it statically, so it is no facade)', () => {
    const graph = parityGraph(240_000);
    const chunks = graph.chunks.map((c) =>
      c.facadeModuleId === ADMIN_LAYOUT || c.facadeModuleId === HOME_PAGE || c.facadeModuleId === PUBLIC_LAYOUT
        ? { ...c, facadeModuleId: null, isDynamicEntry: false }
        : c,
    );
    const report = evaluateBudgets({ ...graph, chunks }, parity);
    expect(report.errors).toEqual([]);
    expect(report.adminJs).toBe(240_000);
    expect(report.publicJs).toBe(120_000);
  });

  it('allows dev-only modules in the e2e and budget builds', () => {
    const report = evaluateBudgets(devRoutesGraph(200_000, 120_000), devRoutes);
    expect(report.ok).toBe(true);
    expect(report.devRoutes).toBe(true);
    expect(report.build).toBe('dev-routes');
  });

  it('fails public initial JS of 150.1 KB in the e2e and budget builds (the limits apply to every build)', () => {
    const report = evaluateBudgets(devRoutesGraph(200_000, 150_100), devRoutes);
    expect(report.ok).toBe(false);
    expect(report.errors).toHaveLength(PAGE_NAMES.length);
    expect(report.errors.every((error) => /public JS.*150\.10 KB.*150\.00 KB/.test(error))).toBe(true);
  });

  // The e2e and budget builds measure the shipped topology; the test-only parity page would reshape the shared chunks
  // the public route loads (docs/web/budgets.md).
  it('fails an e2e or budget build that has the parity entry', () => {
    const graph = devRoutesGraph(200_000);
    const report = evaluateBudgets({ ...graph, chunks: [...graph.chunks, PARITY_CHUNK] }, devRoutes);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringMatching(/dev-routes build has an unexpected entry parity\.html; only the parity build/),
    ]);
  });

  it('fails an entry chunk with no facade module in any build', () => {
    const graph = devRoutesGraph(200_000);
    const stray = chunk('assets/stray-Z9.js', 10, { isEntry: true });
    const report = evaluateBudgets({ ...graph, chunks: [...graph.chunks, stray] }, parity);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining('unexpected entry assets/stray-Z9.js')]);
  });
});

describe('evaluateBudgets: the parity build (test-only parity page)', () => {
  it('names parity.html as the parity entry', () => {
    expect(PARITY_ENTRY).toBe('parity.html');
  });

  it('allows the parity entry and dev-only modules, and never measures the parity entry as a route', () => {
    const report = evaluateBudgets(parityGraph(200_000, 120_000), parity);
    expect(report.errors).toEqual([]);
    expect(report.publicJs).toBe(120_000);
    expect(report.adminJs).toBe(200_000);
  });

  it('still fails public initial JS of 150.1 KB and admin initial JS of 251 KB', () => {
    const publicErrors = evaluateBudgets(parityGraph(200_000, 150_100), parity).errors;
    expect(publicErrors).toHaveLength(PAGE_NAMES.length);
    expect(publicErrors.every((error) => /public JS.*150\.10 KB/.test(error))).toBe(true);
    expect(evaluateBudgets(parityGraph(251_000), parity).errors).toEqual([
      expect.stringMatching(/admin JS.*251\.00 KB/),
    ]);
  });
});

describe('evaluateBudgets: no dev code in production (D-20, CWE-489)', () => {
  it.each([
    ['src/dev/parity-main.tsx'],
    ['visual/parity/page.tsx'],
    ['visual/.reference-src/ui/index.tsx'],
    ['src/modules/admin/pages/AdminPreviewPage.tsx'],
    ['src/modules/admin/previewCopy.ts'],
    ['src/modules/public/pages/PublicLayoutCheckPage.tsx'],
  ])('fails a production chunk that contains %s', (moduleId) => {
    const graph = productionGraph(120_000);
    const leaked = graph.chunks.map((c) =>
      c.fileName === ENTRY ? { ...c, moduleIds: [...c.moduleIds, moduleId] } : c,
    );
    const report = evaluateBudgets({ ...graph, chunks: leaked }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining(`index-A1.js contains the dev-only module ${moduleId}`)]);
  });

  it('allows the guarded admin app in production (D-20 reversed in Phase 4) in its own lazy chunks, the route table included (D-42)', () => {
    const graph = productionGraph(120_000);
    expect(evaluateBudgets(graph, production).errors).toEqual([]);
    expect(graph.chunks.some((c) => c.moduleIds.includes('src/modules/admin/guard.ts'))).toBe(true);
    const routeTable = graph.chunks.find((c) => c.moduleIds.includes(ADMIN_ROUTES));
    expect(routeTable).toMatchObject({ isDynamicEntry: true, facadeModuleId: ADMIN_ROUTES });
    expect(graph.chunks.find((c) => c.isEntry)?.moduleIds).not.toContain(ADMIN_ROUTES);
  });

  it('allows a module whose name only resembles a dev path', () => {
    const graph = productionGraph(120_000);
    const similar = graph.chunks.map((c) =>
      c.fileName === ENTRY
        ? { ...c, moduleIds: [...c.moduleIds, 'src/devices.ts', 'node_modules/visual-x/index.js'] }
        : c,
    );
    expect(evaluateBudgets({ ...graph, chunks: similar }, production).errors).toEqual([]);
  });

  it.each([['.reference-dist/assets/main.js'], ['assets/.reference-src/mark.svg']])(
    'fails a build that emits %s (the parity reference never reaches wwwroot)',
    (fileName) => {
      const graph = productionGraph(120_000);
      const report = evaluateBudgets({ ...graph, assets: [...graph.assets, { fileName, gzipSize: 10 }] }, production);
      expect(report.ok).toBe(false);
      expect(report.errors).toEqual([expect.stringContaining(fileName)]);
    },
  );
});

// D-33 / D-41 Q3: the component showcase ships to production as a lazy admin chunk, with the scenario data, the kit and
// the previews it renders. Those modules may sit only in chunks that the public and admin initial JS do not load and
// that the showcase page's own chunk reaches; the parity entry, visual/, the preview page and its copy stay out.
describe('evaluateBudgets: the showcase in production (D-33, D-41 Q3)', () => {
  const SHOWCASE_CHUNK = 'assets/ComponentShowcasePage-S1.js';
  const KIT_CHUNK = 'assets/showcase-kit-S2.js';
  const USERS_CHUNK = 'assets/UsersPage-U1.js';
  const KIT_MODULES = [
    'src/dev/kit.ts',
    'src/dev/scenarios/groups/money.ts',
    'src/dev/previews/ListTable.tsx',
    'src/modules/admin/components/showcase/ShowcaseDemos.tsx',
  ];

  /** The production graph plus a lazy showcase page chunk that statically imports one kit chunk holding the dev modules. */
  function showcaseGraph(): BudgetGraph {
    const base = productionGraph(120_000);
    return {
      ...base,
      chunks: [
        ...base.chunks,
        chunk(SHOWCASE_CHUNK, 20_000, {
          isDynamicEntry: true,
          facadeModuleId: SHOWCASE_PAGE,
          imports: [SHARED, KIT_CHUNK],
          moduleIds: [SHOWCASE_PAGE, 'src/modules/admin/components/showcase/showcaseCopy.ts'],
        }),
        chunk(KIT_CHUNK, 60_000, { imports: [SHARED], moduleIds: KIT_MODULES }),
        // Another lazy admin page: no initial JS loads it and the showcase page does not reach it.
        chunk(USERS_CHUNK, 8_000, {
          isDynamicEntry: true,
          facadeModuleId: 'src/modules/admin/pages/UsersPage.tsx',
          imports: [SHARED],
          moduleIds: ['src/modules/admin/pages/UsersPage.tsx'],
        }),
      ],
    };
  }

  /** The same graph with one extra module id in the named chunk. */
  function withModule(graph: BudgetGraph, fileName: string, moduleId: string): BudgetGraph {
    return {
      ...graph,
      chunks: graph.chunks.map((c) => (c.fileName === fileName ? { ...c, moduleIds: [...c.moduleIds, moduleId] } : c)),
    };
  }

  it('names the showcase page and the showcase-only prefixes', () => {
    expect(SHOWCASE_PAGE).toBe('src/modules/admin/pages/ComponentShowcasePage.tsx');
    expect(SHOWCASE_ONLY_MODULE_PREFIXES).toEqual([
      'src/dev/',
      'src/modules/admin/components/showcase/',
      'src/modules/admin/pages/ComponentShowcasePage',
    ]);
  });

  it('passes when the dev modules sit only in chunks the showcase page reaches, and its size does not count toward admin JS', () => {
    const report = evaluateBudgets(showcaseGraph(), production);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.adminJs).toBe(162_000);
    expect(report.publicJs).toBe(120_000);
  });

  it.each([
    ['the entry chunk', ENTRY],
    ['a chunk the public route shares', SHARED],
    ['the admin layout chunk', 'assets/AdminLayout-H8.js'],
    ['the sign-in page chunk', 'assets/SignInPage-M4.js'],
  ])('fails when a src/dev module sits in %s (initial JS)', (_name, fileName) => {
    const report = evaluateBudgets(
      withModule(showcaseGraph(), fileName, 'src/dev/scenarios/groups/money.ts'),
      production,
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringContaining(`${fileName} contains the showcase-only module src/dev/scenarios/groups/money.ts`),
    ]);
  });

  it('fails when a showcase module sits in a lazy chunk the showcase page does not reach', () => {
    const report = evaluateBudgets(
      withModule(showcaseGraph(), USERS_CHUNK, 'src/modules/admin/components/showcase/showcaseCopy.ts'),
      production,
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringMatching(/UsersPage-U1\.js contains the showcase-only module .*showcaseCopy\.ts/),
    ]);
  });

  it('fails when another chunk outside the showcase imports a chunk that holds showcase modules', () => {
    const graph = showcaseGraph();
    const chunks = graph.chunks.map((c) => (c.fileName === USERS_CHUNK ? { ...c, imports: [SHARED, KIT_CHUNK] } : c));
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringMatching(/UsersPage-U1\.js imports assets\/showcase-kit-S2\.js, which holds showcase-only modules/),
    ]);
  });

  // D-117: the showcase may load some of its cases on demand (the Phase 10 cases, review fix IN-01).
  const LAZY_CASES_CHUNK = 'assets/Phase10Demos-S3.js';
  const LAZY_CASES_MODULE = 'src/modules/admin/components/showcase/Phase10Demos.tsx';

  /** The showcase graph plus a lazy cases chunk, loaded on demand by the chunk named `loader`. */
  function withLazyCases(loader: string): BudgetGraph {
    const graph = showcaseGraph();
    return {
      ...graph,
      chunks: [
        ...graph.chunks.map((c) => (c.fileName === loader ? { ...c, dynamicImports: [LAZY_CASES_CHUNK] } : c)),
        chunk(LAZY_CASES_CHUNK, 15_000, {
          isDynamicEntry: true,
          facadeModuleId: LAZY_CASES_MODULE,
          imports: [SHARED, SHOWCASE_CHUNK],
          moduleIds: [LAZY_CASES_MODULE],
        }),
      ],
    };
  }

  it('passes when a showcase chunk loads more showcase cases on demand, and they do not count toward admin JS (D-117)', () => {
    const report = evaluateBudgets(withLazyCases(KIT_CHUNK), production);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.adminJs).toBe(162_000);
  });

  it('fails when only a chunk outside the showcase loads the showcase cases on demand (D-117)', () => {
    const report = evaluateBudgets(withLazyCases(USERS_CHUNK), production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringMatching(
        /Phase10Demos-S3\.js contains the showcase-only module .*Phase10Demos\.tsx, but the showcase page does not load it/,
      ),
      expect.stringMatching(
        /Phase10Demos-S3\.js imports assets\/ComponentShowcasePage-S1\.js, which holds showcase-only modules/,
      ),
    ]);
  });

  it('fails when the build holds showcase modules but no showcase page chunk', () => {
    const graph = showcaseGraph();
    const chunks = graph.chunks.filter((c) => c.fileName !== SHOWCASE_CHUNK);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([expect.stringContaining(`no chunk holds ${SHOWCASE_PAGE}`)]));
  });

  it.each([
    ['src/dev/parity-main.tsx'],
    ['visual/parity/page.tsx'],
    ['src/modules/admin/pages/AdminPreviewPage.tsx'],
    ['src/modules/admin/previewCopy.ts'],
    ['src/modules/public/pages/PublicLayoutCheckPage.tsx'],
  ])('fails %s even inside the showcase chunks', (moduleId) => {
    const report = evaluateBudgets(withModule(showcaseGraph(), KIT_CHUNK, moduleId), production);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining(`${KIT_CHUNK} contains the dev-only module ${moduleId}`)]);
  });

  it('does not apply to the e2e, budget and parity builds', () => {
    const graph = withModule(showcaseGraph(), ENTRY, 'src/dev/kit.ts');
    expect(evaluateBudgets(graph, devRoutes).errors).toEqual([]);
    expect(evaluateBudgets(graph, parity).errors).toEqual([]);
  });
});

describe('evaluateBudgets: the public initial JS carries no TanStack Query and no admin code (PERF-02)', () => {
  const withEntryModule = (moduleId: string, build: typeof production | typeof devRoutes = production) => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) =>
      c.fileName === ENTRY ? { ...c, moduleIds: [...c.moduleIds, moduleId] } : c,
    );
    return evaluateBudgets({ ...graph, chunks }, build);
  };

  it.each([
    ['node_modules/@tanstack/query-core/build/modern/queryClient.js'],
    ['node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js'],
    ['node_modules/nuqs/dist/index.js'],
    ['node_modules/react-hook-form/dist/index.esm.mjs'],
    ['node_modules/zod/v4/classic/schemas.js'],
    ['src/lib/query/queryClient.ts'],
    ['src/lib/query/cacheOwner.ts'],
    ['src/lib/url-state/UrlStateLayout.tsx'],
    ['src/core/routes/QueryRoot.tsx'],
    ['src/layouts/AdminLayout.tsx'],
    ['src/layouts/AuthLayout.tsx'],
    ['src/modules/admin/guard.ts'],
    ['src/modules/admin/services/session.ts'],
    ['src/modules/admin/pages/AdminNotFoundPage.tsx'],
    ['src/modules/admin/routes.tsx'],
  ])('fails a public initial chunk that contains %s', (moduleId) => {
    for (const build of [production, devRoutes]) {
      const report = withEntryModule(moduleId, build);
      expect(report.ok).toBe(false);
      expect(report.errors).toEqual([
        expect.stringContaining(`The public initial JS (assets/index-A1.js) contains ${moduleId}`),
      ]);
    }
  });

  it('fails a shared chunk of the public route that contains TanStack Query', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) =>
      c.fileName === SHARED
        ? { ...c, moduleIds: [...c.moduleIds, 'node_modules/@tanstack/query-core/build/modern/query.js'] }
        : c,
    );
    expect(evaluateBudgets({ ...graph, chunks }, production).errors).toEqual([
      expect.stringContaining('The public initial JS (assets/shared-B2.js) contains node_modules/@tanstack/query-core'),
    ]);
  });

  it('allows the error boundaries in the entry', () => {
    expect(withEntryModule('src/core/routes/ErrorBoundary.tsx').errors).toEqual([]);
  });
});

// PUB-01, RESEARCH P-7: PublicLayout and each public page are measured as one route, so a page that grows is named and
// the others are not blamed. TanStack Query, react-hook-form and zod are forbidden in all of them; nuqs and the URL-state
// layout only under the Gallery route (WEB-10).
describe('evaluateBudgets: each public page is measured on its own (PUB-01, WEB-10)', () => {
  const PAGE_CHUNK = (name: (typeof PAGE_NAMES)[number]) => `assets/${name}-Page-D4.js`;

  /** The production graph with one extra module id in the chunk whose facade module is `facade`. */
  function evaluateWith(facade: string, moduleId: string, build: typeof production | typeof devRoutes = production) {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) =>
      c.facadeModuleId === facade ? { ...c, moduleIds: [...c.moduleIds, moduleId] } : c,
    );
    return evaluateBudgets({ ...graph, chunks }, build);
  }

  it('reports one figure per public page, each with the layout counted', () => {
    const report = evaluateBudgets(productionGraph(120_000), production);
    expect(report.errors).toEqual([]);
    expect(report.publicRoutes).toEqual({
      home: 120_000,
      products: 120_000,
      gallery: 120_000,
      contact: 120_000,
      privacy: 120_000,
      terms: 120_000,
      accessibility: 120_000,
      notFound: 120_000,
    });
    expect(report.measurements.filter((m) => m.name === 'publicJs').map((m) => m.label)).toEqual(
      PAGE_NAMES.map((name) => `public JS (${name})`),
    );
  });

  it('names only the page that grew past 150.0 KB, and reports the largest page as public JS', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) => (c.fileName === PAGE_CHUNK('products') ? { ...c, gzipSize: 33_100 } : c));
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    expect(report.publicRoutes.products).toBe(150_100);
    expect(report.publicRoutes.home).toBe(120_000);
    expect(report.publicJs).toBe(150_100);
    expect(report.errors).toEqual([expect.stringMatching(/public JS \(products\).*150\.10 KB.*150\.00 KB/)]);
  });

  it('passes a page at exactly 150.0 KB', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) => (c.fileName === PAGE_CHUNK('home') ? { ...c, gzipSize: 33_000 } : c));
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.errors).toEqual([]);
    expect(report.publicRoutes.home).toBe(150_000);
  });

  // D-42: the legal routes fetch legalLoaders.ts before their page, so its bytes count in those three rows only.
  it('counts the legal loader chunk in the three legal rows and in no other row (D-42)', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.map((c) => (c.fileName === LOADER_CHUNK ? { ...c, gzipSize: 1_500 } : c));
    const report = evaluateBudgets({ ...graph, chunks }, production);
    for (const name of PAGE_NAMES) {
      expect(report.publicRoutes[name]).toBe((LEGAL_NAMES as readonly string[]).includes(name) ? 121_000 : 120_000);
    }
    for (const name of LEGAL_NAMES) {
      const row = report.measurements.find((m) => m.label === `public JS (${name})`);
      expect(row?.files).toContain(LOADER_CHUNK);
    }
  });

  it('fails the three legal rows, with one error, when the build has no legal loader chunk (D-42)', () => {
    const graph = productionGraph(120_000);
    const chunks = graph.chunks.filter((c) => c.fileName !== LOADER_CHUNK);
    const report = evaluateBudgets({ ...graph, chunks }, production);
    expect(report.ok).toBe(false);
    for (const name of LEGAL_NAMES) {
      expect(report.publicRoutes[name]).toBeNull();
    }
    expect(report.publicRoutes.home).toBe(120_000);
    expect(report.errors.filter((e) => e.includes(`the route module ${LOADER_MODULE} has no chunk`))).toHaveLength(1);
  });

  it.each(PAGE_NAMES)('fails TanStack Query in the %s page chunk', (name) => {
    const report = evaluateWith(PAGE_MODULES[name], 'node_modules/@tanstack/query-core/build/modern/query.js');
    expect(report.errors).toEqual([
      expect.stringContaining(
        `The public initial JS (${PAGE_CHUNK(name)}) contains node_modules/@tanstack/query-core/build/modern/query.js`,
      ),
    ]);
  });

  it.each(['node_modules/react-hook-form/dist/index.esm.mjs', 'node_modules/zod/v4/classic/schemas.js'])(
    'fails %s in a page chunk, the Gallery page included',
    (moduleId) => {
      for (const name of PAGE_NAMES) {
        expect(evaluateWith(PAGE_MODULES[name], moduleId).ok).toBe(false);
      }
    },
  );

  it('fails nuqs in the Contact page chunk (it loads outside the Gallery route)', () => {
    const report = evaluateWith(PAGE_MODULES.contact, 'node_modules/nuqs/dist/index.js');
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringContaining(`(${PAGE_CHUNK('contact')}) contains node_modules/nuqs/dist/index.js`),
    ]);
  });

  it.each(['home', 'products', 'notFound'] as const)('fails nuqs in the %s page chunk', (name) => {
    expect(evaluateWith(PAGE_MODULES[name], 'node_modules/nuqs/dist/index.js').ok).toBe(false);
  });

  it('fails nuqs in the public layout chunk, which every route loads', () => {
    const report = evaluateWith(PUBLIC_LAYOUT, 'node_modules/nuqs/dist/index.js');
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining('PublicLayout-D3.js) contains node_modules/nuqs')]);
  });

  it('passes the same nuqs module in the URL-state layout chunk, which only the Gallery route loads', () => {
    for (const build of [production, devRoutes]) {
      const report = evaluateWith(URL_STATE_LAYOUT, 'node_modules/nuqs/dist/index.js', build);
      expect(report.errors).toEqual([]);
      expect(report.publicRoutes.gallery).toBe(120_000);
    }
  });

  it('passes nuqs in the Gallery page chunk itself', () => {
    expect(evaluateWith(PAGE_MODULES.gallery, 'node_modules/nuqs/dist/index.js').errors).toEqual([]);
  });

  it('holds nuqs and TanStack Query in the forbidden list (WEB-10, PERF-02)', () => {
    expect(PUBLIC_FORBIDDEN_MODULE_PREFIXES).toEqual(
      expect.arrayContaining(['node_modules/nuqs/', 'node_modules/@tanstack/', 'node_modules/zod/']),
    );
  });
});

describe('evaluateBudgets: the Phase 4 barrel-split trigger (research Flag 4)', () => {
  it('holds the trigger at 135 KB', () => {
    expect(BARREL_SPLIT_TRIGGER).toBe(135_000);
  });

  it('adds a note, not an error, when public JS in the admin-included topology passes 135 KB', () => {
    const report = evaluateBudgets(devRoutesGraph(200_000, 135_100), devRoutes);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.notes).toEqual([expect.stringMatching(/admin-included.*135\.10 KB.*135\.00 KB.*barrel split/)]);
  });

  it('adds no note at exactly 135 KB', () => {
    expect(evaluateBudgets(devRoutesGraph(200_000, 135_000), devRoutes).notes).toEqual([]);
  });

  it('adds no note to the production build, which has no admin routes', () => {
    expect(evaluateBudgets(productionGraph(140_000), production).notes).toEqual([]);
  });
});
