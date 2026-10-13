// @vitest-environment node
// Pins the Lighthouse gate (PERF-02, research Pattern 13). assertReport compares the raw 0-1 category scores and the raw
// metric values with no rounding (0.95 passes, 0.949 fails; LCP 1999 ms passes, 2000 ms fails; CLS 0.049 passes, 0.05
// fails; TBT is the lab proxy for INP), fails a missing or null category or metric instead of passing it, and lists every
// failure in a fixed order (categories by name, then metrics by name). `npm run lighthouse` (scripts/lighthouse.mjs)
// refuses a busy port 5199 and never stops another process; otherwise it runs the preflight, the production build, the
// real host on https://localhost:5199 (only that child is stopped), lighthouse and the assertion.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertReport, THRESHOLDS } from './lighthouse-assert.mjs';
import { PORT_BUSY_MESSAGE } from './e2e.mjs';
import {
  executeSteps,
  HEALTH_URL,
  LIGHTHOUSE_URL,
  planSteps,
  REPORT_PATH,
  SERVER_PROJECT,
  stopHostSync,
  WWWROOT,
} from './lighthouse.mjs';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));

interface ReportOptions {
  readonly scores?: Readonly<Record<string, number | null>>;
  readonly metrics?: Readonly<Record<string, number | null>>;
}

/** A Lighthouse result with the four categories at 1 and every metric well inside its limit, plus the overrides. */
function lighthouseReport({ scores = {}, metrics = {} }: ReportOptions = {}): unknown {
  const allScores: Record<string, number | null> = {
    performance: 1,
    accessibility: 1,
    'best-practices': 1,
    seo: 1,
    ...scores,
  };
  const allMetrics: Record<string, number | null> = {
    'largest-contentful-paint': 1200,
    'cumulative-layout-shift': 0,
    'total-blocking-time': 40,
    ...metrics,
  };
  return {
    lighthouseVersion: '13.5.0',
    categories: Object.fromEntries(Object.entries(allScores).map(([id, score]) => [id, { id, title: id, score }])),
    audits: Object.fromEntries(
      Object.entries(allMetrics).map(([id, numericValue]) => [id, { id, numericValue, score: 1 }]),
    ),
  };
}

describe('THRESHOLDS (PERF-02)', () => {
  it('requires every category at 0.95 or more and names the four categories', () => {
    expect(THRESHOLDS.minCategoryScore).toBe(0.95);
    expect(THRESHOLDS.categories).toEqual(['accessibility', 'best-practices', 'performance', 'seo']);
  });

  it('holds LCP below 2000 ms, CLS below 0.05 and TBT (the INP lab proxy) below 200 ms, in name order', () => {
    expect(THRESHOLDS.metrics).toEqual([
      { id: 'cumulative-layout-shift', label: 'CLS', below: 0.05, unit: '' },
      { id: 'largest-contentful-paint', label: 'LCP', below: 2000, unit: 'ms' },
      { id: 'total-blocking-time', label: 'TBT', below: 200, unit: 'ms' },
    ]);
  });

  it('is frozen, so no caller can loosen a limit at run time', () => {
    expect(Object.isFrozen(THRESHOLDS)).toBe(true);
    expect(Object.isFrozen(THRESHOLDS.categories)).toBe(true);
    expect(Object.isFrozen(THRESHOLDS.metrics)).toBe(true);
    expect(THRESHOLDS.metrics.every((metric) => Object.isFrozen(metric))).toBe(true);
  });
});

describe('assertReport: boundaries (PERF-02 boundary edge)', () => {
  it('passes a report with every category at 1 and every metric inside its limit', () => {
    const result = assertReport(lighthouseReport());

    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('passes a category score of exactly 0.95 and fails 0.949', () => {
    expect(assertReport(lighthouseReport({ scores: { performance: 0.95 } })).passed).toBe(true);

    const result = assertReport(lighthouseReport({ scores: { performance: 0.949 } }));
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['category performance: score 0.949 is below 0.95']);
  });

  it('passes LCP 1999 ms and fails LCP 2000 ms', () => {
    expect(assertReport(lighthouseReport({ metrics: { 'largest-contentful-paint': 1999 } })).passed).toBe(true);

    const result = assertReport(lighthouseReport({ metrics: { 'largest-contentful-paint': 2000 } }));
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['metric LCP (largest-contentful-paint): 2000 ms is not below 2000 ms']);
  });

  it('passes CLS 0.049 and fails CLS 0.05', () => {
    expect(assertReport(lighthouseReport({ metrics: { 'cumulative-layout-shift': 0.049 } })).passed).toBe(true);

    const result = assertReport(lighthouseReport({ metrics: { 'cumulative-layout-shift': 0.05 } }));
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['metric CLS (cumulative-layout-shift): 0.05 is not below 0.05']);
  });

  it('passes TBT 199 ms and fails TBT 200 ms', () => {
    expect(assertReport(lighthouseReport({ metrics: { 'total-blocking-time': 199 } })).passed).toBe(true);

    const result = assertReport(lighthouseReport({ metrics: { 'total-blocking-time': 200 } }));
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['metric TBT (total-blocking-time): 200 ms is not below 200 ms']);
  });
});

