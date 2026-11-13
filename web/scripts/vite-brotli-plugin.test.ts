// @vitest-environment node
// D-28, D-46 (plan 11-36): the build writes a Brotli (quality 11) .br file next to every built .js, .css and .svg over
// 1 KB with node:zlib, so the server can send the smaller file to browsers that accept it.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { build, loadConfigFromFile, type Plugin, type UserConfig } from 'vite';
import { BROTLI_MIN_BYTES, brotliPlugin } from './vite-brotli-plugin.ts';

type PluginOption = NonNullable<UserConfig['plugins']>[number];

const webDir = fileURLToPath(new URL('../', import.meta.url));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'csps-brotli-'));
  temporaryDirectories.push(directory);
  return directory;
}

/** Repeating text of an exact length: compressible, so a .br is clearly smaller than the file. */
function text(length: number): string {
  return 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(length / 45)).slice(0, length);
}

function put(root: string, relative: string, content: string | Uint8Array): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** Every file under `root`, as posix paths relative to it. */
function listFiles(root: string, relative = ''): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      names.push(...listFiles(root, child));
    } else {
      names.push(child);
    }
  }
  return names.sort();
}

async function runWriteBundle(plugin: Plugin, outDir: string): Promise<void> {
  const hook = plugin.writeBundle;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (handler === undefined) {
    throw new Error('writeBundle is missing');
  }
  await handler.call({} as never, { dir: outDir } as never, {} as never);
}

describe('brotliPlugin (D-28)', () => {
  it('is a build-only plugin named csps:brotli', () => {
    const plugin = brotliPlugin();
    expect(plugin.name).toBe('csps:brotli');
    expect(plugin.apply).toBe('build');
  });

  it('uses a 1 KB threshold', () => {
    expect(BROTLI_MIN_BYTES).toBe(1024);
  });

  it('writes a .br next to every .js, .css and .svg over 1 KB, and each decompresses to the same bytes', async () => {
    const outDir = temporaryDirectory();
    const files = {
      'assets/app-A1.js': text(5000),
      'assets/app-B2.css': text(3000),
      'assets/nested/deep/shapes-C3.svg': text(2000),
      'mark.svg': text(1500),
    };
    for (const [name, content] of Object.entries(files)) {
      put(outDir, name, content);
    }

    await runWriteBundle(brotliPlugin(), outDir);

    for (const [name, content] of Object.entries(files)) {
      expect(existsSync(path.join(outDir, `${name}.br`)), `${name}.br exists`).toBe(true);
      const decoded = brotliDecompressSync(readFileSync(path.join(outDir, `${name}.br`)));
      expect(decoded.equals(Buffer.from(content)), `${name}.br decompresses to the original`).toBe(true);
    }
  });

  it('compresses at quality 11', async () => {
    const outDir = temporaryDirectory();
    const content = text(8000) + Array.from({ length: 400 }, (_, index) => `item-${String(index * 7919)}`).join(',');
    put(outDir, 'assets/app.js', content);

    await runWriteBundle(brotliPlugin(), outDir);

    const expected = brotliCompressSync(Buffer.from(content), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(content) },
    });
    const actual = readFileSync(path.join(outDir, 'assets/app.js.br'));
    const quick = brotliCompressSync(Buffer.from(content), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
    expect(actual.length).toBeLessThanOrEqual(expected.length);
    expect(actual.length).toBeLessThan(quick.length);
  });

  it('writes nothing for a file of 1 KB or less, an html page or a font', async () => {
    const outDir = temporaryDirectory();
    put(outDir, 'assets/exactly.js', text(BROTLI_MIN_BYTES));
    put(outDir, 'assets/small.css', text(300));
    put(outDir, 'index.html', text(4000));
    put(outDir, 'assets/font-D4.woff2', text(4000));
    put(outDir, 'assets/data.json', text(4000));
    put(outDir, 'assets/over.js', text(BROTLI_MIN_BYTES + 1));

    await runWriteBundle(brotliPlugin(), outDir);

    expect(listFiles(outDir)).toEqual([
      'assets/data.json',
      'assets/exactly.js',
      'assets/font-D4.woff2',
      'assets/over.js',
      'assets/over.js.br',
      'assets/small.css',
      'index.html',
    ]);
  });

  it('does not compress a .br file again', async () => {
    const outDir = temporaryDirectory();
    put(outDir, 'assets/app.js', text(5000));
    const plugin = brotliPlugin();

    await runWriteBundle(plugin, outDir);
    await runWriteBundle(plugin, outDir);

    expect(listFiles(outDir)).toEqual(['assets/app.js', 'assets/app.js.br']);
  });

  it('works in a real Vite build, public files included', async () => {
    const root = temporaryDirectory();
    const outDir = path.join(temporaryDirectory(), 'dist');
    put(root, 'index.html', '<!doctype html><html><head></head><body><script type="module" src="/main.js"></script></body></html>');
    put(root, 'main.js', `document.title = ${JSON.stringify(text(4000))};\n`);
    put(root, 'public/mark.svg', `<svg xmlns="http://www.w3.org/2000/svg"><desc>${text(2000)}</desc></svg>`);

    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [brotliPlugin()],
      build: { outDir, emptyOutDir: true },
    });

    const files = listFiles(outDir);
    const scripts = files.filter((name) => name.endsWith('.js'));
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(files, `${script}.br`).toContain(`${script}.br`);
      const original = readFileSync(path.join(outDir, script));
      expect(brotliDecompressSync(readFileSync(path.join(outDir, `${script}.br`))).equals(original)).toBe(true);
    }
    expect(files).toContain('mark.svg.br');
    expect(files).not.toContain('index.html.br');
  });
});

describe('vite.config.ts (D-28)', () => {
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

  async function pluginNames(mode: string): Promise<string[]> {
    const loaded = await loadConfigFromFile({ command: 'build', mode }, `${webDir}vite.config.ts`, webDir, 'silent');
    return (await flattenPlugins(loaded?.config.plugins ?? [])).map((plugin) => plugin.name);
  }

  it.each(['production', 'e2e'])('registers the Brotli plugin for the %s build', async (mode) => {
    expect(await pluginNames(mode)).toContain('csps:brotli');
  });

  it.each(['budget', 'parity'])('leaves the Brotli plugin out of the %s build', async (mode) => {
    expect(await pluginNames(mode)).not.toContain('csps:brotli');
  });
});
