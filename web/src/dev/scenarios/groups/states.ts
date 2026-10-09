// States group (SPEC-GAP loading, error and image states, plan 02-28; UI-SPEC "SPEC-GAP Primitive Specs" → ErrorState,
// Skeleton family + LoadingRegion, LazyImage). Every scenario here has group 'states' and `parity: false`: the spec
// draws none of these primitives as components, so no reference exists. The parity suite still loads each case in the
// rest rows of Chromium, Firefox and WebKit, where the implementation page runs axe and the CSP and console guard
// (`npm --prefix web run parity -- --grep @states`); the owner reviews them in the D-23 screenshots. The states are
// listed for the showcase; the harness never drives them on a `parity: false` case.
//   - ErrorState (App. E.8): a failed orders load with "Try Again" (`onRetry` gets a no-op), and the same banner for
//     an HttpError carrying a traceId, through the dev-only TracedErrorState wrapper (an HttpError is not plain data).
//   - Skeleton family: SkeletonText, the App. E.8 SkeletonCard and a 4 / 3 SkeletonImage. They shimmer, so each also
//     runs the reduced-motion pass (O-6: the shimmer stops).
//   - LoadingRegion: a first load of orders (aria-busy, "Loading orders…") around a SkeletonCard.
//   - LazyImage: still loading (the full-box Skeleton) and failed (the chip-less MediaPlaceholder named by the alt),
//     through the dev-only PendingLazyImage and FailedLazyImage wrappers, which hold the image in that state without a
//     network request.
// Copy is typed out here (relative imports only: the reference build has no @ alias); the tests pin it to copy.ts.
import type { Scenario, ScenarioNode, ScenarioPass, ScenarioProps, ScenarioState } from '../types';

const BANNER_STATES: readonly ScenarioState[] = ['rest', 'focus-visible'];
const STILL: readonly ScenarioState[] = ['rest'];
const JERSEY = 'Brgy. San Roque Ballers jersey, front';

interface StatesCase {
  readonly id: string;
  readonly component: string;
  readonly props: ScenarioProps;
  readonly states: readonly ScenarioState[];
  readonly target?: string;
  readonly handlers?: readonly string[];
  readonly passes?: readonly ScenarioPass[];
}

/** An implementation-only states case in both themes at every width. */
function statesCase({ id, component, props, states, target, handlers, passes }: StatesCase): Scenario {
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
    ...(passes === undefined ? {} : { passes }),
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
  statesCase({ id: 'skeleton-text', component: 'SkeletonText', props: {}, states: STILL, passes: ['motion'] }),
  statesCase({ id: 'skeleton-card', component: 'SkeletonCard', props: {}, states: STILL, passes: ['motion'] }),
  statesCase({
    id: 'skeleton-image',
    component: 'SkeletonImage',
    props: { ratio: '4 / 3' },
    states: STILL,
    passes: ['motion'],
  }),
  statesCase({
    id: 'loading-region',
    component: 'LoadingRegion',
    props: { loading: true, things: 'orders', children: { kind: 'node', component: 'SkeletonCard' } },
    states: STILL,
  }),
  statesCase({ id: 'lazy-image-loading', component: 'PendingLazyImage', props: { alt: JERSEY }, states: STILL }),
  statesCase({ id: 'lazy-image-error', component: 'FailedLazyImage', props: { alt: JERSEY }, states: STILL }),
];
