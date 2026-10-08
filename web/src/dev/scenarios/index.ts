// The one scenario list for both sides of the look-equality proof (D-33, WEB-02). Group files under ./groups are
// discovered by glob and flattened in file-name order, then declaration order. Each file exports `scenarios`, and the
// group of every scenario equals its file name. Relative imports only: the reference build (02-13) has no @ alias.
import type { Scenario } from './types';

export interface GroupModule {
  readonly scenarios: readonly Scenario[];
}

const PLAIN_DATA =
  'scenarios must be plain data (strings, finite numbers, booleans, null, arrays, plain objects, nodes)';

function fail(id: string, path: string, what: string): never {
  throw new Error(`Scenario "${id}": prop "${path}" is ${what}; ${PLAIN_DATA}.`);
}

function checkValue(id: string, path: string, value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail(id, path, 'a non-finite number');
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      checkValue(id, `${path}[${String(index)}]`, item);
    });
    return;
  }
  if (typeof value === 'object') {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      fail(id, path, `a class instance (${Object.prototype.toString.call(value)})`);
    }
    for (const [key, item] of Object.entries(value)) {
      checkValue(id, `${path}.${key}`, item);
    }
    return;
  }
  fail(id, path, typeof value === 'function' ? 'a function' : `a ${typeof value}`);
}

/**
 * Throws when any prop value anywhere in the scenario's tree is not plain data: a function, a class instance, a
 * symbol, undefined, a bigint or a non-finite number. The message names the scenario id and the path to the prop.
 */
export function assertSerializable(scenario: Scenario): void {
  const props: unknown = scenario.node.props ?? {};
  if (typeof props !== 'object' || props === null) {
    fail(scenario.id, 'props', 'not an object');
  }
  for (const [key, value] of Object.entries(props)) {
    checkValue(scenario.id, key, value);
  }
}

function groupOf(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.ts$/, '');
}

/**
 * Flattens group modules (keyed by path, as the Vite glob import returns them) in file-name order, and rejects a scenario
 * whose group differs from its file name, a duplicate id, or a scenario that is not plain data.
 */
export function collectScenarios(modules: Readonly<Record<string, GroupModule>>): readonly Scenario[] {
  const list: Scenario[] = [];
  const seen = new Set<string>();
  const paths = Object.keys(modules).sort();
  for (const path of paths) {
    const group = groupOf(path);
    for (const scenario of modules[path]?.scenarios ?? []) {
      if (scenario.group !== group) {
        throw new Error(`Scenario "${scenario.id}" is declared in ${path}, so its group must be "${group}".`);
      }
      if (seen.has(scenario.id)) {
        throw new Error(`Scenario id "${scenario.id}" is declared more than once.`);
      }
      seen.add(scenario.id);
      assertSerializable(scenario);
      list.push(scenario);
    }
  }
  return list;
}

export const scenarios: readonly Scenario[] = collectScenarios(
  import.meta.glob<GroupModule>(['./groups/*.ts', '!./groups/*.test.ts'], { eager: true }),
);

const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

/** The scenario with this id. Throws a plain Error naming an unknown id. */
export function scenarioById(id: string): Scenario {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`Unknown scenario id: "${id}".`);
  }
  return scenario;
}
