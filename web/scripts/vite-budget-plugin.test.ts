// @vitest-environment node
// PERF-01: the budget plugin measures the real Rolldown bundle in generateBundle (gzip level 9), writes the numbers to
// artifacts/budget/ and fails the build through this.error with the size table when a limit is crossed.
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

/** Random base64 text: it gzips to about 3/4 of its length (6 bits of entropy per character). */
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
    /** Rendered code length per module id (default 10); 0 means tree-shaken to nothing. */
    rendered?: Record<string, number>;
  },
): Rollup.OutputChunk {
  const moduleIds = extra.moduleIds ?? [];
  return {
    type: 'chunk',
    fileName,
    code,
    isEntry: extra.isEntry ?? false,
    isDynamicEntry: extra.isDynamicEntry ?? false,
    facadeModuleId: extra.facadeModuleId ?? null,
    imports: extra.imports ?? [],
    dynamicImports: [],
    moduleIds,
    modules: Object.fromEntries(moduleIds.map((id) => [id, { renderedLength: extra.rendered?.[id] ?? 10 }])),
  } as unknown as Rollup.OutputChunk;
}

function outputAsset(fileName: string, source: string | Uint8Array): Rollup.OutputAsset {
  return { type: 'asset', fileName, source } as unknown as Rollup.OutputAsset;
}

/** The guarded admin app's first-load chunks, which ship in every build: the signed-in and the sign-in entries. */
function adminChunks(): Rollup.OutputChunk[] {
  const lazy = (fileName: string, relative: string): Rollup.OutputChunk =>
    outputChunk(fileName, 'export const a = 1;', {
      isDynamicEntry: true,
      facadeModuleId: `${ROOT}/${relative}`,
      moduleIds: [`${ROOT}/${relative}`],
    });
  return [
    lazy('assets/AdminLayout-H8.js', 'src/layouts/AdminLayout.tsx'),
    lazy('assets/UrlStateLayout-I9.js', 'src/lib/url-state/UrlStateLayout.tsx'),
    lazy('assets/SessionsPage-J1.js', 'src/modules/admin/pages/SessionsPage.tsx'),
    lazy('assets/guard-K2.js', 'src/modules/admin/guard.ts'),
    lazy('assets/AuthLayout-L3.js', 'src/layouts/AuthLayout.tsx'),
    lazy('assets/SignInPage-M4.js', 'src/modules/admin/pages/SignInPage.tsx'),
  ];
}

