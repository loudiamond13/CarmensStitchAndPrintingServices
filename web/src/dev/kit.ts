// The implementation kit (WEB-02, D-33; dev only, never shipped, D-20): every component the `@/components` area barrels
// export (`src/components/<area>/index.ts`), plus the dev-only previews in ./previews (impl-only wrappers a scenario may need;
// the folder may be empty). The parity page renders the shared scenario list with it, and the reference app renders the
// same list with the frozen App. D.3 kit (web/visual/reference/kit.ts), so both sides look up components by the same
// App. D.3 names.
import type { ComponentType } from 'react';
import type { Kit } from './renderScenario';

type ModuleExports = Readonly<Record<string, unknown>>;

const uiModules = import.meta.glob<ModuleExports>('../components/*/index.ts', { eager: true });
const previewModules = import.meta.glob<ModuleExports>('./previews/*.tsx', { eager: true });

/** Component exports only: PascalCase functions (the barrels also export recipes, constants and types). */
function components(exports: ModuleExports): [string, ComponentType<never>][] {
  return Object.entries(exports).filter(
    (entry): entry is [string, ComponentType<never>] => /^[A-Z]/.test(entry[0]) && typeof entry[1] === 'function',
  );
}

/**
 * Merges the modules by export name. Two modules exporting the same component name would make the parity page render
 * an arbitrary one of them, so a clash throws at load instead (the page then fails its guard).
 */
export function mergeKit(modules: readonly ModuleExports[]): Kit {
  const kit: Record<string, ComponentType<never>> = {};
  for (const exports of modules) {
    for (const [name, component] of components(exports)) {
      const existing = kit[name];
      if (existing !== undefined && existing !== component) {
        throw new Error(`Two kit modules export a component named ${name}.`);
      }
      kit[name] = component;
    }
  }
  return Object.freeze(kit);
}

/** Component name → converted component. */
export const kit: Kit = mergeKit([...Object.values(uiModules), ...Object.values(previewModules)]);
