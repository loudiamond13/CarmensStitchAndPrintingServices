// @ts-check
// WEB-02, D-07: the frozen App. D.3 copy in src/ui/__reference__/ is byte-for-byte the spec text, which was written
// for src/ui/index.tsx, so its `../lib/csps` import means src/lib/csps.ts. The copy can never be edited, so the
// differential test (vitest.config.ts) and the local owner review pack resolve that one specifier for files inside
// src/ui/__reference__/ only. Nothing in the app imports the reference, so the build never needs this.
import { fileURLToPath } from 'node:url';

const referenceDirectory = normalize(fileURLToPath(new URL('../src/ui/__reference__/', import.meta.url)));
const cspsModule = fileURLToPath(new URL('../src/lib/csps.ts', import.meta.url));

/**
 * @param {string} path
 * @returns {string}
 */
function normalize(path) {
  return path.replaceAll('\\', '/').toLowerCase();
}

/**
 * Resolves `../lib/csps` from the frozen reference copies to src/lib/csps.ts.
 * @returns {import('vite').Plugin}
 */
export function referenceResolvePlugin() {
  return {
    name: 'csps-reference-resolve',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === '../lib/csps' && importer !== undefined && normalize(importer).startsWith(referenceDirectory)) {
        return cspsModule;
      }
      return null;
    },
  };
}
