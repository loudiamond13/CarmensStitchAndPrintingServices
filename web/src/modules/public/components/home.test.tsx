// The Home page parts (UI-SPEC H1, App. E.1; PUB-01, PUB-02, CONT-03, D-34, D-36): the category grid, the hero drawing,
// Why CSPS, the testimonial row and the final call to action.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import {
  demoHome,
  demoRecentWork,
  homeOneLine,
  makeHomeLine,
  makeLine,
  makeRecentWork,
  makeTestimonial,
  photoFor,
} from '@/test/publicFixtures';
import { CategoryGrid } from './CategoryGrid';
import { FinalCta } from './FinalCta';
import { HeroArt } from './HeroArt';
import { HeroTag } from './HeroTag';
import { HowOrdering } from './HowOrdering';
import { RecentWorkSkeletons, RecentWorkStrip } from './RecentWorkStrip';
import { TestimonialRow } from './TestimonialRow';
import { WhyCsps } from './WhyCsps';

describe('CategoryGrid (PUB-02, D-34)', () => {
  function renderGrid(lines = demoHome.lines) {
    return render(
      <MemoryRouter>
        <CategoryGrid lines={lines} />
      </MemoryRouter>,
    );
  }

  it('shows the eyebrow, the h2 "Pick your kit." and the lead with the line count in words', () => {
    renderGrid();

    expect(screen.getByText('What we make')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Pick your kit.' });
    expect(heading.querySelector('em')).toHaveTextContent('kit.');
    expect(
      screen.getByText('Six ways to suit up, every one fully customizable, from fabric to the last digit on the back.'),
    ).toBeInTheDocument();
  });

  it('with one line the lead reads "One way to suit up, ..."', () => {
    renderGrid(homeOneLine.lines);

    expect(
      screen.getByText('One way to suit up, fully customizable, from fabric to the last digit on the back.'),
    ).toBeInTheDocument();
  });

  it('has the "All products" link to /products', () => {
    renderGrid();

    expect(screen.getByRole('link', { name: 'All products' })).toHaveAttribute('href', '/products');
  });

  it('shows one card per line in order with the title, the card text and the number, each linking to /products#key', () => {
    renderGrid();

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Basketball Jerseys',
      'Volleyball Jerseys',
      'Moto Riding Jerseys',
      'Long Sleeves',
      'Polo Shirts',
      'Custom Designs',
    ]);
    const cards = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products#'));
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/products#basketball',
      '/products#volleyball',
      '/products#moto',
      '/products#longsleeves',
      '/products#polo',
      '/products#custom',
    ]);
    const first = within(screen.getByRole('link', { name: /Basketball Jerseys/ }));
    expect(
      first.getByText('Full sublimation tops and shorts, any colorway, names and numbers included.'),
    ).toBeInTheDocument();
    expect(first.getByRole('img', { name: 'No image yet' })).toHaveTextContent('23');
  });

  it('draws the Main photo of a line that has one, with its own srcSet, and the placeholder for the others', () => {
    const photo = photoFor('card');
    const lines = [
      makeHomeLine(makeLine({ key: 'basketball', title: 'Basketball Jerseys', number: '23' }), { cardPhoto: photo }),
      makeHomeLine(makeLine({ key: 'polo', title: 'Polo Shirts', number: '03' })),
    ];
    const { container } = renderGrid(lines);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('srcset')).toBe(photo.srcSet);
    expect(screen.getAllByRole('img', { name: 'No image yet' })).toHaveLength(1);
  });

  it('sends a line whose key is not a safe key to /products instead of building an address from it', () => {
    renderGrid([makeHomeLine(makeLine({ key: 'basketball' }), { key: 'Bad Key' })]);

    expect(screen.getByRole('link', { name: /Sample Jerseys/ })).toHaveAttribute('href', '/products');
  });

  it('has no axe violations', async () => {
    const { container } = renderGrid();

    await expectNoAxeViolations(container);
  });
});

describe('HeroArt (App. E.1, decorative)', () => {
  it('is hidden from assistive technology, carries no style attribute and draws the jersey and its number', () => {
    const { container } = render(<HeroArt />);

    const art = container.firstElementChild;
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[style]')).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 400 480');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(3);
    expect(container.textContent).toContain('23');
    expect(container.textContent).toContain('SAN ROQUE');
  });

  it('has no axe violations', async () => {
    const { container } = render(<HeroArt />);

    await expectNoAxeViolations(container);
  });
});