/** A production-shaped bundle with absolute (Windows-style) module ids under ROOT. */
function bundle(entryCode: string, entryModules: Record<string, number> = {}): Rollup.OutputBundle {
  const items = [
    outputChunk('assets/index-A1.js', entryCode, {
      isEntry: true,
      facadeModuleId: `${ROOT}/index.html`,
      moduleIds: [`${ROOT}/index.html`, 'C:\\Work\\app\\web\\src\\main.tsx', ...Object.keys(entryModules)],
      rendered: entryModules,
    }),
    outputChunk('assets/PublicLayout-C3.js', 'export const a = 1;', {
      isDynamicEntry: true,
      facadeModuleId: 'C:\\Work\\app\\web\\src\\layouts\\PublicLayout.tsx',
      moduleIds: ['C:\\Work\\app\\web\\src\\layouts\\PublicLayout.tsx'],
    }),
    outputChunk('assets/PublicPlaceholderPage-D4.js', 'export const b = 2;', {
      isDynamicEntry: true,
      facadeModuleId: `${ROOT}/src/modules/public/pages/PublicPlaceholderPage.tsx?v=1`,
      moduleIds: [`${ROOT}/src/modules/public/pages/PublicPlaceholderPage.tsx`],
    }),
    ...adminChunks(),
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
    const plugin = budgetPlugin({ build: 'production' });
    expect(plugin.name).toBe('csps-budget');
    expect(plugin.apply).toBe('build');
    const hook = plugin.generateBundle;
    expect(typeof hook === 'object' ? hook.order : undefined).toBe('post');
  });

  it('fails the build through this.error with the size table when public JS is over its limit', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ build: 'production', reportDir });
    const logged: Logged = { info: [] };
    const run = generate(plugin, 'production', bundle(incompressible(200_000)), logged);
    await expect(run).rejects.toThrow(/public JS[\s\S]*OVER[\s\S]*150\.00 KB/);
    await expect(run).rejects.toThrow(/CSS/);
  });

  it('writes the JSON summary and logs the table when every value is under its limit', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ build: 'production', reportDir });
    const logged: Logged = { info: [] };
    await generate(plugin, 'production', bundle('export const main = 1;'), logged);

    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.json'), 'utf8')) as Record<string, unknown>;
    expect(summary).toMatchObject({
      mode: 'production',
      build: 'production',
      devRoutes: false,
      limits: { publicJs: 150_000, adminJs: 250_000, css: 35_000 },
      errors: [],
    });
    expect(summary.publicJs).toBeTypeOf('number');
    expect(summary.publicJs).toBeGreaterThan(0);
    expect(summary.adminJs).toBeTypeOf('number');
    expect(summary.adminJs).toBeGreaterThan(0);
    expect(summary.css).toBeTypeOf('number');
    expect(readFileSync(path.join(reportDir, 'budget.production.json'), 'utf8')).toBe(
      readFileSync(path.join(reportDir, 'budget.json'), 'utf8'),
    );
    expect(logged.info.join('\n')).toContain('public JS');
  });

  it('writes the JSON summary before failing, so an over-budget build still leaves its numbers', async () => {
    const reportDir = temporaryDirectory();
    const plugin = budgetPlugin({ build: 'production', reportDir });
    await expect(generate(plugin, 'production', bundle(incompressible(200_000)), { info: [] })).rejects.toThrow();
    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.json'), 'utf8')) as { errors: string[] };
    expect(summary.errors).toHaveLength(1);
  });
  it('fails the production build when a shipped admin entry has no chunk (the admin limit must be measurable)', async () => {
    const plugin = budgetPlugin({ build: 'production', reportDir: temporaryDirectory() });
    const output = Object.fromEntries(
      Object.entries(bundle('export const main = 1;')).filter(([name]) => !name.startsWith('assets/SignInPage')),
    );
    await expect(generate(plugin, 'production', output, { info: [] })).rejects.toThrow(
      /admin JS[\s\S]*SignInPage\.tsx/,
    );
  });

  it('ignores a dev-only module that was tree-shaken to nothing (rendered length 0)', async () => {
    const plugin = budgetPlugin({ build: 'production', reportDir: temporaryDirectory() });
    const output = bundle('export const main = 1;', { [`${ROOT}/src/modules/admin/pages/AdminPreviewPage.tsx`]: 0 });
    await expect(generate(plugin, 'production', output, { info: [] })).resolves.toBeUndefined();
  });

  it('lets the guarded admin app ship code in the production build (D-20 reversed in Phase 4)', async () => {
    const plugin = budgetPlugin({ build: 'production', reportDir: temporaryDirectory() });
    const output = bundle('export const main = 1;', { [`${ROOT}/src/modules/admin/routes.tsx`]: 120 });
    await expect(generate(plugin, 'production', output, { info: [] })).resolves.toBeUndefined();
  });

  it('fails the production build when a dev-only module ships code', async () => {
    const plugin = budgetPlugin({ build: 'production', reportDir: temporaryDirectory() });
    const output = bundle('export const main = 1;', {
      [`${ROOT}/src/modules/admin/pages/AdminPreviewPage.tsx`]: 120,
    });
    await expect(generate(plugin, 'production', output, { info: [] })).rejects.toThrow(
      /index-A1\.js contains the dev-only module src\/modules\/admin\/pages\/AdminPreviewPage\.tsx/,
    );
  });
});

const PARITY_ENTRY_CHUNK = outputChunk('assets/parity-P0.js', 'export const p = 0;', {
  isEntry: true,
  facadeModuleId: `${ROOT}/parity.html`,
  moduleIds: [`${ROOT}/parity.html`, `${ROOT}/src/dev/scenarios/index.ts`],
});

/** The e2e/budget-mode bundle: the production bundle plus the dev-only preview page (no parity entry). */
function devRoutesBundle(entryCode: string): Rollup.OutputBundle {
  const items = [
    outputChunk('assets/AdminPreviewPage-J0.js', 'export const v = 3;', {
      isDynamicEntry: true,
      facadeModuleId: `${ROOT}/src/modules/admin/pages/AdminPreviewPage.tsx`,
      moduleIds: [`${ROOT}/src/modules/admin/pages/AdminPreviewPage.tsx`],
    }),
  ];
  return { ...bundle(entryCode), ...Object.fromEntries(items.map((item) => [item.fileName, item])) };
}

