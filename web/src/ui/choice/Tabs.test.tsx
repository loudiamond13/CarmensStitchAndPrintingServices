import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as choiceScenarios } from '@/dev/scenarios/groups/choice';
import { expectNoAxeViolations } from '@/test/axe';
import { getTabPanelProps, Tabs, type TabItem } from '@/ui/choice';
import { tabClasses, tabCountClasses, tabListClasses } from './choice.recipe';
import { rovingItem } from './roving';

// The converted App. D.3 Tabs (plan 02-19, CSPS-UI-SPEC.md §6.3, UI-SPEC Interaction Contract): the WAI-ARIA tabs
// pattern on App. D.3's elements (no element added), the D-03 weight cue and the hidden-scrollbar overflow. The look is
// proven by the parity suite (`--grep @choice`); these tests pin the ARIA, the keyboard and the tabs scenarios.

type OrderTab = 'items' | 'payments' | 'discounts' | 'expenses';

const ORDER_TABS: readonly TabItem<OrderTab>[] = [
  { id: 'items', label: 'Items', count: 3 },
  { id: 'payments', label: 'Payments', count: 2 },
  { id: 'discounts', label: 'Discounts', count: 1 },
  { id: 'expenses', label: 'Expenses', count: 0 },
];

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function tabs(): HTMLElement[] {
  return screen.getAllByRole('tab');
}

function selectedStates(): string[] {
  return tabs().map((tab) => tab.getAttribute('aria-selected') ?? '');
}

function tabIndexes(): number[] {
  return tabs().map((tab) => tab.tabIndex);
}

function tab(name: string): HTMLElement {
  return screen.getByRole('tab', { name: new RegExp(`^${name}`) });
}

describe('Tabs markup and ARIA (App. D.3, WEB-02)', () => {
  it('renders a tablist of type="button" tabs, each its label then its count chip, the first selected by default', () => {
    render(<Tabs idBase="order" items={ORDER_TABS} />);
    const list = screen.getByRole('tablist');

    expect(list.localName).toBe('div');
    expect(list.children).toHaveLength(4);
    expect(tabs().map((item) => item.localName)).toEqual(['button', 'button', 'button', 'button']);
    expect(tabs().map((item) => item.getAttribute('type'))).toEqual(['button', 'button', 'button', 'button']);
    expect(tabs().map((item) => item.textContent)).toEqual(['Items3', 'Payments2', 'Discounts1', 'Expenses0']);
    expect(selectedStates()).toEqual(['true', 'false', 'false', 'false']);
    for (const item of tabs()) {
      expect(item.childNodes).toHaveLength(2);
      expect(item.lastElementChild?.localName).toBe('span');
    }
  });

  it('shows a count chip for a zero count and none for a tab without a count', () => {
    render(
      <Tabs
        idBase="order"
        items={[
          { id: 'expenses', label: 'Expenses', count: 0 },
          { id: 'history', label: 'History' },
        ]}
      />,
    );

    expect(tab('Expenses').lastElementChild?.textContent).toBe('0');
    expect(tab('History').children).toHaveLength(0);
    expect(tab('History').textContent).toBe('History');
  });

  it('ties each tab to its panel: tab id, aria-controls and getTabPanelProps agree', () => {
    render(<Tabs idBase="order" items={ORDER_TABS} />);

    for (const item of ORDER_TABS) {
      const element = tab(item.label);
      const panel = getTabPanelProps('order', item.id);
      expect(element.id, item.id).toBe(`order-tab-${item.id}`);
      expect(element).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toEqual({ id: `order-panel-${item.id}`, role: 'tabpanel', 'aria-labelledby': element.id });
    }
  });

  it('keeps only the selected tab in the Tab order (roving tabIndex)', () => {
    render(<Tabs idBase="order" items={ORDER_TABS} value="discounts" />);

    expect(selectedStates()).toEqual(['false', 'false', 'true', 'false']);
    expect(tabIndexes()).toEqual([-1, -1, 0, -1]);
  });

  it('keeps the first tab in the Tab order when the value matches no tab', () => {
    const unknown = 'images' as OrderTab;
    render(<Tabs idBase="order" items={ORDER_TABS} value={unknown} />);

    expect(selectedStates()).toEqual(['false', 'false', 'false', 'false']);
    expect(tabIndexes()).toEqual([0, -1, -1, -1]);
  });

  it('has no axe violations with the selected tab panel rendered from getTabPanelProps', async () => {
    const { container } = render(
      <div>
        <Tabs idBase="order" items={ORDER_TABS} value="payments" />
        <div {...getTabPanelProps('order', 'payments')}>Two payments.</div>
      </div>,
    );

    expect(screen.getByRole('tabpanel', { name: /^Payments/ })).toHaveTextContent('Two payments.');
    await expectNoAxeViolations(container);
  });

  it('renders an empty tablist for no items', () => {
    render(<Tabs idBase="order" items={[]} />);

    expect(screen.getByRole('tablist').children).toHaveLength(0);
  });
});

