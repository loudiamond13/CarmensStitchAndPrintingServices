import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as entryScenarios } from '@/dev/scenarios/groups/entry';
import { expectNoAxeViolations } from '@/test/axe';
import { buttonClasses } from '@/components/actions';
import { Checkbox, ENTRY_COPY, SkipLink } from '@/components/entry';
import { messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';

// Checkbox and SkipLink (SPEC-GAP, plan 02-27; UI-SPEC "SPEC-GAP Primitive Specs", "Color" → D-03 checkbox row).
// user-event on real timers (L-24).

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

// App. C `.s-check` (flex, centred, gap 8, 14px --ink-muted, pointer).
const CHECK_LABEL = 'flex cursor-pointer items-center gap-2 text-[14px] text-ink-muted';
// The 20×20 box cell: the input and its tick share one grid cell.
const CHECK_BOX = 'grid flex-none';
// D-03: appearance none, 20×20, 2px --ink border, --radius-xs, --surface-2 fill, pointer; checked --accent fill; the
// 2px focus-visible ring with its 2px offset.
const CHECK_INPUT =
  'peer col-start-1 row-start-1 m-0 size-5 cursor-pointer appearance-none rounded-xs border-2 border-ink bg-surface-2 checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
// D-03 tick (geometry from 74621f5, D-37): a 10×5px box with 2px bottom and left borders in --on-accent, 3px up,
// rotated -45deg, centred in the cell, shown only while the box is checked.
const CHECK_TICK =
  'pointer-events-none col-start-1 row-start-1 hidden h-[5px] w-[10px] -mt-[3px] -rotate-45 place-self-center border-b-2 border-l-2 border-on-accent peer-checked:block';

function Controlled({ onValue }: { onValue: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="Keep me signed in"
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onValue(next);
      }}
    />
  );
}

