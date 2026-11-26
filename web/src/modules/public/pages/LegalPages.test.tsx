// SPEC-GAP: LEGAL-05, D-14. The legal pages open inside the public layout with the crumbs, the eyebrow, the h1 with its accent
// word, the version line and the lead (UI-SPEC L1). Version, date and approval come from tests/fixtures/legal-pages.json, so the
// owner's later yes (D-73) changes the fixture and the two facts only, not these tests. The DRAFT notice is also tested on metas
// built here.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { inStrictMode } from '@/test/strictMode';
import { LegalPage } from '../components/LegalPage';
import { LEGAL_PAGES, type LegalPageKey, type LegalPageMeta } from '../legalPages';

interface SharedPage {
  key: LegalPageKey;
  version: string;
  lastUpdated: string;
  approved: boolean;
}

const SHARED = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../../tests/fixtures/legal-pages.json'), 'utf8')) as {
    pages: SharedPage[];
  }
).pages;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DRAFT_NOTICE = 'Draft: this text is not final yet.';

function shared(key: LegalPageKey): SharedPage {
  const page = SHARED.find((row) => row.key === key);
  if (page === undefined) {
    throw new Error(`The shared fixture has no "${key}" page.`);
  }
  return page;
}

/** The version line the page shows, built from the fixture row. */
function versionLine(key: LegalPageKey): string {
  const { version, lastUpdated } = shared(key);
  const [year = '', month = '1', day = '1'] = lastUpdated.split('-');
  return `Version ${version} · Last updated ${MONTHS[Number(month) - 1] ?? ''} ${String(Number(day))}, ${year}`;
}

/** The DRAFT notice shows exactly when the fixture says the page is not approved. */
function expectDraftNoticeFollowsFixture(key: LegalPageKey) {
  expect(screen.queryAllByText(DRAFT_NOTICE)).toHaveLength(shared(key).approved ? 0 : 1);
}

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

  it('shows the DRAFT notice only while the shared fixture says it is not approved, and "Home / Privacy Policy" in the crumbs', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    expectDraftNoticeFollowsFixture('privacy');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText('Privacy Policy')).toHaveAttribute('aria-current', 'page');
  });

  it('is approved at version 1.1 with no DRAFT notice (D-45)', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    expect(screen.queryAllByText(DRAFT_NOTICE)).toHaveLength(0);
    expect(screen.getByText('Version 1.1 · Last updated Nov 25, 2026')).toBeInTheDocument();
  });

  it('shows the version line exactly, after the h1 and before the lead', async () => {
    await renderLegal('/privacy', 'Privacy policy.');
    const version = screen.getByText(versionLine('privacy'));
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

describe('the old Cookie Policy address (D-72)', { timeout: 20_000 }, () => {
  it('shows the normal page not found, with the not-found title and no redirect', async () => {
    const { router } = await renderLegal('/cookies', 'Out of bounds.');
    expect(screen.getByText('Error 404')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cookies');
    expect(document.title).toBe('Page Not Found · CSPS');
  });
});

const PAGES = [
  {
    key: 'privacy',
    path: '/privacy',
    crumb: 'Privacy Policy',
    eyebrow: 'Your privacy',
    h1: 'Privacy policy.',
    accent: 'policy.',
  },
  {
    key: 'terms',
    path: '/terms',
    crumb: 'Terms of Use',
    eyebrow: 'Using this site',
    h1: 'Terms of use.',
    accent: 'use.',
  },
  {
    key: 'accessibility',
    path: '/accessibility',
    crumb: 'Accessibility Statement',
    eyebrow: 'For everyone',
    h1: 'Accessibility statement.',
    accent: 'statement.',
  },
] as const;

describe.each(PAGES)('the legal page at $path (LEGAL-01 to LEGAL-05)', { timeout: 20_000 }, (page) => {
  it('shows the DRAFT notice per the fixture, then "Home / crumb", the eyebrow, one h1 with its accent word and the version line', async () => {
    await renderLegal(page.path, page.h1);
    expectDraftNoticeFollowsFixture(page.key);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText(page.crumb)).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(page.eyebrow)).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector('em')).toHaveTextContent(page.accent);
    expect(screen.getByText(versionLine(page.key))).toBeInTheDocument();
  });

  it('sets the document title the server sends', async () => {
    await renderLegal(page.path, page.h1);
    expect(document.title).toBe(`${page.crumb} · CSPS`);
  });

  it('shows the same head under StrictMode, whether the render is cached or fresh', async () => {
    await inStrictMode(async () => {
      await renderLegal(page.path, page.h1);
      expectDraftNoticeFollowsFixture(page.key);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByText(versionLine(page.key))).toBeInTheDocument();
      expect(document.title).toBe(`${page.crumb} · CSPS`);
    });
  });
});

function renderMeta(page: LegalPageMeta) {
  return render(
    <MemoryRouter>
      <LegalPage page={page} />
    </MemoryRouter>,
  );
}

describe('LegalPage for an approved and a draft page (LEGAL-05, D-14)', () => {
  /** The Privacy Policy as a draft and the Terms of Use as approved, built here so the tests hold whatever the facts say. */
  const DRAFT_PRIVACY: LegalPageMeta = { ...LEGAL_PAGES.privacy, approved: false };
  const APPROVED_TERMS: LegalPageMeta = { ...LEGAL_PAGES.terms, approved: true };

  it('shows no DRAFT notice and still shows the version line', () => {
    renderMeta(APPROVED_TERMS);
    expect(screen.queryByText('Draft: this text is not final yet.')).not.toBeInTheDocument();
    expect(screen.queryByText("It may change before it's approved.")).not.toBeInTheDocument();
    expect(screen.getByText(versionLine('terms'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of use.' })).toBeInTheDocument();
  });

  it('shows the notice again for the same page while it is not approved', () => {
    renderMeta({ ...LEGAL_PAGES.terms, approved: false });
    expect(screen.getByText('Draft: this text is not final yet.')).toBeInTheDocument();
  });

  it('shows the DRAFT notice above the crumbs while the page is not approved', () => {
    renderMeta(DRAFT_PRIVACY);
    const notice = screen.getByText('Draft: this text is not final yet.');
    expect(screen.getByText("It may change before it's approved.")).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(notice.compareDocumentPosition(crumbs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText('Privacy Policy')).toHaveAttribute('aria-current', 'page');
  });

  it('does not make the notice a live region', () => {
    renderMeta(DRAFT_PRIVACY);
    const label = screen.getByText('Draft: this text is not final yet.');
    expect(label.closest('[role="alert"], [role="status"], [aria-live]')).toBeNull();
  });
});
