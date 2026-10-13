// How the reference kit (kit.ts) merges the frozen App. D.3 components with the layout fragments (WEB-02, D-33).
// Fragments add markup the spec lacks (shells, wrapper pairs); they never replace a frozen component. A fragment that
// reused a frozen name would make parity compare the app against hand-written code instead of the pinned design, so a
// clash throws unless the name is on SPEC_OVERRIDES with the owner decision that allows it (TOOL-WR-04).
import type { ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

/** The same shape as src/dev/renderScenario.tsx `Kit` (not imported: the node TS program has no JSX). */
export type MergedKit = Readonly<Record<string, ComponentType<never>>>;

/**
 * Frozen spec component name → the owner decision (D-<n>) that lets a fragment replace it.
 *   - Topbar → D-41 (R2-04, owner, 2026-10-13): the override in fragments/Topbar.tsx still renders the pinned frozen
 *     Topbar, unchanged and with no wrapper, and only writes the owner-ruled shortcut hint ("Ctrl K", or "⌘K" on Apple
 *     platforms) into its kbd after mount, because CSS cannot change a text node.
 */
export const SPEC_OVERRIDES: ReadonlyMap<string, string> = new Map([['Topbar', 'D-41']]);

/** Component exports only: PascalCase functions (the D.3 namespace also re-exports csps.ts helpers and constants). */
function components(exports: ModuleExports): Record<string, ComponentType<never>> {
  const entries = Object.entries(exports).filter(
    (entry): entry is [string, ComponentType<never>] => /^[A-Z]/.test(entry[0]) && typeof entry[1] === 'function',
  );
  return Object.fromEntries(entries);
}

/**
 * The frozen spec components plus every fragment component. Throws when a fragment shadows a spec component that is
 * not on `overrides`, or when two fragments export the same name.
 */
export function mergeKit(
  spec: ModuleExports,
  fragments: readonly ModuleExports[],
  overrides: ReadonlyMap<string, string> = SPEC_OVERRIDES,
): MergedKit {
  const specComponents = components(spec);
  const fragmentComponents: Record<string, ComponentType<never>> = {};
  const repeated: string[] = [];
  for (const fragment of fragments) {
    for (const [name, component] of Object.entries(components(fragment))) {
      if (Object.hasOwn(fragmentComponents, name)) {
        repeated.push(name);
      }
      fragmentComponents[name] = component;
    }
  }
  if (repeated.length > 0) {
    throw new Error(`Reference kit: a component name is exported by more than one fragment: ${repeated.join(', ')}.`);
  }
  const clashes = Object.keys(fragmentComponents).filter(
    (name) => Object.hasOwn(specComponents, name) && !overrides.has(name),
  );
  if (clashes.length > 0) {
    throw new Error(
      `Reference kit: fragments shadow frozen spec components: ${clashes.join(', ')}. Rename the fragment, or record ` +
        'an owner decision in SPEC_OVERRIDES (visual/reference/merge-kit.ts).',
    );
  }
  return Object.freeze({ ...specComponents, ...fragmentComponents });
}
