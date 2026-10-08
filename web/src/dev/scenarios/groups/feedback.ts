// Feedback group (App. D.3 "Feedback": EmptyState, Skeleton and Toast; CSPS-UI-SPEC.md §6.5). Every scenario here has
// group 'feedback'. Plan 02-21:
//   - EmptyState with the two App. E.8 list copies (UI-SPEC Copywriting Contract): first use ("No orders yet" with a
//     primary "New Order") and no matches ("No matches" with a secondary "Clear Filters"), at every width. App. D.3
//     renders the title as an h3; the converted EmptyState takes the heading level as a prop (default h2, A11Y-02), so
//     these cases pass `level: 3` and both sides render the same element. The frozen App. D.3 EmptyState ignores it.
//   - Skeleton as a text line (default 6px radius) and as a sized block (number width, 12px radius);
//   - Toast in each tone with the Copywriting Contract copy, and one with a long two-line message. Every toast has the
//     "Dismiss" button (`onClose`); the success toast is also compared with the button hovered and keyboard-focused.
// Each case is compared in both themes at rest (the action buttons' states are proven in the actions group). Skeleton
// and Toast also run the reduced-motion pass, where the shimmer and the entry animation stop on both sides (D-31 O-6).
import type { Scenario, ScenarioNode, ScenarioPass, ScenarioProps, ScenarioState } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

interface CaseOptions {
  readonly responsive?: boolean;
  readonly states?: readonly ScenarioState[];
  readonly passes?: readonly ScenarioPass[];
  readonly handlers?: readonly string[];
  readonly target?: string;
}

/** A feedback case compared in both themes (at rest unless `states` says more). */
function feedbackCase(id: string, node: ScenarioNode, options: CaseOptions = {}): Scenario {
  const { responsive = false, states = ['rest'], passes, handlers, target } = options;
  return {
    id,
    group: 'feedback',
    node,
    themes: ['light', 'dark'],
    responsive,
    states,
    parity: true,
    ...(passes === undefined ? {} : { passes }),
    ...(handlers === undefined ? {} : { handlers }),
    ...(target === undefined ? {} : { target }),
  };
}

const MOTION: readonly ScenarioPass[] = ['motion'];

/** A toast with its Dismiss button (a no-op `onClose` on both sides), in the reduced-motion pass too. */
function toastCase(id: string, props: ScenarioProps, states: readonly ScenarioState[] = ['rest']): Scenario {
  return feedbackCase(id, node('Toast', props), {
    states,
    passes: MOTION,
    handlers: ['onClose'],
    ...(states.length > 1 ? { target: 'button' } : {}),
  });
}

export const scenarios: readonly Scenario[] = [
  feedbackCase(
    'empty-first-use',
    node('EmptyState', {
      icon: 'clipboard-list',
      title: 'No orders yet',
      message: 'Create your first order to start tracking items, payments and balances.',
      action: node('Button', { variant: 'primary', icon: 'plus', children: 'New Order' }),
      level: 3,
    }),
    { responsive: true },
  ),
  feedbackCase(
    'empty-no-matches',
    node('EmptyState', {
      icon: 'search',
      title: 'No matches',
      message: 'No orders match “Ballers” with status Ready. Try another search or clear the filters.',
      action: node('Button', { variant: 'secondary', children: 'Clear Filters' }),
      level: 3,
    }),
    { responsive: true },
  ),
  feedbackCase('skeleton-line', node('Skeleton', { width: '75%', height: 22 }), { passes: MOTION }),
  feedbackCase('skeleton-block', node('Skeleton', { width: 240, height: 180, radius: 12 }), { passes: MOTION }),
  toastCase('toast-success', { tone: 'success', title: 'Payment added', message: 'Balance now ₱4,327.50' }, [
    'rest',
    'hover',
    'focus-visible',
  ]),
  toastCase('toast-info', {
    tone: 'info',
    title: 'Not available yet',
    message: 'Sign-out comes with the sign-in phase.',
  }),
  toastCase('toast-warning', {
    tone: 'warning',
    title: 'Someone else changed this',
    message: 'Reload to see the latest version, then make your change again.',
  }),
  toastCase('toast-danger', {
    tone: 'danger',
    title: "Couldn't save order",
    message: "ORD-2026-0148 wasn't saved. Check your connection and try again.",
  }),
  toastCase('toast-long-copy', {
    tone: 'success',
    title: 'Order ORD-2026-0148 deleted',
    message: 'Its items, payments, discounts, expenses and images were removed. Reference: 4bf92f3577b34da6.',
  }),
];
