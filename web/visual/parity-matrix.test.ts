// @vitest-environment node
// Pins the parity matrix (WEB-02, D-33, UI-SPEC "Look-Equality Proof" → Matrix): Chromium runs every parity scenario
// at 390 px, responsive ones also at 320/820/1440, rest at every width and the interaction states at 390 and 1440, plus
// one reduced-motion pass (O-6) and one touch pass (D-05) for tagged scenarios; Firefox and WebKit run every parity
// scenario at 390 and 1440, rest and hover. Admin and showcase scenarios run in both themes, public ones in Blush only.
import { describe, expect, it } from 'vitest';
import type { Scenario } from '../src/dev/scenarios/types.ts';
import { CHROMIUM_ONLY_TAG, planMatrix, type MatrixRow } from './parity-matrix.ts';

function scenario(overrides: Partial<Scenario> & Pick<Scenario, 'id'>): Scenario {
  return {
    group: 'actions',
    node: { kind: 'node', component: 'Button', props: { children: overrides.id } },
    themes: ['light', 'dark'],
    responsive: false,
    states: ['rest', 'hover', 'focus-visible', 'active'],
    parity: true,
    ...overrides,
  };
}

const button = scenario({ id: 'button-primary-md' });

function summary(rows: readonly MatrixRow[]): string[] {
  return rows.map(
    (row) =>
      `${row.theme} ${String(row.width)} ${row.state} ${row.pass} ${row.chromiumOnly ? 'chromium' : 'all'}: ${row.cases
        .map((item) => item.id)
        .join(',')}`,
  );
}

describe('planMatrix', () => {
  it('runs a two-theme, non-responsive scenario at 390 and 1440: rest and hover everywhere, focus-visible and active in Chromium', () => {
    expect(summary(planMatrix([button]))).toEqual([
      'light 390 rest default all: button-primary-md',
      'light 1440 rest default all: button-primary-md',
      'light 390 hover default all: button-primary-md',
      'light 1440 hover default all: button-primary-md',
      'light 390 focus-visible default chromium: button-primary-md',
      'light 1440 focus-visible default chromium: button-primary-md',
      'light 390 active default chromium: button-primary-md',
      'light 1440 active default chromium: button-primary-md',
      'dark 390 rest default all: button-primary-md',
      'dark 1440 rest default all: button-primary-md',
      'dark 390 hover default all: button-primary-md',
      'dark 1440 hover default all: button-primary-md',
      'dark 390 focus-visible default chromium: button-primary-md',
      'dark 1440 focus-visible default chromium: button-primary-md',
      'dark 390 active default chromium: button-primary-md',
      'dark 1440 active default chromium: button-primary-md',
    ]);
  });

  it('adds rest at 320 and 820 in Chromium for responsive scenarios only', () => {
    const header = scenario({
      id: 'site-header',
      group: 'layout',
      responsive: true,
      states: ['rest'],
      themes: ['light'],
    });
    const badge = scenario({ id: 'badge', group: 'layout', states: ['rest'], themes: ['light'] });

    expect(summary(planMatrix([header, badge]))).toEqual([
      'light 390 rest default all: site-header,badge',
      'light 1440 rest default all: site-header,badge',
      'light 320 rest default chromium: site-header',
      'light 820 rest default chromium: site-header',
    ]);
  });

  it('runs a public (Blush-only) scenario in light only (D-14)', () => {
    const rows = planMatrix([scenario({ id: 'public-page', themes: ['light'], states: ['rest'] })]);

    expect(rows.map((row) => row.theme)).toEqual(['light', 'light']);
  });

  it('adds one reduced-motion pass (O-6) and one touch pass (D-05) at 390 in Chromium for tagged scenarios', () => {
    const toast = scenario({ id: 'toast', group: 'feedback', themes: ['light'], states: ['rest'], passes: ['motion'] });
    const thumb = scenario({ id: 'thumb', group: 'feedback', themes: ['light'], states: ['rest'], passes: ['touch'] });

    expect(summary(planMatrix([toast, thumb]))).toEqual([
      'light 390 rest default all: toast,thumb',
      'light 1440 rest default all: toast,thumb',
      'light 390 rest motion chromium: toast',
      'light 390 rest touch chromium: thumb',
    ]);
  });

  it('checks SPEC-GAP scenarios (parity: false) with axe and the guard at rest, and never drives their states', () => {
    const gap = scenario({ id: 'pagination', group: 'data', themes: ['light'], parity: false });

    expect(summary(planMatrix([gap]))).toEqual([
      'light 390 rest default all: pagination',
      'light 1440 rest default all: pagination',
    ]);
  });

  it('plans one row set per group, in list order', () => {
    const rows = planMatrix([
      scenario({ id: 'a1', group: 'actions', themes: ['light'], states: ['rest'] }),
      scenario({ id: 'f1', group: 'forms', themes: ['light'], states: ['rest'] }),
      scenario({ id: 'a2', group: 'actions', themes: ['light'], states: ['rest'] }),
    ]);

    expect(rows.map((row) => `${row.group}:${row.cases.map((item) => item.id).join(',')}`)).toEqual([
      'actions:a1,a2',
      'actions:a1,a2',
      'forms:f1',
      'forms:f1',
    ]);
  });

  it('titles every row with @parity, its group tag, theme, width and state, and tags Chromium-only rows', () => {
    const rows = planMatrix([
      button,
      scenario({ id: 'toast', group: 'feedback', themes: ['light'], states: ['rest'], passes: ['motion', 'touch'] }),
    ]);
    const titles = rows.map((row) => row.title);

    expect(titles).toContain('@parity @actions light 390px rest');
    expect(titles).toContain('@parity @actions dark 1440px hover');
    expect(titles).toContain(`@parity @actions light 390px focus-visible ${CHROMIUM_ONLY_TAG}`);
    expect(titles).toContain(`@parity @feedback light 390px rest @motion ${CHROMIUM_ONLY_TAG}`);
    expect(titles).toContain(`@parity @feedback light 390px rest @touch ${CHROMIUM_ONLY_TAG}`);
    expect(new Set(titles).size).toBe(titles.length);
    for (const row of rows) {
      expect(row.title.includes(CHROMIUM_ONLY_TAG)).toBe(row.chromiumOnly);
      expect(row.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('gives Firefox and WebKit every parity scenario at 390 and 1440, rest and hover, and nothing else', () => {
    const rows = planMatrix([
      button,
      scenario({ id: 'site-header', group: 'layout', responsive: true, themes: ['light'], passes: ['touch'] }),
    ]);
    const crossEngine = rows.filter((row) => !row.chromiumOnly);

    expect(new Set(crossEngine.map((row) => row.width))).toEqual(new Set([390, 1440]));
    expect(new Set(crossEngine.map((row) => row.state))).toEqual(new Set(['rest', 'hover']));
    expect(crossEngine.every((row) => row.pass === 'default')).toBe(true);
  });
});
