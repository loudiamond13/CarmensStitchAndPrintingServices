// D-28 (plan 11-36): Brotli files at build time. Stub for the RED step: writes nothing yet.
import type { Plugin } from 'vite';

export const BROTLI_MIN_BYTES = 1024;

export function brotliPlugin(): Plugin {
  return {
    name: 'csps:brotli',
    apply: 'build',
    writeBundle() {
      return undefined;
    },
  };
}
