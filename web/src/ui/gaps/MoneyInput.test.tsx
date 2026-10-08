// ORD-09, WEB-06, PERF-03 (02-UI-SPEC SPEC-GAP "MoneyInput"): a 2-decimal amount box on the numeric keypad. It keeps
// at most 9 integer digits and 2 decimals, strips grouping from a paste, pads on blur, emits a string and converts to
// exact centavos only through toCentavos (D-09). The stylesheet side (16px boxes, the text-right rule) is checked in
// src/styles/overrides.test.ts, the node-typed CSS test (Vitest stubs CSS imports, even with ?raw).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { toCentavos } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { MONEY_INPUT_COPY } from './copy';
import { MoneyInput, normalizeMoneyOnBlur, validateMoneyInput } from './MoneyInput';

interface HarnessProps {
  initial?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  onValue?: (value: string) => void;
  onBlur?: () => void;
}

function Harness({ initial = '', onValue, onBlur, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MoneyInput
        label="Amount"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        onBlur={() => {
          onBlur?.();
        }}
        {...props}
      />
      <button type="button">Next field</button>
    </>
  );
}

function amountBox(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount' });
}

describe('MoneyInput markup (ORD-09, PERF-03)', () => {
  it('is a text box with the decimal keypad, no autocomplete and the ₱ prefix inside the control', () => {
    render(<Harness />);
    const input = amountBox();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveClass('csp-input');
    const control = input.closest('.csp-control');
    expect(control).toHaveClass('has-prefix');
    expect(control?.querySelector('.csp-prefix')?.textContent).toBe('₱');
    expect(MONEY_INPUT_COPY.prefix).toBe('₱');
  });

  it('is left-aligned by default and right-aligned only when the caller passes text-right (item rows)', () => {
    const { container, rerender } = render(<MoneyInput label="Amount" value="" onChange={vi.fn()} />);
    expect(container.querySelector('.csp-field')).not.toHaveClass('text-right');
    rerender(<MoneyInput label="Amount" value="" onChange={vi.fn()} className="text-right" />);
    expect(container.querySelector('.csp-field')).toHaveClass('text-right');
  });
});

describe('MoneyInput keystrokes and paste (ORD-09 boundary edge)', () => {
  it('ignores a third decimal: typing 1250.505 leaves 1250.50', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '1250.505');
    expect(amountBox()).toHaveValue('1250.50');
  });

  it('ignores a tenth integer digit: typing 1234567890 leaves 123456789', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '1234567890');
    expect(amountBox()).toHaveValue('123456789');
  });

  it.each(['-', 'a', 'e', '+'])('ignores %s', async (key) => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial="12" onValue={onValue} />);
    await user.type(amountBox(), key);
    expect(amountBox()).toHaveValue('12');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('never formats with grouping while editing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '1250000');
    expect(amountBox()).toHaveValue('1250000');
  });

  it.each(['1,250.50', '1 250.50', '1 250.50'])('strips grouping from a paste: %s gives 1250.50', async (text) => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(amountBox());
    await user.paste(text);
    expect(amountBox()).toHaveValue('1250.50');
    expect(onValue).toHaveBeenLastCalledWith('1250.50');
  });

  it.each(['12.345', '-5', '1e3', '12a'])('leaves the previous value for a paste of %s', async (text) => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial="7" onValue={onValue} />);
    await user.tripleClick(amountBox());
    await user.paste(text);
    expect(amountBox()).toHaveValue('7');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('emits a string that toCentavos turns into exact centavos', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Harness onValue={onValue} />);
    await user.click(amountBox());
    await user.paste('1,250.50');
    const emitted = onValue.mock.lastCall?.[0];
    expect(typeof emitted).toBe('string');
    expect(toCentavos(emitted ?? '')).toBe(125050n);
  });
});

describe('MoneyInput blur padding (ORD-09 boundary edge)', () => {
  it.each([
    ['5000', '5000.00'],
    ['5.', '5.00'],
    ['.5', '0.50'],
    ['5.5', '5.50'],
    ['1250.50', '1250.50'],
    ['.', ''],
    ['', ''],
  ])('normalizeMoneyOnBlur(%j) is %j', (value, expected) => {
    expect(normalizeMoneyOnBlur(value)).toBe(expected);
  });

  it('leaves a value that is not a money string alone', () => {
    expect(normalizeMoneyOnBlur('12.345')).toBe('12.345');
  });

  it('pads the typed value when the box loses focus and still calls the caller onBlur', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onValue = vi.fn();
    render(<Harness onBlur={onBlur} onValue={onValue} />);
    await user.type(amountBox(), '5000');
    await user.tab();
    expect(amountBox()).toHaveValue('5000.00');
    expect(onValue).toHaveBeenLastCalledWith('5000.00');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps an empty box empty on blur and emits nothing', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(amountBox());
    await user.tab();
    expect(amountBox()).toHaveValue('');
    expect(onValue).not.toHaveBeenCalled();
  });
});

describe('validateMoneyInput (UI-SPEC copy)', () => {
  it('asks for an amount when a required box is empty', () => {
    expect(validateMoneyInput('', { required: true })).toBe('Enter an amount.');
  });

  it('accepts an empty optional box', () => {
    expect(validateMoneyInput('', {})).toBeNull();
    expect(validateMoneyInput('')).toBeNull();
  });

  it.each(['12.345', '.', '-5', '1,250.50', '1234567890'])('explains the format for %j', (value) => {
    expect(validateMoneyInput(value, {})).toBe('Enter an amount like 1250.50 (numbers only, up to 2 decimals).');
  });

  it.each(['1250.50', '5', '5.', '.5', '0.00'])('accepts %j', (value) => {
    expect(validateMoneyInput(value, { required: true })).toBeNull();
  });
});

describe('MoneyInput empty and error states (UI consideration: empty, forms; A11Y-01)', () => {
  it('shows the label, required marker, hint and placeholder, and no error before the first submit', async () => {
    const { container } = render(
      <MoneyInput
        label="Amount"
        value=""
        onChange={vi.fn()}
        required
        hint="Enter the amount received."
        placeholder="0.00"
      />,
    );
    const input = amountBox();
    expect(container.querySelector('.csp-label')?.textContent).toBe('Amount *');
    expect(input).toHaveAttribute('placeholder', '0.00');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('.csp-msg')?.textContent).toBe('Enter the amount received.');
    expect(container.querySelector('.csp-msg-error')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('shows the caller error with aria-invalid once the caller passes it', async () => {
    const error = validateMoneyInput('12.345', {}) ?? '';
    const { container } = render(<MoneyInput label="Amount" value="12" onChange={vi.fn()} error={error} />);
    const input = amountBox();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = container.querySelector('.csp-msg-error');
    expect(message?.textContent).toBe(MONEY_INPUT_COPY.invalid);
    expect(input).toHaveAttribute('aria-describedby', message?.id ?? 'missing');
    await expectNoAxeViolations(container);
  });
});
