// The scenario data model shared by both sides of the look-equality proof (D-33, WEB-02). The reference app (frozen
// App. D.3 components, plan 02-13) and the implementation showcase (plan 02-14) render the same list through the same
// renderNode, so everything here is plain data that two separate builds can import. No functions, no class instances.

/** The two themes: Blush (light) and Espresso (dark). */
export type Theme = 'light' | 'dark';

/** Interaction states the parity harness drives with the mouse or keyboard. Prop states are separate scenarios. */
export type ScenarioState = 'rest' | 'hover' | 'focus-visible' | 'active';

/** Extra passes: one with `reducedMotion: 'reduce'` (O-6) and one with touch / no-hover (D-05). */
export type ScenarioPass = 'motion' | 'touch';

/**
 * How a case is framed: `block` (the default) is a fixed-width `[data-case]` frame compared as a locator screenshot;
 * `viewport` is for fixed-position overlays, rendered one case per page load and compared as a full-viewport shot.
 */
export type ScenarioFrame = 'block' | 'viewport';

/** One element in a scenario tree: a component name from the kit and its plain-data props. */
export interface ScenarioNode {
  readonly kind: 'node';
  readonly component: string;
  readonly props?: ScenarioProps;
}

/** A plain-data prop value. A nested ScenarioNode becomes a React element when rendered. */
export type ScenarioValue =
  | string
  | number
  | boolean
  | null
  | ScenarioNode
  | readonly ScenarioValue[]
  | { readonly [key: string]: ScenarioValue };

export type ScenarioProps = Readonly<Record<string, ScenarioValue>>;

export interface Scenario {
  /** Unique across the whole list; the `[data-case]` value on both sides. */
  readonly id: string;
  /** Equals the name of the groups/*.ts file that declares the scenario. */
  readonly group: string;
  readonly node: ScenarioNode;
  readonly themes: readonly Theme[];
  /** True when the case is compared at 320/390/820/1440 (pg-*, vp-*, md: utilities and layouts). */
  readonly responsive: boolean;
  readonly states: readonly ScenarioState[];
  /** False for SPEC-GAP primitives (no reference exists); they still run axe and the CSP listener. */
  readonly parity: boolean;
  /** Prop names that receive no-op callbacks when rendered (onClick, onChange, ...). */
  readonly handlers?: readonly string[];
  /** Selector, relative to the case root, of the element the harness hovers, focuses or presses. */
  readonly target?: string;
  readonly passes?: readonly ScenarioPass[];
  readonly frame?: ScenarioFrame;
}
