// SPEC-GAP: LEGAL-01, D-01 to D-06, D-11, D-12, D-36. The Privacy Policy at /privacy: who runs the site (from the site settings) and the
// retention list, character for character from the owner's rulings.
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';

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