describe('assertReport: raw values, never rounded (PERF-02 precision edge)', () => {
  it('fails a score of 0.9499999 that would round to 0.95', () => {
    const result = assertReport(lighthouseReport({ scores: { accessibility: 0.9499999 } }));

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['category accessibility: score 0.9499999 is below 0.95']);
  });

  it('passes LCP 1999.9 ms and fails LCP 2000.0001 ms', () => {
    expect(assertReport(lighthouseReport({ metrics: { 'largest-contentful-paint': 1999.9 } })).passed).toBe(true);
    expect(assertReport(lighthouseReport({ metrics: { 'largest-contentful-paint': 2000.0001 } })).passed).toBe(false);
  });

  it('passes CLS 0.04999 and fails CLS 0.0500001', () => {
    expect(assertReport(lighthouseReport({ metrics: { 'cumulative-layout-shift': 0.04999 } })).passed).toBe(true);
    expect(assertReport(lighthouseReport({ metrics: { 'cumulative-layout-shift': 0.0500001 } })).passed).toBe(false);
  });
});

describe('assertReport: missing or null values fail (PERF-02 empty edge)', () => {
  it('fails a category that is missing from the report', () => {
    const report = lighthouseReport() as { categories: Record<string, unknown> };
    delete report.categories.seo;

    const result = assertReport(report);
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['category seo: missing from the report']);
  });

  it('fails a category whose score is null (Lighthouse could not score it)', () => {
    const result = assertReport(lighthouseReport({ scores: { 'best-practices': null } }));

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['category best-practices: no score']);
  });

  it('fails a metric whose audit is missing', () => {
    const report = lighthouseReport() as { audits: Record<string, unknown> };
    delete report.audits['total-blocking-time'];

    const result = assertReport(report);
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['metric TBT (total-blocking-time): missing from the report']);
  });

  it('fails a metric whose value is null', () => {
    const result = assertReport(lighthouseReport({ metrics: { 'largest-contentful-paint': null } }));

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['metric LCP (largest-contentful-paint): no value']);
  });

  it('fails every category and metric when the report is not a Lighthouse result at all', () => {
    for (const notAReport of [null, undefined, 'report', 42, {}]) {
      const result = assertReport(notAReport);

      expect(result.passed).toBe(false);
      expect(result.failures).toEqual([
        'category accessibility: missing from the report',
        'category best-practices: missing from the report',
        'category performance: missing from the report',
        'category seo: missing from the report',
        'metric CLS (cumulative-layout-shift): missing from the report',
        'metric LCP (largest-contentful-paint): missing from the report',
        'metric TBT (total-blocking-time): missing from the report',
      ]);
    }
  });

  it('also holds a category the report adds beyond the four to 0.95', () => {
    const result = assertReport(lighthouseReport({ scores: { pwa: 0.3 } }));

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(['category pwa: score 0.3 is below 0.95']);
  });
});

describe('assertReport: every failure, in a fixed order (PERF-02 ordering edge)', () => {
  it('lists the categories by name, then the metrics by name, not only the first failure', () => {
    const report = {
      categories: {
        seo: { id: 'seo', score: 0.5 },
        performance: { id: 'performance', score: 0.9 },
        accessibility: { id: 'accessibility', score: 0.94 },
        'best-practices': { id: 'best-practices', score: 1 },
      },
      audits: {
        'total-blocking-time': { numericValue: 350 },
        'largest-contentful-paint': { numericValue: 2600 },
        'cumulative-layout-shift': { numericValue: 0.2 },
      },
    };

    expect(assertReport(report).failures).toEqual([
      'category accessibility: score 0.94 is below 0.95',
      'category performance: score 0.9 is below 0.95',
      'category seo: score 0.5 is below 0.95',
      'metric CLS (cumulative-layout-shift): 0.2 is not below 0.05',
      'metric LCP (largest-contentful-paint): 2600 ms is not below 2000 ms',
      'metric TBT (total-blocking-time): 350 ms is not below 200 ms',
    ]);
  });

  it('reports one summary line per category and metric with its value and limit, failing or not', () => {
    const result = assertReport(lighthouseReport({ scores: { seo: 0.5 } }));

    expect(result.lines).toEqual([
      'category accessibility: 1 (needs >= 0.95) ok',
      'category best-practices: 1 (needs >= 0.95) ok',
      'category performance: 1 (needs >= 0.95) ok',
      'category seo: 0.5 (needs >= 0.95) FAIL',
      'metric CLS (cumulative-layout-shift): 0 (needs < 0.05) ok',
      'metric LCP (largest-contentful-paint): 1200 ms (needs < 2000 ms) ok',
      'metric TBT (total-blocking-time): 40 ms (needs < 200 ms) ok',
    ]);
  });
});

