// The one scenario list for both sides of the look-equality proof (D-33, WEB-02). Group files under ./groups are
// discovered by glob and flattened in file-name order, then declaration order. Each file exports `scenarios`, and the
// group of every scenario equals its file name. Relative imports only: the reference build (02-13) has no @ alias.
import { collectScenarios, type GroupModule } from './collect';
import type { Scenario } from './types';

export { assertSerializable, collectScenarios, type GroupModule } from './collect';

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
