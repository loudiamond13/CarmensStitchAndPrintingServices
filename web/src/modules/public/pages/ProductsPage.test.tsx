import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /products, settled once the page's h1 is on screen (the lazy chunks load on first use). */
async function renderProducts() {
  const router = createMemoryRouter(routes, { initialEntries: ['/products'] });
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
    await expectNoAxeViolations(container);
  });
});
