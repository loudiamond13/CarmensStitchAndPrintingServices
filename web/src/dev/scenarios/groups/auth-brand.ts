// Auth brand panel group (plan 04-32, owner rulings OQ-8 and OQ-9; parity: false). One implementation-only case: the S1
// page at the height of the viewport (the real `min-h-dvh` frame, not the parity pair's fixed 960px), so
// web/visual/login-brand.spec.ts can measure the brand panel at any window size and prove that the eyebrow and the
// headline never touch the slab or its stripes, and that their text keeps 4.5:1 against what is behind it. Both themes
// run, because the frame takes the theme of the case frame. It rides along in the rest rows for axe and the CSP guard.
import type { Scenario } from '../types';

export const scenarios: readonly Scenario[] = [
  {
    id: 'login-brand-viewport',
    group: 'auth-brand',
    node: { kind: 'node', component: 'LoginScreen', props: { state: 'default', fit: 'viewport' } },
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: false,
  },
];
