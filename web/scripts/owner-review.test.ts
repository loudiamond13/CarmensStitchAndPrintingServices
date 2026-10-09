// @vitest-environment node
// Pins `npm run review` (D-23, plan 02-36): the owner's local screenshot report. The run is planned as data and tested
// here without starting anything: it refuses unless its output folder is git-ignored, refuses a busy port 5199, runs
// the preflight, the guarded CSPS_E2E seed and a rebuild of the e2e bundle whenever a source is newer than it (L-29),
// starts the real host for its own run only, captures every page at 390, 820 and 1440 px (the admin pages in both
// themes) and writes one index.html. It writes nowhere but artifacts/owner-review/.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PORT_BUSY_MESSAGE, PREFLIGHT_SCRIPT } from './e2e.mjs';
import {
  assertWritable,
  E2E_DIST,
  executeReview,
  OUTPUT_DIR,
  OUTPUT_NOT_IGNORED_MESSAGE,
  parseDifferencesTable,
  planReview,
  planShots,
  planSpecGapShots,
  renderIndex,
  REVIEW_TARGETS,
  REVIEW_WIDTHS,
  SPEC_GAP_CASES,
  summarizeParity,
} from './owner-review.mjs';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

type Step = ReturnType<typeof planReview>[number];

function names(steps: readonly Step[]): string[] {
  return steps.map((step) => step.name);
}

describe('REVIEW_WIDTHS and REVIEW_TARGETS (D-23)', () => {
  it('captures at exactly 390, 820 and 1440 px, and the list is frozen', () => {
    expect(REVIEW_WIDTHS).toEqual([390, 820, 1440]);
    expect(Object.isFrozen(REVIEW_WIDTHS)).toBe(true);
  });

  it('lists the public page, the five admin previews and the showcase, in that order', () => {
    expect(REVIEW_TARGETS.map((target) => target.path)).toEqual([
      '/',
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/users',
      '/admin/profile',
      '/dev/components',
    ]);
    expect(Object.isFrozen(REVIEW_TARGETS)).toBe(true);
  });

  it('shows the public page in Blush only and every admin page and the showcase in Blush and Espresso (D-13, D-14)', () => {
    const themes = Object.fromEntries(REVIEW_TARGETS.map((target) => [target.path, target.themes]));

    expect(themes['/']).toEqual(['light']);
    for (const target of REVIEW_TARGETS.filter((entry) => entry.path !== '/')) {
      expect(target.themes, target.path).toEqual(['light', 'dark']);
    }
  });

  it('names each page in plain words and gives the h1 the capture waits for', () => {
    for (const target of REVIEW_TARGETS) {
      expect(target.title.trim(), target.path).not.toBe('');
      expect(target.h1.trim(), target.path).not.toBe('');
    }
    expect(REVIEW_TARGETS.find((target) => target.path === '/dev/components')?.h1).toBe('Component Showcase');
  });
});

describe('planShots', () => {
  it('plans 39 screenshots: the public page 3, five admin previews 3 x 2 each, the showcase 3 x 2', () => {
    const shots = planShots();

    expect(shots).toHaveLength(39);
    expect(shots.filter((shot) => shot.path === '/')).toHaveLength(3);
    expect(shots.filter((shot) => shot.path === '/dev/components')).toHaveLength(6);
  });

  it('gives every shot its own file under shots/, named by page, theme and width', () => {
    const shots = planShots();
    const files = shots.map((shot) => shot.file);

    expect(new Set(files).size).toBe(files.length);
    expect(files.every((file) => /^shots\/[a-z0-9-]+-(light|dark)-(390|820|1440)\.png$/.test(file))).toBe(true);
    expect(files).toContain('shots/public-home-light-390.png');
    expect(files).toContain('shots/admin-orders-dark-1440.png');
  });

  it('covers every width in every theme a page has', () => {
    const shots = planShots();
    for (const target of REVIEW_TARGETS) {
      for (const theme of target.themes) {
        const widths = shots
          .filter((shot) => shot.path === target.path && shot.theme === theme)
          .map((shot) => shot.width);
        expect(widths, `${target.path} ${theme}`).toEqual([390, 820, 1440]);
      }
    }
  });
});