describe('Checkbox (UI-SPEC Checkbox, D-03)', () => {
  it('is a native checkbox named by the label text it sits in', () => {
    const { container } = render(<Checkbox label="Keep me signed in" />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });
    expect(box.closest('label')).toBe(container.querySelector('label'));
    expect(box).not.toBeChecked();
  });

  it('toggles from a click on the label text and from Space, and reports the new state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(checked: boolean) => void>();
    render(<Checkbox label="Keep me signed in" onChange={onChange} />);
    await user.click(screen.getByText('Keep me signed in'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('follows a controlled checked state', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn<(checked: boolean) => void>();
    render(<Controlled onValue={onValue} />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onValue).toHaveBeenCalledWith(true);
  });

  it('starts ticked with defaultChecked and passes name, value, required, disabled and id through', () => {
    render(<Checkbox label="Remember" defaultChecked name="remember" value="yes" required disabled id="remember" />);
    const box = screen.getByRole('checkbox', { name: /Remember/ });
    expect(box).toBeChecked();
    expect(box).toHaveAttribute('name', 'remember');
    expect(box).toHaveAttribute('value', 'yes');
    expect(box).toBeRequired();
    expect(box).toBeDisabled();
    expect(box.id).toBe('remember');
  });

  it('draws the D-03 look with an aria-hidden tick that only shows when checked', () => {
    const { container } = render(<Checkbox label="Keep me signed in" className="mt-4" />);
    const label = container.querySelector('label');
    const input = screen.getByRole('checkbox');
    const cell = input.parentElement;
    const tick = input.nextElementSibling;

    expect(tokens(label?.className)).toEqual(tokens(`${CHECK_LABEL} mt-4`));
    expect(tokens(cell?.className)).toEqual(tokens(CHECK_BOX));
    expect(tokens(input.className)).toEqual(tokens(CHECK_INPUT));
    expect(tokens(tick?.className)).toEqual(tokens(CHECK_TICK));
    expect(tick).toHaveAttribute('aria-hidden', 'true');
    expect(tick?.textContent).toBe('');
  });

  it('marks a required box with an aria-hidden " *" after the label text', () => {
    const { container } = render(<Checkbox label="I agree" required />);
    expect(container.querySelector('label > [aria-hidden="true"]:last-child')?.textContent).toBe(' *');
    expect(screen.getByRole('checkbox', { name: /I agree/ })).toBeInTheDocument();
  });

  it('links a hint, or an error with aria-invalid, after the label', () => {
    const { rerender } = render(<Checkbox label="Send updates" hint="About your orders only." />);
    const box = screen.getByRole('checkbox');
    const hint = screen.getByText('About your orders only.');
    expect(box).toHaveAttribute('aria-describedby', hint.id);
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(tokens(hint.className)).toEqual(tokens(messageClasses({ error: false })));

    rerender(<Checkbox label="Send updates" hint="About your orders only." error="Tick the box to continue." />);
    const error = screen.getByText('Tick the box to continue.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAttribute('aria-describedby', error.id);
    expect(tokens(error.className)).toEqual(tokens(messageClasses({ error: true })));
    expect(screen.queryByText('About your orders only.')).toBeNull();
  });

  it('has no message and no aria-describedby with neither hint nor error', () => {
    const { container } = render(<Checkbox label="Keep me signed in" />);
    expect(container.querySelector('p')).toBeNull();
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-describedby');
  });

  it('has no axe violations unticked, ticked and with an error', async () => {
    const { container } = render(
      <div>
        <Checkbox label="Keep me signed in" />
        <Checkbox label="Send updates" defaultChecked hint="About your orders only." />
        <Checkbox label="I agree" required error="Tick the box to continue." />
      </div>,
    );
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Checkbox label="Keep me signed in" />);
    const first = container.innerHTML;
    rerender(<Checkbox label="Keep me signed in" />);
    expect(container.innerHTML).toBe(first);
    rerender(<Checkbox label="Stay signed in" hint="On this device." />);
    expect(screen.getByRole('checkbox', { name: 'Stay signed in' })).toBeInTheDocument();
  });
});

describe('SkipLink (UI-SPEC SkipLink, A11Y-02)', () => {
  function Page() {
    return (
      <div>
        <SkipLink />
        <nav aria-label="Site">
          <a href="/products">Products</a>
        </nav>
        <main id="main" tabIndex={-1}>
          <h1>Home</h1>
        </main>
      </div>
    );
  }

  it('says "Skip to main content" and points at #main', () => {
    render(<SkipLink />);
    expect(ENTRY_COPY.skipLink.label).toBe('Skip to main content');
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main');
  });

  it('is the first Tab stop, and activating it focuses #main without adding #main to the URL', async () => {
    const user = userEvent.setup();
    const before = window.location.href;
    render(<Page />);
    await user.tab();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('');
    expect(window.location.href).toBe(before);
  });

  it('focuses #main on a click too, and a custom target by id', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SkipLink targetId="content" />
        <section id="content" tabIndex={-1} aria-label="Content" />
      </div>,
    );
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#content');
    await user.click(link);
    expect(screen.getByRole('region', { name: 'Content' })).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('does nothing when the target is missing', async () => {
    const user = userEvent.setup();
    render(<SkipLink />);
    const link = screen.getByRole('link');
    await user.click(link);
    expect(window.location.hash).toBe('');
  });

  it('has the primary md button look, visually hidden until keyboard focus, then fixed top-left above everything', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link');
    const classes = tokens(link.className);
    expect(classes).toEqual(expect.arrayContaining(tokens(buttonClasses({ variant: 'primary', size: 'md' }))));
    const hidden = tokens(srOnlyClasses).map((token) => `not-focus-visible:${token}`);
    expect(classes).toEqual(expect.arrayContaining(hidden));
    // The button padding and border go while hidden, so the box really is 1px (the .csp-sr look).
    expect(classes).toEqual(expect.arrayContaining(['not-focus-visible:p-0', 'not-focus-visible:border-0']));
    expect(classes).toEqual(
      expect.arrayContaining([
        'focus-visible:fixed',
        'focus-visible:top-2',
        'focus-visible:left-2',
        'focus-visible:z-(--z-toast)',
      ]),
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<Page />);
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<SkipLink />);
    const first = container.innerHTML;
    rerender(<SkipLink />);
    expect(container.innerHTML).toBe(first);
    rerender(<SkipLink targetId="content" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#content');
  });
});

describe('checkbox and skip-link scenarios (the entry group)', () => {
  const ids = ['checkbox-unchecked', 'checkbox-checked', 'skip-link-focused'];
  const cases = entryScenarios.filter((scenario) => ids.includes(scenario.id));

  it('declares them implementation only, at rest and with keyboard focus, in both themes', () => {
    expect(cases.map((scenario) => scenario.id)).toEqual(ids);
    for (const scenario of cases) {
      expect(scenario.group, scenario.id).toBe('entry');
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.states, scenario.id).toEqual(['rest', 'focus-visible']);
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
    }
  });

  it('every entry scenario id is unique and the group holds the plan list', () => {
    expect(entryScenarios.map((scenario) => scenario.id)).toEqual([
      'money-input-empty',
      'money-input-filled',
      'money-input-error',
      'money-input-right',
      'otp-empty',
      'otp-error',
      'checkbox-unchecked',
      'checkbox-checked',
      'skip-link-focused',
    ]);
  });

  it('renders them through the implementation kit: the ticked box checked, the skip link focused, no axe violations', async () => {
    const { container } = render(
      <div>
        {cases.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );
    const boxes = screen.getAllByRole<HTMLInputElement>('checkbox');
    expect(boxes.map((box) => box.checked)).toEqual([false, true]);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    expect(container.querySelector('main#main')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await expectNoAxeViolations(container);
  });
});
