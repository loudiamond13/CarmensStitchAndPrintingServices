// PERF-01 bundle budgets (research Pattern 12). Pure evaluation over a chunk graph; vite-budget-plugin.ts builds the
// graph from the real Rolldown bundle and fails the build through this.error when the report is not ok.
//
// - Sizes are gzip level 9 bytes, and 1 KB = 1000 B. A value exactly at its limit passes (<=).
// - Initial JS of a route = closure(entry chunk imports) ∪ closure(route chunk imports): the index.html entry chunk,
//   every route module chunk that route renders, and every chunk they import statically, each counted once. Dynamic
//   imports are not followed; they load later.
// - Module ids and facade ids are paths relative to the web root, with forward slashes (`src/app/...`, `index.html`).

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

export interface BudgetOptions {
  /** True for builds with the dev-only routes (development, e2e, budget, parity): the admin route is measured too. */
  readonly devRoutes: boolean;
}

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

/** The HTML entry whose chunk every route loads first. */
export const MAIN_ENTRY = 'index.html';

/** The route modules the public site renders on first load: the public layout and the placeholder page (02-29). */
export const PUBLIC_ROUTE: readonly string[] = Object.freeze([
  'src/app/public/PublicLayout.tsx',
  'src/app/public/PublicPlaceholderPage.tsx',
]);

/** The route modules `/admin` renders on first load: the admin layout, the URL-state layout and the page (02-31). */
export const ADMIN_ROUTE: readonly string[] = Object.freeze([
  'src/app/admin/AdminLayout.tsx',
  'src/lib/url-state/UrlStateLayout.tsx',
  'src/app/admin/AdminPreviewPage.tsx',
]);

/** Module path prefixes that must never reach a production build (D-20, CWE-489). */
export const DEV_ONLY_MODULE_PREFIXES: readonly string[] = Object.freeze(['src/app/admin/']);

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

  if (!options.devRoutes) {
    // Production: index.html is the only entry. The parity page (parity.html) exists only in dev-route builds.
    for (const extra of entries.filter((c) => c.facadeModuleId !== MAIN_ENTRY)) {
      errors.push(`The production build has an unexpected entry ${extra.facadeModuleId ?? extra.fileName}.`);
    }
    for (const c of graph.chunks) {
      for (const id of c.moduleIds.filter((m) => DEV_ONLY_MODULE_PREFIXES.some((prefix) => m.startsWith(prefix)))) {
        errors.push(`The production chunk ${c.fileName} contains the dev-only module ${id} (D-20).`);
      }
    }
  }

  const measurements: BudgetMeasurement[] = [measureRoute(graph, entry, 'publicJs', PUBLIC_ROUTE, errors)];
  if (options.devRoutes) {
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

  const value = (name: BudgetName): number | null => measurements.find((m) => m.name === name)?.bytes ?? null;
  return {
    ok: errors.length === 0,
    devRoutes: options.devRoutes,
    publicJs: value('publicJs'),
    adminJs: value('adminJs'),
    css: value('css'),
    measurements,
    errors,
    notes,
    table: renderTable(measurements),
  };
}
