import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as formScenarios } from '@/dev/scenarios/groups/forms';
import { expectNoAxeViolations } from '@/test/axe';
import { Field } from '@/components/forms';
import { fieldBesideBoxClasses, fieldRowClasses } from './field.recipe';

// The converted App. D.3 Field (plan 02-20, CSPS-UI-SPEC.md §6.3, UI-SPEC D-01 and D-02 FYI-01): the label, the control
// box, the text box and the message, with the assistive-technology wiring (label association, aria-describedby,
// aria-invalid). The look is proven by the parity suite (`--grep @forms`); these tests pin the markup, the wiring, the
// class lists each part takes (the App. B transcription) and the field scenarios the parity suite compares.

// App. B `.csp-field`, plus App. C `.s-toolbar .csp-field` (0 1 180px; phones 1 1 140px; tablets 1 1 150px).
const FIELD =
  'flex min-w-0 flex-col gap-1.5 in-data-[ui=s-toolbar]:flex-[0_1_180px] pg-phone:in-data-[ui=s-toolbar]:flex-[1_1_140px] pg-tablet:in-data-[ui=s-toolbar]:flex-[1_1_150px]';
// App. B `.csp-label`, plus App. C `.s-toolbar .csp-label` (12/16, --ink-muted).
const LABEL =
  'text-[14px] leading-5 font-semibold text-ink in-data-[ui=s-toolbar]:text-[12px] in-data-[ui=s-toolbar]:leading-4 in-data-[ui=s-toolbar]:text-ink-muted';
// App. B `.csp-req`.
const REQUIRED = 'text-danger';
// App. B `.csp-control`, `:hover`, `:focus-within` and `.csp-field.is-invalid .csp-control` (keyed off the box's own
// aria-invalid). The focus look wins over hover, and the invalid look over both, as the spec cascade has it.
// `[outline:none]` is App. B's shorthand: it also resets the outline width and colour the global :focus-visible sets.
const CONTROL =
  'relative flex items-center rounded-sm border border-line-strong bg-surface-2 transition-[border-color,box-shadow] duration-150 ease-[ease] hover:not-focus-within:border-ink-muted focus-within:border-focus focus-within:[box-shadow:0_0_0_1px_var(--focus)] has-aria-invalid:border-danger! has-aria-invalid:focus-within:[box-shadow:0_0_0_1px_var(--danger)]';
// App. B `.csp-input` (16px) and its placeholder at full opacity (D-02 FYI-01), plus App. C `.s-toolbar .csp-input` and
// `.s-item .csp-input` (14px) with the D-01 phone rule (16px on pages up to 767px wide).
const INPUT =
  'w-full min-w-0 flex-1 border-0 bg-transparent text-ink [outline:none] placeholder:text-ink-muted text-[16px] in-data-[ui=s-toolbar]:text-[14px] in-data-[ui=s-item]:text-[14px] pg-phone:in-data-[ui=s-toolbar]:text-[16px] pg-phone:in-data-[ui=s-item]:text-[16px]';
// A one-line box: 44px, 40px in a toolbar or an item row.
const LINE = 'h-11 in-data-[ui=s-toolbar]:h-10 in-data-[ui=s-item]:h-10';
// `.csp-control.is-multiline .csp-input` (its auto height beats the region height, as in the spec cascade).
const MULTILINE = 'h-auto min-h-[112px] resize-y py-3 leading-6';
const START_PLAIN = 'pl-3';
// `.csp-control.has-prefix .csp-input`.
const START_PREFIX = 'pl-2 tabular-nums';
const END_PLAIN = 'pr-3';
// App. B `.csp-prefix`.
const PREFIX = 'pl-3 font-semibold text-ink-muted';
// App. B `.csp-msg` and `.csp-msg-error`.
const MESSAGE = 'm-0 flex items-center gap-1.5 text-[12px] leading-4';
const HINT = 'text-ink-muted';
const ERROR = 'font-medium text-danger';

