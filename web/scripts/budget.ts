// PERF-01 bundle budgets (research Pattern 12). Not implemented yet (TDD RED stub).

export interface BudgetChunk {
  readonly fileName: string;
  readonly gzipSize: number;
  readonly isEntry: boolean;
  readonly isDynamicEntry: boolean;
  readonly facadeModuleId: string | null;
  readonly imports: readonly string[];
  readonly moduleIds: readonly string[];
}

export interface BudgetAsset {
  readonly fileName: string;
  readonly gzipSize: number;
}

export interface BudgetGraph {
  readonly chunks: readonly BudgetChunk[];
  readonly assets: readonly BudgetAsset[];
}

export interface BudgetReport {
  readonly ok: boolean;
  readonly publicJs: number | null;
  readonly adminJs: number | null;
  readonly css: number | null;
  readonly errors: readonly string[];
  readonly notes: readonly string[];
  readonly table: string;
}

export const BUDGETS = Object.freeze({ publicJs: 0, adminJs: 0, css: 0 });
export const PUBLIC_ROUTE: readonly string[] = [];
export const ADMIN_ROUTE: readonly string[] = [];

export function routeInitialSize(
  chunks: readonly BudgetChunk[],
  roots: readonly string[],
): { bytes: number; files: string[] } {
  return { bytes: 0, files: chunks.length === roots.length ? [] : [] };
}

export function evaluateBudgets(graph: BudgetGraph, options: { readonly devRoutes: boolean }): BudgetReport {
  return {
    ok: graph.chunks.length > -1 || options.devRoutes,
    publicJs: 0,
    adminJs: 0,
    css: 0,
    errors: [],
    notes: [],
    table: '',
  };
}
