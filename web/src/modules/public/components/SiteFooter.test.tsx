// The public footer from the stored shop facts (PUB-02, D-25, D-33, D-42).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import {
  answerSite,
  closedWeek,
  demoSite,
  mixedWeek,
  putBootBlock,
  resetPublicData,
  siteFailureHandler,
  siteWithoutOptionals,
  type PublicSiteFixture,
} from '@/test/publicFixtures';
import { server } from '@/test/msw';
import { consentStore } from '../hooks/useConsent';
import FooterHours from './FooterHours';
import { SiteFooter } from './SiteFooter';

// The clock row loads as a lazy chunk. The spy lets a test wait until it has rendered before it asserts the row is absent.
vi.mock('./FooterHours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./FooterHours')>();
  return { ...actual, default: vi.fn(actual.default) };
});

const CLEARANCE = 'pg-phone:pb-[max(var(--space-24),calc(var(--spacing-contact-bar)+env(safe-area-inset-bottom)))]';

afterEach(() => {
  resetPublicData();
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

function renderFullFrom(site: PublicSiteFixture) {
  putBootBlock(site);
  return renderFooter();
}

describe('SiteFooter, full (PUB-02)', () => {
  it('shows the stored tagline and the social squares that are set, in the order FB, IG, TT', () => {
    renderFullFrom(demoSite);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByText(demoSite.tagline)).toBeInTheDocument();
    const facebook = within(footer).getByRole('link', { name: 'FB, CSPS on Facebook' });
    const instagram = within(footer).getByRole('link', { name: 'IG, CSPS on Instagram' });
    expect(facebook).toHaveTextContent('FB');
    expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/cspsdemo');
    expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/cspsdemo');
    expect(within(footer).queryByRole('link', { name: 'TT, CSPS on TikTok' })).not.toBeInTheDocument();
  });

  it('puts the TikTok square last when it is set', () => {
    renderFullFrom({ ...demoSite, tiktokUrl: 'https://www.tiktok.com/@cspsdemo' });

    const names = within(screen.getByRole('contentinfo'))
      .getAllByRole('link', { name: /^(FB|IG|TT), / })
      .map((link) => link.textContent);

    expect(names).toEqual(['FB', 'IG', 'TT']);
  });

  it('shows the address line without the postal code, the main phone as a tel: link and the Messenger link', () => {
    renderFullFrom(demoSite);
    const footer = screen.getByRole('contentinfo');

    expect(
      within(footer).getByText('12 Sample St., Poblacion, Sample City, Sample Province, Philippines'),
    ).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
    expect(within(footer).getByRole('link', { name: 'Message us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
  });

  it('shows no email and no "@" anywhere in the footer (D-25)', () => {
    const { container } = renderFullFrom(demoSite);

    expect(container.textContent).not.toContain('@');
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByRole('img', { hidden: true, name: /mail/i })).not.toBeInTheDocument();
  });

  it('leaves out every optional value that is not set: no squares, no Messenger, no # link, no bracket', () => {
    const { container } = renderFullFrom(siteWithoutOptionals);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).queryByRole('link', { name: /CSPS on/ })).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: 'Message us on Messenger' })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="#"]')).toBeNull();
    expect(container.textContent).not.toMatch(/[[\]]/);
    expect(within(footer).getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });

  it('leaves out the empty parts of the address', () => {
    renderFullFrom({
      ...siteWithoutOptionals,
      address: { street: null, townOrCity: 'Sample City', province: null, postalCode: null },
    });

    expect(within(screen.getByRole('contentinfo')).getByText('Sample City, Philippines')).toBeInTheDocument();
  });

  it('keeps the Shop column, the copyright line and Staff Login', () => {
    renderFullFrom(demoSite);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
    expect(within(footer).getByText('© 2026 Sample Shop. All rights reserved.')).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toHaveAttribute('href', '/admin/login');
  });

  it('with no boot block, reads the API: two skeleton lines each in Visit and Contact while it loads, then the facts', async () => {
    answerSite(demoSite);
    const { container } = renderFooter();

    expect(container.querySelectorAll('div[aria-hidden="true"] > span[aria-hidden="true"]')).toHaveLength(4);
    expect(screen.getByText('Visit')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '0917 123 4567' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Staff Login' })).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: '0917 123 4567' })).toBeInTheDocument();
  });

  it('when the read fails, keeps Shop and Staff Login and drops the rows that need the facts', async () => {
    server.use(siteFailureHandler(404));
    renderFooter();
    const footer = screen.getByRole('contentinfo');

    await waitFor(() => {
      expect(within(footer).queryByText('Visit')).not.toBeInTheDocument();
    });
    expect(within(footer).getByRole('link', { name: 'Get a Quote' })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: /CSPS on/ })).not.toBeInTheDocument();
    expect(within(footer).queryByText(/All rights reserved/)).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderFullFrom(demoSite);

    await expectNoAxeViolations(container);
  });

  it('shows the copyright year the server sends, not the device clock', () => {
    renderFullFrom({ ...demoSite, year: 2031 });

    expect(
      within(screen.getByRole('contentinfo')).getByText('© 2031 Sample Shop. All rights reserved.'),
    ).toBeInTheDocument();
  });
});

