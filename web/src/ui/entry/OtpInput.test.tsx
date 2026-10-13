import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type SubmitEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as entryScenarios } from '@/dev/scenarios/groups/entry';
import { expectNoAxeViolations } from '@/test/axe';
import { ENTRY_COPY, OtpInput, otpInputError, type OtpInputProps } from '@/ui/entry';
import { fieldControlClasses, fieldInputClasses, labelClasses, messageClasses } from '@/ui/forms';

// OtpInput (SPEC-GAP, plan 02-27; UI-SPEC "SPEC-GAP Primitive Specs" → OtpInput, "UI Considerations" partial |
// OtpInput, WEB-06, A11Y-02): six one-digit boxes in a borderless fieldset. Typing advances, Backspace goes back,
// the arrows move, a paste fills from the focused box, only ASCII digits count, and onComplete fires when all six are
// filled. user-event on real timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

function digitBox(index: number): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: ENTRY_COPY.otp.digit(index, 6) });
}

function values(): string[] {
  return [1, 2, 3, 4, 5, 6].map((index) => digitBox(index).value);
}

/** A sign-in form: on submit it shows the OtpInput error for an incomplete code. */
function SignInForm(props: Omit<OtpInputProps, 'onChange' | 'error'>) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(otpInputError(code));
  };
  return (
    <form aria-label="Sign in" onSubmit={submit}>
      <OtpInput {...props} onChange={setCode} {...(error === null ? {} : { error })} />
      <button type="submit">Verify</button>
    </form>
  );
}

describe('OtpInput markup (UI-SPEC OtpInput, PERF-03)', () => {
  it('is a fieldset named by its legend, with six numeric boxes named "Digit i of 6", boxes 2 to 6 one digit long', () => {
    render(<OtpInput />);
    const group = screen.getByRole('group', { name: ENTRY_COPY.otp.legend });
    expect(group.tagName).toBe('FIELDSET');
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    for (const index of [1, 2, 3, 4, 5, 6]) {
      const box = digitBox(index);
      expect(box).toHaveAttribute('inputmode', 'numeric');
      expect(box).toHaveAttribute('pattern', '[0-9]*');
      expect(box.type).toBe('text');
    }
    for (const index of [2, 3, 4, 5, 6]) {
      expect(digitBox(index)).toHaveAttribute('maxlength', '1');
    }
  });

  it('offers one-time-code autofill on the first box only, with no maxlength to cut the code to one digit (UI-WR-08)', () => {
    render(<OtpInput />);
    expect(digitBox(1)).toHaveAttribute('autocomplete', 'one-time-code');
    // Autofill and keyboard code suggestions insert text as user input, which maxlength would cut to its first digit.
    expect(digitBox(1)).not.toHaveAttribute('maxlength');
    for (const index of [2, 3, 4, 5, 6]) {
      expect(digitBox(index)).toHaveAttribute('autocomplete', 'off');
    }
  });

  it('shows the default legend and hint, linked to every box', () => {
    render(<OtpInput />);
    expect(ENTRY_COPY.otp.legend).toBe('Sign-in code');
    expect(ENTRY_COPY.otp.hint).toBe('Enter the 6-digit code we emailed you.');
    const hint = screen.getByText(ENTRY_COPY.otp.hint);
    for (const index of [1, 2, 3, 4, 5, 6]) {
      expect(digitBox(index)).toHaveAttribute('aria-describedby', hint.id);
      expect(digitBox(index)).not.toHaveAttribute('aria-invalid');
    }
  });

  it('takes a caller legend, hint, required mark and first-box id', () => {
    const { container } = render(<OtpInput label="Verification code" hint="Check your email." required id="otp" />);
    expect(screen.getByRole('group', { name: /Verification code/ })).toBeInTheDocument();
    expect(screen.getByText('Check your email.')).toBeInTheDocument();
    expect(container.querySelector('legend [aria-hidden="true"]')?.textContent).toBe(' *');
    expect(digitBox(1).id).toBe('otp');
    expect(digitBox(1)).toBeRequired();
  });

  it('builds on the shared field recipes: label legend, control boxes, 16px centred tabular digits', () => {
    const { container } = render(<OtpInput />);
    const legend = container.querySelector('legend');
    expect(tokens(legend?.className)).toEqual(expect.arrayContaining(tokens(labelClasses)));
    expect(tokens(legend?.className)).toContain('pb-2');

    const box = digitBox(1);
    const control = box.parentElement;
    expect(tokens(control?.className)).toEqual(tokens(`${fieldControlClasses} min-w-11 max-w-14 flex-[1_1_0]`));
    expect(tokens(box.className)).toEqual(tokens(`${fieldInputClasses()} text-center tabular-nums`));
    expect(tokens(box.className)).toContain('text-[16px]');

    const row = control?.parentElement;
    expect(tokens(row?.className)).toEqual(tokens('flex gap-2 pg-xs:gap-1'));
    expect(tokens(container.querySelector('fieldset')?.className)).toEqual(
      expect.arrayContaining(['m-0', 'border-0', 'p-0']),
    );
    expect(tokens(screen.getByText(ENTRY_COPY.otp.hint).className)).toEqual(tokens(messageClasses({ error: false })));
  });
});

