// @vitest-environment node
// Pins the fail-closed content check of the deploy package (OPS-05, T-03-44, T-03-45): a package that carries logs, an
// app_offline.htm, environment settings files, key material, secrets or env files, or that lacks what the host needs to
// start, is refused before it is stored.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPackage, main } from './package-check.mjs';

const WEB_CONFIG = '<aspNetCore processPath="dotnet" hostingModel="inprocess" />';
const CLEAN = ['web.config', 'wwwroot/index.html', 'Csps.Server.dll', 'appsettings.json'];

function readerFor(webConfig: string = WEB_CONFIG) {
  return (file: string) => (file === 'web.config' ? webConfig : '');
}

function problemsFor(extra: readonly string[], webConfig?: string) {
  return checkPackage([...CLEAN, ...extra], readerFor(webConfig));
}

describe('checkPackage', () => {
  it('accepts a clean package', () => {
    expect(checkPackage(CLEAN, readerFor())).toEqual([]);
  });

  it.each([
    ['a logs folder', 'logs/x.json', /logs/i],
    ['a nested logs folder', 'logs/2026/x.json', /logs/i],
    ['app_offline.htm', 'app_offline.htm', /app_offline/i],
    ['App_Offline.htm', 'App_Offline.htm', /app_offline/i],
    ['a Development settings file', 'appsettings.Development.json', /appsettings/i],
    ['a Production settings file', 'appsettings.Production.json', /appsettings/i],
    ['a pfx certificate', 'cert.pfx', /\.pfx/i],
    ['a pem key', 'key.pem', /\.pem/i],
    ['a key file', 'a.key', /\.key/i],
    ['secrets.json', 'secrets.json', /secrets\.json/i],
    ['a .env file', '.env', /\.env/i],
    ['a .env.local file', '.env.local', /\.env/i],
  ])('refuses %s with one named problem', (_label, file, expected) => {
    const problems = problemsFor([file]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(expected);
    expect(problems[0]).toContain(file);
  });

  it('refuses an upper-case key extension and a nested key file', () => {
    expect(problemsFor(['sub/Server.PFX'])).toHaveLength(1);
    expect(problemsFor(['wwwroot/private.key'])).toHaveLength(1);
  });

  it('allows an app_offline.htm look-alike only when it is not at the root name', () => {
    expect(problemsFor(['wwwroot/app_offline.htm.txt'])).toEqual([]);
  });

  it('refuses a missing web.config', () => {
    const problems = checkPackage(['wwwroot/index.html', 'Csps.Server.dll'], readerFor());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/web\.config/);
  });

  it('refuses a web.config without the in-process hosting model', () => {
    const problems = checkPackage(CLEAN, readerFor('<aspNetCore processPath="dotnet" hostingModel="outofprocess" />'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/inprocess/);
  });

  it('refuses a web.config with no hosting model at all', () => {
    expect(checkPackage(CLEAN, readerFor('<aspNetCore processPath="dotnet" />'))).toHaveLength(1);
  });

  it('refuses a missing wwwroot/index.html', () => {
    const problems = checkPackage(['web.config', 'Csps.Server.dll'], readerFor());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/wwwroot\/index\.html/);
  });

  it('refuses a missing Csps.Server.dll', () => {
    const problems = checkPackage(['web.config', 'wwwroot/index.html'], readerFor());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Csps\.Server\.dll/);
  });

  it('reports every problem it finds', () => {
    expect(checkPackage(['logs/a.json', 'cert.pfx'], readerFor())).toHaveLength(5);
  });

  it('reads separators the Windows way too', () => {
    expect(
      checkPackage(['web.config', 'wwwroot\\index.html', 'Csps.Server.dll', 'logs\\a.json'], readerFor()),
    ).toHaveLength(1);
  });
});

describe('main', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function folder(files: Record<string, string>) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'csps-package-check-'));
    roots.push(root);
    for (const [relative, text] of Object.entries(files)) {
      const target = path.join(root, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
    return root;
  }

  function run(args: readonly string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = main(args, { log: (line) => out.push(line), error: (line) => err.push(line) });
    return { code, out, err };
  }

  const cleanFiles = {
    'web.config': WEB_CONFIG,
    'wwwroot/index.html': '<html></html>',
    'Csps.Server.dll': 'x',
    'appsettings.json': '{}',
  };

  it('passes a clean folder and counts its files', () => {
    const result = run([folder(cleanFiles)]);
    expect(result.code).toBe(0);
    expect(result.out).toEqual(['Package check passed: 4 files.']);
  });

  it('prints each problem and exits 1 for a planted dev file', () => {
    const result = run([folder({ ...cleanFiles, 'appsettings.Development.json': '{}' })]);
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain('appsettings.Development.json');
    expect(result.out).toEqual([]);
  });

  it('finds a planted file in a nested folder', () => {
    const result = run([folder({ ...cleanFiles, 'logs/2026/app.json': '{}' })]);
    expect(result.code).toBe(1);
  });

  it('exits 2 when the folder does not exist', () => {
    const result = run([path.join(os.tmpdir(), 'csps-package-check-missing-folder')]);
    expect(result.code).toBe(2);
    expect(result.err.join('\n')).toMatch(/not found|does not exist/i);
  });

  it('exits 2 when no folder is given', () => {
    expect(run([]).code).toBe(2);
  });
});
