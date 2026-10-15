// @vitest-environment node
// The production build output is CSP-safe and carries the CSPS token theme (WEB-01, D-33, D-35, T-02-05, T-02-06).
// Every check reads the git-ignored web root that `npm run build` writes. A missing file fails an expect, never a
// thrown error, so the RED run fails on the behaviour itself (L-26).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../../src/Csps.Server/wwwroot/', import.meta.url));
const assetsDir = join(webRoot, 'assets');

const readText = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const list = (dir: string): string[] => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : []);
const listAll = (dir: string): string[] =>
  list(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? [name, ...listAll(full).map((child) => `${name}/${child}`)] : [name];
  });

const indexHtml = (): string => readText(join(webRoot, 'index.html'));
const cssFiles = (): string[] => list(assetsDir).filter((name) => name.endsWith('.css'));
const builtCss = (): string =>
  cssFiles()
    .map((name) => readText(join(assetsDir, name)))
    .join('\n');

describe('production build output in src/Csps.Server/wwwroot', () => {
  it('writes index.html', () => {
    expect(existsSync(join(webRoot, 'index.html'))).toBe(true);
  });

  it('links exactly one hashed stylesheet under /assets', () => {
    const links = indexHtml().match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toMatch(/href="\/assets\/[\w.-]+-[\w-]{8,}\.css"/);
  });

  it('loads exactly one hashed module script under /assets', () => {
    const scripts = indexHtml().match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatch(/type="module"/);
    expect(scripts[0]).toMatch(/src="\/assets\/[\w.-]+-[\w-]{8,}\.js"/);
  });

  it('has no inline script body, no style element and no style attribute (strict CSP)', () => {
    const html = indexHtml();
    expect(html).not.toBe('');
    const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]?.trim() ?? '');
    expect(scriptBodies.filter((body) => body !== '')).toEqual([]);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
  });

  it('emits exactly one CSS file', () => {
    expect(cssFiles()).toHaveLength(1);
  });

  it('compiles the CSPS token theme: both theme blocks and token-backed utilities', () => {
    const css = builtCss();
    // The minifier may drop the attribute-value quotes; the selector is the same either way.
    expect(css).toMatch(/\[data-theme="?light"?\]/);
    expect(css).toMatch(/\[data-theme="?dark"?\]/);
    expect(css).toMatch(/--bg:\s*#f6dfd1/);
    expect(css).toMatch(/\.bg-bg\s*\{[^}]*background-color:\s*var\(--bg\)/);
  });

  it("carries none of Tailwind's default palette, radii or shadows", () => {
    const css = builtCss();
    expect(css).not.toBe('');
    expect(css).not.toContain('--color-blue-');
    expect(css).not.toContain('--radius-xl');
    expect(css).not.toContain('--shadow-lg');
  });

  it('preloads exactly one font: the hashed Archivo Variable latin woff2 under /assets (PERF-05)', () => {
    const links = indexHtml().match(/<link\b[^>]*rel="preload"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    const link = links[0] ?? '';
    expect(link).toMatch(/\sas="font"/);
    expect(link).toMatch(/\stype="font\/woff2"/);
    expect(link).toMatch(/\scrossorigin(?:[\s>=]|$)/);
    const href = /\shref="\/assets\/([^"]+)"/.exec(link)?.[1] ?? '';
    expect(href).toMatch(/^archivo-latin-wght-normal-[\w-]{8,}\.woff2$/);
    expect(existsSync(join(assetsDir, href))).toBe(true);
  });

  it('ships the self-hosted brand fonts as woff2 files only (PERF-05)', () => {
    const fonts = list(assetsDir).filter((name) => /\.(?:woff2?|ttf|otf|eot)$/i.test(name));
    expect(fonts.some((name) => name.startsWith('archivo-latin-wght-normal-'))).toBe(true);
    expect(fonts.some((name) => name.startsWith('barlow-condensed-latin-800-italic-'))).toBe(true);
    expect(fonts.filter((name) => !name.endsWith('.woff2'))).toEqual([]);
  });

  it("inlines no font as a data: URL, which font-src 'self' would block (T-02-33)", () => {
    const css = builtCss();
    expect(css).not.toBe('');
    expect(css).not.toMatch(/data:(?:font|application\/(?:x-)?font)/i);
  });

  // D-20, CWE-489 (T-02-69), reversed in Phase 4 (plan 04-25): the guarded admin app and its sign-in ship, but the dev
  // showcase and the dev-only preview pages never do, so no production asset may carry their copy.
  it.each(['Open Component Showcase', 'Component Showcase', 'Development only'])(
    'contains no dev or showcase module: no asset carries "%s" (D-20)',
    (copy) => {
      const files = listAll(webRoot).filter((name) => /\.(?:js|html|css)$/.test(name));
      expect(files.length).toBeGreaterThan(0);
      expect(files.filter((name) => readText(join(webRoot, name)).includes(copy))).toEqual([]);
    },
  );

  it.each(['CSPS Admin', 'returnUrl'])('ships the guarded admin app: an asset carries "%s"', (copy) => {
    const files = listAll(webRoot).filter((name) => /\.js$/.test(name));
    expect(files.filter((name) => readText(join(webRoot, name)).includes(copy)).length).toBeGreaterThan(0);
  });

  it('ships no source map and no .vite folder (D-35)', () => {
    const files = listAll(webRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((name) => name.endsWith('.map'))).toEqual([]);
    expect(files.filter((name) => name === '.vite' || name.startsWith('.vite/'))).toEqual([]);
  });
});
