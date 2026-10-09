import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as entryScenarios } from '@/dev/scenarios/groups/entry';
import { moneyTextToCentavos } from '@/lib/format';
import { expectNoAxeViolations } from '@/test/axe';
import { ENTRY_COPY, MoneyInput, moneyInputError, type MoneyInputProps } from '@/ui/entry';

// MoneyInput (SPEC-GAP, plan 02-27; UI-SPEC "SPEC-GAP Primitive Specs" → MoneyInput, ORD-09): a Field with the ₱
// prefix that only ever holds money text (at most 9 integer digits and 2 decimals, ASCII digits only, no sign, no
// grouping), cleans a paste, pads on blur and never changes what was typed otherwise. user-event on real timers (L-24).

type HarnessProps = Omit<MoneyInputProps, 'value' | 'onChange'> & {
  initial?: string;
  onValue?: (value: string) => void;
};

/** A form that owns the value, as a screen would. */
function Harness({ initial = '', onValue, label = 'Amount', ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      label={label}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

function amountBox(name = 'Amount'): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(name);
}

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean);
}

describe('MoneyInput tracer (ORD-09)', () => {
  it('turns a pasted "12,450.5" into "12450.50" on blur, which converts to exactly 1245050 centavos', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Harness onValue={onValue} />);

    await user.click(amountBox());
    await user.paste('12,450.5');
    expect(amountBox().value).toBe('12450.5');

    await user.tab();
    expect(amountBox().value).toBe('12450.50');
    expect(onValue).toHaveBeenLastCalledWith('12450.50');
    expect(typeof onValue.mock.lastCall?.[0]).toBe('string');
    expect(moneyTextToCentavos(amountBox().value)).toBe(1245050);
  });
});

describe('MoneyInput markup (UI-SPEC MoneyInput, PERF-03)', () => {
  it('is a labelled text box with the ₱ prefix, the decimal keypad and no autocomplete', () => {
    const { container } = render(<Harness />);
    const input = amountBox();

    expect(input.type).toBe('text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocomplete', 'off');
    const prefix = container.querySelector('[aria-hidden="true"]');
    expect(prefix?.textContent).toBe(ENTRY_COPY.money.prefix);
    expect(ENTRY_COPY.money.prefix).toBe('₱');
  });

  it('renders the text at 16px with tabular figures (no iOS zoom on phones, PERF-03)', () => {
    render(<Harness />);
    expect(tokens(amountBox().className)).toEqual(expect.arrayContaining(['text-[16px]', 'tabular-nums']));
  });

  it('is left-aligned by default and right-aligned with align="right" (App. E.9 item rows)', () => {
    const { container, unmount } = render(<Harness />);
    expect(tokens(container.firstElementChild?.className)).not.toContain('[&_input]:text-right');
    unmount();

    const right = render(<Harness label="Unit price" align="right" className="mt-2" />);
    const wrapper = right.container.firstElementChild;
    expect(tokens(wrapper?.className)).toEqual(expect.arrayContaining(['[&_input]:text-right', 'mt-2']));
  });

  it('passes native attributes such as name and placeholder through to the box', () => {
    render(<Harness name="amount" placeholder="0.00" />);
    expect(amountBox()).toHaveAttribute('name', 'amount');
    expect(amountBox()).toHaveAttribute('placeholder', '0.00');
  });
});

describe('MoneyInput keystrokes (ORD-09 boundary edge)', () => {
  it('accepts the 9th integer digit and ignores a 10th', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '123456789');
    expect(amountBox().value).toBe('123456789');
    await user.type(amountBox(), '0');
    expect(amountBox().value).toBe('123456789');
  });

  it('accepts a 2nd decimal and ignores a 3rd', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '12.34');
    expect(amountBox().value).toBe('12.34');
    await user.type(amountBox(), '5');
    expect(amountBox().value).toBe('12.34');
  });

  it('rejects a minus sign (ASCII and U+2212), a second point, letters and grouping commas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '-5');
    expect(amountBox().value).toBe('5');
    await user.type(amountBox(), '−,e.0.');
    expect(amountBox().value).toBe('5.0');
  });

  it('ignores full-width and other-script digits (ASCII 0-9 only, A11Y-02 encoding edge)', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Harness onValue={onValue} />);
    await user.type(amountBox(), '１٣۵');
    expect(amountBox().value).toBe('');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('never adds grouping while editing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), '1245050');
    expect(amountBox().value).toBe('1245050');
  });
});

