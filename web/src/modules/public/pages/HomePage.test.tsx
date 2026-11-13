import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  answerHome,
  demoHome,
  demoSite,
  homeFailureHandler,
  homeHandler,
  homeNoLines,
  homeNoTestimonials,
  homeWithWork,
  putBootBlock,
  siteHandler,
  siteWithoutOptionals,
} from '@/test/publicFixtures';

/** The first card's text: it shows only once the home data is in (the loading shape has the section head but no cards). */
const FIRST_CARD_TEXT = 'Full sublimation tops and shorts, any colorway, names and numbers included.';

/** Waits for the category cards to replace their loading shape. */
async function cardsShown() {
  return screen.findByText(FIRST_CARD_TEXT, undefined, { timeout: 15_000 });
}

/** The real route tree at /, settled once the hero h1 is on screen. */
async function renderHome() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Built for the whole team.' }, { timeout: 15_000 });
  return { ...view, router };
}

describe('HomePage at / (PUB-01, UI-SPEC H1 item 1)', { timeout: 20_000 }, () => {
  it('renders inside the public layout with Home the current header link', async () => {
    await renderHome();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Home' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('has one h1, "Built for the whole team.", with "whole team." in the em', async () => {
    await renderHome();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('whole team.');
  });

  it('shows the eyebrow and the rewritten lead', async () => {
    await renderHome();
    expect(screen.getByText('Custom sublimation · Philippines')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Full-sublimation basketball, volleyball and moto jerseys: names, numbers and logos printed edge to edge. Send us your idea and we'll send back a mockup.",
      ),
    ).toBeInTheDocument();
  });

  it('takes "Get a Quote" to /contact and "View Our Work" to /gallery (D-19)', async () => {
    await renderHome();
    const main = within(screen.getByRole('main'));
    // The hero's button and the final call to action's button (11-25, a lazy part) both go to /contact.
    await screen.findByRole('heading', { level: 2, name: "Got a team? Let's suit them up." }, { timeout: 15_000 });
    const quotes = main.getAllByRole('link', { name: 'Get a Quote' });
    expect(quotes).toHaveLength(2);
    for (const quote of quotes) {
      expect(quote).toHaveAttribute('href', '/contact');
    }
    expect(main.getByRole('link', { name: 'View Our Work' })).toHaveAttribute('href', '/gallery');
  });

  it('shows the three chips', async () => {
    await renderHome();
    const main = within(screen.getByRole('main'));
    // Two chips share their words with a Why CSPS card title (an h3); the chip is the span.
    for (const chip of ['Full sublimation', 'Names & numbers', 'Team orders welcome']) {
      expect(main.getAllByText(chip).some((element) => element.tagName === 'SPAN')).toBe(true);
    }
  });

  it('sets the document title the server sends', async () => {
    await renderHome();
    expect(document.title).toBe('CSPS · Custom Team Jerseys and Tailoring');
  });

  it('has no axe violations', async () => {
    const { container } = await renderHome();
    await expectNoAxeViolations(container);
  });
});

describe('HomePage product categories (PUB-02, D-34, D-42)', { timeout: 20_000 }, () => {
  it('shows one category card per active line, each linking to its place on Products', async () => {
    await renderHome();

    await cardsShown();
    const main = within(screen.getByRole('main'));
    const cards = main.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products#'));
    expect(cards).toHaveLength(6);
    expect(cards[0]).toHaveAttribute('href', '/products#basketball');
    expect(
      main.getByText('Full sublimation tops and shorts, any colorway, names and numbers included.'),
    ).toBeInTheDocument();
  });

  it('reads the home boot block on a first visit and sends no request for it', async () => {
    let requests = 0;
    server.use(
      http.get('*/api/v1/public/home', () => {
        requests += 1;
        return HttpResponse.json(demoHome);
      }),
    );
    putBootBlock(demoSite, undefined, demoHome);

    await renderHome();

    expect(await cardsShown()).toBeVisible();
    expect(requests).toBe(0);
  });

  it('has no axe violations with the categories showing', async () => {
    const { container } = await renderHome();
    await cardsShown();

    await expectNoAxeViolations(container);
  });
});

