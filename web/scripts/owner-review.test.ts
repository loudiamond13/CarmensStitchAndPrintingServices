// @vitest-environment node
// Pins `npm run review` (D-23, plan 02-36): the owner's local screenshot report. The run is planned as data and tested
// here without starting anything: it refuses unless its output folder is git-ignored, refuses a busy port 5199, runs
// the preflight, the guarded CSPS_E2E seed and a rebuild of the e2e bundle whenever a source is newer than it (L-29),
// starts the real host for its own run only, captures every page at 390, 820 and 1440 px (the admin pages in both
// themes) and writes one index.html. It writes nowhere but artifacts/owner-review/.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PORT_BUSY_MESSAGE } from './e2e.mjs';
import { EXPENSES_COPY } from '../src/modules/admin/expensesCopy.ts';
import { SETTINGS_COPY } from '../src/modules/admin/settingsCopy.ts';
import { scenarios as authGapScenarios } from '../src/dev/scenarios/groups/auth-gaps.ts';
import {
  assertSwapsApplied,
  assertWritable,
  AUTH_REVIEW_CASES,
  AUTH_REVIEW_RULINGS,
  BEFORE_AFTER_CASES,
  beforeAfterScript,
  E2E_DIST,
  executeReview,
  OUTPUT_DIR,
  OUTPUT_NOT_IGNORED_MESSAGE,
  parseDifferencesTable,
  PHASE5_EDGE_ASSUMPTIONS,
  PHASE5_OPEN_ITEMS,
  PHASE5_REVIEW_CASES,
  PHASE5_RULED,
  PHASE5_SEED_PEOPLE,
  PHASE6_LOOK_AT,
  PHASE6_REVIEW_CASES,
  PHASE6_RULINGS,
  PHASE6_SEED_PEOPLE,
  phase5Words,
  phase6Words,
  planAuthReviewShots,
  planBeforeAfterShots,
  planPhase5ReviewShots,
  planPhase6ReviewShots,
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

  it('lists the public page, the two dev previews, the real Phase 5 and Phase 6 pages and the showcase, in that order', () => {
    expect(REVIEW_TARGETS.map((target) => target.path)).toEqual([
      '/',
      '/admin',
      '/admin/orders',
      '/admin/expenses',
      '/admin/users',
      '/admin/profile',
      '/admin/audit-log',
      '/admin/expenses/deleted',
      '/admin/settings',
      '/dev/components',
    ]);
    expect(Object.isFrozen(REVIEW_TARGETS)).toBe(true);
  });

  it('photographs the real Phase 5 and Phase 6 pages signed in, and the dev previews and showcase unsigned (plans 05-37, 06-19)', () => {
    const signedIn = REVIEW_TARGETS.filter((target) => target.signedIn === true).map((target) => target.path);

    expect(signedIn).toEqual([
      '/admin/expenses',
      '/admin/users',
      '/admin/profile',
      '/admin/audit-log',
      '/admin/expenses/deleted',
      '/admin/settings',
    ]);
  });

  it('names the new Phase 6 pages by the words their h1 shows', () => {
    const byPath = Object.fromEntries(REVIEW_TARGETS.map((target) => [target.path, target]));

    expect(byPath['/admin/expenses']).toMatchObject({ h1: 'Company Expenses', signedIn: true });
    expect(byPath['/admin/expenses/deleted']).toMatchObject({ h1: 'Deleted Expenses', slug: 'admin-expenses-deleted' });
    expect(byPath['/admin/settings']).toMatchObject({ h1: 'Settings', slug: 'admin-settings' });
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
  it('plans 57 screenshots: the public page 3, two previews and eight real pages 3 x 2 each, the showcase 3 x 2', () => {
    const shots = planShots();

    expect(shots).toHaveLength(57);
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

  // The shared-machine preflight is a wait gate in main(), before planning (shared-machine.mjs, TOOL-WR-08).
  it('runs the CSPS_E2E seed, the host, the capture and the report, in that order, for a fresh bundle', () => {
    expect(names(planReview(fresh))).toEqual(['seed', 'host', 'capture', 'report']);
  });

  it('rebuilds the e2e bundle when it is missing', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: null, newestSourceMtime: 1000 });

    expect(names(steps)).toEqual(['seed', 'build', 'host', 'capture', 'report']);
  });

  it('rebuilds the e2e bundle when any source is newer than it (L-29), not only when it is missing', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: 1000, newestSourceMtime: 1001 });

    expect(names(steps)).toContain('build');
  });

  it('keeps a bundle that is as new as the newest source', () => {
    const steps = planReview({ outputIgnored: true, bundleMtime: 1000, newestSourceMtime: 1000 });

    expect(names(steps)).not.toContain('build');
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
    // The Testing environment serves the staff fixture and the mail sink the signed-in pictures need (plan 05-37), as
    // the Playwright E2E host does; nothing secret is passed and nothing is set at User or Machine level.
    expect(host.env).toEqual({
      ASPNETCORE_ENVIRONMENT: 'Testing',
      Csps__Testing__LoadUserSecrets: 'true',
      App__PublicBaseUrl: 'https://localhost:5199',
      Email__Dispatcher__SweepInterval: '00:00:01',
      ConnectionStrings__Csps: 'Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true',
      RateLimits__Auth__SignIn__PermitLimit: '100000',
      RateLimits__Auth__Verify__PermitLimit: '100000',
      RateLimits__Auth__Resend__PermitLimit: '100000',
      RateLimits__Auth__Forgot__PermitLimit: '100000',
      RateLimits__Auth__Reset__PermitLimit: '100000',
      RateLimits__Auth__Refresh__PermitLimit: '100000',
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
      beforeAfter: planBeforeAfterShots(),
      authReview: planAuthReviewShots(),
      phase5Review: planPhase5ReviewShots(),
      phase6Review: planPhase6ReviewShots(),
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

describe('AUTH_REVIEW_CASES (the Phase 4 sign-in screens and devices, plan 04-32, D-06 and D-41)', () => {
  const ids = AUTH_REVIEW_CASES.map((entry) => entry.id);

  it('covers S1 to S7, the Note uses, both sign-out dialogs open and failed, the four-item menu and the toasts', () => {
    for (const id of [
      'note-uses',
      'signin-notice',
      'signin-banner-trace',
      'verify-default',
      'verify-code-error',
      'verify-resend-waiting',
      'verify-resend-cap',
      'verify-long-email',
      'new-password-temporary',
      'new-password-breach',
      'forgot-form',
      'forgot-sent',
      'forgot-long-email',
      'reset-checking',
      'reset-form',
      'reset-invalid',
      'reset-long-email',
      'invite-checking',
      'invite-form',
      'invite-invalid',
      'invite-fail-closed',
      'invite-long-email',
      'devices-loading',
      'devices-error',
      'devices-only-this-device',
      'devices-populated',
      'signout-others-open',
      'signout-others-failed',
      'signout-device-open',
      'signout-device-failed',
      'session-menu-open',
      'toast-session-ending',
      'toast-device-signed-out',
      'toast-already-signed-out',
      'toast-signed-out-others',
      'toast-password-saved',
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every case in plain words and every case is a scenario of the auth-gaps group', () => {
    const scenarioIds = authGapScenarios.map((scenario) => scenario.id);
    for (const entry of AUTH_REVIEW_CASES) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.label, entry.id).not.toMatch(/^[a-z0-9-]+$/);
      expect(scenarioIds, entry.id).toContain(entry.id);
    }
    // Nothing in the group is left out of the pack.
    expect(scenarioIds.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('opens a fixed-position case (the dialogs) by its demo button and the menu by "Show this example"', () => {
    for (const scenario of authGapScenarios) {
      const entry = AUTH_REVIEW_CASES.find((candidate) => candidate.id === scenario.id);
      if (scenario.frame === 'viewport') {
        expect(entry?.kind, scenario.id).toBe('dialog');
      } else if (scenario.id === 'session-menu-open') {
        expect(entry?.kind, scenario.id).toBe('menu');
      } else {
        expect(entry?.kind, scenario.id).toBe('frame');
      }
    }
  });

  it('plans each case at 390, 820 and 1440 px under auth-review/, the cards in Blush and the rest in both themes', () => {
    const shots = planAuthReviewShots();
    const themesOf = (id: string) => [...new Set(shots.filter((shot) => shot.id === id).map((shot) => shot.theme))];

    expect(new Set(shots.map((shot) => shot.width))).toEqual(new Set([390, 820, 1440]));
    for (const shot of shots) {
      expect(shot.file).toBe(`auth-review/${shot.id}-${shot.theme}-${String(shot.width)}.png`);
    }
    for (const scenario of authGapScenarios) {
      expect(themesOf(scenario.id), scenario.id).toEqual([...scenario.themes]);
    }
    expect(shots).toHaveLength(
      authGapScenarios.reduce((total, scenario) => total + scenario.themes.length * REVIEW_WIDTHS.length, 0),
    );
  });
});

describe('AUTH_REVIEW_RULINGS (OQ-1 to OQ-7)', () => {
  it('lists the seven open questions with the default the contract applies', () => {
    expect(AUTH_REVIEW_RULINGS.map((ruling) => ruling.id)).toEqual([
      'OQ-1',
      'OQ-2',
      'OQ-3',
      'OQ-4',
      'OQ-5',
      'OQ-6',
      'OQ-7',
    ]);
    for (const ruling of AUTH_REVIEW_RULINGS) {
      expect(ruling.question.trim(), ruling.id).not.toBe('');
      expect(ruling.default.trim(), ruling.id).not.toBe('');
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

// D-41 R2-06 (owner, 2026-10-13) and D-08: a visible wording change goes to the owner as a before/after. "Before" is the
// approved wording, "after" what the app shows now (the PRD §5.1 names: Subtotal before discount, Total after it).
const MINUS = '\u2212';
const SPEC_NOTE = `Profit = Total ${MINUS} Discount ${MINUS} Expenses. Internal only.`;
const PRD_NOTE = `Profit = Subtotal ${MINUS} Discount ${MINUS} Expenses. Internal only.`;

describe('BEFORE_AFTER_CASES (wording changes for the owner to confirm, D-41 R2-06)', () => {
  it('holds exactly the totals panel, the card totals and the demo Orders table, frozen', () => {
    expect(BEFORE_AFTER_CASES.map((entry) => entry.id)).toEqual([
      'order-totals-0148',
      'order-totals-card-0148',
      'data-table-orders',
    ]);
    expect(Object.isFrozen(BEFORE_AFTER_CASES)).toBe(true);
    for (const entry of BEFORE_AFTER_CASES) {
      expect(entry.decision, entry.id).toBe('D-41 (R2-06)');
    }
  });

  it('swaps the panel row and note, the card row, and the table Total figures', () => {
    const swaps = Object.fromEntries(BEFORE_AFTER_CASES.map((entry) => [entry.id, entry.swaps]));

    expect(swaps['order-totals-0148']).toEqual([
      { before: 'Total', after: 'Subtotal' },
      { before: SPEC_NOTE, after: PRD_NOTE },
    ]);
    expect(swaps['order-totals-card-0148']).toEqual([{ before: 'Total', after: 'Subtotal' }]);
    expect(swaps['data-table-orders']).toEqual([
      { before: '₱22,450.00', after: '₱21,327.50' },
      { before: '₱23,000.00', after: '₱22,500.00' },
    ]);
  });

  it('names each case in plain words and never swaps a text for itself', () => {
    for (const entry of BEFORE_AFTER_CASES) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.label, entry.id).not.toMatch(/^[a-z0-9-]+$/);
      expect(entry.swaps.length, entry.id).toBeGreaterThan(0);
      for (const swap of entry.swaps) {
        expect(swap.before, entry.id).not.toBe(swap.after);
      }
    }
  });

  it('uses only scenario ids of the shared scenario list', () => {
    const groups = path.join(webDirectory, 'src', 'dev', 'scenarios', 'groups');
    const sources = readdirSync(groups)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => readFileSync(path.join(groups, file), 'utf8'))
      .join('\n');
    for (const entry of BEFORE_AFTER_CASES) {
      expect(sources, entry.id).toMatch(new RegExp(`Case\\(\\s*'${entry.id}'`));
    }
  });
});

describe('planBeforeAfterShots', () => {
  it('plans a before and an after picture per case, in Blush at 1440 px, under before-after/', () => {
    const shots = planBeforeAfterShots();

    expect(shots).toHaveLength(BEFORE_AFTER_CASES.length * 2);
    expect(shots.map((shot) => shot.file)).toEqual(
      BEFORE_AFTER_CASES.flatMap((entry) => [
        `before-after/${entry.id}-before.png`,
        `before-after/${entry.id}-after.png`,
      ]),
    );
    for (const shot of shots) {
      expect(shot.theme, shot.file).toBe('light');
      expect(shot.width, shot.file).toBe(1440);
      expect(shot.decision, shot.file).toBe('D-41 (R2-06)');
    }
  });
});

/** A minimal text-node tree for the page script (this program has no DOM). */
interface FakeNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: FakeNode[];
}
const text = (value: string): FakeNode => ({ nodeType: 3, nodeValue: value, childNodes: [] });
const element = (...childNodes: FakeNode[]): FakeNode => ({ nodeType: 1, nodeValue: null, childNodes });

function runScript(script: string, frames: Record<string, FakeNode[]>): unknown {
  const document = { querySelectorAll: (selector: string) => frames[selector] ?? [] };
  return runInNewContext(script, { document });
}

describe('beforeAfterScript (the page script that writes the approved wording back)', () => {
  it('replaces only the exact text nodes inside the one case frame and returns a count per swap', () => {
    const row = text('Subtotal');
    const discount = text('Total Discount');
    const note = text(PRD_NOTE);
    const outside = text('Subtotal');
    const frame = element(element(row, discount), element(note));
    const swaps = [
      { before: 'Total', after: 'Subtotal' },
      { before: SPEC_NOTE, after: PRD_NOTE },
      { before: 'x', after: 'nowhere' },
    ];

    const counts = runScript(beforeAfterScript('order-totals-0148', swaps), {
      '[data-case="order-totals-0148"]': [frame],
      body: [element(outside)],
    });

    expect(counts).toEqual([1, 1, 0]);
    expect(row.nodeValue).toBe('Total');
    expect(discount.nodeValue).toBe('Total Discount');
    expect(note.nodeValue).toBe(SPEC_NOTE);
    expect(outside.nodeValue).toBe('Subtotal');
  });

  it('returns null unless exactly one frame has the case id', () => {
    const script = beforeAfterScript('order-totals-0148', [{ before: 'Total', after: 'Subtotal' }]);

    expect(runScript(script, {})).toBeNull();
    expect(
      runScript(script, { '[data-case="order-totals-0148"]': [element(text('Subtotal')), element(text('Subtotal'))] }),
    ).toBeNull();
  });

  it('writes the swaps and the case id as JSON, never as raw text', () => {
    const swaps = [{ before: `</script>"'\\`, after: '`${x}`' }];
    const script = beforeAfterScript('a"b', swaps);

    expect(script).toContain(JSON.stringify(swaps));
    expect(script).toContain(JSON.stringify('[data-case="a\\"b"]'));
  });
});

describe('assertSwapsApplied', () => {
  const swaps = [
    { before: 'Total', after: 'Subtotal' },
    { before: SPEC_NOTE, after: PRD_NOTE },
  ];

  it('passes when every swap changed at least one text', () => {
    expect(() => {
      assertSwapsApplied('order-totals-0148', swaps, [1, 2]);
    }).not.toThrow();
  });

  it('fails naming the case and the text when a swap matched nothing, so an outdated case never shows two equal pictures', () => {
    expect(() => {
      assertSwapsApplied('order-totals-0148', swaps, [1, 0]);
    }).toThrow(/order-totals-0148.*Profit = Subtotal/);
  });

  it('fails naming the case when its frame was not found', () => {
    expect(() => {
      assertSwapsApplied('order-totals-0148', swaps, null);
    }).toThrow(/order-totals-0148/);
  });
});

describe('renderIndex: wording changes for the owner to confirm (D-41 R2-06)', () => {
  const beforeAfter = planBeforeAfterShots();

  it('shows the section before the SPEC-GAP section, with the plain-words note', () => {
    const html = renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      specGap: planSpecGapShots(),
      beforeAfter,
    });
    const section = html.indexOf('Wording changes for you to confirm (before and after)');

    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(html.indexOf('Parts the approved design never drew'));
    expect(html).toContain('D-41 R2-06');
    expect(html).toContain('Subtotal');
    expect(html).toContain('before discount');
    expect(html).toContain('after discount');
    expect(html).toContain('Fully Paid');
    expect(html).toContain('only the words change');
    expect(html).toContain('no row for the Total after discount');
    expect(html).not.toMatch(/<script/i);
  });

  it('lists every swap in a Place / Before / After table and shows both pictures of each case', () => {
    const html = renderIndex({ generatedAt: 'now', shots: [], problems: [], beforeAfter });

    expect(html).toContain('<th>Place</th><th>Before</th><th>After</th>');
    for (const entry of BEFORE_AFTER_CASES) {
      expect(html).toContain(entry.label);
      for (const swap of entry.swaps) {
        expect(html).toContain(`<td>${swap.before}</td><td>${swap.after}</td>`);
      }
    }
    for (const shot of beforeAfter) {
      expect(html).toContain(`src="${shot.file}"`);
    }
  });

  it('escapes the labels and alt text', () => {
    const html = renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      beforeAfter: [
        {
          id: 'x',
          label: '<b>"x"</b>',
          decision: 'D-41 (R2-06)',
          side: 'before',
          theme: 'light',
          width: 1440,
          file: 'before-after/x-before.png',
          swaps: [{ before: '<i>', after: '&' }],
        },
      ],
    });

    expect(html).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    expect(html).toContain('<td>&lt;i&gt;</td><td>&amp;</td>');
    expect(html).not.toContain('<b>"x"</b>');
  });

  it('has no section when there are no before/after pictures', () => {
    const html = renderIndex({ generatedAt: 'now', shots: [], problems: [] });

    expect(html).not.toContain('Wording changes for you to confirm');
  });
});

describe('renderIndex: the Phase 4 sign-in screens and devices (plan 04-32)', () => {
  const escaped = (text: string) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const html = renderIndex({
    generatedAt: 'now',
    shots: [],
    problems: [],
    specGap: planSpecGapShots(),
    authReview: planAuthReviewShots(),
  });

  it('shows the section before the SPEC-GAP section, with every open question and its default', () => {
    const section = html.indexOf('Sign-in screens and devices (Phase 4)');

    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(html.indexOf('Parts the approved design never drew'));
    for (const ruling of AUTH_REVIEW_RULINGS) {
      expect(html).toContain(ruling.id);
      expect(html).toContain(escaped(ruling.question));
    }
    expect(html).not.toMatch(/<script/i);
  });

  it('shows every picture with its plain label', () => {
    for (const shot of planAuthReviewShots()) {
      expect(html).toContain(`src="${shot.file}"`);
    }
    for (const entry of AUTH_REVIEW_CASES) {
      expect(html).toContain(escaped(entry.label));
    }
  });

  it('lists the words of every new screen, dialog, notice and toast for the OQ-7 wording check', () => {
    expect(html).toContain('Words on the new screens');
    expect(html).toContain('Sign out of other devices?');
    expect(html).toContain('Your session ends soon');
    expect(html).toContain('This link has expired');
    expect(html).toContain('No other devices are signed in.');
  });

  it('is left out when no Phase 4 pictures were taken', () => {
    expect(renderIndex({ generatedAt: 'now', shots: [], problems: [] })).not.toContain('Sign-in screens and devices');
  });
});

// --- Plan 05-37: the Phase 5 screens, signed in as a Manager ---

describe('PHASE5_SEED_PEOPLE (the staff the pictures need)', () => {
  it('makes a Manager to sign in as, and people in every state the roster shows, through the Testing staff fixture', () => {
    const states = PHASE5_SEED_PEOPLE.map((person) => person.state);

    expect(PHASE5_SEED_PEOPLE[0]).toMatchObject({ key: 'manager', role: 'Manager', state: 'active' });
    expect(states).toEqual(expect.arrayContaining(['active', 'deactivated', 'manager-locked', 'invited']));
    expect(new Set(PHASE5_SEED_PEOPLE.map((person) => person.key)).size).toBe(PHASE5_SEED_PEOPLE.length);
  });

  it('gives every person a real-looking name and no address of their own: the fixture makes one under csps.test', () => {
    for (const person of PHASE5_SEED_PEOPLE) {
      expect(person.firstName.trim(), person.key).not.toBe('');
      expect(person.lastName.trim(), person.key).not.toBe('');
      expect(Object.keys(person), person.key).not.toContain('email');
    }
  });
});

describe('PHASE5_REVIEW_CASES (the UI-SPEC Visual Review set)', () => {
  const ids = PHASE5_REVIEW_CASES.map((entry) => entry.id);

  it('covers U2 both routes and the shown-once step, U3 with its notes and meta, the four dialogs, P1 each tab, P2, P3, A1 and C1', () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        'add-invitation',
        'add-temporary-password',
        'add-shown-once',
        'edit-record-meta',
        'edit-email-change-note',
        'edit-pending-email',
        'edit-invited-email-note',
        'edit-account-access',
        'dialog-deactivate',
        'dialog-delete',
        'dialog-lock',
        'dialog-temporary-password',
        'profile-details-pending-email',
        'profile-security',
        'profile-appearance',
        'profile-change-email-dialog',
        'confirm-email-ready',
        'confirm-email-done',
        'confirm-email-invalid',
        'audit-expanded-row',
        'audit-no-matches',
        'audit-empty',
        'showcase-demo-banner',
        'shell-short-screen',
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every case in plain words and groups it', () => {
    for (const entry of PHASE5_REVIEW_CASES) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.group.trim(), entry.id).not.toBe('');
    }
  });

  it('shows the confirm-email page (P3) in Blush only, because the sign-in-style pages are always Blush', () => {
    for (const entry of PHASE5_REVIEW_CASES.filter((candidate) => candidate.id.startsWith('confirm-email-'))) {
      expect(entry.themes, entry.id).toEqual(['light']);
    }
  });

  it('plans each case at 390, 820 and 1440 px in its themes under phase5-review/, the short shell at 1280 px', () => {
    const shots = planPhase5ReviewShots();
    const files = shots.map((shot) => shot.file);

    expect(new Set(files).size).toBe(files.length);
    expect(files.every((file) => /^phase5-review\/[a-z0-9-]+-(light|dark)-\d+\.png$/.test(file))).toBe(true);
    for (const entry of PHASE5_REVIEW_CASES.filter((candidate) => candidate.id !== 'shell-short-screen')) {
      for (const theme of entry.themes) {
        const widths = shots.filter((shot) => shot.id === entry.id && shot.theme === theme).map((shot) => shot.width);
        expect(widths, `${entry.id} ${theme}`).toEqual([390, 820, 1440]);
      }
    }
    const short = shots.filter((shot) => shot.id === 'shell-short-screen');
    expect(short.map((shot) => [shot.theme, shot.width])).toEqual([
      ['light', 1280],
      ['dark', 1280],
    ]);
  });
});

describe('the Phase 5 rulings page content', () => {
  it('lists OQ-1 to OQ-11 as already ruled, each with its ruling and where it was ruled', () => {
    expect(PHASE5_RULED.map((entry) => entry.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => `OQ-${String(index + 1)}`),
    );
    for (const entry of PHASE5_RULED) {
      expect(entry.topic.trim(), entry.id).not.toBe('');
      expect(entry.ruling.trim(), entry.id).not.toBe('');
      expect(entry.ruledIn.trim(), entry.id).not.toBe('');
    }
    expect(PHASE5_RULED.find((entry) => entry.id === 'OQ-4')?.ruling).toContain('chooses');
  });

  it('keeps only what is still open for the owner: the screen wording, four edge assumptions, the word list and three real-world checks', () => {
    expect(PHASE5_OPEN_ITEMS.map((item) => item.id)).toEqual([
      'screen-wording',
      'edge-assumptions',
      'temporary-password-words',
      'phone-motion',
      'email-inbox',
      'cookie-after-deploy',
    ]);
    expect(PHASE5_EDGE_ASSUMPTIONS.map((entry) => entry.requirement)).toEqual([
      'PROF-02',
      'PROF-03',
      'USER-05',
      'USER-07',
    ]);
    for (const entry of PHASE5_EDGE_ASSUMPTIONS) {
      expect(entry.assumed.trim(), entry.requirement).not.toBe('');
    }
  });

  it('reads every new screen string out of the copy modules, with placeholders for what the app fills in', () => {
    const words = phase5Words();
    const texts = words.map((row) => row.text);

    expect(texts).toContain('Choose how the email change applies.');
    expect(texts).toContain('Waiting for confirmation at {email}. Until then, you sign in with {email}.');
    expect(texts).toContain('No entries in the last 7 days');
    expect(texts.some((text) => text.includes('former staff'))).toBe(true);
    expect(words.every((row) => row.place.trim() !== '' && row.text.trim() !== '')).toBe(true);
  });
});

describe('renderIndex: the Phase 5 screens and the rulings page (plan 05-37)', () => {
  const escaped = (text: string) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const html = renderIndex({
    generatedAt: 'now',
    shots: [],
    problems: [],
    specGap: planSpecGapShots(),
    phase5Review: planPhase5ReviewShots(),
  });

  it('shows the Phase 5 section before the SPEC-GAP section, with every picture and plain label', () => {
    const section = html.indexOf('Profile, users and audit log (Phase 5)');

    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(html.indexOf('Parts the approved design never drew'));
    for (const shot of planPhase5ReviewShots()) {
      expect(html).toContain(`src="${shot.file}"`);
    }
    for (const entry of PHASE5_REVIEW_CASES) {
      expect(html).toContain(escaped(entry.label));
    }
    expect(html).not.toMatch(/<script/i);
  });

  it('puts what is still open before what is already ruled, and lists only the open items as questions', () => {
    const open = html.indexOf('Still open for you');
    const ruled = html.indexOf('Already ruled');

    expect(open).toBeGreaterThan(-1);
    expect(ruled).toBeGreaterThan(open);
    for (const item of PHASE5_OPEN_ITEMS) {
      expect(html).toContain(escaped(item.title));
    }
    for (const entry of PHASE5_RULED) {
      expect(html.indexOf(`<td>${entry.id}</td>`), entry.id).toBeGreaterThan(ruled);
    }
  });

  it('shows the four flagged edge assumptions, the 40 temporary-password words and the screen words', () => {
    for (const entry of PHASE5_EDGE_ASSUMPTIONS) {
      expect(html).toContain(escaped(entry.assumed));
    }
    expect(html).toContain('Tela');
    expect(html).toContain('Zipper');
    expect(html).toContain('Choose how the email change applies.');
  });

  it('is left out when no Phase 5 pictures were taken', () => {
    expect(renderIndex({ generatedAt: 'now', shots: [], problems: [] })).not.toContain(
      'Profile, users and audit log (Phase 5)',
    );
  });
});

// --- Plan 06-19: the Phase 6 screens, signed in as a Manager and as an Admin ---

describe('PHASE6_SEED_PEOPLE (the staff the Phase 6 pictures add)', () => {
  it('adds a payer who is deleted at the end of the seed, so the list shows "(former staff)", and no address of their own', () => {
    expect(PHASE6_SEED_PEOPLE.map((person) => person.key)).toEqual(['dario']);
    for (const person of PHASE6_SEED_PEOPLE) {
      expect(person.role, person.key).toBe('Admin');
      expect(person.state, person.key).toBe('active');
      expect(person.firstName.trim(), person.key).not.toBe('');
      expect(person.lastName.trim(), person.key).not.toBe('');
      expect(Object.keys(person), person.key).not.toContain('email');
    }
  });
});

describe('PHASE6_REVIEW_CASES (the UI-SPEC Visual Review set for Phase 6)', () => {
  it('covers E1 as a Manager and an Admin with its states, E2, both E3 dialogs, E4, S1, S2 and the Audit Log', () => {
    const ids = PHASE6_REVIEW_CASES.map((entry) => entry.id);

    expect(ids).toEqual([
      'e1-manager-list',
      'e1-manager-empty-top-category',
      'e1-empty',
      'e1-no-matches',
      'e1-admin-list',
      'e2-add',
      'e2-edit-record-meta',
      'e2-edit-access-note',
      'e2-edit-conflict',
      'e2-view',
      'e3-delete',
      'e3-purge',
      'e4-rows',
      'e4-empty',
      's1-categories',
      's2-add-category',
      'audit-expense-expanded',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every case in plain words, groups it and shows it in Blush and Espresso', () => {
    for (const entry of PHASE6_REVIEW_CASES) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.group.trim(), entry.id).not.toBe('');
      expect(entry.themes, entry.id).toEqual(['light', 'dark']);
    }
  });

  it('signs in as an Admin only where the screen is an Admin screen: the Admin list, the access note and View', () => {
    const admin = PHASE6_REVIEW_CASES.filter((entry) => entry.signedInAs === 'Admin').map((entry) => entry.id);

    expect(admin).toEqual(['e1-admin-list', 'e2-edit-access-note', 'e2-view']);
    for (const entry of PHASE6_REVIEW_CASES.filter((candidate) => !admin.includes(candidate.id))) {
      expect(entry.signedInAs, entry.id).toBe('Manager');
    }
  });

  it('plans each case at 390, 820 and 1440 px in both themes under phase6-review/, each to its own file', () => {
    const shots = planPhase6ReviewShots();
    const files = shots.map((shot) => shot.file);

    expect(shots).toHaveLength(PHASE6_REVIEW_CASES.length * 6);
    expect(new Set(files).size).toBe(files.length);
    expect(files.every((file) => /^phase6-review\/[a-z0-9-]+-(light|dark)-(390|820|1440)\.png$/.test(file))).toBe(true);
    for (const entry of PHASE6_REVIEW_CASES) {
      for (const theme of entry.themes) {
        const widths = shots.filter((shot) => shot.id === entry.id && shot.theme === theme).map((shot) => shot.width);
        expect(widths, `${entry.id} ${theme}`).toEqual([390, 820, 1440]);
      }
    }
    expect(shots.find((shot) => shot.id === 'e2-view')).toMatchObject({ signedInAs: 'Admin' });
    expect(shots.find((shot) => shot.id === 'e3-delete')).toMatchObject({ signedInAs: 'Manager' });
  });
});

describe('renderIndex: the Phase 6 screens (plan 06-19)', () => {
  const escaped = (text: string) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const render = () =>
    renderIndex({
      generatedAt: 'now',
      shots: [],
      problems: [],
      specGap: planSpecGapShots(),
      phase5Review: planPhase5ReviewShots(),
      phase6Review: planPhase6ReviewShots(),
    });

  it('shows the Phase 6 section after the Phase 5 section and before the SPEC-GAP section, with every picture and label', () => {
    const html = render();
    const section = html.indexOf('Company expenses and settings (Phase 6)');

    expect(section).toBeGreaterThan(html.indexOf('Profile, users and audit log (Phase 5)'));
    expect(section).toBeLessThan(html.indexOf('Parts the approved design never drew'));
    for (const shot of planPhase6ReviewShots()) {
      expect(html).toContain(`src="${shot.file}"`);
    }
    for (const entry of PHASE6_REVIEW_CASES) {
      expect(html).toContain(escaped(entry.label));
    }
    expect(html).not.toMatch(/<script/i);
  });

  it('says nothing is approved until the owner says so', () => {
    expect(render()).toContain('Nothing here is approved until you say so.');
  });

  it('is left out when no Phase 6 pictures were taken', () => {
    expect(renderIndex({ generatedAt: 'now', shots: [], problems: [] })).not.toContain(
      'Company expenses and settings (Phase 6)',
    );
  });
});

describe('loading the script (how npm run review starts it)', () => {
  it('loads under plain Node: the copy modules that import the app through "@/" are read through Vite', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "await import('./scripts/owner-review.mjs'); process.stdout.write('loaded');"],
      { cwd: webDirectory, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    expect(result.stderr, result.stderr).not.toContain('Cannot find package');
    expect(result.stdout).toBe('loaded');
    expect(result.status).toBe(0);
  }, 150_000);
});

