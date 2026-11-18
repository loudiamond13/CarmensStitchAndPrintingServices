// SPEC-GAP: LEGAL-02, D-17, D-19, D-20, D-22, D-31, D-36, D-39, D-41. The Cookie Policy at /cookies: the cookies the site sets, in
// three groups, each with what it does and how long it lasts, the Google cookie policy link, the seven sections in order, the button
// that opens Cookie Settings and the lines about GPC, clearing and changes (UI-SPEC L3).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { setConsent } from '@/test/consentFixtures';

// The Cookie Settings window is a lazy chunk; the first transform of its parts can take longer than a test waits, so load it first.
beforeAll(async () => {
  await import('../components/CookieSettingsDialog');
}, 30_000);

/** The real route tree at /cookies, settled once the h1 is on screen. */
async function renderCookies() {
  const router = createMemoryRouter(routes, { initialEntries: ['/cookies'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Cookie policy.' }, { timeout: 15_000 });
  return view;
}

/** One section of the article, found by its h2. */
async function sectionOf(name: string): Promise<HTMLElement> {
  const section = (await screen.findByRole('heading', { level: 2, name })).closest('section');
  if (section === null) {
    throw new Error(`The "${name}" heading is not inside a section.`);
  }
  return section;
}

/** The dl item of a cookie: its dt and the dd lines that follow it. */
function itemOf(section: HTMLElement, name: string): { dt: HTMLElement; lines: string[] } {
  const dt = Array.from(section.querySelectorAll('dt')).find((node) => node.textContent === name);
  const item = dt?.parentElement;
  if (dt === undefined || item === null || item === undefined) {
    throw new Error(`No dt named "${name}".`);
  }
  return { dt, lines: Array.from(item.querySelectorAll('dd')).map((dd) => dd.textContent) };
}

describe('CookiePolicyPage cookies we use (LEGAL-02, D-17)', { timeout: 20_000 }, () => {
  it('shows "What cookies are" and then "Cookies we use"', async () => {
    await renderCookies();
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
    expect(names.slice(0, 2)).toEqual(['What cookies are', 'Cookies we use']);
  });

  it('has three h3 groups in "Cookies we use": Necessary, Visitor stats and Google map', async () => {
    await renderCookies();
    const section = await sectionOf('Cookies we use');
    const groups = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(groups).toEqual(['Necessary', 'Visitor stats', 'Google map']);
  });

  it.each([
    ['__Host-csps_consent', '12 months'],
    ['__Secure-csps_rt', '90 days'],
    ['__Secure-csps_2fa', '30 minutes'],
    ['__Secure-csps_staff', '90 days'],
    ['__Secure-csps_vid', '12 months'],
  ])('shows %s as a dt with "What it does" and "How long it lasts" (%s)', async (name, lifetime) => {
    await renderCookies();
    const { lines } = itemOf(await sectionOf('Cookies we use'), name);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^What it does: .{20,}/);
    expect(lines[1]).toMatch(/^How long it lasts: /);
    expect(lines[1]).toContain(lifetime);
  });

  it('lists the necessary cookies before the group of visitor stats, and the visitor id under visitor stats', async () => {
    await renderCookies();
    const section = await sectionOf('Cookies we use');
    const order = Array.from(section.querySelectorAll('h3, dt')).map((node) => node.textContent);
    expect(order.indexOf('Necessary')).toBeLessThan(order.indexOf('__Host-csps_consent'));
    expect(order.indexOf('Visitor stats')).toBeLessThan(order.indexOf('__Secure-csps_vid'));
    expect(order.indexOf('__Secure-csps_staff')).toBeLessThan(order.indexOf('Visitor stats'));
  });

  it('says staff only for the sign-in cookies and the admin settings, and lists the admin settings as necessary', async () => {
    await renderCookies();
    const section = await sectionOf('Cookies we use');
    for (const name of ['__Secure-csps_rt', '__Secure-csps_2fa', '__Secure-csps_staff']) {
      expect(itemOf(section, name).lines[0]).toMatch(/staff/i);
    }
    const admin = itemOf(section, 'Admin settings in this browser');
    expect(admin.lines[0]).toMatch(/staff only/i);
    expect(admin.lines[0]).toMatch(/theme/i);
    expect(admin.lines[0]).toMatch(/orders view/i);
  });

  it("says Google sets its own cookies when the map loads, with a link to Google's cookie policy that opens in a new tab", async () => {
    await renderCookies();
    const section = await sectionOf('Cookies we use');
    expect(within(section).getByText(/Google sets its own cookies when the map loads/)).toBeInTheDocument();
    const link = within(section).getByRole('link', { name: /Google's cookie policy/ });
    expect(link).toHaveAttribute('href', 'https://policies.google.com/technologies/cookies');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent(' (opens in a new tab)');
  });
});

const SECTIONS = [
  'What cookies are',
  'Cookies we use',
  'Your choices',
  'Global Privacy Control',
  'Clear your cookies and data',
  'Changes to this policy',
  'Contact us',
];

describe('CookiePolicyPage sections (LEGAL-02)', { timeout: 20_000 }, () => {
  it('shows one h1 and the seven sections in order', async () => {
    await renderCookies();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
    expect(names).toEqual(SECTIONS);
  });

  it('shows the version line with the consent policy version', async () => {
    await renderCookies();
    expect(screen.getByText('Version 0.1 · Last updated Nov 15, 2026')).toBeInTheDocument();
  });
});

describe('CookiePolicyPage Your choices and the Cookie Settings button (LEGAL-02, D-17)', { timeout: 20_000 }, () => {
  it('ends "Your choices" with a button named "Change Cookie Settings"', async () => {
    setConsent();
    await renderCookies();
    const section = await sectionOf('Your choices');
    const button = within(section).getByRole('button', { name: 'Change Cookie Settings' });
    expect(button).toHaveAttribute('type', 'button');
    const last = section.querySelector('div > :last-child');
    expect(last === button || last?.contains(button) === true).toBe(true);
  });

  it('opens the Cookie Settings window with focus inside it, and Escape returns focus to the button', async () => {
    setConsent();
    await renderCookies();
    const button = within(await sectionOf('Your choices')).getByRole('button', { name: 'Change Cookie Settings' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Cookie Settings' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Cookie Settings' })).not.toBeInTheDocument();
    });
    expect(button).toHaveFocus();
  });

  it('explains the two choices and what happens when the cookies are blocked in the browser', async () => {
    setConsent();
    await renderCookies();
    const section = await sectionOf('Your choices');
    expect(within(section).getByText(/Visitor stats: allow or refuse/)).toBeInTheDocument();
    expect(within(section).getByText(/Google map: allow or refuse/)).toBeInTheDocument();
    expect(within(section).getByText(/12 months, or sooner if this policy changes/)).toBeInTheDocument();
    expect(within(section).getByText(/block the necessary cookies/)).toBeInTheDocument();
  });
});

describe('CookiePolicyPage Global Privacy Control (D-20, D-39)', { timeout: 20_000 }, () => {
  it('says the site reads GPC as a no to visitor stats, shows no bar and still lets the visitor allow the map', async () => {
    await renderCookies();
    const section = await sectionOf('Global Privacy Control');
    expect(within(section).getByText(/we read it as a no to visitor stats/)).toBeInTheDocument();
    expect(within(section).getByText(/We show no cookie bar/)).toBeInTheDocument();
    expect(within(section).getByText(/still allow the Google map/)).toBeInTheDocument();
  });

  it('links /.well-known/gpc.json as a plain link that opens in a new tab', async () => {
    await renderCookies();
    const link = within(await sectionOf('Global Privacy Control')).getByRole('link', { name: /GPC statement/ });
    expect(link).toHaveAttribute('href', '/.well-known/gpc.json');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('CookiePolicyPage Clear your cookies and data (D-19, D-31, D-36, D-41)', { timeout: 20_000 }, () => {
  it('says what Clear deletes and what it turns off', async () => {
    await renderCookies();
    const section = await sectionOf('Clear your cookies and data');
    expect(
      within(section).getByText(/deletes the optional cookies and saved settings in this browser/),
    ).toBeInTheDocument();
    expect(within(section).getByText(/the visit records linked to them on our server/)).toBeInTheDocument();
    expect(within(section).getByText(/turns visitor stats and the Google map off/)).toBeInTheDocument();
  });

  it('says the necessary cookies stay, so a signed-in staff member stays signed in (D-44)', async () => {
    await renderCookies();
    const section = await sectionOf('Clear your cookies and data');
    expect(
      within(section).getByText('The necessary cookies stay, so a signed-in staff member stays signed in.'),
    ).toBeInTheDocument();
  });

  it("says Clear also resets a staff member's admin theme and orders view in that browser", async () => {
    await renderCookies();
    const section = await sectionOf('Clear your cookies and data');
    expect(
      within(section).getByText(/resets a staff member's admin theme and orders view in that browser/),
    ).toBeInTheDocument();
  });

  it("says the daily totals stay and Google's own cookies cannot be cleared", async () => {
    await renderCookies();
    const section = await sectionOf('Clear your cookies and data');
    expect(within(section).getByText(/leaves the daily totals/)).toBeInTheDocument();
    expect(within(section).getByText(/no visitor id/)).toBeInTheDocument();
    expect(within(section).getByText(/cannot clear Google's own cookies/)).toBeInTheDocument();
  });

  it("uses the owner's retention wording for the visit records and the cookie choice", async () => {
    await renderCookies();
    const section = await sectionOf('Clear your cookies and data');
    const lines = within(section).getAllByText('Kept for about 13 months; removed at the next monthly cleanup.');
    expect(lines).toHaveLength(2);
    expect(section.textContent).not.toMatch(/Kept for 13 months/);
  });
});

describe('CookiePolicyPage Changes to this policy and Contact us (D-22)', { timeout: 20_000 }, () => {
  it('says a new version comes with a reviewed release and every visitor is asked again', async () => {
    await renderCookies();
    const section = await sectionOf('Changes to this policy');
    expect(within(section).getByText(/publish a new version with a reviewed release/)).toBeInTheDocument();
    expect(within(section).getByText(/Every visitor is then asked for their choice again/)).toBeInTheDocument();
  });

  it('shows the shop contact lines under "Contact us"', async () => {
    await renderCookies();
    const scope = within(await sectionOf('Contact us'));
    expect(await scope.findByRole('link', { name: 'shop-private@example.test' })).toHaveAttribute(
      'href',
      'mailto:shop-private@example.test',
    );
    expect(scope.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });
});

describe('CookiePolicyPage accessibility', { timeout: 20_000 }, () => {
  it('has zero axe violations', async () => {
    setConsent();
    const { container } = await renderCookies();
    await screen.findByRole('link', { name: 'shop-private@example.test' });
    await expectNoAxeViolations(container);
  });
});