describe('HomePage story (PUB-01, D-05, D-36, PUB-06)', { timeout: 20_000 }, () => {
  const TYPED = 'Mockups in 24 hours; production starts as soon as the downpayment is in.';
  const FALLBACK = 'Mockups come fast; production starts as soon as the downpayment is in.';

  async function renderSettled() {
    const view = await renderHome();
    await cardsShown();
    await screen.findAllByRole('figure', undefined, { timeout: 15_000 });
    return view;
  }

  it('shows the sections in the spec order, with the hero drawing hidden from assistive technology', async () => {
    const { container } = await renderSettled();

    const main = screen.getByRole('main');
    const headings = within(main)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Pick your kit.',
      'Made to move. Made to last.',
      'Idea to jersey in four steps.',
      'Teams that suit up with us.',
      "Got a team? Let's suit them up.",
    ]);
    expect(container.querySelector('svg[viewBox="0 0 400 480"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the no-promise fallback on the Fast turnaround card when no line is typed', async () => {
    await renderSettled();

    expect(within(screen.getByRole('main')).getByText(FALLBACK)).toBeInTheDocument();
  });

  it('shows the typed turnaround line as typed', async () => {
    server.use(siteHandler({ ...demoSite, turnaroundLine: TYPED }));
    await renderSettled();

    expect(await within(screen.getByRole('main')).findByText(TYPED)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText(FALLBACK)).toBeNull();
  });

  it('shows the three testimonials with their ratings', async () => {
    await renderSettled();

    const figures = within(screen.getByRole('main')).getAllByRole('figure');
    expect(figures).toHaveLength(3);
    expect(within(screen.getByRole('main')).getAllByRole('img', { name: '5 out of 5' })).toHaveLength(2);
  });

  it('takes "Message us on Messenger" to the shop link, and the final "Get a Quote" to /contact', async () => {
    await renderSettled();

    const main = within(screen.getByRole('main'));
    expect(await main.findByRole('link', { name: 'Message us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(main.getAllByRole('link', { name: 'Get a Quote' }).at(-1)).toHaveAttribute('href', '/contact');
  });

  it('leaves the Messenger button out when the shop has no link', async () => {
    server.use(siteHandler(siteWithoutOptionals));
    await renderSettled();

    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'Message us on Messenger' })).toBeNull();
  });

  it('has no axe violations on the whole page', async () => {
    const { container } = await renderSettled();

    await expectNoAxeViolations(container);
  });
});

describe('HomePage states (PUB-01, UI-SPEC H1 States, CLS)', { timeout: 20_000 }, () => {
  it('while the home data loads, the hero shows at once and the cards and testimonials hold their place in "Loading the page…"', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/public/home', async () => {
        await gate;
        return HttpResponse.json(demoHome);
      }),
    );

    const { container } = await renderHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Built for the whole team.' })).toBeVisible();
    expect(screen.getByText('Loading the page…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-home-skeleton="card"]')).toHaveLength(6);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-home-skeleton="testimonial"]')).toHaveLength(3);
    });
    for (const frame of container.querySelectorAll('[data-home-skeleton="testimonial"]')) {
      expect(frame.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(4);
    }
    expect(container.querySelectorAll('[data-home-skeleton="card"] [class~="aspect-4/5"]')).toHaveLength(6);
    expect(screen.queryByRole('figure')).toBeNull();
    await expectNoAxeViolations(container);

    release();
    await screen.findAllByRole('figure');
    expect(container.querySelectorAll('[data-home-skeleton]')).toHaveLength(0);
    await waitFor(() => {
      expect(screen.getByText('The page loaded.')).toBeInTheDocument();
    });
  });

  it('with no active line shows no categories section and keeps the rest of the page', async () => {
    answerHome(homeNoLines);

    const { container } = await renderHome();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Made to move. Made to last.' }, { timeout: 15_000 }),
    ).toBeVisible();
    // The testimonials come with the same data: once they show, the loading shape of the categories is gone.
    expect(await screen.findAllByRole('figure', undefined, { timeout: 15_000 })).toHaveLength(3);
    expect(screen.queryByRole('heading', { level: 2, name: 'Pick your kit.' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All products' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('with no shown testimonial shows no testimonials section and keeps the rest of the page', async () => {
    answerHome(homeNoTestimonials);

    const { container } = await renderHome();

    await cardsShown();
    expect(await screen.findByRole('heading', { level: 2, name: "Got a team? Let's suit them up." })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeNull();
    expect(screen.queryByRole('figure')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('a failed read shows "Couldn\'t load the product lines." with Try Again in the categories and no testimonials', async () => {
    server.use(homeFailureHandler(500));

    const { container } = await renderHome();

    const alert = await screen.findByRole('alert', undefined, { timeout: 15_000 });
    expect(alert).toHaveTextContent("Couldn't load the product lines.");
    expect(within(alert).getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeNull();
    expect(screen.queryByRole('figure')).toBeNull();
    expect(await screen.findByRole('heading', { level: 2, name: "Got a team? Let's suit them up." })).toBeVisible();
    expect(container.querySelectorAll('[data-home-skeleton]')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('Try Again reads the home data again and shows the cards and the testimonials', async () => {
    server.use(homeFailureHandler(500));
    await renderHome();
    const retry = await screen.findByRole('button', { name: 'Try Again' }, { timeout: 15_000 });

    server.use(homeHandler(demoHome));
    await userEvent.click(retry);

    await cardsShown();
    expect(await screen.findAllByRole('figure')).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('HomePage Recent work and the hero tag (D-14, PUB-01)', { timeout: 20_000 }, () => {
  async function renderWithWork() {
    answerHome(homeWithWork);
    const view = await renderHome();
    await cardsShown();
    await screen.findByRole('heading', { level: 2, name: 'Recent work.' }, { timeout: 15_000 });
    return view;
  }

  it('shows the six newest orders as tiles to their line in the Gallery, between the steps and the testimonials', async () => {
    const { container } = await renderWithWork();

    expect(container.querySelectorAll('a[href^="/gallery?category="]')).toHaveLength(6);
    const headings = within(screen.getByRole('main'))
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.slice(2, 5)).toEqual([
      'Idea to jersey in four steps.',
      'Recent work.',
      'Teams that suit up with us.',
    ]);
  });

  it('shows the hero tag with the newest order, outside the hidden drawing and not as a link', async () => {
    await renderWithWork();

    const tag = screen.getByText('Recent order').parentElement;
    expect(tag).toHaveTextContent('Brgy. Sample Ballers');
    expect(tag).toHaveTextContent('17-piece set · mockup to pickup');
    expect(tag?.closest('[aria-hidden="true"]')).toBeNull();
    expect(tag?.closest('a')).toBeNull();
  });

  it('with no shown order leaves out both the strip and the tag, and keeps the rest of the page', async () => {
    await renderHome();
    await cardsShown();
    await screen.findAllByRole('figure', undefined, { timeout: 15_000 });

    expect(screen.queryByRole('heading', { level: 2, name: 'Recent work.' })).toBeNull();
    expect(screen.queryByText('Recent order')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeInTheDocument();
  });

  it('a failed home read shows neither the strip nor the tag', async () => {
    server.use(homeFailureHandler(500));
    await renderHome();
    await screen.findByRole('alert', undefined, { timeout: 15_000 });
    await screen.findByRole('heading', { level: 2, name: "Got a team? Let's suit them up." });

    expect(screen.queryByRole('heading', { level: 2, name: 'Recent work.' })).toBeNull();
    expect(screen.queryByText('Recent order')).toBeNull();
  });

  it('while the home data loads, holds the strip in four frames', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/public/home', async () => {
        await gate;
        return HttpResponse.json(homeWithWork);
      }),
    );

    const { container } = await renderHome();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-home-skeleton="recent"]')).toHaveLength(4);
    });
    release();
    await screen.findByRole('heading', { level: 2, name: 'Recent work.' }, { timeout: 15_000 });
    expect(container.querySelectorAll('[data-home-skeleton]')).toHaveLength(0);
  });

  it("opens the Gallery filtered to a tile's line", async () => {
    const { router } = await renderWithWork();

    await userEvent.click(screen.getByRole('link', { name: 'Sample City Spikers Volleyball · 12 pcs' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/gallery');
    });
    expect(router.state.location.search).toBe('?category=volleyball');
  });

  it('has no axe violations with the strip and the tag showing', async () => {
    const { container } = await renderWithWork();

    await expectNoAxeViolations(container);
  });
});
