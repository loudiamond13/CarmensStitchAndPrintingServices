// Feedback group (App. D.3 "Feedback": EmptyState, Skeleton and Toast; CSPS-UI-SPEC.md §6.5). Every scenario here has
// group 'feedback'. Plan 02-21:
//   - EmptyState with the two App. E.8 list copies (UI-SPEC Copywriting Contract): first use ("No orders yet" with a
//     primary "New Order") and no matches ("No matches" with a secondary "Clear Filters"), at every width. App. D.3
//     renders the title as an h3; the converted EmptyState takes the heading level as a prop (default h2, A11Y-02), so
//     these cases pass `level: 3` and both sides render the same element. The frozen App. D.3 EmptyState ignores it.
// Each case is compared in both themes at rest (the action buttons' states are proven in the actions group).
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

/** A feedback case compared in both themes at rest. */
function feedbackCase(id: string, node: ScenarioNode, responsive: boolean): Scenario {
  return {
    id,
    group: 'feedback',
    node,
    themes: ['light', 'dark'],
    responsive,
    states: ['rest'],
    parity: true,
  };
}

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

export const scenarios: readonly Scenario[] = [
  feedbackCase(
    'empty-first-use',
    node('EmptyState', {
      icon: 'clipboard-list',
      title: 'No orders yet',
      message: 'Create your first order to start tracking items, payments and balances.',
      action: node('Button', { variant: 'primary', icon: 'plus', children: 'New Order' }),
      level: 3,
    }),
    true,
  ),
  feedbackCase(
    'empty-no-matches',
    node('EmptyState', {
      icon: 'search',
      title: 'No matches',
      message: 'No orders match “Ballers” with status Ready. Try another search or clear the filters.',
      action: node('Button', { variant: 'secondary', children: 'Clear Filters' }),
      level: 3,
    }),
    true,
  ),
];