describe('SiteFooter clock row (CONT-04, PUB-02, D-21)', () => {
  it('shows one line for Monday to Saturday under the address', async () => {
    renderFullFrom(demoSite);
    const footer = screen.getByRole('contentinfo');

    expect(await within(footer).findByText('Mon-Sat · 9:00 AM - 6:00 PM')).toBeInTheDocument();
  });

  it('shows two lines when Saturday keeps shorter hours', async () => {
    renderFullFrom({ ...demoSite, hours: mixedWeek });
    const footer = screen.getByRole('contentinfo');

    expect(await within(footer).findByText('Mon-Fri · 9:00 AM - 6:00 PM')).toBeInTheDocument();
    expect(within(footer).getByText('Sat · 9:00 AM - 5:00 PM')).toBeInTheDocument();
  });

  it('is not rendered when no day is open', async () => {
    vi.mocked(FooterHours).mockClear();
    renderFullFrom({ ...demoSite, hours: closedWeek });
    const footer = screen.getByRole('contentinfo');

    await waitFor(() => {
      expect(vi.mocked(FooterHours)).toHaveBeenCalled();
    });
    expect(within(footer).getByText('Visit')).toBeInTheDocument();
    expect(vi.mocked(FooterHours).mock.results.at(-1)?.value).toBeNull();
    expect(within(footer).queryByText(/AM/)).not.toBeInTheDocument();
  });

  it('has no axe violations with the clock row', async () => {
    const { container } = renderFullFrom(demoSite);
    await screen.findByText('Mon-Sat · 9:00 AM - 6:00 PM');

    await expectNoAxeViolations(container);
  });
});

function renderBase() {
  return render(
    <MemoryRouter>
      <SiteFooter variant="base" />
    </MemoryRouter>,
  );
}

describe('SiteFooter, base (UI-SPEC Footer base; Gallery, Contact, 404)', () => {
  it('is one row: the small logo, "© {year} {business name}" and Staff Login', () => {
    putBootBlock(demoSite);
    renderBase();
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('img', { name: "CSPS: Carmen's Stitch & Printing Services" })).toBeInTheDocument();
    expect(within(footer).getByText('© 2026 Sample Shop')).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toHaveAttribute('href', '/admin/login');
    expect(within(footer).queryByRole('heading')).not.toBeInTheDocument();
    expect(within(footer).queryByText(demoSite.tagline)).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: /CSPS on/ })).not.toBeInTheDocument();
    expect(within(footer).queryByText(/All rights reserved/)).not.toBeInTheDocument();
  });

  it('shows Staff Login at once and the copyright line after the facts load', async () => {
    renderBase();
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'Staff Login' })).toBeInTheDocument();
    expect(within(footer).queryByText(/©/)).not.toBeInTheDocument();
    expect(await within(footer).findByText('© 2026 Sample Shop')).toBeInTheDocument();
  });

  it('keeps Staff Login and drops the copyright line when the read fails', async () => {
    server.use(siteFailureHandler(404));
    renderBase();
    const footer = screen.getByRole('contentinfo');

    await waitFor(() => {
      expect(within(footer).getByRole('link', { name: 'Staff Login' })).toBeInTheDocument();
    });
    expect(within(footer).queryByText(/©/)).not.toBeInTheDocument();
  });

  it('pads the base footer 96px on phones, or the Contact bar plus the safe area when that is taller', () => {
    putBootBlock(demoSite);
    renderBase();

    expect(screen.getByRole('contentinfo').className.split(' ')).toContain(CLEARANCE);
  });

  it('pads the full footer the same way', () => {
    renderFullFrom(demoSite);

    expect(screen.getByRole('contentinfo').className.split(' ')).toContain(CLEARANCE);
  });

  it('has no axe violations', async () => {
    putBootBlock(demoSite);
    const { container } = renderBase();

    await expectNoAxeViolations(container);
  });
});

