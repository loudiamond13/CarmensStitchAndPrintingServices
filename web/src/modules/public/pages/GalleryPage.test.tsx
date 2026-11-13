import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  answerGallery,
  demoGallery,
  emptyGallery,
  galleryFailureHandler,
  galleryHandler,
  largeGallery,
} from '@/test/publicFixtures';

/** The real route tree at /gallery (under the URL-state layout), settled once the h1 is on screen. */
async function renderGallery(path = '/gallery') {
  // nuqs writes the browser history directly, so the address is read from window.location (L-16).
  window.history.replaceState(null, '', path);
  const router = createBrowserRouter(routes);
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
    await renderGallery('/gallery?category=bogus');

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters when a pill is pressed, writes the line to the address and leaves All out of it', async () => {
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Volleyball 3 items' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(3);
    });
    expect(window.location.search).toBe('?category=volleyball');

    await userEvent.click(screen.getByRole('button', { name: 'All 16 items' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
    expect(window.location.search).toBe('');
  });
});

/** The gallery requests the page has made, counted by a handler that answers `gallery`. */
function countGalleryRequests(gallery: typeof largeGallery): { readonly count: () => number } {
  let requests = 0;
  server.use(
    http.get('*/api/v1/public/gallery', () => {
      requests += 1;
      return HttpResponse.json(gallery);
    }),
  );
  return { count: () => requests };
}

describe('GalleryPage Show More, states and the quote link (GAL-01, D-32)', { timeout: 30_000 }, () => {
  it('draws the first 24 tiles, adds 24 more with Show More Photos with no request, and focuses the first new tile', async () => {
    answerGallery(largeGallery);
    const requests = countGalleryRequests(largeGallery);
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(24);
    });
    const before = requests.count();

    await userEvent.click(screen.getByRole('button', { name: 'Show More Photos' }));

    expect(tiles()).toHaveLength(48);
    expect(tiles()[24]).toHaveFocus();
    expect(requests.count()).toBe(before);
  });

  it('removes Show More Photos once every tile is shown', async () => {
    answerGallery(largeGallery);
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(24);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Show More Photos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show More Photos' }));

    expect(tiles()).toHaveLength(60);
    expect(tiles()[48]).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Show More Photos' })).toBeNull();
  });

  it('does not offer Show More Photos when 24 or fewer tiles are in the gallery', async () => {
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });

    expect(screen.queryByRole('button', { name: 'Show More Photos' })).toBeNull();
  });

  it('starts again at 24 tiles when another category is chosen', async () => {
    answerGallery(largeGallery);
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(24);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Show More Photos' }));
    expect(tiles()).toHaveLength(48);

    await userEvent.click(screen.getByRole('button', { name: 'Basketball 40 items' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(24);
    });
  });

  it('shows "Want one like these? Get a Quote" linking to /contact under the tiles', async () => {
    await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });

    expect(screen.getByRole('link', { name: 'Want one like these? Get a Quote' })).toHaveAttribute('href', '/contact');
  });

  it('with nothing shown has no pills, and the empty state "No photos yet" with Get a Quote', async () => {
    answerGallery(emptyGallery);
    await renderGallery();

    expect(await screen.findByRole('heading', { name: 'No photos yet' })).toBeInTheDocument();
    expect(screen.getByText('Photos of our latest team orders show here soon.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Want one like these? Get a Quote' })).toBeNull();
  });

  it('while loading shows 7 pill and 8 tile skeletons in a region that says "Loading the gallery…"', async () => {
    server.use(
      http.get('*/api/v1/public/gallery', async () => {
        await delay('infinite');
        return HttpResponse.json(demoGallery);
      }),
    );
    const { container } = await renderGallery();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-gallery-skeleton="pill"]')).toHaveLength(7);
    });
    expect(container.querySelectorAll('[data-gallery-skeleton="tile"]')).toHaveLength(8);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the gallery…');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('draws the loading tiles at 4 / 5, 1 / 1, 3 / 4 and 4 / 3 in turn', async () => {
    server.use(
      http.get('*/api/v1/public/gallery', async () => {
        await delay('infinite');
        return HttpResponse.json(demoGallery);
      }),
    );
    const { container } = await renderGallery();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-gallery-skeleton="tile"]')).toHaveLength(8);
    });
    const classes = [...container.querySelectorAll('[data-gallery-skeleton="tile"]')].map((tile) => tile.className);
    expect(classes.map((value) => /aspect-(4\/5|square|3\/4|4\/3)/.exec(value)?.[1])).toEqual([
      '4/5',
      'square',
      '3/4',
      '4/3',
      '4/5',
      'square',
      '3/4',
      '4/3',
    ]);
  });

  it('on a failed read shows "Couldn\'t load the gallery." with Try Again, no pills, and loads on retry', async () => {
    server.use(galleryFailureHandler(500));
    await renderGallery();

    expect(await screen.findByText("Couldn't load the gallery.")).toBeInTheDocument();
    expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(tiles()).toHaveLength(0);

    server.use(galleryHandler(demoGallery));
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(tiles()).toHaveLength(16);
    });
  });

  it('has no axe violations in the error, empty and populated states', async () => {
    server.use(galleryFailureHandler(500));
    const failed = await renderGallery();
    await screen.findByText("Couldn't load the gallery.");
    await expectNoAxeViolations(failed.container);
    failed.unmount();

    answerGallery(emptyGallery);
    const empty = await renderGallery();
    await screen.findByRole('heading', { name: 'No photos yet' });
    await expectNoAxeViolations(empty.container);
    empty.unmount();

    answerGallery(largeGallery);
    const populated = await renderGallery();
    await waitFor(() => {
      expect(tiles()).toHaveLength(24);
    });
    await expectNoAxeViolations(populated.container);
  });
});
