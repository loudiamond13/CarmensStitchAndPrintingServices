// @vitest-environment node
// npm license policy (D-00, D-18, D-26): SPDX evaluation, the production/dev tree rules and the notices lines.
import { describe, expect, it } from 'vitest';
import {
  evaluateTree,
  formatNotices,
  isAllowed,
  isGuessed,
  validateNpmExceptions,
  type NpmPackage,
} from './license-policy.mjs';

const ALLOWED = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'];
const mitOnly = new Set(['MIT']);

function pkg(name: string, version: string, licenses: string | string[], repository?: string): NpmPackage {
  return repository === undefined ? { name, version, licenses } : { name, version, licenses, repository };
}

describe('isAllowed', () => {
  it('accepts an allowed license', () => {
    expect(isAllowed('MIT', mitOnly)).toBe(true);
  });

  it('accepts an OR expression when any side is allowed', () => {
    expect(isAllowed('(MIT OR CC0-1.0)', mitOnly)).toBe(true);
  });

  it('rejects an AND expression unless every side is allowed', () => {
    expect(isAllowed('(MIT AND CC-BY-4.0)', mitOnly)).toBe(false);
    expect(isAllowed('(MIT AND ISC)', new Set(['MIT', 'ISC']))).toBe(true);
  });

  it('binds AND tighter than OR', () => {
    expect(isAllowed('GPL-3.0-only OR MIT AND CC-BY-4.0', mitOnly)).toBe(false);
    expect(isAllowed('MIT OR GPL-3.0-only AND CC-BY-4.0', mitOnly)).toBe(true);
  });

  it('judges a WITH exception by its base license', () => {
    expect(isAllowed('Apache-2.0 WITH LLVM-exception', new Set(['Apache-2.0']))).toBe(true);
    expect(isAllowed('GPL-2.0-only WITH Classpath-exception-2.0', mitOnly)).toBe(false);
  });

  it.each(['UNKNOWN', 'UNLICENSED', 'Custom: LICENSE', '', 'MIT OR', '((MIT)', 'MIT)', 'AND MIT'])(
    'rejects %j',
    (expression) => {
      expect(isAllowed(expression, mitOnly)).toBe(false);
    },
  );

  it('rejects a missing license', () => {
    expect(isAllowed(undefined, mitOnly)).toBe(false);
    expect(isAllowed([], mitOnly)).toBe(false);
  });

  it('evaluates a guessed license without its trailing star', () => {
    expect(isAllowed('MIT*', mitOnly)).toBe(true);
    expect(isAllowed('GPL-3.0*', mitOnly)).toBe(false);
    expect(isGuessed('MIT*')).toBe(true);
    expect(isGuessed('MIT')).toBe(false);
    expect(isGuessed(['ISC', 'MIT*'])).toBe(true);
  });

  it('requires every entry of a license list', () => {
    expect(isAllowed(['MIT', 'ISC'], new Set(['MIT', 'ISC']))).toBe(true);
    expect(isAllowed(['MIT', 'GPL-2.0-only'], new Set(['MIT', 'ISC']))).toBe(false);
  });
});

