import { render, screen, within } from '@testing-library/react';
import { http } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  answerProductLines,
  answerSite,
  demoLines,
  demoSite,
  oneLine,
  putBootBlock,
  siteWithoutOptionals,
} from '@/test/publicFixtures';

/** The real route tree at /products, settled once the page's h1 is on screen (the lazy chunks load on first use). */
async function renderProducts(path = '/products') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Every kit, your way.' }, { timeout: 15_000 });
  return { ...view, router };
}

describe('ProductsPage at /products (PUB-01, UI-SPEC P1 item 1)', { timeout: 20_000 }, () => {
  it('renders inside the public layout: one banner, one main, one contentinfo', async () => {
    await renderProducts();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });

  it('has one h1, "Every kit, your way.", with "your way." in the em', async () => {
    await renderProducts();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('your way.');
  });

  it('shows the eyebrow and a breadcrumb with Products as the current page', async () => {
    await renderProducts();
    expect(screen.getByText('Products & services')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByText('Products')).toHaveAttribute('aria-current', 'page');
  });

  it('sets the document title the server sends', async () => {
    await renderProducts();
    expect(document.title).toBe('Products and Prices · CSPS');
  });

  it('has no axe violations', async () => {
    const { container } = await renderProducts();
    await screen.findAllByRole('article');
    await expectNoAxeViolations(container);
  });
});

describe('ProductsPage product articles (PUB-02, D-42)', { timeout: 20_000 }, () => {
  it('shows one article per active line in display order, each named by its title', async () => {
    await renderProducts();

    const articles = await screen.findAllByRole('article');
    expect(articles.map((article) => article.id)).toEqual([
      'basketball',
      'volleyball',
      'moto',
      'longsleeves',
      'polo',
      'custom',
    ]);
    expect(screen.getByRole('article', { name: 'Basketball Jerseys' })).toBeInTheDocument();
    expect(screen.getByText('01 / 06')).toBeInTheDocument();
    expect(screen.getByText('06 / 06')).toBeInTheDocument();
  });

  it('shows the Manager price from the server on the basketball article', async () => {
    await renderProducts();

    const basketball = await screen.findByRole('article', { name: 'Basketball Jerseys' });
    expect(within(basketball).getByText('₱650.00')).toBeInTheDocument();
    const volleyball = screen.getByRole('article', { name: 'Volleyball Jerseys' });
    expect(within(volleyball).getByText('Message us for a price')).toBeInTheDocument();
  });

  it('counts the lines in words in the lead', async () => {
    await renderProducts();

    expect(
      await screen.findByText(
        'Six product lines, all printed by full sublimation and finished by our tailors. Pick a base, then make every detail yours.',
      ),
    ).toBeInTheDocument();
  });

  it('reads "One product line, ..." for a single line', async () => {
    answerProductLines(oneLine);
    await renderProducts();

    expect(await screen.findByText(/^One product line, printed by full sublimation/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('on a first visit uses the productLines boot block and makes no request for the lines', async () => {
    let requests = 0;
    server.use(
      http.get('*/api/v1/public/product-lines', () => {
        requests += 1;
        return new Response(null, { status: 500 });
      }),
    );
    putBootBlock(demoSite, demoLines);

    await renderProducts();

    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(requests).toBe(0);
  });
});

describe('ProductsPage pills and help card (D-19, D-32)', { timeout: 20_000 }, () => {
  it('shows the Product lines pill bar above the articles, one link per line', async () => {
    await renderProducts();

    const nav = await screen.findByRole('navigation', { name: 'Product lines' });
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(within(nav).getByRole('link', { name: 'Polo Shirts' })).toHaveAttribute('href', '#polo');
  });

  it('shows the help card with Get a Quote to /contact and Message us to the Messenger link', async () => {
    await renderProducts();

    expect(
      await screen.findByRole('heading', { level: 2, name: "Tell us the sport. We'll suggest the rest." }),
    ).toBeVisible();
    expect(screen.getByText('Not sure what to pick?')).toBeInTheDocument();
    const help = screen.getByRole('heading', { name: /Tell us the sport/ }).closest('section');
    expect(help).not.toBeNull();
    const quote = within(help as HTMLElement).getByRole('link', { name: 'Get a Quote' });
    expect(quote).toHaveAttribute('href', '/contact');
    await vi.waitFor(() => {
      expect(within(help as HTMLElement).getByRole('link', { name: 'Message us' })).toHaveAttribute(
        'href',
        'https://m.me/cspsdemo',
      );
    });
  });

  it('sends Message us to /contact when no Messenger link is set', async () => {
    answerSite(siteWithoutOptionals);
    await renderProducts();

    const help = (await screen.findByRole('heading', { name: /Tell us the sport/ })).closest('section');
    await vi.waitFor(() => {
      expect(within(help as HTMLElement).getByRole('link', { name: 'Message us' })).toHaveAttribute('href', '/contact');
    });
  });

  it('has no axe violations with the pills, articles and help card', async () => {
    const { container } = await renderProducts();
    await screen.findAllByRole('article');
    await expectNoAxeViolations(container);
  });
});

describe('ProductsPage hash on load (UI-SPEC P1 Hash on load)', { timeout: 20_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function reducedMotion(reduced: boolean): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: reduced && query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
  }

  it('scrolls the polo article into view once after the lines load, smoothly, and leaves focus alone', async () => {
    reducedMotion(false);
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const before = document.activeElement;

    await renderProducts('/products#polo');
    await screen.findAllByRole('article');

    await vi.waitFor(() => {
      expect(scroll).toHaveBeenCalledTimes(1);
    });
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('polo'));
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(before);
  });

  it('scrolls instantly under prefers-reduced-motion', async () => {
    reducedMotion(true);
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');

    await renderProducts('/products#moto');
    await screen.findAllByRole('article');

    await vi.waitFor(() => {
      expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    });
  });

  it('does nothing for a hash that matches no article', async () => {
    reducedMotion(false);
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');

    await renderProducts('/products#nope');
    await screen.findAllByRole('article');

    expect(scroll).not.toHaveBeenCalled();
  });

  it('does nothing with no hash', async () => {
    reducedMotion(false);
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');

    await renderProducts();
    await screen.findAllByRole('article');

    expect(scroll).not.toHaveBeenCalled();
  });
});
