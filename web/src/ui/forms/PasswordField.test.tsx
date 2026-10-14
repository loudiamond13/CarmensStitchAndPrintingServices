import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as formScenarios } from '@/dev/scenarios/groups/forms';
import type { StrengthScore } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { PasswordField } from '@/ui/forms';
import {
  fieldClasses,
  fieldControlClasses,
  fieldInputClasses,
  labelClasses,
  messageClasses,
  strengthBarClasses,
  strengthBarsClasses,
  strengthClasses,
  strengthLabelClasses,
  suffixButtonClasses,
} from './field.recipe';

// The converted App. D.3 PasswordField, the WEB-06 "PasswordInput" (plan 02-20, CSPS-UI-SPEC.md §6.3, UI-SPEC
// Copywriting Contract): the reveal toggle, the strength meter and its empty hint, and the hint and error wiring. The
// behaviour cases follow the characterization tests at 74621f5 (web/src/ui/PasswordField.test.tsx, D-37), reading the
// meter by role and recipe instead of the old class names. The look is proven by the parity suite (`--grep @forms`).

const EMPTY_HINT = 'Use 8+ characters with a number and a symbol';

// App. B `.csp-suffix-btn`, `.csp-strength`, `.csp-strength-bars` and their score tones.
const SUFFIX_BUTTON =
  'absolute right-1 grid size-9 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ink-muted hover:bg-surface-3 hover:text-ink';
