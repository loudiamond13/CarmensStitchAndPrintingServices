// @vitest-environment node
// Pins the Vite config values the API host, the shared machine and the CSP depend on (WEB-01, D-20).
import { describe, expect, it } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';
import viteConfig from '../../vite.config.ts';

function resolve(env: ConfigEnv): UserConfig {
  return viteConfig(env);
}

describe('vite.config.ts', () => {
  it('builds production into the API web root with no inlined assets, no source maps and a license file', () => {
    const config = resolve({ command: 'build', mode: 'production' });
    expect(config.build?.outDir).toBe('../src/Csps.Server/wwwroot');
    expect(config.build?.emptyOutDir).toBe(true);
    expect(config.build?.assetsInlineLimit).toBe(0);
    expect(config.build?.sourcemap).toBe(false);
    expect(config.build?.license).toBe(true);
  });

  it('switches the dev-only routes off in production only', () => {
    expect(resolve({ command: 'build', mode: 'production' }).define?.__DEV_ROUTES__).toBe('false');
    expect(resolve({ command: 'serve', mode: 'development' }).define?.__DEV_ROUTES__).toBe('true');
    expect(resolve({ command: 'serve', mode: 'test' }).define?.__DEV_ROUTES__).toBe('true');
  });

  it('serves development on this project port 5180, strictly, and proxies /api to the API http port', () => {
    const config = resolve({ command: 'serve', mode: 'development' });
    expect(config.server?.port).toBe(5180);
    expect(config.server?.strictPort).toBe(true);
    expect(config.server?.proxy?.['/api']).toEqual(expect.objectContaining({ target: 'http://localhost:5115' }));
  });

  it('builds the e2e mode into its own folder with the dev-only routes on', () => {
    const config = resolve({ command: 'build', mode: 'e2e' });
    expect(config.build?.outDir).toBe('.e2e-dist');
    expect(config.define?.__DEV_ROUTES__).toBe('true');
  });

  it('builds the budget mode into its own folder', () => {
    expect(resolve({ command: 'build', mode: 'budget' }).build?.outDir).toBe('.budget-dist');
  });
});