describe('OtpInput typing and moving (A11Y-02 keyboard)', () => {
  it('advances as digits are typed and fires onComplete once with the six digits', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(code: string) => void>();
    const onChange = vi.fn<(code: string) => void>();
    render(<OtpInput onComplete={onComplete} onChange={onChange} />);
    await user.click(digitBox(1));
    await user.keyboard('12345');
    expect(digitBox(6)).toHaveFocus();
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard('6');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });

  it('ignores letters, symbols and full-width or other-script digits (ASCII 0-9 only)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(code: string) => void>();
    render(<OtpInput onChange={onChange} />);
    await user.click(digitBox(1));
    await user.keyboard('a-１٣ ');
    expect(values()).toEqual(['', '', '', '', '', '']);
    expect(digitBox(1)).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves back on Backspace in an empty box and clears that box', async () => {
    const user = userEvent.setup();
    render(<OtpInput defaultValue="12" />);
    await user.click(digitBox(3));
    await user.keyboard('{Backspace}');
    expect(digitBox(2)).toHaveFocus();
    expect(values()).toEqual(['1', '', '', '', '', '']);
  });

  it('clears a filled box on Backspace or Delete and stays there', async () => {
    const user = userEvent.setup();
    render(<OtpInput defaultValue="123" />);
    await user.click(digitBox(2));
    await user.keyboard('{Backspace}');
    expect(digitBox(2)).toHaveFocus();
    expect(values()).toEqual(['1', '', '3', '', '', '']);
    await user.click(digitBox(3));
    await user.keyboard('{Delete}');
    expect(values()).toEqual(['1', '', '', '', '', '']);
  });

  it('does nothing on Backspace in the empty first box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(code: string) => void>();
    render(<OtpInput onChange={onChange} />);
    await user.click(digitBox(1));
    await user.keyboard('{Backspace}');
    expect(digitBox(1)).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves with ← and →, Home and End, and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<OtpInput />);
    await user.click(digitBox(3));
    await user.keyboard('{ArrowLeft}');
    expect(digitBox(2)).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(digitBox(4)).toHaveFocus();
    await user.keyboard('{End}{ArrowRight}');
    expect(digitBox(6)).toHaveFocus();
    await user.keyboard('{Home}{ArrowLeft}');
    expect(digitBox(1)).toHaveFocus();
  });

  it('replaces the digit in a filled box with the one typed', async () => {
    const user = userEvent.setup();
    render(<OtpInput defaultValue="123" />);
    await user.click(digitBox(2));
    await user.keyboard('9');
    expect(values()).toEqual(['1', '9', '3', '', '', '']);
    expect(digitBox(3)).toHaveFocus();
  });

  it('leaves Tab and shortcuts to the browser', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <OtpInput />
        <button type="button">Next</button>
      </div>,
    );
    await user.click(digitBox(6));
    await user.keyboard('{Control>}a{/Control}');
    expect(values()).toEqual(['', '', '', '', '', '']);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });
});

