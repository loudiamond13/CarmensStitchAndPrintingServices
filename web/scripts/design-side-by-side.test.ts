// @vitest-environment node
// Pins the D-24 side-by-side (plan 02-36, T-02-77): our pages next to the matching screens of the owner's local design
// exports in .planning/design/. The guards are the point: it refuses in CI, refuses when the design folder is not
// git-ignored or any file in it is tracked, refuses when its own output folder is not git-ignored, and every file it
// writes sits under artifacts/owner-review/side-by-side/. The design files and their renders never leave this machine.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertSideBySidePath,
  checkGuards,
  DESIGN_DIR,
  DESIGN_FILES,
  isCi,
  PAIRINGS,
  planSideBySide,
  renderSideBySide,
  SIDE_BY_SIDE_DIR,
} from './design-side-by-side.mjs';
import { planShots } from './owner-review.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const clean = { ci: false, designIgnored: true, trackedDesignFiles: [], outputIgnored: true } as const;

describe('isCi', () => {
  it.each([
    [{ CI: 'true' }, true],
    [{ CI: '1' }, true],
    [{ CI: '' }, false],
    [{}, false],
  ])('reads %j as CI = %s', (env, expected) => {
    expect(isCi(env)).toBe(expected);
  });
});

describe('checkGuards (D-24, T-02-77)', () => {
  it('refuses in CI, because the design files are not in git and never go to a CI machine', () => {
    const result = checkGuards({ ...clean, ci: true });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toMatch(/CI/);
  });

  it('refuses when .planning/design is not git-ignored, even with nothing in it tracked', () => {
    const result = checkGuards({ ...clean, designIgnored: false });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toMatch(/\.planning\/design.*not git-ignored/);
  });

  it('refuses when any design file is tracked, and names it', () => {
    const result = checkGuards({ ...clean, trackedDesignFiles: ['.planning/design/CSPS Website Public Face.html'] });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('.planning/design/CSPS Website Public Face.html');
  });

  it('refuses when its own output folder is not git-ignored', () => {
    const result = checkGuards({ ...clean, outputIgnored: false });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('artifacts/owner-review/side-by-side');
  });

  it('checks CI first, so a CI run never even looks at the design folder', () => {
    const result = checkGuards({ ci: true, designIgnored: false, trackedDesignFiles: ['x'], outputIgnored: false });

    expect(result.ok ? '' : result.message).toMatch(/CI/);
  });

  it('allows a clean local state', () => {
    expect(checkGuards(clean)).toEqual({ ok: true });
  });
});

describe('PAIRINGS and planSideBySide', () => {
  const items = planSideBySide();

  it('reads the two design exports in place, from .planning/design', () => {
    expect(DESIGN_DIR).toBe(path.join(repoRoot, '.planning', 'design'));
    expect(Object.values(DESIGN_FILES).sort()).toEqual([
      'CSPS Website Admin and Manager.html',
      'CSPS Website Public Face.html',
    ]);
    for (const item of items) {
      expect(path.dirname(item.designFile)).toBe(DESIGN_DIR);
    }
  });

  it('pairs the public home and the five admin pages with their design screens', () => {
    expect(PAIRINGS.map((pairing) => pairing.path)).toEqual([
      '/',
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/users',
      '/admin/profile',
    ]);
  });

  it('plans the public page in Blush and every admin page in Blush and Espresso, at 390, 820 and 1440', () => {
    expect(items).toHaveLength(3 + 5 * 3 * 2);
    for (const item of items.filter((entry) => entry.path !== '/')) {
      expect(['light', 'dark']).toContain(item.theme);
    }
    expect(items.filter((item) => item.path === '/').map((item) => item.theme)).toEqual(['light', 'light', 'light']);
  });

  it('writes every design picture under artifacts/owner-review/side-by-side/, each to its own file', () => {
    const outputs = items.flatMap((item) => (item.output === null ? [] : [item.output]));

    expect(SIDE_BY_SIDE_DIR).toBe(path.join(repoRoot, 'artifacts', 'owner-review', 'side-by-side'));
    expect(new Set(outputs).size).toBe(outputs.length);
    for (const output of outputs) {
      expect(path.relative(SIDE_BY_SIDE_DIR, output).startsWith('..')).toBe(false);
      expect(path.dirname(output)).toBe(SIDE_BY_SIDE_DIR);
    }
  });

  it('shows our side from the owner review screenshots of the same page, theme and width', () => {
    const reviewFiles = new Set(planShots().map((shot) => `../${shot.file}`));

    for (const item of items) {
      expect(reviewFiles.has(item.ours), item.ours).toBe(true);
      expect(item.ours).toContain(`-${item.theme}-${String(item.width)}.png`);
    }
  });

  it('marks a width the design has no screen for (the public site at 820) instead of inventing one', () => {
    const tablet = items.find((item) => item.path === '/' && item.width === 820);

    expect(tablet).toMatchObject({ board: null, output: null });
    for (const item of items.filter((entry) => entry.path !== '/')) {
      expect(item.board, `${item.path} ${String(item.width)}`).not.toBeNull();
    }
  });
});

describe('assertSideBySidePath', () => {
  it('accepts a file inside artifacts/owner-review/side-by-side', () => {
    const file = path.join(SIDE_BY_SIDE_DIR, 'admin-orders-light-1440-design.png');

    expect(assertSideBySidePath(file)).toBe(file);
  });

  it.each([
    ['the design folder', path.join(repoRoot, '.planning', 'design', 'a.png')],
    ['the review screenshots', path.join(repoRoot, 'artifacts', 'owner-review', 'shots', 'a.png')],
    ['the app source', path.join(repoRoot, 'web', 'src', 'a.png')],
    ['the folder itself', SIDE_BY_SIDE_DIR],
  ])('refuses %s', (_label, file) => {
    expect(() => assertSideBySidePath(file)).toThrow(/Refusing to write outside artifacts\/owner-review\/side-by-side/);
  });
});

describe('renderSideBySide', () => {
  const items = planSideBySide();
  const html = renderSideBySide({ generatedAt: 'now', items });

  it('is one self-contained page: no script, no remote address, every picture a relative link', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    for (const item of items) {
      expect(html).toContain(`src="${item.ours}"`);
      if (item.output !== null) {
        expect(html).toContain(`src="${path.basename(item.output)}"`);
      }
    }
  });

  it('labels the two sides in plain words and says when the design has no screen at a width', () => {
    expect(html).toContain('Approved design');
    expect(html).toContain('Our page');
    expect(html).toContain('The design has no screen at this width.');
  });

  it('tells the owner the design pictures stay on this computer', () => {
    expect(html).toContain('never put in git, uploaded or put on the live site');
  });
});