async function writeBundleIn(plugin: Plugin, root: string, outDir: string): Promise<void> {
  const configResolved = plugin.configResolved;
  const applyConfig = typeof configResolved === 'function' ? configResolved : configResolved?.handler;
  await applyConfig?.call(
    pluginContext as never,
    {
      root,
      mode: 'production',
      build: { outDir },
      logger: { info: () => undefined },
    } as never,
  );
  const hook = plugin.writeBundle;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (handler === undefined) {
    throw new Error('writeBundle is missing');
  }
  await handler.call(pluginContext as never, {} as never, {});
}

describe('budgetPlugin: the admin topology and the web root (D-20)', () => {
  it('logs the 135 KB barrel-split note through the info logger and still passes', async () => {
    const reportDir = temporaryDirectory();
    const logged: Logged = { info: [] };
    await generate(
      budgetPlugin({ build: 'dev-routes', reportDir }),
      'budget',
      devRoutesBundle(incompressible(185_000)),
      logged,
    );
    expect(logged.info.join('\n')).toMatch(/admin JS[\s\S]*barrel split/);
    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.budget.json'), 'utf8')) as {
      adminJs: number;
      notes: string[];
    };
    expect(summary.adminJs).toBeGreaterThan(0);
    expect(summary.notes).toHaveLength(1);
  });

  it('fails the budget build through this.error when public JS is over its limit', async () => {
    const plugin = budgetPlugin({ build: 'dev-routes', reportDir: temporaryDirectory() });
    await expect(generate(plugin, 'budget', devRoutesBundle(incompressible(200_000)), { info: [] })).rejects.toThrow(
      /public JS[\s\S]*OVER[\s\S]*150\.00 KB/,
    );
  });

  it('fails the budget build when the parity page is one of its entries (it must measure the shipped topology)', async () => {
    const plugin = budgetPlugin({ build: 'dev-routes', reportDir: temporaryDirectory() });
    const output = { ...devRoutesBundle('export const main = 1;'), [PARITY_ENTRY_CHUNK.fileName]: PARITY_ENTRY_CHUNK };
    await expect(generate(plugin, 'budget', output, { info: [] })).rejects.toThrow(/unexpected entry parity\.html/);
  });

  it('lets the parity build have the parity page as its second entry', async () => {
    const reportDir = temporaryDirectory();
    const output = { ...devRoutesBundle('export const main = 1;'), [PARITY_ENTRY_CHUNK.fileName]: PARITY_ENTRY_CHUNK };
    await generate(budgetPlugin({ build: 'parity', reportDir }), 'parity', output, { info: [] });
    const summary = JSON.parse(readFileSync(path.join(reportDir, 'budget.parity.json'), 'utf8')) as {
      build: string;
      errors: string[];
    };
    expect(summary).toMatchObject({ build: 'parity', errors: [] });
  });

  it.each([['.reference-dist'], ['.reference-src']])(
    'fails the production build when the web root holds %s after writing',
    async (name) => {
      const root = temporaryDirectory();
      mkdirSync(path.join(root, 'out', name), { recursive: true });
      await expect(writeBundleIn(budgetPlugin({ build: 'production' }), root, 'out')).rejects.toThrow(name);
    },
  );

  it('passes when the production web root holds neither reference folder', async () => {
    const root = temporaryDirectory();
    mkdirSync(path.join(root, 'out', 'assets'), { recursive: true });
    await expect(writeBundleIn(budgetPlugin({ build: 'production' }), root, 'out')).resolves.toBeUndefined();
  });
});

describe('vite.config.ts (PERF-01)', () => {
  const pluginsFor = async (mode: string): Promise<Plugin[]> => {
    const loaded = await loadConfigFromFile({ command: 'build', mode }, `${webDir}vite.config.ts`, webDir, 'silent');
    return flattenPlugins(loaded?.config.plugins ?? []);
  };

  it.each([
    ['production', 'production'],
    ['budget', 'dev-routes'],
    ['e2e', 'dev-routes'],
    ['parity', 'parity'],
  ])('registers the budget plugin for the %s mode as the %s build', async (mode, build) => {
    const plugin = (await pluginsFor(mode)).find((p) => p.name === 'csps-budget');
    expect((plugin?.api as BudgetPluginApi | undefined)?.build).toBe(build);
  });
});
