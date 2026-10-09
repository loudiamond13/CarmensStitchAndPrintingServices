// Lists group (SPEC-GAP list toolkit, plan 02-30; UI-SPEC "SPEC-GAP Primitive Specs" → ResponsiveTable, Pagination,
// SearchBox, FilterBar; spec §8.4, App. E.7 toolbar and App. E.12 list-table markup). Every scenario here has group
// 'lists'. Compared with the approved design (parity true) at 320/390/820/1440 in Chromium and 390/1440 in Firefox and
// WebKit, in both themes:
//   - rt-users-populated: the App. E.12 Users table with the spec §12.1 seed (Carmen Reyes, the signed-in Manager, is
//     "You" with Edit only; Jomar Santos is inactive, on --surface-2 by owner ruling D-02), as a table on desktop, a
//     table scrolling inside its frame on tablets and stacked cards on phones (the last card's title has no rule,
//     D-38). Also on hover of Paolo Garcia's row. The ListTable wrapper pair renders it: the implementation through
//     ResponsiveTable, the reference as a transcription of App. E.12 (web/visual/reference/fragments/ListTable.tsx).
//   - rt-long-name: the same table with a 40-character name in the card title.
//   - toolbar-orders: the App. E.7 Orders toolbar (role="search", data-ui="s-toolbar"): the SearchBox, the Status,
//     Order date, Product type and Sort by Selects at their App. E.7 values, and the grid/table SegmentedControl in the
//     toolbar end. The Toolbar wrapper pair renders it: the implementation through FilterBar, SearchBox, Select and
//     SegmentedControl, the reference as a transcription of App. E.7 (web/visual/reference/fragments/Toolbar.tsx).
// The SPEC-GAP list states (parity false) are in the lists-states group: rendered on the same page as these cases, their
// extra height changed how Chromium rasterized the 1440px frame's right-edge corners (1-level anti-aliasing noise on
// x 1438-1439 in about half the runs, with equal computed styles); in a group of their own both pages hold only
// compared cases. `--grep @lists` runs both groups.
// Relative imports only: the reference build has no @ alias.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

/** Spec §12.1 Users, in the App. E.12 order; Carmen Reyes is the signed-in user (`me`). */
export const SEED_USERS: readonly ScenarioProps[] = [
  {
    first: 'Carmen',
    last: 'Reyes',
    email: 'carmen.reyes.csp@gmail.com',
    role: 'Manager',
    active: true,
    created: '2026-01-12',
    me: true,
  },
  {
    first: 'Paolo',
    last: 'Garcia',
    email: 'paolo.garcia@gmail.com',
    role: 'Admin',
    active: true,
    created: '2026-02-03',
  },
  {
    first: 'Liza',
    last: 'Mercado',
    email: 'lizamercado09@gmail.com',
    role: 'Admin',
    active: true,
    created: '2026-03-18',
  },
  {
    first: 'Rhea',
    last: 'Villanueva',
    email: 'rhea.villanueva@gmail.com',
    role: 'Manager',
    active: true,
    created: '2026-06-21',
  },
  {
    first: 'Jomar',
    last: 'Santos',
    email: 'jomar.santos@yahoo.com',
    role: 'Admin',
    active: false,
    created: '2026-04-02',
  },
];

/** A 40-character name (16 + 1 + 23) next to the signed-in user, for the card-title wrap. */
export const LONG_NAME_USERS: readonly ScenarioProps[] = [
  SEED_USERS[0] ?? {},
  {
    first: 'Maria Concepcion',
    last: 'Villanueva-Dela Cruzada',
    email: 'maria.villanueva.delacruzada@gmail.com',
    role: 'Admin',
    active: true,
    created: '2026-09-30',
  },
];

interface CaseOptions {
  readonly parity: boolean;
  readonly states?: readonly ScenarioState[];
  readonly target?: string;
  readonly handlers?: readonly string[];
}

/** A lists case in both themes at every width. */
function listCase(id: string, node: ScenarioNode, options: CaseOptions): Scenario {
  const { parity, states = ['rest'], target, handlers } = options;
  return {
    id,
    group: 'lists',
    node,
    themes: ['light', 'dark'],
    responsive: true,
    states,
    parity,
    ...(target === undefined ? {} : { target }),
    ...(handlers === undefined ? {} : { handlers }),
  };
}

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

export const scenarios: readonly Scenario[] = [
  listCase('rt-users-populated', node('ListTable', { users: SEED_USERS }), {
    parity: true,
    states: ['rest', 'hover'],
    target: 'tbody tr:nth-child(2)',
  }),
  listCase('rt-long-name', node('ListTable', { users: LONG_NAME_USERS }), { parity: true }),
  listCase('toolbar-orders', node('Toolbar', {}), { parity: true }),
];
