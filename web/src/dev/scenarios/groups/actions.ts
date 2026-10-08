// Actions group (App. D.3 "Actions": Button, ButtonLink, IconButton). Every scenario here has group 'actions'.
// Conversion plans add their cases to this and the other group files; index.ts discovers the files by glob.
import type { Scenario } from '../types';

export const scenarios: readonly Scenario[] = [
  {
    id: 'button-primary-md',
    group: 'actions',
    node: { kind: 'node', component: 'Button', props: { variant: 'primary', size: 'md', children: 'Save Order' } },
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest', 'hover', 'focus-visible', 'active'],
    parity: true,
  },
];
