import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as formScenarios } from '@/dev/scenarios/groups/forms';
import { expectNoAxeViolations } from '@/test/axe';
import { Select, type SelectOption } from '@/components/forms';
import {
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  requiredClasses,
  selectChevronClasses,
  selectOptionClasses,
} from './field.recipe';

// The converted App. D.3 Select (plan 02-20, CSPS-UI-SPEC.md §6.3): a native <select> styled as a control, with the
// chevron-down overlay and an optional placeholder option. Keyboard and screen-reader behaviour are the browser's own
// (a native select). The look is proven by the parity suite (`--grep @forms`).

const METHODS = ['Cash', 'GCash', 'Maya', 'Bank transfer'] as const satisfies readonly SelectOption[];
const PRODUCTS: readonly SelectOption[] = [
  { value: 'jersey-set', label: 'Jersey set' },
  { value: 'shorts', label: 'Shorts' },
];

// App. B `.csp-select select` (no native arrow, 40px end padding, pointer), `.csp-select-chev` and
// `.csp-select select option`.
const SELECT_END = 'cursor-pointer appearance-none pr-10';
const CHEVRON = 'pointer-events-none absolute right-3 text-ink-muted';
const OPTION = 'bg-surface-3 text-ink';

function tokens(...classLists: string[]): string[] {
  return classLists.join(' ').split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function select(name: string): HTMLSelectElement {
  return screen.getByRole<HTMLSelectElement>('combobox', { name });
}

function optionTexts(element: HTMLSelectElement): [string, string][] {
  return [...element.options].map((option) => [option.value, option.textContent]);
}

describe('Select markup and options (App. D.3)', () => {
  it('renders a labelled native select with string options, the first one selected', () => {
    const { container } = render(<Select label="Payment method" options={METHODS} />);
    const element = select('Payment method');

    expect(element.tagName).toBe('SELECT');
    expect(container.querySelector('label')?.htmlFor).toBe(element.id);
    expect(optionTexts(element)).toEqual(METHODS.map((method) => [method, method]));
    expect(element).toHaveValue('Cash');
  });

  it('renders object options by value and label', () => {
    render(<Select label="Product type" options={PRODUCTS} />);

    expect(optionTexts(select('Product type'))).toEqual([
      ['jersey-set', 'Jersey set'],
      ['shorts', 'Shorts'],
    ]);
  });

  it('puts the placeholder first as an empty-value option, selected until a choice is made', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Product type" placeholder="Choose a product type" options={PRODUCTS} onChange={onChange} />);
    const element = select('Product type');

    expect(optionTexts(element)[0]).toEqual(['', 'Choose a product type']);
    expect(element).toHaveValue('');
    await user.selectOptions(element, 'shorts');
    expect(element).toHaveValue('shorts');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the 18px chevron after the select, hidden from assistive technology', () => {
    render(<Select label="Payment method" options={METHODS} />);
    const chevron = select('Payment method').nextElementSibling;

    expect(chevron?.tagName.toLowerCase()).toBe('svg');
    expect(chevron).toHaveClass('lucide-chevron-down');
    expect(chevron).toHaveAttribute('width', '18');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives each part the shared field recipe and the select looks', () => {
    const { container } = render(<Select label="Payment method" placeholder="Choose one" options={METHODS} />);
    const element = select('Payment method');
    const chevron = element.nextElementSibling;

    expect(classTokens(container.firstElementChild)).toEqual(tokens(fieldClasses));
    expect(classTokens(container.querySelector('label'))).toEqual(tokens(labelClasses));
    expect(classTokens(element.parentElement)).toEqual(tokens(fieldControlClasses));
    expect(classTokens(element)).toEqual(tokens(fieldInputClasses({ select: true })));
    expect(classTokens(element)).toEqual(expect.arrayContaining(tokens(SELECT_END)));
    expect(tokens(selectChevronClasses)).toEqual(tokens(CHEVRON));
    expect(chevron?.getAttribute('class')?.split(/\s+/)).toEqual(expect.arrayContaining(tokens(CHEVRON)));
    expect(tokens(selectOptionClasses)).toEqual(tokens(OPTION));
    for (const option of element.options) {
      expect(classTokens(option), option.value).toEqual(tokens(OPTION));
    }
  });

  it('disables the native select', () => {
    render(<Select label="Payment method" options={METHODS} disabled />);

    expect(select('Payment method')).toBeDisabled();
  });

  it('is reached with Tab and reports a choice through onChange (the browser runs the native select keyboard)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Payment method" options={METHODS} onChange={onChange} />);
    const element = select('Payment method');

    await user.tab();
    expect(element).toHaveFocus();
    await user.selectOptions(element, 'GCash');
    expect(element).toHaveValue('GCash');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('follows a controlled value', () => {
    const { rerender } = render(<Select label="Payment method" options={METHODS} value="Maya" onChange={vi.fn()} />);
    expect(select('Payment method')).toHaveValue('Maya');

    rerender(<Select label="Payment method" options={METHODS} value="Cash" onChange={vi.fn()} />);
    expect(select('Payment method')).toHaveValue('Cash');
  });
});

describe('Select label, hint and error (A11Y-01)', () => {
  it('describes the select with the hint', () => {
    const { container } = render(<Select label="Payment method" options={METHODS} hint="Paid in full." />);
    const hint = container.querySelector('p');

    expect(hint?.textContent).toBe('Paid in full.');
    expect(classTokens(hint)).toEqual(tokens(messageClasses({ error: false })));
    expect(select('Payment method')).toHaveAccessibleDescription('Paid in full.');
    expect(select('Payment method')).not.toHaveAttribute('aria-invalid');
  });

  it('marks an error: aria-invalid, described by the danger message (App. D.3 shows no icon here)', () => {
    const { container } = render(
      <Select label="Product type" options={PRODUCTS} hint="As on the order." error="Choose a product type." />,
    );
    const messages = container.querySelectorAll('p');

    expect(messages).toHaveLength(1);
    expect(messages[0]?.textContent).toBe('Choose a product type.');
    expect(messages[0]?.querySelector('svg')).toBeNull();
    expect(classTokens(messages[0])).toEqual(tokens(messageClasses({ error: true })));
    expect(select('Product type')).toHaveAttribute('aria-invalid', 'true');
    expect(select('Product type')).toHaveAttribute('aria-describedby', messages[0]?.id ?? 'missing');
    expect(select('Product type')).toHaveAccessibleDescription('Choose a product type.');
  });

  it('has no message, aria-invalid or aria-describedby without a hint or an error', () => {
    const { container } = render(<Select label="Payment method" options={METHODS} />);

    expect(container.querySelector('p')).toBeNull();
    expect(select('Payment method')).not.toHaveAttribute('aria-invalid');
    expect(select('Payment method')).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the label on the select when the caller sets an id, and puts className on the field as layout glue', () => {
    const { container } = render(
      <Select label="Payment method" options={METHODS} id="payment-method" className="col-span-2" />,
    );

    expect(select('Payment method').id).toBe('payment-method');
    expect(classTokens(container.firstElementChild)).toEqual(tokens(fieldClasses, 'col-span-2'));
  });

  it('marks a required select with an aria-hidden " *" in the label and the native required attribute', () => {
    const { container } = render(<Select label="Category" options={METHODS} required />);
    const label = container.querySelector('label');
    const mark = label?.querySelector('span');

    expect(label?.textContent).toBe('Category *');
    expect(mark?.textContent).toBe(' *');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(classTokens(mark)).toEqual(tokens(requiredClasses));
    expect(select('Category')).toBeRequired();
  });

  it('shows no required mark when the select is not required', () => {
    const { container } = render(<Select label="Category" options={METHODS} />);

    expect(container.querySelector('label span')).toBeNull();
    expect(select('Category')).not.toBeRequired();
  });

  it('renders without a label when none is given (the caller names the select)', () => {
    const { container } = render(<Select aria-label="Rows per page" options={['10', '20', '50', '100']} />);

    expect(container.querySelector('label')).toBeNull();
    expect(select('Rows per page')).toBeInTheDocument();
  });

  it('has no axe violations with string and object options, a placeholder, a hint, an error and disabled', async () => {
    const { container } = render(
      <div>
        <Select label="Payment method" options={METHODS} hint="Paid in full." />
        <Select label="Product type" placeholder="Choose a product type" options={PRODUCTS} error="Choose one." />
        <Select label="Status" options={['Active', 'Inactive']} disabled />
        <Select label="Category" options={METHODS} required />
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Select label="Payment method" options={METHODS} />);
    const first = container.innerHTML;

    rerender(<Select label="Payment method" options={METHODS} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Select label="Product type" options={PRODUCTS} error="Choose one." />);
    expect(select('Product type')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('select scenarios (the forms parity group)', () => {
  const selectScenarios = formScenarios.filter((scenario) => scenario.node.component === 'Select');

  it('declares the default (at every width), error and disabled cases in both themes', () => {
    expect(selectScenarios.map((scenario) => [scenario.id, scenario.responsive])).toEqual([
      ['select-default', true],
      ['select-error', false],
      ['select-disabled', false],
    ]);
    for (const scenario of selectScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.target, scenario.id).toBe('select');
      expect(scenario.states, scenario.id).toEqual(
        scenario.id === 'select-disabled' ? ['rest', 'hover'] : ['rest', 'hover', 'focus-visible'],
      );
    }
  });

  it('renders every select scenario through the implementation kit, its target present, with no axe violations', async () => {
    const { container } = render(
      <div>
        {selectScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of selectScenarios) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      expect(frame?.querySelectorAll(scenario.target ?? ''), scenario.id).toHaveLength(1);
    }
    await expectNoAxeViolations(container);
  });
});

describe('Select grouped options (UI-SPEC "Select group option")', () => {
  const ACTIONS: readonly SelectOption[] = [
    { value: 'all', label: 'All actions' },
    { value: 'user.created', label: 'User created', group: 'Users' },
    { value: 'user.locked', label: 'User locked', group: 'Users' },
    { value: 'login.ok', label: 'Signed in', group: 'Sign-in' },
    { value: 'user.deleted', label: 'User deleted', group: 'Users' },
  ];

  it('wraps consecutive options of one group in an optgroup with that label, in order', () => {
    const { container } = render(<Select label="Action" options={ACTIONS} />);
    const groups = [...container.querySelectorAll('optgroup')];

    expect(groups.map((group) => group.label)).toEqual(['Users', 'Sign-in', 'Users']);
    expect(groups.map((group) => [...group.querySelectorAll('option')].map((option) => option.value))).toEqual([
      ['user.created', 'user.locked'],
      ['login.ok'],
      ['user.deleted'],
    ]);
  });

  it('leaves options without a group directly under the select, in order', () => {
    const { container } = render(<Select label="Action" options={ACTIONS} />);
    const direct = [...container.querySelectorAll('select > option')].map((option) => option.textContent);

    expect(direct).toEqual(['All actions']);
    expect(container.querySelector('select')?.firstElementChild?.tagName).toBe('OPTION');
  });

  it('selects a value inside a group', async () => {
    const onChange = vi.fn();
    render(<Select label="Action" options={ACTIONS} onChange={onChange} />);
    await userEvent.selectOptions(select('Action'), 'login.ok');

    expect(select('Action')).toHaveValue('login.ok');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders no optgroup when no option has a group', () => {
    const { container } = render(<Select label="Payment method" options={METHODS} />);
    expect(container.querySelector('optgroup')).toBeNull();
  });

  it('has no axe violations with groups', async () => {
    const { container } = render(<Select label="Action" options={ACTIONS} />);
    await expectNoAxeViolations(container);
  });
});
