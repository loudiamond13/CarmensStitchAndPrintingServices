// @vitest-environment node
// Guards the removed speed reader and the removed consent code (D-59): no such file, no import of one and no web-vitals package.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const webDir = resolve(srcDir, '..');
const SELF = fileURLToPath(import.meta.url);
const SPEED_LIBRARY = 'web-vitals';

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

// Path under src and the module name an import ends in, for the consent components and the consent store.
const CONSENT_COMPONENT_AND_STORE_FILES = [
  'modules/public/components/ConsentSlot.tsx',
  'modules/public/components/ConsentBar.tsx',
  'modules/public/components/ConsentBar.test.tsx',
  'modules/public/components/CookieSettingsDialog.tsx',
  'modules/public/components/CookieSettingsDialog.test.tsx',
  'modules/public/components/ClearDataDialog.tsx',
  'modules/public/components/ClearDataDialog.test.tsx',
  'modules/public/hooks/useConsent.ts',
  'modules/public/hooks/useConsent.test.tsx',
  'modules/public/consentSave.ts',
  'modules/public/consentFocus.ts',
  'modules/public/consentFocus.test.ts',
  'test/consentFixtures.ts',
];
const CONSENT_COMPONENT_AND_STORE_MODULES = [
  'useConsent',
  'consentSave',
  'consentFocus',
  'ConsentBar',
  'ConsentSlot',
  'CookieSettingsDialog',
  'ClearDataDialog',
  'consentFixtures',
];

const consentImporters = (modules: string[]): string[] => {
  const importOfModule = new RegExp(
    `(from\\s+|import\\s*\\(\\s*|vi\\.(?:mock|doMock|importActual)\\s*\\(\\s*)['"][^'"]*\\b(${modules.join('|')})['"]`,
  );
  return filesUnder(srcDir)
    .filter((path) => /\.tsx?$/.test(path) && path !== SELF)
    .filter((path) => importOfModule.test(readFileSync(path, 'utf8')))
    .map((path) => relative(srcDir, path).replaceAll('\\', '/'));
};

describe('the consent components and the consent store are gone (D-59)', () => {
  it('has no consent component or store file', () => {
    const found = CONSENT_COMPONENT_AND_STORE_FILES.filter((path) => existsSync(join(srcDir, path)));
    expect(found.join(', ')).toBe('');
  });

  it('imports no consent component or store', () => {
    expect(consentImporters(CONSENT_COMPONENT_AND_STORE_MODULES).join(', ')).toBe('');
  });
});

const CONSENT_MODULE_FILES = [
  'modules/public/consentCookie.ts',
  'modules/public/consentCookie.test.ts',
  'modules/public/consentJar.ts',
  'modules/public/consentPolicy.ts',
  'modules/public/consentRules.ts',
  'modules/public/consentCopy.ts',
  'modules/public/services/consentService.ts',
  'modules/public/services/consentService.test.ts',
  'modules/public/components/consent.recipe.ts',
  'test/consent-look.node.test.ts',
];
const CONSENT_MODULES = [
  ...CONSENT_COMPONENT_AND_STORE_MODULES,
  'consentCookie',
  'consentJar',
  'consentPolicy',
  'consentRules',
  'consentCopy',
  'consentService',
  'consent\\.recipe',
];

describe('the consent modules and the cookie bar height token are gone (D-59, D-54)', () => {
  it('has no consent module file', () => {
    const found = CONSENT_MODULE_FILES.filter((path) => existsSync(join(srcDir, path)));
    expect(found.join(', ')).toBe('');
  });

  it('imports no consent module', () => {
    expect(consentImporters(CONSENT_MODULES).join(', ')).toBe('');
  });

  it('has no cookie bar height token', () => {
    const css = readFileSync(join(srcDir, 'ui/app.css'), 'utf8');
    expect(css.includes('--spacing-consent-bar')).toBe(false);
  });
});

describe('the speed reader is gone (D-59)', () => {
  it('has no speed reader file', () => {
    const found = ['modules/public/speedReport.ts', 'modules/public/hooks/useSpeedReport.ts'].filter((path) =>
      existsSync(join(srcDir, path)),
    );
    expect(found.join(', ')).toBe('');
  });

  it('imports no speed library', () => {
    const importOfLibrary = new RegExp(`(from\\s+|import\\s*\\(\\s*)['"]${SPEED_LIBRARY}(/[^'"]*)?['"]`);
    const hits = filesUnder(srcDir)
      .filter((path) => /\.tsx?$/.test(path) && path !== SELF)
      .filter((path) => importOfLibrary.test(readFileSync(path, 'utf8')))
      .map((path) => relative(srcDir, path).replaceAll('\\', '/'));
    expect(hits.join(', ')).toBe('');
  });

  it('lists no speed library package', () => {
    const manifest = readJson(join(webDir, 'package.json'));
    const lock = readJson(join(webDir, 'package-lock.json')) as { packages: Record<string, unknown> };
    const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    const locked = Object.keys(lock.packages).filter((key) => key === `node_modules/${SPEED_LIBRARY}`);
    expect([...declared.filter((name) => name === SPEED_LIBRARY), ...locked].join(', ')).toBe('');
  });
});
