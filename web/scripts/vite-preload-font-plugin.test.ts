// @vitest-environment node
// PERF-05: the production build preloads exactly one self-hosted woff2 (the hashed Archivo latin file) and fails
// closed when it is missing (research Pattern 14).
import { describe, expect, it } from 'vitest';
import type { HtmlTagDescriptor, IndexHtmlTransformContext, IndexHtmlTransformHook, Plugin, Rollup } from 'vite';
import { preloadFontPlugin } from './vite-preload-font-plugin.ts';

const PATTERN = /archivo-latin-wght-normal-.*\.woff2$/;

function asset(fileName: string): Rollup.OutputAsset {
  return {
    type: 'asset',
    fileName,
    name: undefined,
    names: [],
    originalFileName: null,
    originalFileNames: [],
    needsCodeReference: false,
    source: new Uint8Array(),
  } as unknown as Rollup.OutputAsset;
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

async function run(plugin: Plugin, bundle: Rollup.OutputBundle | undefined): Promise<HtmlTagDescriptor[]> {
  const context: IndexHtmlTransformContext = { path: '/index.html', filename: 'index.html' };
  if (bundle !== undefined) {
    context.bundle = bundle;
  }
  const result: unknown = await handlerOf(plugin).call(undefined as never, '<html><head></head></html>', context);
  if (!Array.isArray(result)) {
    throw new Error('expected an array of tag descriptors');
  }
  return result as HtmlTagDescriptor[];
}

describe('preloadFontPlugin (PERF-05)', () => {
  it('applies to builds only', () => {
    expect(preloadFontPlugin(PATTERN).apply).toBe('build');
  });

  it('runs after the HTML is built, when the hashed bundle is known', () => {
    const hook = preloadFontPlugin(PATTERN).transformIndexHtml;
    expect(typeof hook === 'object' ? hook.order : undefined).toBe('post');
  });

  it('injects one preload link for the hashed Archivo latin woff2 into head', async () => {
    const bundle = bundleOf(
      'assets/index-Xy12.js',
      'assets/index-Ab34.css',
      'assets/archivo-latin-ext-wght-normal-Zz99.woff2',
      'assets/archivo-latin-wght-normal-AbC123.woff2',
      'assets/barlow-condensed-latin-800-normal-Qq11.woff2',
    );
    const tags = await run(preloadFontPlugin(PATTERN), bundle);
    expect(tags).toEqual([
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
    await apply?.call(undefined as never, { base: '/app/' } as never);
    const tags = await run(plugin, bundleOf('assets/archivo-latin-wght-normal-AbC123.woff2'));
    expect(tags[0]?.attrs?.href).toBe('/app/assets/archivo-latin-wght-normal-AbC123.woff2');
  });

  it('fails the build, naming the pattern, when no asset matches', async () => {
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
