// WEB-06, A11Y-01 (02-UI-SPEC: PasswordField is the WEB-06 "PasswordInput", App. D.3 verbatim behaviour): the reveal
// toggle, the strength meter and its empty hint. These are characterization tests of the reconciled App. D.3 code
// (plan 09 proved its DOM equals the frozen reference); nothing here changes the component.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { PasswordField } from './index';

function passwordBox(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('Password');
}

describe('PasswordField reveal toggle (WEB-06, T-02-35)', () => {
  it('starts hidden, then switches between Show password and Hide password', async () => {
    const user = userEvent.setup();
    render(<PasswordField defaultValue="Abcdefg1!" />);
    expect(passwordBox()).toHaveAttribute('type', 'password');
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show).toHaveAttribute('aria-pressed', 'false');
    await user.click(show);
    expect(passwordBox()).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    await user.click(hide);
    expect(passwordBox()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('keeps the typed value when revealed and reports each change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordField onChange={onChange} />);
    await user.type(passwordBox(), 'pw1');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordBox()).toHaveValue('pw1');
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe('PasswordField strength (WEB-06)', () => {
  it('shows the empty hint before anything is typed (UI consideration: empty, forms)', async () => {
    const { container } = render(<PasswordField showStrength />);
    expect(container.querySelector('.csp-strength-label')?.textContent).toBe(
      'Use 8+ characters with a number and a symbol',
    );
    expect(container.querySelector('.csp-strength')).toHaveClass('is-0');
    expect(passwordBox()).not.toHaveAttribute('aria-invalid');
    await expectNoAxeViolations(container);
  });

  it.each([
    ['abc', 'Weak', 1],
    ['abcdefg1', 'Fair', 2],
    ['Abcdefg1', 'Good', 3],
    ['Abcdefg1!', 'Strong', 4],
  ])('rates %j as %s', async (password, label, score) => {
    const user = userEvent.setup();
    const { container } = render(<PasswordField showStrength />);
    await user.type(passwordBox(), password);
    expect(container.querySelector('.csp-strength-label')?.textContent).toBe(label);
    expect(container.querySelector('.csp-strength')).toHaveClass(`is-${String(score)}`);
    expect(container.querySelectorAll('.csp-strength-bars .on')).toHaveLength(score);
  });

  it('shows no meter unless asked', () => {
    const { container } = render(<PasswordField defaultValue="abc" />);
    expect(container.querySelector('.csp-strength')).toBeNull();
  });
});

describe('PasswordField hint and error (A11Y-01)', () => {
  it('describes the box with the hint, then with the caller error, and passes axe in both states', async () => {
    const { container, rerender } = render(<PasswordField hint="At least 8 characters." showStrength />);
    const hint = container.querySelector('.csp-msg');
    expect(hint?.textContent).toBe('At least 8 characters.');
    expect(passwordBox()).toHaveAttribute('aria-describedby', hint?.id ?? 'x');
    await expectNoAxeViolations(container);
    rerender(<PasswordField hint="At least 8 characters." showStrength error="Enter your password." />);
    const message = container.querySelector('.csp-msg-error');
    expect(message?.textContent).toBe('Enter your password.');
    expect(passwordBox()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordBox()).toHaveAttribute('aria-describedby', message?.id ?? 'x');
    await expectNoAxeViolations(container);
  });
});