function tokens(...classLists: string[]): string[] {
  return classLists.join(' ').split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function box(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(name);
}

describe('Field markup and labelling (App. D.3, A11Y-01)', () => {
  it('renders the label, the control box with its text box, and no message when there is neither hint nor error', () => {
    const { container } = render(<Field label="Customer name" placeholder="e.g. Carmen Reyes" />);
    const input = box('Customer name');
    const label = container.querySelector('label');

    expect(label?.htmlFor).toBe(input.id);
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('placeholder', 'e.g. Carmen Reyes');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(container.querySelector('p')).toBeNull();
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('gives each part the App. B transcription', () => {
    const { container } = render(<Field label="Customer name" />);
    const field = container.firstElementChild;
    const input = box('Customer name');

    expect(classTokens(field)).toEqual(tokens(FIELD));
    expect(classTokens(container.querySelector('label'))).toEqual(tokens(LABEL));
    expect(classTokens(input.parentElement)).toEqual(tokens(CONTROL));
    expect(classTokens(input)).toEqual(tokens(INPUT, LINE, START_PLAIN, END_PLAIN));
  });

  it('uses the caller id for the box and the label', () => {
    render(<Field label="Customer name" id="customer-name" />);

    expect(box('Customer name').id).toBe('customer-name');
  });

  it('adds the caller className to the field only, as layout glue', () => {
    const { container } = render(<Field label="Customer name" className="col-span-2" />);

    expect(classTokens(container.firstElementChild)).toEqual(tokens(FIELD, 'col-span-2'));
    expect(classTokens(box('Customer name'))).not.toContain('col-span-2');
  });

  it('describes the box with the hint, in --ink-muted, and leaves it valid', () => {
    const { container } = render(<Field label="Reference number" hint="GCash, Maya or bank reference." />);
    const input = box('Reference number');
    const hint = container.querySelector('p');

    expect(hint?.textContent).toBe('GCash, Maya or bank reference.');
    expect(hint?.id).toBe(`${input.id}-msg`);
    expect(input).toHaveAttribute('aria-describedby', hint?.id ?? 'missing');
    expect(input).toHaveAccessibleDescription('GCash, Maya or bank reference.');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(hint?.querySelector('svg')).toBeNull();
    expect(classTokens(hint)).toEqual(tokens(MESSAGE, HINT));
  });

  it('marks an error: aria-invalid, described by the danger message with a 14px triangle-alert, replacing the hint', () => {
    const { container } = render(
      <Field label="Mobile number" hint="We text you when the order is ready." error="Enter a mobile number." />,
    );
    const input = box('Mobile number');
    const messages = container.querySelectorAll('p');
    const message = messages[0];
    const icon = message?.querySelector('svg');

    expect(messages).toHaveLength(1);
    expect(message?.textContent).toBe('Enter a mobile number.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', message?.id ?? 'missing');
    expect(input).toHaveAccessibleDescription('Enter a mobile number.');
    expect(classTokens(message)).toEqual(tokens(MESSAGE, ERROR));
    expect(icon).toHaveAttribute('width', '14');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.getAttribute('class')).toContain('lucide-triangle-alert');
  });

  it('shows nothing invalid until an error is set (no validation before the first submit)', () => {
    const { container, rerender } = render(<Field label="Mobile number" required />);
    const input = screen.getByRole('textbox', { name: 'Mobile number' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('p')).toBeNull();

    rerender(<Field label="Mobile number" required error="Enter a mobile number." />);
    expect(input).toHaveAttribute('aria-invalid', 'true');

    rerender(<Field label="Mobile number" required error="" />);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('p')).toBeNull();
  });

  it('marks a required field with an aria-hidden " *" in the label and the native required attribute', () => {
    const { container } = render(<Field label="Customer name" required />);
    const label = container.querySelector('label');
    const mark = label?.querySelector('span');

    expect(label?.textContent).toBe('Customer name *');
    expect(mark?.textContent).toBe(' *');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(classTokens(mark)).toEqual(tokens(REQUIRED));
    expect(screen.getByRole('textbox', { name: 'Customer name' })).toBeRequired();
  });

  it('keeps the plain markup (label, box, message) when no beside content is given', () => {
    const { container } = render(<Field label="Date" hint="Pick one." />);
    const field = container.firstElementChild;

    expect([...(field?.children ?? [])].map((child) => child.localName)).toEqual(['label', 'div', 'p']);
    expect(classTokens(field?.children[1])).toEqual(tokens(CONTROL));
  });

  it('puts the box and the beside content in one row, with the message under the row', () => {
    const { container } = render(<Field label="Date" hint="Pick one." beside={<span>Sep 26, 2026</span>} />);
    const field = container.firstElementChild;
    const [label, row, message] = [...(field?.children ?? [])];

    expect(label?.localName).toBe('label');
    expect(classTokens(row)).toEqual(tokens(fieldRowClasses));
    expect([...(row?.children ?? [])].map((child) => child.localName)).toEqual(['div', 'span']);
    expect(classTokens(row?.children[0])).toEqual(tokens(CONTROL, fieldBesideBoxClasses));
    expect(row?.children[1]).toHaveTextContent('Sep 26, 2026');
    expect(message?.localName).toBe('p');
    expect(screen.getByRole('textbox', { name: 'Date' })).toHaveAccessibleDescription('Pick one.');
  });

  it('renders a textarea for multiline, with the multiline box look', () => {
    const { container } = render(<Field label="Notes" multiline rows={4} placeholder="Optional" />);
    const textarea = box('Notes');

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('rows', '4');
    expect(container.querySelector('input')).toBeNull();
    expect(classTokens(textarea)).toEqual(tokens(INPUT, MULTILINE, START_PLAIN, END_PLAIN));
  });

  it('puts an aria-hidden prefix before the box and gives the box the prefix padding and tabular figures', () => {
    render(<Field label="Unit price" prefix="₱" inputMode="decimal" />);
    const input = box('Unit price');
    const prefix = input.previousElementSibling;

    expect(prefix?.tagName).toBe('SPAN');
    expect(prefix?.textContent).toBe('₱');
    expect(prefix).toHaveAttribute('aria-hidden', 'true');
    expect(classTokens(prefix)).toEqual(tokens(PREFIX));
    expect(classTokens(input)).toEqual(tokens(INPUT, LINE, START_PREFIX, END_PLAIN));
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('keeps the toolbar and item-row looks, with the D-01 phone size, on the box inside those regions', () => {
    const { container } = render(
      <div>
        <div data-ui="s-toolbar">
          <Field label="Status" />
        </div>
        <div data-ui="s-item">
          <Field label="Quantity" />
        </div>
      </div>,
    );

    for (const name of ['Status', 'Quantity']) {
      const input = box(name);
      expect(input.classList, name).toContain('in-data-[ui=s-toolbar]:h-10');
      expect(input.classList, name).toContain('in-data-[ui=s-toolbar]:text-[14px]');
      expect(input.classList, name).toContain('pg-phone:in-data-[ui=s-toolbar]:text-[16px]');
      expect(input.classList, name).toContain('in-data-[ui=s-item]:h-10');
      expect(input.classList, name).toContain('in-data-[ui=s-item]:text-[14px]');
      expect(input.classList, name).toContain('pg-phone:in-data-[ui=s-item]:text-[16px]');
    }
    const toolbarLabel = container.querySelector('[data-ui="s-toolbar"] label');
    expect(toolbarLabel?.classList).toContain('in-data-[ui=s-toolbar]:text-[12px]');
    expect(toolbarLabel?.parentElement?.classList).toContain('in-data-[ui=s-toolbar]:flex-[0_1_180px]');
  });

  it('passes the native box attributes through and reports each change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={120}
        defaultValue="carmen"
        onChange={onChange}
      />,
    );
    const input = box('Email');

    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('maxlength', '120');
    await user.type(input, '@x.ph');
    expect(input).toHaveValue('carmen@x.ph');
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('disables the native box', () => {
    render(<Field label="Order number" disabled defaultValue="ORD-2026-0148" />);

    expect(box('Order number')).toBeDisabled();
  });

  it('renders without a label when none is given (the caller names the box)', () => {
    const { container } = render(<Field aria-label="Search orders" />);

    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search orders' })).toBeInTheDocument();
  });

  it('has no axe violations in the default, hint, error, required, multiline, prefix and disabled forms', async () => {
    const { container } = render(
      <div>
        <Field label="Customer name" placeholder="e.g. Carmen Reyes" />
        <Field label="Reference number" hint="GCash, Maya or bank reference." />
        <Field label="Mobile number" error="Enter a mobile number." defaultValue="0917" />
        <Field label="Team name" required />
        <Field label="Notes" multiline />
        <Field label="Unit price" prefix="₱" defaultValue="450.00" />
        <Field label="Order number" disabled defaultValue="ORD-2026-0148" />
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Field label="Customer name" hint="As on the order." />);
    const first = container.innerHTML;

    rerender(<Field label="Customer name" hint="As on the order." />);
    expect(container.innerHTML).toBe(first);

    rerender(<Field label="Unit price" prefix="₱" error="Enter an amount." multiline />);
    expect(screen.getByLabelText('Unit price').tagName).toBe('TEXTAREA');
    expect(container.querySelector('p')?.textContent).toBe('Enter an amount.');
  });
});

describe('Field equal-props re-render (React Compiler, L-13)', () => {
  // The native attributes pass through as a fresh rest object on every render, so the compiler can never reuse the
  // parts that hold the box; the output must still be identical for equal props and follow a passthrough change.
  it.each([
    ['label, required mark, prefix and hint', { label: 'Unit price', required: true, prefix: '₱', hint: 'Per piece.' }],
    ['error', { label: 'Unit price', error: 'Enter an amount.' }],
    ['multiline', { label: 'Notes', multiline: true as const, hint: 'Optional.' }],
  ])('keeps the same output with a %s, and follows a passthrough attribute change', (_name, props) => {
    const { container, rerender } = render(<Field {...props} />);
    const first = container.innerHTML;

    rerender(<Field {...props} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Field {...props} placeholder="Changed" />);
    expect(container.querySelector('[placeholder="Changed"]')).not.toBeNull();
  });
});

describe('field scenarios (the forms parity group)', () => {
  const fieldScenarios = formScenarios.filter((scenario) => scenario.node.component === 'Field');

  it('declares the default, hint, error, required, multiline, prefix and disabled cases in both themes at every width', () => {
    expect(fieldScenarios.map((scenario) => scenario.id)).toEqual([
      'field-default',
      'field-hint',
      'field-error',
      'field-required',
      'field-multiline',
      'field-prefix-peso',
      'field-disabled',
    ]);
    for (const scenario of fieldScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });

  it('drives hover and keyboard focus on the text box; a disabled box is compared at rest and on hover only', () => {
    for (const scenario of fieldScenarios) {
      const disabled = scenario.id === 'field-disabled';
      expect(scenario.states, scenario.id).toEqual(disabled ? ['rest', 'hover'] : ['rest', 'hover', 'focus-visible']);
      expect(scenario.target, scenario.id).toBe(scenario.id === 'field-multiline' ? 'textarea' : 'input');
    }
  });

  it('renders every field scenario through the implementation kit, its target present, with no axe violations', async () => {
    const { container } = render(
      <div>
        {fieldScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of fieldScenarios) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      expect(frame?.querySelectorAll('label'), scenario.id).toHaveLength(1);
      expect(frame?.querySelectorAll(scenario.target ?? ''), scenario.id).toHaveLength(1);
    }
    await expectNoAxeViolations(container);
  });
});