describe('planSteps (lighthouse.mjs)', () => {
  it('refuses with the single E2E wait message when port 5199 is busy, and never plans a kill', () => {
    expect(planSteps({ portBusy: true })).toEqual([
      { kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 },
    ]);
  });

  // The shared-machine preflight is a wait gate in main(), before planning (shared-machine.mjs, TOOL-WR-08).
  it('runs the production build, the host, lighthouse and the assertion, in that order', () => {
    const steps = planSteps({ portBusy: false });

    expect(steps.map((step) => step.name)).toEqual(['build', 'host', 'lighthouse', 'assert']);
  });

  it('builds production into wwwroot with this Node binary and the vite JS entry', () => {
    expect(planSteps({ portBusy: false })[0]).toEqual({
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build'],
      cwd: webDirectory,
    });
  });

  it('starts the real host on https://localhost:5199 serving wwwroot, with Development set on that child only', () => {
    expect(WWWROOT).toBe(fileURLToPath(new URL('../../src/Csps.Server/wwwroot', import.meta.url)));
    expect(SERVER_PROJECT).toBe(fileURLToPath(new URL('../../src/Csps.Server', import.meta.url)));
    expect(HEALTH_URL).toBe('https://localhost:5199/health');
    expect(planSteps({ portBusy: false })[1]).toEqual({
      kind: 'host',
      name: 'host',
      command: 'dotnet',
      args: [
        'run',
        '--project',
        SERVER_PROJECT,
        '--no-launch-profile',
        '--',
        '--urls',
        'https://localhost:5199',
        '--webroot',
        WWWROOT,
      ],
      cwd: SERVER_PROJECT,
      env: { ASPNETCORE_ENVIRONMENT: 'Development' },
      healthUrl: HEALTH_URL,
    });
  });

  it('runs lighthouse 13 on the mobile profile with error reporting off, writing JSON to the git-ignored artifacts', () => {
    expect(LIGHTHOUSE_URL).toBe('https://localhost:5199/');
    expect(REPORT_PATH).toBe(fileURLToPath(new URL('../../artifacts/lighthouse/report.json', import.meta.url)));
    expect(planSteps({ portBusy: false, chromePath: 'C:/chrome/chrome.exe' })[2]).toEqual({
      kind: 'run',
      name: 'lighthouse',
      command: process.execPath,
      args: [
        'node_modules/lighthouse/cli/index.js',
        LIGHTHOUSE_URL,
        '--output=json',
        `--output-path=${REPORT_PATH}`,
        '--quiet',
        '--no-enable-error-reporting',
        '--form-factor=mobile',
        '--chrome-flags=--headless=new --ignore-certificate-errors',
      ],
      cwd: webDirectory,
      env: { CHROME_PATH: 'C:/chrome/chrome.exe' },
    });
  });

  it('lets lighthouse find Chrome itself when no browser path is given', () => {
    const lighthouse = planSteps({ portBusy: false })[2];

    expect(lighthouse).toMatchObject({ name: 'lighthouse', env: {} });
  });

  it('asserts the report it wrote', () => {
    expect(planSteps({ portBusy: false })[3]).toEqual({ kind: 'assert', name: 'assert', reportPath: REPORT_PATH });
  });

  it('never spawns a .cmd or .bat shim, npm or npx (L-22)', () => {
    for (const step of planSteps({ portBusy: false })) {
      if (step.kind === 'run' || step.kind === 'host') {
        expect(step.command).not.toMatch(/\.(cmd|bat)$|^(npm|npx)$/i);
        expect(step.args.some((arg) => /\.(cmd|bat)$/i.test(arg))).toBe(false);
      }
    }
  });
});

