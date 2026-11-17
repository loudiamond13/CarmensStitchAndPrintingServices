// SPEC-GAP: LEGAL-05, D-14. The legal pages open inside the public layout with the DRAFT notice, the crumbs, the eyebrow, the h1
// with its accent word, the version line and the lead (UI-SPEC L1).
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';

/** The real route tree at a legal path, settled once the h1 is on screen. */
async function renderLegal(path: string, name: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name }, { timeout: 15_000 });
  return { ...view, router };
}

describe('PrivacyPolicyPage at /privacy (LEGAL-01, LEGAL-05, D-14)', { timeout: 20_000 }, () => {
  it('shows one h1 with "policy." in the em, the eyebrow and the lead', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent('policy.');
    expect(screen.getByText('Your privacy')).toBeInTheDocument();
    expect(
      screen.getByText(
        'How we collect, use and protect your personal information, and your rights under the Data Privacy Act of 2012.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the DRAFT notice above the crumbs while the page is not approved', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    const notice = screen.getByText('Draft: this text is not final yet.');
    expect(screen.getByText("It may change before it's approved.")).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(notice.compareDocumentPosition(crumbs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText('Privacy Policy')).toHaveAttribute('aria-current', 'page');
  });

  it('does not make the notice a live region', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    const label = screen.getByText('Draft: this text is not final yet.');
    expect(label.closest('[role="alert"], [role="status"], [aria-live]')).toBeNull();
  });

  it('shows the version line exactly, after the h1 and before the lead', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    const version = screen.getByText('Version 0.1 · Last updated Nov 15, 2026');
    const h1 = screen.getByRole('heading', { level: 1 });
    const lead = screen.getByText(/^How we collect, use and protect/);
    expect(h1.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(version.compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sets the document title the server sends', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    expect(document.title).toBe('Privacy Policy · CSPS');
  });

  it('sits inside the public layout with the base footer', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });
});
