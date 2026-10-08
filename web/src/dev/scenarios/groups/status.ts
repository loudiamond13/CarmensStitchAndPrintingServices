// Status group (App. D.3 "Status": Badge, StatusBadge and Avatar; CSPS-UI-SPEC.md §6.2). Every scenario here has group
// 'status'. Plan 02-19:
//   - one Badge per tone, plus the dot and icon forms (the Users table status and the "Manager only" header badge);
//   - one StatusBadge per order status;
//   - the payment method and company expense category badges, each a Badge in the tone the §6.2 tables give it (the
//     tables are PAYMENT_TONE and EXPENSE_TONE in src/ui/status/tones.ts; status.test.tsx checks these props against
//     them, because the scenario list is plain data and cannot import the app);
//   - Avatar at the sizes the screens use.
// All are compared at rest in both themes (a badge has no hover, focus or width-dependent rules).
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

/** A status case compared at rest in both themes, at 390 and 1440 px. */
function statusCase(id: string, node: ScenarioNode): Scenario {
  return {
    id,
    group: 'status',
    node,
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest'],
    parity: true,
  };
}

function badge(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'Badge', props };
}

function statusBadge(status: string): ScenarioNode {
  return { kind: 'node', component: 'StatusBadge', props: { status } };
}

/** Carmen Reyes, the spec §12 seed Manager, at one size. */
function avatar(size: number): ScenarioNode {
  return { kind: 'node', component: 'Avatar', props: { name: 'Carmen Reyes', size } };
}

export const scenarios: readonly Scenario[] = [
  statusCase('badge-neutral', badge({ tone: 'neutral', children: 'Inactive' })),
  statusCase('badge-accent', badge({ tone: 'accent', children: 'Manager' })),
  statusCase('badge-success', badge({ tone: 'success', children: 'Paid' })),
  statusCase('badge-warning', badge({ tone: 'warning', children: 'Due soon' })),
  statusCase('badge-info', badge({ tone: 'info', children: 'New' })),
  statusCase('badge-mockup', badge({ tone: 'mockup', children: 'Mockup' })),
  statusCase('badge-danger', badge({ tone: 'danger', children: 'Overdue' })),
  statusCase('badge-solid', badge({ tone: 'solid', children: 'COVER' })),
  statusCase('badge-success-dot', badge({ tone: 'success', dot: true, children: 'Active' })),
  statusCase('badge-accent-icon', badge({ tone: 'accent', icon: 'shield-check', children: 'Manager only' })),
  statusCase('status-badge-pending', statusBadge('pending')),
  statusCase('status-badge-mockup', statusBadge('mockup')),
  statusCase('status-badge-production', statusBadge('production')),
  statusCase('status-badge-ready', statusBadge('ready')),
  statusCase('status-badge-completed', statusBadge('completed')),
  statusCase('status-badge-cancelled', statusBadge('cancelled')),
  statusCase('payment-badge-gcash', badge({ tone: 'info', children: 'GCash' })),
  statusCase('payment-badge-maya', badge({ tone: 'success', children: 'Maya' })),
  statusCase('payment-badge-cash', badge({ tone: 'neutral', children: 'Cash' })),
  statusCase('payment-badge-bank-transfer', badge({ tone: 'mockup', children: 'Bank Transfer' })),
  statusCase('expense-badge-rent', badge({ tone: 'accent', children: 'Rent' })),
  statusCase('expense-badge-utilities', badge({ tone: 'info', children: 'Utilities' })),
  statusCase('expense-badge-salaries', badge({ tone: 'mockup', children: 'Salaries' })),
  statusCase('expense-badge-supplies', badge({ tone: 'warning', children: 'Supplies' })),
  statusCase('expense-badge-equipment', badge({ tone: 'success', children: 'Equipment' })),
  statusCase('expense-badge-maintenance', badge({ tone: 'neutral', children: 'Maintenance' })),
  statusCase('expense-badge-others', badge({ tone: 'neutral', children: 'Others' })),
  // Avatar at the sizes the shell and the screens use (24, 32, 40) and a larger one (56) that exercises the
  // font-size formula above its 10px floor; 24 sits on the floor (round(24 x .38) = 9 -> 10px).
  statusCase('avatar-24', avatar(24)),
  statusCase('avatar-32', avatar(32)),
  statusCase('avatar-40', avatar(40)),
  statusCase('avatar-56', avatar(56)),
];
