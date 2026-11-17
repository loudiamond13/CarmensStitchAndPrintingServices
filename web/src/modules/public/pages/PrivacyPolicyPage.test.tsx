// SPEC-GAP: LEGAL-01, D-01 to D-06, D-11, D-12, D-36. The Privacy Policy at /privacy: who runs the site (from the site settings) and the
// retention list, character for character from the owner's rulings.
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
  ["Quote requests that didn't become an order, and their files", 'Deleted 6 months after we receive them.'],
  [
    'Visitor stats (visits, pages and page speed)',
    'Kept for about 13 months; removed at the next monthly cleanup. After that we keep only daily totals, which have no visitor id.',
  ],
  ['Daily visitor totals', 'Deleted after 3 years. They have no visitor id.'],
  [
    'Your cookie choice',
    'Kept for about 13 months; removed at the next monthly cleanup. A choice lasts 12 months, plus 1 month.',
  ],
  ['Staff account activity log', 'Kept for 8 months.'],
];

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

  it('lists the six retention lines exactly as the owner ruled them', async () => {
    await renderPrivacy();
    const section = await sectionOf('How long we keep it');
    const terms = [...section.querySelectorAll('dt')].map((node) => node.textContent);
    const texts = [...section.querySelectorAll('dd')].map((node) => node.textContent);
    expect(terms).toEqual(RETENTION.map(([term]) => term));
    expect(texts).toEqual(RETENTION.map(([, text]) => text));
  });
});

const SECTIONS = [
  'Who we are',
  'What we collect',
  'Why we use it',
  'Photos of your order',
  'Who else handles it',
  'How long we keep it',
  'Your rights',
  'How to ask about your data',
  'Complaints to the National Privacy Commission',
  'Changes to this policy',
];

describe('PrivacyPolicyPage sections (LEGAL-01, D-15, D-40)', { timeout: 20_000 }, () => {
  it('shows the ten sections in order', async () => {
    await renderPrivacy();
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
    expect(names).toEqual(SECTIONS);
  });

  it('says what is collected for each purpose, and that visitor stats need consent', async () => {
    await renderPrivacy();
    const section = await sectionOf('What we collect');
    expect(within(section).getAllByRole('listitem')).toHaveLength(5);
    expect(section).toHaveTextContent(/quote request/i);
    expect(section).toHaveTextContent(/only if you allow/i);
    expect(section).toHaveTextContent(/staff account/i);
  });

  it('gives each purpose its basis in plain words', async () => {
    await renderPrivacy();
    const section = await sectionOf('Why we use it');
    const terms = [...section.querySelectorAll('dt')].map((node) => node.textContent);
    expect(terms).toEqual(['Orders and payments', 'Quote requests', 'Visitor stats and the map', 'Staff accounts']);
    expect(section).toHaveTextContent(/contract with you/);
    expect(section).toHaveTextContent(/the law says we must/);
    expect(section).toHaveTextContent(/legitimate interest in keeping/);
    expect(section).toHaveTextContent(/your consent/);
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
    expect(items[3]).toHaveTextContent(/only if you allow/i);
    expect(section).not.toHaveTextContent(/data cent(?:er|re)|server/i);
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
