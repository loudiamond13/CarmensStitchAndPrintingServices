import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { scenarios as feedbackScenarios } from '@/dev/scenarios/groups/feedback';
import { expectNoAxeViolations } from '@/test/axe';
import { Button } from '@/ui/actions';
import { EmptyState, Skeleton, Toast, type ToastTone } from '@/ui/feedback';
import {
  emptyClasses,
  emptyIconClasses,
  emptyIconGlyphClasses,
  emptyMessageClasses,
  emptyTitleClasses,
  iconButtonClasses,
  skeletonClasses,
  toastClasses,
  toastEdgeToneClasses,
  toastIconClasses,
  toastIconToneClasses,
  toastMessageClasses,
  toastTextClasses,
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

describe('Skeleton (App. D.3)', () => {
  function skeleton(container: HTMLElement): HTMLElement {
    const element = container.firstElementChild;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Skeleton rendered no element.');
    }
    return element;
  }

  it('renders a hidden span in the shimmer look, sized only through --sk-w, --sk-h and --sk-r (D-33)', () => {
    const { container } = render(<Skeleton />);
    const element = skeleton(container);

    expect(element.localName).toBe('span');
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(classTokens(element)).toEqual(tokens(skeletonClasses));
    expect([...element.style].sort()).toEqual(['--sk-h', '--sk-r', '--sk-w']);
  });

  it('defaults to the full width, 16px tall and the 6px App. B radius', () => {
    const { container } = render(<Skeleton />);
    const { style } = skeleton(container);

    expect(style.getPropertyValue('--sk-w')).toBe('100%');
    expect(style.getPropertyValue('--sk-h')).toBe('16px');
    expect(style.getPropertyValue('--sk-r')).toBe('6px');
  });

  it('turns numbers into px and passes strings through, as React does for width, height and borderRadius', () => {
    const { container } = render(<Skeleton width={240} height="2rem" radius={0} />);
    const { style } = skeleton(container);

    expect(style.getPropertyValue('--sk-w')).toBe('240px');
    expect(style.getPropertyValue('--sk-h')).toBe('2rem');
    expect(style.getPropertyValue('--sk-r')).toBe('0px');
  });

  it('adds a layout className after its own look', () => {
    const { container } = render(<Skeleton width="60%" className="mt-2" />);

    expect(classTokens(skeleton(container))).toEqual(tokens(`${skeletonClasses} mt-2`));
  });

  it('shimmers with animate-csp-shimmer and stops under reduced motion (D-31 O-6)', () => {
    expect(tokens(skeletonClasses)).toEqual(
      expect.arrayContaining([
        'animate-csp-shimmer',
        'motion-reduce:animate-none',
        'w-(--sk-w)',
        'h-(--sk-h)',
        'rounded-(--sk-r)',
      ]),
    );
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Skeleton width="40%" height={14} />);
    const first = container.innerHTML;

    rerender(<Skeleton width="40%" height={14} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Skeleton width="75%" height={22} radius={12} />);
    expect(skeleton(container).style.getPropertyValue('--sk-w')).toBe('75%');
    expect(skeleton(container).style.getPropertyValue('--sk-r')).toBe('12px');
  });
});

