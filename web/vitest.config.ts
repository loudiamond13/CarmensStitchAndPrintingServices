import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// The Vite config for mode 'test' (same React + React Compiler + Tailwind plugin chain as the build, research Flag 2),
// so component tests exercise compiled output.
export default defineConfig((env) =>
  mergeConfig(
    viteConfig({ ...env, mode: 'test' }),
    defineConfig({
      test: {
        environment: 'jsdom',
        setupFiles: ['src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
        exclude: ['e2e/**', 'node_modules/**'],
        restoreMocks: true,
        coverage: {
          provider: 'v8',
          include: ['src/**/*.{ts,tsx}'],
          exclude: [
            'src/ui/__reference__/**',
            'src/types/**',
            'src/test/**',
            '**/*.test.{ts,tsx}',
            'src/main.tsx',
            'src/vite-env.d.ts',
          ],
          thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
          reporter: ['text', 'json-summary'],
        },
      },
    }),
  ),
);