describe('Tabs look (App. B .csp-tab*, D-03, overflow)', () => {
  it('gives the strip, the tabs and the count chips the recipe look', () => {
    render(<Tabs idBase="order" items={ORDER_TABS} />);

    expect(classTokens(screen.getByRole('tablist'))).toEqual(tokens(tabListClasses));
    for (const item of tabs()) {
      expect(classTokens(item)).toEqual(tokens(tabClasses));
      expect(classTokens(item.lastElementChild)).toEqual(tokens(tabCountClasses));
    }
  });

  it('marks the selected tab by weight 700 and ink, not by the orange underline alone (D-03)', () => {
    const list = tokens(tabClasses);

    expect(list).toEqual(
      expect.arrayContaining(['font-semibold', 'aria-selected:font-bold', 'text-ink-muted', 'aria-selected:text-ink']),
    );
    expect(list).toEqual(
      expect.arrayContaining([
        'aria-selected:after:absolute',
        'aria-selected:after:left-3',
        'aria-selected:after:right-3',
        'aria-selected:after:-bottom-px',
        'aria-selected:after:h-[3px]',
        'aria-selected:after:bg-accent-line',
      ]),
    );
    expect(list).toContain('group/tab');
    expect(tokens(tabCountClasses)).toEqual(
      expect.arrayContaining(['group-aria-selected/tab:bg-accent-soft', 'group-aria-selected/tab:text-accent-ink']),
    );
  });

  it('scrolls the strip sideways with the scrollbar hidden instead of widening the page', () => {
    expect(tokens(tabListClasses)).toEqual(expect.arrayContaining(['overflow-x-auto', '[scrollbar-width:none]']));
    expect(tokens(tabClasses)).toContain('whitespace-nowrap');
  });
});

