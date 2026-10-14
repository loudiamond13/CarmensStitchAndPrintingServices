// Vite config for the parity reference app (WEB-02, D-33): the frozen App. D.3 components and the verbatim App. A-C
// CSS, compiled exactly as App. A.2 wires it, plus the test-only rulings layer. It builds into the git-ignored
// web/.reference-dist and is never part of the shipped app (threat T-02-35). Built by `npm run parity` only.
//
// No React Compiler and no Babel: the reference renders the approved code as written. Tailwind compiles App. A.2's
// `@import "tailwindcss"` for the spec's own layers.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./reference', import.meta.url)),
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('../.reference-dist', import.meta.url)),
    emptyOutDir: true,
    // Fonts stay files, never data: URLs, because the CSP is font-src 'self' (same as the app build).
    assetsInlineLimit: 0,
    // The approved CSS stays as written (plan 02-17). Minifying rewrote App. B's `background: transparent` into
    // `background: 0 0`, which also sets background-position to 0px 0px, a computed value the approved CSS never has.
    // Tailwind's own optimizer follows this flag, so neither minifier rewrites a declaration.
    cssMinify: false,
    sourcemap: false,
    license: false,
  },
});
