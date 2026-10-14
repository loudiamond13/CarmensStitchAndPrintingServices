import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// The Vite config for mode 'test' (the same React + React Compiler + Tailwind plugin chain as the build, research
// Flag 2), so component tests exercise compiled output. Files named *.node.test.ts opt into the node environment
// with a `// @vitest-environment node` header.
export default defineConfig((env) =>
  mergeConfig(
    viteConfig({ ...env, mode: 'test' }),
    defineConfig({
      test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'visual/**/*.test.ts'],
        exclude: ['e2e/**', 'node_modules/**'],
        restoreMocks: true,
        // jest-dom matchers, the matchMedia mock, RTL cleanup and the fail-on-console guard (plan 02-04). Timers stay
        // real by default: axe and user-event never resolve on fake timers (L-24), so only debounce tests opt in.
        setupFiles: ['src/test/setup.ts'],
        // JUnit output feeds the TDD RED-evidence records (L-26); web/.vitest/ is git-ignored (L-28).
        reporters: ['default', 'junit'],
        outputFile: { junit: '.vitest/junit/output.xml' },
        coverage: {
          provider: 'v8',
          include: ['src/**/*.{ts,tsx}'],
          // src/dev/** is dev-only and never shipped (D-20); the parity and E2E suites cover it.
          exclude: [
            'src/**/*.test.{ts,tsx}',
            'src/test/**',
            'src/dev/**',
            'src/main.tsx',
            'src/types/**',
            'src/**/*.d.ts',
          ],
          thresholds: {
            lines: 90,
            branches: 90,
            functions: 90,
            statements: 90,
            // The HTTP client is held to 100% by tests, never by ignore comments (WEB-03, CLAUDE.md coverage rule).
            'src/lib/http/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
          },
          reporter: ['text', 'json-summary'],
        },
      },
    }),
  ),
);
