// Legal group (UI-SPEC "Component Showcase additions"; LEGAL-05; plan 12-29). The one scenario here has group 'legal', is Blush
// only (the public look, D-14) and is SPEC-GAP (parity false). It sits in the component showcase, so the /dev/public field
// column the focus E2E uses stays as it is.
//   - `legal-notice`: the DRAFT notice of a legal page (L1).
import type { Scenario, ScenarioNode } from '../types';

function node(component: string): ScenarioNode {
  return { kind: 'node', component, props: {} };
}

export const scenarios: readonly Scenario[] = [
  {
    id: 'legal-notice',
    group: 'legal',
    node: node('LegalNotice'),
    themes: ['light'],
    responsive: true,
    states: ['rest'],
    parity: false,
  },
];
