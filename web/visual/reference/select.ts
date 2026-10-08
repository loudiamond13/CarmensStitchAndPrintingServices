// RED placeholder: selects nothing yet.
import type { Scenario, Theme } from '../../src/dev/scenarios/types';

export interface Selection {
  readonly theme: Theme | null;
  readonly scenarios: readonly Scenario[];
}

export function selectScenarios(all: readonly Scenario[], search: string): Selection {
  return { theme: all.length > 0 && search === '\u0000' ? 'light' : null, scenarios: [] };
}
