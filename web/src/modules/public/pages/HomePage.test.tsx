import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { demoHome, demoSite, putBootBlock } from '@/test/publicFixtures';

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
    expect(main.getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
    expect(main.getByRole('link', { name: 'View Our Work' })).toHaveAttribute('href', '/gallery');
  });

  it('shows the three chips', async () => {
    await renderHome();
    const main = within(screen.getByRole('main'));
    for (const chip of ['Full sublimation', 'Names & numbers', 'Team orders welcome']) {
      expect(main.getByText(chip)).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { level: 2, name: 'Pick your kit.' }, { timeout: 15_000 })).toBeVisible();
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

    expect(await screen.findByRole('heading', { level: 2, name: 'Pick your kit.' })).toBeVisible();
    expect(requests).toBe(0);
  });

  it('has no axe violations with the categories showing', async () => {
    const { container } = await renderHome();
    await screen.findByRole('heading', { level: 2, name: 'Pick your kit.' }, { timeout: 15_000 });

    await expectNoAxeViolations(container);
  });
});
