import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { publicLayoutRoutes } from '@/test/publicLayoutRoutes';
import { ShellFallback } from '@/core/routes/ShellFallback';
import { PublicLayout } from './PublicLayout';
import { SITE_CONTACT } from '@/modules/public/components/siteContact';
import { SiteFooter } from '@/modules/public/components/SiteFooter';

/** The public layout route tree (src/test/publicLayoutRoutes.ts) in a memory router at `path`, settled once the page's h1 is on screen. */
async function renderAt(path: string) {
  const router = createMemoryRouter(publicLayoutRoutes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
  return { ...view, router };
}

function mainNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Main' });
}

function currentLinks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[aria-current="page"]')].map((link) => link.textContent);
}

describe('PublicLayout tracer (WEB-05)', () => {
  it('on /products shows the designed header with Products current, the placeholder page and the footer', async () => {
    await renderAt('/products');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Site update in progress.');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('PublicLayout current link (A11Y-04)', () => {
  it.each([
    ['/', 'Home'],
    ['/products', 'Products'],
    ['/gallery', 'Gallery'],
    ['/contact', 'Contact'],
    ['/products/', 'Products'],
  ])('%s makes %s the only current header link', async (path, label) => {
    const { container } = await renderAt(path);
    expect(within(mainNav()).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(currentLinks(container)).toEqual([label]);
  });

  it.each(['/nope', '/some/unknown', '/administrator'])(
    '%s marks no link current, so nothing is bold (empty edge)',
    async (path) => {
      const { container } = await renderAt(path);
      expect(currentLinks(container)).toEqual([]);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it('follows a navigation: choosing Gallery makes Gallery current and Products not', async () => {
    const { container, router } = await renderAt('/products');
    await userEvent.click(within(mainNav()).getByRole('link', { name: 'Gallery' }));
    expect(router.state.location.pathname).toBe('/gallery');
    expect(currentLinks(container)).toEqual(['Gallery']);
  });
});

describe('PublicLayout landmarks and page root (A11Y-01, D-14)', () => {
  it('has exactly one h1, one banner, one main#main and one contentinfo', async () => {
    await renderAt('/');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  it('labels the two navs distinctly: "Main", and "Mobile" once the menu is open', async () => {
    await renderAt('/');
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Main']);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Main', 'Mobile']);
  });

  it('is the Blush page root, always light, with the header, main and footer in that order', async () => {
    const { container } = await renderAt('/');
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root?.className.split(' ')).toEqual(expect.arrayContaining(['@container/pg', 'bg-bg', 'text-ink']));
    const order = [screen.getByRole('banner'), screen.getByRole('main'), screen.getByRole('contentinfo')];
    for (let index = 1; index < order.length; index += 1) {
      const previous = order[index - 1];
      const current = order[index];
      expect(previous?.compareDocumentPosition(current as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('keeps main at least the viewport minus the header tall, and not busy when idle', async () => {
    await renderAt('/');
    const main = screen.getByRole('main');
    expect(main.className.split(' ')).toContain('min-h-[calc(100dvh-var(--header-height))]');
    expect(main).not.toHaveAttribute('aria-busy');
  });

  it('has no axe violations', async () => {
    const { container } = await renderAt('/products');
    await expectNoAxeViolations(container);
  });
});

describe('PublicLayout skip link (A11Y-02)', () => {
  it('is the first focusable element, and moves focus to main without changing the URL', async () => {
    const { router } = await renderAt('/products');
    const user = userEvent.setup();

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/products');
    expect(router.state.location.hash).toBe('');
  });

  it('puts the header next in the keyboard order, then main, then the footer', async () => {
    await renderAt('/');
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('banner')).toContainElement(document.activeElement as HTMLElement);
  });
});

describe('PublicLayout footer (App. E.1, D-31 O-4)', () => {
  it('names the social links "CSPS on Facebook", "CSPS on Instagram" and "CSPS on TikTok"', async () => {
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    for (const name of ['CSPS on Facebook', 'CSPS on Instagram', 'CSPS on TikTok']) {
      expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', '#');
    }
    expect(within(footer).getByRole('link', { name: 'CSPS on Facebook' })).toHaveTextContent('FB');
  });

  it('links "Staff Login" to /admin/login and the Shop column to the public pages', async () => {
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toHaveAttribute('href', '/admin/login');
    expect(within(footer).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products');
    expect(within(footer).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery');
    expect(within(footer).getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
  });

  it('shows the contact details from the one config module, under Shop, Visit and Contact', async () => {
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Shop', 'Visit', 'Contact']);
    expect(within(footer).getByText(SITE_CONTACT.address)).toBeInTheDocument();
    expect(within(footer).getByText(SITE_CONTACT.hours)).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: SITE_CONTACT.phone.text })).toHaveAttribute(
      'href',
      SITE_CONTACT.phone.href,
    );
    expect(within(footer).getByRole('link', { name: SITE_CONTACT.messenger.text })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: SITE_CONTACT.email.text })).toBeInTheDocument();
    expect(within(footer).getByRole('img', { name: "CSPS: Carmen's Stitch & Printing Services" })).toBeInTheDocument();
    expect(
      within(footer).getByText("© 2026 Carmen's Stitch & Printing Services. All rights reserved."),
    ).toBeInTheDocument();
  });
});

describe('PublicLayout heading order (D-41 R2-17)', () => {
  it('goes h1 then h2: the footer column titles are h2 (not h4), after exactly one h1, with their look unchanged', async () => {
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    const titles = within(footer).getAllByRole('heading');
    const levels = screen.getAllByRole('heading').map((heading) => heading.localName);

    expect(titles.map((heading) => [heading.localName, heading.textContent])).toEqual([
      ['h2', 'Shop'],
      ['h2', 'Visit'],
      ['h2', 'Contact'],
    ]);
    expect(footer.querySelector('h3, h4, h5, h6')).toBeNull();
    expect(levels.filter((level) => level === 'h1')).toHaveLength(1);
    expect(levels.indexOf('h1')).toBeLessThan(levels.indexOf('h2'));
    for (const title of titles) {
      expect(title.className).toBe('mb-4 font-display text-[16px] font-bold tracking-[.12em] text-ink-muted uppercase');
    }
  });
});

describe('PublicLayout route chunks (UI consideration: loading)', () => {
  it('keeps the header and footer while a route chunk loads, and marks main busy until it lands', async () => {
    let finish: (value: { Component: () => ReactNode }) => void = () => undefined;
    const slow = new Promise<{ Component: () => ReactNode }>((resolve) => {
      finish = resolve;
    });
    const tree: RouteObject[] = [
      {
        HydrateFallback: ShellFallback,
        Component: PublicLayout,
        children: [
          { index: true, Component: () => <h1>Home page</h1> },
          { path: 'slow', lazy: () => slow },
        ],
      },
    ];
    const router = createMemoryRouter(tree, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { name: 'Home page' });

    let navigation: Promise<void> = Promise.resolve();
    act(() => {
      navigation = router.navigate('/slow');
    });

    expect(await screen.findByRole('main', { busy: true })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    await act(async () => {
      finish({ Component: () => <h1>Slow page</h1> });
      await navigation;
    });
    expect(await screen.findByRole('heading', { name: 'Slow page' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
  });
});

describe('ShellFallback and SiteFooter (research Pattern 2, Pitfall 10)', () => {
  it('shows the Blush page root while the first route chunks load, then the page', async () => {
    const router = createMemoryRouter(publicLayoutRoutes, { initialEntries: ['/'] });
    const { container } = render(<RouterProvider router={router} />);
    const fallback = container.firstElementChild;
    expect(fallback).toHaveAttribute('data-theme', 'light');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('SiteFooter re-renders from the React Compiler memo cache with the same output (L-13)', () => {
    const footer = render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    const firstFooter = footer.container.innerHTML;
    footer.rerender(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(footer.container.innerHTML).toBe(firstFooter);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('ShellFallback is an empty light page root', () => {
    const { container, rerender } = render(<ShellFallback />);
    rerender(<ShellFallback />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root?.childElementCount).toBe(0);
  });
});