describe('Tabs selection and keyboard (UI-SPEC Interaction Contract, A11Y-02)', () => {
  it('selects a clicked tab and reports it once', async () => {
    const onChange = vi.fn();
    render(<Tabs idBase="order" items={ORDER_TABS} onChange={onChange} />);

    await userEvent.click(tab('Payments'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('payments');
    expect(selectedStates()).toEqual(['false', 'true', 'false', 'false']);
    expect(tabIndexes()).toEqual([-1, 0, -1, -1]);
  });

  it('moves the selection and the focus with the right arrow, wrapping from the last tab to the first', async () => {
    const onChange = vi.fn();
    render(<Tabs idBase="order" items={ORDER_TABS} value="discounts" onChange={onChange} />);

    await userEvent.tab();
    expect(tab('Discounts')).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Expenses')).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Items')).toHaveFocus();
    expect(onChange.mock.calls).toEqual([['expenses'], ['items']]);
  });

  it('moves the selection and the focus with the left arrow, wrapping from the first tab to the last', async () => {
    const onChange = vi.fn();
    render(<Tabs idBase="order" items={ORDER_TABS} onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');

    expect(selectedStates()).toEqual(['false', 'false', 'false', 'true']);
    expect(tab('Expenses')).toHaveFocus();
    expect(tabIndexes()).toEqual([-1, -1, -1, 0]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('expenses');
  });

  it('jumps to the last tab with End and back to the first with Home', async () => {
    const onChange = vi.fn();
    render(<Tabs idBase="order" items={ORDER_TABS} onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard('{End}');
    expect(selectedStates()).toEqual(['false', 'false', 'false', 'true']);
    expect(tab('Expenses')).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(selectedStates()).toEqual(['true', 'false', 'false', 'false']);
    expect(tab('Items')).toHaveFocus();
    expect(onChange.mock.calls).toEqual([['expenses'], ['items']]);
  });

  it('leaves the up and down arrows and other keys to the browser', () => {
    const onChange = vi.fn();
    render(<Tabs idBase="order" items={ORDER_TABS} onChange={onChange} />);
    const first = tab('Items');

    expect(fireEvent.keyDown(first, { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'ArrowUp' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'ArrowRight' })).toBe(false);
    expect(onChange.mock.calls).toEqual([['payments']]);
  });

  it('follows a controlled value', () => {
    const { rerender } = render(<Tabs idBase="order" items={ORDER_TABS} value="items" />);

    rerender(<Tabs idBase="order" items={ORDER_TABS} value="expenses" />);

    expect(selectedStates()).toEqual(['false', 'false', 'false', 'true']);
    expect(tabIndexes()).toEqual([-1, -1, -1, 0]);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = render(<Tabs idBase="order" items={ORDER_TABS} />);
    const first = container.innerHTML;

    rerender(<Tabs idBase="order" items={ORDER_TABS} />);
    expect(container.innerHTML).toBe(first);

    rerender(<Tabs idBase="profile" items={[{ id: 'details', label: 'Details' }]} />);
    expect(tab('Details').id).toBe('profile-tab-details');
  });
});

describe('rovingItem (the shared arrow-key rule)', () => {
  it('finds nothing in an empty list', () => {
    expect(rovingItem([], 0, 'ArrowRight', 'tabs')).toBeUndefined();
    expect(rovingItem([], 0, 'End', 'tabs')).toBeUndefined();
  });

  it('handles Home and End for tabs only, and the up and down arrows for radios only', () => {
    const items = ['a', 'b', 'c'];

    expect(rovingItem(items, 1, 'Home', 'radio')).toBeUndefined();
    expect(rovingItem(items, 1, 'End', 'radio')).toBeUndefined();
    expect(rovingItem(items, 1, 'ArrowDown', 'tabs')).toBeUndefined();
    expect(rovingItem(items, 1, 'ArrowUp', 'tabs')).toBeUndefined();
    expect(rovingItem(items, 1, 'End', 'tabs')).toEqual({ item: 'c', index: 2 });
    expect(rovingItem(items, 0, 'ArrowUp', 'radio')).toEqual({ item: 'c', index: 2 });
  });

  it('moves a vertical menu with the up and down arrows (wrapping) and Home / End, not the side arrows', () => {
    const items = ['a', 'b', 'c'];

    expect(rovingItem(items, 2, 'ArrowDown', 'menu')).toEqual({ item: 'a', index: 0 });
    expect(rovingItem(items, 0, 'ArrowUp', 'menu')).toEqual({ item: 'c', index: 2 });
    expect(rovingItem(items, 1, 'Home', 'menu')).toEqual({ item: 'a', index: 0 });
    expect(rovingItem(items, 1, 'End', 'menu')).toEqual({ item: 'c', index: 2 });
    expect(rovingItem(items, 1, 'ArrowRight', 'menu')).toBeUndefined();
    expect(rovingItem(items, 1, 'ArrowLeft', 'menu')).toBeUndefined();
  });
});

describe('tabs scenarios (the choice parity group)', () => {
  const tabScenarios = choiceScenarios.filter((scenario) => scenario.node.component === 'TabsWithPanel');
  const byId = new Map(tabScenarios.map((scenario) => [scenario.id, scenario]));

  it('declares the order tabs, hover on an unselected tab and the overflowing strip at every width', () => {
    expect(tabScenarios.map((scenario) => scenario.id)).toEqual(['tabs-orders', 'tabs-orders-other', 'tabs-overflow']);
    expect(byId.get('tabs-orders')?.states).toEqual(['rest', 'hover', 'focus-visible']);
    expect(byId.get('tabs-orders')?.target).toBe('[role="tab"][aria-selected="true"]');
    expect(byId.get('tabs-orders-other')?.states).toEqual(['rest', 'hover']);
    expect(byId.get('tabs-orders-other')?.target).toBe('[role="tab"][aria-selected="false"]');
    expect(byId.get('tabs-overflow')?.responsive).toBe(true);
    for (const scenario of tabScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.parity, scenario.id).toBe(true);
    }
  });

  it('uses the order detail tabs: Items 3, Payments 2, Discounts 1, Expenses 0, the first selected', () => {
    const tabsNode = byId.get('tabs-orders')?.node.props?.children;

    expect(tabsNode).toMatchObject({
      kind: 'node',
      component: 'Tabs',
      props: {
        idBase: 'order',
        items: ORDER_TABS,
      },
    });
    expect(byId.get('tabs-orders')?.node.props).toMatchObject({ idBase: 'order', selected: 'items' });
  });

  it('renders every tabs scenario through the implementation kit with its panel, its target present and no axe violations', async () => {
    const { container } = render(
      <div>
        {tabScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </div>,
    );

    for (const scenario of tabScenarios) {
      const frame = container.querySelector(`[data-case="${scenario.id}"]`);
      const selected = frame?.querySelector('[role="tab"][aria-selected="true"]');
      expect(frame?.children, scenario.id).toHaveLength(2);
      expect(frame?.firstElementChild, scenario.id).toHaveAttribute('role', 'tablist');
      expect(frame?.lastElementChild, scenario.id).toHaveAttribute('role', 'tabpanel');
      expect(selected?.getAttribute('aria-controls'), scenario.id).toBe(frame?.lastElementChild?.id);
      expect(frame?.querySelectorAll(scenario.target ?? ''), scenario.id).not.toHaveLength(0);
    }
    await expectNoAxeViolations(container);
  });
});
