// PERF-05 font preload (research Pattern 14). RED stub: the behaviour lands in the GREEN commit.
import type { Plugin } from 'vite';

export function preloadFontPlugin(pattern: RegExp): Plugin {
  pattern.lastIndex = 0;
  return { name: 'csps-preload-font', transformIndexHtml: { handler: () => [] } };
}

export function woff2OnlyPlugin(): Plugin {
  return { name: 'csps-woff2-only', transform: { handler: () => null } };
}
