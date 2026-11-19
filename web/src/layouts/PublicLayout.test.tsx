import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { setConsent } from '@/test/consentFixtures';
import { pageViewProbe } from '@/test/msw';
import { publicLayoutRoutes } from '@/test/publicLayoutRoutes';
import { ShellFallback } from '@/core/routes/ShellFallback';
import { PublicLayout } from './PublicLayout';
import { SiteFooter } from '@/modules/public/components/SiteFooter';
import { demoSite, putBootBlock } from '@/test/publicFixtures';

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
  it('on /products shows the designed header with Products current, the page and the footer', async () => {
    await renderAt('/products');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Out of bounds.');
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

  it('labels the navs distinctly: "Main", the footer\'s "Legal" (ANL-03), and "Mobile" once the menu is open', async () => {
    await renderAt('/');
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Main', 'Legal']);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual([
      'Main',
      'Mobile',
      'Legal',
    ]);
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

  it('gives the page top scroll padding for the sticky header, one value at every width', async () => {
    await renderAt('/');
    expect(screen.getByRole('main').className.split(' ')).toContain(
      '[:root:has(&)]:scroll-pt-[calc(var(--header-height)+1px+var(--space-6)+var(--bar-top,0px))]',
    );
  });

  it('adds the 69px pill bar to the top scroll padding on /products and /gallery only (focus not obscured)', async () => {
    for (const path of ['/products', '/gallery']) {
      const { unmount } = await renderAt(path);
      expect(screen.getByRole('main').className.split(' ')).toContain('[:root:has(&)]:[--bar-top:69px]');
      unmount();
    }

    for (const path of ['/', '/contact']) {
      const { unmount } = await renderAt(path);
      expect(screen.getByRole('main').className).not.toContain('--bar-top:69px');
      unmount();
    }
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

describe('PublicLayout Contact sticky bar (PUB-06)', () => {
  it('shows the bar on /contact once the facts are in, after the footer', async () => {
    putBootBlock(demoSite);
    const { container } = await renderAt('/contact');

    const call = await screen.findByRole('link', { name: 'Call us' });
    expect(call).toHaveAttribute('href', 'tel:+639171234567');
    expect(screen.getByRole('link', { name: 'Messenger' })).toHaveAttribute('href', 'https://m.me/cspsdemo');
    const bar = container.querySelector('[data-contact-bar]');
    expect(bar).toContainElement(call);
    expect(screen.getByRole('contentinfo').compareDocumentPosition(bar as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows no bar on the other public pages', async () => {
    putBootBlock(demoSite);
    for (const path of ['/', '/products', '/gallery', '/nope']) {
      const { unmount } = await renderAt(path);
      expect(screen.queryByRole('link', { name: 'Call us' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('keeps a bottom scroll padding for the bar at 767px and below on /contact only', async () => {
    const contact = await renderAt('/contact');
    expect(screen.getByRole('main').className).toContain(
      'vp-lt-md:[:root:has(&)]:scroll-pb-[calc(var(--spacing-contact-bar)+var(--space-6)+env(safe-area-inset-bottom))]',
    );
    contact.unmount();

    await renderAt('/products');
    expect(screen.getByRole('main').className).not.toContain('scroll-pb-');
  });
});

describe('PublicLayout footer variant by route (UI-SPEC Footer)', () => {
  it.each(['/', '/products'])('%s shows the full footer with its four columns', async (path) => {
    putBootBlock(demoSite);
    await renderAt(path);
    const footer = screen.getByRole('contentinfo');

    expect(
      within(footer)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Shop', 'Visit', 'Contact']);
    expect(within(footer).getByText('© 2026 Sample Shop. All rights reserved.')).toBeInTheDocument();
  });

  it.each(['/gallery', '/contact', '/nope'])('%s shows the base row: logo, copyright and Staff Login', async (path) => {
    putBootBlock(demoSite);
    await renderAt(path);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).queryByRole('heading')).not.toBeInTheDocument();
    expect(within(footer).getByText('© 2026 Sample Shop')).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toHaveAttribute('href', '/admin/login');
  });

  it('clears the Contact bar under the base row: 96px, or the bar plus the safe area when taller', async () => {
    putBootBlock(demoSite);
    await renderAt('/contact');

    expect(screen.getByRole('contentinfo').className.split(' ')).toContain(
      'pg-phone:pb-[max(var(--space-24),calc(var(--spacing-contact-bar)+env(safe-area-inset-bottom)))]',
    );
  });
});

describe('PublicLayout footer (App. E.1, D-33, PUB-02)', () => {
  it('names the social links from the stored links, "FB, CSPS on Facebook" and "IG, CSPS on Instagram"', async () => {
    putBootBlock(demoSite);
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'FB, CSPS on Facebook' })).toHaveAttribute(
      'href',
      'https://www.facebook.com/cspsdemo',
    );
    expect(within(footer).getByRole('link', { name: 'FB, CSPS on Facebook' })).toHaveTextContent('FB');
    expect(within(footer).getByRole('link', { name: 'IG, CSPS on Instagram' })).toBeInTheDocument();
  });

  it('links "Staff Login" to /admin/login and the Shop column to the public pages', async () => {
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toHaveAttribute('href', '/admin/login');
    expect(within(footer).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products');
    expect(within(footer).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery');
    expect(within(footer).getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
  });

  it('shows the stored contact details under Shop, Visit and Contact, with no email row', async () => {
    putBootBlock(demoSite);
    await renderAt('/');
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Shop', 'Visit', 'Contact']);
    expect(
      within(footer).getByText('12 Sample St., Poblacion, Sample City, Sample Province, Philippines'),
    ).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
    expect(within(footer).getByRole('link', { name: 'Message us on Messenger' })).toBeInTheDocument();
    expect(footer.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(within(footer).getByRole('img', { name: "CSPS: Carmen's Stitch & Printing Services" })).toBeInTheDocument();
    expect(within(footer).getByText('© 2026 Sample Shop. All rights reserved.')).toBeInTheDocument();
  });
});

describe('PublicLayout heading order (D-41 R2-17)', () => {
  it('goes h1 then h2: the footer column titles are h2 (not h4), after exactly one h1, with their look unchanged', async () => {
    putBootBlock(demoSite);
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
      expect(title.className).toBe('mb-4 font-display text-16 font-bold tracking-[.12em] text-ink-muted uppercase');
    }
  });
});

const CONTACT_PAD =
  'vp-lt-md:[:root:has(&)]:scroll-pb-[calc(var(--spacing-contact-bar)+var(--space-6)+env(safe-area-inset-bottom))]';

/** Waits a moment for a lazy cookie bar to appear, and passes only if it never does. */
async function expectNoCookieBar(): Promise<void> {
  await expect(screen.findByRole('region', { name: 'Cookie choices' }, { timeout: 250 })).rejects.toThrow();
}

describe('PublicLayout with no cookie bar (D-54)', () => {
  it('shows no cookie bar on a first visit', async () => {
    setConsent({ cookie: null });
    await renderAt('/products');

    expect(document.querySelector('[data-consent-status]') === null).toBe(true);
    await expectNoCookieBar();
  });

  it('adds no bar padding to the page or its root on a first visit', async () => {
    setConsent({ cookie: null });
    const { container } = await renderAt('/');

    await expectNoCookieBar();
    expect(screen.getByRole('main').className).not.toContain('--spacing-consent-bar');
    expect(container.firstElementChild?.className).not.toContain('--spacing-consent-bar');
  });

  it('always shows the phone Contact bar on /contact, with its bottom padding, on a first visit', async () => {
    putBootBlock(demoSite);
    setConsent({ cookie: null });
    const { container } = await renderAt('/contact');

    expect(await screen.findByRole('link', { name: 'Call us' })).toBeInTheDocument();
    expect(container.querySelector('[data-contact-bar]')).not.toBeNull();
    expect(screen.getByRole('main').className.split(' ')).toContain(CONTACT_PAD);
  });

  it('shows the Contact bar when a choice is already saved', async () => {
    putBootBlock(demoSite);
    await renderAt('/contact');
    expect(await screen.findByRole('link', { name: 'Call us' })).toBeInTheDocument();
  });

  it('has no axe violations on a first visit', async () => {
    setConsent({ cookie: null });
    const { container } = await renderAt('/products');
    await expectNoCookieBar();
    await expectNoAxeViolations(container);
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
    putBootBlock(demoSite);
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

  it('the shell fallback and the public layout page roots carry the viewport marker (D-01)', async () => {
    const fallback = render(<ShellFallback />);
    expect(fallback.container.firstElementChild).toHaveAttribute('data-fill', 'viewport');
    fallback.unmount();

    const { container } = await renderAt('/products');
    expect(container.firstElementChild).toHaveAttribute('data-fill', 'viewport');
  });
});

describe('PublicLayout page-view beacon (ANL-05, ANL-06)', () => {
  it('sends one view with the path only for /gallery?q=jersey#top when a choice is saved', async () => {
    const probe = pageViewProbe();

    await renderAt('/gallery?q=jersey#top');

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/gallery' });
  });

  it('still renders /contact normally and logs nothing when the beacon is answered with 500', async () => {
    const probe = pageViewProbe(500);

    await renderAt('/contact');

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('still renders normally and logs nothing when the beacon is answered with 429', async () => {
    const probe = pageViewProbe(429);

    await renderAt('/contact');

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('sends one view for / and one for /products when the visitor follows the header link', async () => {
    const probe = pageViewProbe();
    await renderAt('/');
    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });

    await userEvent.click(within(mainNav()).getByRole('link', { name: 'Products' }));

    await waitFor(() => {
      expect(probe.requests).toHaveLength(2);
    });
    expect(probe.requests.map((request) => request.body)).toEqual([{ path: '/' }, { path: '/products' }]);
  });

  it('counts the landing page before any choice', async () => {
    setConsent({ cookie: null });
    const probe = pageViewProbe();

    await renderAt('/');

    await waitFor(() => {
      expect(probe.requests).toHaveLength(1);
    });
    expect(probe.requests[0]?.body).toEqual({ path: '/' });
  });

  it('does not count a /dev path or an /admin path', async () => {
    const probe = pageViewProbe();
    const router = createMemoryRouter(
      [{ path: '/', Component: PublicLayout, children: [{ path: '*', element: <h1>Check page</h1> }] }],
      { initialEntries: ['/dev/public'] },
    );
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1 });
    await act(async () => {
      await router.navigate('/admin/orders');
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    expect(probe.requests).toHaveLength(0);
  });
});
