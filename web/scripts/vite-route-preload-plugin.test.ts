// @vitest-environment node
// PERF-02 (plan 02-35): the production build adds `<link rel="modulepreload">` for the lazy public route chunks and the
// chunks they import (never the entry), so a phone fetches them with the entry script; the first Lighthouse run had
// them one round trip later and missed LCP < 2000 ms. The build fails closed when a route module has no chunk.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadConfigFromFile,
  type HtmlTagDescriptor,
  type IndexHtmlTransformContext,
  type IndexHtmlTransformHook,
  type Plugin,
  type Rollup,
  type UserConfig,
} from 'vite';
import { PUBLIC_ROUTE } from './budget.ts';
import { routePreloadPlugin } from './vite-route-preload-plugin.ts';

const ROOT = 'C:/Work/web';
const webDir = fileURLToPath(new URL('../', import.meta.url));

type PluginOption = NonNullable<UserConfig['plugins']>[number];
type HookThis = ThisParameterType<IndexHtmlTransformHook>;

function chunk(
  fileName: string,
  extra: { isEntry?: boolean; facadeModuleId?: string | null; imports?: string[] } = {},
): Rollup.OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code: '',
    isEntry: extra.isEntry ?? false,
    isDynamicEntry: extra.facadeModuleId !== undefined && extra.isEntry !== true,
    facadeModuleId: extra.facadeModuleId ?? null,
    imports: extra.imports ?? [],
    dynamicImports: [],
    moduleIds: [],
    modules: {},
  } as unknown as Rollup.OutputChunk;
}

function bundleOf(...outputs: (Rollup.OutputChunk | Rollup.OutputAsset)[]): Rollup.OutputBundle {
  return Object.fromEntries(outputs.map((output) => [output.fileName, output]));
}

/** The production shape: the entry, the lazy holding page chunk (it imports a shared chunk), the CSS. */
function productionBundle(): Rollup.OutputBundle {
  return bundleOf(
    chunk('assets/index-A1.js', { isEntry: true, facadeModuleId: `${ROOT}/index.html` }),
    chunk('assets/shared-C3.js', { imports: ['assets/index-A1.js'] }),
    chunk('assets/HoldingPage-D4.js', {
      facadeModuleId: `${ROOT}/src/modules/public/pages/HoldingPage.tsx`,
      imports: ['assets/index-A1.js', 'assets/shared-C3.js'],
    }),
    { type: 'asset', fileName: 'assets/index-E5.css', source: '' } as unknown as Rollup.OutputAsset,
  );
}

function handlerOf(plugin: Plugin): IndexHtmlTransformHook {
  const hook = plugin.transformIndexHtml;
  if (hook === undefined) {
    throw new Error('transformIndexHtml is missing');
  }
  return typeof hook === 'function' ? hook : hook.handler;
}

/** A plugin context whose error() throws, the way Rolldown aborts the build. */
const pluginContext = {
  error(error: string | { message: string }): never {
    throw new Error(typeof error === 'string' ? error : error.message);
  },
} as unknown as HookThis;

/** Resolves the plugin's config (base and root), then runs its HTML hook over the bundle. */
async function run(
  plugin: Plugin,
  bundle: Rollup.OutputBundle | undefined,
  config: { base: string; root: string } = { base: '/', root: ROOT },
): Promise<HtmlTagDescriptor[]> {
  const configResolved = plugin.configResolved;
  const apply = typeof configResolved === 'function' ? configResolved : configResolved?.handler;
  await apply?.call(pluginContext, config as never);
  const context: IndexHtmlTransformContext = { path: '/index.html', filename: 'index.html' };
  if (bundle !== undefined) {
    context.bundle = bundle;
  }
  const result: unknown = await handlerOf(plugin).call(pluginContext, '<html><head></head></html>', context);
  return Array.isArray(result) ? (result as HtmlTagDescriptor[]) : [];
}

function preload(href: string): HtmlTagDescriptor {
  return { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href }, injectTo: 'head' };
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

describe('routePreloadPlugin (PERF-02)', () => {
  it('applies to builds only and runs after the HTML is built, when the chunks are known', () => {
    const plugin = routePreloadPlugin(PUBLIC_ROUTE);
    expect(plugin.apply).toBe('build');
    const hook = plugin.transformIndexHtml;
    expect(typeof hook === 'object' ? hook.order : undefined).toBe('post');
  });

  it('preloads each route chunk and the chunks it imports, once each, in route order, never the entry', async () => {
    expect(await run(routePreloadPlugin(PUBLIC_ROUTE), productionBundle())).toEqual([
      preload('/assets/HoldingPage-D4.js'),
      preload('/assets/shared-C3.js'),
    ]);
  });

  it('matches route modules by their web-root-relative path, with Windows separators too', async () => {
    const bundle = bundleOf(
      chunk('assets/index-A1.js', { isEntry: true }),
      chunk('assets/PublicLayout-B2.js', { facadeModuleId: 'C:\\Work\\web\\src\\layouts\\PublicLayout.tsx' }),
    );
    expect(await run(routePreloadPlugin(['src/layouts/PublicLayout.tsx']), bundle)).toEqual([
      preload('/assets/PublicLayout-B2.js'),
    ]);
  });

  it('prefixes the configured base path', async () => {
    const tags = await run(routePreloadPlugin(PUBLIC_ROUTE), productionBundle(), { base: '/app/', root: ROOT });
    expect(tags[0]?.attrs?.href).toBe('/app/assets/HoldingPage-D4.js');
  });

  it('fails the build through this.error, naming the module, when a route module has no chunk of its own', async () => {
    const bundle = bundleOf(chunk('assets/index-A1.js', { isEntry: true }));
    await expect(run(routePreloadPlugin(PUBLIC_ROUTE), bundle)).rejects.toThrow(
      /src\/modules\/public\/pages\/HoldingPage\.tsx/,
    );
  });

  it('fails when the hook runs without a bundle', async () => {
    await expect(run(routePreloadPlugin(PUBLIC_ROUTE), undefined)).rejects.toThrow(/bundle/);
  });
});

describe('vite.config.ts (PERF-02)', () => {
  const pluginsFor = async (mode: string): Promise<Plugin[]> => {
    const loaded = await loadConfigFromFile({ command: 'build', mode }, `${webDir}vite.config.ts`, webDir, 'silent');
    return flattenPlugins(loaded?.config.plugins ?? []);
  };

  it('registers the route preload in the production build', async () => {
    expect((await pluginsFor('production')).some((plugin) => plugin.name === 'csps-route-preload')).toBe(true);
  });

  it('leaves it out of the dev-route builds, where the route modules share chunks with no facade', async () => {
    expect((await pluginsFor('budget')).some((plugin) => plugin.name === 'csps-route-preload')).toBe(false);
    expect((await pluginsFor('e2e')).some((plugin) => plugin.name === 'csps-route-preload')).toBe(false);
  });
});
