// Public layout group (plan 02-29; UI-SPEC "Parity scenarios": the public header and footer of App. E.1 and the
// PublicPlaceholderPage against the App. E.2 page-head fragment with the D-21 copy). Blush only (D-14), at every width.
//   - public-shell: the whole frame, Home current, as PublicLayout renders it (dev-only PublicShell wrapper pair).
//     Hover runs on the header's first visible button: "Get a Quote" from 768px, the menu burger on phones, where the
//     CTA is hidden.
//   - public-placeholder-page: the page head alone.
import type { Scenario } from '../types';

export const scenarios: readonly Scenario[] = [
  {
    id: 'public-shell',
    group: 'layouts-public',
    node: { kind: 'node', component: 'PublicShell', props: { active: 'Home' } },
    themes: ['light'],
    responsive: true,
    states: ['rest', 'hover'],
    parity: true,
    target: 'header button:visible',
  },
  {
    id: 'public-placeholder-page',
    group: 'layouts-public',
    node: { kind: 'node', component: 'PublicShell', props: { header: false, footer: false } },
    themes: ['light'],
    responsive: true,
    states: ['rest'],
    parity: true,
  },
];
