import type { Scenario } from './types';

// RED stub (plan 02-38 Task 1): an empty list and an inert guard.
export const scenarios: readonly Scenario[] = [];

export function scenarioById(id: string): Scenario {
  throw new Error(`Unknown scenario id: ${id}`);
}

export function assertSerializable(scenario: Scenario): void {
  void scenario;
}