describe('planReview: refusals', () => {
  it('refuses, and plans nothing else, when the output folder is not git-ignored', () => {
    const steps = planReview({ outputIgnored: false });

    expect(steps).toEqual([
      { kind: 'refuse', name: 'output-not-ignored', message: OUTPUT_NOT_IGNORED_MESSAGE, exitCode: 1 },
    ]);
    expect(OUTPUT_NOT_IGNORED_MESSAGE).toContain('artifacts/owner-review');
    expect(OUTPUT_NOT_IGNORED_MESSAGE).toContain('git-ignored');
  });

  it('checks the ignore rule before the port, so a busy port never hides it', () => {
    const steps = planReview({ outputIgnored: false, portBusy: true });

    expect(names(steps)).toEqual(['output-not-ignored']);
  });

  it('refuses with the shared wait message when port 5199 is busy, and never plans a kill', () => {
    const steps = planReview({ outputIgnored: true, portBusy: true });

    expect(steps).toEqual([{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }]);
  });
});

describe('planReview: the run', () => {
  const fresh = { outputIgnored: true, bundleMtime: 2000, newestSourceMtime: 1000 } as const;

  it('runs preflight, the CSPS_E2E seed, the host, the capture and the report, in that order, for a fresh bundle', () => {
    expect(names(planReview(fresh))).toEqual(['preflight', 'seed', 'host', 'capture', 'report']);
  });

  it('rebuilds the e2e bundle when it is missing', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: null, newestSourceMtime: 1000 });

    expect(names(steps)).toEqual(['preflight', 'seed', 'build', 'host', 'capture', 'report']);
  });

  it('rebuilds the e2e bundle when any source is newer than it (L-29), not only when it is missing', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: 1000, newestSourceMtime: 1001 });

    expect(names(steps)).toContain('build');
  });

  it('keeps a bundle that is as new as the newest source', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: 1000, newestSourceMtime: 1000 });

    expect(names(steps)).not.toContain('build');
  });

  it('skips only the preflight when the preflight script is not on this machine', () => {
    expect(names(planReview({ ...fresh, preflightAvailable: false }))).toEqual(['seed', 'host', 'capture', 'report']);
  });

  it('runs the read-only shared-machine preflight on this project ports', () => {
    const preflight = planReview(fresh).find((step) => step.name === 'preflight');

    expect(preflight).toEqual({
      kind: 'run',
      name: 'preflight',
      command: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT_SCRIPT, '-Ports', '5180,5115,7028,5199'],
      cwd: repoRoot,
    });
  });

  it('seeds only CSPS_E2E through the guarded dev-seed tool', () => {
    const seed = planReview(fresh).find((step) => step.name === 'seed');

    expect(seed).toMatchObject({
      kind: 'run',
      command: 'dotnet',
      args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'],
      cwd: repoRoot,
    });
  });

  it('builds the e2e bundle on this Node binary with the vite entry (no .cmd shim, L-22)', () => {
    const build = planReview({ outputIgnored: true, bundleMtime: null, newestSourceMtime: 1 }).find(
      (step) => step.name === 'build',
    );

    expect(build).toEqual({
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'],
      cwd: webDirectory,
    });
  });

  it('starts the real host on https://localhost:5199 serving web/.e2e-dist, with its variables on that child only', () => {
    const host = planReview(fresh).find((step) => step.name === 'host');

    expect(E2E_DIST).toBe(path.join(webDirectory, '.e2e-dist'));
    expect(host).toMatchObject({ kind: 'host', command: 'dotnet', healthUrl: 'https://localhost:5199/health' });
    if (host?.kind !== 'host') {
      throw new Error('expected a host step');
    }
    expect(host.args).toEqual(expect.arrayContaining(['--no-launch-profile', '--urls', 'https://localhost:5199']));
    expect(host.args[host.args.indexOf('--webroot') + 1]).toBe(E2E_DIST);
    expect(host.args).toContain('--staticWebAssets');
    expect(host.env).toEqual({
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__Csps: 'Server=(localdb)\\CSPS;Database=CSPS_E2E;Integrated Security=true',
    });
  });

  it('captures the planned shots from the host origin and writes the report into artifacts/owner-review', () => {
    const steps = planReview(fresh);
    const capture = steps.find((step) => step.name === 'capture');
    const report = steps.find((step) => step.name === 'report');

    expect(capture).toEqual({
      kind: 'capture',
      name: 'capture',
      origin: 'https://localhost:5199',
      shots: planShots(),
      specGap: planSpecGapShots(),
    });
    expect(report).toEqual({
      kind: 'report',
      name: 'report',
      file: path.join(OUTPUT_DIR, 'index.html'),
      parityResults: path.join(webDirectory, 'test-results', 'parity-results.json'),
      differencesGuide: path.join(repoRoot, 'docs', 'web', 'parity.md'),
    });
    expect(OUTPUT_DIR).toBe(path.join(repoRoot, 'artifacts', 'owner-review'));
  });
});

