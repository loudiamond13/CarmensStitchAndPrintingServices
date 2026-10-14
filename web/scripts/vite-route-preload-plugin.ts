// PERF-02 route preload (plan 02-35). The public layout and its page are lazy route modules (router.tsx), so without a
// hint the browser asks for them only after the entry script has downloaded and run: one more round trip before the
// first paint on a phone. This build plugin adds `<link rel="modulepreload">` for those route chunks and every chunk
// they import (except the entry, which the page loads anyway), so they download alongside the entry script. It is
// static markup, allowed under the strict CSP (script-src 'self'), and the build fails closed when a route module has no
// chunk of its own.
import type { HtmlTagDescriptor, Plugin } from 'vite';

/** The route modules to preload, as web-root-relative posix paths (e.g. `src/app/public/PublicLayout.tsx`). */
export function routePreloadPlugin(modules: readonly string[]): Plugin {
  let base = '/';
  let root = '';
  return {
    name: 'csps-route-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      root = config.root.replaceAll('\\', '/');
    },
    transformIndexHtml: {
      // After Vite has emitted the chunks, so ctx.bundle holds the real file names and import graph.
      order: 'post',
      handler(_html, ctx): HtmlTagDescriptor[] {
        if (ctx.bundle === undefined) {
          return this.error('routePreloadPlugin: no bundle to search (build only).');
        }
        const chunks = Object.values(ctx.bundle).flatMap((output) => (output.type === 'chunk' ? [output] : []));
        const entries = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName));
        const relative = (id: string): string => {
          const normalized = id.replaceAll('\\', '/');
          return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
        };
        const files: string[] = [];
        const visit = (fileName: string): void => {
          if (entries.has(fileName) || files.includes(fileName)) {
            return;
          }
          files.push(fileName);
          for (const imported of chunks.find((chunk) => chunk.fileName === fileName)?.imports ?? []) {
            visit(imported);
          }
        };
        for (const module of modules) {
          const chunk = chunks.find(
            (candidate) => candidate.facadeModuleId !== null && relative(candidate.facadeModuleId) === module,
          );
          if (chunk === undefined) {
            // Fail closed: a renamed or inlined route module must break the build, not silently lose its preload.
            return this.error(`routePreloadPlugin: no chunk has ${module} as its module.`);
          }
          visit(chunk.fileName);
        }
        return files.map((fileName) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `${base}${fileName}` },
          injectTo: 'head',
        }));
      },
    },
  };
}
