// Choice group (App. D.3 "Forms": SegmentedControl and Tabs; CSPS-UI-SPEC.md §6.3). Every scenario here has group
// 'choice'. Plan 02-19:
//   - SegmentedControl with text options (the discount type), icon-only options (the orders view switch) and icon plus
//     label options (the user role), in both themes.
// The implementation uses a roving tabIndex (only the selected option is in the Tab order, arrow keys move the
// selection), so a focus-visible case targets the selected option: Tab reaches it on both sides. Hover on an
// unselected option (its ink darkens) is a case of its own, with that option as the target.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

const SELECTED_RADIO = '[role="radio"][aria-checked="true"]';
const UNSELECTED_RADIO = '[role="radio"][aria-checked="false"]';

interface ChoiceCase {
  readonly id: string;
  readonly node: ScenarioNode;
  readonly target: string;
  readonly states: readonly ScenarioState[];
}

/** A choice case compared in both themes; the harness drives `states` on `target`. */
function choiceCase({ id, node, target, states }: ChoiceCase): Scenario {
  return {
    id,
    group: 'choice',
    node,
    themes: ['light', 'dark'],
    responsive: false,
    states,
    parity: true,
    handlers: ['onChange'],
    target,
  };
}

function segmented(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'SegmentedControl', props };
}

export const scenarios: readonly Scenario[] = [
  choiceCase({
    id: 'segmented-text',
    node: segmented({
      label: 'Discount type',
      options: [
        { value: 'fixed', label: 'Fixed ₱' },
        { value: 'percentage', label: 'Percent %' },
      ],
    }),
    target: SELECTED_RADIO,
    states: ['rest', 'hover', 'focus-visible'],
  }),
  choiceCase({
    id: 'segmented-icons',
    node: segmented({
      label: 'View',
      options: [
        { value: 'grid', label: 'Grid view', icon: 'layout-grid' },
        { value: 'table', label: 'Table view', icon: 'list' },
      ],
    }),
    target: SELECTED_RADIO,
    states: ['rest', 'hover', 'focus-visible'],
  }),
  choiceCase({
    id: 'segmented-icon-labels',
    node: segmented({
      label: 'Role',
      value: 'manager',
      options: [
        { value: 'admin', label: 'Admin', icon: 'user-round', showLabel: true },
        { value: 'manager', label: 'Manager', icon: 'shield-check', showLabel: true },
      ],
    }),
    target: UNSELECTED_RADIO,
    states: ['rest', 'hover'],
  }),
];
