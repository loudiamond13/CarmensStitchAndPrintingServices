// PERF-05 font preload (research Pattern 14). RED placeholder: exports the plugin factory, injects nothing yet.
import type { Plugin } from 'vite';

export function preloadFontPlugin(pattern: RegExp): Plugin {
  return { name: `csps-preload-font:${pattern.source}` };
}
