// Navigation SPEC-GAP group (plan 02-32; UI-SPEC "SPEC-GAP Primitive Specs" → MobileNavDrawer and UserMenu). Every
// scenario here has group 'navigation-gaps' and `parity: false`: the spec draws neither the user menu popover nor the
// phone drawer, so no reference exists. The parity suite still runs axe, the CSP listener and the console guard on
// them (`--grep @navigation` runs this group with the compared navigation group), and the owner reviews them in the
// D-23 screenshots. They live apart from the compared cases (plan 02-30: compared and implementation-only cases on one
// page caused anti-aliasing noise in the compared frames).
//   - user-menu-open: the Topbar with its user menu opened by a click, as in the admin shell (both themes).
//   - drawer-open: the admin frame on a phone with the navigation drawer opened from the menu button; a fixed overlay,
//     so a viewport frame (both themes).
//   - user-chip-long-name: a 40-character user name in the Sidebar user chip and the Topbar user button, at every
//     width (UI consideration "long-text": it wraps or truncates inside its own box; measured at 320 and 390 by
//     web/visual/navigation-overflow.spec.ts).
import type { Scenario } from '../types';

const GROUP = 'navigation-gaps';

/** A 40-character name with the spaces a real name has (UI-SPEC "UI Considerations" long-text fixture). */
export const LONG_USER_NAME = 'Maria Concepcion Villanueva-Dela Cruz Jr';

export const scenarios: readonly Scenario[] = [
  {
    id: 'user-menu-open',
    group: GROUP,
    node: { kind: 'node', component: 'OpenedUserMenu' },
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: false,
  },
  {
    id: 'drawer-open',
    group: GROUP,
    node: { kind: 'node', component: 'OpenedNavDrawer' },
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: false,
    frame: 'viewport',
  },
  {
    id: 'user-chip-long-name',
    group: GROUP,
    node: { kind: 'node', component: 'LongUserName', props: { name: LONG_USER_NAME } },
    themes: ['light'],
    responsive: true,
    states: ['rest'],
    parity: false,
  },
];