// --- Plan 06-19 task 2: the Phase 6 rulings page and the words table ---

/** Every string in plain copy, however deeply it nests. */
function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(stringLeaves);
  }
  return [];
}

describe('the Phase 6 rulings page content (plan 06-19)', () => {
  it('lists OQ-1 to OQ-15 first, each with its options and the one that is built', () => {
    const oq = PHASE6_RULINGS.filter((entry) => entry.id.startsWith('OQ-'));

    expect(oq.map((entry) => entry.id)).toEqual(Array.from({ length: 15 }, (_, index) => `OQ-${String(index + 1)}`));
    expect(PHASE6_RULINGS.slice(0, 15).map((entry) => entry.id)).toEqual(oq.map((entry) => entry.id));
    for (const entry of oq) {
      expect(entry.topic.trim(), entry.id).not.toBe('');
      expect(entry.options.length, entry.id).toBeGreaterThan(0);
      expect(
        entry.options.filter((candidate) => candidate.built),
        entry.id,
      ).toHaveLength(1);
      expect(entry.options[0]?.recommended, entry.id).toBe(true);
      expect(entry.status, entry.id).toBe('open');
    }
  });

  it('holds A-06-01, A-06-02, the inline SQL item, research questions 2 and 5 and the deleted and restored snapshot line', () => {
    const ids = PHASE6_RULINGS.map((entry) => entry.id);

    expect(ids.slice(15)).toEqual(['A-06-01', 'A-06-02', 'SQL-06-11', 'RQ-2', 'RQ-5', 'SNAP-06-15']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives A-06-01 three options, recommended first, with option 1 (first sign-in) the one built, and names where the rule changes', () => {
    const entry = PHASE6_RULINGS.find((candidate) => candidate.id === 'A-06-01');

    expect(entry?.options).toHaveLength(3);
    expect(entry?.options.map((option) => option.label)).toEqual(['1', '2', '3']);
    expect(entry?.options.filter((option) => option.recommended).map((option) => option.label)).toEqual(['1']);
    expect(entry?.options.filter((option) => option.built).map((option) => option.label)).toEqual(['1']);
    expect(entry?.options[0]?.text).toContain('first sign-in');
    expect(entry?.options[1]?.text).toContain('has a password');
    expect(entry?.whereItChanges).toContain('StaffDirectory.cs');
    expect(entry?.whereItChanges).toContain('CompanyExpenseReader.cs');
    expect(entry?.whereItChanges).toContain('CompanyExpensesSeedStep.cs');
    expect(entry?.whereItChanges).toContain('StaffLookupEndpointTests');
  });

  it('records the owner’s rulings D-49 and D-50 as rulings with their follow-up, not as approvals', () => {
    const payer = PHASE6_RULINGS.find((candidate) => candidate.id === 'A-06-01');
    const sql = PHASE6_RULINGS.find((candidate) => candidate.id === 'SQL-06-11');

    expect(payer).toMatchObject({ status: 'ruled' });
    expect(payer?.ruling).toContain('D-49');
    expect(payer?.ruling).toContain('06-20');
    expect(payer?.ruling).toContain('built it');
    expect(sql).toMatchObject({ status: 'ruled' });
    expect(sql?.ruling).toContain('D-50');
    expect(sql?.ruling).toContain('06-21');
    expect(sql?.ruling).toContain('built it');
    expect(sql?.options.filter((option) => option.built).map((option) => option.label)).toEqual(['2']);
    expect(sql?.options.filter((option) => option.recommended).map((option) => option.label)).toEqual(['1']);
    for (const file of [
      'IdempotencyGate.cs',
      'AccountTokenStore.cs',
      'ManagerRosterLock.cs',
      'DatabaseLocks',
      'NoInlineSqlTests',
    ]) {
      expect(sql?.whereItChanges, file).toContain(file);
    }
  });

  it('marks nothing as approved on the owner’s behalf and keeps the other items open', () => {
    expect(JSON.stringify(PHASE6_RULINGS)).not.toMatch(/approved/i);
    expect(PHASE6_RULINGS.filter((entry) => entry.status === 'ruled').map((entry) => entry.id)).toEqual([
      'A-06-01',
      'SQL-06-11',
    ]);
    expect(PHASE6_RULINGS.filter((entry) => entry.status === 'open')).toHaveLength(PHASE6_RULINGS.length - 2);
  });

  it('keeps what the tests could not show for the owner’s own eyes', () => {
    expect(PHASE6_LOOK_AT.map((item) => item.id)).toEqual(['total-999', 'former-staff-real', 'zoom', 'ci-speed']);
    for (const item of PHASE6_LOOK_AT) {
      expect(item.what.trim(), item.id).not.toBe('');
      expect(item.how.trim(), item.id).not.toBe('');
    }
  });
});

describe('phase6Words (the words table, 05 D-48)', () => {
  it('has every string of the Company Expenses copy and the Settings copy, and no place or text is empty', () => {
    const words = phase6Words();
    const texts = words.map((row) => row.text);

    for (const leaf of [...stringLeaves(EXPENSES_COPY), ...stringLeaves(SETTINGS_COPY)]) {
      expect(texts, leaf).toContain(leaf);
    }
    expect(words.every((row) => row.place.trim() !== '' && row.text.trim() !== '')).toBe(true);
  });

  it('shows what a function says with placeholders, and the empty and single forms of the entries line', () => {
    const texts = phase6Words().map((row) => row.text);

    expect(texts).toContain('Edit {x}, {y}');
    expect(texts).toContain('No entries yet');
    expect(texts).toContain('1 entry so far');
    expect(texts).toContain('{x} · {y}% of this month');
  });

  it('has the Phase 6 additions of the Audit Log copy: the groups, the twelve labels, the change lines and the snapshot line', () => {
    const texts = phase6Words().map((row) => row.text);

    for (const text of [
      'Company expenses',
      'Expense categories',
      'Expense added',
      'Expense changed',
      'Expense payer changed',
      'Expense deleted',
      'Expense restored',
      'Expense permanently deleted',
      'Category added',
      'Category renamed',
      'Category color changed',
      'Category retired',
      'Category back in use',
      'Category deleted',
      'Amount: ₱8,642.35 to ₱9,100.00',
      'Date: Oct 5, 2026 to Oct 6, 2026',
      'Category: {x} to a deleted category',
      'Paid by: {x} (former staff) to {y}',
      'Description changed',
      'Notes changed',
      'Name: {x}',
      'Color: Blue',
      'Oct 5, 2026 · {x} · ₱8,642.35 · Paid by {y}',
    ]) {
      expect(texts, text).toContain(text);
    }
  });

  it('has no em dash or en dash anywhere (OR-4)', () => {
    for (const row of phase6Words()) {
      expect(row.text, row.place).not.toMatch(/[–—]/);
    }
  });
});

describe('renderIndex: the Phase 6 rulings page (plan 06-19)', () => {
  const escaped = (text: string) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const render = () =>
    renderIndex({ generatedAt: 'now', shots: [], problems: [], phase6Review: planPhase6ReviewShots() });

  it('puts what is still open before what the owner has ruled since, then the things to look at and the words', () => {
    const html = render();
    const open = html.indexOf('Phase 6: still open for you');
    const ruled = html.indexOf('Phase 6: ruled by you since the plan was written');

    expect(open).toBeGreaterThan(html.indexOf('Company expenses and settings (Phase 6)'));
    expect(ruled).toBeGreaterThan(open);
    expect(html.indexOf('<h3>Words on the Phase 6 screens</h3>')).toBeGreaterThan(ruled);
    for (const entry of PHASE6_RULINGS) {
      const at = html.indexOf(`<td>${entry.id}</td>`);
      expect(at, entry.id).toBeGreaterThan(entry.status === 'open' ? open : ruled);
      if (entry.status === 'open') {
        expect(at, entry.id).toBeLessThan(ruled);
      }
      expect(html, entry.id).toContain(escaped(entry.topic));
    }
  });

  it('marks the recommended option and the one built now, and shows the owner’s rulings and the swap point', () => {
    const html = render();

    expect(html).toContain('<em>(recommended)</em>');
    expect(html).toContain('<em>(built now)</em>');
    expect(html).toContain(escaped('Option 1 (D-49, owner, 2026-10-25).'));
    expect(html).toContain('StaffDirectory.cs');
    expect(html).toContain('IdempotencyGate.cs');
    expect(html).toContain('Words on the Phase 6 screens');
    expect(html).toContain(escaped('Amount: ₱8,642.35 to ₱9,100.00'));
    expect(html).not.toMatch(/<script/i);
  });
});
