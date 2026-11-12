// Public layout group (plan 02-29; UI-SPEC "Parity scenarios": the public header and footer of App. E.1 and the inner-page
// head of App. E.3). Blush only (D-14), at every width.
//   - public-shell: the whole frame, Home current, as PublicLayout renders it (dev-only PublicShell wrapper pair): the
//     header, the Gallery page head and the footer. Hover runs on the header's first visible button: "Get a Quote" from
//     768px, the menu burger on phones, where the CTA is hidden.
// Plan 11-08 retired the placeholder page-head case with the placeholder page.
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
];
