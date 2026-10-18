import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { DateInput } from '@/components';
import * as forms from '@/components/forms';
import { fieldInputClasses } from './field.recipe';

// DateInput (SPEC-GAP, first needed by the Audit Log range filter, plan 05-32; UI-SPEC "DateInput"): a Field with a native
// date input, the field-control look (44px, 16px text), min and max, and a YYYY-MM-DD value in business time. Range and
// format checks are the caller's (zod, OR-3); the caller's message shows under the field through `error`.

function dateInput(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(name);
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

    expect(classes).toEqual(fieldInputClasses({ prefix: false }).split(/\s+/).filter(Boolean).sort());
    expect(classes).toEqual(expect.arrayContaining(['h-11', 'text-[16px]']));
  });

  it('passes native props through, such as disabled and required', () => {
    render(<DateInput label="From" value="" onChange={() => undefined} disabled required />);
    expect(dateInput('From')).toBeDisabled();
    expect(dateInput('From')).toBeRequired();
  });

  it('has no axe violations, plain or with an error', async () => {
    const plain = render(<DateInput label="From" value="2026-10-05" onChange={() => undefined} />);
    await expectNoAxeViolations(plain.container);
    plain.unmount();
    const invalid = render(<DateInput label="From" value="" onChange={() => undefined} error="Enter a date." />);
    await expectNoAxeViolations(invalid.container);
  });
});
