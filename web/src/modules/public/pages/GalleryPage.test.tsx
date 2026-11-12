import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /gallery (under the URL-state layout), settled once the h1 is on screen. */
async function renderGallery(path = '/gallery') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Worn on court & road.' }, { timeout: 15_000 });
  return { ...view, router };
}

describe('GalleryPage at /gallery (PUB-01, UI-SPEC G1 item 1)', { timeout: 20_000 }, () => {
  it('shows the breadcrumb "Home / Gallery" with Gallery as the current page', async () => {
    await renderGallery();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByText('Gallery')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the eyebrow "Our work", one h1 with "court & road." in the em, and the lead', async () => {
    await renderGallery();
    expect(screen.getByText('Our work')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('court & road.');
    expect(
      screen.getByText(
        'Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the page when a category is in the address (the URL-state layout is in place)', async () => {
    await renderGallery('/gallery?category=basketball');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('sets the document title the server sends', async () => {
    await renderGallery();
    expect(document.title).toBe('Our Work · Gallery · CSPS');
  });

  it('has no axe violations', async () => {
    const { container } = await renderGallery();
    await expectNoAxeViolations(container);
  });
});
