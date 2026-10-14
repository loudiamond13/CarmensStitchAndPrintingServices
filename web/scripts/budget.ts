// PERF-01 bundle budgets (research Pattern 12). Pure evaluation over a chunk graph; vite-budget-plugin.ts builds the
// graph from the real Rolldown bundle and fails the build through this.error when the report is not ok.
//
// - Sizes are gzip level 9 bytes, and 1 KB = 1000 B. A value exactly at its limit passes (<=).
// - Initial JS of a route = closure(entry chunk imports) ∪ closure(route chunk imports): the index.html entry chunk,
//   every route module chunk that route renders, and every chunk they import statically, each counted once. Dynamic
//   imports are not followed; they load later.
// - Module ids and facade ids are paths relative to the web root, with forward slashes (`src/core/routes/...`, `index.html`).

export interface BudgetChunk {
  readonly fileName: string;
  readonly gzipSize: number;
  readonly isEntry: boolean;
  readonly isDynamicEntry: boolean;
  readonly facadeModuleId: string | null;
  /** File names of the chunks this chunk imports statically. */
  readonly imports: readonly string[];
  readonly moduleIds: readonly string[];
}

export interface BudgetAsset {
  readonly fileName: string;
  readonly gzipSize: number;
}

export interface BudgetGraph {
  readonly chunks: readonly BudgetChunk[];
  /** Every emitted file that is not a chunk (CSS, fonts, images, HTML). */
  readonly assets: readonly BudgetAsset[];
}

/**
 * What one build is, decided by its Vite mode and never by an environment flag (D-20, TOOL-CR-01):
 * - `production`: the build that ships. index.html is its only entry and no dev-only module may ship code.
 * - `dev-routes`: the e2e and budget builds. The admin routes are in, and index.html is still the only entry, so the
 *   budgets measure the shipped topology with the admin routes added.
 * - `parity`: the test-only build of `npm run parity`. It also has the parity page (parity.html) as a second entry.
 */
export type BudgetBuild = 'production' | 'dev-routes' | 'parity';

export interface BudgetOptions {
  readonly build: BudgetBuild;
}

/** The HTML entry of the parity page; only the parity build may have it (WEB-02, D-33). */
export const PARITY_ENTRY = 'parity.html';

export type BudgetName = 'publicJs' | 'adminJs' | 'css';

export interface BudgetMeasurement {
  readonly name: BudgetName;
  readonly label: string;
  /** Null when the value could not be measured (a missing route module); the report then has an error. */
  readonly bytes: number | null;
  readonly limit: number;
  readonly files: readonly string[];
}

export interface BudgetReport {
  readonly ok: boolean;
  readonly build: BudgetBuild;
  readonly devRoutes: boolean;
  readonly publicJs: number | null;
  readonly adminJs: number | null;
  readonly css: number | null;
  readonly measurements: readonly BudgetMeasurement[];
  readonly errors: readonly string[];
  readonly notes: readonly string[];
  readonly table: string;
}

/** The PERF-01 limits in gzip bytes (1 KB = 1000 B). Never raise one to make a build pass (docs/web/budgets.md). */
export const BUDGETS = Object.freeze({ publicJs: 150_000, adminJs: 250_000, css: 35_000 });

/**
 * Public initial JS in the admin-included topology (the dev-route builds) above this adds a note, not an error: the
 * Phase 4 trigger for splitting the component barrels (research Flag 4).
 */
export const BARREL_SPLIT_TRIGGER = 135_000;

/** The HTML entry whose chunk every route loads first. */
export const MAIN_ENTRY = 'index.html';

/** The route modules the public site renders on first load: the public layout and the placeholder page (02-29). */
export const PUBLIC_ROUTE: readonly string[] = Object.freeze([
  'src/layouts/PublicLayout.tsx',
  'src/modules/public/pages/PublicPlaceholderPage.tsx',
]);

/** The route modules `/admin` renders on first load: the admin layout, the URL-state layout and the page (02-31). */
export const ADMIN_ROUTE: readonly string[] = Object.freeze([
  'src/layouts/AdminLayout.tsx',
  'src/lib/url-state/UrlStateLayout.tsx',
  'src/modules/admin/pages/AdminPreviewPage.tsx',
]);

