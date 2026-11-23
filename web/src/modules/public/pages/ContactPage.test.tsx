import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  answerOpenStatus,
  demoSite,
  openStatusAt0900,
  openStatusFailureHandler,
  putBootBlock,
  siteFailureHandler,
  siteHandler,
  siteWithThreePhones,
} from '@/test/publicFixtures';

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
});

describe('ContactPage content from the stored facts (PUB-02, PUB-06, D-18, D-20, D-25)', { timeout: 20_000 }, () => {
  it('shows the Message us card, Call or text and the map card, with no email or "@" anywhere on the page', async () => {
    putBootBlock(demoSite);
    const { container } = await renderContact();
    const main = screen.getByRole('main');

    expect(within(main).getByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: /^Message us on Messenger/ })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(
      await within(main).findByRole('link', { name: 'Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM' }),
    ).toHaveAttribute('href', 'tel:+639171234567');
    expect(within(main).getByRole('heading', { level: 2, name: 'Call or text' })).toBeInTheDocument();
    expect(within(main).getByRole('img', { name: 'Map placeholder showing the shop location' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('@');
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('shows the sticky bar with Messenger and Call us once the facts are in', async () => {
    putBootBlock(demoSite);
    await renderContact();

    const bar = await screen.findByRole('link', { name: 'Call us' });
    expect(bar).toHaveAttribute('href', 'tel:+639171234567');
    expect(screen.getByRole('link', { name: 'Messenger' })).toHaveAttribute('href', 'https://m.me/cspsdemo');
  });

  it('lists three numbers in Call or text', async () => {
    server.use(siteHandler(siteWithThreePhones));
    await renderContact();

    expect(await screen.findByRole('link', { name: 'Call 0918 765 4321, Globe' })).toBeInTheDocument();
  });

  it('loads the facts from the API when the page carries no boot block', async () => {
    await renderContact();

    expect(await screen.findByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Call us' })).toBeInTheDocument();
  });

  it('has no axe violations when populated', async () => {
    putBootBlock(demoSite);
    const { container } = await renderContact();
    await screen.findByText('Open now');

    await expectNoAxeViolations(container);
  });
});

describe('ContactPage hours and open status (PUB-05, D-21, D-22)', { timeout: 20_000 }, () => {
  it('puts the hours card first in the aside, with the server status and the weekly rows', async () => {
    putBootBlock(demoSite);
    answerOpenStatus(openStatusAt0900);
    await renderContact();
    const main = screen.getByRole('main');

    expect(await within(main).findByText('Open now')).toBeInTheDocument();
    expect(within(main).getByText('Closes 6:00 PM.')).toBeInTheDocument();
    await within(main).findByRole('heading', { level: 2, name: 'Inquiry form' });
    expect(
      within(main)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Inquiry form', 'Message us', 'Business hours', 'Call or text']);
    expect(within(main).getByText('Monday to Saturday')).toBeInTheDocument();
  });

  it('keeps the hours rows and leaves the pill and line out when the status read fails', async () => {
    putBootBlock(demoSite);
    server.use(openStatusFailureHandler(404));
    await renderContact();
    const main = screen.getByRole('main');

    expect(await within(main).findByRole('heading', { level: 2, name: 'Business hours' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(main).getByText('Monday to Saturday')).toBeInTheDocument();
    });
    expect(within(main).queryByText('Open now')).not.toBeInTheDocument();
    expect(within(main).queryByText('Closed now')).not.toBeInTheDocument();
  });
});

describe('ContactPage loading and failure (UI states)', { timeout: 20_000 }, () => {
  it('while the facts load, shows the card title, the skeletons, the loading line and no sticky bar', async () => {
    server.use(
      http.get('*/api/v1/public/site', async () => {
        await delay('infinite');
      }),
    );
    const { container } = await renderContact();

    expect(screen.getByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading our contact details…');
    expect(screen.queryByRole('link', { name: 'Call us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Messenger/ })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('when the read fails, shows "Couldn\'t load our contact details." with Try Again and no sticky bar', async () => {
    server.use(siteFailureHandler(404));
    const { container } = await renderContact();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't load our contact details.")).toBeInTheDocument();
    expect(within(alert).getByText('Check your internet connection and try again.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Message us' })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('Try Again reads the facts again and shows the page', async () => {
    server.use(siteFailureHandler(404));
    await renderContact();
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    server.use(siteHandler(demoSite));

    await userEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
