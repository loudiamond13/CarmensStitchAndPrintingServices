// The Contact page when the quote form's piece cannot load (WR-02): the form place says so, and the aside (Messenger, Call, hours,
// map) stays.
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/core/routes/router';
import { collectConsole } from '@/test/consoleGuard';
import { demoSite, putBootBlock } from '@/test/publicFixtures';

vi.mock('../components/QuoteForm', () => {
  throw new Error('The piece did not load.');
});

describe('ContactPage with a quote form piece that fails to load', { timeout: 20_000 }, () => {
  afterEach(() => {
    collectConsole();
  });

  it('shows the message in the form place and keeps the Messenger and Call buttons', async () => {
    putBootBlock(demoSite);
    const router = createMemoryRouter(routes, { initialEntries: ['/contact'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: "Let's build your kit." }, { timeout: 15_000 });

    const alert = await screen.findByText("Couldn't load the inquiry form.", {}, { timeout: 15_000 });

    expect(alert).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /^Message us on Messenger/ })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(await within(main).findByRole('link', { name: 'Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM' })).toHaveAttribute(
      'href',
      'tel:+639171234567',
    );
    expect(within(main).getByRole('heading', { level: 2, name: 'Call or text' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
