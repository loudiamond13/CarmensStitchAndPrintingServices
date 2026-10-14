import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as choiceScenarios } from '@/dev/scenarios/groups/choice';
import { expectNoAxeViolations } from '@/test/axe';
import { SegmentedControl, type SegmentOption } from '@/components/choice';
import { segmentClasses, segmentedClasses } from './choice.recipe';

// The converted App. D.3 SegmentedControl (plan 02-19, CSPS-UI-SPEC.md §6.3, UI-SPEC Interaction Contract): a
// radiogroup of radio buttons with a roving tabIndex; arrow keys move and select. The look is proven by the parity
// suite (`--grep @choice`); these tests pin the markup, the keyboard behaviour and the segmented scenarios.

type Discount = 'fixed' | 'percentage';
type Range = '6m' | '12m' | 'all';

const DISCOUNT: readonly SegmentOption<Discount>[] = [
  { value: 'fixed', label: 'Fixed ₱' },
  { value: 'percentage', label: 'Percent %' },
];
const RANGES: readonly SegmentOption<Range>[] = [
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'all', label: 'All' },
];
const VIEWS: readonly SegmentOption[] = [
  { value: 'grid', label: 'Grid view', icon: 'layout-grid' },
  { value: 'table', label: 'Table view', icon: 'list' },
];

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function radios(): HTMLElement[] {
  return screen.getAllByRole('radio');
}

function checkedStates(): string[] {
  return radios().map((radio) => radio.getAttribute('aria-checked') ?? '');
}

function tabIndexes(): number[] {
  return radios().map((radio) => radio.tabIndex);
}

describe('SegmentedControl markup (App. D.3)', () => {
  it('renders a named radiogroup of type="button" radios, the first one checked by default', () => {
    render(<SegmentedControl label="Discount type" options={DISCOUNT} />);
    const group = screen.getByRole('radiogroup', { name: 'Discount type' });

    expect(group.localName).toBe('div');
    expect(radios().map((radio) => radio.localName)).toEqual(['button', 'button']);
    expect(radios().map((radio) => radio.getAttribute('type'))).toEqual(['button', 'button']);
    expect(radios().map((radio) => radio.textContent)).toEqual(['Fixed ₱', 'Percent %']);
    expect(checkedStates()).toEqual(['true', 'false']);
    expect(screen.getByRole('radio', { name: 'Fixed ₱' }).firstElementChild?.localName).toBe('span');
  });

  it('gives the track and every segment the recipe look; the checked state comes from aria-checked', () => {
    render(<SegmentedControl label="Discount type" options={DISCOUNT} />);

    expect(classTokens(screen.getByRole('radiogroup'))).toEqual(tokens(segmentedClasses));
    for (const radio of radios()) {
      expect(classTokens(radio)).toEqual(tokens(segmentClasses));
    }
    expect(segmentClasses).toContain('aria-checked:bg-surface-3');
  });

  it('names an icon-only option with aria-label and title and shows only its 18px icon', () => {
    render(<SegmentedControl label="View" options={VIEWS} />);
    const grid = screen.getByRole('radio', { name: 'Grid view' });

    expect(grid).toHaveAttribute('aria-label', 'Grid view');
    expect(grid).toHaveAttribute('title', 'Grid view');
    expect(grid.children).toHaveLength(1);
    expect(grid.firstElementChild?.localName).toBe('svg');
    expect(grid.firstElementChild).toHaveAttribute('width', '18');
    expect(grid.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(grid.textContent).toBe('');
  });

  it('shows the icon and the label when showLabel is set, with no aria-label (the text names it)', () => {
    render(
      <SegmentedControl
        label="Role"
        options={[
          { value: 'admin', label: 'Admin', icon: 'user-round', showLabel: true },
          { value: 'manager', label: 'Manager', icon: 'shield-check', showLabel: true },
        ]}
      />,
    );
    const admin = screen.getByRole('radio', { name: 'Admin' });

    expect(admin).not.toHaveAttribute('aria-label');
    expect(admin).toHaveAttribute('title', 'Admin');
    expect([...admin.children].map((child) => child.localName)).toEqual(['svg', 'span']);
  });

  it('has no axe violations with text, icon-only and icon plus label options', async () => {
    const { container } = render(
      <div>
        <SegmentedControl label="Discount type" options={DISCOUNT} />
        <SegmentedControl label="View" options={VIEWS} />
        <SegmentedControl
          label="Role"
          value="manager"
          options={[
            { value: 'admin', label: 'Admin', icon: 'user-round', showLabel: true },
            { value: 'manager', label: 'Manager', icon: 'shield-check', showLabel: true },
          ]}
        />
      </div>,
    );

    await expectNoAxeViolations(container);
  });
});

describe('SegmentedControl selection and keyboard (UI-SPEC Interaction Contract)', () => {
  it('keeps only the checked radio in the Tab order (roving tabIndex)', () => {
    render(<SegmentedControl label="Range" options={RANGES} value="12m" />);

    expect(checkedStates()).toEqual(['false', 'true', 'false']);
    expect(tabIndexes()).toEqual([-1, 0, -1]);
  });

  it('selects a clicked option and reports it once', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Range" options={RANGES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: '12M' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('12m');
    expect(checkedStates()).toEqual(['false', 'true', 'false']);
    expect(tabIndexes()).toEqual([-1, 0, -1]);
  });

  it('moves the selection and the focus with the right and down arrows, wrapping at the end', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Range" options={RANGES} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: '6M' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(checkedStates()).toEqual(['false', 'true', 'false']);
    expect(screen.getByRole('radio', { name: '12M' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(checkedStates()).toEqual(['true', 'false', 'false']);
    expect(screen.getByRole('radio', { name: '6M' })).toHaveFocus();
    expect(tabIndexes()).toEqual([0, -1, -1]);
    expect(onChange.mock.calls).toEqual([['12m'], ['all'], ['6m']]);
  });

  it('moves the selection and the focus with the left and up arrows, wrapping at the start', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Range" options={RANGES} onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(checkedStates()).toEqual(['false', 'false', 'true']);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: '12M' })).toHaveFocus();
    expect(onChange.mock.calls).toEqual([['all'], ['12m']]);
  });

  it('ignores other keys and lets the browser handle them', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Range" options={RANGES} onChange={onChange} />);
    const first = screen.getByRole('radio', { name: '6M' });

    const notHandled = fireEvent.keyDown(first, { key: 'Home' });
    fireEvent.keyDown(first, { key: 'a' });

    expect(notHandled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(checkedStates()).toEqual(['true', 'false', 'false']);
  });

  it('stops the page from scrolling on a handled arrow key', () => {
    render(<SegmentedControl label="Range" options={RANGES} />);

    const notCancelled = fireEvent.keyDown(screen.getByRole('radio', { name: '6M' }), { key: 'ArrowDown' });

    expect(notCancelled).toBe(false);
  });

  it('follows a controlled value', () => {
    const { rerender } = render(<SegmentedControl label="Range" options={RANGES} value="6m" />);
    expect(checkedStates()).toEqual(['true', 'false', 'false']);

    rerender(<SegmentedControl label="Range" options={RANGES} value="all" />);
    expect(checkedStates()).toEqual(['false', 'false', 'true']);
    expect(tabIndexes()).toEqual([-1, -1, 0]);
  });

  it('keeps the first radio in the Tab order when the value matches no option', () => {
    const unknown = 'quarter' as Range;
    render(<SegmentedControl label="Range" options={RANGES} value={unknown} />);

    expect(checkedStates()).toEqual(['false', 'false', 'false']);
    expect(tabIndexes()).toEqual([0, -1, -1]);
  });

  it('renders an empty group for no options', () => {
    render(<SegmentedControl label="Range" options={[]} />);

    expect(screen.getByRole('radiogroup', { name: 'Range' }).children).toHaveLength(0);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<SegmentedControl label="Range" options={RANGES} />);
    const first = container.innerHTML;

    rerender(<SegmentedControl label="Range" options={RANGES} />);
    expect(container.innerHTML).toBe(first);

    rerender(<SegmentedControl label="View" options={VIEWS} />);
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    expect(radios()).toHaveLength(2);
  });
});

