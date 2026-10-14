// @vitest-environment node
// Repository third-party notices (D-35, D-10): web/THIRD-PARTY-NOTICES.txt lists every package in the production npm
// tree of web/ with its exact version, license, repository and full license text. The text is deterministic, and
// `--check` fails when the committed file drifts from the installed tree.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { firstDifference, renderNotices } from './third-party-notices.mjs';

const react = {
  name: 'react',
  version: '19.3.0',
  licenses: 'MIT',
  repository: 'https://github.com/react/react',
  licenseText: 'MIT License\r\n\r\nCopyright (c) Meta Platforms, Inc. and affiliates.   \r\n',
};
const clsx = {
  name: 'clsx',
  version: '2.1.1',
  licenses: 'MIT',
  repository: 'https://github.com/lukeed/clsx',
  licenseText: 'The MIT License (MIT)\n\nCopyright (c) Luke Edwards\n',
};
const font = {
  name: '@fontsource/barlow-condensed',
  version: '5.3.0',
  licenses: 'OFL-1.1',
  repository: 'https://github.com/fontsource/font-files',
  licenseText: 'SIL Open Font License, Version 1.1\n',
};

describe('renderNotices', () => {
  it('starts with a header that says the file is generated, how to regenerate it and that it is not published', () => {
    const text = renderNotices([react]);

    expect(text).toMatch(/^THIRD-PARTY NOTICES: CSPS web app \(web\/\)\n/);
    expect(text).toContain('This file is generated. Do not edit it by hand.');
    expect(text).toContain('npm --prefix web run notices');
    expect(text).toContain('npm --prefix web run notices:check');
    expect(text).toContain(
      'These notices stay in the repository and are not published on the site (owner decision D-35).',
    );
  });

  it('lists each package with name@version, license id, repository and the full license text', () => {
    const text = renderNotices([react]);

    expect(text).toContain(
      [
        '='.repeat(80),
        'react@19.3.0',
        'License: MIT',
        'Repository: https://github.com/react/react',
        '-'.repeat(80),
        'MIT License',
        '',
        'Copyright (c) Meta Platforms, Inc. and affiliates.',
        '',
      ].join('\n'),
    );
  });

  it('sorts packages by name, whatever order the tree reports them in', () => {
    const text = renderNotices([react, clsx, font]);
    const names = [...text.matchAll(/^={80}\n(\S+)$/gm)].map((match) => match[1]);

    expect(names).toEqual(['@fontsource/barlow-condensed@5.3.0', 'clsx@2.1.1', 'react@19.3.0']);
    expect(renderNotices([font, clsx, react])).toBe(text);
  });

  it('is deterministic: LF line endings, no trailing spaces, exactly one final newline', () => {
    const text = renderNotices([react, clsx]);

    expect(text).not.toContain('\r');
    expect(text).not.toMatch(/[ \t]$/m);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(renderNotices([react, clsx])).toBe(text);
  });

  it('skips the root manifests and says so when a package has no repository or no license file', () => {
    const text = renderNotices([
      { name: 'csps-web', version: '', licenses: undefined },
      { name: 'bare', version: '1.0.0', licenses: 'ISC' },
    ]);

    expect(text).not.toContain('csps-web');
    expect(text).toContain('bare@1.0.0\nLicense: ISC\nRepository: (none listed)\n');
    expect(text).toContain('The package ships no license file. Its license is ISC; see the package source.');
  });
});

describe('firstDifference', () => {
  const expected = renderNotices([react, clsx]);

  it('finds nothing when the committed file matches', () => {
    expect(firstDifference(expected, expected)).toBeUndefined();
    expect(firstDifference(expected.replaceAll('\n', '\r\n'), expected)).toBeUndefined();
  });

  it('names the first package whose entry differs', () => {
    const committed = expected.replace('Copyright (c) Meta', 'Copyright (c) Facebook');

    expect(firstDifference(committed, expected)).toBe('react@19.3.0');
  });

  it('names a package that is new in the tree or gone from it', () => {
    expect(firstDifference(renderNotices([react]), expected)).toBe('clsx@2.1.1');
    expect(firstDifference(renderNotices([react, clsx, font]), expected)).toBe('@fontsource/barlow-condensed@5.3.0');
  });

  it('names the header when only the header differs, and a missing file', () => {
    expect(firstDifference(expected.replace('CSPS web app', 'web app'), expected)).toBe('the header');
    expect(firstDifference('', expected)).toBe('the whole file (it is missing or empty)');
  });
});

describe('third-party-notices.mjs', () => {
  const script = fileURLToPath(new URL('./third-party-notices.mjs', import.meta.url));
  const committed = fileURLToPath(new URL('../THIRD-PARTY-NOTICES.txt', import.meta.url));

  it('--check exits 1 and names the first differing package when the file drifts, and --write fixes it', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'csps-notices-'));
    const file = path.join(folder, 'THIRD-PARTY-NOTICES.txt');
    writeFileSync(file, readFileSync(committed, 'utf8').replace('react-dom@19.3.0\n', 'react-dom@19.2.0\n'));
    try {
      const drifted = spawnSync(process.execPath, [script, '--check', '--file', file], { encoding: 'utf8' });
      expect(drifted.status).toBe(1);
      expect(drifted.stderr).toContain('First difference: react-dom@19.2.0');

      const written = spawnSync(process.execPath, [script, '--write', '--file', file], { encoding: 'utf8' });
      expect(written.status).toBe(0);
      const clean = spawnSync(process.execPath, [script, '--check', '--file', file], { encoding: 'utf8' });
      expect(clean.status).toBe(0);
      expect(readFileSync(file, 'utf8')).toBe(readFileSync(committed, 'utf8'));
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 120_000);

  it('refuses to run without exactly one of --write and --check', () => {
    const neither = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    const both = spawnSync(process.execPath, [script, '--write', '--check'], { encoding: 'utf8' });

    expect(neither.status).toBe(1);
    expect(both.status).toBe(1);
    expect(neither.stderr).toContain('Use exactly one of --write or --check');
  }, 60_000);
});
