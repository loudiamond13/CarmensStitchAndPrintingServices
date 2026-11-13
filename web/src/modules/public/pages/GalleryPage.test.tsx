import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** Every tile button on the page: the pills are buttons too, so the tiles are the ones named "Open ...". */
function tiles(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: /^Open / });
}

describe('GalleryPage with the gallery read (GAL-01, D-03, WEB-10)', { timeout: 20_000 }, () => {
  it('shows all 16 demo items, with All pressed and the pill counts of the server', async () => {
    await renderGallery();

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Basketball 4 items' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens /gallery?category=basketball on the basketball tiles only, with the pill count equal to the tiles', async () => {
    await renderGallery('/gallery?category=basketball');

    await waitFor(() => {
      expect(tiles()).toHaveLength(4);
    });
    const pill = screen.getByRole('button', { name: 'Basketball 4 items' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'false');
    for (const tile of tiles()) {
      expect(tile.textContent).toContain('Basketball');
    }
  });

  it('drops an unknown category from the address with one replace once the pills are known', async () => {
    const { router } = await renderGallery('/gallery?category=bogus');

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters when a pill is pressed, writes the line to the address and leaves All out of it', async () => {
    const { router } = await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Volleyball 3 items' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(3);
    });
    expect(router.state.location.search).toBe('?category=volleyball');

    await userEvent.click(screen.getByRole('button', { name: 'All 16 items' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
    expect(router.state.location.search).toBe('');
  });
});
