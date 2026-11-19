// @vitest-environment node
// Guards the removed speed reader (D-59): no speed reader file, no web-vitals import and no web-vitals package.
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