const STRENGTH = 'flex items-center gap-3';
const STRENGTH_BARS = 'grid max-w-[180px] flex-1 grid-cols-[repeat(4,1fr)] gap-1';
const BAR_TONE = ['bg-line', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'] as const;
const LABEL_TONE = ['text-ink-muted', 'text-danger', 'text-warning', 'text-info', 'text-success'] as const;

function tokens(...classLists: string[]): string[] {
  return classLists.join(' ').split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function passwordBox(name = 'Password'): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(name);
}

/** The meter: the polite live region after the control box. */
function meter(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[aria-live="polite"]');
}

function meterLabel(container: HTMLElement): string | null | undefined {
  return meter(container)?.lastElementChild?.textContent;
}

/** How many of the four bars are lit (they carry a score tone instead of --line). */
function litBars(container: HTMLElement): number {
  const bars = [...(meter(container)?.firstElementChild?.children ?? [])];
  return bars.filter((bar) => !bar.classList.contains('bg-line')).length;
}

describe('PasswordField reveal toggle (WEB-06, T-02-50)', () => {
  it('starts hidden, then switches between Show password and Hide password with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<PasswordField defaultValue="Abcdefg1!" />);
    expect(passwordBox()).toHaveAttribute('type', 'password');
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show).toHaveAttribute('aria-pressed', 'false');
    expect(show).toHaveAttribute('type', 'button');

    await user.click(show);
    expect(passwordBox()).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');

    await user.click(hide);
    expect(passwordBox()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('shows the 18px eye icon while hidden and eye-off while shown, hidden from assistive technology', async () => {
    const user = userEvent.setup();
    render(<PasswordField />);
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.querySelector('svg')).toHaveClass('lucide-eye');
    expect(toggle.querySelector('svg')).toHaveAttribute('width', '18');
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    await user.click(toggle);
    expect(toggle.querySelector('svg')).toHaveClass('lucide-eye-off');
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

  it('follows a controlled value', () => {
    const { rerender } = render(<PasswordField value="first" onChange={vi.fn()} />);
    expect(passwordBox()).toHaveValue('first');

    rerender(<PasswordField value="second" onChange={vi.fn()} />);
    expect(passwordBox()).toHaveValue('second');
  });

  it('passes autocomplete and the other native box attributes through', () => {
    render(<PasswordField autoComplete="new-password" name="password" required minLength={8} />);

    expect(passwordBox()).toHaveAttribute('autocomplete', 'new-password');
    expect(passwordBox()).toHaveAttribute('name', 'password');
    expect(passwordBox()).toBeRequired();
    expect(passwordBox()).toHaveAttribute('minlength', '8');
  });
});

describe('PasswordField strength (WEB-06)', () => {
  it('shows the empty hint before anything is typed, with no lit bar (UI consideration: empty, forms)', async () => {
    const { container } = render(<PasswordField showStrength />);

    expect(meterLabel(container)).toBe(EMPTY_HINT);
    expect(litBars(container)).toBe(0);
    expect(passwordBox()).not.toHaveAttribute('aria-invalid');
    await expectNoAxeViolations(container);
  });

  it.each([
    ['abc', 'Weak', 1],
    ['abcdefgh1', 'Fair', 2],
    ['Abcdefgh1', 'Good', 3],
    ['Abcdefgh1!xyz', 'Strong', 4],
  ] as const)('rates %j as %s, lighting %i bars in its tone', async (password, label, score) => {
    const user = userEvent.setup();
    const { container } = render(<PasswordField showStrength />);
    await user.type(passwordBox(), password);

    expect(meterLabel(container)).toBe(label);
    expect(litBars(container)).toBe(score);
    expect(classTokens(meter(container)?.lastElementChild)).toEqual(tokens(strengthLabelClasses(score)));
    const bars = [...(meter(container)?.firstElementChild?.children ?? [])];
    expect(bars.map((bar) => classTokens(bar))).toEqual(
      [1, 2, 3, 4].map((index) => tokens(strengthBarClasses(score, index <= score))),
    );
  });

  it('shows no meter unless asked', () => {
    const { container } = render(<PasswordField defaultValue="abc" />);

    expect(meter(container)).toBeNull();
  });

  it('hides the bars from assistive technology and announces the label politely', () => {
    const { container } = render(<PasswordField showStrength defaultValue="abc" />);

    expect(meter(container)?.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(meter(container)?.firstElementChild?.children).toHaveLength(4);
  });
});

describe('PasswordField looks (App. B, D-02 FYI-01)', () => {
  it('gives each part the shared field recipe, the suffix padding and the meter looks', () => {
    const { container } = render(<PasswordField showStrength />);
    const input = passwordBox();
    const toggle = screen.getByRole('button', { name: 'Show password' });

    expect(classTokens(container.firstElementChild)).toEqual(tokens(fieldClasses));
    expect(classTokens(container.querySelector('label'))).toEqual(tokens(labelClasses));
    expect(classTokens(input.parentElement)).toEqual(tokens(fieldControlClasses));
    expect(classTokens(input)).toEqual(tokens(fieldInputClasses({ suffix: true })));
    expect(classTokens(input)).toContain('pr-12');
    expect(classTokens(toggle)).toEqual(tokens(SUFFIX_BUTTON));
    expect(classTokens(meter(container))).toEqual(tokens(STRENGTH));
    expect(classTokens(meter(container)?.firstElementChild)).toEqual(tokens(STRENGTH_BARS));
  });

  it('pins the recipe maps: the four bar tones and five label tones, keyed by score', () => {
    expect(tokens(suffixButtonClasses)).toEqual(tokens(SUFFIX_BUTTON));
    expect(tokens(strengthClasses)).toEqual(tokens(STRENGTH));
    expect(tokens(strengthBarsClasses)).toEqual(tokens(STRENGTH_BARS));
    for (const score of [0, 1, 2, 3, 4] as const satisfies readonly StrengthScore[]) {
      expect(tokens(strengthBarClasses(score, true)), String(score)).toEqual(
        tokens('h-1 rounded-[2px]', BAR_TONE[score]),
      );
      expect(tokens(strengthBarClasses(score, false)), String(score)).toEqual(tokens('h-1 rounded-[2px] bg-line'));
      expect(tokens(strengthLabelClasses(score)), String(score)).toEqual(
        tokens('text-[12px] leading-4 font-semibold', LABEL_TONE[score]),
      );
    }
  });

  it('renders the placeholder in --ink-muted at full opacity (D-02 FYI-01)', () => {
    render(<PasswordField placeholder="Your password" />);
    const classes = classTokens(passwordBox());

    expect(classes).toContain('placeholder:text-ink-muted');
    expect(classes.filter((token) => token.startsWith('placeholder:opacity'))).toEqual([]);
  });
});

describe('PasswordField label, hint and error (A11Y-01)', () => {
  it('labels the box "Password" by default, or with the caller label', () => {
    const { rerender } = render(<PasswordField />);
    expect(passwordBox().tagName).toBe('INPUT');

    rerender(<PasswordField label="New password" />);
    expect(passwordBox('New password')).toBeInTheDocument();
  });

  it('describes the box with the hint, then with the caller error, and passes axe in both states', async () => {
    const { container, rerender } = render(<PasswordField hint="At least 8 characters." showStrength />);
    const hint = container.querySelector('p');
    expect(hint?.textContent).toBe('At least 8 characters.');
    expect(classTokens(hint)).toEqual(tokens(messageClasses({ error: false })));
    expect(passwordBox()).toHaveAttribute('aria-describedby', hint?.id ?? 'missing');
    expect(passwordBox()).toHaveAccessibleDescription('At least 8 characters.');
    await expectNoAxeViolations(container);

    rerender(<PasswordField hint="At least 8 characters." showStrength error="Enter your password." />);
    const message = container.querySelector('p');
    expect(message?.textContent).toBe('Enter your password.');
    expect(classTokens(message)).toEqual(tokens(messageClasses({ error: true })));
    expect(message?.querySelector('svg')).toHaveClass('lucide-triangle-alert');
    expect(message?.querySelector('svg')).toHaveAttribute('width', '14');
    expect(passwordBox()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordBox()).toHaveAttribute('aria-describedby', message?.id ?? 'missing');
    await expectNoAxeViolations(container);
  });

  it('has no message, aria-invalid or aria-describedby without a hint or an error', () => {
    const { container } = render(<PasswordField />);

    expect(container.querySelector('p')).toBeNull();
    expect(passwordBox()).not.toHaveAttribute('aria-invalid');
    expect(passwordBox()).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the label on the box when the caller sets an id, and puts className on the field as layout glue', () => {
    const { container } = render(<PasswordField id="new-password" className="col-span-2" />);

    expect(passwordBox().id).toBe('new-password');
    expect(container.querySelector('p')).toBeNull();
    expect(classTokens(container.firstElementChild)).toEqual(tokens(fieldClasses, 'col-span-2'));
    expect(classTokens(passwordBox())).not.toContain('col-span-2');
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<PasswordField showStrength defaultValue="abc" />);
    const first = container.innerHTML;

    rerender(<PasswordField showStrength defaultValue="abc" />);
    expect(container.innerHTML).toBe(first);

    rerender(<PasswordField label="New password" error="Too short." />);
    expect(passwordBox('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(meter(container)).toBeNull();
  });
});

describe('password scenarios (the forms parity group)', () => {
  const passwordScenarios = formScenarios.filter((scenario) => scenario.id.startsWith('password-'));

  it('declares the empty, four strength, revealed and error cases in both themes', () => {
    expect(passwordScenarios.map((scenario) => scenario.id)).toEqual([
      'password-empty',
      'password-strength-weak',
      'password-strength-fair',
      'password-strength-good',
      'password-strength-strong',
      'password-visible',
      'password-error',
    ]);
    for (const scenario of passwordScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.states, scenario.id).toEqual(
        scenario.id.startsWith('password-strength-') ? ['rest'] : ['rest', 'hover', 'focus-visible'],
      );
    }
  });

  it('renders every password scenario through the implementation kit with the expected meter and reveal state', async () => {
    const { container } = render(
      <div>
        {passwordScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    const frame = (id: string): HTMLElement => {
      const element = container.querySelector<HTMLElement>(`[data-case="${id}"]`);
      if (element === null) {
        throw new Error(`Missing case ${id}`);
      }
      return element;
    };

    for (const scenario of passwordScenarios) {
      expect(frame(scenario.id).querySelectorAll(scenario.target ?? ''), scenario.id).toHaveLength(1);
    }
    expect(meterLabel(frame('password-empty'))).toBe(EMPTY_HINT);
    expect(meterLabel(frame('password-strength-weak'))).toBe('Weak');
    expect(meterLabel(frame('password-strength-fair'))).toBe('Fair');
    expect(meterLabel(frame('password-strength-good'))).toBe('Good');
    expect(meterLabel(frame('password-strength-strong'))).toBe('Strong');
    expect(await screen.findByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    expect(frame('password-visible').querySelector('input')).toHaveAttribute('type', 'text');
    expect(frame('password-error').querySelector('input')).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations(container);
  });
});
