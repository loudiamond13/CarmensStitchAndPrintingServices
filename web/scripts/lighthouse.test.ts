// @vitest-environment node
// D-28, D-29 (plan 11-36): the Lighthouse run scores the four real public pages (/, /products, /gallery, /contact) on the
// mobile profile, writes one report per page and prints the LCP of each. LCP stays report-only (D-29); every other
// limit still fails the run on any page.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  executeSteps,
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_URL,
  LIGHTHOUSE_URLS,
  ORIGIN,
  PAGE_PAUSE_MS,
  planSteps,
  REPORT_PATH,
  reportPathFor,
} from './lighthouse.mjs';

const artifacts = fileURLToPath(new URL('../../artifacts/lighthouse/', import.meta.url));

/** A Lighthouse result with the four categories at 1 and every metric inside its limit, plus the overrides. */
function report(lcp = 1500, overrides: { seo?: number; cls?: number } = {}): unknown {
  return {
    categories: {
      performance: { score: 1 },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: { score: overrides.seo ?? 1 },
    },
    audits: {
      'cumulative-layout-shift': { numericValue: overrides.cls ?? 0 },
      'largest-contentful-paint': { numericValue: lcp },
      'total-blocking-time': { numericValue: 40 },
    },
  };
}

function fakeDeps(options: { reports?: Record<string, unknown>; runStatus?: Record<string, number> } = {}) {
  const events: string[] = [];
  const deps = {
    run: (step: { name: string; args: readonly string[] }) => {
      const page = step.name === 'lighthouse' ? ` ${step.args[1] ?? ''}` : '';
      events.push(`run ${step.name}${page}`);
      return options.runStatus?.[`${step.name}${page}`] ?? 0;
    },
    sleep: (ms: number) => {
      events.push(`sleep ${String(ms)}`);
      return Promise.resolve();
    },
    startHost: () => {
      events.push('start host');
      return Promise.resolve({
        stop: () => {
          events.push('stop host');
          return Promise.resolve();
        },
      });
    },
    readReport: (file: string) => {
      events.push(`read ${file.replace(artifacts, '')}`);
      return options.reports?.[file.replace(artifacts, '')] ?? report();
    },
    log: (line: string) => {
      events.push(`log ${line}`);
    },
  };
  return { events, deps };
}

const withoutLogs = (events: readonly string[]) => events.filter((event) => !event.startsWith('log '));

describe('the pages (lighthouse.mjs)', () => {
  it('scores the four public pages, Home first', () => {
    expect(LIGHTHOUSE_PAGES).toEqual(['/', '/products', '/gallery', '/contact']);
    expect(LIGHTHOUSE_URLS).toEqual([`${ORIGIN}/`, `${ORIGIN}/products`, `${ORIGIN}/gallery`, `${ORIGIN}/contact`]);
    expect(LIGHTHOUSE_URL).toBe(LIGHTHOUSE_URLS[0]);
  });

  it('writes one report file per page, the Home report keeping its old name', () => {
    expect(reportPathFor('/')).toBe(REPORT_PATH);
    expect(reportPathFor('/products')).toBe(`${artifacts}report-products.json`);
    expect(reportPathFor('/gallery')).toBe(`${artifacts}report-gallery.json`);
    expect(reportPathFor('/contact')).toBe(`${artifacts}report-contact.json`);
    expect(new Set(LIGHTHOUSE_PAGES.map((page) => reportPathFor(page))).size).toBe(4);
  });
});

describe('planSteps for four pages (lighthouse.mjs)', () => {
  it('builds once, starts the host once, runs lighthouse on each page, then asserts each page', () => {
    const steps = planSteps({ portBusy: false });

    expect(steps.map((step) => step.name)).toEqual([
      'build',
      'host',
      'lighthouse',
      'lighthouse',
      'lighthouse',
      'lighthouse',
      'assert',
      'assert',
      'assert',
      'assert',
    ]);
  });

  it('gives each lighthouse step its page address and its own report, with the same mobile flags', () => {
    const lighthouse = planSteps({ portBusy: false, chromePath: 'C:/chrome/chrome.exe' }).filter(
      (step) => step.name === 'lighthouse',
    );

    expect(lighthouse).toHaveLength(4);
    for (const [index, step] of lighthouse.entries()) {
      const page = LIGHTHOUSE_PAGES[index];
      expect(step).toMatchObject({ kind: 'run', page, env: { CHROME_PATH: 'C:/chrome/chrome.exe' } });
      if (step.kind === 'run') {
        expect(step.args).toEqual([
          'node_modules/lighthouse/cli/index.js',
          LIGHTHOUSE_URLS[index],
          '--output=json',
          `--output-path=${reportPathFor(page ?? '/')}`,
          '--quiet',
          '--no-enable-error-reporting',
          '--form-factor=mobile',
          '--chrome-flags=--headless=new --ignore-certificate-errors',
        ]);
      }
    }
  });

  it('asserts the report of each page in order', () => {
    const asserts = planSteps({ portBusy: false }).filter((step) => step.name === 'assert');

    expect(asserts).toEqual(
      LIGHTHOUSE_PAGES.map((page) => ({ kind: 'assert', name: 'assert', page, reportPath: reportPathFor(page) })),
    );
  });
});

