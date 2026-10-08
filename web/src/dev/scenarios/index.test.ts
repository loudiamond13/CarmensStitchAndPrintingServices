import { describe, expect, it } from 'vitest';
import { assertSerializable, scenarioById, scenarios } from './index';
import type { Scenario } from './types';

// Read the group files independently of index.ts, so the group-name rule is checked against the files themselves.
const groupModules = import.meta.glob<{ scenarios: readonly Scenario[] }>('./groups/*.ts', { eager: true });

function groupName(path: string): string {
  return path.replace(/^\.\/groups\//, '').replace(/\.ts$/, '');
}

const button: Scenario = {
  id: 'test-button',
  group: 'actions',
  node: { kind: 'node', component: 'Button', props: { variant: 'primary', children: 'Save' } },
  themes: ['light'],
  responsive: false,
  states: ['rest'],
  parity: true,
};

/** Builds a scenario whose props hold a value the data model forbids (the guard exists for exactly this case). */
function withProps(props: Record<string, unknown>): Scenario {
  const node = { kind: 'node', component: 'Button', props };
  return { ...button, id: 'bad-case', node } as unknown as Scenario;
}

describe('the scenario list', () => {
  it('is not empty and every id is unique', () => {
    const ids = scenarios.map((scenario) => scenario.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every scenario the group of the file that declares it', () => {
    const declared = Object.keys(groupModules)
      .sort()
      .flatMap((path) => {
        const name = groupName(path);
        const list = groupModules[path]?.scenarios ?? [];
        for (const scenario of list) {
          expect(scenario.group, scenario.id).toBe(name);
        }
        return list;
      });
    expect(declared.length).toBeGreaterThan(0);
    expect(scenarios).toEqual(declared);
  });

  it('declares button-primary-md: a primary md Button saying "Save Order" in both themes and four states', () => {
    expect(scenarios.find((scenario) => scenario.id === 'button-primary-md')).toEqual({
      id: 'button-primary-md',
      group: 'actions',
      node: { kind: 'node', component: 'Button', props: { variant: 'primary', size: 'md', children: 'Save Order' } },
      themes: ['light', 'dark'],
      responsive: false,
      states: ['rest', 'hover', 'focus-visible', 'active'],
      parity: true,
    });
  });

  it('every listed scenario passes the serializability guard', () => {
    for (const scenario of scenarios) {
      expect(() => {
        assertSerializable(scenario);
      }, scenario.id).not.toThrow();
    }
  });
});

describe('scenarioById', () => {
  it('returns the scenario with that id', () => {
    expect(scenarioById('button-primary-md').id).toBe('button-primary-md');
  });

  it('throws a plain Error that names an unknown id', () => {
    expect(() => scenarioById('no-such-case')).toThrow(/no-such-case/);
  });
});

describe('assertSerializable', () => {
  it('accepts strings, numbers, booleans, null, arrays, plain objects and nested nodes', () => {
    const plain = {
      label: 'Total',
      count: 3,
      on: false,
      none: null,
      list: [1, 'two', { three: true }],
      meta: { nested: { deep: 'yes' } },
      icon: { kind: 'node', component: 'Icon', props: { name: 'plus' } },
    };
    expect(() => {
      assertSerializable(withProps(plain));
    }).not.toThrow();
  });

  it('rejects a function-valued prop, naming the scenario id and the prop', () => {
    expect(() => {
      assertSerializable(withProps({ onClick: () => undefined }));
    }).toThrow(/bad-case.*onClick|onClick.*bad-case/);
  });

  it('rejects a function inside a nested node, naming the path to it', () => {
    const inner = { kind: 'node', component: 'Icon', props: { onLoad: () => undefined } };
    expect(() => {
      assertSerializable(withProps({ children: [inner] }));
    }).toThrow(/bad-case.*children.*onLoad/);
  });

  it('rejects class instances and symbols', () => {
    expect(() => {
      assertSerializable(withProps({ when: new Date(0) }));
    }).toThrow(/bad-case.*when/);
    expect(() => {
      assertSerializable(withProps({ tag: Symbol('x') }));
    }).toThrow(/bad-case.*tag/);
  });

  it('rejects undefined, bigint and non-finite numbers, which do not survive as plain data', () => {
    expect(() => {
      assertSerializable(withProps({ gone: undefined }));
    }).toThrow(/bad-case.*gone/);
    expect(() => {
      assertSerializable(withProps({ big: 1n }));
    }).toThrow(/bad-case.*big/);
    expect(() => {
      assertSerializable(withProps({ ratio: Number.NaN }));
    }).toThrow(/bad-case.*ratio/);
  });
});
