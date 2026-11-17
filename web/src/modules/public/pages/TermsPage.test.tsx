// SPEC-GAP: LEGAL-03, D-08, D-10. The Terms of Use at /terms: the ten sections in order, the quote rule with no promise the owner has
// not given, Philippine law by name and number, and the shop's contact lines (UI-SPEC L4).
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /terms, settled once the page head is on screen. */
async function renderTerms() {
  const router = createMemoryRouter(routes, { initialEntries: ['/terms'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Terms of use.' }, { timeout: 15_000 });
  return view;
}

async function sectionNames() {
  return (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
}

/** The section that holds the h2 with this name. */
async function sectionOf(name: string): Promise<HTMLElement> {
  const section = (await screen.findByRole('heading', { level: 2, name })).closest('section');
  if (section === null) {
    throw new Error(`The "${name}" heading is not inside a section.`);
  }
  return section;
}

describe('TermsPage at /terms (LEGAL-03)', { timeout: 20_000 }, () => {
  it('shows one h1 and the ten sections in order', async () => {
    await renderTerms();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await sectionNames()).toEqual([
      'About these terms',
      'Using this website',
      'Prices and quotes',
      'Your designs, logos and names',
      'Photos of our work',
      'Links to other sites',
      'Our responsibility',
      'Philippine law',
      'Changes to these terms',
      'Contact us',
    ]);
  });

  it('says prices are a guide and the quote confirms the rest', async () => {
    await renderTerms();
    expect(await screen.findByText(/we will confirm this with you in your quote/)).toBeInTheDocument();
    expect(screen.getByText(/prices on this website are a guide/i)).toBeInTheDocument();
  });

  it('promises no payment share, turnaround time, refund rule or warranty', async () => {
    await renderTerms();
    await screen.findByRole('heading', { level: 2, name: 'Contact us' });
    expect(
      screen.queryByText(/refund|deposit|down payment|warrant(?:y|ies)|guarantee|working days|within \d+|\d+ ?%/i),
    ).not.toBeInTheDocument();
  });

  it('says the customer may use the designs they send and the shop uses them only to make the order', async () => {
    await renderTerms();
    const scope = within(await sectionOf('Your designs, logos and names'));
    expect(scope.getByText(/you are allowed to use the designs, logos and names you send us/i)).toBeInTheDocument();
    expect(scope.getByText(/only to make your order/i)).toBeInTheDocument();
  });

  it('shows photos of finished work only when the customer said it is OK', async () => {
    await renderTerms();
    const scope = within(await sectionOf('Photos of our work'));
    expect(scope.getByText(/only when the customer has said it is OK/i)).toBeInTheDocument();
  });

  it('keeps consumer rights: the responsibility section limits none of them', async () => {
    await renderTerms();
    const scope = within(await sectionOf('Our responsibility'));
    expect(scope.getByText(/does not take away any right you have under Philippine consumer law/i)).toBeInTheDocument();
  });

  it('names the Consumer Act (RA 7394) and the Internet Transactions Act of 2023 (RA 11967)', async () => {
    await renderTerms();
    const scope = within(await sectionOf('Philippine law'));
    expect(scope.getByText(/These terms follow Philippine law/)).toBeInTheDocument();
    expect(scope.getByText(/Consumer Act of the Philippines \(RA 7394\)/)).toBeInTheDocument();
    expect(scope.getByText(/Internet Transactions Act of 2023 \(RA 11967\)/)).toBeInTheDocument();
    expect(scope.getByText(/Nothing in these terms takes away your rights under those laws/)).toBeInTheDocument();
  });

  it('shows the email as a mailto link, Messenger and the main phone as a tel link', async () => {
    await renderTerms();
    const scope = within(await sectionOf('Contact us'));
    expect(await scope.findByRole('link', { name: 'shop-private@example.test' })).toHaveAttribute(
      'href',
      'mailto:shop-private@example.test',
    );
    const messenger = scope.getByRole('link', { name: /^Message us on Messenger/ });
    expect(messenger).toHaveAttribute('href', 'https://m.me/cspsdemo');
    expect(messenger).toHaveAttribute('rel', 'noopener noreferrer');
    expect(scope.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });

  it('has zero axe violations', async () => {
    const { container } = await renderTerms();
    await screen.findByRole('link', { name: 'shop-private@example.test' });
    await expectNoAxeViolations(container);
  });
});
