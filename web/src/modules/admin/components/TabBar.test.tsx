import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { AdminSection } from '@/components/navigation';
import { expectNoAxeViolations } from '@/test/axe';
import { tabBarColumnClasses, tabBarCountClasses } from './admin.recipe';
import { QUOTES_TAB_ITEM, TAB_BAR_ITEMS, TabBar } from './TabBar';

// The phone tab bar (App. E.6) with the fifth "Quotes" tab and its New count (D-30, D-14; UI-SPEC R4).

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function tabs(): HTMLElement[] {
  return within(screen.getByRole('navigation', { name: 'Admin' })).getAllByRole('link');
}

function quotesTab(): HTMLElement {
  return screen.getByRole('link', { name: /^Quotes/ });
}

function chipOf(tab: HTMLElement): HTMLElement | undefined {
  return [...tab.querySelectorAll<HTMLElement>('span')].find((element) => hasClasses(element, tabBarCountClasses));
}

describe('TabBar (App. E.6, D-30)', () => {
  it('has five tabs, Quotes right after Orders, with their paths', () => {
    render(
      <MemoryRouter>
        <TabBar withQuotes />
      </MemoryRouter>,
    );

    expect(tabs().map((tab) => tab.textContent)).toEqual(['Dashboard', 'Orders', 'Quotes', 'Expenses', 'Profile']);
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/quote-requests',
      '/admin/expenses',
      '/admin/profile',
    ]);
    expect(TAB_BAR_ITEMS.map((item) => item.id)).toEqual(['dashboard', 'orders', 'expenses', 'profile']);
    expect(QUOTES_TAB_ITEM).toEqual({ id: 'quotes', label: 'Quotes', icon: 'inbox', to: '/admin/quote-requests' });
  });

  it("keeps App. E.6's four tabs and four columns without the prop (the parity scenarios stay equal)", () => {
    render(
      <MemoryRouter>
        <TabBar counts={{ quotes: 3 }} />
      </MemoryRouter>,
    );

    expect(tabs().map((tab) => tab.textContent)).toEqual(['Dashboard', 'Orders', 'Expenses', 'Profile']);
    expect(tokens(screen.getByRole('navigation', { name: 'Admin' }).className)).toContain('grid-cols-4');
  });

  it('draws Quotes with the 22px inbox icon', () => {
    render(
      <MemoryRouter>
        <TabBar withQuotes />
      </MemoryRouter>,
    );

    const icon = quotesTab().querySelector('svg.lucide-inbox');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('width')).toBe('22');
  });

  it('shares the bar among five equal columns', () => {
    render(
      <MemoryRouter>
        <TabBar withQuotes />
      </MemoryRouter>,
    );
    const bar = tokens(screen.getByRole('navigation', { name: 'Admin' }).className);

    expect(bar).toContain(tabBarColumnClasses.five);
    expect(bar).not.toContain(tabBarColumnClasses.four);
  });

  it('shows the New count chip at the icon and names the tab "Quotes, 3 new"', () => {
    render(
      <MemoryRouter>
        <TabBar withQuotes counts={{ quotes: 3 }} />
      </MemoryRouter>,
    );
    const tab = quotesTab();

    expect(tab).toHaveAccessibleName('Quotes, 3 new');
    const chip = chipOf(tab);
    expect(chip?.textContent).toBe('3');
    expect(chip?.getAttribute('aria-hidden')).toBe('true');
    // The chip sits in the icon's box, at its top right.
    expect(chip?.parentElement?.querySelector('svg.lucide-inbox')).not.toBeNull();
    expect(tokens(tabBarCountClasses)).toEqual(
      expect.arrayContaining([
        'absolute',
        'h-5',
        'min-w-[22px]',
        'rounded-xs',
        'px-1.5',
        'text-[12px]',
        'leading-5',
        'font-semibold',
        'tabular-nums',
        'bg-accent',
        'text-on-accent',
      ]),
    );
  });

  it('caps the chip at "99+" above 99', () => {
    render(
      <MemoryRouter>
        <TabBar withQuotes counts={{ quotes: 250 }} />
      </MemoryRouter>,
    );

    expect(chipOf(quotesTab())?.textContent).toBe('99+');
    expect(quotesTab()).toHaveAccessibleName('Quotes, 99+ new');
  });

  it.each<[string, { quotes?: number } | undefined]>([
    ['a count of 0', { quotes: 0 }],
    ['no count yet', undefined],
  ])('shows no chip and no hidden text for %s', (_case, counts) => {
    render(
      <MemoryRouter>
        <TabBar withQuotes counts={counts} />
      </MemoryRouter>,
    );

    expect(quotesTab()).toHaveAccessibleName('Quotes');
    expect(quotesTab().textContent).toBe('Quotes');
    expect(chipOf(quotesTab())).toBeUndefined();
  });

  it('marks Quotes current for the quotes section, and only it', () => {
    const active: AdminSection = 'quotes';
    render(
      <MemoryRouter>
        <TabBar withQuotes active={active} counts={{ quotes: 1 }} />
      </MemoryRouter>,
    );

    expect(tabs().filter((tab) => tab.getAttribute('aria-current') === 'page')).toEqual([quotesTab()]);
  });

  it.each<[string, { quotes: number }]>([
    ['with a count', { quotes: 3 }],
    ['with no count', { quotes: 0 }],
  ])('has no axe violations %s', async (_case, counts) => {
    const { container } = render(
      <MemoryRouter>
        <TabBar withQuotes active="quotes" counts={counts} />
      </MemoryRouter>,
    );
    await expectNoAxeViolations(container);
  });
});
