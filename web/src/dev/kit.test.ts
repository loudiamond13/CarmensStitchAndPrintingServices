// Kit completeness (WEB-02, D-33): every component name any scenario uses, at any depth of its node tree, resolves in
// the implementation kit, so neither the showcase (/dev/components) nor the parity page ever renders the
// "Missing component" alert.
import { describe, expect, it } from 'vitest';
import { kit } from './kit';
import { scenarios } from './scenarios';
import type { ScenarioNode, ScenarioValue } from './scenarios/types';

function isNode(value: ScenarioValue): value is ScenarioNode {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'node';
}

/** Every component name in a prop value: nested nodes, alone, in arrays or in plain objects. */
function namesInValue(value: ScenarioValue): string[] {
  if (isNode(value)) {
    return namesInNode(value);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: ScenarioValue) => namesInValue(item));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item: ScenarioValue) => namesInValue(item));
  }
  return [];
}

function namesInNode(node: ScenarioNode): string[] {
  return [node.component, ...Object.values(node.props ?? {}).flatMap((value) => namesInValue(value))];
}

describe('implementation kit', () => {
  it('walks nested nodes in props, arrays and plain objects', () => {
    const tree: ScenarioNode = {
      kind: 'node',
      component: 'A',
      props: {
        child: { kind: 'node', component: 'B' },
        list: ['text', { kind: 'node', component: 'C' }],
        nested: { inner: { kind: 'node', component: 'D', props: { deeper: [{ kind: 'node', component: 'E' }] } } },
        plain: 3,
      },
    };
    expect(namesInNode(tree)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    'has every component scenario %s uses',
    (_id, scenario) => {
      const missing = namesInNode(scenario.node).filter((name) => !(name in kit));
      expect(missing).toEqual([]);
    },
  );
});
