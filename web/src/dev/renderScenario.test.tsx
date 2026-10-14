import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderNode, type Kit } from './renderScenario';
import { scenarioById } from './scenarios';
import type { ScenarioNode } from './scenarios/types';

afterEach(cleanup);

// A test kit: tiny stand-ins for the real components, so renderNode is checked on its own.
function TestButton({ children }: { children?: ReactNode }) {
  return <button type="button">{children}</button>;
}

function Card({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-label="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Probe({ label, onPick }: { label?: string; onPick?: unknown }) {
  return <output aria-label={label}>{typeof onPick}</output>;
}

const kit: Kit = { Button: TestButton, Card, Probe };

function node(component: string, props?: ScenarioNode['props']): ScenarioNode {
  return props === undefined ? { kind: 'node', component } : { kind: 'node', component, props };
}

describe('renderNode', () => {
  it('renders the button-primary-md scenario as exactly one button saying "Save Order"', () => {
    render(renderNode(kit, scenarioById('button-primary-md').node, []));
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Save Order');
  });

  it('turns nested ScenarioNode prop values, alone or in arrays, into elements', () => {
    const tree = node('Card', {
      title: node('Probe', { label: 'in-title' }),
      children: [node('Button', { children: 'One' }), node('Button', { children: 'Two' })],
    });
    render(renderNode(kit, tree, []));
    const card = screen.queryByRole('region', { name: 'card' });
    expect(card?.querySelector('h2 output')?.getAttribute('aria-label')).toBe('in-title');
    expect(screen.queryAllByRole('button').map((button) => button.textContent)).toEqual(['One', 'Two']);
  });

  it('gives every prop named in handlers a function, in nested nodes too, and leaves other props alone', () => {
    const tree = node('Card', {
      title: node('Probe', { label: 'nested' }),
      children: node('Probe', { label: 'child' }),
    });
    render(renderNode(kit, tree, ['onPick']));
    expect(screen.queryByRole('status', { name: 'nested' })?.textContent).toBe('function');
    expect(screen.queryByRole('status', { name: 'child' })?.textContent).toBe('function');

    cleanup();
    render(renderNode(kit, node('Probe', { label: 'plain' }), []));
    expect(screen.queryByRole('status', { name: 'plain' })?.textContent).toBe('undefined');
  });

  it('renders a visible alert for a component the kit does not have', () => {
    render(renderNode(kit, node('Nope'), []));
    expect(screen.queryByRole('alert')?.textContent).toBe('Missing component: Nope');
  });
});
