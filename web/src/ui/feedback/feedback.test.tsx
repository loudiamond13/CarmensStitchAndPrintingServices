import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { scenarios as feedbackScenarios } from '@/dev/scenarios/groups/feedback';
import { expectNoAxeViolations } from '@/test/axe';
import { Button } from '@/ui/actions';
import { EmptyState } from '@/ui/feedback';
import {
  emptyClasses,
  emptyIconClasses,
  emptyIconGlyphClasses,
  emptyMessageClasses,
  emptyTitleClasses,
} from './feedback.recipe';

// The converted App. D.3 feedback components (plan 02-21, CSPS-UI-SPEC.md §6.5). The look is proven by the parity
// suite (`--grep @feedback`); these tests pin the markup, the accessible names and roles, and the scenario set the
// parity suite compares.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

describe('EmptyState (App. D.3)', () => {
  function renderFirstUse() {
    return render(
      <EmptyState
        title="No orders yet"
        message="Create your first order to start tracking items, payments and balances."
        action={
          <Button variant="primary" icon="plus">
            New Order
          </Button>
        }
      />,
    );
  }

  it('renders the icon tile, the title, the message and the action in the App. D.3 order and looks', () => {
    const { container } = renderFirstUse();
    const root = container.firstElementChild;
    const [tile, heading, message, action] = [...(root?.children ?? [])];

    expect(root?.localName).toBe('div');
    expect(classTokens(root)).toEqual(tokens(emptyClasses));
    expect(root?.children).toHaveLength(4);
    expect(tile?.localName).toBe('span');
    expect(classTokens(tile)).toEqual(tokens(emptyIconClasses));
    expect(classTokens(heading)).toEqual(tokens(emptyTitleClasses));
    expect(heading?.textContent).toBe('No orders yet');
    expect(message?.localName).toBe('p');
    expect(classTokens(message)).toEqual(tokens(emptyMessageClasses));
    expect(message?.textContent).toBe('Create your first order to start tracking items, payments and balances.');
    expect(action).toBe(screen.getByRole('button', { name: 'New Order' }));
  });

  it('draws the default clipboard-list icon at 28px, hidden and turned back upright inside the tilted tile', () => {
    const { container } = renderFirstUse();
    const icon = container.querySelector('svg');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('width')).toBe('28');
    expect(icon?.getAttribute('height')).toBe('28');
    expect(icon?.getAttribute('class')).toContain('lucide-clipboard-list');
    expect(icon?.getAttribute('class')).toContain(emptyIconGlyphClasses);
    expect(emptyIconClasses).toContain('[transform:rotate(-6deg)]');
    expect(emptyIconGlyphClasses).toBe('[transform:rotate(6deg)]');
  });

  it('draws the icon it is given', () => {
    const { container } = render(<EmptyState icon="search" title="No matches" />);

    expect(container.querySelector('svg')?.getAttribute('class')).toContain('lucide-search');
  });

  it('renders the title as an h2 by default (A11Y-02 heading order)', () => {
    renderFirstUse();

    expect(screen.getByRole('heading', { name: 'No orders yet' }).localName).toBe('h2');
  });

  it.each([2, 3, 4] as const)('renders the title as an h%i when that level is passed, with the same look', (level) => {
    render(<EmptyState title="No matches" level={level} />);
    const heading = screen.getByRole('heading', { name: 'No matches', level });

    expect(heading.localName).toBe(`h${String(level)}`);
    expect(classTokens(heading)).toEqual(tokens(emptyTitleClasses));
  });

  it('leaves out the message and the action when none is given', () => {
    const { container } = render(<EmptyState title="No matches" message="" />);
    const root = container.firstElementChild;

    expect(root?.children).toHaveLength(2);
    expect(container.querySelector('p')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderFirstUse();

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<EmptyState title="No orders yet" message="First one" />);
    const first = container.innerHTML;

    rerender(<EmptyState title="No orders yet" message="First one" />);
    expect(container.innerHTML).toBe(first);

    rerender(<EmptyState icon="receipt" title="No expenses recorded" level={3} />);
    expect(screen.getByRole('heading', { name: 'No expenses recorded', level: 3 })).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('lucide-receipt');
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('feedback scenarios (the feedback parity group)', () => {
  const byId = new Map(feedbackScenarios.map((scenario) => [scenario.id, scenario]));

  it('declares the first-use and no-matches empty states with the Copywriting Contract copy', () => {
    expect(byId.get('empty-first-use')?.node).toEqual({
      kind: 'node',
      component: 'EmptyState',
      props: {
        icon: 'clipboard-list',
        title: 'No orders yet',
        message: 'Create your first order to start tracking items, payments and balances.',
        action: { kind: 'node', component: 'Button', props: { variant: 'primary', icon: 'plus', children: 'New Order' } },
        level: 3,
      },
    });
    expect(byId.get('empty-no-matches')?.node).toEqual({
      kind: 'node',
      component: 'EmptyState',
      props: {
        icon: 'search',
        title: 'No matches',
        message: 'No orders match “Ballers” with status Ready. Try another search or clear the filters.',
        action: { kind: 'node', component: 'Button', props: { variant: 'secondary', children: 'Clear Filters' } },
        level: 3,
      },
    });
  });

  it('compares both empty states in both themes at rest, at every width', () => {
    for (const id of ['empty-first-use', 'empty-no-matches']) {
      const scenario = byId.get(id);
      expect(scenario?.themes, id).toEqual(['light', 'dark']);
      expect(scenario?.states, id).toEqual(['rest']);
      expect(scenario?.responsive, id).toBe(true);
      expect(scenario?.parity, id).toBe(true);
    }
  });
});