describe('assertWritable', () => {
  it('accepts a file inside artifacts/owner-review', () => {
    const file = path.join(OUTPUT_DIR, 'shots', 'public-home-light-390.png');

    expect(assertWritable(file)).toBe(file);
  });

  it.each([
    ['the output folder itself', OUTPUT_DIR],
    ['a sibling folder', path.join(repoRoot, 'artifacts', 'owner-review-old', 'a.png')],
    ['the app source', path.join(repoRoot, 'web', 'src', 'a.png')],
    ['the server source', path.join(repoRoot, 'src', 'Csps.Server', 'a.png')],
    ['the server web root', path.join(repoRoot, 'src', 'Csps.Server', 'wwwroot', 'a.png')],
    ['a path that climbs out', path.join(OUTPUT_DIR, '..', '..', 'web', 'src', 'a.png')],
  ])('refuses %s', (_label, file) => {
    expect(() => assertWritable(file)).toThrow(/Refusing to write outside artifacts\/owner-review/);
  });
});

describe('executeReview', () => {
  function fakeDeps(options: { runStatus?: number; captureFails?: boolean; hostFails?: boolean } = {}) {
    const calls: string[] = [];
    return {
      calls,
      deps: {
        run: (step: { name: string }) => {
          calls.push(`run ${step.name}`);
          return options.runStatus ?? 0;
        },
        startHost: () => {
          calls.push('host start');
          if (options.hostFails === true) {
            return Promise.reject(new Error('the host did not answer'));
          }
          return Promise.resolve({
            stop: () => {
              calls.push('host stop');
              return Promise.resolve();
            },
          });
        },
        capture: () => {
          calls.push('capture');
          if (options.captureFails === true) {
            return Promise.reject(new Error('h1 never showed'));
          }
          return Promise.resolve({ captured: planShots(), problems: [] });
        },
        writeReport: () => {
          calls.push('report');
        },
        log: (line: string) => {
          calls.push(`log ${line}`);
        },
      },
    };
  }

  it('returns the refusal exit code and runs nothing on a refusal', async () => {
    const { calls, deps } = fakeDeps();

    const code = await executeReview(planReview({ outputIgnored: false }), deps);

    expect(code).toBe(1);
    expect(calls).toEqual([`log review: ${OUTPUT_NOT_IGNORED_MESSAGE}`]);
  });

  it('runs every step, stops its own host after the capture and before the report, and returns 0', async () => {
    const { calls, deps } = fakeDeps();

    const code = await executeReview(
      planReview({ outputIgnored: true, bundleMtime: null, newestSourceMtime: 1 }),
      deps,
    );

    expect(code).toBe(0);
    expect(calls.filter((call) => !call.startsWith('log'))).toEqual([
      'run preflight',
      'run seed',
      'run build',
      'host start',
      'capture',
      'host stop',
      'report',
    ]);
  });

  it('stops at the first failing run step with its exit code, before any host starts', async () => {
    const { calls, deps } = fakeDeps({ runStatus: 3 });

    const code = await executeReview(planReview({ outputIgnored: true, bundleMtime: 5, newestSourceMtime: 1 }), deps);

    expect(code).toBe(3);
    expect(calls).not.toContain('host start');
  });

  it('returns 1 and writes no report when the host never becomes healthy', async () => {
    const { calls, deps } = fakeDeps({ hostFails: true });

    const code = await executeReview(planReview({ outputIgnored: true, bundleMtime: 5, newestSourceMtime: 1 }), deps);

    expect(code).toBe(1);
    expect(calls).not.toContain('report');
    expect(calls).toContain('log review: the host did not answer');
  });

  it('still stops its own host when the capture fails, and writes no report', async () => {
    const { calls, deps } = fakeDeps({ captureFails: true });

    const code = await executeReview(planReview({ outputIgnored: true, bundleMtime: 5, newestSourceMtime: 1 }), deps);

    expect(code).toBe(1);
    expect(calls).toContain('host stop');
    expect(calls).not.toContain('report');
  });
});