describe('evaluateTree', () => {
  const production = { allowed: ALLOWED, exceptions: [] };

  it('allows OFL-1.1 for @fontsource packages only', () => {
    const result = evaluateTree(
      [
        pkg('@fontsource/barlow-condensed', '5.3.0', 'OFL-1.1'),
        pkg('@fontsource-variable/archivo', '5.3.0', 'OFL-1.1'),
        pkg('some-lib', '1.0.0', 'OFL-1.1'),
      ],
      production,
    );

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('some-lib@1.0.0');
    expect(result.problems[0]).toContain('OFL-1.1');
  });

  it('allows a dev-tree license only when an exception names it', () => {
    const tree = [pkg('lightningcss', '1.32.0', 'MPL-2.0')];

    expect(evaluateTree(tree, production).problems).toEqual([
      "lightningcss@1.32.0: license 'MPL-2.0' is not allowed in this tree.",
    ]);
    expect(evaluateTree(tree, { allowed: ALLOWED, exceptions: [{ license: 'MPL-2.0' }] }).problems).toEqual([]);
  });

  it('reports an exception no package needs as stale', () => {
    const result = evaluateTree(
      [pkg('lightningcss', '1.32.0', 'MPL-2.0'), pkg('type-fest', '4.41.0', '(MIT OR CC0-1.0)')],
      {
        allowed: ALLOWED,
        exceptions: [{ license: 'MPL-2.0' }, { license: '0BSD' }, { license: 'CC0-1.0' }],
      },
    );

    expect(result.problems).toEqual([
      "stale exception: no package needs '0BSD'; remove it from npmLicenseExceptions (owner approval is per license).",
      "stale exception: no package needs 'CC0-1.0'; remove it from npmLicenseExceptions (owner approval is per license).",
    ]);
  });

  it('skips the two root packages', () => {
    const result = evaluateTree(
      [pkg('csps-web', '0.0.0', 'UNLICENSED'), pkg('csps-openapi-gen', '0.0.0', 'UNKNOWN')],
      production,
    );

    expect(result).toEqual({ problems: [], guessed: [] });
  });

  it('passes a guessed license that is allowed and lists it as guessed', () => {
    const result = evaluateTree([pkg('old-lib', '1.0.0', 'MIT*')], production);

    expect(result).toEqual({ problems: [], guessed: ['old-lib@1.0.0 (MIT*)'] });
  });

  it('sorts problems by package', () => {
    const result = evaluateTree([pkg('zeta', '1.0.0', 'GPL-3.0-only'), pkg('alpha', '2.0.0', 'UNKNOWN')], production);

    expect(result.problems).toEqual([
      "alpha@2.0.0: license 'UNKNOWN' is not allowed in this tree.",
      "zeta@1.0.0: license 'GPL-3.0-only' is not allowed in this tree.",
    ]);
  });

  it('reports a package without any license', () => {
    expect(evaluateTree([{ name: 'bare', version: '1.0.0' }], production).problems).toEqual([
      "bare@1.0.0: license '(none)' is not allowed in this tree.",
    ]);
  });
});

describe('formatNotices', () => {
  it('lists name, version, license and repository, sorted by name then version, with no date', () => {
    const lines = formatNotices([
      pkg('react', '19.3.0', 'MIT', 'https://github.com/react/react'),
      pkg('clsx', '2.1.1', 'MIT', 'https://github.com/lukeed/clsx'),
      pkg('@tanstack/react-query', '5.103.2', 'MIT', 'https://github.com/TanStack/query'),
      pkg('clsx', '10.0.0', 'MIT', 'https://github.com/lukeed/clsx'),
      pkg('clsx', '2.1.0', ['MIT', 'ISC']),
      pkg('csps-web', '0.0.0', 'UNLICENSED'),
    ]);

    expect(lines).toEqual([
      '@tanstack/react-query@5.103.2 | MIT | https://github.com/TanStack/query',
      'clsx@2.1.0 | MIT AND ISC | (no repository listed)',
      'clsx@2.1.1 | MIT | https://github.com/lukeed/clsx',
      'clsx@10.0.0 | MIT | https://github.com/lukeed/clsx',
      'react@19.3.0 | MIT | https://github.com/react/react',
    ]);
    expect(lines.join('\n')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('validateNpmExceptions', () => {
  const valid = {
    license: 'MPL-2.0',
    scopes: ['build', 'test'],
    examplePackages: ['lightningcss'],
    pulledInBy: 'Vite 8, Tailwind 4',
    reason: 'Free; never shipped to the browser.',
    approved: '2026-10-07',
    approvedBy: 'owner',
  };

  it('accepts a complete entry', () => {
    expect(validateNpmExceptions([valid])).toEqual([]);
  });

  it('rejects a missing list', () => {
    expect(validateNpmExceptions(undefined)).toEqual(['npmLicenseExceptions must be a list.']);
  });

  it('names every missing or invalid field', () => {
    expect(
      validateNpmExceptions([
        { ...valid, scopes: ['runtime'], approved: '07/10/2026', approvedBy: '', examplePackages: [] },
      ]),
    ).toEqual([
      "npmLicenseExceptions 'MPL-2.0': scopes must list only build, test or tool (the production tree has no exceptions).",
      "npmLicenseExceptions 'MPL-2.0': examplePackages must list at least one package.",
      "npmLicenseExceptions 'MPL-2.0': approved must be a yyyy-mm-dd date.",
      "npmLicenseExceptions 'MPL-2.0': approvedBy is missing or empty.",
    ]);
  });

  it('rejects an allow-listed or duplicated license', () => {
    expect(validateNpmExceptions([valid, valid], ALLOWED)).toEqual(["npmLicenseExceptions 'MPL-2.0' is listed twice."]);
    expect(validateNpmExceptions([{ ...valid, license: 'MIT' }], ALLOWED)).toEqual([
      "npmLicenseExceptions 'MIT' is already on the allow-list.",
    ]);
  });
});
