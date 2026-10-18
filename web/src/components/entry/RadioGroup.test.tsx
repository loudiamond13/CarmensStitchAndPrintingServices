import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as ui from '@/components';
import { RadioGroup } from '@/components/entry';
import { labelClasses } from '@/components/forms';
import { expectNoAxeViolations } from '@/test/axe';

// RadioGroup (SPEC-GAP, plan 05-22; UI-SPEC "RadioGroup", OQ-10, D-47): a borderless fieldset with a legend in the label
// look, holding native radios. Each option is a row with its label and an optional one-line description; the whole row
// is the click target. user-event on real timers (L-24).

const OPTIONS = [
  { value: 'invitation', label: 'Email an invitation', description: 'We email them a link. It works for 7 days.' },
  { value: 'temporary', label: 'Set a temporary password', description: 'You give them a password to use once.' },
] as const;

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

function Controlled({ onValue }: { onValue?: (value: string) => void }) {
  const [value, setValue] = useState('invitation');
  return (
    <RadioGroup
      legend="How they get access"
      name="access"
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      options={OPTIONS}
    />
  );
}

describe('RadioGroup', () => {
  it('is a fieldset named by its legend, holding one native radio per option named by the option label', () => {
    render(<Controlled />);

    const group = screen.getByRole('group', { name: 'How they get access' });
    expect(group.tagName).toBe('FIELDSET');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => radio.tagName === 'INPUT' && radio.getAttribute('type') === 'radio')).toBe(true);
    expect(radios.every((radio) => radio.getAttribute('name') === 'access')).toBe(true);
    expect(screen.getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Set a temporary password' })).not.toBeChecked();
  });

  it('describes each radio with its one-line description', () => {
    render(<Controlled />);

    expect(screen.getByRole('radio', { name: 'Email an invitation' })).toHaveAccessibleDescription(
      'We email them a link. It works for 7 days.',
    );
    expect(screen.getByRole('radio', { name: 'Set a temporary password' })).toHaveAccessibleDescription(
      'You give them a password to use once.',
    );
  });

  it('gives an option with no description no description link', () => {
    render(
      <RadioGroup
        legend="Pick"
        name="pick"
        value="a"
        onChange={() => undefined}
        options={[{ value: 'a', label: 'A' }]}
      />,
    );

    expect(screen.getByRole('radio', { name: 'A' })).not.toHaveAttribute('aria-describedby');
  });

  it('puts the legend in the label look', () => {
    render(<Controlled />);

    const legend = screen.getByText('How they get access');
    expect(legend.tagName).toBe('LEGEND');
    expect(tokens(legend.className)).toEqual(expect.arrayContaining(tokens(labelClasses)));
  });

  it('selects from a click on the label, on the description or on the row, and reports the value', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Controlled onValue={onValue} />);

    await user.click(screen.getByText('Set a temporary password'));
    expect(screen.getByRole('radio', { name: 'Set a temporary password' })).toBeChecked();
    await user.click(screen.getByText('We email them a link. It works for 7 days.'));
    expect(screen.getByRole('radio', { name: 'Email an invitation' })).toBeChecked();

    expect(onValue.mock.calls.map(([value]) => value)).toEqual(['temporary', 'invitation']);
  });

  it('moves and selects with the arrow keys, natively', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    screen.getByRole('radio', { name: 'Email an invitation' }).focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: 'Set a temporary password' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Set a temporary password' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
  });

  it('draws a 44px row, a round 20px control and an accent dot while checked', () => {
    render(<Controlled />);

    const radio = screen.getByRole('radio', { name: 'Email an invitation' });
    const row = radio.closest('label');
    expect(tokens(row?.className)).toEqual(expect.arrayContaining(['min-h-11', 'cursor-pointer']));
    expect(tokens(radio.className)).toEqual(
      expect.arrayContaining(['size-5', 'rounded-full', 'border-2', 'border-ink', 'bg-surface-2', 'checked:bg-accent']),
    );
    const dot = radio.parentElement?.querySelector('[aria-hidden="true"]');
    expect(tokens(dot?.className)).toEqual(
      expect.arrayContaining(['size-2', 'rounded-full', 'bg-on-accent', 'peer-checked:block']),
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<Controlled />);

    await expectNoAxeViolations(container);
  });

  it('is exported from @/components', () => {
    const exports: Readonly<Record<string, unknown>> = ui;
    expect(typeof exports.RadioGroup).toBe('function');
  });
});
