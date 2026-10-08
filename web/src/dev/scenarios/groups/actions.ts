// Actions group (App. D.3 "Actions": Button and ButtonLink). Every scenario here has group 'actions'.
// Conversion plans add their cases to this and the other group files; index.ts discovers the files by glob.
// Plan 02-17: one Button case per variant and size, icon-only sm and md, an icon on each side, block, and the two prop
// states (disabled, and pending through App. D.3's `loading`, which the reference Button also understands: plan 02-14).
// Prop states are compared at rest only; every other case at rest, hover, focus-visible and active.
import type { Scenario, ScenarioProps, ScenarioState } from '../types';

const ALL_STATES: readonly ScenarioState[] = ['rest', 'hover', 'focus-visible', 'active'];

interface ButtonCase {
  readonly id: string;
  readonly props: ScenarioProps;
  readonly states?: readonly ScenarioState[];
}

/** A Button case compared in both themes, never responsive (a button has no width-dependent rules). */
function buttonCase({ id, props, states = ALL_STATES }: ButtonCase): Scenario {
  return {
    id,
    group: 'actions',
    node: { kind: 'node', component: 'Button', props },
    themes: ['light', 'dark'],
    responsive: false,
    states,
    parity: true,
  };
}

export const scenarios: readonly Scenario[] = [
  buttonCase({ id: 'button-primary-sm', props: { variant: 'primary', size: 'sm', children: 'Save Order' } }),
  buttonCase({ id: 'button-primary-md', props: { variant: 'primary', size: 'md', children: 'Save Order' } }),
  buttonCase({ id: 'button-primary-lg', props: { variant: 'primary', size: 'lg', children: 'Save Order' } }),
  buttonCase({ id: 'button-secondary-sm', props: { variant: 'secondary', size: 'sm', children: 'Cancel' } }),
  buttonCase({ id: 'button-secondary-md', props: { variant: 'secondary', size: 'md', children: 'Cancel' } }),
  buttonCase({ id: 'button-secondary-lg', props: { variant: 'secondary', size: 'lg', children: 'Cancel' } }),
  buttonCase({ id: 'button-ghost-sm', props: { variant: 'ghost', size: 'sm', children: 'View All' } }),
  buttonCase({ id: 'button-ghost-md', props: { variant: 'ghost', size: 'md', children: 'View All' } }),
  buttonCase({ id: 'button-ghost-lg', props: { variant: 'ghost', size: 'lg', children: 'View All' } }),
  buttonCase({ id: 'button-danger-sm', props: { variant: 'danger', size: 'sm', children: 'Delete Order' } }),
  buttonCase({ id: 'button-danger-md', props: { variant: 'danger', size: 'md', children: 'Delete Order' } }),
  buttonCase({ id: 'button-danger-lg', props: { variant: 'danger', size: 'lg', children: 'Delete Order' } }),
  buttonCase({ id: 'button-ghost-danger-sm', props: { variant: 'ghost-danger', size: 'sm', children: 'Remove' } }),
  buttonCase({ id: 'button-ghost-danger-md', props: { variant: 'ghost-danger', size: 'md', children: 'Remove' } }),
  buttonCase({ id: 'button-ghost-danger-lg', props: { variant: 'ghost-danger', size: 'lg', children: 'Remove' } }),
  buttonCase({
    id: 'button-icon-only-sm',
    props: { variant: 'secondary', size: 'sm', icon: 'pencil', 'aria-label': 'Edit' },
  }),
  buttonCase({ id: 'button-icon-only-md', props: { variant: 'ghost', size: 'md', icon: 'x', 'aria-label': 'Close' } }),
  buttonCase({
    id: 'button-icon-left',
    props: { variant: 'primary', size: 'md', icon: 'plus', children: 'New Order' },
  }),
  buttonCase({
    id: 'button-icon-right',
    props: { variant: 'secondary', size: 'md', iconRight: 'arrow-right', children: 'Next' },
  }),
  buttonCase({ id: 'button-block', props: { variant: 'primary', size: 'lg', block: true, children: 'Continue' } }),
  buttonCase({
    id: 'button-disabled',
    props: { variant: 'primary', size: 'md', disabled: true, children: 'Save Order' },
    states: ['rest'],
  }),
  buttonCase({
    id: 'button-pending',
    props: { variant: 'primary', size: 'md', loading: true, icon: 'plus', children: 'Saving' },
    states: ['rest'],
  }),
];
