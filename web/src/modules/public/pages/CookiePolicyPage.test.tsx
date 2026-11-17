// SPEC-GAP: LEGAL-02, D-17. The Cookie Policy at /cookies: the cookies the site sets, in three groups, each with what it does and
// how long it lasts, and the Google cookie policy link (UI-SPEC L3).
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';

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
  if (dt === undefined || dt.parentElement === null) {
    throw new Error(`No dt named "${name}".`);
  }
  return {
    dt,
    lines: Array.from(dt.parentElement.querySelectorAll('dd')).map((dd) => dd.textContent),
  };
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

  it('says Google sets its own cookies when the map loads, with a link to Google\'s cookie policy that opens in a new tab', async () => {
    await renderCookies();
    const section = await sectionOf('Cookies we use');
    expect(within(section).getByText(/Google sets its own cookies when the map loads/)).toBeInTheDocument();
    const link = within(section).getByRole('link', { name: /Google's cookie policy/ });
    expect(link).toHaveAttribute('href', 'https://policies.google.com/technologies/cookies');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent(" (opens in a new tab)");
  });
});
