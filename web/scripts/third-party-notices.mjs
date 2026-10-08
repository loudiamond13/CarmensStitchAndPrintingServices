// @ts-check
// Repository third-party notices (D-35, D-10). Writes web/THIRD-PARTY-NOTICES.txt from the production npm tree of web/
// (the packages that ship to the browser): name@version, license, repository and the full license text of each.
//   node web/scripts/third-party-notices.mjs --write   (npm run notices: rewrite the file)
//   node web/scripts/third-party-notices.mjs --check   (npm run notices:check: exit 1 when the file is out of date)
// The file has no timestamp, so it changes only when the shipped packages change. It stays in the repository and is not
// published on the site (D-35). Reads only node_modules. `--file <path>` replaces the target file (tests only).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { dependenciesOnly, licenseText } from './license-policy.mjs';

/** @typedef {import('./license-policy.mjs').NpmPackage & { licenseText?: string | undefined }} NoticePackage */

const RULE = '='.repeat(80);
const DIVIDER = '-'.repeat(80);
const HEADER_NAME = 'the header';
const MISSING = 'the whole file (it is missing or empty)';

const HEADER = [
  'THIRD-PARTY NOTICES: CSPS web app (web/)',
  '',
  'The open-source packages that ship to the browser as part of the CSPS web app, with their licenses.',
  'Every one is free to use. Each entry: package@version, license (SPDX id), source repository and the full license',
  'text from the package.',
  '',
  'This file is generated. Do not edit it by hand. After any change to web/package.json, regenerate it with',
  '`npm --prefix web run notices` (node web/scripts/third-party-notices.mjs --write) and commit the result.',
  '`npm --prefix web run notices:check` fails when it is out of date; `npm run verify` runs that check.',
  'These notices stay in the repository and are not published on the site (owner decision D-35).',
  'The .NET packages are listed in THIRD-PARTY-NOTICES.md at the repository root.',
];

/**
 * LF line endings, no trailing spaces, no leading or trailing blank lines.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/**
 * @param {NoticePackage} item
 * @returns {string}
 */
function entry(item) {
  const license = licenseText(item.licenses);
  const text =
    item.licenseText === undefined || normalize(item.licenseText) === ''
      ? `The package ships no license file. Its license is ${license}; see the package source.`
      : normalize(item.licenseText);
  return [
    RULE,
    `${item.name}@${item.version}`,
    `License: ${license}`,
    `Repository: ${item.repository ?? '(none listed)'}`,
    DIVIDER,
    text,
  ].join('\n');
}

/**
 * The notices text for the given packages: the header, then one entry per package sorted by name and version (root
 * manifests skipped). Deterministic: the same packages give the same text on every machine.
 * @param {readonly NoticePackage[]} packages
 * @returns {string}
 */
export function renderNotices(packages) {
  return `${[HEADER.join('\n'), ...dependenciesOnly(packages).map(entry)].join('\n\n')}\n`;
}

/**
 * Splits notices text into the header and the entries, each keyed by its `name@version` line.
 * @param {string} text
 * @returns {{ header: string, entries: { name: string, text: string }[] }}
 */
function parse(text) {
  const [header = '', ...rest] = normalize(text).split(`\n${RULE}\n`);
  return {
    header,
    entries: rest.map((block) => ({ name: block.split('\n', 1)[0] ?? '', text: block.trim() })),
  };
}

/**
 * The first place where the committed notices differ from the expected text: the header, or the `name@version` of the
 * first differing entry (the committed one when that package is gone from the tree, otherwise the expected one).
 * Line endings are ignored. Returns undefined when they match.
 * @param {string} committed
 * @param {string} expected
 * @returns {string | undefined}
 */
export function firstDifference(committed, expected) {
  if (normalize(committed) === '') {
    return MISSING;
  }
  const before = parse(committed);
  const after = parse(expected);
  if (before.header !== after.header) {
    return HEADER_NAME;
  }
  const expectedNames = new Set(after.entries.map((item) => item.name));
  for (let index = 0; index < Math.max(before.entries.length, after.entries.length); index += 1) {
    const old = before.entries[index];
    const now = after.entries[index];
    if (old?.text === now?.text) {
      continue;
    }
    return old !== undefined && (now === undefined || !expectedNames.has(old.name)) ? old.name : now?.name;
  }
  return undefined;
}

/**
 * The CLI: renders the production tree of web/ and writes or checks the notices file.
 * @returns {Promise<number>}
 */
async function main() {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { values } = parseArgs({
    options: {
      write: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      file: { type: 'string', default: path.join(webRoot, 'THIRD-PARTY-NOTICES.txt') },
    },
  });
  if (values.write === values.check) {
    console.error('Use exactly one of --write or --check.');
    return 1;
  }
  const { readLicenseText, readTree } = await import('./npm-tree.mjs');
  const packages = (await readTree(webRoot, true)).map((item) => ({ ...item, licenseText: readLicenseText(item) }));
  const expected = renderNotices(packages);
  const count = dependenciesOnly(packages).length;
  if (values.write) {
    writeFileSync(values.file, expected);
    console.log(`Wrote ${values.file} (${String(count)} packages).`);
    return 0;
  }
  const committed = existsSync(values.file) ? readFileSync(values.file, 'utf8') : '';
  const difference = firstDifference(committed, expected);
  if (difference === undefined) {
    console.log(`THIRD-PARTY-NOTICES.txt is up to date (${String(count)} packages).`);
    return 0;
  }
  console.error(`${values.file} is out of date with the production npm tree of web/.`);
  console.error(`First difference: ${difference}`);
  console.error('Run `npm --prefix web run notices` and commit the result.');
  return 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
