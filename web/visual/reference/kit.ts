// The reference kit (WEB-02, D-33): the frozen App. D.3 namespace (CSPS-UI-SPEC.md, extracted byte for byte and
// hash-pinned by plan 02-38 into the git-ignored ../.reference-src) merged with the layout fragments in ./fragments
// (App. E.1/E.6 shell markup, added by plans 02-29 to 02-31; the folder may be empty).
//
// The spec module is loaded through import.meta.glob, not a static import, for two reasons: the TypeScript programs
// never type-check the frozen code (it is the approved design, kept verbatim, with known strict-mode findings, research
// Pitfall 7), and a missing extraction fails loudly here instead of as an unresolved import.
import type { ComponentType } from 'react';
import type { Kit } from '../../src/dev/renderScenario';

type ModuleExports = Readonly<Record<string, unknown>>;

const specModules = import.meta.glob<ModuleExports>('../.reference-src/ui/index.tsx', { eager: true });
const fragmentModules = import.meta.glob<ModuleExports>('./fragments/*.tsx', { eager: true });

/** Component exports only: PascalCase functions (the D.3 namespace also re-exports csps.ts helpers and constants). */
function components(exports: ModuleExports): Record<string, ComponentType<never>> {
  const entries = Object.entries(exports).filter(
    (entry): entry is [string, ComponentType<never>] => /^[A-Z]/.test(entry[0]) && typeof entry[1] === 'function',
  );
  return Object.fromEntries(entries);
}

const spec = specModules['../.reference-src/ui/index.tsx'];
if (spec === undefined) {
  throw new Error('The frozen spec is missing. Run node visual/reference/extract-spec.mjs (npm run parity does).');
}

/** Component name → frozen spec component (fragments win on a name clash, so a shell fragment can wrap a primitive). */
export const kit: Kit = Object.freeze({
  ...components(spec),
  ...Object.fromEntries(Object.values(fragmentModules).flatMap((fragment) => Object.entries(components(fragment)))),
});
