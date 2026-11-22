// @vitest-environment node
// SPEC-GAP: LEGAL-05, D-10. Guards the shape of every legal text module: at least one section, unique kebab-case ids, a heading on
// each section, only safe link targets and no long dash. Every internal link points at a public path (D-72). A text module is any
// web/src/modules/public/legal*.ts apart from the shared files below, so the plans that add a text never edit this test.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LegalBlock, LegalInline, LegalText } from '../modules/public/legalContent';
import { PRIVACY_TEXT } from '../modules/public/legalPrivacy';

/** Shared files that are not text modules. */
const SHARED = new Set(['legalPages.ts', 'legalCopy.ts', 'legalContent.ts', 'legalLoaders.ts']);

const publicDir = fileURLToPath(new URL('../modules/public/', import.meta.url));

const textFiles = readdirSync(publicDir).filter(
  (file) => /^legal.*\.ts$/.test(file) && !SHARED.has(file) && !file.includes('.test.'),
);

/** The legal texts a module exports. */
async function textsOf(file: string): Promise<LegalText[]> {
  const loaded: unknown = await import(/* @vite-ignore */ `../modules/public/${file}`);
  return typeof loaded === 'object' && loaded !== null ? Object.values(loaded).filter(isLegalText) : [];
}

const PUBLIC_PATHS: readonly string[] = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../tests/fixtures/public-paths.json', import.meta.url)), 'utf8'),
  ) as { pages: string[] }
).pages;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2012)}-${String.fromCharCode(0x2015)}]`);
const SAFE_HREF = /^(?:\/(?!\/)|mailto:|tel:|https:\/\/)/;

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
        ...(item.more ?? []).flatMap((parts, index) =>
          inlineProblems(`${where} term "${item.term}" line ${String(index + 2)}`, parts),
        ),
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

/** The internal links of a text (not external, starting with /) that are not a listed public path; the query and hash are ignored. */
export function internalLinkProblems(text: LegalText, publicPaths: readonly string[]): string[] {
  const hrefs: string[] = [];
  const collect = (parts: readonly LegalInline[]) => {
    for (const part of parts) {
      if (typeof part !== 'string' && part.external !== true && part.href.startsWith('/')) {
        hrefs.push(part.href);
      }
    }
  };
  for (const section of text.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'p') {
        collect(block.parts);
      } else if (block.kind === 'ul') {
        block.items.forEach(collect);
      } else if (block.kind === 'dl') {
        for (const item of block.items) {
          collect(item.parts);
          (item.more ?? []).forEach(collect);
        }
      }
    }
  }
  return hrefs
    .filter((href) => !publicPaths.includes(href.split(/[?#]/)[0] ?? ''))
    .map((href) => `${href} is not a public path`);
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

/** Every block kind LegalBlock allows; a retired kind such as the Cookie Settings button is not here. */
const KNOWN_KINDS = new Set(['p', 'ul', 'dl', 'h3', 'facts']);

const sample = (sections: LegalText['sections']): LegalText => ({ meta: META, sections });
const para = (...parts: LegalInline[]): LegalBlock => ({ kind: 'p', parts });

describe('legal text modules (LEGAL-05, D-10)', () => {
  it('finds the Accessibility, Privacy and Terms text modules by their file names', () => {
    expect(textFiles).toEqual(expect.arrayContaining(['legalAccessibility.ts', 'legalPrivacy.ts', 'legalTerms.ts']));
  });

  it.each(textFiles)('%s exports a sound text', async (file) => {
    const texts = await textsOf(file);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(legalTextProblems(text)).toEqual([]);
    }
  });

  it.each(textFiles)('%s links only to public paths (D-72)', async (file) => {
    for (const text of await textsOf(file)) {
      expect(internalLinkProblems(text, PUBLIC_PATHS)).toEqual([]);
    }
  });

  it.each(textFiles)('%s uses only the known block kinds, so no retired kind comes back (D-54)', async (file) => {
    const kinds = (await textsOf(file)).flatMap((text) =>
      text.sections.flatMap((section) => section.blocks.map((block) => block.kind as string)),
    );
    expect(kinds.filter((kind) => !KNOWN_KINDS.has(kind))).toEqual([]);
  });

  it('takes the version, date and approval flag from legalPages.ts', async () => {
    const { LEGAL_PAGES } = await import('../modules/public/legalPages');
    const { ACCESSIBILITY_TEXT } = await import('../modules/public/legalAccessibility');
    expect(ACCESSIBILITY_TEXT.meta).toBe(LEGAL_PAGES.accessibility);
  });
});

const inlineText = (parts: readonly LegalInline[]) =>
  parts.map((part) => (typeof part === 'string' ? part : part.text)).join('');

/** Every string in a block, flattened, so a text check does not depend on how the block is split into parts. */
function blockText(block: LegalBlock): string[] {
  switch (block.kind) {
    case 'p':
      return [inlineText(block.parts)];
    case 'ul':
      return block.items.map(inlineText);
    case 'dl':
      return block.items.flatMap((item) => [item.term, inlineText(item.parts), ...(item.more ?? []).map(inlineText)]);
    case 'h3':
      return [block.text];
    case 'facts':
      return [];
  }
}

describe('the Privacy Policy covers quote requests (D-28, D-22, D-04, D-34, D-27)', () => {
  const section = (id: string) => {
    const found = PRIVACY_TEXT.sections.find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new Error(`The Privacy Policy has no "${id}" section.`);
    }
    return found;
  };
  const lines = (id: string) => section(id).blocks.flatMap(blockText);
  const all = PRIVACY_TEXT.sections.flatMap((candidate) => [candidate.heading, ...candidate.blocks.flatMap(blockText)]);

  it('keeps the three quote request retention rows word for word (UI-SPEC L2)', () => {
    const rows = section('how-long-we-keep-it').blocks.flatMap((block) =>
      block.kind === 'dl' ? block.items.map((item) => [item.term, inlineText(item.parts)]) : [],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        ["Quote requests that didn't become an order, and their photos", 'Deleted 6 months after we receive them.'],
        ['Quote requests that became an order, and their photos', 'Kept as long as the order.'],
        ['Photos sent with a request we mark as spam', 'Deleted within a day.'],
      ]),
    );
  });

  it('words every cleanup row for the daily cleanup and never says "monthly cleanup" (D-34)', () => {
    expect(all.filter((line) => /monthly cleanup/i.test(line))).toEqual([]);
    expect(lines('how-long-we-keep-it')).toEqual(
      expect.arrayContaining([
        'Deleted about 3 years after the day they count.',
        'Deleted about 8 months after it is recorded.',
      ]),
    );
  });

  it('names every quote form field and the photos in "What we collect"', () => {
    const line = lines('what-we-collect').find((text) => /quote request/i.test(text));
    expect(line).toBeDefined();
    for (const field of ['name', 'team', 'mobile number', 'email', 'product', 'quantity', 'message', 'photos']) {
      expect(line).toContain(field);
    }
  });

  it('says a quote request is used only to reply and prepare a quote in "Why we use it"', () => {
    expect(lines('why-we-use-it').join(' ')).toMatch(/Quote requests.*only to reply.*prepare.*quote/i);
  });

  it('says Cloudinary stores the quote request photos in "Who else handles it"', () => {
    const cloudinary = lines('who-else-handles-it').filter((text) => text.includes('Cloudinary'));
    expect(cloudinary).toHaveLength(1);
    expect(cloudinary[0]).toMatch(/quote request/i);
  });

  it('promises no more than the site does: no "never share" line and no email to the visitor (D-27, D-10)', () => {
    expect(all.filter((line) => /never share|we do not share|confirmation email/i.test(line))).toEqual([]);
  });

  it('no longer exports the held quote request lines', async () => {
    const loaded: Record<string, unknown> = await import('../modules/public/legalPrivacy');
    expect('PRIVACY_QUOTE_REQUEST_LINES' in loaded).toBe(false);
  });
});

describe('internalLinkProblems (the guard itself)', () => {
  const paths = ['/', '/privacy'];

  it('passes a link to a public path, with or without a hash, and leaves external and mailto links alone', () => {
    const text = sample([
      {
        id: 'one',
        heading: 'One',
        blocks: [
          para(
            { text: 'a', href: '/privacy' },
            { text: 'b', href: '/privacy#cookies' },
            { text: 'c', href: '/.well-known/gpc.json', external: true },
            { text: 'd', href: 'mailto:someone@example.test' },
          ),
        ],
      },
    ]);
    expect(internalLinkProblems(text, paths)).toEqual([]);
  });

  it('fails a link to a page that does not exist, such as the removed Cookie Policy', () => {
    const text = sample([{ id: 'one', heading: 'One', blocks: [para({ text: 'cookies', href: '/cookies' })] }]);
    expect(internalLinkProblems(text, paths)).toEqual(['/cookies is not a public path']);
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

  it('fails a protocol-relative link, even when it is marked external', () => {
    const problems = legalTextProblems(
      sample([
        {
          id: 'one',
          heading: 'One',
          blocks: [para({ text: 'x', href: '//other.example/page', external: true })],
        },
      ]),
    );
    expect(problems).toEqual([
      'section "one" block 0 part 0: href "//other.example/page" is not /, mailto:, tel: or https://',
    ]);
  });

  it('checks the extra description lines of a term too', () => {
    const en = String.fromCharCode(0x2013);
    const bad = legalTextProblems(
      sample([
        {
          id: 'one',
          heading: 'One',
          blocks: [
            {
              kind: 'dl',
              items: [
                { term: 'T', parts: ['A.'], more: [['B.'], [`C ${en} d`, { text: 'x', href: 'ftp://example.test' }]] },
              ],
            },
          ],
        },
      ]),
    );
    expect(bad).toEqual([
      'section "one" block 0 term "T" line 3 part 0: long dash',
      'section "one" block 0 term "T" line 3 part 1: href "ftp://example.test" is not /, mailto:, tel: or https://',
    ]);
  });

  it('fails a long dash in a heading and in running text', () => {
    const em = String.fromCharCode(0x2014);
    const en = String.fromCharCode(0x2013);
    const problems = legalTextProblems(sample([{ id: 'one', heading: `One ${em} two`, blocks: [para(`A ${en} b`)] }]));
    expect(problems).toHaveLength(2);
  });
});
