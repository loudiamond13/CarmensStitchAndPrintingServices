// Lists states group (SPEC-GAP list toolkit, plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → ResponsiveTable,
// Pagination, FilterBar; UI considerations empty / loading / error / refetch / overflow). Every scenario here has group
// 'lists-states' and `parity: false`: the spec draws none of these states, so no reference exists. The parity suite
// still loads each case in the rest rows of Chromium, Firefox and WebKit at every width, where the implementation page
// runs axe and the CSP and console guard (`npm --prefix web run parity -- --grep @lists`); the owner reviews them in the
// D-23 screenshots. They live apart from the compared `lists` cases so that both pages of a compared row hold the same
// cases (see lists.ts).
//   - ResponsiveTable states, through the dev-only ListTableState preview: the first load (SkeletonTable), a failed
//     load (ErrorState above the previous rows), first use ("No users yet" + Add User), no matches (Clear Filters) and a
//     refetch (the previous rows, dimmed after 200 ms).
// Relative imports only: the reference build has no @ alias.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

interface CaseOptions {
  readonly states?: readonly ScenarioState[];
  readonly target?: string;
  readonly handlers?: readonly string[];
}

/** An implementation-only lists case in both themes at every width. */
function stateCase(id: string, node: ScenarioNode, options: CaseOptions = {}): Scenario {
  const { states = ['rest'], target, handlers } = options;
  return {
    id,
    group: 'lists-states',
    node,
    themes: ['light', 'dark'],
    responsive: true,
    states,
    parity: false,
    ...(target === undefined ? {} : { target }),
    ...(handlers === undefined ? {} : { handlers }),
  };
}

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

export const scenarios: readonly Scenario[] = [
  stateCase('rt-loading', node('ListTableState', { state: 'loading' })),
  stateCase('rt-error', node('ListTableState', { state: 'error' })),
  stateCase('rt-empty', node('ListTableState', { state: 'empty' })),
  stateCase('rt-no-matches', node('ListTableState', { state: 'no-matches' })),
  stateCase('rt-refetching', node('ListTableState', { state: 'refetching' })),
];
