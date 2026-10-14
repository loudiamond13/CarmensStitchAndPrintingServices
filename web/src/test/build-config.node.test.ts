// @vitest-environment node
// Pins the Vite settings the API host, the shared machine and the CSP depend on, per mode (WEB-01, D-20, T-02-79),
// and the TypeScript alias pair (D-15). Each mode loads vite.config.ts the way the Vite CLI does, so the committed
// .env.<mode> files take part. A missing file fails an expect, never a thrown error (L-26).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfigFromFile, type ConfigEnv, type UserConfig } from 'vite';

const webDir = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

const readText = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

async function load(command: ConfigEnv['command'], mode: string): Promise<UserConfig> {
  const loaded = await loadConfigFromFile({ command, mode }, join(webDir, 'vite.config.ts'), webDir, 'silent');
  return loaded?.config ?? {};
}

const buildModes = [
  { mode: 'production', outDir: '../src/Csps.Server/wwwroot', devRoutes: 'false' },
  { mode: 'e2e', outDir: '.e2e-dist', devRoutes: 'true' },
  { mode: 'budget', outDir: '.budget-dist', devRoutes: 'true' },
  { mode: 'parity', outDir: '.parity-dist', devRoutes: 'true' },
] as const;

/** Runs `body` with VITE_DEV_ROUTES set in this process only, then restores it (never User/Machine level). */
async function withProcessFlag<T>(value: string, body: () => Promise<T>): Promise<T> {
  const saved = process.env.VITE_DEV_ROUTES;
  process.env.VITE_DEV_ROUTES = value;
  try {
    return await body();
  } finally {
    if (saved === undefined) {
      delete process.env.VITE_DEV_ROUTES;
    } else {
      process.env.VITE_DEV_ROUTES = saved;
    }
  }
}

describe('vite.config.ts', () => {
  it('serves development on this project port 5180, strictly, and proxies /api to the API http port', async () => {
    const config = await load('serve', 'development');
    expect(config.server?.port).toBe(5180);
    expect(config.server?.strictPort).toBe(true);
    expect(config.server?.proxy?.['/api']).toEqual(expect.objectContaining({ target: 'http://localhost:5115' }));
  });

  it('turns the dev-only routes on in development', async () => {
    expect((await load('serve', 'development')).define?.__DEV_ROUTES__).toBe('true');
  });

  it.each(buildModes)('builds the $mode mode into $outDir', async ({ mode, outDir }) => {
    const config = await load('build', mode);
    expect(config.build?.outDir).toBe(outDir);
    expect(config.build?.emptyOutDir).toBe(true);
  });

  it.each(buildModes)('sets __DEV_ROUTES__ to $devRoutes in the $mode build', async ({ mode, devRoutes }) => {
    expect((await load('build', mode)).define?.__DEV_ROUTES__).toBe(devRoutes);
  });

  it('adds the parity page (parity.html) as a second entry only in the parity build (WEB-02, D-33)', async () => {
    const input = (await load('build', 'parity')).build?.rolldownOptions?.input;
    expect(input).toEqual({ main: join(webDir, 'index.html'), parity: join(webDir, 'parity.html') });
    expect(existsSync(join(webDir, 'parity.html'))).toBe(true);
  });

  // The budget and e2e builds measure the shipped topology: the test-only parity page is not built into them, so its
  // imports cannot pull components into the chunks the public route loads (docs/web/budgets.md).
  it.each(['production', 'e2e', 'budget'])(
    'keeps index.html as the only entry of the %s build, so the parity page never shapes it (D-20, CWE-489)',
    async (mode) => {
      expect((await load('build', mode)).build?.rolldownOptions?.input).toBeUndefined();
    },
  );

  // TOOL-CR-01: the dev-route switch follows the mode only. A VITE_DEV_ROUTES value in the process environment (or in an
  // untracked .env, .env.local or .env.production file) must never turn dev code on in the build that ships.
  it.each(['true', 'false', '1'])(
    'refuses a production build when VITE_DEV_ROUTES is set (%s) in the environment (D-20, CWE-489)',
    async (value) => {
      await withProcessFlag(value, async () => {
        await expect(load('build', 'production')).rejects.toThrow(/VITE_DEV_ROUTES must never be set/);
      });
    },
  );

  it('keeps the dev routes off in the test mode even when VITE_DEV_ROUTES is set', async () => {
    const config = await withProcessFlag('true', () => load('serve', 'test'));
    expect(config.define?.__DEV_ROUTES__).toBe('false');
  });

  it.each(['staging', 'constructor'])(
    'refuses the mode %s, which it does not know, so no build lands in an unreviewed output folder',
    async (mode) => {
      await expect(load('build', mode)).rejects.toThrow(`unknown mode "${mode}"`);
    },
  );

  it.each(buildModes)(
    'ships no license file, no source map and no inlined asset in the $mode build',
    async ({ mode }) => {
      const config = await load('build', mode);
      expect(config.build?.license).toBe(false);
      expect(config.build?.sourcemap).toBe(false);
      expect(config.build?.assetsInlineLimit).toBe(0);
    },
  );
});

describe('TypeScript alias pair (D-15)', () => {
  it('gives tooling the TypeScript 6 API through the typescript package', () => {
    expect((require('typescript') as { version: string }).version).toBe('6.0.3');
  });

  it('runs tsc from TypeScript 7 through @typescript/native', () => {
    const manifest = readText(join(webDir, 'node_modules/@typescript/native/package.json'));
    expect(manifest === '' ? null : (JSON.parse(manifest) as { version: string }).version).toBe('7.0.2');
  });
});

describe('web/public/robots.txt', () => {
  it('allows every crawler', () => {
    const lines = readText(join(webDir, 'public/robots.txt'))
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '');
    expect(lines).toEqual(['User-agent: *', 'Allow: /']);
  });
});
