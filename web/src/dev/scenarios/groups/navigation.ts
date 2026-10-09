// Navigation group (App. D.3 "Navigation": Sidebar, SiteHeader and Topbar; CSPS-UI-SPEC.md §6.6, §8.1). Every scenario
// here has group 'navigation'. Plan 02-26:
//   - Sidebar (admin, Blush and Espresso) for the dev user Carmen Reyes (Manager, spec §12.1): Dashboard current (the
//     Users row keeps its "Manager" tag), Users current (the tag is hidden on the current row, D-31 D-BL-02) and the
//     collapsed rail. Hover and keyboard focus run on an unselected link, on the current link (hover keeps the current
//     look) and on the collapsed Logout button (D-27).
// The user role goes through a typed constant, never a literal role prop (L-20).
// The D-27 Logout `<button>` pairs with the approved `<a href="#">` through the registry
// (web/visual/intentional-differences.ts): `[data-case] > aside > foot > Logout` is path 0/0/2/1 with the user chip
// before it, and 0/0/2/0 on the collapsed sidebar, which shows no chip.
import type { Role } from '../../../lib/csps';
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

const MANAGER: Role = 'manager';
const CARMEN = { name: 'Carmen Reyes' };
const SIDEBAR_STATES: readonly ScenarioState[] = ['rest', 'hover', 'focus-visible'];

interface SidebarCase {
  readonly id: string;
  readonly props: ScenarioProps;
  readonly target: string;
}

function sidebar(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'Sidebar', props };
}

/** A Sidebar case in both themes; the harness drives hover and keyboard focus on `target`. */
function sidebarCase({ id, props, target }: SidebarCase): Scenario {
  return {
    id,
    group: 'navigation',
    node: sidebar(props),
    themes: ['light', 'dark'],
    responsive: false,
    states: SIDEBAR_STATES,
    parity: true,
    handlers: ['onNavigate', 'onLogout'],
    target,
  };
}

export const scenarios: readonly Scenario[] = [
  sidebarCase({
    id: 'sidebar-dashboard-current',
    props: { active: 'dashboard', role: MANAGER, user: CARMEN },
    target: 'a[href="/admin/orders"]',
  }),
  sidebarCase({
    id: 'sidebar-users-current',
    props: { active: 'users', role: MANAGER, user: CARMEN },
    target: 'a[aria-current="page"]',
  }),
  sidebarCase({
    id: 'sidebar-collapsed',
    props: { active: 'dashboard', role: MANAGER, user: CARMEN, collapsed: true },
    target: '[title="Logout"]',
  }),
];
