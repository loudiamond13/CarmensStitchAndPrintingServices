// @vitest-environment node
// SPEC-GAP: LEGAL-02, D-17, D-72, T-12-54. The cookies the Privacy Policy lists are exactly the cookies the server sets, and it names no
// retired cookie. The names are read from every C# file in the Security folder (except the retired names), and every place the
// server sets a cookie must use one of those constants, so a cookie added to or taken out of the code fails here until the policy
// text changes too. A cookie set as a raw Set-Cookie header, outside the cookie API, fails as well.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LegalBlock, LegalInline, LegalText } from '../modules/public/legalContent';
import { PRIVACY_TEXT } from '../modules/public/legalPrivacy';

const SERVER_DIR = resolve(import.meta.dirname, '../../../src/Csps.Server');
const SRC_DIR = resolve(import.meta.dirname, '../../../src');
const SECURITY_DIR = resolve(SERVER_DIR, 'Security');
/** The file that holds the two retired cookie names, kept out of the inventory files on purpose. */
const RETIRED_FILE = 'RetiredCookies.cs';
const CODE_FILES = readdirSync(SECURITY_DIR).filter((file) => file.endsWith('.cs') && file !== RETIRED_FILE);

/** A cookie name in C#: a quoted string with the csps_ stem, with or without the __Host- or __Secure- prefix. */
const CODE_NAME = /"((?:__Host-|__Secure-)?csps_[a-z0-9]+)"/g;
/** A cookie name constant in C#: its identifier and its value. */
const CODE_CONSTANT = /const\s+string\s+(\w+)\s*=\s*"((?:__Host-|__Secure-)?csps_[a-z0-9]+)"/g;
/** The first argument of a call that sets a cookie on a response. */
const COOKIE_APPEND = /cookies\.Append\(\s*([^,)\s]+)/gi;
/** Any use of the raw cookie header or the response cookie feature, which would set a cookie without the constants above. */
const RAW_COOKIE_HEADER = /Set-?Cookie|ResponseCookiesFeature/i;
/** The one raw use that only reads the response, so it sets nothing. */
const READ_ONLY_USE = /Headers\.ContainsKey\(\s*HeaderNames\.SetCookie\s*\)/;
/** A cookie name in the policy text, with or without its prefix, so a name written without it is caught as a mismatch. */
const TEXT_NAME = /(?:__Host-|__Secure-)?csps_[a-z0-9]+/g;

function namesInCode(source: string): string[] {
  return Array.from(source.matchAll(CODE_NAME), (match) => match[1] ?? '');
}

function constantsInCode(source: string): string[] {
  return Array.from(source.matchAll(CODE_CONSTANT), (match) => match[1] ?? '');
}

/** Every C# file under a folder, build output left out. */
function csFilesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.cs') && !file.split(sep).some((part) => part === 'bin' || part === 'obj'))
    .map((file) => resolve(dir, file));
}

/** The code lines of a C# source that use the raw cookie header to set a cookie; comments and the read-only check are left out. */
export function rawCookieHeaderLines(file: string, source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('//') && RAW_COOKIE_HEADER.test(line) && !READ_ONLY_USE.test(line))
    .map((line) => `${file}: ${line}`);
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
const codeConstants = new Set(
  CODE_FILES.flatMap((file) => constantsInCode(readFileSync(resolve(SECURITY_DIR, file), 'utf8'))),
);
/** The first argument of every cookie-setting call in the server, with the file it is in. */
const appendCalls = csFilesUnder(SERVER_DIR).flatMap((file) =>
  Array.from(readFileSync(file, 'utf8').matchAll(COOKIE_APPEND), (match) => ({ file, argument: match[1] ?? '' })),
);
/** The raw cookie header lines in all the C# code. */
const rawHeaderLines = csFilesUnder(SRC_DIR).flatMap((file) => rawCookieHeaderLines(file, readFileSync(file, 'utf8')));
const retiredNames = existsSync(resolve(SECURITY_DIR, RETIRED_FILE))
  ? namesInCode(readFileSync(resolve(SECURITY_DIR, RETIRED_FILE), 'utf8'))
  : [];

const sample = (blocks: LegalBlock[]): LegalText => ({
  meta: PRIVACY_TEXT.meta,
  sections: [{ id: 'one', heading: 'One', blocks }],
});

