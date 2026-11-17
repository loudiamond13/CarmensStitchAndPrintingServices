// SPEC-GAP: LEGAL-03, D-08, D-10. The Terms of Use at /terms: the sections in order, the quote rule with no promise the owner has
// not given, and the shop's contact lines (UI-SPEC L4).
import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';

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

describe('TermsPage at /terms (LEGAL-03)', { timeout: 20_000 }, () => {
  it('shows one h1 and the first three sections in order', async () => {
    await renderTerms();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await sectionNames()).toEqual(['About these terms', 'Using this website', 'Prices and quotes']);
  });

  it('says prices are a guide and the quote confirms the rest', async () => {
    await renderTerms();
    expect(await screen.findByText(/we will confirm this with you in your quote/)).toBeInTheDocument();
    expect(screen.getByText(/prices on this website are a guide/i)).toBeInTheDocument();
  });

  it('promises no payment share, turnaround time or refund rule', async () => {
    await renderTerms();
    await screen.findByRole('heading', { level: 2, name: 'Prices and quotes' });
    expect(screen.queryByText(/refund|deposit|down payment|working days|within \d+|\d+ ?%/i)).not.toBeInTheDocument();
  });
});
