// The shared scenario list (web/src/dev/scenarios), loaded from disk for the parity suite (WEB-02, D-33). The two
// parity pages discover the group files with Vite's import.meta.glob; Playwright has no glob, so the suite imports the
// same files here and flattens them through the same collectScenarios, which rejects a wrong group, a duplicate id and
// any value that is not plain data. The suite therefore plans its matrix from exactly the list the pages render.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectScenarios, type GroupModule } from '../src/dev/scenarios/collect.ts';
import type { Scenario } from '../src/dev/scenarios/types.ts';

/** The folder of the group files (one `<group>.ts` per group). */
export const GROUPS_DIRECTORY = fileURLToPath(new URL('../src/dev/scenarios/groups/', import.meta.url));

/** The group file names, sorted, without test files (the same set index.ts globs). */
export function listGroupFiles(directory: string = GROUPS_DIRECTORY): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();
}

function isGroupModule(value: unknown): value is GroupModule {
  return typeof value === 'object' && value !== null && Array.isArray((value as { scenarios?: unknown }).scenarios);
}

/** Imports every group file and returns the flattened, validated list in file-name order, then declaration order. */
export async function loadScenarios(directory: string = GROUPS_DIRECTORY): Promise<readonly Scenario[]> {
  const modules: Record<string, GroupModule> = {};
  for (const name of listGroupFiles(directory)) {
    const loaded: unknown = await import(pathToFileURL(path.join(directory, name)).href);
    if (!isGroupModule(loaded)) {
      throw new Error(`Scenario group ${name} must export a \`scenarios\` array.`);
    }
    modules[`./groups/${name}`] = loaded;
  }
  return collectScenarios(modules);
}