describe('renderIndex', () => {
  const shots = planShots();

  it('is one self-contained page: no script, no remote address, every picture a relative link', () => {
    const html = renderIndex({ generatedAt: '2026-10-09T10:00:00-05:00', shots, problems: [] });

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    for (const shot of shots) {
      expect(html).toContain(`src="${shot.file}"`);
    }
  });

  it('names every page in plain words, with the theme as the owner knows it and the width in px', () => {
    const html = renderIndex({ generatedAt: '2026-10-09T10:00:00-05:00', shots, problems: [] });

    for (const target of REVIEW_TARGETS) {
      expect(html).toContain(target.title);
    }
    expect(html).toContain('Blush (light)');
    expect(html).toContain('Espresso (dark)');
    expect(html).toContain('390 px');
    expect(html).toContain('820 px');
    expect(html).toContain('1440 px');
  });

  it('escapes the text it writes', () => {
    const html = renderIndex({ generatedAt: '<b>&', shots: [], problems: ['<script>alert(1)</script>'] });

    expect(html).toContain('&lt;b&gt;&amp;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toMatch(/<script/i);
  });
});

describe('SPEC_GAP_CASES (primitives the approved design never drew)', () => {
  const ids = SPEC_GAP_CASES.map((entry) => entry.id);

  it('covers every SPEC-GAP primitive the owner checks: Pagination, OtpInput, MoneyInput, Checkbox, SkipLink, list states, LazyImage, ErrorState, skeletons, the drawer and the user menu', () => {
    for (const prefix of [
      'pagination-',
      'otp-',
      'money-input-',
      'checkbox-',
      'skip-link-',
      'rt-loading',
      'rt-error',
      'rt-empty',
      'rt-no-matches',
      'lazy-image-',
      'error-state-',
      'skeleton-',
      'drawer-open',
      'user-menu-open',
    ]) {
      expect(
        ids.some((id) => id.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every case in plain words', () => {
    for (const entry of SPEC_GAP_CASES) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.label, entry.id).not.toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('plans one picture per case in Blush and in Espresso, under spec-gap/', () => {
    const shots = planSpecGapShots();

    expect(shots).toHaveLength(SPEC_GAP_CASES.length * 2);
    for (const shot of shots) {
      expect(shot.file).toBe(`spec-gap/${shot.id}-${shot.theme}.png`);
    }
  });

  it('shows the phone drawer at phone width and every other case at laptop width', () => {
    for (const shot of planSpecGapShots()) {
      expect(shot.width, shot.id).toBe(shot.id === 'drawer-open' ? 390 : 1440);
    }
  });
});

/** A Playwright JSON report shaped like the real one (suites nest; one test per project). */
function jsonReport(specs: readonly { title: string; tests: readonly { projectName: string; status: string }[] }[]) {
  return {
    config: {
      argv: ['node', 'cli.js', 'test', '--config', 'visual/playwright.visual.config.ts', '--grep', '@actions'],
    },
    stats: { startTime: '2026-10-09T12:41:03.225Z', duration: 1_800_000, expected: 0, unexpected: 0 },
    suites: [
      {
        title: 'parity.spec.ts',
        specs: [],
        suites: [{ title: '', specs: specs.map((spec) => ({ title: spec.title, tests: spec.tests })) }],
      },
    ],
  };
}

describe('summarizeParity', () => {
  it('says plainly that no results exist when the parity run has never written its report', () => {
    expect(summarizeParity(null)).toEqual({ available: false });
  });

  it('counts passed, failed, flaky and skipped rows per engine and per group', () => {
    const summary = summarizeParity(
      jsonReport([
        {
          title: '@parity @actions light 390px rest',
          tests: [
            { projectName: 'chromium', status: 'expected' },
            { projectName: 'firefox', status: 'expected' },
            { projectName: 'webkit', status: 'unexpected' },
          ],
        },
        {
          title: '@parity @actions light 820px rest @chromium-only',
          tests: [
            { projectName: 'chromium', status: 'flaky' },
            { projectName: 'firefox', status: 'skipped' },
          ],
        },
        {
          title: '@parity @selftest a 1px padding change on the implementation is reported',
          tests: [{ projectName: 'chromium', status: 'expected' }],
        },
      ]),
    );

    expect(summary).toEqual({
      available: true,
      startTime: '2026-10-09T12:41:03.225Z',
      durationMinutes: 30,
      filters: '--grep @actions',
      totals: { passed: 3, failed: 1, flaky: 1, skipped: 1 },
      rows: [
        { engine: 'chromium', group: 'actions', passed: 1, failed: 0, flaky: 1, skipped: 0 },
        { engine: 'chromium', group: 'selftest', passed: 1, failed: 0, flaky: 0, skipped: 0 },
        { engine: 'firefox', group: 'actions', passed: 1, failed: 0, flaky: 0, skipped: 1 },
        { engine: 'webkit', group: 'actions', passed: 0, failed: 1, flaky: 0, skipped: 0 },
      ],
      failures: ['webkit: @parity @actions light 390px rest'],
    });
  });

  it('reports a run with no filter as the whole matrix', () => {
    const report = jsonReport([]);
    report.config.argv = ['node', 'cli.js', 'test', '--config', 'visual/playwright.visual.config.ts'];

    const summary = summarizeParity(report);

    expect(summary.available && summary.filters).toBe('');
  });
});

describe('parseDifferencesTable (docs/web/parity.md section 6)', () => {
  const sample = [
    '## 5. Something else',
    '| a | b | c |',
    '## 6. The intentional differences (the complete list)',
    '',
    'Everything not in this table must be equal.',
    '',
    '| Difference | Decision | How the proof treats it |',
    '|---|---|---|',
    '| Inactive rows sit on `--surface-2` | D-02 | Rulings layer, so equal |',
    '| Sidebar Logout is a `<button>` | D-27 | Structural exception |',
    '',
    '## 7. The matrix',
    '| x | y | z |',
  ].join('\n');

  it('reads only the section 6 table rows, without the header and separator', () => {
    expect(parseDifferencesTable(sample)).toEqual([
      { difference: 'Inactive rows sit on `--surface-2`', decision: 'D-02', treatment: 'Rulings layer, so equal' },
      { difference: 'Sidebar Logout is a `<button>`', decision: 'D-27', treatment: 'Structural exception' },
    ]);
  });

  it('throws when the section is gone, so the report never silently drops the list', () => {
    expect(() => parseDifferencesTable('## 1. Nothing here')).toThrow(/intentional differences/);
  });

  it('reads the real guide: every row has a decision ID, including D-27, D-32, D-39 and D-40', () => {
    const rows = parseDifferencesTable(readFileSync(path.join(repoRoot, 'docs', 'web', 'parity.md'), 'utf8'));
    const decisions = rows.map((row) => row.decision).join(' ');

    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(row.decision, row.difference).toMatch(/(?:D-(?:BL-)?\d+|O-\d+|[A-Z]+-\d+)/);
    }
    for (const id of ['D-27', 'D-32', 'D-39', 'D-40']) {
      expect(decisions).toContain(id);
    }
  });
});

describe('renderIndex: SPEC-GAP section and parity summary (D-23)', () => {
  const differences = [
    { difference: 'Sidebar Logout is a `<button>`', decision: 'D-27', treatment: 'Structural exception' },
    { difference: 'A zero KpiCard is dimmed', decision: 'D-39', treatment: 'Rulings layer, so equal' },
  ];

  it('shows every SPEC-GAP picture with its plain label and both themes', () => {
    const html = renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      specGap: planSpecGapShots(),
      parity: { summary: { available: false }, differences },
    });

    expect(html).toContain('Parts the approved design never drew');
    for (const shot of planSpecGapShots()) {
      expect(html).toContain(`src="${shot.file}"`);
    }
    for (const entry of SPEC_GAP_CASES) {
      expect(html).toContain(entry.label);
    }
  });

  it('lists every intentional difference with its decision ID', () => {
    const html = renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      parity: { summary: { available: false }, differences },
    });

    expect(html).toContain('<td>D-27</td>');
    expect(html).toContain('<td>D-39</td>');
    expect(html).toContain('Sidebar Logout is a <code>&lt;button&gt;</code>');
  });

  it('says plainly when there are no parity results yet', () => {
    const html = renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      parity: { summary: { available: false }, differences },
    });

    expect(html).toContain('No look-check results were found');
  });

  it('shows the counts per engine and group, the run time and any failure', () => {
    const summary = summarizeParity(
      jsonReport([
        {
          title: '@parity @actions light 390px rest',
          tests: [
            { projectName: 'chromium', status: 'expected' },
            { projectName: 'webkit', status: 'unexpected' },
          ],
        },
      ]),
    );

    const html = renderIndex({ generatedAt: 'now', shots: [], problems: [], parity: { summary, differences } });

    expect(html).toContain('Chrome engine (Chromium)');
    expect(html).toContain('Safari engine (WebKit)');
    expect(html).toContain('<td>actions</td>');
    expect(html).toContain('webkit: @parity @actions light 390px rest');
    expect(html).toContain('--grep @actions');
  });
});
