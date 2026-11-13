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
import { barlowNoPesoPlugin, preloadFontPlugin, woff2OnlyPlugin } from './vite-preload-font-plugin.ts';

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
    expect(await transform(woff2OnlyPlugin(), FONTSOURCE_CSS, 'C:/Work/web/src/ui/app.css')).toBeNull();
    expect(await transform(woff2OnlyPlugin(), FONTSOURCE_CSS, 'C:/Work/web/node_modules/other/800.css')).toBeNull();
  });

  it('fails the build when a Fontsource face would still ship a non-woff2 file', async () => {
    const css = "src: url(./files/a.ttf) format('truetype');";
    await expect(transform(woff2OnlyPlugin(), css, FONTSOURCE_ID)).rejects.toThrow(/woff2/);
  });
});

// D-28, D-46 (plan 11-36): Barlow Condensed has no peso sign in any subset (cmap checked), yet a peso in display text made the
// browser download its latin-ext files, which only list U+20B1 in their unicode-range. Taking U+20B1 out of the Barlow ranges
// drops those requests; the peso still falls through to Archivo Variable exactly as before, so the look is unchanged.
const BARLOW_ID = 'C:/Work/web/node_modules/@fontsource/barlow-condensed/700.css';
const LATIN_EXT_RANGE =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (range: string): string =>
  [
    '@font-face {',
    "  font-family: 'Barlow Condensed';",
    "  src: url(./files/b.woff2) format('woff2');",
    `  unicode-range: ${range};`,
    '}',
  ].join('\n');

describe('barlowNoPesoPlugin (D-28)', () => {
  it('runs before the Vite CSS pipeline, in every mode', () => {
    const plugin = barlowNoPesoPlugin();
    expect(plugin.name).toBe('csps-barlow-no-peso');
    expect(plugin.enforce).toBe('pre');
    expect(plugin.apply).toBeUndefined();
  });

  it('splits the latin-ext range around U+20B1 and changes nothing else', async () => {
    const result = await transform(barlowNoPesoPlugin(), face(LATIN_EXT_RANGE), BARLOW_ID);
    expect(result).toBe(face(LATIN_EXT_RANGE.replace('U+20AD-20C0', 'U+20AD-20B0,U+20B2-20C0')));
    expect(result).not.toMatch(/U\+20AD-20C0/);
  });

  it.each([
    ['a lone U+20B1', 'U+0100,U+20B1,U+2113', 'U+0100,U+2113'],
    ['a range that starts at U+20B1', 'U+20B1-20C0', 'U+20B2-20C0'],
    ['a range that ends at U+20B1', 'U+20A0-20B1', 'U+20A0-20B0'],
    ['a range that does not reach it', 'U+20A0-20B0,U+20B2-20C0', 'U+20A0-20B0,U+20B2-20C0'],
  ])('handles %s', async (_name, range, expected) => {
    const result = await transform(barlowNoPesoPlugin(), `unicode-range: ${range};`, BARLOW_ID);
    expect(result ?? `unicode-range: ${range};`).toBe(`unicode-range: ${expected};`);
  });

  it('fails the build when a face lists only U+20B1, because an empty range would make the face cover every character', async () => {
    await expect(transform(barlowNoPesoPlugin(), 'unicode-range: U+20B1-20B1;', BARLOW_ID)).rejects.toThrow(
      /lists only U\+20B1/,
    );
    await expect(transform(barlowNoPesoPlugin(), 'unicode-range: U+20B1;', BARLOW_ID)).rejects.toThrow(
      /lists only U\+20B1/,
    );
  });

  it('leaves the latin face, which never listed U+20B1, untouched', async () => {
    expect(await transform(barlowNoPesoPlugin(), face(LATIN_RANGE), BARLOW_ID)).toBeNull();
  });

  it('changes every face of a stylesheet, on Windows paths too', async () => {
    const css = `${face(LATIN_RANGE)}\n${face(LATIN_EXT_RANGE)}\n${face(LATIN_EXT_RANGE)}`;
    const id = 'C:\\Work\\web\\node_modules\\@fontsource\\barlow-condensed\\800-italic.css?used';
    const result = await transform(barlowNoPesoPlugin(), css, id);
    expect(result?.match(/U\+20AD-20B0,U\+20B2-20C0/g)).toHaveLength(2);
    expect(result).not.toMatch(/U\+20AD-20C0/);
  });

  it('never touches Archivo, whose latin-ext file does draw the peso, or any other stylesheet', async () => {
    const archivo = 'C:/Work/web/node_modules/@fontsource-variable/archivo/index.css';
    expect(await transform(barlowNoPesoPlugin(), face(LATIN_EXT_RANGE), archivo)).toBeNull();
    expect(await transform(barlowNoPesoPlugin(), face(LATIN_EXT_RANGE), 'C:/Work/web/src/ui/app.css')).toBeNull();
    expect(
      await transform(
        barlowNoPesoPlugin(),
        face(LATIN_EXT_RANGE),
        'C:/Work/web/node_modules/other/barlow-condensed/x.css',
      ),
    ).toBeNull();
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

  it('registers the Barlow peso plugin in every build mode', async () => {
    for (const mode of ['production', 'e2e', 'parity']) {
      const loaded = await loadConfigFromFile({ command: 'build', mode }, `${webDir}vite.config.ts`, webDir, 'silent');
      const names = (await flattenPlugins(loaded?.config.plugins ?? [])).map((plugin) => plugin.name);
      expect(names, mode).toContain('csps-barlow-no-peso');
    }
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
