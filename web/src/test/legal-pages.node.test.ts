// @vitest-environment node
// SPEC-GAP: LEGAL-05, D-10, D-22. The web copy of the legal page facts equals tests/fixtures/legal-pages.json, the file the
// Domain LegalPages test is also checked against, so the server and the web cannot drift apart.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_PAGES, type LegalPageKey } from '../modules/public/legalPages';

interface SharedPage {
  key: LegalPageKey;
  path: string;
  version: string;
  lastUpdated: string;
  approved: boolean;
}

const shared = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/legal-pages.json'), 'utf8')) as {
    pages: SharedPage[];
  }
).pages;

describe('the web legal page facts and the shared file (LEGAL-05, D-10)', () => {
  it('has the same three pages, in the same order', () => {
    expect(Object.keys(LEGAL_PAGES)).toEqual(shared.map((page) => page.key));
    expect(Object.keys(LEGAL_PAGES)).toEqual(['privacy', 'terms', 'accessibility']);
  });

  it.each(shared)('matches the shared facts of $key (key, path, version, lastUpdated, approved)', (page) => {
    const meta = LEGAL_PAGES[page.key];
    expect({
      key: meta.key,
      path: meta.path,
      version: meta.version,
      lastUpdated: meta.lastUpdated,
      approved: meta.approved,
    }).toEqual(page);
  });

  it('has the Privacy Policy approved at version 1.1, last updated 2026-11-25 (D-45), and the other two approved at 1.0', () => {
    const facts = (key: LegalPageKey) => {
      const meta = LEGAL_PAGES[key];
      return { version: meta.version, lastUpdated: meta.lastUpdated, approved: meta.approved };
    };
    expect(facts('privacy')).toEqual({ version: '1.1', lastUpdated: '2026-11-25', approved: true });
    expect(facts('terms').version).toBe('1.0');
    expect(facts('terms').approved).toBe(true);
    expect(facts('accessibility').version).toBe('1.0');
    expect(facts('accessibility').approved).toBe(true);
    const privacy = shared.find((page) => page.key === 'privacy');
    expect(privacy).toMatchObject({ version: '1.1', lastUpdated: '2026-11-25', approved: true });
  });

  it('gives every page a version of digits.digits and a real YYYY-MM-DD date', () => {
    for (const meta of Object.values(LEGAL_PAGES)) {
      expect(meta.version).toMatch(/^\d+\.\d+$/);
      expect(meta.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(`${meta.lastUpdated}T00:00:00Z`);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(date.toISOString().slice(0, 10)).toBe(meta.lastUpdated);
    }
  });

  it('gives every page its UI-SPEC title, crumb, eyebrow, headline and lead', () => {
    expect(Object.values(LEGAL_PAGES).map((meta) => meta.title)).toEqual([
      'Privacy Policy · CSPS',
      'Terms of Use · CSPS',
      'Accessibility Statement · CSPS',
    ]);
    expect(Object.values(LEGAL_PAGES).map((meta) => meta.crumb)).toEqual([
      'Privacy Policy',
      'Terms of Use',
      'Accessibility Statement',
    ]);
    for (const meta of Object.values(LEGAL_PAGES)) {
      expect(meta.eyebrow).not.toBe('');
      expect(meta.headline.plain).not.toBe('');
      expect(meta.headline.accent.endsWith('.')).toBe(true);
      expect(meta.lead).not.toBe('');
    }
  });
});
