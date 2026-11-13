// The Contact parts (UI-SPEC C1; PUB-02, PUB-06, D-17, D-18, D-20, D-23): ContactNowCard, BigContactButton, PhoneListCard,
// MapCard and ContactBar, each from the stored shop facts.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { closedWeek, demoSite, mixedWeek, siteWithoutOptionals, siteWithThreePhones } from '@/test/publicFixtures';
import { BigContactButton } from './BigContactButton';
import CallHoursNote from './CallHoursNote';
import { ContactBar } from './ContactBar';
import { ContactNowCard } from './ContactNowCard';
import { MapCard } from './MapCard';
import { PhoneListCard } from './PhoneListCard';

// The Call button's hours line loads as a lazy chunk. The spy lets a test wait until it has rendered before it asserts the line is absent.
vi.mock('./CallHoursNote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CallHoursNote')>();
  return { ...actual, default: vi.fn(actual.default) };
});

function inRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('BigContactButton', () => {
  it('is one link with the icon tile, the strong line, the note and the go arrow', () => {
    inRouter(
      <BigContactButton
        tone="primary"
        href="https://m.me/cspsdemo"
        icon="message-circle"
        title="Message us"
        note="Fast"
      />,
    );

    const link = screen.getByRole('link', { name: 'Message us Fast' });
    expect(link).toHaveAttribute('href', 'https://m.me/cspsdemo');
    expect(link).not.toHaveAttribute('target');
    expect(within(link).getByText('Message us').tagName).toBe('STRONG');
    expect(link.querySelectorAll('svg')).toHaveLength(2);
  });

  it('leaves the note out when there is none', () => {
    inRouter(<BigContactButton tone="outline" href="tel:+639171234567" icon="phone" title="Call 0917 123 4567" />);

    expect(screen.getByRole('link', { name: 'Call 0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });
});

describe('ContactNowCard (D-18)', () => {
  it('shows "Message us", the intro, both big buttons and "What to send" with its three rows', () => {
    inRouter(<ContactNowCard site={demoSite} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    expect(screen.getByText('The fastest way to get a mockup and a price.')).toBeInTheDocument();
    const messenger = screen.getByRole('link', { name: /^Message us on Messenger/ });
    expect(messenger).toHaveAttribute('href', 'https://m.me/cspsdemo');
    expect(messenger).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: /^Call 0917 123 4567/ })).toHaveAttribute('href', 'tel:+639171234567');
    expect(screen.getByRole('heading', { level: 3, name: 'What to send' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Your team or group name',
      'What you need and about how many pieces',
      'Your design, logo or a rough idea. A phone photo is fine.',
    ]);
  });

  it('leaves out the Messenger button when no Messenger link is set', () => {
    inRouter(<ContactNowCard site={siteWithoutOptionals} />);

    expect(screen.queryByRole('link', { name: /Messenger/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call 0917 123 4567' })).toBeInTheDocument();
  });

  it('shows two skeleton blocks in place of the buttons while the facts load', () => {
    const { container } = inRouter(<ContactNowCard site={undefined} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Message us' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('adds the open days to the Call button as a second line', async () => {
    inRouter(<ContactNowCard site={demoSite} />);

    expect(await screen.findByRole('link', { name: 'Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM' })).toHaveAttribute(
      'href',
      'tel:+639171234567',
    );
  });

  it('joins mixed hours with a semicolon on the Call button', async () => {
    inRouter(<ContactNowCard site={{ ...demoSite, hours: mixedWeek }} />);

    expect(
      await screen.findByRole('link', {
        name: 'Call 0917 123 4567 Mon-Fri, 9:00 AM - 6:00 PM; Sat, 9:00 AM - 5:00 PM',
      }),
    ).toBeInTheDocument();
  });

  it('leaves the second line out of the Call button when no day is open', async () => {
    vi.mocked(CallHoursNote).mockClear();
    inRouter(<ContactNowCard site={{ ...demoSite, hours: closedWeek }} />);

    await waitFor(() => {
      expect(vi.mocked(CallHoursNote)).toHaveBeenCalled();
    });
    expect(vi.mocked(CallHoursNote).mock.results.at(-1)?.value).toBeNull();
    expect(screen.getByRole('link', { name: 'Call 0917 123 4567' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = inRouter(<ContactNowCard site={demoSite} />);
    await screen.findByRole('link', { name: 'Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM' });

    await expectNoAxeViolations(container);
  });
});

describe('PhoneListCard (zero, one, many)', () => {
  it('is not rendered with one number', () => {
    const { container } = inRouter(<PhoneListCard phones={siteWithoutOptionals.phones} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists every number with the main first, a Main badge, and names each link "Call {number}{, label}"', () => {
    inRouter(<PhoneListCard phones={siteWithThreePhones.phones} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Call or text' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Call 0917 123 4567',
      'Call 02 8123 4567',
      'Call 0918 765 4321, Globe',
    ]);
    expect(links[0]).toHaveAttribute('href', 'tel:+639171234567');
    expect(links[2]).toHaveAttribute('href', 'tel:+639187654321');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Main');
    expect(rows[2]).toHaveTextContent('Globe');
    expect(screen.getAllByText('Main')).toHaveLength(1);
  });

  it('has no axe violations', async () => {
    const { container } = inRouter(<PhoneListCard phones={siteWithThreePhones.phones} />);

    await expectNoAxeViolations(container);
  });
});

describe('MapCard (D-20)', () => {
  it('before the tap shows the drawn map, the shop name, the address and Show Map, and no iframe', () => {
    const { container } = inRouter(<MapCard site={demoSite} />);

    expect(screen.getByRole('img', { name: 'Map placeholder showing the shop location' })).toBeInTheDocument();
    expect(screen.getByText('CSPS Shop')).toBeInTheDocument();
    expect(screen.getByText('12 Sample St., Poblacion, Sample City')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Map' })).toBeInTheDocument();
    expect(screen.getByText('The map loads from Google when you tap Show Map.')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('after the tap loads the stored embed link in a titled, lazy iframe with a strict referrer and no allow features', async () => {
    const { container } = inRouter(<MapCard site={demoSite} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show Map' }));

    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute('src', 'https://www.google.com/maps/embed?pb=cspsdemo');
    expect(frame).toHaveAttribute('title', 'Map of Sample Shop');
    expect(frame).toHaveAttribute('loading', 'lazy');
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(frame).not.toHaveAttribute('allow');
    expect(frame).toHaveFocus();
    expect(screen.queryByText('The map loads from Google when you tap Show Map.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Map' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Map placeholder showing the shop location' })).not.toBeInTheDocument();
    expect(screen.getByText('CSPS Shop')).toBeInTheDocument();
  });

  it('keeps the frame box at 16:10 before and after the tap', async () => {
    const { container } = inRouter(<MapCard site={demoSite} />);
    const box = () => container.querySelector('[data-map-box]');
    expect(box()?.className).toContain('aspect-[16/10]');

    await userEvent.click(screen.getByRole('button', { name: 'Show Map' }));

    expect(box()?.className).toContain('aspect-[16/10]');
  });

  it('opens Directions in a new tab with rel noopener noreferrer and a hidden note', () => {
    inRouter(<MapCard site={demoSite} />);

    const link = screen.getByRole('link', { name: /^Directions\s*\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/cspsdemo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('with no embed link offers no Show Map and no privacy line, but keeps the drawn map and Directions', () => {
    inRouter(<MapCard site={{ ...demoSite, mapEmbedUrl: null }} />);

    expect(screen.queryByRole('button', { name: 'Show Map' })).not.toBeInTheDocument();
    expect(screen.queryByText(/loads from Google/)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Map placeholder showing the shop location' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Directions/ })).toBeInTheDocument();
  });

  it('with no directions link shows no Directions', () => {
    inRouter(<MapCard site={{ ...demoSite, directionsUrl: null }} />);

    expect(screen.queryByRole('link', { name: /Directions/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Map' })).toBeInTheDocument();
  });

  it('with no embed, no directions and no address is not rendered', () => {
    const { container } = inRouter(
      <MapCard
        site={{
          ...siteWithoutOptionals,
          address: { street: null, townOrCity: null, province: null, postalCode: null },
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('while the facts load shows the drawn map at once with a skeleton line for the address', () => {
    inRouter(<MapCard site={undefined} />);

    expect(screen.getByRole('img', { name: 'Map placeholder showing the shop location' })).toBeInTheDocument();
    expect(screen.getByText('CSPS Shop')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no axe violations before and after the tap', async () => {
    const { container } = inRouter(<MapCard site={demoSite} />);
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Show Map' }));

    // jsdom has no frame to talk to, so axe checks the card without the frame; the frame's title is asserted above and the
    // Playwright page check runs axe over the real frame.
    container.querySelector('iframe')?.remove();
    await expectNoAxeViolations(container);
  });
});

describe('ContactBar (PUB-06)', () => {
  it('shows "Messenger" to the m.me link in the same tab and "Call us" to the main number', () => {
    inRouter(<ContactBar site={demoSite} />);

    const messenger = screen.getByRole('link', { name: 'Messenger' });
    expect(messenger).toHaveAttribute('href', 'https://m.me/cspsdemo');
    expect(messenger).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'Call us' })).toHaveAttribute('href', 'tel:+639171234567');
  });

  it('shows only the phone-width classes: hidden above 767px, a grid at 767px and below', () => {
    const { container } = inRouter(<ContactBar site={demoSite} />);

    const bar = container.firstElementChild;
    expect(bar?.className).toContain('hidden');
    expect(bar?.className).toContain('pg-phone:grid');
  });

  it('without a Messenger link lets "Call us" fill the bar', () => {
    const { container } = inRouter(<ContactBar site={siteWithoutOptionals} />);

    expect(screen.queryByRole('link', { name: 'Messenger' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call us' })).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('pg-phone:grid-cols-1');
  });

  it('is not rendered while the facts load or when there is nothing to offer', () => {
    const loading = inRouter(<ContactBar site={undefined} />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    const empty = inRouter(<ContactBar site={{ ...siteWithoutOptionals, phones: [] }} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it('has no axe violations', async () => {
    const { container } = inRouter(<ContactBar site={demoSite} />);

    await expectNoAxeViolations(container);
  });
});
