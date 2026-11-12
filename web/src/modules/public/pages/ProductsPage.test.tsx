import { render, screen, within } from '@testing-library/react';
import { http } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { answerProductLines, demoLines, demoSite, oneLine, putBootBlock } from '@/test/publicFixtures';

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
