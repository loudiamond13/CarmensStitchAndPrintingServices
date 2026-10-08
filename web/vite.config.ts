// Source: CSPS-UI-SPEC.md App. D.7, plus the deltas below. Each delta is marked SPEC-DEVIATION (research Pattern 1).
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { preloadFontPlugin, woff2OnlyPlugin } from './scripts/vite-preload-font-plugin.ts';

// SPEC-DEVIATION: the React Compiler runs through @rolldown/plugin-babel (plugin-react 6 README wiring, research
// Flag 2). Babel only ever sees this app's own TypeScript under src/, never node_modules (L-27: the filter
// receives string | undefined).
const sourceDirectory = fileURLToPath(new URL('./src/', import.meta.url))
  .replaceAll('\\', '/')
  .toLowerCase();
const isAppSource = (id: string | undefined): boolean => {
  if (id === undefined) {
    return false;
  }
  const normalized = id.replaceAll('\\', '/').toLowerCase();
  return normalized.startsWith(sourceDirectory) && /\.tsx?$/.test(normalized);
};

// SPEC-DEVIATION: a function config, so the build output folder and the dev-route switch follow the mode (D-20).
export default defineConfig(({ mode }) => {
  // VITE_DEV_ROUTES comes from the committed, non-secret .env.e2e / .env.budget files (plan 02-37). Nothing is read
  // from or written to the machine-level environment.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const devRoutes = mode === 'development' || env.VITE_DEV_ROUTES === 'true';

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()], include: [isAppSource] }),
      tailwindcss(),
      // SPEC-DEVIATION: PERF-05 woff2 only. The Fontsource weight files list a .woff fallback after each woff2; it
      // is dropped before the CSS pipeline, so the web root ships woff2 files only (research Pattern 14).
      woff2OnlyPlugin(),
      // SPEC-DEVIATION: PERF-05 preload. Build-only: one <link rel="preload"> for the hashed Archivo latin woff2 (the
      // LCP font), and the build fails if that file is missing or matched twice (research Pattern 14).
      preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // SPEC-DEVIATION: dev-only routes (showcase, admin preview) exist in development and in the e2e and budget
    // builds, and never in production (D-20). A literal false lets Rolldown drop the unreachable imports.
    define: { __DEV_ROUTES__: JSON.stringify(devRoutes) },
    // SPEC-DEVIATION: this project's port (CLAUDE.md). strictPort makes a busy 5180 an error instead of a silent hop
    // to a port another project owns (WEB-01). The proxy targets the API's http port: Node does not trust the
    // ASP.NET dev certificate, and Development has no HTTPS redirect (Program.cs).
    server: {
      port: 5180,
      strictPort: true,
      proxy: { '/api': { target: 'http://localhost:5115', changeOrigin: false } },
    },
    // SPEC-DEVIATION: the production build is the API's web root (git-ignored as a whole, research Pitfall 1); the
    // e2e and budget modes build to their own git-ignored .<mode>-dist folders, so builds never touch tracked files.
    build: {
      outDir: mode === 'production' ? '../src/Csps.Server/wwwroot' : `.${mode}-dist`,
      emptyOutDir: true,
      // Fonts and images stay files, never data: URLs, because the CSP is font-src 'self' / img-src 'self'.
      assetsInlineLimit: 0,
      sourcemap: false,
      // D-35: no .vite/license.md in the web root; the third-party notices live in the repository only.
      license: false,
      // SPEC-DEVIATION: D-20 / CWE-489. Builds with dev routes (development, e2e, budget, and the parity build of
      // `npm run parity`) add the look-equality page, parity.html (WEB-02, D-33). The production build keeps
      // index.html as its only entry, so neither the page nor the dev scenario list can reach wwwroot.
      ...(devRoutes
        ? {
            rolldownOptions: {
              input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                parity: fileURLToPath(new URL('./parity.html', import.meta.url)),
              },
            },
          }
        : {}),
    },
  };
});
