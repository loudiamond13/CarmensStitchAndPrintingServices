// WEB-06, A11Y-01, PERF-03 (02-UI-SPEC SPEC-GAP "OtpInput"): six one-digit boxes in a borderless fieldset. Typing
// advances, Backspace and the arrow keys move back and forth, a paste fills from the focused box, non-digits are
// ignored, paste is always allowed (PRD 12 accessible authentication, T-02-34) and onComplete fires once all six boxes
// are filled. The stylesheet side (box sizes, gaps) is checked in src/styles/overrides.test.ts.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { OTP_INPUT_COPY } from './copy';
import { OtpInput, validateOtp } from './OtpInput';

function boxes(): HTMLInputElement[] {
  return screen.getAllByRole<HTMLInputElement>('textbox', { name: /^Digit \d of 6$/ });
}

function box(n: number): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: `Digit ${String(n)} of 6` });
}

function values(): string[] {
  return boxes().map((input) => input.value);
}

interface HarnessProps {
  initial?: string;
  error?: string;
  onCode?: (code: string) => void;
  onComplete?: (code: string) => void;
}

function Harness({ initial = '', error, onCode, onComplete }: HarnessProps) {
  const [code, setCode] = useState(initial);
  return (
    <OtpInput
      value={code}
      onChange={(next) => {
        setCode(next);
        onCode?.(next);
      }}
      {...(onComplete === undefined ? {} : { onComplete })}
      {...(error === undefined ? {} : { error })}
    />
  );
}

describe('OtpInput markup (WEB-06, PERF-03)', () => {
  it('is a fieldset whose .csp-label legend names six numeric one-digit boxes', () => {
    const { container } = render(<OtpInput />);
    const group = screen.getByRole('group', { name: 'Sign-in code' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group).toHaveClass('csp-otp');
    expect(container.querySelector('fieldset > legend')).toHaveClass('csp-label');
    expect(boxes()).toHaveLength(6);
    boxes().forEach((input, index) => {
      expect(input).toHaveClass('csp-input');
      expect(input.parentElement).toHaveClass('csp-control');
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
      expect(input).toHaveAttribute('maxlength', '1');
      expect(input).toHaveAttribute('aria-label', `Digit ${String(index + 1)} of 6`);
    });
  });

  it('puts autocomplete one-time-code on the first box only', () => {
    render(<OtpInput />);
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code');
    for (const input of boxes().slice(1)) {
      expect(input.getAttribute('autocomplete')).not.toBe('one-time-code');
    }
  });

  it('shows the legend, the hint and no error before the first submit (UI consideration: empty, forms)', async () => {
    const { container } = render(<OtpInput />);
    expect(container.querySelector('legend')?.textContent).toBe(OTP_INPUT_COPY.legend);
    const hint = container.querySelector('.csp-msg');
    expect(hint?.textContent).toBe('Enter the 6-digit code we emailed you.');
    expect(container.querySelector('.csp-msg-error')).toBeNull();
    for (const input of boxes()) {
      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).toHaveAttribute('aria-describedby', hint?.id ?? 'missing');
      expect(input.parentElement).not.toHaveClass('is-invalid');
    }
    await expectNoAxeViolations(container);
  });

  it('marks a required code with " *" in the legend, hidden from the accessible name', () => {
    const { container } = render(<OtpInput required />);
    expect(container.querySelector('legend')?.textContent).toBe('Sign-in code *');
    expect(screen.getByRole('group', { name: 'Sign-in code' })).toBeInTheDocument();
    for (const input of boxes()) {
      expect(input).toBeRequired();
    }
  });

  it('takes a caller label and hint, and the id lands on the first box', () => {
    render(<OtpInput label="Recovery code" hint="Check your phone." id="otp" />);
    expect(screen.getByRole('group', { name: 'Recovery code' })).toBeInTheDocument();
    expect(screen.getByText('Check your phone.')).toHaveClass('csp-msg');
    expect(box(1)).toHaveAttribute('id', 'otp');
  });

  it('shows the error under the group, marks every box invalid and passes axe', async () => {
    const { container } = render(<OtpInput value="12345" onChange={vi.fn()} error={validateOtp('12345') ?? ''} />);
    const message = container.querySelector('.csp-msg-error');
    expect(message?.textContent).toBe('Enter all 6 digits.');
    expect(container.querySelector('fieldset')).toHaveClass('csp-field', 'is-invalid');
    for (const input of boxes()) {
      expect(input.parentElement).toHaveClass('csp-control', 'is-invalid');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', message?.id ?? 'missing');
    }
    await expectNoAxeViolations(container);
  });

  it('shows the digits of a controlled value, one per box, a space meaning an empty box', () => {
    render(<OtpInput value="12 4" onChange={vi.fn()} />);
    expect(values()).toEqual(['1', '2', '', '4', '', '']);
  });
});

