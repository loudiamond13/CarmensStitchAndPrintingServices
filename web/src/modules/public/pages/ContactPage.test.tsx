import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /contact, settled once the h1 is on screen. */
async function renderContact() {
  const router = createMemoryRouter(routes, { initialEntries: ['/contact'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: "Let's build your kit." }, { timeout: 15_000 });
  return { ...view, router };
}

describe('ContactPage at /contact (PUB-01, UI-SPEC C1 item 1, D-18)', { timeout: 20_000 }, () => {
  it('shows the breadcrumb "Home / Contact" with Contact as the current page', async () => {
    await renderContact();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByText('Contact')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the eyebrow "Get a quote", one h1 with "your kit." in the em, and the D-18 lead', async () => {
    await renderContact();
    expect(screen.getByText('Get a quote')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('your kit.');
    expect(
      screen.getByText(
        "Tell us about your team and what you need. Message us on Messenger or call the shop, and we'll reply with a mockup and price, usually the same day.",
      ),
    ).toBeInTheDocument();
  });

  it('sets the document title the server sends', async () => {
    await renderContact();
    expect(document.title).toBe('Contact Us and Get a Quote · CSPS');
  });

  it('has no axe violations', async () => {
    const { container } = await renderContact();
    await expectNoAxeViolations(container);
  });
});
