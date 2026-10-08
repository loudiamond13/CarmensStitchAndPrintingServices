// @vitest-environment node
// npm license policy (D-00 free only, D-18, D-26 + addendum). The production tree that ships to the browser allows only
// the allow-list plus OFL-1.1 for the @fontsource fonts; the dev/build/tool trees may add the owner-approved
// license-level exceptions, each only for the scopes it lists. An exception no package needs is stale.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { attributeScopes, evaluateTree, registryScopes, validateNpmExceptions } from './license-policy.mjs';

const ALLOWED = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];

function pkg(name: string, licenses: string | string[] | undefined, scopes: string[] = []) {
  return { name, version: '1.0.0', licenses, scopes };
}

function exception(license: string, scopes: string[]) {
  return { license, scopes };
}

function approved(license: string, scopes: string[]) {
  return {
    license,
    scopes,
    examplePackages: ['some-package'],
    pulledInBy: 'some-tool',
    reason: 'Free; used only by a tool, never shipped.',
    approved: '2026-10-07',
    approvedBy: 'owner',
  };
}

describe('evaluateTree: the production tree (what ships to the browser)', () => {
  const production = { allowed: ALLOWED, exceptions: [] };

  it('reports a GPL-3.0 package by name, version and license', () => {
    const result = evaluateTree([pkg('react', 'MIT'), pkg('left-pad', 'GPL-3.0')], production);

    expect(result.problems).toEqual(["left-pad@1.0.0: license 'GPL-3.0' is not allowed in this tree."]);
  });

  it('allows OFL-1.1 for an @fontsource font', () => {
    const fonts = [pkg('@fontsource/barlow-condensed', 'OFL-1.1'), pkg('@fontsource-variable/archivo', 'OFL-1.1')];

    expect(evaluateTree(fonts, production).problems).toEqual([]);
  });

  it('reports OFL-1.1 on a package that is not an @fontsource font', () => {
    expect(evaluateTree([pkg('font-thief', 'OFL-1.1')], production).problems).toEqual([
      "font-thief@1.0.0: license 'OFL-1.1' is not allowed in this tree.",
    ]);
  });

  it('skips the two root manifests, which are the project itself', () => {
    const roots = [pkg('csps-web', undefined), pkg('csps-openapi-gen', 'UNLICENSED')];

    expect(evaluateTree(roots, production).problems).toEqual([]);
  });

  it('sorts problems by package name', () => {
    const result = evaluateTree([pkg('zeta', 'GPL-3.0'), pkg('alpha', 'AGPL-3.0')], production);

    expect(result.problems.map((problem) => problem.split('@')[0])).toEqual(['alpha', 'zeta']);
  });
});

describe('evaluateTree: SPDX expressions', () => {
  const policy = { allowed: ALLOWED, exceptions: [] };

  it.each([
    ['(MIT OR CC0-1.0)', 'one OR alternative is allowed'],
    ['(GPL-3.0 OR MIT)', 'the other OR alternative is allowed'],
    ['(MIT AND ISC)', 'every AND part is allowed'],
    ['Apache-2.0 WITH LLVM-exception', 'a WITH exception is judged by its base license'],
    ['((MIT OR GPL-2.0) AND BSD-3-Clause)', 'nested groups are evaluated'],
    ['MIT*', "license-checker's guessed mark is ignored"],
  ])('passes %s (%s)', (expression) => {
    expect(evaluateTree([pkg('x', expression)], policy).problems).toEqual([]);
  });

  it('passes a license list only when every entry is allowed', () => {
    expect(evaluateTree([pkg('ok', ['MIT', 'ISC'])], policy).problems).toEqual([]);
    expect(evaluateTree([pkg('bad', ['MIT', 'GPL-3.0'])], policy).problems).toEqual([
      "bad@1.0.0: license 'MIT AND GPL-3.0' is not allowed in this tree.",
    ]);
  });

  it.each([
    ['UNKNOWN'],
    ['UNLICENSED'],
    ['Custom: https://example.com/license'],
    ['(MIT AND CC-BY-3.0)'],
    ['MIT OR'],
    ['(MIT'],
    ['MIT)'],
    ['WITH MIT'],
    ['MIT WITH'],
    [''],
  ])('fails %j', (expression) => {
    expect(evaluateTree([pkg('x', expression)], policy).problems).toHaveLength(1);
  });

  it('fails a package without any license', () => {
    expect(evaluateTree([pkg('x', undefined)], policy).problems).toEqual([
      "x@1.0.0: license '(none)' is not allowed in this tree.",
    ]);
  });

  it('lists guessed licenses separately so the gate can show them', () => {
    const result = evaluateTree([pkg('guess', 'MIT*'), pkg('sure', 'MIT')], policy);

    expect(result.guessed).toEqual(['guess@1.0.0 (MIT*)']);
  });
});