describe('MoneyInput paste', () => {
  it('strips grouping commas and spaces from a paste', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(amountBox());
    await user.paste(' 1 250.00 ');
    expect(amountBox().value).toBe('1250.00');
  });

  it.each([['-5'], ['₱100'], ['1.234'], ['abc'], ['1234567890']])('rejects a paste of %j', async (text) => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Harness initial="7" onValue={onValue} />);
    await user.click(amountBox());
    await user.paste(text);
    expect(amountBox().value).toBe('7');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('replaces the selected text with the pasted amount', async () => {
    const user = userEvent.setup();
    render(<Harness initial="100" />);
    await user.tripleClick(amountBox());
    await user.paste('2,000');
    expect(amountBox().value).toBe('2000');
  });

  it('inserts at the caret and rejects a paste that would break the pattern there', async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);
    const input = amountBox();
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.paste('0');
    expect(input.value).toBe('102');
    input.setSelectionRange(3, 3);
    await user.paste('.555');
    expect(input.value).toBe('102');
  });

  it('appends a paste when the browser reports no caret', async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);
    const input = amountBox();
    await user.click(input);
    Object.defineProperty(input, 'selectionStart', { configurable: true, get: () => null });
    Object.defineProperty(input, 'selectionEnd', { configurable: true, get: () => null });
    await user.paste('5');
    expect(input.value).toBe('125');
  });
});

describe('MoneyInput blur', () => {
  it.each([
    ['5000', '5000.00'],
    ['5.', '5.00'],
    ['.5', '0.50'],
    ['12.3', '12.30'],
  ])('pads %j to %j', async (typed, padded) => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(amountBox(), typed);
    await user.tab();
    expect(amountBox().value).toBe(padded);
  });

  it('keeps an empty box empty, clears a lone point, and leaves a padded value alone', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(value: string) => void>();
    render(<Harness onValue={onValue} />);
    await user.click(amountBox());
    await user.tab();
    expect(amountBox().value).toBe('');
    expect(onValue).not.toHaveBeenCalled();

    await user.type(amountBox(), '.');
    await user.tab();
    expect(amountBox().value).toBe('');

    await user.type(amountBox(), '7.25');
    onValue.mockClear();
    await user.tab();
    expect(amountBox().value).toBe('7.25');
    expect(onValue).not.toHaveBeenCalled();
  });

  it("calls the caller's onBlur after padding", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);
    await user.type(amountBox(), '9');
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('MoneyInput errors (UI-SPEC Copywriting)', () => {
  it('uses the Copywriting strings', () => {
    expect(ENTRY_COPY.money.required).toBe('Enter an amount.');
    expect(ENTRY_COPY.money.invalid).toBe('Enter an amount like 1250.50 (numbers only, up to 2 decimals).');
  });

  it.each([
    ['', true, ENTRY_COPY.money.required],
    ['.', true, ENTRY_COPY.money.required],
    ['', false, null],
    ['.', false, null],
    ['12.5', true, null],
    ['0.00', false, null],
    ['12,450', false, ENTRY_COPY.money.invalid],
    ['-5', true, ENTRY_COPY.money.invalid],
    ['1.234', false, ENTRY_COPY.money.invalid],
  ] as const)('moneyInputError(%j, required %s) is %j', (value, required, expected) => {
    expect(moneyInputError(value, { required })).toBe(expected);
  });

  it('is optional by default', () => {
    expect(moneyInputError('')).toBeNull();
  });

  it('shows an error under the box with aria-invalid and aria-describedby', () => {
    render(<Harness required error={ENTRY_COPY.money.required} />);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = document.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(message?.textContent).toBe(ENTRY_COPY.money.required);
  });
});

describe('MoneyInput accessibility and re-render', () => {
  it('has no axe violations with a hint, and with an error', async () => {
    const { container } = render(
      <div>
        <Harness hint="Balance due: ₱4,327.50" />
        <Harness label="Unit price" required error={ENTRY_COPY.money.invalid} align="right" />
      </div>,
    );
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<MoneyInput label="Amount" value="5" onChange={onChange} />);
    const first = container.innerHTML;
    rerender(<MoneyInput label="Amount" value="5" onChange={onChange} />);
    expect(container.innerHTML).toBe(first);
    rerender(<MoneyInput label="Unit price" value="9.50" onChange={onChange} align="right" />);
    expect(amountBox('Unit price').value).toBe('9.50');
  });
});

describe('money scenarios (the entry group)', () => {
  const money = entryScenarios.filter((scenario) => scenario.node.component === 'MoneyInput');

  it('declares the empty, filled, error and right-aligned cases, implementation only, both themes, every width', () => {
    expect(money.map((scenario) => scenario.id)).toEqual([
      'money-input-empty',
      'money-input-filled',
      'money-input-error',
      'money-input-right',
    ]);
    for (const scenario of money) {
      expect(scenario.group, scenario.id).toBe('entry');
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.responsive, scenario.id).toBe(true);
      expect(scenario.handlers, scenario.id).toEqual(['onChange']);
    }
    expect(money[2]?.node.props?.error).toBe(ENTRY_COPY.money.required);
  });

  it('renders every money scenario through the implementation kit with no axe violations', async () => {
    const { container } = render(
      <div>
        {money.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    expect(container.querySelectorAll('input[inputmode="decimal"]')).toHaveLength(4);
    expect(screen.queryByRole('alert')).toBeNull();
    await expectNoAxeViolations(container);
  });
});