/** Module path prefixes that must never reach a production build (D-20, CWE-489). */
export const DEV_ONLY_MODULE_PREFIXES: readonly string[] = Object.freeze([
  'src/modules/admin/',
  'src/layouts/AdminLayout',
  'src/dev/',
  'visual/',
]);

/** Output folders of the parity reference (web/.reference-dist, web/visual/.reference-src); never inside a build (02-13). */
export const REFERENCE_FOLDERS: readonly string[] = Object.freeze(['.reference-dist', '.reference-src']);

const LABELS: Readonly<Record<BudgetName, string>> = { publicJs: 'public JS', adminJs: 'admin JS', css: 'CSS' };

/** Bytes as kilobytes with 1 KB = 1000 B, two decimals. */
export function formatKb(bytes: number): string {
  return `${(bytes / 1000).toFixed(2)} KB`;
}

/**
 * The gzip size of the given chunks plus every chunk they import statically, each counted once.
 * Throws when an import names a chunk the graph does not hold (fail closed).
 */
export function routeInitialSize(
  chunks: readonly BudgetChunk[],
  roots: readonly string[],
): { bytes: number; files: string[] } {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set<string>();
  const pending = [...roots];
  let bytes = 0;
  for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
    if (seen.has(next)) {
      continue;
    }
    const current = byName.get(next);
    if (current === undefined) {
      throw new Error(`budget: the chunk graph has no chunk named ${next}.`);
    }
    seen.add(next);
    bytes += current.gzipSize;
    pending.push(...current.imports);
  }
  return { bytes, files: [...seen] };
}

function measureRoute(
  graph: BudgetGraph,
  entry: BudgetChunk | undefined,
  name: 'publicJs' | 'adminJs',
  modules: readonly string[],
  errors: string[],
): BudgetMeasurement {
  const roots: string[] = [];
  let complete = entry !== undefined;
  if (entry !== undefined) {
    roots.push(entry.fileName);
  }
  for (const module of modules) {
    // Usually the route module is the facade of its own lazy chunk. In the dev-route builds the parity entry imports
    // some route modules statically, so they sit inside a shared chunk; the router's dynamic import then loads that
    // chunk, so it is the route chunk.
    const routeChunk =
      graph.chunks.find((c) => c.facadeModuleId === module) ?? graph.chunks.find((c) => c.moduleIds.includes(module));
    if (routeChunk === undefined) {
      errors.push(`${LABELS[name]}: the route module ${module} has no chunk, so the route cannot be measured.`);
      complete = false;
    } else {
      roots.push(routeChunk.fileName);
    }
  }
  if (!complete) {
    return { name, label: LABELS[name], bytes: null, limit: BUDGETS[name], files: [] };
  }
  try {
    const { bytes, files } = routeInitialSize(graph.chunks, roots);
    return { name, label: LABELS[name], bytes, limit: BUDGETS[name], files };
  } catch (error: unknown) {
    errors.push(`${LABELS[name]}: ${error instanceof Error ? error.message : String(error)}`);
    return { name, label: LABELS[name], bytes: null, limit: BUDGETS[name], files: [] };
  }
}

