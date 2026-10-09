// PERF-02 route preload (plan 02-35). Not implemented yet (TDD RED stub).
import type { HtmlTagDescriptor, Plugin } from 'vite';

export function routePreloadPlugin(modules: readonly string[]): Plugin {
  return {
    name: 'csps-route-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(): HtmlTagDescriptor[] {
        return modules.slice(0, 0).map(() => ({ tag: 'link' }));
      },
    },
  };
}
