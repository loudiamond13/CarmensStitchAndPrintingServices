import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { DateInput } from '@/components';
import * as forms from '@/components/forms';
import {
  dateIconClasses,
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  pickerControlClasses,
  pickerIconClasses,
  requiredClasses,
} from './field.recipe';

// DateInput (SPEC-GAP, first needed by the Audit Log range filter, plan 05-32; UI-SPEC "DateInput"): a Field with a native
// date input, the field-control look (44px, 16px text), min and max, and a YYYY-MM-DD value in business time. Range and
// format checks are the caller's (zod, OR-3); the caller's message shows under the field through `error`.

function dateInput(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(new RegExp(`^${name}`));
}

function tokens(...classLists: string[]): string[] {
  return classLists.join(' ').split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

describe('DateInput (SPEC-GAP)', () => {
  it('is exported from the forms barrel and from @/components as one implementation', () => {
    expect(typeof forms.DateInput).toBe('function');
    expect(DateInput).toBe(forms.DateInput);
  });

  it('renders a labelled native date input carrying the value, min and max', () => {
    render(<DateInput label="From" value="2026-10-05" min="2026-02-18" max="2026-10-18" onChange={() => undefined} />);
    const input = dateInput('From');

    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-10-05');
    expect(input).toHaveAttribute('min', '2026-02-18');
    expect(input).toHaveAttribute('max', '2026-10-18');
  });

  it('calls onChange with the YYYY-MM-DD string', () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <DateInput
          label="To"
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Harness />);
    fireEvent.change(dateInput('To'), { target: { value: '2026-10-18' } });

    expect(onChange).toHaveBeenCalledWith('2026-10-18');
    expect(dateInput('To')).toHaveValue('2026-10-18');
  });

  it('shows the caller error under the field and marks the input invalid', () => {
    render(
      <DateInput
        label="From"
        value="2025-01-01"
        min="2026-02-18"
        onChange={() => undefined}
        error="Pick a date from the last 8 months."
      />,
    );
    const input = dateInput('From');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pick a date from the last 8 months.')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Pick a date from the last 8 months.');
  });

  it('shows the hint when there is no error', () => {
    render(<DateInput label="From" value="" onChange={() => undefined} hint="Up to 8 months back." />);
    expect(dateInput('From')).toHaveAccessibleDescription('Up to 8 months back.');
    expect(dateInput('From')).not.toHaveAttribute('aria-invalid');
  });

  it('uses the 44px, 16px field-control look', () => {
    render(<DateInput label="From" value="" onChange={() => undefined} />);
    const classes = [...dateInput('From').classList].sort();

    expect(classes).toEqual(fieldInputClasses({ date: true }).split(/\s+/).filter(Boolean).sort());
    expect(classes).toEqual(expect.arrayContaining(['h-11', 'text-[16px]']));
  });

  it('passes native props through, such as disabled and required', () => {
    render(<DateInput label="From" value="" onChange={() => undefined} disabled required />);
    expect(dateInput('From')).toBeDisabled();
    expect(dateInput('From')).toBeRequired();
  });

  it('lays out the label, the picker box holding the native input and the calendar icon, then one message (D-63)', () => {
    const { container } = render(
      <DateInput label="From" value="" onChange={() => undefined} hint="Hint." className="mt-4" required />,
    );
    const field = container.firstElementChild;
    const [label, box, message] = [...(field?.children ?? [])];
    const input = dateInput('From');
    const icon = input.nextElementSibling;

    expect(classTokens(field)).toEqual(tokens(fieldClasses, 'mt-4'));
    expect(classTokens(label)).toEqual(tokens(labelClasses));
    expect(label).toHaveTextContent('From *');
    expect(classTokens(label?.querySelector('span'))).toEqual(tokens(requiredClasses));
    expect(label?.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
    expect(classTokens(box)).toEqual(tokens(fieldControlClasses, pickerControlClasses));
    expect(input.parentElement).toBe(box);
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveClass('lucide-calendar');
    expect(icon).toHaveAttribute('width', '18');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.getAttribute('class')?.split(/\s+/)).toEqual(
      expect.arrayContaining(tokens(pickerIconClasses, dateIconClasses)),
    );
    expect(icon?.nextElementSibling).toBeNull();
    expect(classTokens(message)).toEqual(tokens(messageClasses({ error: false })));
    expect(message).toHaveAttribute('id', `${input.id}-msg`);
    expect(input).toHaveAttribute('aria-describedby', `${input.id}-msg`);
    expect(input).toBeRequired();
  });

  it('shows the error with the triangle-alert icon instead of the hint, and a caller id names the input (D-63)', () => {
    render(<DateInput id="when" label="On" value="" onChange={() => undefined} hint="Hint." error="Enter a date." />);
    const message = document.getElementById('when-msg');

    expect(dateInput('On')).toHaveAttribute('id', 'when');
    expect(message).toHaveTextContent('Enter a date.');
    expect(message?.querySelector('.lucide-triangle-alert')).not.toBeNull();
    expect(classTokens(message)).toEqual(tokens(messageClasses({ error: true })));
    expect(screen.queryByText('Hint.')).toBeNull();
  });

  it('treats an empty id as none', () => {
    render(<DateInput id="" label="On" value="" onChange={() => undefined} />);
    expect(dateInput('On').id).not.toBe('');
  });

  it('writes no date out beside the box, whatever the value (D-63)', () => {
    const { container, rerender } = render(<DateInput label="From" value="2026-09-26" onChange={() => undefined} />);

    expect(container).not.toHaveTextContent('Sep 26, 2026');
    expect([...(container.firstElementChild?.children ?? [])].map((child) => child.localName)).toEqual([
      'label',
      'div',
    ]);
    rerender(<DateInput label="From" value="" onChange={() => undefined} hint="Hint." />);
    expect([...(container.firstElementChild?.children ?? [])].map((child) => child.localName)).toEqual([
      'label',
      'div',
      'p',
    ]);
  });

  it('no longer takes the written-out date option (D-63)', () => {
    // Type-level only: never rendered, so the unknown prop does not reach the DOM.
    const neverRendered = () => (
      // @ts-expect-error D-63 removed readableDate; the compiler must fail if it comes back.
      <DateInput label="From" value="" onChange={() => undefined} readableDate />
    );
    expect(typeof neverRendered).toBe('function');
  });

  it('has no axe violations, plain, with an error or required', async () => {
    const plain = render(<DateInput label="From" value="2026-10-05" onChange={() => undefined} />);
    await expectNoAxeViolations(plain.container);
    plain.unmount();
    const invalid = render(<DateInput label="From" value="" onChange={() => undefined} error="Enter a date." />);
    await expectNoAxeViolations(invalid.container);
    invalid.unmount();
    const required = render(
      <DateInput label="On" value="2026-09-26" onChange={() => undefined} required hint="Hint." />,
    );
    await expectNoAxeViolations(required.container);
  });
});