describe('Toast (App. D.3)', () => {
  const TONES = ['success', 'danger', 'info', 'warning'] as const satisfies readonly ToastTone[];
  const ICON: Record<ToastTone, string> = {
    success: 'circle-check',
    danger: 'triangle-alert',
    info: 'info',
    warning: 'triangle-alert',
  };

  it('renders the icon, the bold title over the message, then the Dismiss button, in the App. D.3 looks', () => {
    const { container } = render(
      <Toast tone="success" title="Payment added" message="Balance now ₱4,327.50" onClose={() => undefined} />,
    );
    const toast = screen.getByRole('status');
    const [icon, text, close] = [...toast.children];

    expect(toast).toBe(container.firstElementChild);
    expect(toast.children).toHaveLength(3);
    expect(classTokens(toast)).toEqual(tokens(`${toastClasses} ${toastEdgeToneClasses.success}`));
    expect(icon?.localName).toBe('span');
    expect(classTokens(icon)).toEqual(tokens(`${toastIconClasses} ${toastIconToneClasses.success}`));
    expect(classTokens(text)).toEqual(tokens(toastTextClasses));
    expect(text?.firstElementChild?.localName).toBe('strong');
    expect(text?.firstElementChild?.textContent).toBe('Payment added');
    expect(text?.lastElementChild?.localName).toBe('span');
    expect(classTokens(text?.lastElementChild)).toEqual(tokens(toastMessageClasses));
    expect(text?.lastElementChild?.textContent).toBe('Balance now ₱4,327.50');
    expect(close).toBe(screen.getByRole('button', { name: 'Dismiss' }));
    expect(classTokens(close)).toEqual(tokens(iconButtonClasses));
    expect(close?.getAttribute('type')).toBe('button');
  });

  it.each(TONES)('drops the %s toast role when a live region around it announces it (UI-WR-04)', (tone) => {
    const { container } = render(<Toast tone={tone} title="Title" announce={false} />);

    expect(container.firstElementChild?.hasAttribute('role')).toBe(false);
    expect(classTokens(container.firstElementChild)).toEqual(tokens(`${toastClasses} ${toastEdgeToneClasses[tone]}`));
  });

  it.each(TONES)('gives the %s toast its role, its icon and its edge and icon colours', (tone) => {
    const { container } = render(<Toast tone={tone} title="Title" />);
    const toast = container.firstElementChild;
    const icon = container.querySelector('svg');

    expect(toast?.getAttribute('role')).toBe(tone === 'danger' ? 'alert' : 'status');
    expect(classTokens(toast)).toEqual(tokens(`${toastClasses} ${toastEdgeToneClasses[tone]}`));
    expect(classTokens(icon?.parentElement)).toEqual(tokens(`${toastIconClasses} ${toastIconToneClasses[tone]}`));
    expect(icon?.getAttribute('class')).toContain(`lucide-${ICON[tone]}`);
    expect(icon?.getAttribute('width')).toBe('20');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to the success tone', () => {
    render(<Toast title="Saved" />);

    expect(classTokens(screen.getByRole('status'))).toEqual(tokens(`${toastClasses} ${toastEdgeToneClasses.success}`));
  });

  it('leaves out the message and the Dismiss button when none is given', () => {
    render(<Toast tone="info" title="Not available yet" />);
    const text = screen.getByText('Not available yet').parentElement;

    expect(text?.children).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onClose when Dismiss is pressed, by mouse or keyboard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Toast tone="danger" title="Couldn't save order" onClose={onClose} />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });

    await user.click(dismiss);
    expect(onClose).toHaveBeenCalledTimes(1);

    dismiss.focus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders the action between the text and the Dismiss button', () => {
    render(<Toast title="Order deleted" action={<button type="button">Undo</button>} onClose={() => undefined} />);
    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);

    expect(names).toEqual(['Undo', 'Dismiss']);
  });

  it('stops its entry animation under reduced motion (D-31 O-6)', () => {
    expect(tokens(toastClasses)).toEqual(expect.arrayContaining(['animate-csp-rise', 'motion-reduce:animate-none']));
  });

  it.each(TONES)('has no axe violations in the %s tone', async (tone) => {
    const { container } = render(<Toast tone={tone} title="Title" message="Message" onClose={() => undefined} />);

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onClose = () => undefined;
    const { container, rerender } = render(<Toast tone="info" title="One" message="Two" onClose={onClose} />);
    const first = container.innerHTML;

    rerender(<Toast tone="info" title="One" message="Two" onClose={onClose} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Toast tone="danger" title="Three" />);
    expect(screen.getByRole('alert').textContent).toBe('Three');
    expect(screen.queryByRole('button')).toBeNull();
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
        action: {
          kind: 'node',
          component: 'Button',
          props: { variant: 'primary', icon: 'plus', children: 'New Order' },
        },
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

  it('declares a skeleton line and a sized block, in both themes at rest and in the reduced-motion pass', () => {
    expect(byId.get('skeleton-line')?.node).toEqual({
      kind: 'node',
      component: 'Skeleton',
      props: { width: '75%', height: 22 },
    });
    expect(byId.get('skeleton-block')?.node).toEqual({
      kind: 'node',
      component: 'Skeleton',
      props: { width: 240, height: 180, radius: 12 },
    });
    for (const id of ['skeleton-line', 'skeleton-block']) {
      const scenario = byId.get(id);
      expect(scenario?.themes, id).toEqual(['light', 'dark']);
      expect(scenario?.states, id).toEqual(['rest']);
      expect(scenario?.passes, id).toEqual(['motion']);
      expect(scenario?.parity, id).toBe(true);
    }
  });

  it('declares one toast per tone and a long-copy toast, each with Dismiss and the reduced-motion pass', () => {
    const toasts = feedbackScenarios.filter((scenario) => scenario.node.component === 'Toast');

    expect(toasts.map((scenario) => scenario.id).sort()).toEqual(
      ['toast-danger', 'toast-info', 'toast-long-copy', 'toast-success', 'toast-warning'].sort(),
    );
    for (const scenario of toasts) {
      expect(scenario.handlers, scenario.id).toEqual(['onClose']);
      expect(scenario.passes, scenario.id).toEqual(['motion']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.parity, scenario.id).toBe(true);
    }
    for (const tone of ['success', 'danger', 'info', 'warning']) {
      expect(byId.get(`toast-${tone}`)?.node.props, tone).toMatchObject({ tone });
    }
  });

  it('compares the success toast Dismiss button on hover and with keyboard focus', () => {
    const success = byId.get('toast-success');

    expect(success?.states).toEqual(['rest', 'hover', 'focus-visible']);
    expect(success?.target).toBe('button');
  });
});
