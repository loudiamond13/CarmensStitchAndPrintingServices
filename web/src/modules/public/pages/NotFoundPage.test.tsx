import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at an unknown public path, settled once the 404 h1 is on screen. */
async function renderNotFound(path = '/nope') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Out of bounds.' }, { timeout: 15_000 });
  return { ...view, router };
}

describe('NotFoundPage at an unknown public path (PUB-01, UI-SPEC N1)', { timeout: 20_000 }, () => {
  it('shows the eyebrow, the h1 with "bounds." in the em, and the lead', async () => {
    await renderNotFound();
    expect(screen.getByText('Error 404')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('bounds.');
    expect(screen.getByText("We couldn't find that page. The link may be old or mistyped.")).toBeInTheDocument();
  });

  it('offers "Go to Home" to / and "View Our Work" to /gallery in the page', async () => {
    await renderNotFound();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
    expect(main.getByRole('link', { name: 'View Our Work' })).toHaveAttribute('href', '/gallery');
  });

  it('sits inside the public layout with no header link current', async () => {
    const { container } = await renderNotFound('/some/unknown/path');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(container.querySelectorAll('header [aria-current="page"]')).toHaveLength(0);
  });

  it('never echoes the path into the page (T-11-17)', async () => {
    const { container } = await renderNotFound('/zz-secret-path');
    expect(container.textContent).not.toContain('zz-secret-path');
  });

  it('sets the 404 document title the server sends', async () => {
    await renderNotFound();
    expect(document.title).toBe('Page Not Found · CSPS');
  });

  it('has no axe violations', async () => {
    const { container } = await renderNotFound();
    await expectNoAxeViolations(container);
  });
});