const LEGAL_ITEMS = ['Privacy Policy', 'Cookie Policy', 'Terms of Use', 'Accessibility Statement', 'Cookie Settings'];

function drawAt(variant: 'full' | 'base', path = '/') {
  putBootBlock(demoSite);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteFooter variant={variant} />
    </MemoryRouter>,
  );
}

function legalNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Legal' });
}

describe.each(['full', 'base'] as const)('SiteFooter Legal row, %s footer (LEGAL-05, UI-SPEC FT)', (variant) => {
  it('lists the four legal pages and Cookie Settings, in that order, as links to the legal paths and one button', () => {
    drawAt(variant);
    const items = within(legalNav()).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual(LEGAL_ITEMS);
    expect(
      within(legalNav())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/privacy', '/cookies', '/terms', '/accessibility']);
    expect(within(legalNav()).getAllByRole('button')).toHaveLength(1);
  });

  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/cookies', 'Cookie Policy'],
    ['/terms', 'Terms of Use'],
    ['/accessibility', 'Accessibility Statement'],
  ])('marks only the link of %s as the current page', (path, name) => {
    drawAt(variant, path);
    const current = within(legalNav())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent);

    expect(current).toEqual([name]);
  });

  it('marks no link on another page', () => {
    drawAt(variant, '/products');

    expect(legalNav().querySelector('[aria-current]')).toBeNull();
  });

  it('gives each item a 44px height, Small 14px text and 16px by 8px gaps that wrap, so 320px never scrolls sideways', () => {
    drawAt(variant);
    const list = within(legalNav()).getByRole('list');

    expect(list.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'gap-x-4', 'gap-y-2']));
    for (const control of [...within(legalNav()).getAllByRole('link'), ...within(legalNav()).getAllByRole('button')]) {
      expect(control.className.split(' ')).toEqual(
        expect.arrayContaining(['inline-flex', 'min-h-11', 'items-center', 'text-14', 'text-ink-subtle']),
      );
    }
  });

  it('renders at once and stays when the shop facts cannot be read', async () => {
    server.use(siteFailureHandler(404));
    render(
      <MemoryRouter>
        <SiteFooter variant={variant} />
      </MemoryRouter>,
    );
    expect(within(legalNav()).getAllByRole('listitem')).toHaveLength(5);

    await waitFor(() => {
      expect(screen.queryByText(/©/)).not.toBeInTheDocument();
    });
    expect(within(legalNav()).getAllByRole('listitem')).toHaveLength(5);
  });

  it('has no axe violations', async () => {
    const { container } = drawAt(variant, '/cookies');

    await expectNoAxeViolations(container);
  });
});

describe('SiteFooter Legal row placement (UI-SPEC FT)', () => {
  it('sits after the dashed rule and above the copyright line in the full footer', () => {
    drawAt('full');
    const rule = legalNav().parentElement;
    const copyright = screen.getByText('© 2026 Sample Shop. All rights reserved.');

    expect(rule?.className.split(' ')).toEqual(expect.arrayContaining(['border-t-2', 'border-dashed']));
    expect(legalNav().compareDocumentPosition(copyright)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(legalNav().className.split(' ')).toContain('mb-2');
  });

  it('sits under the one-row base, 8px below it', () => {
    drawAt('base');
    const copyright = screen.getByText('© 2026 Sample Shop');

    expect(copyright.compareDocumentPosition(legalNav())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(legalNav().className.split(' ')).toContain('mt-2');
  });
});

describe('SiteFooter Legal row, Cookie Settings (ANL-03)', () => {
  it.each([
    ['full', renderFullFrom],
    [
      'base',
      (site: PublicSiteFixture) => {
        putBootBlock(site);
        return renderBase();
      },
    ],
  ])('ends the %s footer with a nav named "Legal" that holds the Cookie Settings button', (_name, draw) => {
    draw(demoSite);
    const nav = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Legal' });

    expect(within(nav).getByRole('button', { name: 'Cookie Settings' })).toHaveAttribute('type', 'button');
  });

  it('opens the window from the button and shows the button pending until the window says it is ready', async () => {
    const user = userEvent.setup();
    putBootBlock(demoSite);
    renderBase();
    const button = within(screen.getByRole('navigation', { name: 'Legal' })).getByRole('button', {
      name: 'Cookie Settings',
    });

    await user.click(button);

    expect(consentStore.getSnapshot().settingsOpen).toBe(true);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
  });
});
