// Source: CSPS-UI-SPEC.md App. D.7, plus the deltas below. Each delta is marked SPEC-DEVIATION (research Pattern 1).
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { preloadFontPlugin } from './scripts/vite-preload-font-plugin.ts';

// SPEC-DEVIATION: the React Compiler runs through @rolldown/plugin-babel (plugin-react 6 README wiring, research
// Flag 2). Babel only ever sees this app's own TypeScript under src/, never node_modules.
const sourceDirectory = fileURLToPath(new URL('./src/', import.meta.url))
  .replaceAll('\\', '/')
  .toLowerCase();
const isAppSource = (filename: string | undefined): boolean => {
  if (filename === undefined) {
    return false;
  }
  const normalized = filename.replaceAll('\\', '/').toLowerCase();
  return normalized.startsWith(sourceDirectory) && /\.tsx?$/.test(normalized);
};

// SPEC-DEVIATION: a function config, so the build output folder and the dev-route switch follow the mode (D-20).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], include: [isAppSource] }),
    tailwindcss(),
    // SPEC-DEVIATION: PERF-05 font preload. Build-only: one <link rel="preload"> for the hashed Archivo latin woff2,
    // and the build fails if that file is missing (research Pattern 14).
    preloadFontPlugin(/archivo-latin-wght-normal-.*\.woff2$/),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // SPEC-DEVIATION: dev-only routes (showcase, admin preview) exist in the development, e2e and budget modes and
  // never in production (D-20). A define, not a .env file, because .env* is git-ignored.
  define: { __DEV_ROUTES__: JSON.stringify(mode !== 'production') },
  // SPEC-DEVIATION: this project's port (CLAUDE.md). strictPort makes a busy 5180 an error instead of a silent hop
  // to a port another project owns (WEB-01). The proxy targets the API's http port: Node does not trust the ASP.NET
  // dev certificate, and Development has no HTTPS redirect (Program.cs).
  server: {
    port: 5180,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:5115', changeOrigin: false } },
  },
  // SPEC-DEVIATION: the production build is the API's web root (git-ignored, research Pitfall 1); the e2e and
  // budget modes build to their own .<mode>-dist folders.
  build: {
    outDir: mode === 'production' ? '../src/Csps.Server/wwwroot' : `.${mode}-dist`,
    emptyOutDir: true,
    // Fonts and images stay files, never data: URLs, because the CSP is font-src 'self' / img-src 'self'.
    assetsInlineLimit: 0,
    sourcemap: false,
    // Writes .vite/license.md, the input for the third-party credits (D-10).
    license: true,
  },
}));