describe('evaluateTree: the dev/build/tool trees with the owner-approved exceptions', () => {
  it('accepts an exception license for a package in one of the listed scopes', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('CC-BY-4.0', ['build'])] };

    expect(evaluateTree([pkg('caniuse-lite', 'CC-BY-4.0', ['build'])], policy).problems).toEqual([]);
  });

  it('rejects an exception license for a package outside the listed scopes, naming its scopes', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('CC-BY-4.0', ['build'])] };

    expect(evaluateTree([pkg('caniuse-lite', 'CC-BY-4.0', ['tool'])], policy).problems).toEqual([
      "caniuse-lite@1.0.0: license 'CC-BY-4.0' is approved only for build, but this package is needed for tool.",
    ]);
  });

  it('accepts a package that one in-scope dependency needs, even when an out-of-scope one also needs it', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('MPL-2.0', ['build', 'test'])] };

    expect(evaluateTree([pkg('axe-core', 'MPL-2.0', ['test', 'tool'])], policy).problems).toEqual([]);
  });

  it('rejects an exception license for a package with no known scope', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('0BSD', ['tool'])] };

    expect(evaluateTree([pkg('tslib', '0BSD', [])], policy).problems).toEqual([
      "tslib@1.0.0: license '0BSD' is approved only for tool, but this package is needed for (no known scope).",
    ]);
  });

  it('combines an exception with the allow-list inside one expression', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('CC-BY-3.0', ['tool'])] };

    expect(evaluateTree([pkg('spdx-ranges', '(MIT AND CC-BY-3.0)', ['tool'])], policy).problems).toEqual([]);
  });

  it('still rejects a license that no exception covers', () => {
    const policy = { allowed: ALLOWED, exceptions: [exception('CC0-1.0', ['tool'])] };

    expect(evaluateTree([pkg('gpl-tool', 'GPL-3.0', ['tool'])], policy).problems).toEqual([
      "gpl-tool@1.0.0: license 'GPL-3.0' is not allowed in this tree.",
    ]);
  });
});

describe('validateNpmExceptions', () => {
  it('accepts a complete exception that a package needs', () => {
    const packages = [pkg('caniuse-lite', 'CC-BY-4.0', ['build'])];

    expect(validateNpmExceptions([approved('CC-BY-4.0', ['build'])], ALLOWED, packages)).toEqual([]);
  });

  it('reports an exception with no matching package as stale', () => {
    expect(
      validateNpmExceptions([approved('CC-BY-3.0', ['tool'])], ALLOWED, [pkg('react', 'MIT', ['runtime'])]),
    ).toEqual([
      "npmLicenseExceptions 'CC-BY-3.0' is stale: no package needs it; remove it (owner approval is per license).",
    ]);
  });

  it('reports an exception as stale when its packages pass through another allowed alternative', () => {
    const packages = [pkg('type-fest', '(MIT OR CC0-1.0)', ['build'])];

    expect(validateNpmExceptions([approved('CC0-1.0', ['build'])], ALLOWED, packages)).toEqual([
      "npmLicenseExceptions 'CC0-1.0' is stale: no package needs it; remove it (owner approval is per license).",
    ]);
  });

  it('reports a listed scope that no package needing the license uses as stale', () => {
    const packages = [pkg('axe-core', 'MPL-2.0', ['test'])];

    expect(validateNpmExceptions([approved('MPL-2.0', ['build', 'test'])], ALLOWED, packages)).toEqual([
      "npmLicenseExceptions 'MPL-2.0' scope 'build' is stale: no package that needs the license is used for build.",
    ]);
  });

  it('rejects a list that is not a list', () => {
    expect(validateNpmExceptions(undefined, ALLOWED, [])).toEqual(['npmLicenseExceptions must be a list.']);
  });

  it.each([
    [{ scopes: ['runtime'] }, 'scopes must list only build, test or tool'],
    [{ scopes: [] }, 'scopes must list only build, test or tool'],
    [{ examplePackages: [] }, 'examplePackages must list at least one package'],
    [{ pulledInBy: ' ' }, 'pulledInBy is missing or empty'],
    [{ reason: '' }, 'reason is missing or empty'],
    [{ approved: '07/10/2026' }, 'approved must be a yyyy-mm-dd date'],
    [{ approvedBy: undefined }, 'approvedBy is missing or empty'],
  ])('rejects an incomplete entry %j', (change, message) => {
    const entry = { ...approved('CC-BY-4.0', ['build']), ...change };

    expect(validateNpmExceptions([entry], ALLOWED, [pkg('caniuse-lite', 'CC-BY-4.0', ['build'])])).toEqual([
      expect.stringContaining(message),
    ]);
  });

  it('rejects an entry without a license', () => {
    expect(validateNpmExceptions([{ ...approved('X', ['tool']), license: '' }], ALLOWED, [])).toEqual([
      expect.stringContaining('license is missing or empty'),
    ]);
  });

  it('rejects a license that is already on the allow-list and a license listed twice', () => {
    const packages = [pkg('caniuse-lite', 'CC-BY-4.0', ['build'])];
    const problems = validateNpmExceptions(
      [approved('MIT', ['tool']), approved('CC-BY-4.0', ['build']), approved('CC-BY-4.0', ['build'])],
      ALLOWED,
      packages,
    );

    expect(problems).toContain("npmLicenseExceptions 'MIT' is already on the allow-list.");
    expect(problems).toContain("npmLicenseExceptions 'CC-BY-4.0' is listed twice.");
  });
});

