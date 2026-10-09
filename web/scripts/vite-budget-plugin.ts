// PERF-01 budget plugin. Not implemented yet (TDD RED stub).
import type { Plugin } from 'vite';

export interface BudgetPluginOptions {
  readonly devRoutes: boolean;
  readonly reportDir?: string;
}

export interface BudgetPluginApi {
  readonly devRoutes: boolean;
}

export function budgetPlugin(options: BudgetPluginOptions): Plugin {
  return { name: options.devRoutes ? 'csps-budget-stub' : 'csps-budget-stub' };
}
