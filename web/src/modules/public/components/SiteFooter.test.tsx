// The public footer from the stored shop facts (PUB-02, D-25, D-33, D-42).
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import {
  answerSite,
  demoSite,
  putBootBlock,
  resetPublicData,
  siteFailureHandler,
  siteWithoutOptionals,
  type PublicSiteFixture,
} from '@/test/publicFixtures';
import { server } from '@/test/msw';
import { SiteFooter } from './SiteFooter';

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
    expect(within(footer).queryByText(/Mon-Sat/)).not.toBeInTheDocument();
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

function renderBase(props: { clearBar?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <SiteFooter variant="base" {...props} />
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

  it('keeps the 96px bottom padding on phones only when it must clear the Contact bar', () => {
    putBootBlock(demoSite);
    const plain = renderBase();
    expect(screen.getByRole('contentinfo').className).not.toContain('pg-phone:pb-[96px]');
    plain.unmount();

    renderBase({ clearBar: true });
    expect(screen.getByRole('contentinfo').className).toContain('pg-phone:pb-[96px]');
  });

  it('has no axe violations', async () => {
    putBootBlock(demoSite);
    const { container } = renderBase();

    await expectNoAxeViolations(container);
  });
});