describe('OtpInput keyboard (WEB-06)', () => {
  it('advances to the next box after a digit', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(1));
    await user.keyboard('1');
    expect(box(1)).toHaveValue('1');
    expect(box(2)).toHaveFocus();
  });

  it('ignores letters and symbols', async () => {
    const user = userEvent.setup();
    const onCode = vi.fn();
    render(<Harness onCode={onCode} />);
    await user.click(box(1));
    await user.keyboard('x-. ');
    expect(values()).toEqual(['', '', '', '', '', '']);
    expect(box(1)).toHaveFocus();
    expect(onCode).not.toHaveBeenCalled();
  });

  it('moves back on Backspace in an empty box and clears that box', async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);
    await user.click(box(3));
    await user.keyboard('{Backspace}');
    expect(box(2)).toHaveFocus();
    expect(values()).toEqual(['1', '', '', '', '', '']);
  });

  it('clears a filled box on Backspace and stays there', async () => {
    const user = userEvent.setup();
    render(<Harness initial="123" />);
    await user.click(box(2));
    await user.keyboard('{Backspace}');
    expect(box(2)).toHaveFocus();
    expect(values()).toEqual(['1', '', '3', '', '', '']);
  });

  it('does nothing on Backspace in an empty first box', async () => {
    const user = userEvent.setup();
    const onCode = vi.fn();
    render(<Harness onCode={onCode} />);
    await user.click(box(1));
    await user.keyboard('{Backspace}');
    expect(box(1)).toHaveFocus();
    expect(onCode).not.toHaveBeenCalled();
  });

  it('clears the focused box on Delete', async () => {
    const user = userEvent.setup();
    render(<Harness initial="123" />);
    await user.click(box(3));
    await user.keyboard('{Delete}');
    expect(box(3)).toHaveFocus();
    expect(values()).toEqual(['1', '2', '', '', '', '']);
  });

  it('moves with ArrowLeft and ArrowRight, and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(1));
    await user.keyboard('{ArrowLeft}');
    expect(box(1)).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(box(3)).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(box(2)).toHaveFocus();
    await user.click(box(6));
    await user.keyboard('{ArrowRight}');
    expect(box(6)).toHaveFocus();
  });

  it('jumps to the first and last box with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(3));
    await user.keyboard('{End}');
    expect(box(6)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(box(1)).toHaveFocus();
  });

  it('replaces the digit of a filled box and stays on the last box when typing there', async () => {
    const user = userEvent.setup();
    render(<Harness initial="123456" />);
    await user.click(box(6));
    await user.keyboard('9');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '9']);
    expect(box(6)).toHaveFocus();
  });

  it('leaves Tab and shortcut keys to the browser', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Verify</button>
      </>,
    );
    await user.click(box(6));
    await user.keyboard('{Control>}a{/Control}');
    expect(box(6)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Verify' })).toHaveFocus();
  });

  it('never calls onComplete with 1-5 digits (UI consideration: partial)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onCode = vi.fn();
    render(<Harness onComplete={onComplete} onCode={onCode} />);
    await user.click(box(1));
    await user.keyboard('12345');
    expect(onCode).toHaveBeenLastCalledWith('12345');
    expect(onComplete).not.toHaveBeenCalled();
    expect(validateOtp('12345')).toBe('Enter all 6 digits.');
  });

  it('calls onComplete with the code once the sixth digit is typed', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(box(1));
    await user.keyboard('123456');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
    expect(box(6)).toHaveFocus();
  });
});

