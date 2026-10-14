// The one renderer for both sides of the look-equality proof (D-33, WEB-02): the reference app (frozen App. D.3
// components, plan 02-13) and the implementation showcase (plan 02-14) pass their own kit and the same scenario node.
// Relative imports only: the reference build has no @ alias.
import { createElement, type ComponentType, type Key, type ReactElement } from 'react';
import type { ScenarioNode, ScenarioValue } from './scenarios/types';

/** Component name → component. Any component fits; renderNode narrows at the one call site. */
export type Kit = Readonly<Record<string, ComponentType<never>>>;

type RenderedProps = Record<string, unknown>;

function noop(): undefined {
  return undefined;
}

function isNode(value: ScenarioValue): value is ScenarioNode {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'node';
}

function toProp(kit: Kit, value: ScenarioValue, handlers: readonly string[], key?: Key): unknown {
  if (isNode(value)) {
    return renderNode(kit, value, handlers, key);
  }
  if (Array.isArray(value)) {
    // Elements in an array are keyed by position; the list is static data, so the order never changes.
    return value.map((item: ScenarioValue, index) => toProp(kit, item, handlers, index));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, toProp(kit, item, handlers)]));
  }
  return value;
}

/**
 * Builds the React element for a scenario node with createElement. Nested ScenarioNode prop values (alone, in arrays
 * or in plain objects) become elements; every prop name in `handlers` receives a no-op function on every node in the
 * tree; a component the kit does not have renders a visible alert instead of nothing.
 */
export function renderNode(kit: Kit, node: ScenarioNode, handlers: readonly string[], key?: Key): ReactElement {
  const component = kit[node.component];
  if (component === undefined) {
    return (
      <p role="alert" key={key}>
        {`Missing component: ${node.component}`}
      </p>
    );
  }
  const props: RenderedProps = {};
  for (const [name, value] of Object.entries(node.props ?? {})) {
    props[name] = toProp(kit, value, handlers);
  }
  for (const name of handlers) {
    props[name] = noop;
  }
  if (key !== undefined) {
    props.key = key;
  }
  // The kit holds components of every props shape (ComponentType<never>); scenario props are checked as plain data
  // by assertSerializable, so the element is built from an untyped props record here.
  return createElement(component as ComponentType<RenderedProps>, props);
}