describe('WhyCsps (UI-SPEC H1 item 3, D-36)', () => {
  const TYPED = 'Mockups in 24 hours; production starts as soon as the downpayment is in.';
  const FALLBACK = 'Mockups come fast; production starts as soon as the downpayment is in.';

  it('shows the eyebrow and the h2 "Made to move. Made to last." with "move." in the em', () => {
    render(<WhyCsps turnaroundLine={null} />);

    expect(screen.getByText('Why CSPS')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Made to move. Made to last.' });
    expect(heading.querySelector('em')).toHaveTextContent('move.');
  });

  it('shows the four fixed cards with their icons and the OR-4 texts, then the turnaround card', () => {
    const { container } = render(<WhyCsps turnaroundLine={null} />);

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Full sublimation',
      'Names & numbers',
      'Team orders',
      'Quality stitching',
      'Fast turnaround',
    ]);
    expect(
      screen.getByText('Ink is dyed into the fabric, not printed on top. No cracking, peeling or fading after washes.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Every piece personalized. Send the lineup and sizes; we handle the layout.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('From a five-player barkada to a full liga, kids to 4XL, in one order.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Reinforced seams and clean hems, finished in-house by our tailoring team.'),
    ).toBeInTheDocument();
    for (const icon of ['printer', 'shirt', 'users', 'scissors', 'clock']) {
      expect(container.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
    }
  });

  it('shows the Business Info turnaround line exactly as typed', () => {
    render(<WhyCsps turnaroundLine={TYPED} />);

    expect(screen.getByText(TYPED)).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK)).toBeNull();
  });

  it.each([null, '', '   '])('shows the no-promise fallback when the line is %j', (line) => {
    render(<WhyCsps turnaroundLine={line} />);

    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
    expect(screen.queryByText(/\[|\]/)).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<WhyCsps turnaroundLine={TYPED} />);

    await expectNoAxeViolations(container);
  });
});

describe('HowOrdering (UI-SPEC H1 item 4)', () => {
  it('shows the eyebrow, the h2 and the four approved steps in order', () => {
    render(<HowOrdering />);

    expect(screen.getByText('How ordering works')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Idea to jersey in four steps.' });
    expect(heading.querySelector('em')).toHaveTextContent('four steps.');
    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Send your design',
      'Approve the mockup',
      'Downpayment & production',
      'Pickup or delivery',
    ]);
    expect(
      screen.getByText('Pay the downpayment via GCash, Maya or bank transfer and we start printing.'),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<HowOrdering />);

    await expectNoAxeViolations(container);
  });
});

function setPhoneWidth(isPhone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: isPhone && query.includes('767px'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  setPhoneWidth(false);
});

