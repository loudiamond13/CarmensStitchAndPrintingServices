import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
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
import { answerQuote } from '@/test/quoteFixtures';

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

  it('shows the eyebrow "Get a quote", one h1 with "your kit." in the em, and the lead (App. E.4, comma for the long dash)', async () => {
    await renderContact();
    expect(screen.getByText('Get a quote')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('your kit.');
    expect(
      screen.getByText(
        'Tell us about your team and what you need. We reply with a mockup and price, usually the same day. Faster? Message us on Messenger.',
      ),
    ).toBeInTheDocument();
  });

  it('sets the document title the server sends', async () => {
    await renderContact();
    expect(document.title).toBe('Contact Us and Get a Quote · CSPS');
  });
});

describe('ContactPage content from the stored facts (PUB-02, PUB-06, D-18, D-20, D-25)', { timeout: 20_000 }, () => {
  it('shows the two big buttons, Call or text and the map card, with no email or "@" anywhere on the page', async () => {
    putBootBlock(demoSite);
    const { container } = await renderContact();
    const main = screen.getByRole('main');

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

    expect(await screen.findByRole('link', { name: /^Message us on Messenger/ })).toBeInTheDocument();
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
  it('puts the hours card after the two big buttons in the aside, with the server status and the weekly rows', async () => {
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
    ).toEqual(['Inquiry form', 'Business hours', 'Call or text']);
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
  it('while the facts load, shows the form at once, the aside skeletons, the loading line and no sticky bar', async () => {
    server.use(
      http.get('*/api/v1/public/site', async () => {
        await delay('infinite');
      }),
    );
    const { container } = await renderContact();

    expect(await screen.findByRole('form', { name: 'Inquiry form' })).toBeInTheDocument();
    const aside = screen.getByRole('complementary');
    expect(within(aside).getByRole('status')).toHaveTextContent('Loading our contact details…');
    expect(screen.queryByRole('link', { name: 'Call us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Messenger/ })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  // SPEC-DEVIATION: SETTINGS-FAIL only the aside shows the error; a lead is never lost to a settings read.
  it('when the read fails, only the aside shows "Couldn\'t load our contact details." with Try Again; the form stays', async () => {
    server.use(siteFailureHandler(404));
    const { container } = await renderContact();

    const alert = await screen.findByRole('alert');
    expect(screen.getByRole('complementary')).toContainElement(alert);
    expect(within(alert).getByText("Couldn't load our contact details.")).toBeInTheDocument();
    expect(within(alert).getByText('Check your internet connection and try again.')).toBeInTheDocument();
    expect(await screen.findByRole('form', { name: 'Inquiry form' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call us' })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('when the read fails, the form still sends the inquiry and shows Inquiry sent', async () => {
    server.use(siteFailureHandler(404));
    const probe = answerQuote();
    await renderContact();
    await screen.findByRole('alert');

    await userEvent.type(await screen.findByRole('textbox', { name: /Your name/ }), 'Juan Dela Cruz');
    await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), '0917 123 4567');
    await userEvent.click(screen.getByRole('button', { name: 'Send Inquiry' }));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' }, { timeout: 8_000 });
    expect(probe.creates).toHaveLength(1);
  });

  it('Try Again reads the facts again and shows the aside', async () => {
    server.use(siteFailureHandler(404));
    await renderContact();
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    server.use(siteHandler(demoSite));

    await userEvent.click(retry);

    expect(await screen.findByRole('link', { name: /^Message us on Messenger/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ContactPage layout (UI-SPEC Q1, App. E.4, Edge INQ-08 empty)', { timeout: 20_000 }, () => {
  it('puts the form card first and the aside after it, with the two big buttons leading the aside and no "What to send"', async () => {
    putBootBlock(demoSite);
    await renderContact();
    const form = await screen.findByRole('form', { name: 'Inquiry form' });
    const aside = screen.getByRole('complementary');

    expect(form.compareDocumentPosition(aside)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const messenger = within(aside).getByRole('link', { name: /^Message us on Messenger/ });
    const hours = await within(aside).findByRole('heading', { level: 2, name: 'Business hours' });
    expect(messenger.compareDocumentPosition(hours)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(aside).getAllByRole('link', { name: /^Call 0917 123 4567/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('What to send')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Message us' })).not.toBeInTheDocument();
  });

  it('shows the notice and the whole form even when the shop settings fail to load', async () => {
    server.use(siteFailureHandler(404));
    await renderContact();

    const form = await screen.findByRole('form', { name: 'Inquiry form' });
    expect(within(form).getByText(/We keep requests that don't become orders for 6 months\./)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Send Inquiry' })).toBeInTheDocument();
  });

  it('leaves the Messenger button out of the aside when no Messenger link is set', async () => {
    server.use(siteHandler({ ...demoSite, messengerUrl: null }));
    await renderContact();

    expect((await screen.findAllByRole('link', { name: /^Call 0917 123 4567/ })).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('link', { name: /^Message us on Messenger/ })).not.toBeInTheDocument();
  });
});

describe('ContactPage header "Get a Quote" while on /contact (UI-SPEC Q1)', { timeout: 20_000 }, () => {
  it('scrolls the form into view and focuses "Your name"', async () => {
    const { router } = await renderContact();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    await screen.findByRole('form', { name: 'Inquiry form' });

    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Get a Quote' }));

    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(router.state.location.pathname).toBe('/contact');
    scroll.mockRestore();
  });

  it('scrolls without smooth motion under reduced motion', async () => {
    const media = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    try {
      await renderContact();
      const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
      await screen.findByRole('form', { name: 'Inquiry form' });

      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Get a Quote' }));

      expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      scroll.mockRestore();
    } finally {
      media.mockRestore();
    }
  });
});
