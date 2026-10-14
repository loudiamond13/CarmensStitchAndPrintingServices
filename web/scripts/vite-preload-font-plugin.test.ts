// @vitest-environment node
// PERF-05: the production build preloads exactly one self-hosted woff2 (the hashed Archivo latin file) and fails
// closed through this.error when the match is missing or ambiguous (research Pattern 14).
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
import { preloadFontPlugin, woff2OnlyPlugin } from './vite-preload-font-plugin.ts';

const PATTERN = /archivo-latin-wght-normal-.*\.woff2$/;
const webDir = fileURLToPath(new URL('../', import.meta.url));

type PluginOption = NonNullable<UserConfig['plugins']>[number];
type HookThis = ThisParameterType<IndexHtmlTransformHook>;

function asset(fileName: string): Rollup.OutputAsset {
  return { type: 'asset', fileName, source: new Uint8Array() } as unknown as Rollup.OutputAsset;
}

function bundleOf(...fileNames: string[]): Rollup.OutputBundle {
  return Object.fromEntries(fileNames.map((fileName) => [fileName, asset(fileName)]));
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

async function run(plugin: Plugin, bundle: Rollup.OutputBundle | undefined): Promise<HtmlTagDescriptor[]> {
  const context: IndexHtmlTransformContext = { path: '/index.html', filename: 'index.html' };
  if (bundle !== undefined) {
    context.bundle = bundle;
  }
  const result: unknown = await handlerOf(plugin).call(pluginContext, '<html><head></head></html>', context);
  return Array.isArray(result) ? (result as HtmlTagDescriptor[]) : [];
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

describe('preloadFontPlugin (PERF-05)', () => {
  it('applies to builds only', () => {
    expect(preloadFontPlugin(PATTERN).apply).toBe('build');
  });

  it('runs after the HTML is built, when the hashed bundle is known', () => {
    const hook = preloadFontPlugin(PATTERN).transformIndexHtml;
    expect(typeof hook === 'object' ? hook.order : undefined).toBe('post');
  });

  it('injects one crossorigin woff2 font preload for the matching asset into head', async () => {
    const bundle = bundleOf(
      'assets/index-Xy12.js',
      'assets/index-Ab34.css',
      'assets/archivo-latin-ext-wght-normal-Zz99.woff2',
      'assets/archivo-latin-wght-normal-AbC123.woff2',
      'assets/barlow-condensed-latin-800-normal-Qq11.woff2',
    );
    expect(await run(preloadFontPlugin(PATTERN), bundle)).toEqual([
      {
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/assets/archivo-latin-wght-normal-AbC123.woff2',
          crossorigin: true,
        },
        injectTo: 'head',
      },
    ]);
  });

  it('prefixes the configured base path', async () => {
    const plugin = preloadFontPlugin(PATTERN);
    const configResolved = plugin.configResolved;
    const apply = typeof configResolved === 'function' ? configResolved : configResolved?.handler;
    expect(apply).toBeTypeOf('function');
    await apply?.call(pluginContext, { base: '/app/' } as never);
    const tags = await run(plugin, bundleOf('assets/archivo-latin-wght-normal-AbC123.woff2'));
    expect(tags[0]?.attrs?.href).toBe('/app/assets/archivo-latin-wght-normal-AbC123.woff2');
  });

  it('fails the build through this.error, naming the pattern, when no asset matches', async () => {
    await expect(run(preloadFontPlugin(PATTERN), bundleOf('assets/index-Xy12.js'))).rejects.toThrow(PATTERN.source);
  });

  it('fails the build when more than one asset matches, so exactly one link is ever injected', async () => {
    const bundle = bundleOf('assets/archivo-latin-wght-normal-A1.woff2', 'assets/archivo-latin-wght-normal-B2.woff2');
    await expect(run(preloadFontPlugin(PATTERN), bundle)).rejects.toThrow(/more than one/);
  });

  it('fails when the hook runs without a bundle', async () => {
    await expect(run(preloadFontPlugin(PATTERN), undefined)).rejects.toThrow(/bundle/);
  });
});

const FONTSOURCE_ID = 'C:/Work/web/node_modules/@fontsource/barlow-condensed/800.css';
const FONTSOURCE_CSS = [
  '@font-face {',
  "  font-family: 'Barlow Condensed';",
  "  src: url(./files/barlow-condensed-latin-800-normal.woff2) format('woff2'), url(./files/barlow-condensed-latin-800-normal.woff) format('woff');",
  '}',
  '@font-face {',
  "  font-family: 'Barlow Condensed';",
  "  src: url(./files/barlow-condensed-latin-ext-800-normal.woff2) format('woff2'), url(./files/barlow-condensed-latin-ext-800-normal.woff) format('woff');",
  '}',
].join('\n');

async function transform(plugin: Plugin, code: string, id: string): Promise<string | null> {
  const hook = plugin.transform;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (handler === undefined) {
    throw new Error('transform is missing');
  }
  const result: unknown = await handler.call(pluginContext as never, code, id);
  if (result === null || result === undefined) {
    return null;
  }
  return typeof result === 'string' ? result : ((result as { code?: string }).code ?? null);
}

describe('woff2OnlyPlugin (PERF-05)', () => {
  it('runs before the Vite CSS pipeline, so the dropped files are never emitted', () => {
    expect(woff2OnlyPlugin().enforce).toBe('pre');
  });

  it('drops the legacy .woff fallback from a Fontsource stylesheet and keeps every woff2 source', async () => {
    const result = await transform(woff2OnlyPlugin(), FONTSOURCE_CSS, FONTSOURCE_ID);
    expect(result).toBe(
      [
        '@font-face {',
        "  font-family: 'Barlow Condensed';",
        "  src: url(./files/barlow-condensed-latin-800-normal.woff2) format('woff2');",
        '}',
        '@font-face {',
        "  font-family: 'Barlow Condensed';",
        "  src: url(./files/barlow-condensed-latin-ext-800-normal.woff2) format('woff2');",
        '}',
      ].join('\n'),
    );
  });

  it('handles Windows paths and the @fontsource-variable scope', async () => {
    const css = "src: url(./files/a.woff2) format('woff2'), url(./files/a.woff) format('woff');";
    const id = 'C:\\Work\\web\\node_modules\\@fontsource-variable\\archivo\\index.css';
    expect(await transform(woff2OnlyPlugin(), css, id)).toBe("src: url(./files/a.woff2) format('woff2');");
  });

  it('leaves files outside the Fontsource packages untouched', async () => {
    expect(await transform(woff2OnlyPlugin(), FONTSOURCE_CSS, 'C:/Work/web/src/styles/app.css')).toBeNull();
    expect(await transform(woff2OnlyPlugin(), FONTSOURCE_CSS, 'C:/Work/web/node_modules/other/800.css')).toBeNull();
  });

  it('fails the build when a Fontsource face would still ship a non-woff2 file', async () => {
    const css = "src: url(./files/a.ttf) format('truetype');";
    await expect(transform(woff2OnlyPlugin(), css, FONTSOURCE_ID)).rejects.toThrow(/woff2/);
  });
});

describe('vite.config.ts (PERF-05)', () => {
  const productionPlugins = async (): Promise<Plugin[]> => {
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      `${webDir}vite.config.ts`,
      webDir,
      'silent',
    );
    return flattenPlugins(loaded?.config.plugins ?? []);
  };

  it('registers the woff2-only plugin for the Fontsource stylesheets', async () => {
    const woff2Only = (await productionPlugins()).find((plugin) => plugin.name === 'csps-woff2-only');
    expect(woff2Only).toBeDefined();
  });

  it('registers the preload plugin for the Archivo latin woff2 only', async () => {
    const preload = (await productionPlugins()).find((plugin) => plugin.name === 'csps-preload-font');
    expect(preload).toBeDefined();
    if (preload === undefined) {
      return;
    }
    const tags = await run(
      preload,
      bundleOf('assets/archivo-latin-ext-wght-normal-Zz99.woff2', 'assets/archivo-latin-wght-normal-AbC123.woff2'),
    );
    expect(tags.map((tag) => tag.attrs?.href)).toEqual(['/assets/archivo-latin-wght-normal-AbC123.woff2']);
  });
});
