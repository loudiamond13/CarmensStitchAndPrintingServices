// States group (SPEC-GAP loading, error and image states, plan 02-28; UI-SPEC "SPEC-GAP Primitive Specs" → ErrorState,
// Skeleton family + LoadingRegion, LazyImage). Every scenario here has group 'states' and `parity: false`: the spec
// draws none of these primitives as components, so no reference exists. The parity suite still loads each case in the
// rest rows of Chromium, Firefox and WebKit, where the implementation page runs axe and the CSP and console guard
// (`npm --prefix web run parity -- --grep @states`); the owner reviews them in the D-23 screenshots. The states are
// listed for the showcase; the harness never drives them on a `parity: false` case.
//   - ErrorState (App. E.8): a failed orders load with "Try Again" (`onRetry` gets a no-op), and the same banner for
//     an HttpError carrying a traceId, through the dev-only TracedErrorState wrapper (an HttpError is not plain data).
// Copy is typed out here (relative imports only: the reference build has no @ alias); the tests pin it to copy.ts.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

const BANNER_STATES: readonly ScenarioState[] = ['rest', 'focus-visible'];

interface StatesCase {
  readonly id: string;
  readonly component: string;
  readonly props: ScenarioProps;
  readonly states: readonly ScenarioState[];
  readonly target?: string;
  readonly handlers?: readonly string[];
}

/** An implementation-only states case in both themes at every width. */
function statesCase({ id, component, props, states, target, handlers }: StatesCase): Scenario {
  const node: ScenarioNode = { kind: 'node', component, props };
  return {
    id,
    group: 'states',
    node,
    themes: ['light', 'dark'],
    responsive: true,
    states,
    parity: false,
    ...(target === undefined ? {} : { target }),
    ...(handlers === undefined ? {} : { handlers }),
  };
}

export const scenarios: readonly Scenario[] = [
  statesCase({
    id: 'error-state-orders',
    component: 'ErrorState',
    props: { things: 'orders' },
    states: BANNER_STATES,
    target: 'button',
    handlers: ['onRetry'],
  }),
  statesCase({
    id: 'error-state-trace',
    component: 'TracedErrorState',
    props: { things: 'orders', traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-01' },
    states: BANNER_STATES,
    target: 'button',
    handlers: ['onRetry'],
  }),
];
