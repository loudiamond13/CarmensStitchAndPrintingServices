// @vitest-environment node
// SPEC-GAP: LEGAL-05, D-10. Guards the shape of every legal text module: at least one section, unique kebab-case ids, a heading on
// each section, only safe link targets and no long dash. A text module is any web/src/modules/public/legal*.ts apart from the shared
// files below, so the plans that add the Privacy, Terms and Cookie texts never edit this test.
import { describe, expect, it } from 'vitest';
import type { LegalBlock, LegalInline, LegalText } from '../modules/public/legalContent';

const modules = import.meta.glob<Record<string, unknown>>('../modules/public/legal*.ts', { eager: true });

/** Shared files that are not text modules. */
const SHARED = new Set(['legalPages.ts', 'legalCopy.ts', 'legalContent.ts', 'legalLoaders.ts']);

const textModules = Object.entries(modules)
  .map(([path, exports]) => ({ file: path.split('/').pop() ?? path, exports }))
  .filter(({ file }) => !SHARED.has(file) && !file.includes('.test.'));

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2012)}-${String.fromCharCode(0x2015)}]`);
const SAFE_HREF = /^(?:\/|mailto:|tel:|https:\/\/)/;

function isLegalText(value: unknown): value is LegalText {
  return typeof value === 'object' && value !== null && 'sections' in value && Array.isArray(value.sections);
}

function inlineProblems(where: string, parts: readonly LegalInline[]): string[] {
  return parts.flatMap((part, index) => {
    const here = `${where} part ${String(index)}`;
    if (typeof part === 'string') {
      return LONG_DASH.test(part) ? [`${here}: long dash`] : [];
    }
    return [
      ...(SAFE_HREF.test(part.href) ? [] : [`${here}: href "${part.href}" is not /, mailto:, tel: or https://`]),
      ...(part.text.trim() === '' ? [`${here}: empty link text`] : []),
      ...(LONG_DASH.test(part.text) ? [`${here}: long dash`] : []),
    ];
  });
}

function blockProblems(where: string, block: LegalBlock): string[] {
  switch (block.kind) {
    case 'p':
      return inlineProblems(where, block.parts);
    case 'ul':
      return block.items.flatMap((parts, index) => inlineProblems(`${where} item ${String(index)}`, parts));
    case 'dl':
      return block.items.flatMap((item) => [
        ...(item.term.trim() === '' ? [`${where}: empty term`] : []),
        ...(LONG_DASH.test(item.term) ? [`${where}: long dash in "${item.term}"`] : []),
        ...inlineProblems(`${where} term "${item.term}"`, item.parts),
      ]);
    case 'h3':
      return [
        ...(block.text.trim() === '' ? [`${where}: empty h3`] : []),
        ...(LONG_DASH.test(block.text) ? [`${where}: long dash in the h3`] : []),
      ];
    case 'facts':
      return block.show.length === 0 ? [`${where}: facts block shows nothing`] : [];
  }
}

/** Every way a text module breaks the shape; an empty list means it is sound. */
export function legalTextProblems(text: LegalText): string[] {
  if (text.sections.length === 0) {
    return ['no sections'];
  }
  const seen = new Set<string>();
  return text.sections.flatMap((section) => {
    const where = `section "${section.id}"`;
    const problems: string[] = [];
    if (!KEBAB.test(section.id)) {
      problems.push(`${where}: id is not kebab-case`);
    }
    if (seen.has(section.id)) {
      problems.push(`${where}: duplicate id`);
    }
    seen.add(section.id);
    if (section.heading.trim() === '') {
      problems.push(`${where}: empty heading`);
    }
    if (LONG_DASH.test(section.heading)) {
      problems.push(`${where}: long dash in the heading`);
    }
    if (section.blocks.length === 0) {
      problems.push(`${where}: no blocks`);
    }
    return [
      ...problems,
      ...section.blocks.flatMap((block, index) => blockProblems(`${where} block ${String(index)}`, block)),
    ];
  });
}

const META = {
  key: 'accessibility',
  path: '/accessibility',
  version: '0.1',
  lastUpdated: '2026-11-15',
  approved: false,
  title: 'T',
  crumb: 'C',
  eyebrow: 'E',
  headline: { plain: 'P', accent: 'A.' },
  lead: 'L',
} as const;

const sample = (sections: LegalText['sections']): LegalText => ({ meta: META, sections });
const para = (...parts: LegalInline[]): LegalBlock => ({ kind: 'p', parts });

describe('legal text modules (LEGAL-05, D-10)', () => {
  it('finds the Accessibility text module by its file name', () => {
    expect(textModules.map(({ file }) => file)).toContain('legalAccessibility.ts');
  });

  it.each(textModules.map(({ file, exports }) => [file, exports] as const))(
    '%s exports a sound text',
    (_file, exports) => {
      const texts = Object.values(exports).filter(isLegalText);
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(legalTextProblems(text)).toEqual([]);
      }
    },
  );

  it('takes the version, date and approval flag from legalPages.ts', async () => {
    const { LEGAL_PAGES } = await import('../modules/public/legalPages');
    const { ACCESSIBILITY_TEXT } = await import('../modules/public/legalAccessibility');
    expect(ACCESSIBILITY_TEXT.meta).toBe(LEGAL_PAGES.accessibility);
  });
});

describe('legalTextProblems (the guard itself)', () => {
  it('passes a sound text', () => {
    expect(legalTextProblems(sample([{ id: 'one', heading: 'One', blocks: [para('Hello.')] }]))).toEqual([]);
  });

  it('fails a text with no sections', () => {
    expect(legalTextProblems(sample([]))).toEqual(['no sections']);
  });

  it('fails a duplicate section id', () => {
    const problems = legalTextProblems(
      sample([
        { id: 'one', heading: 'One', blocks: [para('A.')] },
        { id: 'one', heading: 'Two', blocks: [para('B.')] },
      ]),
    );
    expect(problems).toEqual(['section "one": duplicate id']);
  });

  it('fails an empty heading and an id that is not kebab-case', () => {
    const problems = legalTextProblems(sample([{ id: 'Not Kebab', heading: '  ', blocks: [para('A.')] }]));
    expect(problems).toContain('section "Not Kebab": empty heading');
    expect(problems).toContain('section "Not Kebab": id is not kebab-case');
  });

  it('fails a section with no blocks', () => {
    expect(legalTextProblems(sample([{ id: 'one', heading: 'One', blocks: [] }]))).toEqual([
      'section "one": no blocks',
    ]);
  });

  it('fails a link that is not /, mailto:, tel: or https://', () => {
    const bad = legalTextProblems(
      sample([{ id: 'one', heading: 'One', blocks: [para({ text: 'x', href: 'javascript:alert(1)' })] }]),
    );
    expect(bad).toHaveLength(1);
    const good = legalTextProblems(
      sample([
        {
          id: 'one',
          heading: 'One',
          blocks: [
            para(
              { text: 'a', href: '/privacy' },
              { text: 'b', href: 'mailto:someone@example.test' },
              { text: 'c', href: 'tel:+639170000000' },
              { text: 'd', href: 'https://example.test', external: true },
            ),
          ],
        },
      ]),
    );
    expect(good).toEqual([]);
  });

  it('fails a long dash in a heading and in running text', () => {
    const em = String.fromCharCode(0x2014);
    const en = String.fromCharCode(0x2013);
    const problems = legalTextProblems(sample([{ id: 'one', heading: `One ${em} two`, blocks: [para(`A ${en} b`)] }]));
    expect(problems).toHaveLength(2);
  });
});
