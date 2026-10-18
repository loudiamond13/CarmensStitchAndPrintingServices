// @vitest-environment node
// The production build output is CSP-safe and carries the CSPS token theme (WEB-01, D-33, D-35, T-02-05, T-02-06).
// Every check reads the git-ignored web root that `npm run build` writes. A missing file fails an expect, never a
// thrown error, so the RED run fails on the behaviour itself (L-26). On a clean checkout (CI) nothing has built yet,
// because the build step follows the tests in the pipeline order, so the suite builds once when index.html is missing.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const webDirectory = fileURLToPath(new URL('../../', import.meta.url));
const webRoot = fileURLToPath(new URL('../../../src/Csps.Server/wwwroot/', import.meta.url));
const assetsDir = join(webRoot, 'assets');
/** The numbers the production build wrote (git-ignored; the budget plugin writes it at the end of every build). */
const budgetReport = fileURLToPath(new URL('../../../artifacts/budget/budget.production.json', import.meta.url));

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
  beforeAll(() => {
    if (!existsSync(join(webRoot, 'index.html'))) {
      // Vitest sets NODE_ENV=test, which would build the development React bundle and break the size budgets.
      const env = { ...process.env, NODE_ENV: 'production' };
      spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
        cwd: webDirectory,
        env,
        stdio: 'inherit',
      });
    }
  }, 300_000);

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
  // preview pages never do, so no production asset may carry their copy.
  it.each(['Open Component Showcase', 'Development only'])(
    'contains no dev preview module: no asset carries "%s" (D-20)',
    (copy) => {
      const files = listAll(webRoot).filter((name) => /\.(?:js|html|css)$/.test(name));
      expect(files.length).toBeGreaterThan(0);
      expect(files.filter((name) => readText(join(webRoot, name)).includes(copy))).toEqual([]);
    },
  );

  it.each(['CSPS Admin', 'returnUrl'])('ships the guarded admin app: an asset carries "%s"', (copy) => {
    const files = listAll(webRoot).filter((name) => name.endsWith('.js'));
    expect(files.filter((name) => readText(join(webRoot, name)).includes(copy)).length).toBeGreaterThan(0);
  });

  // PERF-02: the scripts `/` loads (the entry and every modulepreload) carry no TanStack Query; it ships with the admin
  // chunks. "No QueryClient set" is the production message of useQueryClient, so it marks the library's code.
  const publicInitialScripts = (): string[] =>
    [
      ...indexHtml().matchAll(
        /(?:<script\b[^>]*\ssrc|<link\b[^>]*rel="modulepreload"[^>]*\shref)="\/assets\/([^"]+\.js)"/g,
      ),
    ]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== '');

  it('loads the entry and its preloads, all present in /assets', () => {
    const scripts = publicInitialScripts();
    expect(scripts.length).toBeGreaterThan(1);
    expect(scripts.filter((name) => !existsSync(join(assetsDir, name)))).toEqual([]);
  });

  it('keeps TanStack Query out of every script the public route loads first (PERF-02)', () => {
    const scripts = publicInitialScripts();
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((name) => readText(join(assetsDir, name)).includes('No QueryClient set'))).toEqual([]);
  });

  it('still ships TanStack Query, in the admin chunks', () => {
    const initial = new Set(publicInitialScripts());
    const carriers = list(assetsDir).filter(
      (name) => name.endsWith('.js') && readText(join(assetsDir, name)).includes('No QueryClient set'),
    );
    expect(carriers.length).toBeGreaterThan(0);
    expect(carriers.filter((name) => initial.has(name))).toEqual([]);
  });

  // D-30..D-33 (plan 05-35): the Component Showcase ships for Managers as a lazy admin chunk of its own. Its copy lives in
  // that chunk and the chunks only it reaches; nothing in the page the public or the admin loads first carries it.
  /** The chunks a chunk imports statically (`from"./x.js"` and `import"./x.js"`; a dynamic `import()` is not followed). */
  const staticImports = (name: string): string[] =>
    [...readText(join(assetsDir, name)).matchAll(/\b(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g)].map(
      (match) => match[1] ?? '',
    );
  const showcasePages = (): string[] =>
    list(assetsDir).filter((name) => /^ComponentShowcasePage-[\w-]+\.js$/.test(name));
  /** The showcase page chunk and everything it imports statically, each once. */
  const showcaseChunks = (): string[] => {
    const seen = new Set<string>();
    const pending = showcasePages();
    for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(...staticImports(next));
      }
    }
    return [...seen];
  };

  it('has one lazy chunk for the showcase page, and no script that `/` loads first is it (D-33)', () => {
    expect(showcasePages()).toHaveLength(1);
    const initial = new Set(publicInitialScripts());
    expect(showcasePages().filter((name) => initial.has(name))).toEqual([]);
    expect(showcaseChunks().length).toBeGreaterThan(1);
  });

  it('carries the showcase copy only in the showcase chunks (D-33)', () => {
    const files = listAll(webRoot).filter((name) => /\.(?:js|html|css)$/.test(name));
    const carriers = files
      .filter((name) => readText(join(webRoot, name)).includes('Component Showcase'))
      .map((name) => name.replace(/^assets\//, ''));
    expect(carriers.length).toBeGreaterThan(0);
    const allowed = new Set(showcaseChunks());
    expect(carriers.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it('ships no dev route path: no chunk names /dev/components or a quoted /dev/ path (D-33, D-41 Q3)', () => {
    const files = list(assetsDir).filter((name) => name.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((name) => {
      const code = readText(join(assetsDir, name));
      return code.includes('/dev/components') || /["'`]\/dev\//.test(code);
    });
    expect(offenders).toEqual([]);
  });

  // T-05-96: the static chunks are public even though the route is guarded, so the showcase holds demo data only.
  const SECRET_PATTERNS: readonly [string, RegExp][] = [
    ['JWT', /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['connection string', /\b(?:Server|Data Source|Password|Pwd|User Id)\s*=/i],
    ['cloud key', /\b(?:AKIA[0-9A-Z]{16}|sk_(?:live|test)_\w{10,}|cloudinary:\/\/\S+)/],
    ['bearer token', /\bBearer\s+[\w-]{20,}/],
  ];
  /** The made-up addresses of spec §12 and the reserved example domains; any other address in a showcase chunk is a finding. */
  const DEMO_ADDRESSES = new Set([
    'carmen.reyes.csp@gmail.com',
    'paolo.garcia@gmail.com',
    'liza.mercado@example.com',
    'lizamercado09@gmail.com',
    'jomar.santos@yahoo.com',
    'rhea.villanueva@gmail.com',
    'maria.villanueva.delacruzada@gmail.com',
    'maria.concepcion.villanueva.dela.cruz.j@barangay-sanroque.gov.ph',
    'name@gmail.com',
    'carmen@x.ph',
    'hello@yourdomain.ph',
  ]);
  const RESERVED_DOMAIN = /@(?:[\w-]+\.)*(?:example\.(?:com|org|net|ph)|invalid|test|localhost)$/i;

  it.each(SECRET_PATTERNS)('has no %s in the showcase chunks (T-05-96)', (_name, pattern) => {
    const chunks = showcaseChunks();
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.filter((name) => pattern.test(readText(join(assetsDir, name))))).toEqual([]);
  });

  it('has no email address in the showcase chunks beyond the made-up demo ones (T-05-96)', () => {
    const chunks = showcaseChunks();
    expect(chunks.length).toBeGreaterThan(1);
    const found = new Set(
      chunks.flatMap((name) => readText(join(assetsDir, name)).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []),
    );
    expect([...found].filter((address) => !DEMO_ADDRESSES.has(address) && !RESERVED_DOMAIN.test(address))).toEqual([]);
  });

  it('keeps the admin initial JS within 250 KB gzip with the showcase in the build (PERF-01)', () => {
    const report: unknown = JSON.parse(readText(budgetReport) || '{}');
    const adminJs = typeof report === 'object' && report !== null && 'adminJs' in report ? report.adminJs : null;
    expect(typeof adminJs).toBe('number');
    expect(adminJs).toBeLessThanOrEqual(250_000);
  });

  it('ships no source map and no .vite folder (D-35)', () => {
    const files = listAll(webRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((name) => name.endsWith('.map'))).toEqual([]);
    expect(files.filter((name) => name === '.vite' || name.startsWith('.vite/'))).toEqual([]);
  });
});
