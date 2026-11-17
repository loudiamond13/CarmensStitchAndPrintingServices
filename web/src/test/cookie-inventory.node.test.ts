// @vitest-environment node
// SPEC-GAP: LEGAL-02, D-17, T-12-54. The cookies the Cookie Policy lists are exactly the cookies the server sets. The names are read from
// the two C# files that hold the cookie name constants, so a cookie added to or taken out of the code fails here until the policy
// text changes too (and the policy version moves with a reviewed release, D-22).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LegalBlock, LegalInline, LegalText } from '../modules/public/legalContent';
import { COOKIES_TEXT } from '../modules/public/legalCookies';

const SECURITY_DIR = resolve(import.meta.dirname, '../../../src/Csps.Server/Security');
const CODE_FILES = ['AuthCookies.cs', 'AnalyticsCookies.cs'] as const;

/** A cookie name constant in C#: a quoted string with the __Host- or __Secure- prefix. */
const CODE_NAME = /"((?:__Host-|__Secure-)csps_[a-z0-9]+)"/g;
/** A cookie name in the policy text, with or without its prefix, so a name written without it is caught as a mismatch. */
const TEXT_NAME = /(?:__Host-|__Secure-)?csps_[a-z0-9]+/g;

function namesInCode(source: string): string[] {
  return Array.from(source.matchAll(CODE_NAME), (match) => match[1] ?? '');
}

function inlineText(parts: readonly LegalInline[]): string[] {
  return parts.map((part) => (typeof part === 'string' ? part : part.text));
}

function blockText(block: LegalBlock): string[] {
  switch (block.kind) {
    case 'p':
      return inlineText(block.parts);
    case 'ul':
      return block.items.flatMap(inlineText);
    case 'dl':
      return block.items.flatMap((item) => [
        item.term,
        ...inlineText(item.parts),
        ...(item.more ?? []).flatMap(inlineText),
      ]);
    case 'h3':
      return [block.text];
    case 'facts':
    case 'cookie-settings':
      return [];
  }
}

/** Every piece of text the policy shows, headings included. */
function allText(text: LegalText): string[] {
  return text.sections.flatMap((section) => [section.heading, ...section.blocks.flatMap(blockText)]);
}

function namesInText(text: LegalText): string[] {
  return allText(text).flatMap((line) => line.match(TEXT_NAME) ?? []);
}

/** The cookie names that are the term of a description list item. */
function termNames(text: LegalText): string[] {
  return text.sections
    .flatMap((section) => section.blocks)
    .flatMap((block) => (block.kind === 'dl' ? block.items.map((item) => item.term) : []));
}

/** Every way the policy and the code disagree about the cookie names; an empty list means they match. */
export function inventoryProblems(codeNames: readonly string[], text: LegalText): string[] {
  const code = new Set(codeNames);
  const listed = new Set(namesInText(text));
  const terms = new Set(termNames(text));
  return [
    ...[...code].filter((name) => !listed.has(name)).map((name) => `${name} is set by the code but not in the policy`),
    ...[...listed].filter((name) => !code.has(name)).map((name) => `${name} is in the policy but not set by the code`),
    ...[...code]
      .filter((name) => listed.has(name) && !terms.has(name))
      .map((name) => `${name} is not a term of its own`),
  ];
}

const sources = CODE_FILES.map((file) => ({
  file,
  names: namesInCode(readFileSync(resolve(SECURITY_DIR, file), 'utf8')),
}));
const codeNames = sources.flatMap((source) => source.names);

const sample = (blocks: LegalBlock[]): LegalText => ({
  meta: COOKIES_TEXT.meta,
  sections: [{ id: 'one', heading: 'One', blocks }],
});

describe('the Cookie Policy inventory and the code (LEGAL-02, T-12-54)', () => {
  it.each(sources)('reads at least one cookie name from $file', ({ names }) => {
    expect(names.length).toBeGreaterThan(0);
  });

  it('lists every cookie name the code sets', () => {
    const listed = new Set(namesInText(COOKIES_TEXT));
    expect(codeNames.filter((name) => !listed.has(name))).toEqual([]);
  });

  it('names no cookie the code does not set', () => {
    const code = new Set(codeNames);
    expect(namesInText(COOKIES_TEXT).filter((name) => !code.has(name))).toEqual([]);
  });

  it('gives each cookie its own term in a description list', () => {
    const terms = new Set(termNames(COOKIES_TEXT));
    expect(codeNames.filter((name) => !terms.has(name))).toEqual([]);
  });

  it('has no problem as a whole', () => {
    expect(inventoryProblems(codeNames, COOKIES_TEXT)).toEqual([]);
  });
});

describe('inventoryProblems (the guard itself)', () => {
  const dl = (...terms: string[]): LegalBlock => ({
    kind: 'dl',
    items: terms.map((term) => ({ term, parts: ['Text.'] })),
  });

  it('passes a policy that lists exactly the code names', () => {
    expect(
      inventoryProblems(['__Host-csps_a', '__Secure-csps_b'], sample([dl('__Host-csps_a', '__Secure-csps_b')])),
    ).toEqual([]);
  });

  it('fails a cookie the code sets and the policy leaves out', () => {
    expect(inventoryProblems(['__Host-csps_a', '__Secure-csps_b'], sample([dl('__Host-csps_a')]))).toEqual([
      '__Secure-csps_b is set by the code but not in the policy',
    ]);
  });

  it('fails a cookie the policy names and the code does not set', () => {
    expect(inventoryProblems(['__Host-csps_a'], sample([dl('__Host-csps_a', '__Secure-csps_extra')]))).toEqual([
      '__Secure-csps_extra is in the policy but not set by the code',
    ]);
  });

  it('fails a name written without its prefix', () => {
    const problems = inventoryProblems(['__Host-csps_a'], sample([dl('csps_a')]));
    expect(problems).toContain('csps_a is in the policy but not set by the code');
    expect(problems).toContain('__Host-csps_a is set by the code but not in the policy');
  });

  it('fails a cookie that is only mentioned in running text', () => {
    const text = sample([{ kind: 'p', parts: ['We set ', '__Host-csps_a', ' for you.'] }]);
    expect(inventoryProblems(['__Host-csps_a'], text)).toEqual(['__Host-csps_a is not a term of its own']);
  });

  it('finds a name inside a link and inside an extra description line', () => {
    const text = sample([
      {
        kind: 'dl',
        items: [{ term: 'Other', parts: ['Text.'], more: [['See ', { text: '__Secure-csps_b', href: '/cookies' }]] }],
      },
    ]);
    expect(namesInText(text)).toEqual(['__Secure-csps_b']);
  });
});