describe('attributeScopes: why each installed package is there', () => {
  const lock = {
    packages: {
      '': {
        name: 'csps-web',
        dependencies: { react: '19.3.0' },
        devDependencies: { typescript: 'npm:@typescript/typescript6@6.0.2', vite: '8.3.3', lighthouse: '13.5.0' },
      },
      'node_modules/react': { version: '19.3.0' },
      'node_modules/typescript': { name: '@typescript/typescript6', version: '6.0.2', dependencies: { tslib: '^2' } },
      'node_modules/vite': { version: '8.3.3', dependencies: { lightningcss: '^1.33.0' } },
      'node_modules/vite/node_modules/lightningcss': {
        version: '1.33.0',
        optionalDependencies: { 'lightningcss-win32-x64-msvc': '1.33.0' },
      },
      'node_modules/vite/node_modules/lightningcss-win32-x64-msvc': { version: '1.33.0' },
      'node_modules/lightningcss': { version: '1.32.0' },
      'node_modules/lighthouse': { version: '13.5.0', dependencies: { tslib: '^2', missing: '^1' } },
      'node_modules/tslib': { version: '2.8.1' },
    },
  };
  const direct = new Map([
    ['react', 'runtime'],
    ['@typescript/typescript6', 'build'],
    ['vite', 'build'],
    ['lighthouse', 'tool'],
  ]);

  it('gives each direct dependency its registry scope, resolving an alias to the real package', () => {
    const scopes = attributeScopes(lock, direct);

    expect(scopes.get('react@19.3.0')).toEqual(['runtime']);
    expect(scopes.get('@typescript/typescript6@6.0.2')).toEqual(['build']);
  });

  it('follows dependencies and optional dependencies through nested node_modules folders', () => {
    const scopes = attributeScopes(lock, direct);

    expect(scopes.get('lightningcss@1.33.0')).toEqual(['build']);
    expect(scopes.get('lightningcss-win32-x64-msvc@1.33.0')).toEqual(['build']);
    expect(scopes.has('lightningcss@1.32.0')).toBe(false);
  });

  it('unions the scopes of every dependency that needs a package, sorted', () => {
    expect(attributeScopes(lock, direct).get('tslib@2.8.1')).toEqual(['build', 'tool']);
  });

  it('gives no scope to the packages of a direct dependency the registry does not list', () => {
    const scopes = attributeScopes(lock, new Map([['react', 'runtime']]));

    expect(scopes.get('tslib@2.8.1')).toBeUndefined();
  });
});

describe('registryScopes', () => {
  it('maps the npm entries of one manifest to their scopes', () => {
    const registry = {
      packages: [
        { id: 'Shouldly', kind: 'nuget', scope: 'test' },
        { id: 'typescript', kind: 'npm', manifest: 'tools/openapi-gen', scope: 'tool' },
        { id: 'typescript', kind: 'npm', manifest: 'web', scope: 'build' },
        { id: 'react', kind: 'npm', manifest: 'web', scope: 'runtime' },
      ],
    };

    expect([...registryScopes(registry, 'web')]).toEqual([
      ['typescript', 'build'],
      ['react', 'runtime'],
    ]);
    expect([...registryScopes(registry, 'tools/openapi-gen')]).toEqual([['typescript', 'tool']]);
    expect([...registryScopes(undefined, 'web')]).toEqual([]);
  });
});

describe('license-gate.mjs', () => {
  const gate = fileURLToPath(new URL('./license-gate.mjs', import.meta.url));
  const repoRoot = path.resolve(path.dirname(gate), '..', '..');

  it('exits 1 on a stricter policy given through --exceptions (no npm exceptions at all)', () => {
    const real = JSON.parse(readFileSync(path.join(repoRoot, 'docs', 'license-exceptions.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const folder = mkdtempSync(path.join(tmpdir(), 'csps-license-gate-'));
    const strict = path.join(folder, 'license-exceptions.json');
    writeFileSync(strict, JSON.stringify({ ...real, npmLicenseExceptions: [] }));
    try {
      const result = spawnSync(process.execPath, [gate, '--exceptions', strict], { encoding: 'utf8' });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("axe-core@4.13.0: license 'MPL-2.0' is not allowed in this tree.");
      expect(result.stderr).toContain("argparse@2.0.1: license 'Python-2.0' is not allowed in this tree.");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 120_000);
});
