// WEB-06, A11Y-01, D-03 (02-UI-SPEC SPEC-GAP "Checkbox"): a native checkbox wrapped in label.s-check (spec section 8.2
// markup). The label text is the accessible name, and overrides.css draws the D-03 second cue (dark border and tick).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Checkbox } from './Checkbox';

function Harness({ initial = false, onValue }: { initial?: boolean; onValue?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(initial);
  return (
    <Checkbox
      label="Keep me signed in"
      name="remember"
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onValue?.(next);
      }}
    />
  );
}

describe('Checkbox (WEB-06, D-03)', () => {
  it('renders label.s-check around a native checkbox named by the label text', async () => {
    const { container } = render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });
    expect(box.tagName).toBe('INPUT');
    expect(box).toHaveAttribute('type', 'checkbox');
    expect(box).toHaveAttribute('name', 'remember');
    expect(box.parentElement?.tagName).toBe('LABEL');
    expect(box.parentElement).toHaveClass('s-check');
    expect(box).not.toBeChecked();
    await expectNoAxeViolations(container);
  });

  it('toggles when the label text is clicked, and reports the new state', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(screen.getByText('Keep me signed in'));
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).toBeChecked();
    expect(onValue).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByText('Keep me signed in'));
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).not.toBeChecked();
    expect(onValue).toHaveBeenLastCalledWith(false);
  });

  it('toggles with the Space key', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).toBeChecked();
  });

  it('passes axe when checked', async () => {
    const { container } = render(<Harness initial />);
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).toBeChecked();
    await expectNoAxeViolations(container);
  });

  it('marks a required box with " *" outside its accessible name, and shows no error before the first submit', () => {
    const { container } = render(<Checkbox label="I agree" required onChange={vi.fn()} checked={false} />);
    const box = screen.getByRole('checkbox', { name: 'I agree' });
    expect(box).toBeRequired();
    expect(container.querySelector('label')?.textContent).toBe('I agree *');
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(box).not.toHaveAttribute('aria-describedby');
    expect(container.querySelector('.csp-msg')).toBeNull();
  });

  it('shows a hint, then the caller error with aria-invalid', async () => {
    const { container, rerender } = render(<Checkbox label="I agree" hint="Read the terms first." id="agree" />);
    const hint = container.querySelector('.csp-msg');
    expect(hint?.textContent).toBe('Read the terms first.');
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toHaveAttribute('aria-describedby', hint?.id ?? 'x');
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toHaveAttribute('id', 'agree');
    rerender(<Checkbox label="I agree" hint="Read the terms first." id="agree" error="Tick the box to continue." />);
    const box = screen.getByRole('checkbox', { name: 'I agree' });
    const message = container.querySelector('.csp-msg-error');
    expect(message?.textContent).toBe('Tick the box to continue.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAttribute('aria-describedby', message?.id ?? 'x');
    await expectNoAxeViolations(container);
  });

  it('works uncontrolled with no callback', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Keep me signed in" defaultChecked />);
    await user.click(screen.getByText('Keep me signed in'));
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).not.toBeChecked();
  });

  it('keeps its markup when re-rendered with equal props (compiler cache path)', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Checkbox label="I agree" checked onChange={onChange} required hint="Read it." />,
    );
    const before = container.innerHTML;
    rerender(<Checkbox label="I agree" checked onChange={onChange} required hint="Read it." />);
    expect(container.innerHTML).toBe(before);
  });
});
