import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as navigationScenarios } from '@/dev/scenarios/groups/navigation';
import { expectNoAxeViolations } from '@/test/axe';
import { SITE_LINKS, SiteHeader } from '@/components/navigation';
import {
  siteBurgerClasses,
  siteCtaClasses,
  siteDrawerClasses,
  siteDrawerCtaClasses,
  siteDrawerLinkClasses,
  siteHeaderClasses,
  siteHeaderInnerClasses,
  siteLinkClasses,
  siteNavClasses,
} from './navigation.recipe';

// The converted App. D.3 SiteHeader (plan 02-26, CSPS-UI-SPEC.md §6.6, UI-SPEC Layout Contract "Header"): App. D.3's
// markup, props and copy with the D-03 second cue on the current link (aria-current + weight 700) and the D-31 O-3
// italic current drawer link (now also aria-current). "Get a Quote" takes the visitor to /contact. The look is proven by
// the parity suite (`--grep @navigation`); these tests pin the markup, the names, the behaviour and the header scenarios.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

/** Shows the router's current path, so a test can see where a control took the visitor. */
function Where() {
  return <output aria-label="Path">{useLocation().pathname}</output>;
}

/** The header inside a router at `/`, with the path probe after it. */
function inRouter(children: ReactNode) {
  return (
    <MemoryRouter>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {children}
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function path(): string {
  return screen.getByRole('status', { name: 'Path' }).textContent;
}

function mainLinks(): HTMLElement[] {
  return within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
}

function drawerLinks(): HTMLElement[] {
  return within(screen.getByRole('navigation', { name: 'Mobile' })).getAllByRole('link');
}

function burger(): HTMLElement {
  return screen.getByRole('button', { name: 'Menu' });
}

const byId = new Map(navigationScenarios.map((scenario) => [scenario.id, scenario]));

/** Renders a navigation scenario exactly as the parity page does: through the implementation kit, in a router. */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No navigation scenario "${id}".`);
  }
  return render(<MemoryRouter>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>);
}

describe('SiteHeader markup (App. D.3)', () => {
  it('is a header with the home-linked logo, the "Main" links, "Get a Quote" and the burger, in that order', () => {
    const { container } = render(inRouter(<SiteHeader />));
    const header = container.querySelector('header');
    const inner = header?.firstElementChild;

    expect(header).toBe(screen.getByRole('banner'));
    expect(hasClasses(header, siteHeaderClasses)).toBe(true);
    expect(hasClasses(inner, siteHeaderInnerClasses)).toBe(true);
    expect([...(inner?.children ?? [])].map((child) => child.localName)).toEqual(['a', 'nav', 'button', 'button']);

    const home = inner?.children[0];
    expect(home?.getAttribute('href')).toBe('/');
    expect(within(home as HTMLElement).getByRole('img', { name: /^CSPS/ })).toBeDefined();
    expect(hasClasses(screen.getByRole('navigation', { name: 'Main' }), siteNavClasses)).toBe(true);
    // The lockup takes the phone header look (App. C `.csp-site-header .csp-logo-tag`) on its tagline.
    const tagline = within(home as HTMLElement).getByRole('img', { name: /^CSPS/ }).lastElementChild;
    expect(tagline?.textContent).toBe("Carmen's Stitch& Printing Services");
    expect(hasClasses(tagline, 'pg-phone:text-[8px] pg-phone:tracking-[.12em]')).toBe(true);
  });

  it('lists the four site links with their paths, each with the site-link look', () => {
    render(inRouter(<SiteHeader />));

    expect(mainLinks().map((item) => item.textContent)).toEqual(['Home', 'Products', 'Gallery', 'Contact']);
    expect(mainLinks().map((item) => item.getAttribute('href'))).toEqual(['/', '/products', '/gallery', '/contact']);
    expect(mainLinks().every((item) => hasClasses(item, siteLinkClasses))).toBe(true);
    expect(SITE_LINKS.map((item) => item.label)).toEqual(['Home', 'Products', 'Gallery', 'Contact']);
  });

  it('renders the links it is given', () => {
    render(inRouter(<SiteHeader links={[{ label: 'Shop', to: '/shop' }]} active="Shop" />));

    expect(mainLinks().map((item) => [item.textContent, item.getAttribute('aria-current')])).toEqual([
      ['Shop', 'page'],
    ]);
  });

  it('shows "Get a Quote" with its arrow, hidden on phones', () => {
    render(inRouter(<SiteHeader />));
    const quote = screen.getByRole('button', { name: 'Get a Quote' });

    expect(hasClasses(quote, siteCtaClasses)).toBe(true);
    expect(tokens(siteCtaClasses)).toEqual(['pg-phone:hidden']);
    expect(quote.querySelectorAll('svg')).toHaveLength(1);
    expect(quote.lastElementChild?.localName).toBe('svg');
  });
});

describe('SiteHeader current link (D-03)', () => {
  it('marks Home current by default and the active link otherwise, bold through aria-current', () => {
    const { unmount } = render(inRouter(<SiteHeader />));
    expect(mainLinks().map((item) => item.getAttribute('aria-current'))).toEqual(['page', null, null, null]);
    unmount();

    render(inRouter(<SiteHeader active="Products" />));
    expect(mainLinks().map((item) => item.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
    const current = screen.getByRole('link', { name: 'Products' });
    for (const token of [
      'aria-[current=page]:font-bold',
      'aria-[current=page]:text-ink',
      'aria-[current=page]:after:bg-accent',
    ]) {
      expect(current.classList.contains(token)).toBe(true);
    }
  });

  it('marks nothing current (and nothing bold) when the active label matches no link', async () => {
    render(inRouter(<SiteHeader active="" />));
    expect(mainLinks().every((item) => !item.hasAttribute('aria-current'))).toBe(true);

    await userEvent.click(burger());
    expect(drawerLinks().every((item) => !item.hasAttribute('aria-current'))).toBe(true);
  });
});

describe('SiteHeader phone drawer (D-31 O-3)', () => {
  it('opens and closes from the burger, which says whether it is open', async () => {
    render(inRouter(<SiteHeader />));

    expect(burger().getAttribute('aria-expanded')).toBe('false');
    expect(hasClasses(burger(), siteBurgerClasses)).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();

    await userEvent.click(burger());
    expect(burger().getAttribute('aria-expanded')).toBe('true');
    expect(hasClasses(screen.getByRole('navigation', { name: 'Mobile' }), siteDrawerClasses)).toBe(true);

    await userEvent.click(burger());
    expect(burger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();
  });

  it('shows the big links with arrows and the block "Get a Quote"; the current one is aria-current and italic', async () => {
    render(inRouter(<SiteHeader active="Gallery" />));
    await userEvent.click(burger());

    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Main', 'Mobile']);
    expect(drawerLinks().map((item) => item.textContent)).toEqual(['Home', 'Products', 'Gallery', 'Contact']);
    expect(drawerLinks().map((item) => item.getAttribute('aria-current'))).toEqual([null, null, 'page', null]);
    for (const item of drawerLinks()) {
      expect(hasClasses(item, siteDrawerLinkClasses)).toBe(true);
      expect(item.querySelectorAll('svg')).toHaveLength(1);
    }
    expect(siteDrawerLinkClasses).toContain('aria-[current=page]:italic');
    const quotes = screen.getAllByRole('button', { name: 'Get a Quote' });
    expect(quotes).toHaveLength(2);
    expect(hasClasses(quotes[1], siteDrawerCtaClasses)).toBe(true);
  });

  it('closes when a drawer link is followed', async () => {
    render(inRouter(<SiteHeader />));
    await userEvent.click(burger());
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Mobile' })).getByRole('link', { name: 'Contact' }),
    );

    expect(path()).toBe('/contact');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();
    expect(burger().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('SiteHeader "Get a Quote" (UI-SPEC Layout Contract)', () => {
  it('takes the visitor to /contact', async () => {
    render(inRouter(<SiteHeader />));
    expect(path()).toBe('/');

    await userEvent.click(screen.getByRole('button', { name: 'Get a Quote' }));
    expect(path()).toBe('/contact');
  });

  it('from the drawer: closes it and takes the visitor to /contact', async () => {
    render(inRouter(<SiteHeader />));
    await userEvent.click(burger());
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Mobile' })).getByRole('button'));

    expect(path()).toBe('/contact');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();
  });

  it('calls onQuote instead when it is given (App. D.3 API)', async () => {
    const onQuote = vi.fn();
    render(inRouter(<SiteHeader onQuote={onQuote} />));

    await userEvent.click(screen.getByRole('button', { name: 'Get a Quote' }));
    expect(onQuote).toHaveBeenCalledOnce();
    expect(path()).toBe('/');
  });

  it('renders the same markup again for the same props, and the new header for new props', () => {
    const { container, rerender } = render(inRouter(<SiteHeader active="Home" />));
    const first = container.innerHTML;

    rerender(inRouter(<SiteHeader active="Home" />));
    expect(container.innerHTML).toBe(first);

    rerender(inRouter(<SiteHeader active="Contact" />));
    expect(container.innerHTML).not.toBe(first);
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('SiteHeader scenarios and axe', () => {
  it('lists the header cases the parity suite compares (Blush only, D-14)', () => {
    const header = navigationScenarios.filter((s) => s.id.startsWith('site-header-'));
    expect(header.map((s) => [s.id, s.states.join('+'), s.responsive])).toEqual([
      ['site-header-home', 'rest+hover', true],
      ['site-header-none-current', 'rest', true],
      ['site-header-drawer-open', 'rest', false],
    ]);
    expect(header.every((s) => s.group === 'navigation' && s.parity && s.themes.join() === 'light')).toBe(true);
  });

  it('opens the drawer in the drawer-open case', () => {
    renderCase('site-header-drawer-open');

    expect(burger().getAttribute('aria-expanded')).toBe('true');
    expect(drawerLinks()[0]?.getAttribute('aria-current')).toBe('page');
  });

  it.each(['site-header-home', 'site-header-none-current', 'site-header-drawer-open'])(
    '%s renders through the kit with no axe violations',
    async (id) => {
      const { container } = renderCase(id);
      expect(container.querySelector('[role="alert"]')).toBeNull();
      await expectNoAxeViolations(container);
    },
  );
});
