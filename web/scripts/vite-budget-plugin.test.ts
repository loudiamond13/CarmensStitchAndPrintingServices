// @vitest-environment node
// PERF-01: the budget plugin measures the real Rolldown bundle in generateBundle (gzip level 9), writes the numbers to
// artifacts/budget/ and fails the build through this.error with the size table when a limit is crossed.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfigFromFile, type Plugin, type ResolvedConfig, type Rollup, type UserConfig } from 'vite';
import { budgetPlugin, type BudgetPluginApi } from './vite-budget-plugin.ts';

type PluginOption = NonNullable<UserConfig['plugins']>[number];

const webDir = fileURLToPath(new URL('../', import.meta.url));
const ROOT = 'C:/Work/app/web';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'csps-budget-'));
  temporaryDirectories.push(directory);
  return directory;
}

/** Text whose gzip size is close to its length (random base64 barely compresses). */
function incompressible(length: number): string {
  return randomBytes(length).toString('base64').slice(0, length);
}

function outputChunk(
  fileName: string,
  code: string,
  extra: {
    isEntry?: boolean;
    isDynamicEntry?: boolean;
    facadeModuleId?: string | null;
    imports?: string[];
    moduleIds?: string[];
  },
): Rollup.OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code,
    isEntry: extra.isEntry ?? false,
    isDynamicEntry: extra.isDynamicEntry ?? false,
    facadeModuleId: extra.facadeModuleId ?? null,
    imports: extra.imports ?? [],
    dynamicImports: [],
    moduleIds: extra.moduleIds ?? [],
  } as unknown as Rollup.OutputChunk;
}

function outputAsset(fileName: string, source: string | Uint8Array): Rollup.OutputAsset {
  return { type: 'asset', fileName, source } as unknown as Rollup.OutputAsset;
}

/** A production-shaped bundle with absolute (Windows-style) module ids under ROOT. */
function bundle(entryCode: string): Rollup.OutputBundle {
  const items = [
    outputChunk('assets/index-A1.js', entryCode, {
      isEntry: true,
      facadeModuleId: `${ROOT}/index.html`,
      moduleIds: [`${ROOT}/index.html`, 'C:\\Work\\app\\web\\src\\main.tsx'],
    }),
    outputChunk('assets/PublicLayout-C3.js', 'export const a = 1;', {
      isDynamicEntry: true,
      facadeModuleId: 'C:\\Work\\app\\web\\src\\app\\public\\PublicLayout.tsx',
      moduleIds: ['C:\\Work\\app\\web\\src\\app\\public\\PublicLayout.tsx'],
    }),
    outputChunk('assets/PublicPlaceholderPage-D4.js', 'export const b = 2;', {
      isDynamicEntry: true,
      facadeModuleId: `${ROOT}/src/app/public/PublicPlaceholderPage.tsx?v=1`,
      moduleIds: [`${ROOT}/src/app/public/PublicPlaceholderPage.tsx`],
    }),
    outputAsset('assets/index-E5.css', 'body{color:red}'),
    outputAsset('index.html', '<!doctype html>'),
  ];
  return Object.fromEntries(items.map((item) => [item.fileName, item]));
}

interface Logged {
  readonly info: string[];
}

function resolvedConfig(mode: string, logged: Logged): ResolvedConfig {
  return {
    root: ROOT,
    mode,
    build: { outDir: 'dist' },
    logger: {
      info: (message: string) => logged.info.push(message),
    },
  } as unknown as ResolvedConfig;
}

/** A plugin context whose error() throws, the way Rolldown aborts the build. */
const pluginContext = {
  error(error: string | { message: string }): never {
    throw new Error(typeof error === 'string' ? error : error.message);
  },
};

async function generate(plugin: Plugin, mode: string, output: Rollup.OutputBundle, logged: Logged): Promise<void> {
  const configResolved = plugin.configResolved;
  const applyConfig = typeof configResolved === 'function' ? configResolved : configResolved?.handler;
  await applyConfig?.call(pluginContext as never, resolvedConfig(mode, logged));
  const hook = plugin.generateBundle;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (handler === undefined) {
    throw new Error('generateBundle is missing');
  }
  await handler.call(pluginContext as never, {} as never, output, false);
}

/** Vite's PluginOption nests arrays and promises; flatten it without `.flat(Infinity)` (TS2589, L-27). */
async function flattenPlugins(options: readonly PluginOption[]): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
  for (const option of options) {
    const resolved = await option;
    if (Array.isArray(resolved)) {
      plugins.push(...(await flattenPlugins(resolved)));
    } else if (resolved !== false && resolved !== null && resolved !== undefined) {
      plugins.push(resolved);
    }
  }
  return plugins;
}

describe('budgetPlugin (PERF-01)', () => {
  it('applies to builds only and runs after the other generateBundle hooks', () => {
    const plugin = budgetPlugin({ devRoutes: false });
    expect(plugin.name).toBe('csps-budget');
    expect(plugin.apply).toBe('build');
    const hook = plugin.generateBundle;
    expect(typeof hook === 'object' ? hook.order : undefined).toBe('post');
  });

  it('fails the build through this.error with the size table when public JS is over its limit', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ devRoutes: false, reportDir });
    const logged: Logged = { info: [] };
    const run = generate(plugin, 'production', bundle(incompressible(200_000)), logged);
    await expect(run).rejects.toThrow(/public JS[\s\S]*OVER[\s\S]*150\.00 KB/);
    await expect(run).rejects.toThrow(/CSS/);
  });

  it('writes the JSON summary and logs the table when every value is under its limit', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ devRoutes: false, reportDir });
    const logged: Logged = { info: [] };
    await generate(plugin, 'production', bundle('export const main = 1;'), logged);

    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.json'), 'utf8')) as Record<string, unknown>;
    expect(summary).toMatchObject({
      mode: 'production',
      devRoutes: false,
      limits: { publicJs: 150_000, adminJs: 250_000, css: 35_000 },
      adminJs: null,
      errors: [],
    });
    expect(summary.publicJs).toBeTypeOf('number');
    expect(summary.publicJs).toBeGreaterThan(0);
    expect(summary.css).toBeTypeOf('number');
    expect(readFileSync(path.join(reportDir, 'budget.production.json'), 'utf8')).toBe(
      readFileSync(path.join(reportDir, 'budget.json'), 'utf8'),
    );
    expect(logged.info.join('\n')).toContain('public JS');
  });

  it('writes the JSON summary before failing, so an over-budget build still leaves its numbers', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ devRoutes: false, reportDir });
    await expect(generate(plugin, 'production', bundle(incompressible(200_000)), { info: [] })).rejects.toThrow();
    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.json'), 'utf8')) as { errors: string[] };
    expect(summary.errors).toHaveLength(1);
  });
});

describe('vite.config.ts (PERF-01)', () => {
  const pluginsFor = async (mode: string): Promise<Plugin[]> => {
    const loaded = await loadConfigFromFile({ command: 'build', mode }, `${webDir}vite.config.ts`, webDir, 'silent');
    return flattenPlugins(loaded?.config.plugins ?? []);
  };

  it('registers the budget plugin without dev routes for the production build', async () => {
    const plugin = (await pluginsFor('production')).find((p) => p.name === 'csps-budget');
    expect((plugin?.api as BudgetPluginApi | undefined)?.devRoutes).toBe(false);
  });

  it('registers the budget plugin with dev routes for the budget build', async () => {
    const plugin = (await pluginsFor('budget')).find((p) => p.name === 'csps-budget');
    expect((plugin?.api as BudgetPluginApi | undefined)?.devRoutes).toBe(true);
  });
});