describe('segmented scenarios (the choice parity group)', () => {
  const segmentedScenarios = choiceScenarios.filter((scenario) => scenario.node.component === 'SegmentedControl');

  it('declares text, icon-only and icon plus label cases in both themes', () => {
    expect(segmentedScenarios.map((scenario) => scenario.id)).toEqual([
      'segmented-text',
      'segmented-icons',
      'segmented-icon-labels',
    ]);
    for (const scenario of segmentedScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.handlers, scenario.id).toEqual(['onChange']);
    }
  });

  it('drives focus-visible only on the checked radio, the one Tab reaches, and hover on an unchecked one too', () => {
    const byId = new Map(segmentedScenarios.map((scenario) => [scenario.id, scenario]));

    expect(byId.get('segmented-text')?.states).toEqual(['rest', 'hover', 'focus-visible']);
    expect(byId.get('segmented-text')?.target).toBe('[role="radio"][aria-checked="true"]');
    expect(byId.get('segmented-icons')?.states).toEqual(['rest', 'hover', 'focus-visible']);
    expect(byId.get('segmented-icons')?.target).toBe('[role="radio"][aria-checked="true"]');
    expect(byId.get('segmented-icon-labels')?.states).toEqual(['rest', 'hover']);
    expect(byId.get('segmented-icon-labels')?.target).toBe('[role="radio"][aria-checked="false"]');
  });

  it('renders every segmented scenario through the implementation kit, its target present, with no axe violations', async () => {
    const { container } = render(
      <div>
        {segmentedScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of segmentedScenarios) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      expect(frame?.querySelectorAll('[role="radiogroup"]'), scenario.id).toHaveLength(1);
      expect(frame?.querySelectorAll(scenario.target ?? ''), scenario.id).toHaveLength(1);
    }
    await expectNoAxeViolations(container);
  });
});
