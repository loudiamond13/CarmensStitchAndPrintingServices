// Brand group (App. D.3 "Brand": Mark and Logo, CSPS-UI-SPEC.md §4). Every scenario here has group 'brand'.
// Plan 02-18: the [C]SPS lockup in its three sizes (spec §4.2), the sidebar forms (no tagline, mark only), the wordmark,
// and the bare Mark. Both themes, because the Espresso theme recolours the Mark's ring and stitch through the
// --csp-mark-* tokens. A brand element has no interaction states and no width-dependent rules, so every case is
// compared at rest, at 390 and 1440 px.
import type { Scenario, ScenarioNode } from '../types';

/** A brand case compared at rest in both themes. */
function brandCase(id: string, node: ScenarioNode): Scenario {
  return {
    id,
    group: 'brand',
    node,
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: true,
  };
}

export const scenarios: readonly Scenario[] = [
  brandCase('logo-sm', { kind: 'node', component: 'Logo', props: { size: 'sm' } }),
  brandCase('logo-md', { kind: 'node', component: 'Logo', props: { size: 'md' } }),
  brandCase('logo-lg', { kind: 'node', component: 'Logo', props: { size: 'lg' } }),
  brandCase('logo-sm-no-tagline', { kind: 'node', component: 'Logo', props: { size: 'sm', tagline: false } }),
  brandCase('logo-mark-sm', { kind: 'node', component: 'Logo', props: { size: 'sm', variant: 'mark' } }),
  brandCase('logo-wordmark-md', { kind: 'node', component: 'Logo', props: { size: 'md', variant: 'wordmark' } }),
  brandCase('mark-48', { kind: 'node', component: 'Mark', props: { size: 48 } }),
];