describe('OtpInput paste and direct input (PRD §12 accessible authentication)', () => {
  it('fills every box from a paste into box 1, ignoring spaces and dashes', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(code: string) => void>();
    render(<OtpInput onComplete={onComplete} />);
    await user.click(digitBox(1));
    await user.paste('12 34-56');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(digitBox(6)).toHaveFocus();
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('fills box 4 from a one-digit paste there and focuses box 5', async () => {
    const user = userEvent.setup();
    render(<OtpInput />);
    await user.click(digitBox(4));
    await user.paste('9');
    expect(values()).toEqual(['', '', '', '9', '', '']);
    expect(digitBox(5)).toHaveFocus();
  });

  it('focuses the next empty box after the pasted digits, and drops digits past box 6', async () => {
    const user = userEvent.setup();
    render(<OtpInput defaultValue="1    6" />);
    await user.click(digitBox(2));
    await user.paste('23');
    expect(values()).toEqual(['1', '2', '3', '', '', '6']);
    expect(digitBox(4)).toHaveFocus();
    await user.click(digitBox(4));
    await user.paste('4567');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(digitBox(6)).toHaveFocus();
  });

  it('ignores a paste with no ASCII digit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(code: string) => void>();
    render(<OtpInput onChange={onChange} />);
    await user.click(digitBox(1));
    await user.paste('abc １２３');
    expect(values()).toEqual(['', '', '', '', '', '']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fills from a value written straight into a box (one-time-code autofill, virtual keyboards)', () => {
    const onComplete = vi.fn<(code: string) => void>();
    render(<OtpInput onComplete={onComplete} />);
    const first = digitBox(1);
    // Autofill sets the value and fires input without key events.
    fireEvent.input(first, { target: { value: '654321' } });
    expect(values()).toEqual(['6', '5', '4', '3', '2', '1']);
    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('clears a box whose value is deleted directly, and ignores direct non-digits', () => {
    render(<OtpInput defaultValue="12" />);
    const second = digitBox(2);
    fireEvent.input(second, { target: { value: '' } });
    expect(values()).toEqual(['1', '', '', '', '', '']);
    fireEvent.input(second, { target: { value: 'x' } });
    expect(values()).toEqual(['1', '', '', '', '', '']);
  });

  it('follows a controlled value', () => {
    const { rerender } = render(<OtpInput value="12" />);
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    rerender(<OtpInput value="98 7" />);
    expect(values()).toEqual(['9', '8', '', '7', '', '']);
  });
});

describe('OtpInput partial code and errors (UI considerations: partial | OtpInput)', () => {
  it('gives "Enter all 6 digits." for anything but six digits', () => {
    expect(ENTRY_COPY.otp.incomplete).toBe('Enter all 6 digits.');
    expect(otpInputError('123456')).toBeNull();
    for (const code of ['', '1234', '12 456', '1234567', '１２３４５６']) {
      expect(otpInputError(code), code).toBe(ENTRY_COPY.otp.incomplete);
    }
  });

  it('shows the error on submit with 4 digits and marks every box invalid; onComplete never fired', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(code: string) => void>();
    render(<SignInForm onComplete={onComplete} />);
    await user.click(digitBox(1));
    await user.keyboard('1234');
    expect(screen.queryByText(ENTRY_COPY.otp.incomplete)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Verify' }));
    const message = screen.getByText(ENTRY_COPY.otp.incomplete);
    expect(tokens(message.className)).toEqual(tokens(messageClasses({ error: true })));
    for (const index of [1, 2, 3, 4, 5, 6]) {
      expect(digitBox(index)).toHaveAttribute('aria-invalid', 'true');
      expect(digitBox(index)).toHaveAttribute('aria-describedby', message.id);
    }
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(ENTRY_COPY.otp.hint)).toBeNull();
  });

  it('shows no message when the hint is empty and there is no error', () => {
    const { container } = render(<OtpInput hint="" />);
    expect(container.querySelector('p')).toBeNull();
    expect(digitBox(1)).not.toHaveAttribute('aria-describedby');
  });
});

describe('OtpInput accessibility and re-render', () => {
  it('has no axe violations empty, and with an error', async () => {
    const { container } = render(
      <div>
        <OtpInput />
        <OtpInput label="Backup code" defaultValue="1234" error={ENTRY_COPY.otp.incomplete} />
      </div>,
    );
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<OtpInput defaultValue="12" />);
    const first = container.innerHTML;
    rerender(<OtpInput defaultValue="12" />);
    expect(container.innerHTML).toBe(first);
    rerender(<OtpInput defaultValue="12" error={ENTRY_COPY.otp.incomplete} />);
    expect(screen.getByText(ENTRY_COPY.otp.incomplete)).toBeInTheDocument();
  });
});

describe('OTP scenarios (the entry group)', () => {
  const otp = entryScenarios.filter((scenario) => scenario.node.component === 'OtpInput');

  it('declares the empty and error cases, implementation only, at rest and with keyboard focus, both themes', () => {
    expect(otp.map((scenario) => scenario.id)).toEqual(['otp-empty', 'otp-error']);
    for (const scenario of otp) {
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.states, scenario.id).toEqual(['rest', 'focus-visible']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
    }
    expect(otp[1]?.node.props?.error).toBe(ENTRY_COPY.otp.incomplete);
  });

  it('renders both OTP scenarios through the implementation kit with no axe violations', async () => {
    const { container } = render(
      <div>
        {otp.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    expect(container.querySelectorAll('fieldset')).toHaveLength(2);
    expect(container.querySelectorAll('input[aria-invalid="true"]')).toHaveLength(6);
    await expectNoAxeViolations(container);
  });
});