describe('the Privacy Policy cookie list and the code (LEGAL-02, D-72, T-12-54)', () => {
  it('finds the cookie files by folder, not by a fixed list', () => {
    expect(CODE_FILES).toEqual(expect.arrayContaining(['AuthCookies.cs', 'AnalyticsCookies.cs']));
    expect(CODE_FILES).not.toContain(RETIRED_FILE);
  });

  it('sets every cookie through a name constant the inventory reads', () => {
    expect(appendCalls.length).toBeGreaterThan(0);
    expect(appendCalls.filter((call) => !codeConstants.has(call.argument))).toEqual([]);
  });

  it('sets no cookie as a raw Set-Cookie header', () => {
    expect(rawHeaderLines).toEqual([]);
  });

  it.each(['AuthCookies.cs', 'AnalyticsCookies.cs'])('reads at least one cookie name from %s', (file) => {
    expect(sources.find((source) => source.file === file)?.names.length).toBeGreaterThan(0);
  });

  it('lists every cookie name the code sets', () => {
    const listed = new Set(namesInText(PRIVACY_TEXT));
    expect(codeNames.filter((name) => !listed.has(name))).toEqual([]);
  });

  it('names no cookie the code does not set', () => {
    const code = new Set(codeNames);
    expect(namesInText(PRIVACY_TEXT).filter((name) => !code.has(name))).toEqual([]);
  });

  it('names no retired cookie (D-63)', () => {
    expect(retiredNames.length).toBeGreaterThanOrEqual(2);
    const listed = new Set(namesInText(PRIVACY_TEXT));
    expect(retiredNames.filter((name) => listed.has(name))).toEqual([]);
  });

  it('keeps the retired names out of the files the inventory reads', () => {
    expect(retiredNames.filter((name) => codeNames.includes(name))).toEqual([]);
  });

  it('gives each cookie its own term in a description list', () => {
    const terms = new Set(termNames(PRIVACY_TEXT));
    expect(codeNames.filter((name) => !terms.has(name))).toEqual([]);
  });

  it('has no problem as a whole', () => {
    expect(inventoryProblems(codeNames, PRIVACY_TEXT)).toEqual([]);
  });
});

describe('rawCookieHeaderLines (the guard itself)', () => {
  it.each([
    'context.Response.Headers.Append("Set-Cookie", value);',
    'response.Headers["Set-Cookie"] = value;',
    'response.Headers.SetCookie = value;',
    'response.Headers.Append(HeaderNames.SetCookie, value);',
    'var feature = context.Features.Get<IResponseCookiesFeature>();',
  ])('flags %s', (line) => {
    expect(rawCookieHeaderLines('A.cs', `  ${line}\n`)).toEqual([`A.cs: ${line}`]);
  });

  it('leaves out a comment, the read-only check and ordinary code', () => {
    const source = [
      '/// A long-cached asset never carries a Set-Cookie.',
      '// Set-Cookie is not touched here.',
      '&& !response.Headers.ContainsKey(HeaderNames.SetCookie)',
      'response.Cookies.Append(Name, value, options);',
    ].join('\n');
    expect(rawCookieHeaderLines('A.cs', source)).toEqual([]);
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

const WEB_SRC_DIR = resolve(import.meta.dirname, '..');
/** Every key the web code writes to browser storage, with the policy term that must cover it. */
const STORAGE_TERMS: Record<string, string> = {
  'csps-theme': 'Admin settings in this browser',
  'csps-orders-view': 'Admin settings in this browser',
  'csps-maps': 'Saved map setting',
};
const SET_ITEM_CALL = /\.setItem\(\s*(\w+)/g;

/** The non-test web source files, the test folder left out. */
function webSourceFiles(): string[] {
  return readdirSync(WEB_SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith(`test${sep}`))
    .map((file) => resolve(WEB_SRC_DIR, file));
}

/** The storage keys written in the web code: each setItem argument resolved to a quoted constant of the same file. */
function storageKeysWritten(): { keys: string[]; unresolved: string[] } {
  const keys = new Set<string>();
  const unresolved: string[] = [];
  for (const file of webSourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const call of source.matchAll(SET_ITEM_CALL)) {
      const name = call[1] ?? '';
      const value = new RegExp(`const\\s+${name}\\s*=\\s*'([^']+)'`).exec(source)?.[1];
      if (value) keys.add(value);
      else unresolved.push(`${file}: ${name}`);
    }
  }
  return { keys: [...keys].sort(), unresolved };
}

/** The terms of the description list that follows the h3 of the saved settings. */
function savedSettingTerms(text: LegalText): string[] {
  const blocks = text.sections.flatMap((section) => section.blocks);
  const start = blocks.findIndex((block) => block.kind === 'h3' && block.text === 'Settings saved in this browser');
  const list = blocks.slice(start + 1).find((block) => block.kind === 'dl');
  return list?.kind === 'dl' ? list.items.map((item) => item.term) : [];
}

describe('the saved settings in the Privacy Policy and the web code (D-134)', () => {
  const written = storageKeysWritten();

  it('writes only keys that resolve to a quoted constant', () => {
    expect(written.unresolved).toEqual([]);
  });

  it('writes exactly the storage keys the policy knows', () => {
    expect(written.keys).toEqual(Object.keys(STORAGE_TERMS).sort());
  });

  it('puts every written key under a term of Settings saved in this browser', () => {
    const terms = savedSettingTerms(PRIVACY_TEXT);
    const needed = written.keys.map((key) => STORAGE_TERMS[key] ?? '');
    expect(needed.filter((term) => !terms.includes(term))).toEqual([]);
  });

  it('lists exactly the two saved setting terms', () => {
    expect(savedSettingTerms(PRIVACY_TEXT)).toEqual(['Admin settings in this browser', 'Saved map setting']);
  });
});