function renderTable(measurements: readonly BudgetMeasurement[]): string {
  const rows = measurements.map((m) => {
    let result = 'ok';
    if (m.bytes === null) {
      result = 'NOT MEASURED';
    } else if (m.bytes > m.limit) {
      result = 'OVER';
    }
    return [m.label, m.bytes === null ? '—' : formatKb(m.bytes), formatKb(m.limit), result];
  });
  const header = ['Measure', 'Size (gzip -9)', 'Limit', 'Result'];
  const widths = header.map((h, column) => Math.max(h.length, ...rows.map((row) => (row[column] ?? '').length)));
  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(' | ')} |`;
  return [
    'Bundle budgets (PERF-01; 1 KB = 1000 B)',
    line(header),
    line(widths.map((w) => '-'.repeat(w))),
    ...rows.map(line),
  ].join('\n');
}

/** Evaluates the PERF-01 budgets and the build-shape rules over one build's chunk graph. */
export function evaluateBudgets(graph: BudgetGraph, options: BudgetOptions): BudgetReport {
  const errors: string[] = [];
  const notes: string[] = [];

  const entries = graph.chunks.filter((c) => c.isEntry);
  const mainEntries = entries.filter((c) => c.facadeModuleId === MAIN_ENTRY);
  if (mainEntries.length !== 1) {
    errors.push(`The build must have exactly one ${MAIN_ENTRY} entry chunk; found ${String(mainEntries.length)}.`);
  }
  const entry = mainEntries.length === 1 ? mainEntries[0] : undefined;
  const devRoutes = options.build !== 'production';

  // index.html is the only entry of the production, e2e and budget builds; only the parity build adds parity.html.
  const allowedEntries = options.build === 'parity' ? [MAIN_ENTRY, PARITY_ENTRY] : [MAIN_ENTRY];
  for (const extra of entries.filter((c) => c.facadeModuleId === null || !allowedEntries.includes(c.facadeModuleId))) {
    errors.push(
      options.build === 'production'
        ? `The production build has an unexpected entry ${extra.facadeModuleId ?? extra.fileName}.`
        : `The ${options.build} build has an unexpected entry ${extra.facadeModuleId ?? extra.fileName}; only the parity build may add ${PARITY_ENTRY}.`,
    );
  }

  if (options.build === 'production') {
    for (const c of graph.chunks) {
      for (const id of c.moduleIds.filter((m) => DEV_ONLY_MODULE_PREFIXES.some((prefix) => m.startsWith(prefix)))) {
        errors.push(`The production chunk ${c.fileName} contains the dev-only module ${id} (D-20).`);
      }
    }
  }

  // 02-13: the parity reference output never sits inside a build output folder (wwwroot above all).
  for (const fileName of [...graph.chunks, ...graph.assets].map((output) => output.fileName)) {
    if (fileName.split('/').some((segment) => REFERENCE_FOLDERS.includes(segment))) {
      errors.push(`The build emits ${fileName} from a parity reference folder.`);
    }
  }

  const measurements: BudgetMeasurement[] = [measureRoute(graph, entry, 'publicJs', PUBLIC_ROUTE, errors)];
  if (devRoutes) {
    measurements.push(measureRoute(graph, entry, 'adminJs', ADMIN_ROUTE, errors));
  }

  const cssAssets = graph.assets.filter((a) => a.fileName.endsWith('.css'));
  if (cssAssets.length !== 1) {
    errors.push(
      `The build must emit exactly one CSS asset (D-33: a second one means a stray stylesheet import); found ${String(cssAssets.length)}: ${cssAssets.map((a) => a.fileName).join(', ') || 'none'}.`,
    );
  }
  measurements.push({
    name: 'css',
    label: LABELS.css,
    bytes: cssAssets.reduce((sum, a) => sum + a.gzipSize, 0),
    limit: BUDGETS.css,
    files: cssAssets.map((a) => a.fileName),
  });

  for (const m of measurements) {
    if (m.bytes !== null && m.bytes > m.limit) {
      errors.push(`${m.label} is ${formatKb(m.bytes)}, over its ${formatKb(m.limit)} limit.`);
    }
  }

  const publicJs = measurements[0]?.bytes ?? null;
  if (devRoutes && publicJs !== null && publicJs > BARREL_SPLIT_TRIGGER) {
    notes.push(
      `Note: public JS in the admin-included topology is ${formatKb(publicJs)}, past the ${formatKb(BARREL_SPLIT_TRIGGER)} trigger for the Phase 4 barrel split (research Flag 4).`,
    );
  }

  const value = (name: BudgetName): number | null => measurements.find((m) => m.name === name)?.bytes ?? null;
  return {
    ok: errors.length === 0,
    build: options.build,
    devRoutes,
    publicJs: value('publicJs'),
    adminJs: value('adminJs'),
    css: value('css'),
    measurements,
    errors,
    notes,
    table: renderTable(measurements),
  };
}
