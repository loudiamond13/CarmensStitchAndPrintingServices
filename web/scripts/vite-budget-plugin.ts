// PERF-01 budget plugin (research Pattern 12). At the end of generateBundle it turns the real Rolldown bundle into a
// chunk graph (gzip level 9 sizes, web-root-relative module ids), evaluates it with budget.ts, writes the numbers to
// the git-ignored artifacts/budget/ folder and fails the build through this.error with the size table when a limit or
// a build-shape rule is broken. Same fail-closed shape as vite-preload-font-plugin.ts.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Logger, Plugin, Rollup } from 'vite';
import {
  BUDGETS,
  evaluateBudgets,
  REFERENCE_FOLDERS,
  type BudgetBuild,
  type BudgetGraph,
  type BudgetReport,
} from './budget.ts';

export type { BudgetBuild };

export interface BudgetPluginOptions {
  /** What the build is (budget.ts `BudgetBuild`), from its Vite mode only. */
  readonly build: BudgetBuild;
  /** Where budget.json is written; defaults to `<repo>/artifacts/budget` (the web root's parent). */
  readonly reportDir?: string;
}

/** What the plugin exposes on `plugin.api`, so tests can check how vite.config.ts wired it. */
export interface BudgetPluginApi {
  readonly build: BudgetBuild;
}

function gzipBytes(content: string | Uint8Array): number {
  return gzipSync(content, { level: 9 }).length;
}

/** A module id as a web-root-relative posix path; ids outside the root (or virtual ids) only lose their query. */
function relativeId(id: string, root: string): string {
  const posix = (id.split('?')[0] ?? id).replaceAll('\\', '/');
  const prefix = `${root.replaceAll('\\', '/').replace(/\/$/, '')}/`;
  return posix.toLowerCase().startsWith(prefix.toLowerCase()) ? posix.slice(prefix.length) : posix;
}

/** The chunk graph of one build, as budget.ts measures it. */
export function toBudgetGraph(bundle: Rollup.OutputBundle, root: string): BudgetGraph {
  const chunks: BudgetGraph['chunks'][number][] = [];
  const assets: BudgetGraph['assets'][number][] = [];
  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') {
      chunks.push({
        fileName: output.fileName,
        gzipSize: gzipBytes(output.code),
        isEntry: output.isEntry,
        isDynamicEntry: output.isDynamicEntry,
        facadeModuleId: output.facadeModuleId === null ? null : relativeId(output.facadeModuleId, root),
        imports: output.imports,
        // Only modules that ship code: Rolldown also lists modules tree-shaken to nothing (renderedLength 0), such as
        // src/modules/admin/routes.tsx behind the production build's literal-false __DEV_ROUTES__.
        moduleIds: output.moduleIds
          .filter((id) => (output.modules[id]?.renderedLength ?? 1) > 0)
          .map((id) => relativeId(id, root)),
      });
    } else {
      assets.push({ fileName: output.fileName, gzipSize: gzipBytes(output.source) });
    }
  }
  return { chunks, assets };
}

function writeReport(reportDir: string, mode: string, report: BudgetReport): void {
  const summary = {
    mode,
    build: report.build,
    devRoutes: report.devRoutes,
    limits: BUDGETS,
    publicJs: report.publicJs,
    adminJs: report.adminJs,
    css: report.css,
    measurements: report.measurements,
    errors: report.errors,
    notes: report.notes,
  };
  const text = `${JSON.stringify(summary, null, 2)}\n`;
  mkdirSync(reportDir, { recursive: true });
  // budget.json is the latest build; budget.<mode>.json keeps each mode's numbers (verify builds two modes).
  writeFileSync(path.join(reportDir, 'budget.json'), text);
  writeFileSync(path.join(reportDir, `budget.${mode}.json`), text);
}

export function budgetPlugin(options: BudgetPluginOptions): Plugin {
  const api: BudgetPluginApi = { build: options.build };
  let root = process.cwd();
  let mode = 'production';
  let outDir = '';
  let logger: Pick<Logger, 'info'> | undefined;
  return {
    name: 'csps-budget',
    apply: 'build',
    api,
    configResolved(config) {
      root = config.root;
      mode = config.mode;
      outDir = path.resolve(config.root, config.build.outDir);
      logger = config.logger;
    },
    generateBundle: {
      // After every other plugin has emitted and rewritten its output, so the sizes are the shipped bytes.
      order: 'post',
      handler(_outputOptions, bundle) {
        const report = evaluateBudgets(toBudgetGraph(bundle, root), { build: options.build });
        writeReport(options.reportDir ?? path.resolve(root, '..', 'artifacts', 'budget'), mode, report);
        if (!report.ok) {
          return this.error(
            `budgetPlugin: the build broke a budget rule.\n${report.table}\n${report.errors.join('\n')}`,
          );
        }
        logger?.info(`\n${report.table}${report.notes.length > 0 ? `\n${report.notes.join('\n')}` : ''}`);
        return undefined;
      },
    },
    writeBundle() {
      // 02-13: the production web root (wwwroot) never holds the parity reference build or its extracted spec code.
      if (options.build !== 'production') {
        return undefined;
      }
      const found = REFERENCE_FOLDERS.filter((name) => existsSync(path.join(outDir, name)));
      if (found.length > 0) {
        return this.error(
          `budgetPlugin: the web root ${outDir} holds ${found.join(' and ')} (parity reference output).`,
        );
      }
      return undefined;
    },
  };
}