describe('TestimonialRow (UI-SPEC H1 item 6, D-05, CONT-03)', () => {
  it('shows the eyebrow, the h2 and one card per testimonial with the quote, the name, the team and the stars', () => {
    render(<TestimonialRow testimonials={demoHome.testimonials} />);

    expect(screen.getByText('From the court and the road')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' });
    expect(heading.querySelector('em')).toHaveTextContent('suit up');
    const figures = screen.getAllByRole('figure');
    expect(figures).toHaveLength(3);
    expect(figures[0]).toHaveTextContent('Seventeen pieces, names and numbers perfect.');
    expect(figures[0]).toHaveTextContent('Juan Dela Cruz');
    expect(figures[0]).toHaveTextContent('Captain, Brgy. Sample Ballers');
    expect(screen.getAllByRole('img', { name: '5 out of 5' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: '4 out of 5' })).toHaveLength(1);
  });

  it('shows two testimonials with the same name and quote as two cards, with no duplicate key', () => {
    const twin = makeTestimonial({ name: 'Dan Cruz', quote: 'Same words.' });
    render(<TestimonialRow testimonials={[twin, twin]} />);

    expect(screen.getAllByRole('figure')).toHaveLength(2);
  });

  it('shows only the first three when more are given, and as many as there are when fewer', () => {
    const four = [...demoHome.testimonials, makeTestimonial({ name: 'Dan Cruz' })];
    const { unmount } = render(<TestimonialRow testimonials={four} />);
    expect(screen.getAllByRole('figure')).toHaveLength(3);
    expect(screen.queryByText('Dan Cruz')).toBeNull();
    unmount();

    render(<TestimonialRow testimonials={demoHome.testimonials.slice(0, 1)} />);
    expect(screen.getAllByRole('figure')).toHaveLength(1);
  });

  it('shows a 300 character quote in full and a testimonial with no team line', () => {
    const quote = 'x'.repeat(299) + '!';
    render(<TestimonialRow testimonials={[makeTestimonial({ quote, teamOrRole: null })]} />);

    expect(screen.getByText(quote)).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('on a phone the carousel is a focusable region named "Testimonials"', () => {
    setPhoneWidth(true);
    render(<TestimonialRow testimonials={demoHome.testimonials} />);

    const region = screen.getByRole('region', { name: 'Testimonials' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getAllByRole('figure')).toHaveLength(3);
  });

  it('on a wide screen the row is not a region and takes no tab stop', () => {
    setPhoneWidth(false);
    const { container } = render(<TestimonialRow testimonials={demoHome.testimonials} />);

    expect(screen.queryByRole('region', { name: 'Testimonials' })).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it.each([true, false])('has no axe violations (phone: %s)', async (phone) => {
    setPhoneWidth(phone);
    const { container } = render(<TestimonialRow testimonials={demoHome.testimonials} />);

    await expectNoAxeViolations(container);
  });
});

describe('FinalCta (UI-SPEC H1 item 7, D-19, PUB-06)', () => {
  function renderCta(messengerUrl: string | null) {
    return render(
      <MemoryRouter>
        <FinalCta messengerUrl={messengerUrl} />
      </MemoryRouter>,
    );
  }

  it('shows the h2, the lead and "Get a Quote" to /contact', () => {
    renderCta('https://m.me/cspsdemo');

    expect(screen.getByRole('heading', { level: 2, name: "Got a team? Let's suit them up." })).toBeInTheDocument();
    expect(
      screen.getByText("Send your design, logo or rough idea. We'll reply with a mockup and a quote."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
  });

  it('shows "Message us on Messenger" to the Messenger link', () => {
    renderCta('https://m.me/cspsdemo');

    expect(screen.getByRole('link', { name: 'Message us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
  });

  it('does not render the Messenger button without a link', () => {
    renderCta(null);

    expect(screen.queryByRole('link', { name: 'Message us on Messenger' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Get a Quote' })).toBeInTheDocument();
  });

  it.each(['https://m.me/cspsdemo', null])('has no axe violations (Messenger %s)', async (url) => {
    const { container } = renderCta(url);

    await expectNoAxeViolations(container);
  });
});

describe('RecentWorkStrip (UI-SPEC H1 item 5, D-14)', () => {
  function renderStrip(items = demoRecentWork) {
    return render(
      <MemoryRouter>
        <RecentWorkStrip items={items} />
      </MemoryRouter>,
    );
  }

  it('shows the eyebrow "Fresh off the press", the h2 "Recent work." and the View gallery link', () => {
    renderStrip();

    expect(screen.getByText('Fresh off the press')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Recent work.' });
    expect(heading.querySelector('em')).toHaveTextContent('work.');
    expect(screen.getByRole('link', { name: 'View gallery' })).toHaveAttribute('href', '/gallery');
  });

  it('shows one tile per order in order, each a link to its line in the Gallery named by the caption', () => {
    const { container } = renderStrip();

    const tiles = container.querySelectorAll('a[href^="/gallery?category="]');
    expect([...tiles].map((tile) => tile.getAttribute('href'))).toEqual([
      '/gallery?category=basketball',
      '/gallery?category=volleyball',
      '/gallery?category=moto',
      '/gallery?category=polo',
      '/gallery?category=custom',
      '/gallery?category=basketball',
    ]);
    expect(screen.getByRole('link', { name: 'Brgy. Sample Ballers Basketball · 17 pcs' })).toHaveAttribute(
      'href',
      '/gallery?category=basketball',
    );
  });

  it('writes the caption as the name over "{Basketball} · {17} pcs", "1 pc" for one, and no pieces when unknown', () => {
    renderStrip();

    expect(screen.getByText('Basketball · 17 pcs')).toBeInTheDocument();
    expect(screen.getByText('Volleyball · 12 pcs')).toBeInTheDocument();
    expect(screen.getByText('Moto · 1 pc')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('draws the strip photo as a decorative lazy image at 4 / 5 with the server srcset', () => {
    const { container } = renderStrip();

    const link = screen.getByRole('link', { name: 'Brgy. Sample Ballers Basketball · 17 pcs' });
    const image = link.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('srcset', expect.stringContaining('400w'));
    expect(image).toHaveAttribute('sizes', '(max-width: 767px) calc(72vw - 23px), 240px');
    const ratio = [...link.querySelectorAll<HTMLElement>('*')].find(
      (element) => element.style.getPropertyValue('--ratio') !== '',
    );
    expect(ratio?.style.getPropertyValue('--ratio')).toBe('4 / 5');
    expect(container.querySelectorAll('img[alt=""]').length).toBeGreaterThan(0);
  });

  it('draws the jersey in the line art when an order has no photo', () => {
    renderStrip();

    const link = screen.getByRole('link', { name: 'Sample Office Polo Polo · 17 pcs' });
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(link.querySelector('img')).toBeNull();
  });

  it('draws as many tiles as there are orders, and nothing at all with none', () => {
    const two = renderStrip(demoRecentWork.slice(0, 2));
    expect(two.container.querySelectorAll('a[href^="/gallery?category="]')).toHaveLength(2);
    two.unmount();

    const none = renderStrip([]);
    expect(none.container).toBeEmptyDOMElement();
  });

  it('sends a tile whose line key is not a safe address to the plain Gallery', () => {
    renderStrip([makeRecentWork({ team: 'Odd Key FC', lineKey: 'bad key&x=1' })]);

    expect(screen.getByRole('link', { name: /^Odd Key FC/ })).toHaveAttribute('href', '/gallery');
  });

  it('wraps a long team name inside the caption', () => {
    renderStrip([
      makeRecentWork({ team: 'Barangay San Roque Interbarangay Champions of the Province', lineKey: 'moto' }),
    ]);

    expect(screen.getByText('Barangay San Roque Interbarangay Champions of the Province').className).toContain(
      'wrap-anywhere',
    );
  });

  it('has no axe violations', async () => {
    const { container } = renderStrip();

    await expectNoAxeViolations(container);
  });
});

describe('RecentWorkSkeletons (UI-SPEC H1 States)', () => {
  it('draws four 4 / 5 frames under the section head, hidden from assistive technology', async () => {
    const { container } = render(<RecentWorkSkeletons />);

    const frames = container.querySelectorAll('[data-home-skeleton="recent"]');
    expect(frames).toHaveLength(4);
    for (const frame of frames) {
      expect(frame).toHaveAttribute('aria-hidden', 'true');
      expect(frame.className).toContain('aspect-4/5');
    }
    expect(screen.getByText('Fresh off the press')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('HeroTag (UI-SPEC H1 item 1, D-14)', () => {
  it('shows "Recent order", the public name and "{17}-piece set · mockup to pickup"', () => {
    render(<HeroTag tag={{ name: 'Brgy. Sample Ballers', pieces: 17 }} />);

    expect(screen.getByText('Recent order')).toBeInTheDocument();
    expect(screen.getByText('Brgy. Sample Ballers')).toBeInTheDocument();
    expect(screen.getByText('17-piece set · mockup to pickup')).toBeInTheDocument();
  });

  it('says "1-piece set" for one piece', () => {
    render(<HeroTag tag={{ name: 'Solo FC', pieces: 1 }} />);

    expect(screen.getByText('1-piece set · mockup to pickup')).toBeInTheDocument();
  });

  it('renders nothing without a tag', () => {
    const { container } = render(<HeroTag tag={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('is not a link', () => {
    render(<HeroTag tag={{ name: 'Brgy. Sample Ballers', pieces: 17 }} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<HeroTag tag={{ name: 'Brgy. Sample Ballers', pieces: 17 }} />);

    await expectNoAxeViolations(container);
  });
});
