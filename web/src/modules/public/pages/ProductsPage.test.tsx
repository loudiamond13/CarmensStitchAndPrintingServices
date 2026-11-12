import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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
  makeLine,
  noLines,
  oneLine,
  productLinesFailureHandler,
  productLinesHandler,
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

/** The help card's section, found by its heading. */
async function helpCard(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 2, name: "Tell us the sport. We'll suggest the rest." });
  const section = heading.closest('section');
  if (section === null) {
    throw new Error('The help card heading is not inside a section.');
  }
  return section;
}

describe('ProductsPage pills and help card (D-19, D-32)', { timeout: 20_000 }, () => {
  it('shows the Product lines pill bar above the articles, one link per line', async () => {
    await renderProducts();

    const nav = await screen.findByRole('navigation', { name: 'Product lines' });
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(within(nav).getByRole('link', { name: 'Polo Shirts' })).toHaveAttribute('href', '#polo');
  });

  it('shows the help card with Get a Quote to /contact and Message us to the Messenger link', async () => {
    await renderProducts();

    const help = await helpCard();
    expect(screen.getByText('Not sure what to pick?')).toBeInTheDocument();
    expect(within(help).getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
    await vi.waitFor(() => {
      expect(within(help).getByRole('link', { name: 'Message us' })).toHaveAttribute('href', 'https://m.me/cspsdemo');
    });
  });

  it('sends Message us to /contact when no Messenger link is set', async () => {
    answerSite(siteWithoutOptionals);
    await renderProducts();

    const help = await helpCard();
    await vi.waitFor(() => {
      expect(within(help).getByRole('link', { name: 'Message us' })).toHaveAttribute('href', '/contact');
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

  it('waits for the fonts to be ready before it scrolls, so a late re-wrap cannot move the article', async () => {
    reducedMotion(false);
    let fontsReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      fontsReady = resolve;
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
    try {
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');

      await renderProducts('/products#polo');
      await screen.findAllByRole('article');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(scroll).not.toHaveBeenCalled();

      fontsReady();
      await vi.waitFor(() => {
        expect(scroll).toHaveBeenCalledTimes(1);
      });
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
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

/** The 44px pill skeletons of the loading bar (each sets its height through --sk-h). */
function pillSkeletons(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[style*="--sk-h: 44px"]')];
}

describe('ProductsPage states (CONT-02, PUB-01, UI spec P1 States)', { timeout: 20_000 }, () => {
  it('while the lines load shows six 44px pill skeletons and two article skeletons in "Loading the product lines…"', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/public/product-lines', async () => {
        await gate;
        return HttpResponse.json(demoLines);
      }),
    );

    const { container } = await renderProducts();

    expect(screen.getByText('Loading the product lines…')).toBeInTheDocument();
    expect(pillSkeletons(container)).toHaveLength(6);
    expect(container.querySelectorAll('[data-product-skeleton="article"]')).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: 'Product lines' })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    await expectNoAxeViolations(container);

    release();
    expect(await screen.findAllByRole('article')).toHaveLength(6);
    expect(container.querySelectorAll('[data-product-skeleton]')).toHaveLength(0);
    await waitFor(() => {
      expect(screen.getByText('The product lines loaded.')).toBeInTheDocument();
    });
  });

  it('a failed read shows "Couldn\'t load the product lines." with Try Again instead of the pills and articles, and keeps the help card', async () => {
    server.use(productLinesFailureHandler(500));

    const { container } = await renderProducts();

    const alert = await screen.findByRole('alert', undefined, { timeout: 10_000 });
    expect(alert).toHaveTextContent("Couldn't load the product lines.");
    expect(alert).toHaveTextContent('Check your internet connection and try again.');
    expect(screen.queryByRole('navigation', { name: 'Product lines' })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(await helpCard()).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('Try Again reads the lines again and shows them', async () => {
    server.use(productLinesFailureHandler(500));
    await renderProducts();
    const retry = await screen.findByRole('button', { name: 'Try Again' }, { timeout: 10_000 });

    server.use(productLinesHandler(demoLines));
    await userEvent.click(retry);

    expect(await screen.findAllByRole('article')).toHaveLength(6);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('with no active line shows no pill bar and the empty state with Message Us to Messenger, and keeps the help card', async () => {
    answerProductLines(noLines);

    const { container } = await renderProducts();

    const title = await screen.findByRole('heading', { level: 2, name: 'Our product list is being updated' });
    expect(
      screen.getByText("Message us on Messenger or call the shop, and we'll tell you what we can make for your team."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Product lines' })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText(/product lines, all printed/)).toBeNull();
    const empty = title.parentElement;
    expect(empty).not.toBeNull();
    await vi.waitFor(() => {
      expect(within(empty ?? container).getByRole('link', { name: 'Message Us' })).toHaveAttribute(
        'href',
        'https://m.me/cspsdemo',
      );
    });
    expect(await helpCard()).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('with no active line and no Messenger link the empty state offers Get a Quote to /contact', async () => {
    answerProductLines(noLines);
    answerSite(siteWithoutOptionals);

    await renderProducts();

    const title = await screen.findByRole('heading', { level: 2, name: 'Our product list is being updated' });
    await vi.waitFor(() => {
      expect(within(title.parentElement ?? document.body).getByRole('link', { name: 'Get a Quote' })).toHaveAttribute(
        'href',
        '/contact',
      );
    });
    expect(within(title.parentElement ?? document.body).queryByRole('link', { name: 'Message Us' })).toBeNull();
  });

  it('one line reads "One product line, ..." with the number "01 / 01"', async () => {
    answerProductLines(oneLine);

    await renderProducts();

    expect(await screen.findByText('01 / 01')).toBeInTheDocument();
    expect(screen.getByText(/^One product line, printed by full sublimation/)).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Product lines' })).getAllByRole('link')).toHaveLength(1);
  });

  it('a line with no price, no minimum and no photos shows the price prompt, the drawn jersey and the two placeholders', async () => {
    answerProductLines({
      lines: [makeLine({ key: 'polo', title: 'Polo Shirts', shortName: 'Polo', placeholderArt: 'polo' })],
    });

    await renderProducts();

    const article = await screen.findByRole('article', { name: 'Polo Shirts' });
    expect(within(article).getByText('Message us for a price')).toBeInTheDocument();
    expect(article).not.toHaveTextContent('min.');
    expect(article.querySelector('svg[viewBox="0 0 400 480"]')).not.toBeNull();
    expect(within(article).getAllByRole('img', { name: /no image yet/ })).toHaveLength(2);
  });

  it('long customize texts and a long description wrap instead of overflowing (overflow-wrap anywhere)', async () => {
    const long = 'a'.repeat(120);
    answerProductLines({
      lines: [
        makeLine({
          key: 'polo',
          title: 'Polo Shirts',
          shortName: 'Polo',
          description: 'd'.repeat(300),
          customize: { fabric: long, collar: long, cut: long, names: long, logos: long },
        }),
      ],
    });

    await renderProducts();

    const article = await screen.findByRole('article', { name: 'Polo Shirts' });
    const copy = within(article).getByText('d'.repeat(300)).parentElement;
    expect(copy?.className.split(' ')).toContain('wrap-anywhere');
    expect(within(article).getAllByText(long)).toHaveLength(5);
  });
});
