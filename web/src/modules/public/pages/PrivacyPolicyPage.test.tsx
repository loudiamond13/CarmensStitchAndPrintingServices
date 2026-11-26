// SPEC-GAP: LEGAL-01, D-01 to D-06, D-11, D-12, D-36. The Privacy Policy at /privacy: who runs the site (from the site settings) and the
// retention list, character for character from the owner's rulings (the quote request rows are approved, D-45).
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /privacy, settled once the h1 is on screen. */
async function renderPrivacy() {
  const router = createMemoryRouter(routes, { initialEntries: ['/privacy'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Privacy policy.' }, { timeout: 15_000 });
  return view;
}

/** The section that holds the h2 with this name. */
async function sectionOf(name: string): Promise<HTMLElement> {
  const section = (await screen.findByRole('heading', { level: 2, name })).closest('section');
  if (section === null) {
    throw new Error(`The "${name}" heading is not inside a section.`);
  }
  return section;
}

const RETENTION: readonly (readonly [string, string])[] = [
  ['Orders, payments, discounts and expenses', 'Kept for good. They are our bookkeeping and tax records.'],
  ["Quote requests that didn't become an order, and their photos", 'Deleted 6 months after we receive them.'],
  ['Quote requests that became an order, and their photos', 'Kept as long as the order.'],
  ['Photos sent with a request we mark as spam', 'Deleted within a day.'],
  ['Daily page counts', 'Deleted about 3 years after the day they count.'],
  ['Staff account activity log', 'Deleted about 8 months after it is recorded.'],
];

const STRAY_PHOTO_SENTENCE =
  'Rarely, a photo that finishes uploading at the moment its request is marked as spam or deleted, or its order is deleted, can stay in storage for up to 3 days before it is removed.';

describe('PrivacyPolicyPage at /privacy (LEGAL-01)', { timeout: 20_000 }, () => {
  it('shows one h1', async () => {
    await renderPrivacy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('names the business from the site settings and the Data Protection Officer by role in "Who we are"', async () => {
    await renderPrivacy();
    const scope = within(await sectionOf('Who we are'));
    expect(await scope.findByText('Sample Shop')).toBeInTheDocument();
    expect(scope.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
    expect(scope.getByText(/Data Privacy Act of 2012/)).toBeInTheDocument();
  });

  it('lists the six retention lines in order, the quote request rows being approved (D-45)', async () => {
    await renderPrivacy();
    const section = await sectionOf('How long we keep it');
    const terms = [...section.querySelectorAll('dt')].map((node) => node.textContent);
    const texts = [...section.querySelectorAll('dd')].map((node) => node.textContent);
    expect(terms).toEqual(RETENTION.map(([term]) => term));
    expect(texts).toEqual(RETENTION.map(([, text]) => text));
  });

  it('ends the retention section with the rare stray photo sentence, after the list (D-45)', async () => {
    await renderPrivacy();
    const section = await sectionOf('How long we keep it');
    const sentence = within(section).getByText(STRAY_PHOTO_SENTENCE);
    expect(sentence.tagName).toBe('P');
    const list = section.querySelector('dl');
    if (list === null) {
      throw new Error('The retention section has no list.');
    }
    expect(list.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps daily page counts about 3 years and has no visitor stats or cookie choice line', async () => {
    await renderPrivacy();
    const section = await sectionOf('How long we keep it');
    expect(section).toHaveTextContent('Daily page counts');
    expect(section).toHaveTextContent('Deleted about 3 years after the day they count.');
    expect(section).not.toHaveTextContent(/visitor stats/i);
    expect(section).not.toHaveTextContent(/cookie choice/i);
  });
});

const SECTIONS = [
  'Who we are',
  'What we collect',
  'Why we use it',
  'Photos of your order',
  'Who else handles it',
  'How long we keep it',
  'Cookies and saved settings',
  'Your rights',
  'How to ask about your data',
  'Complaints to the National Privacy Commission',
  'Changes to this policy',
];

const GOOGLE_COOKIE_POLICY = 'https://policies.google.com/technologies/cookies';

describe('PrivacyPolicyPage sections (LEGAL-01, D-15, D-40)', { timeout: 20_000 }, () => {
  it('lists the sections in order, each in the "On this page" contents', async () => {
    await renderPrivacy();
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
    expect(names).toEqual(SECTIONS);
    const contents = screen.getAllByRole('navigation', { name: 'On this page' });
    expect(contents.length).toBeGreaterThan(0);
    for (const nav of contents) {
      expect(
        within(nav)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(SECTIONS);
    }
  });

  it('says what is collected for each purpose, with the daily page count as the page and the day only', async () => {
    await renderPrivacy();
    const section = await sectionOf('What we collect');
    expect(within(section).getAllByRole('listitem')).toHaveLength(5);
    expect(section).toHaveTextContent(/page and the day/i);
    expect(section).toHaveTextContent(/staff account/i);
    expect(section).not.toHaveTextContent(/only if you allow/i);
  });

  it('covers quote requests now that the form is back (D-28)', async () => {
    await renderPrivacy();
    expect(screen.getByRole('main')).toHaveTextContent(/quote request/i);
  });

  it('gives each purpose its basis in plain words', async () => {
    await renderPrivacy();
    const section = await sectionOf('Why we use it');
    const terms = [...section.querySelectorAll('dt')].map((node) => node.textContent);
    expect(terms).toEqual(['Orders and payments', 'Quote requests', 'Page counts', 'The map', 'Staff accounts']);
    expect(section).toHaveTextContent(/contract with you/);
    expect(section).toHaveTextContent(/the law says we must/);
    expect(section).toHaveTextContent(/legitimate interest in keeping/);
    expect(section).toHaveTextContent(
      'The map loads from Google when you tap Show Map. After your first tap, this browser loads the map by itself until you clear the saved setting.',
    );
    expect(section).toHaveTextContent(/your consent/);
  });

  it('never says the map loads only on a tap (D-134)', async () => {
    await renderPrivacy();
    expect(screen.getByRole('main')).not.toHaveTextContent(/only (?:after|when) you tap/i);
  });

  it('says the saved settings are not cookies, with no count (D-134)', async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    expect(section).toHaveTextContent(
      'These settings are not cookies. They stay in your browser and are never sent to us.',
    );
    expect(section).not.toHaveTextContent(/These (?:two|three|\d+) settings/);
  });

  it('shows an order photo on the public site only when the customer said it is OK', async () => {
    await renderPrivacy();
    const section = await sectionOf('Photos of your order');
    expect(section).toHaveTextContent(/only when the customer said it is OK to show/);
    expect(section).toHaveTextContent(/no name, price or other detail/i);
  });

  it('lists exactly four other handlers and no data-centre or server names', async () => {
    await renderPrivacy();
    const section = await sectionOf('Who else handles it');
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/web host/i);
    expect(items[1]).toHaveTextContent('Cloudinary');
    expect(items[2]).toHaveTextContent(/email sender/i);
    expect(items[3]).toHaveTextContent(/Google/);
    expect(items[3]).toHaveTextContent(
      'This happens when you tap Show Map. After your first tap, this browser loads the map by itself until you clear the saved setting.',
    );
    expect(section).not.toHaveTextContent(/data cent(?:er|re)|server/i);
  });

  it('names exactly the necessary cookies', async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    const terms = [...section.querySelectorAll('dt')].map((node) => node.textContent);
    expect(terms).toEqual([
      '__Secure-csps_rt',
      '__Secure-csps_2fa',
      '__Secure-csps_staff',
      'Admin settings in this browser',
      'Saved map setting',
    ]);
    const article = screen.getByRole('article');
    const cookieNames = (article.textContent.match(/(?:__Host-|__Secure-)?csps_[a-z0-9]+/g) ?? []).filter(
      (name) => !terms.includes(name),
    );
    expect(cookieNames).toEqual([]);
    expect(section).toHaveTextContent(/sets no optional cookies/);
    expect(section).toHaveTextContent(/no cookie banner/);
  });

  it('gives each necessary cookie what it does and how long it lasts', async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    const items = [...section.querySelectorAll('dt')].map((term) => {
      const lines: string[] = [];
      for (let next = term.nextElementSibling; next?.tagName === 'DD'; next = next.nextElementSibling) {
        lines.push(next.textContent);
      }
      return { name: term.textContent, text: lines.join(' ') };
    });
    const byName = (name: string) => items.find((item) => item.name === name)?.text ?? '';
    expect(byName('__Secure-csps_rt')).toMatch(/What it does: Staff sign-in only/);
    expect(byName('__Secure-csps_rt')).toMatch(/Until the browser closes, or 90 days.*"Keep me signed in".*12 hours/);
    expect(byName('__Secure-csps_2fa')).toMatch(/How long it lasts: 30 minutes\./);
    expect(byName('__Secure-csps_staff')).toMatch(/left out of the page counts/);
    expect(byName('__Secure-csps_staff')).toMatch(/the same as the staff sign-in/i);
    expect(byName('Admin settings in this browser')).toMatch(/Staff only.*not a cookie/);
  });

  it('describes the saved map setting in plain words', async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    const term = [...section.querySelectorAll('dt')].find((node) => node.textContent === 'Saved map setting');
    const lines: string[] = [];
    for (let next = term?.nextElementSibling ?? null; next?.tagName === 'DD'; next = next.nextElementSibling) {
      lines.push(next.textContent);
    }
    const text = lines.join(' ');
    expect(text).toMatch(/after you tap Show Map/);
    expect(text).toMatch(/no expiry/);
    expect(text).toMatch(/until you clear this website's data in your browser's settings/);
    expect(text).toMatch(/even when your browser sends Global Privacy Control/);
    expect(text).toMatch(/every Google map on this site/);
    expect(text).toMatch(/never sent to us/);
  });

  it("links Google's cookie policy in a new tab and says Google may set its own cookies", async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    expect(section).toHaveTextContent(/Google may set its own cookies when the map loads/);
    const link = within(section).getByRole('link', { name: /^Google's cookie policy/ });
    expect(link).toHaveAttribute('href', GOOGLE_COOKIE_POLICY);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAccessibleName(/\(opens in a new tab\)$/);
  });

  it("says how to clear cookies and the saved setting in the browser's settings", async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    expect(section).toHaveTextContent(/clear cookies and site data in your browser's settings/);
    expect(section).toHaveTextContent(/removes the saved map setting/);
    expect(section).toHaveTextContent(/signs staff out/);
  });

  it('explains Global Privacy Control: the site tracks no one, so it honors the signal by default', async () => {
    await renderPrivacy();
    const section = await sectionOf('Cookies and saved settings');
    expect(section).toHaveTextContent(/Global Privacy Control/);
    expect(section).toHaveTextContent(/tracks no one/);
    expect(section).toHaveTextContent(/honors the signal by default/);
  });

  it('says nothing about tracking and links nowhere to the Cookie Policy', async () => {
    await renderPrivacy();
    await sectionOf('Changes to this policy');
    const article = screen.getByRole('article');
    const gones = [
      /Cookie Settings/,
      /Clear my/,
      /visitor stats/i,
      /visitor id/i,
      /referrer/i,
      /device/i,
      /page speed/i,
    ];
    for (const gone of gones) {
      expect(article).not.toHaveTextContent(gone);
    }
    const hrefs = within(article)
      .queryAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/cookies');
    expect(article).not.toHaveTextContent(/Cookie Policy/);
  });

  it('names the eight rights under RA 10173', async () => {
    await renderPrivacy();
    const section = await sectionOf('Your rights');
    expect([...section.querySelectorAll('dt')].map((node) => node.textContent)).toEqual([
      'To be informed',
      'To access',
      'To object',
      'To erasure or blocking',
      'To correct (rectification)',
      'To data portability',
      'To damages',
      'To complain to the National Privacy Commission',
    ]);
  });

  it('shows the contact lines and says the owner answers as Data Protection Officer', async () => {
    await renderPrivacy();
    const scope = within(await sectionOf('How to ask about your data'));
    expect(await scope.findByRole('link', { name: 'shop-private@example.test' })).toHaveAttribute(
      'href',
      'mailto:shop-private@example.test',
    );
    expect(scope.getByRole('link', { name: /^Message us on Messenger/ })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(scope.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
    expect(scope.getByText(/The owner, as our Data Protection Officer, answers/)).toBeInTheDocument();
  });

  it('points to the National Privacy Commission with a link that opens in a new tab', async () => {
    await renderPrivacy();
    const section = await sectionOf('Complaints to the National Privacy Commission');
    const link = within(section).getByRole('link', { name: /^privacy\.gov\.ph/ });
    expect(link).toHaveAttribute('href', 'https://www.privacy.gov.ph');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('privacy.gov.ph (opens in a new tab)');
    expect(section).toHaveTextContent(
      'You can complain to the National Privacy Commission at privacy.gov.ph (opens in a new tab). We ask that you contact us first so we can fix it.',
    );
  });

  it('claims no lawyer review and promises no reply time', async () => {
    await renderPrivacy();
    await sectionOf('Changes to this policy');
    const article = screen.getByRole('article');
    expect(article).not.toHaveTextContent(/lawyer|attorney|legally reviewed/i);
    expect(article).not.toHaveTextContent(/working days|within \d+ /i);
  });

  it('has zero axe violations', async () => {
    const { container } = await renderPrivacy();
    await screen.findByRole('link', { name: 'shop-private@example.test' });
    await expectNoAxeViolations(container);
  });
});
