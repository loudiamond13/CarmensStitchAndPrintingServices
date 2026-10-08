import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as actionScenarios } from '@/dev/scenarios/groups/actions';
import { expectNoAxeViolations } from '@/test/axe';
import { Button, buttonClasses, type ButtonSize, type ButtonVariant } from '@/ui/actions';

// The converted App. D.3 Button (plans 02-14 and 02-17). The look itself is proven by the parity suite (web/visual);
// these tests pin the markup, the props API, the WEB-09 pending behaviour and the actions scenario set that the parity
// suite compares.

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'ghost-danger'] as const satisfies readonly ButtonVariant[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const ALL_STATES = ['rest', 'hover', 'focus-visible', 'active'];

function onlyButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button');
}

function svgs(element: Element): SVGSVGElement[] {
  return [...element.querySelectorAll('svg')];
}

describe('Button markup (App. D.3)', () => {
  it('renders a type="button" button with the label in one span, and the recipe look for its variant and size', () => {
    render(
      <Button variant="primary" size="md">
        Save Order
      </Button>,
    );
    const button = onlyButton();

    expect(button).toHaveAttribute('type', 'button');
    expect(button.children).toHaveLength(1);
    expect(button.firstElementChild?.tagName).toBe('SPAN');
    expect(button).toHaveTextContent('Save Order');
    expect(button.className).toBe(buttonClasses({ variant: 'primary', size: 'md' }));
    expect(button.className).not.toBe('');
  });

  it('defaults to the secondary variant at the md size, as App. D.3 does', () => {
    render(<Button>Cancel</Button>);

    expect(onlyButton().className).toBe(buttonClasses({ variant: 'secondary', size: 'md' }));
  });

  it('passes the submit type through for forms', () => {
    render(<Button type="submit">Save</Button>);

    expect(onlyButton()).toHaveAttribute('type', 'submit');
  });

  it('renders the left icon before the label and the right icon after it (18px at md, 16px at sm)', () => {
    const { rerender } = render(
      <Button icon="plus" iconRight="arrow-right">
        New Order
      </Button>,
    );
    let button = onlyButton();
    expect([...button.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'span', 'svg']);
    expect(svgs(button).map((svg) => svg.getAttribute('width'))).toEqual(['18', '18']);
    expect(svgs(button)[0]).toHaveClass('lucide-plus');
    expect(svgs(button)[1]).toHaveClass('lucide-arrow-right');

    rerender(
      <Button size="sm" icon="plus" iconRight="arrow-right">
        New Order
      </Button>,
    );
    button = onlyButton();
    expect(svgs(button).map((svg) => svg.getAttribute('width'))).toEqual(['16', '16']);
  });

  it('is icon-only without children: no label span, the icon-only look, and the aria-label as its name', () => {
    render(<Button icon="x" aria-label="Close" variant="ghost" />);
    const button = screen.getByRole('button', { name: 'Close' });

    expect(button.querySelector('span')).toBeNull();
    expect(button.className).toBe(buttonClasses({ variant: 'ghost', size: 'md', iconOnly: true }));
    expect(button.className).not.toBe(buttonClasses({ variant: 'ghost', size: 'md' }));
  });

  it('adds the block look and the caller layout class', () => {
    render(
      <Button block className="mt-4">
        Continue
      </Button>,
    );

    expect(onlyButton().className).toBe(
      buttonClasses({ variant: 'secondary', size: 'md', block: true, className: 'mt-4' }),
    );
    expect(onlyButton()).toHaveClass('mt-4');
  });

  it('uses native disabled for disabled, without aria-disabled or aria-busy', () => {
    render(<Button disabled>Save</Button>);
    const button = onlyButton();

    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('aria-busy');
  });
});

