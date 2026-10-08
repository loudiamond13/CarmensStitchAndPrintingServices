// PERF-05 font preload (research Pattern 14). Adds one <link rel="preload" as="font"> for the hashed self-hosted woff2
// that matches `pattern`, found in the final bundle, so the browser starts the primary font download with the HTML.
// No inline script: the tag is static markup, allowed under the strict CSP (font-src 'self').
import type { HtmlTagDescriptor, IndexHtmlTransformContext, Plugin } from 'vite';

export function preloadFontPlugin(pattern: RegExp): Plugin {
  let base = '/';
  return {
    name: 'csps-preload-font',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      // After Vite has emitted the hashed assets, so ctx.bundle holds the real file names.
      order: 'post',
      handler(_html: string, ctx: IndexHtmlTransformContext): HtmlTagDescriptor[] {
        if (ctx.bundle === undefined) {
          throw new Error(`preloadFontPlugin: no bundle to search for ${pattern.source} (build only).`);
        }
        const matches = Object.keys(ctx.bundle).filter((fileName) => pattern.test(fileName));
        if (matches.length === 0) {
          // Fail closed: a renamed or missing font must break the build, not silently drop the preload.
          throw new Error(`preloadFontPlugin: no built asset matches ${pattern.source}.`);
        }
        if (matches.length > 1) {
          throw new Error(
            `preloadFontPlugin: more than one built asset matches ${pattern.source}: ${matches.join(', ')}.`,
          );
        }
        const [fileName] = matches;
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              href: `${base}${fileName ?? ''}`,
              crossorigin: true,
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}