describe('executeSteps for four pages (lighthouse.mjs)', () => {
  // Lighthouse answers NO_NAVSTART ("run it again") when a second Chrome starts within seconds of the first one closing.
  it('pauses 15 seconds between pages, never before the first or after the last', () => {
    expect(PAGE_PAUSE_MS).toBe(15_000);
  });

  it('runs every page on the one host, stops the host after the last page, then reads every report', async () => {
    const { events, deps } = fakeDeps();

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(0);

    expect(withoutLogs(events)).toEqual([
      'run build',
      'start host',
      `run lighthouse ${ORIGIN}/`,
      `sleep ${String(PAGE_PAUSE_MS)}`,
      `run lighthouse ${ORIGIN}/products`,
      `sleep ${String(PAGE_PAUSE_MS)}`,
      `run lighthouse ${ORIGIN}/gallery`,
      `sleep ${String(PAGE_PAUSE_MS)}`,
      `run lighthouse ${ORIGIN}/contact`,
      'stop host',
      'read report.json',
      'read report-products.json',
      'read report-gallery.json',
      'read report-contact.json',
    ]);
  });

  it('prints the LCP of every page, labelled with the page, and a one-line table', async () => {
    const { events, deps } = fakeDeps({
      reports: {
        'report.json': report(1812),
        'report-products.json': report(1904),
        'report-gallery.json': report(2110),
        'report-contact.json': report(1750),
      },
    });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(0);

    expect(events).toContain('log lighthouse /: metric LCP (largest-contentful-paint): 1812 ms (needs < 2000 ms) ok');
    expect(events).toContain(
      'log lighthouse /gallery: metric LCP (largest-contentful-paint): 2110 ms (needs < 2000 ms) WAIVED',
    );
    expect(events).toContain(
      'log lighthouse: LCP by page (target 2000 ms, report only, D-29): / 1812 ms, /products 1904 ms, /gallery 2110 ms, /contact 1750 ms',
    );
  });

  it('passes when only a waived LCP misses, on any page (D-29)', async () => {
    const { deps } = fakeDeps({ reports: { 'report-contact.json': report(2500) } });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(0);
  });

  it('fails when a non-LCP limit is missed on any page, and still prints every page', async () => {
    const { events, deps } = fakeDeps({ reports: { 'report-products.json': report(1500, { seo: 0.9 }) } });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(1);

    expect(events).toContain('log lighthouse /products: category seo: score 0.9 is below 0.95');
    expect(events.filter((event) => event.startsWith('read '))).toHaveLength(4);
    expect(events.some((event) => event.startsWith('log lighthouse /contact: passed'))).toBe(true);
  });

  it('writes one heading per page to the run summary', async () => {
    const { deps } = fakeDeps();
    const written: string[] = [];

    await executeSteps(planSteps({ portBusy: false }), { ...deps, summary: (text: string) => written.push(text) });

    const text = written.join('');
    for (const page of LIGHTHOUSE_PAGES) {
      expect(text).toContain(`### Lighthouse ${page}`);
    }
  });

  it('stops the host and the run when lighthouse fails on a page, and never reads a report', async () => {
    const { events, deps } = fakeDeps({ runStatus: { [`lighthouse ${ORIGIN}/gallery`]: 2 } });

    expect(await executeSteps(planSteps({ portBusy: false }), deps)).toBe(2);

    expect(withoutLogs(events)).toEqual([
      'run build',
      'start host',
      `run lighthouse ${ORIGIN}/`,
      `sleep ${String(PAGE_PAUSE_MS)}`,
      `run lighthouse ${ORIGIN}/products`,
      `sleep ${String(PAGE_PAUSE_MS)}`,
      `run lighthouse ${ORIGIN}/gallery`,
      'stop host',
    ]);
  });
});