describe('Button pending (WEB-09)', () => {
  it('marks a pending button aria-disabled and aria-busy, not natively disabled, so it keeps keyboard focus', () => {
    render(
      <Button variant="primary" pending>
        Save Order
      </Button>,
    );
    const button = onlyButton();

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it('shows the spinning loader-circle in place of the left icon and hides the right icon', () => {
    render(
      <Button pending icon="plus" iconRight="arrow-right">
        Save
      </Button>,
    );
    const icons = svgs(onlyButton());

    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass('lucide-loader-circle');
    expect(icons[0]).toHaveAttribute('width', '18');
    expect(icons[0]?.getAttribute('class')).toMatch(/\banimate-csp-spin\b/);
    expect(onlyButton().lastElementChild?.tagName).toBe('SPAN');
  });

  it('ignores clicks, Enter and Space while pending, and calls onClick again once it settles', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button pending onClick={onClick}>
        Save
      </Button>,
    );

    await user.click(onlyButton());
    onlyButton().focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
    expect(onlyButton()).toHaveFocus();

    rerender(<Button onClick={onClick}>Save</Button>);
    await user.click(onlyButton());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not submit its form while pending', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    const { container } = render(
      <form>
        <Button type="submit" pending>
          Save
        </Button>
      </form>,
    );
    container.querySelector('form')?.addEventListener('submit', onSubmit);

    await user.click(onlyButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats the App. D.3 loading prop as pending (SPEC-DEVIATION: WEB-09)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = onlyButton();

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Button accessibility and rendering', () => {
  it('has no axe violations at rest, icon-only and pending (A11Y-01)', async () => {
    const { container } = render(
      <div>
        <Button variant="primary">Save Order</Button>
        <Button icon="x" aria-label="Close" />
        <Button pending>Saving</Button>
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props (L-13)', () => {
    const { container, rerender } = render(
      <Button variant="danger" size="lg" icon="trash-2">
        Delete
      </Button>,
    );
    const first = container.innerHTML;
    rerender(
      <Button variant="danger" size="lg" icon="trash-2">
        Delete
      </Button>,
    );
    expect(container.innerHTML).toBe(first);

    rerender(
      <Button variant="ghost-danger" size="sm" disabled>
        Remove
      </Button>,
    );
    expect(onlyButton()).toBeDisabled();
    expect(onlyButton().className).toBe(buttonClasses({ variant: 'ghost-danger', size: 'sm' }));
    expect(svgs(onlyButton())).toHaveLength(0);
  });

  it('keeps the same DOM node when re-rendered with equal props', () => {
    const { rerender } = render(
      <Button variant="primary" icon="plus">
        New Order
      </Button>,
    );
    const first = onlyButton();
    rerender(
      <Button variant="primary" icon="plus">
        New Order
      </Button>,
    );

    expect(onlyButton()).toBe(first);
  });
});

describe('Button variants and sizes (App. D.3)', () => {
  const combinations = VARIANTS.flatMap((variant) => SIZES.map((size) => ({ variant, size })));

  it.each(combinations)('renders $variant at $size with its own recipe look', ({ variant, size }) => {
    render(
      <Button variant={variant} size={size} icon="plus">
        Add
      </Button>,
    );
    const button = onlyButton();

    expect(button.className).toBe(buttonClasses({ variant, size }));
    expect(svgs(button)[0]).toHaveAttribute('width', size === 'sm' ? '16' : '18');
  });

  it('gives each of the fifteen combinations a different look', () => {
    const looks = new Set(combinations.map((options) => buttonClasses(options)));

    expect(looks.size).toBe(combinations.length);
  });

  it('applies either the labelled padding or the icon-only width, never both', () => {
    for (const size of SIZES) {
      const labelled = buttonClasses({ variant: 'ghost', size }).split(' ');
      const iconOnly = buttonClasses({ variant: 'ghost', size, iconOnly: true }).split(' ');

      expect(labelled.some((token) => token.startsWith('px-'))).toBe(true);
      expect(labelled.some((token) => token.startsWith('w-'))).toBe(false);
      expect(iconOnly.some((token) => token.startsWith('px-'))).toBe(false);
      expect(iconOnly.some((token) => token.startsWith('w-'))).toBe(true);
    }
  });

  it('requires an aria-label on an icon-only button (a type error without one)', () => {
    // @ts-expect-error an icon-only Button (no children) must be given an aria-label
    const nameless = <Button icon="x" />;
    const named = <Button icon="x" aria-label="Close" />;

    expect(isValidElement(nameless)).toBe(true);
    render(named);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('Button scenarios (the actions parity group)', () => {
  const buttonScenarios = actionScenarios.filter((scenario) => scenario.node.component === 'Button');
  const byId = new Map(buttonScenarios.map((scenario) => [scenario.id, scenario]));
  const variantSizeIds = VARIANTS.flatMap((variant) => SIZES.map((size) => `button-${variant}-${size}`));
  const propStateIds = ['button-disabled', 'button-pending'];
  const expectedIds = [
    ...variantSizeIds,
    'button-icon-only-sm',
    'button-icon-only-md',
    'button-icon-left',
    'button-icon-right',
    'button-block',
    ...propStateIds,
  ];

  it('declares one scenario per variant and size, icon-only sm and md, both icon sides, block, disabled and pending', () => {
    expect(buttonScenarios.map((scenario) => scenario.id).sort()).toEqual([...expectedIds].sort());
  });

  it('compares every Button scenario in both themes; prop states at rest only, the others in all four states', () => {
    for (const scenario of buttonScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.responsive, scenario.id).toBe(false);
      expect(scenario.states, scenario.id).toEqual(propStateIds.includes(scenario.id) ? ['rest'] : ALL_STATES);
    }
  });

  it('sets each variant and size scenario to its own variant and size', () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(byId.get(`button-${variant}-${size}`)?.node.props, `${variant}-${size}`).toMatchObject({
          variant,
          size,
        });
      }
    }
  });

  it('uses App. D.3 `loading` for the pending scenario, so the reference renders it too', () => {
    expect(byId.get('button-pending')?.node.props).toMatchObject({ loading: true });
    expect(byId.get('button-pending')?.node.props).not.toHaveProperty('pending');
    expect(byId.get('button-disabled')?.node.props).toMatchObject({ disabled: true });
  });

  it('renders every Button scenario through the implementation kit as one named button with no axe violations', async () => {
    const { container } = render(
      <div>
        {buttonScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of buttonScenarios) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      expect(frame?.querySelectorAll('button'), scenario.id).toHaveLength(1);
    }
    expect(container.querySelector('[data-case="button-pending"] button')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[data-case="button-icon-only-sm"] button')).toHaveAccessibleName();
    await expectNoAxeViolations(container);
  });
});