describe('OtpInput paste (PRD 12 accessible authentication, T-02-34)', () => {
  it('fills all six boxes from the first box and calls onComplete once', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(box(1));
    await user.paste('123456');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
    expect(box(6)).toHaveFocus();
  });

  it('fills from the focused box, skips non-digits and focuses the next empty box', async () => {
    const user = userEvent.setup();
    const onCode = vi.fn();
    render(<Harness onCode={onCode} />);
    await user.click(box(2));
    await user.paste('12a3');
    expect(values()).toEqual(['', '1', '2', '3', '', '']);
    expect(box(5)).toHaveFocus();
    expect(onCode).toHaveBeenLastCalledWith(' 123');
  });

  it('focuses the last box when the boxes after the paste are already filled', async () => {
    const user = userEvent.setup();
    render(<Harness initial="   456" />);
    await user.click(box(1));
    await user.paste('123');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(box(6)).toHaveFocus();
  });

  it('drops digits that do not fit after the focused box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(5));
    await user.paste('9876');
    expect(values()).toEqual(['', '', '', '', '9', '8']);
    expect(box(6)).toHaveFocus();
  });

  it('ignores a paste with no digits', async () => {
    const user = userEvent.setup();
    const onCode = vi.fn();
    render(<Harness onCode={onCode} />);
    await user.click(box(1));
    await user.paste('abc');
    expect(values()).toEqual(['', '', '', '', '', '']);
    expect(onCode).not.toHaveBeenCalled();
  });

  it('takes a code a keyboard or autofill types straight into a box, digits only', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const first = box(1);
    first.focus();
    // A virtual keyboard (key "Unidentified") or one-time-code autofill writes the box value directly.
    fireEvent.change(first, { target: { value: '123456' } });
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('clears a box whose value is deleted directly and ignores a direct non-digit', () => {
    const onCode = vi.fn();
    render(<Harness initial="12" onCode={onCode} />);
    fireEvent.change(box(2), { target: { value: '' } });
    expect(values()).toEqual(['1', '', '', '', '', '']);
    fireEvent.change(box(3), { target: { value: 'x' } });
    expect(values()).toEqual(['1', '', '', '', '', '']);
    expect(onCode).toHaveBeenCalledTimes(1);
  });
});

describe('OtpInput without a controlled value', () => {
  it('keeps its own digits and reports the code', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput defaultValue="1" onChange={onChange} />);
    await user.click(box(2));
    await user.keyboard('2');
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(onChange).toHaveBeenLastCalledWith('12');
  });

  it('works with no callbacks at all', async () => {
    const user = userEvent.setup();
    render(<OtpInput />);
    await user.click(box(1));
    await user.paste('123456');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

describe('OtpInput re-render', () => {
  it('keeps its markup when re-rendered with equal props (compiler cache path)', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <OtpInput value="12" onChange={onChange} required error="Enter all 6 digits." />,
    );
    const before = container.innerHTML;
    rerender(<OtpInput value="12" onChange={onChange} required error="Enter all 6 digits." />);
    expect(container.innerHTML).toBe(before);
  });
});

describe('validateOtp (UI-SPEC copy)', () => {
  it.each(['', '1', '12345', '12 456', '12345a', '1234567'])('asks for all 6 digits for %j', (code) => {
    expect(validateOtp(code)).toBe('Enter all 6 digits.');
  });

  it('accepts six digits', () => {
    expect(validateOtp('123456')).toBeNull();
  });
});