/** Fakes for executeSteps: records what ran, in order, and answers with planned results. */
function fakeDeps(options: { runStatus?: Record<string, number>; hostFails?: boolean; report?: unknown } = {}) {
  const events: string[] = [];
  const deps = {
    run: (step: { name: string }) => {
      events.push(`run ${step.name}`);
      return options.runStatus?.[step.name] ?? 0;
    },
    startHost: (step: { name: string }) => {
      events.push(`start ${step.name}`);
      if (options.hostFails === true) {
        return Promise.reject(new Error('the host exited before /health answered'));
      }
      return Promise.resolve({
        stop: () => {
          events.push('stop host');
          return Promise.resolve();
        },
      });
    },
    readReport: (file: string) => {
      events.push(`read ${file === REPORT_PATH ? 'report' : file}`);
      return options.report ?? lighthouseReport();
    },
    log: (line: string) => {
      events.push(`log ${line}`);
    },
  };
  return { events, deps };
}

describe('executeSteps (lighthouse.mjs)', () => {
  it('runs every step, stops the host it started after lighthouse, and returns 0 when the report passes', async () => {
    const { events, deps } = fakeDeps();

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(0);

    expect(events.filter((event) => !event.startsWith('log '))).toEqual([
      'run build',
      'start host',
      'run lighthouse',
      'stop host',
      'read report',
    ]);
  });

  it('returns 1 and logs every failure when the report misses a threshold', async () => {
    const { events, deps } = fakeDeps({ report: lighthouseReport({ scores: { seo: 0.9 } }) });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(1);
    expect(events).toContain('log lighthouse: category seo: score 0.9 is below 0.95');
  });

  it('still stops the host when lighthouse itself fails, and never reads a report', async () => {
    const { events, deps } = fakeDeps({ runStatus: { lighthouse: 2 } });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(2);
    expect(events.filter((event) => !event.startsWith('log '))).toEqual([
      'run build',
      'start host',
      'run lighthouse',
      'stop host',
    ]);
  });

  it('stops at a failed build without starting the host', async () => {
    const { events, deps } = fakeDeps({ runStatus: { build: 1 } });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(1);
    expect(events.filter((event) => !event.startsWith('log '))).toEqual(['run build']);
  });

  it('returns 1 without running lighthouse when the host never becomes healthy', async () => {
    const { events, deps } = fakeDeps({ hostFails: true });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(1);
    expect(events.filter((event) => !event.startsWith('log '))).toEqual(['run build', 'start host']);
    expect(events).toContain('log lighthouse: the host exited before /health answered');
  });

  it('prints the refusal and runs nothing when the port is busy', async () => {
    const { events, deps } = fakeDeps();

    expect(await executeSteps(planSteps({ portBusy: true }), deps)).toBe(1);
    expect(events).toEqual([`log lighthouse: ${PORT_BUSY_MESSAGE}`]);
  });
});

// TOOL-WR-10: on Linux and macOS the host runs in its own process group, so the terminal's Ctrl+C never reaches it. A
// signal handler must stop it synchronously before process.exit, or the host stays on 5199 after the lock is gone.
describe('stopHostSync (TOOL-WR-10)', () => {
  function fakes(goneAfter: number) {
    const calls: string[] = [];
    let checks = 0;
    return {
      calls,
      tools: {
        kill: (pid: number, signal: string) => calls.push(`kill ${String(pid)} ${signal}`),
        taskkill: (pid: number) => calls.push(`taskkill ${String(pid)}`),
        isGone: () => {
          checks += 1;
          return checks > goneAfter;
        },
        sleepSync: (ms: number) => calls.push(`sleep ${String(ms)}`),
      },
    };
  }

  it('sends SIGTERM to the host process group on POSIX and stops when it is gone', () => {
    const { calls, tools } = fakes(1);
    stopHostSync(4321, { platform: 'linux', ...tools });
    expect(calls).toEqual(['kill -4321 SIGTERM', 'sleep 100']);
  });

  it('sends SIGKILL to the group when SIGTERM did not end it within the grace period', () => {
    const { calls, tools } = fakes(1_000);
    stopHostSync(4321, { platform: 'darwin', ...tools, graceMs: 300 });
    expect(calls).toEqual(['kill -4321 SIGTERM', 'sleep 100', 'sleep 100', 'sleep 100', 'kill -4321 SIGKILL']);
  });

  it('stops the tree of that one child by its own pid on Windows', () => {
    const { calls, tools } = fakes(0);
    stopHostSync(77, { platform: 'win32', ...tools });
    expect(calls).toEqual(['taskkill 77']);
  });

  it.each([['lighthouse.mjs'], ['owner-review.mjs']])(
    '%s stops its running host in the signal handler before it exits',
    (file) => {
      const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
      const handler = /const onSignal = \(\) => \{([\s\S]*?)\n {2}\};/.exec(source)?.[1] ?? '';
      expect(handler).toContain('stopRunningHostsSync()');
      expect(handler.indexOf('stopRunningHostsSync()')).toBeLessThan(handler.indexOf('process.exit(130)'));
    },
  );
});
