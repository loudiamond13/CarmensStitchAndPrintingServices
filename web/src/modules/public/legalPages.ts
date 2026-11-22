// SPEC-GAP: the legal page facts and heads (LEGAL-05, D-10, D-14, D-22). The path, version, date and approval flag equal
// tests/fixtures/legal-pages.json and the Domain LegalPages; tests fail when they drift. A page is a draft until `approved` is
// true: it shows the DRAFT notice, and the server keeps it out of search results and the sitemap. Titles are the strings the
// server sends (PublicPageHeads.cs), and each lead is the meta description.
// They sit apart from copy.ts so the first download of every public page does not grow (PERF-01).

export type LegalPageKey = 'privacy' | 'terms' | 'accessibility';

export interface LegalPageMeta {
  readonly key: LegalPageKey;
  readonly path: string;
  readonly version: string;
  /** YYYY-MM-DD. */
  readonly lastUpdated: string;
  readonly approved: boolean;
  readonly title: string;
  /** The breadcrumb's current page. */
  readonly crumb: string;
  readonly eyebrow: string;
  readonly headline: { readonly plain: string; readonly accent: string };
  readonly lead: string;
}

export const LEGAL_PAGES: Readonly<Record<LegalPageKey, LegalPageMeta>> = {
  privacy: {
    key: 'privacy',
    path: '/privacy',
    version: '1.1',
    lastUpdated: '2026-11-22',
    approved: false,
    title: 'Privacy Policy · CSPS',
    crumb: 'Privacy Policy',
    eyebrow: 'Your privacy',
    headline: { plain: 'Privacy', accent: 'policy.' },
    lead: 'How we collect, use and protect your personal information, and your rights under the Data Privacy Act of 2012.',
  },
  terms: {
    key: 'terms',
    path: '/terms',
    version: '1.0',
    lastUpdated: '2026-11-18',
    approved: true,
    title: 'Terms of Use · CSPS',
    crumb: 'Terms of Use',
    eyebrow: 'Using this site',
    headline: { plain: 'Terms of', accent: 'use.' },
    lead: 'The rules for using this website and asking us for a quote.',
  },
  accessibility: {
    key: 'accessibility',
    path: '/accessibility',
    version: '1.0',
    lastUpdated: '2026-11-18',
    approved: true,
    title: 'Accessibility Statement · CSPS',
    crumb: 'Accessibility Statement',
    eyebrow: 'For everyone',
    headline: { plain: 'Accessibility', accent: 'statement.' },
    lead: 'We want everyone to be able to use this website. Here is what we do, and how to tell us about a problem.',
  },
};
