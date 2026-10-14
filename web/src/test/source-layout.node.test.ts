// @vitest-environment node
// Guards the owner's web/src layout (OR-6): the top-level folders, what core, layouts and modules may hold, and that
// the retired folders stay gone. It reads the disk, so a stray folder fails here.
import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const srcDir = new URL('../', import.meta.url);

const entries = (relative: string, kind: 'dir' | 'file'): string[] =>
  readdirSync(new URL(relative, srcDir), { withFileTypes: true })
    .filter((entry) => (kind === 'dir' ? entry.isDirectory() : entry.isFile()))
    .map((entry) => entry.name)
    .sort();

describe('web/src layout (OR-6)', () => {
  it('has exactly the owner folders and the two root files, plus the dev and test folders', () => {
    expect(entries('.', 'dir')).toEqual([
      'assets',
      'components',
      'core',
      'dev',
      'hooks',
      'layouts',
      'lib',
      'modules',
      'test',
      'types',
      'ui',
      'utils',
    ]);
    expect(entries('.', 'file')).toEqual(['App.tsx', 'main.tsx']);
  });

  it('holds none of the retired folders', () => {
    for (const retired of ['app', 'styles', 'features']) {
      expect(existsSync(new URL(`${retired}/`, srcDir))).toBe(false);
    }
  });

  it('core holds exactly api and routes, and core/api holds the client, the errors and the transport', () => {
    expect(entries('core', 'dir')).toEqual(['api', 'routes']);
    expect(entries('core/api', 'file')).toEqual(expect.arrayContaining(['apiClient.ts', 'errors.ts']));
    expect(existsSync(new URL('core/api/http/httpClient.ts', srcDir))).toBe(true);
  });

  it('layouts holds PublicLayout and AdminLayout, and only *Layout files', () => {
    const files = entries('layouts', 'file');
    expect(files).toEqual(expect.arrayContaining(['PublicLayout.tsx', 'AdminLayout.tsx']));
    for (const file of files) {
      expect(file).toMatch(/Layout(\.test)?\.tsx$/);
    }
  });

  it('modules holds exactly public and admin, each with components, hooks, pages and services only', () => {
    expect(entries('modules', 'dir')).toEqual(['admin', 'public']);
    for (const name of ['admin', 'public']) {
      expect(entries(`modules/${name}`, 'dir')).toEqual(['components', 'hooks', 'pages', 'services']);
    }
  });

  it('ui holds no .tsx file', () => {
    expect(entries('ui', 'file').filter((file) => file.endsWith('.tsx'))).toEqual([]);
  });

  it('lib holds no http folder and no api.ts', () => {
    expect(existsSync(new URL('lib/http/', srcDir))).toBe(false);
    expect(existsSync(new URL('lib/api.ts', srcDir))).toBe(false);
  });
});
